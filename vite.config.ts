import { spawnSync } from "node:child_process"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const root = fileURLToPath(new URL(".", import.meta.url))

function pullSubstack() {
  let detail = "no python found"
  for (const python of ["python", "python3"]) {
    const result = spawnSync(python, ["scripts/pull_substack.py"], {
      cwd: root,
      encoding: "utf8",
      timeout: 40000,
      windowsHide: true,
    })
    if (result.status === 0) {
      console.log(`[substack] ${result.stdout.trim()}`)
      return
    }
    // ENOENT means this interpreter name is missing; try the next one.
    if ((result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") continue
    detail = (result.stderr || result.stdout || result.error?.message || "unknown").trim()
    break
  }
  console.warn(`[substack] RSS pull skipped (${detail}). Using the last generated file.`)
}

function substackRss() {
  return {
    name: "substack-rss",
    apply: "build" as const,
    buildStart() {
      pullSubstack()
    },
  }
}

/** Dev only: GET /__link-preview?url=… for the editor's link cards (production: Edge Function link-preview). */
function linkPreviewDev() {
  return {
    name: "link-preview-dev",
    apply: "serve" as const,
    configureServer(server: { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void } }) {
      server.middlewares.use("/__link-preview", async (req, res) => {
        res.setHeader("content-type", "application/json; charset=utf-8")
        try {
          const target = new URL(req.url ?? "", "http://localhost").searchParams.get("url") ?? ""
          const { linkPreview } = await import("./scripts/link-preview.mjs")
          res.end(JSON.stringify(await linkPreview(target)))
        } catch (error) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Урьдчилан харах боломжгүй" }))
        }
      })
    },
  }
}

/** `--mode admin`: the same index.html boots the admin (src/admin-main.tsx) instead of the public site. */
function adminEntry() {
  return {
    name: "admin-entry",
    transformIndexHtml: {
      // "pre", so the swap happens before Vite picks up the entry script.
      order: "pre" as const,
      handler: (html: string) =>
        html
          .replace("/src/main.tsx", "/src/admin-main.tsx")
          .replace(/<title>.*<\/title>/, '<title>Редакц · EZ Эдийн засаг</title>\n    <meta name="robots" content="noindex, nofollow" />'),
    },
  }
}

/**
 * `--mode admin`: Cloudflare Pages headers for admin.ediinzasag.mn. Only the admin itself may
 * frame it (its own article preview; stops clickjacking), plugins and <base> tricks are off, and browsers stay on HTTPS.
 */
function adminHeaders() {
  const headers = [
    "/*",
    "  X-Frame-Options: SAMEORIGIN",
    "  Content-Security-Policy: frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
    "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  X-Content-Type-Options: nosniff",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
    "",
  ].join("\n")
  return {
    name: "admin-headers",
    apply: "build" as const,
    generateBundle(this: { emitFile: (file: { type: "asset"; fileName: string; source: string }) => void }) {
      this.emitFile({ type: "asset", fileName: "_headers", source: headers })
    },
  }
}

/**
 * Public site only: a preconnect to Supabase (articles, quotes, comments all come from there) and,
 * when VITE_GA_ID is set (GitHub → Settings → Variables), Google Analytics 4. GA4's enhanced
 * measurement counts the app's route changes as page views, so nothing else is needed in the app.
 */
function publicHead() {
  return {
    name: "public-head",
    transformIndexHtml(html: string) {
      const supabase = process.env.VITE_SUPABASE_URL
      const ga = process.env.VITE_GA_ID?.trim()
      const tags = [
        ...(supabase ? [`<link rel="preconnect" href="${new URL(supabase).origin}" crossorigin />`] : []),
        ...(ga && /^G-[A-Z0-9]+$/.test(ga)
          ? [
              // The tag (about 170 kB) loads after the page's own load so it doesn't hold up the first paint;
              // the queued config still sends the page view once it arrives.
              `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${ga}");addEventListener("load",function(){var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id=${ga}";document.head.appendChild(s)})</script>`,
            ]
          : []),
      ]
      return tags.length ? html.replace("</head>", `  ${tags.join("\n    ")}\n  </head>`) : html
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE || "/",
  // The Substack pull and the public head (preconnect, analytics) only belong to the public site.
  plugins: [...(mode === "admin" ? [adminEntry(), adminHeaders()] : [substackRss(), publicHead()]), linkPreviewDev(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
    },
  },
  server: {
    port: mode === "admin" ? 5181 : 5180,
    strictPort: true,
  },
}))
