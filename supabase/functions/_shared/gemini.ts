/*
 * Gemini for the edge functions (news-agent, market-calendar): JSON answers
 * shaped by a schema, with patience. On quota (429) or overload (500/503) it
 * waits as long as Google asks (up to 25 s) and retries once, then moves to
 * the next model in the list; a model retired for this key is skipped too.
 * Old models are retired for new keys without notice, so model lists come
 * from Google's own ListModels for the key, not from a fixed name.
 */

const KEY = () => Deno.env.get("GEMINI_API_KEY") ?? ""
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Gemini's schema dialect has no additionalProperties. */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema)
  if (!schema || typeof schema !== "object") return schema
  return Object.fromEntries(
    Object.entries(schema as Record<string, unknown>)
      .filter(([key]) => key !== "additionalProperties")
      .map(([key, value]) => [key, toGeminiSchema(value)]),
  )
}

export class GeminiBusy extends Error {
  constructor(message: string, readonly retryAfterMs: number, readonly daily: boolean) {
    super(message)
  }
}

export type ThinkingLevel = "minimal" | "low" | "medium" | "high"

/**
 * One call to one model. 429 / 500 / 503 throw GeminiBusy so the caller can wait or switch.
 * Gemini 3 ignores temperature (later models reject it), so consistency comes from the
 * prompt and schema and effort from `thinking`; older backups keep a low temperature.
 */
export async function callGemini<T>(model: string, system: string, prompt: string, schema: object, thinking?: ThinkingLevel): Promise<T | null> {
  const tuning = version(model) >= 3 ? (thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}) : { temperature: 0.3 }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY() },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema), ...tuning },
    }),
    signal: AbortSignal.timeout(90_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.error?.message ?? `HTTP ${response.status}`
    if (response.status === 429 || response.status === 500 || response.status === 503) {
      const details: { retryDelay?: string; violations?: { quotaId?: string }[] }[] = data?.error?.details ?? []
      // Google says how long to wait ("RetryInfo", e.g. "23s"); a per-day quota won't recover within the run.
      const delay = details.find((detail) => detail.retryDelay)?.retryDelay
      const daily = details.some((detail) => detail.violations?.some((violation) => /PerDay/i.test(violation.quotaId ?? "")))
      const label = response.status === 429 ? "үнэгүй хязгаарт хүрлээ" : "ачаалал ихтэй байна"
      throw new GeminiBusy(`Gemini (${model}) ${label}: ${message}`, delay ? parseFloat(delay) * 1000 : 0, daily)
    }
    throw new Error(`Gemini (${model}): ${message}`)
  }
  const candidate = data?.candidates?.[0]
  if (!candidate || candidate.finishReason === "SAFETY" || candidate.finishReason === "PROHIBITED_CONTENT") {
    console.warn("declined:", candidate?.finishReason ?? data?.promptFeedback?.blockReason ?? "no candidate")
    return null
  }
  if (candidate.finishReason === "MAX_TOKENS") throw new Error(`Gemini (${model}) хариу тасарсан (MAX_TOKENS)`)
  const text = (candidate.content?.parts ?? []).map((part: { text?: string }) => part.text ?? "").join("")
  return JSON.parse(text) as T
}

let listed: Promise<string[]> | null = null

/** Text models this key may call, as bare names ("gemini-3.8-flash"), asked once per run. */
export function listGeminiModels(): Promise<string[]> {
  listed ??= fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    headers: { "x-goog-api-key": KEY() },
    signal: AbortSignal.timeout(10_000),
  })
    .then((response) => (response.ok ? response.json() : { models: [] }))
    .then((data: { models?: { name: string; supportedGenerationMethods?: string[] }[] }) =>
      (data.models ?? [])
        .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
        .map((model) => model.name.replace(/^models\//, "")),
    )
    .catch(() => [])
  return listed
}

const version = (name: string) => Number(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0)

/** Full Flash models other than `primary`, newest first, then Flash-Lite: the news agent's backups. */
export async function flashBackups(primary: string, limit = 2) {
  return (await listGeminiModels())
    .filter((name) => /^gemini-[\d.]+-flash(-lite)?$/.test(name) && name !== primary)
    .sort((a, b) => Number(a.includes("lite")) - Number(b.includes("lite")) || version(b) - version(a))
    .slice(0, limit)
}

/** Flash-Lite models, oldest (cheapest) first: the calendar's models. Retired ones are skipped when called. */
export async function cheapestLite(limit = 3) {
  return (await listGeminiModels())
    .filter((name) => /^gemini-[\d.]+-flash-lite$/.test(name))
    .sort((a, b) => version(a) - version(b))
    .slice(0, limit)
}

/**
 * Ask the first model, then the rest in order when one is busy, out of quota or
 * retired. `served` collects the models that answered, for the run log.
 */
export async function geminiAsk<T>(options: {
  system: string
  prompt: string
  schema: object
  models: string[]
  /** More models to try once the first is busy (looked up only if needed). */
  backups?: () => Promise<string[]>
  served?: Set<string>
  /** Gemini 3 thinking level for this stage (guide v2.1, 15.3). */
  thinking?: ThinkingLevel
}): Promise<T | null> {
  const { system, prompt, schema, served, thinking } = options
  let models = options.models.filter(Boolean)
  if (!models.length && options.backups) models = await options.backups()
  if (!models.length) throw new Error("Gemini: ашиглах загвар олдсонгүй")
  let last: Error | null = null
  let expanded = !options.backups
  for (let index = 0; index < models.length; index++) {
    const model = models[index]
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const answer = await callGemini<T>(model, system, prompt, schema, thinking)
        served?.add(model)
        return answer
      } catch (error) {
        const retired = error instanceof Error && /no longer available|not found|is not supported/i.test(error.message)
        // The first model's own errors (a bad key, a bad request) end it; a backup that's retired is just skipped.
        if (!(error instanceof GeminiBusy) && !(retired && (index > 0 || options.models.length === 0))) throw error
        last = error as Error
        console.warn((error as Error).message)
        if (retired || (error as GeminiBusy).daily || attempt === 1) break
        await sleep(Math.min(25_000, (error as GeminiBusy).retryAfterMs || 6_000))
      }
    }
    if (!expanded && index === models.length - 1) {
      expanded = true
      const more = (await options.backups!()).filter((name) => !models.includes(name))
      models = [...models, ...more]
    }
  }
  throw last ?? new Error("Gemini хариу өгсөнгүй")
}
