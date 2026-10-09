import { publicUrl } from "@/lib/public-url"
import type { Article, AuthorStats, Insights, Member, NewsRun } from "@/admin/types"
import { regions } from "@/reader/regions"

/*
 * Demo-only data: sample agent briefings (what supabase/functions/news-agent
 * produces) and made-up audience numbers for /admin/insights. Nothing here is
 * real news; sources point at example.com and every item says it is a sample.
 */

interface Sample {
  key: string
  title: string
  dek: string
  body: string
  desk: Article["desk"]
  tags: string[]
  cover: string
  notes: string
}

const samples: Sample[] = [
  {
    key: "copper-demand",
    title: "Жишээ: Зэсийн эрэлт Азид дахин сэргэж байна",
    dek: "Демо горимын жишээ мэдээ. Агент гадаад эх сурвалжаас орчуулж, хянуулахаар илгээсэн мэт харагдана.",
    body:
      "<h2>Юу болов</h2><p>Энэ бол демо горимын жишээ тойм. Бодит агент гадаадын эдийн засгийн мэдээг уншиж, Монголын уншигчдад хамгийн чухлыг нь сонгоод, монгол хэл рүү орчуулж, ийм ноорог үүсгэнэ. Энд бичсэн тоо, баримт зохиомол бөгөөд зөвхөн ажлын урсгалыг туршихад зориулагдсан.</p>" +
      "<p>Азийн томоохон эдийн засгуудад дэд бүтцийн төсөл нэмэгдсэнээр зэсийн эрэлт өсөж байна гэж жишээ эх сурвалж бичжээ. Үнэ сүүлийн хэдэн долоо хоногт тогтвортой өссөн гэж мэдээлсэн.</p>" +
      "<h2>Монголд ямар хамаатай вэ</h2><p>Зэс бол Монголын экспортын гол бүтээгдэхүүний нэг. Дэлхийн үнэ өсөх нь экспортын орлого, төсвийн орлого, төгрөгийн ханшид шууд нөлөөлдөг. Хянагч энэ хэсэгт Монголбанк, Үндэсний статистикийн хорооны сүүлийн тоог нэмж, эх сурвалжийг шалгаж, өөрийн дүгнэлтийг бичнэ.</p>" +
      "<p>Нийтлэхээс өмнө редакц тоо бүрийг анхны эх сурвалжтай тулгаж, гарчгийг тайван, ойлгомжтой болгоно.</p>",
    desk: "world",
    tags: ["mining", "china", "markets"],
    cover: "stories/copper-coal-friday.jpg",
    notes: "Үнийн өсөлтийн хувийг анхны эх сурвалжаас шалгах. Монголын экспортын сүүлийн сарын тоог нэмэх.",
  },
  {
    key: "oil-supply",
    title: "Жишээ: Нефтийн нийлүүлэлт буурч, шатахууны үнэд дарамт",
    dek: "Демо горимын жишээ мэдээ. Олон улсын нефтийн зах зээлийн мэдээг агент товчилж орчуулсан мэт.",
    body:
      "<h2>Юу болов</h2><p>Энэ бол демо горимын жишээ тойм бөгөөд бодит үйл явдал биш. Нефть олборлогч орнууд нийлүүлэлтээ бууруулах шийдвэр гаргасан гэж жишээ эх сурвалж мэдээлжээ. Шинжээчид үүнийг дэлхийн зах зээлд үнийн дарамт үүсгэж болзошгүй гэж үзэж байна.</p>" +
      "<p>Нефтийн бүтээгдэхүүний үнэ ихэвчлэн хэдэн долоо хоногийн хоцролттойгоор жижиглэнгийн үнэд тусдаг.</p>" +
      "<h2>Яагаад чухал вэ</h2><p>Нийлүүлэлтийн бууралт нь тээвэр, үйлдвэрлэл, хөдөө аж ахуйн зардлыг өсгөж, инфляцад нөлөөлдөг. Олон улсын агентлагууд нөөцөө зах зээлд гаргах эсэхийг ойрын хугацаанд шийдэх төлөвтэй байна гэж жишээ эх сурвалж бичжээ.</p>" +
      "<h2>Монголд ямар хамаатай вэ</h2><p>Монгол шатахууны хэрэгцээгээ бараг бүхэлд нь импортоор хангадаг тул дэлхийн үнэ, тээврийн зардал дотоодын үнэд хурдан нөлөөлнө. Хянагч Эрчим хүчний яам, импортлогч компаниудын мэдэгдлийг шалгаж, нөөцийн хэмжээний тухай сүүлийн мэдээллийг нэмнэ.</p>" +
      "<p>Үнийн таамаглалыг баримт мэт бичихгүй, хэн юу хэлснийг тодорхой заана. Дотоодын үнийн өөрчлөлтийг албан ёсны мэдээллээр баталгаажуулна.</p>",
    desk: "world",
    tags: ["fuel", "energy"],
    cover: "stories/oil-settlement.jpg",
    notes: "Бууруулалтын хэмжээг (баррель/өдөр) анхны мэдэгдлээс шалгах. Дотоодын нөөцийн хоногийг нэмэх.",
  },
  {
    key: "policy-rate",
    title: "Жишээ: Төв банкууд бодлогын хүүгээ хэвээр үлдээв",
    dek: "Демо горимын жишээ мэдээ. Дэлхийн төв банкуудын шийдвэрийг агент нэгтгэн орчуулсан мэт.",
    body:
      "<h2>Юу болов</h2><p>Энэ бол демо горимын жишээ тойм, бодит шийдвэр биш. Хэд хэдэн томоохон төв банк инфляцын хурд саарч байгааг харгалзан бодлогын хүүгээ өөрчлөөгүй гэж жишээ эх сурвалж мэдээлэв. Зах зээл ойрын саруудад хүү буурах эсэхийг ажиглаж байна.</p>" +
      "<p>Хүүгийн шийдвэр нь валютын ханш, хөрөнгийн урсгалаар дамжуулан хөгжиж буй орнуудад нөлөөлдөг.</p>" +
      "<h2>Яагаад чухал вэ</h2><p>Хүү өндөр хэвээр байх нь доллар чангарч, хөгжиж буй орнуудаас хөрөнгө гарах эрсдэлийг нэмдэг. Харин хүү буурах дохио гарвал түүхий эдийн үнэ, экспортлогч орнуудын валют дэмжлэг авч болзошгүй гэж шинжээчид тайлбарлаж байна.</p>" +
      "<h2>Монголд ямар хамаатай вэ</h2><p>Гадаад хүүгийн түвшин Монголбанкны бодлого, төгрөгийн ханш, гадаад өрийн зардалд нөлөөлнө. Хянагч Монголбанкны сүүлийн шийдвэр, инфляцын албан ёсны тоог нэмж, харьцуулалт хийнэ.</p>" +
      "<p>Редакц дүгнэлтээ тусад нь бичиж, уншигчид юуг анхаарах ёстойг тайлбарлана. Тоо бүрийг анхны эх сурвалжаас нь дахин шалгана.</p>",
    desk: "world",
    tags: ["policy", "us", "europe"],
    cover: "stories/policy-rate-held.jpg",
    notes: "Төв банк бүрийн шийдвэрийн огноо, түвшинг шалгах. Монголбанкны бодлогын хүүтэй харьцуулах.",
  },
]

/** Agent-style briefings for the demo, skipping ones whose source is already on the board. */
export function demoBriefings(count: number, known: Set<string> = new Set()): Article[] {
  const now = new Date().toISOString()
  return samples
    .map((sample) => ({ sample, url: `https://example.com/demo/${sample.key}` }))
    .filter(({ url }) => !known.has(url))
    .slice(0, count)
    .map(({ sample, url }, index) => ({
      id: `bot-${Date.now()}-${index}`,
      slug: `${sample.key}-${Date.now().toString(36)}`,
      title: sample.title,
      dek: sample.dek,
      body: sample.body,
      desk: sample.desk,
      tags: sample.tags,
      coverUrl: publicUrl(sample.cover),
      coverAlt: sample.title.replace(/^Жишээ: /, ""),
      coverCredit: "Зураг: Жишээ агентлаг (демо)",
      coverRightsOk: false,
      sources: [{ label: "Жишээ эх сурвалж (демо)", href: url }],
      take: "",
      status: "in_review",
      origin: "bot",
      sourceUrl: url,
      botNotes: sample.notes,
      authorId: "",
      authorName: "",
      reviewNote: "",
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    }))
}

/** Small deterministic random numbers, so the demo charts look the same on every visit. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

export function demoInsights(members: Member[], articles: Article[], runs: NewsRun[]): Insights {
  const random = seeded(7)
  const day = 86_400_000
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const ageWeights: [string, number][] = [["13-17", 4], ["18-24", 22], ["25-34", 31], ["35-44", 19], ["45-54", 10], ["55+", 6], ["unknown", 8]]
  const total = 1240
  const ages = Object.fromEntries(ageWeights.map(([bucket, weight]) => [bucket, Math.round((total * weight) / 100)]))
  const regionWeights = regions.map((region, index) => [region.id, region.id === "ulaanbaatar" ? 46 : region.id === "abroad" ? 9 : Math.max(1, Math.round(4 - index / 7))] as const)
  const regionSum = regionWeights.reduce((sum, [, weight]) => sum + weight, 0) + 12
  const regionCounts = Object.fromEntries([
    ...regionWeights.map(([id, weight]) => [id, Math.round((total * weight) / regionSum)]),
    ["unknown", Math.round((total * 12) / regionSum)],
  ])

  const authors: AuthorStats[] = members.map((member) => {
    const own = articles.filter((article) => article.authorId === member.id)
    const published = own.filter((article) => article.status === "published")
    return {
      id: member.id,
      name: member.name,
      role: member.role,
      drafts: own.filter((article) => article.status === "draft").length,
      inProgress: own.filter((article) => ["in_review", "changes_requested", "approved"].includes(article.status)).length,
      changesRequested: own.filter((article) => article.status === "changes_requested").length,
      published: published.length,
      published30d: published.filter((article) => article.publishedAt && Date.parse(article.publishedAt) > Date.now() - 30 * day).length,
      claimed: own.filter((article) => article.origin === "bot").length,
      hoursToPublish: published.length
        ? Math.round(published.reduce((sum, article) => sum + (Date.parse(article.publishedAt!) - Date.parse(article.createdAt)) / 3_600_000, 0) / published.length)
        : null,
      reads: published.length * Math.round(80 + random() * 300),
      fires: published.length * Math.round(5 + random() * 30),
      reviews: member.role === "writer" ? 0 : Math.round(random() * 12),
      lastActive: own[0]?.updatedAt ?? null,
    }
  })

  return {
    readers: {
      total,
      new7: 64,
      new30: 238,
      active30: 517,
      ages,
      genders: { female: 538, male: 571, unspecified: 63, unknown: 68 },
      regions: regionCounts,
      weeks: Array.from({ length: 12 }, (_, index) => ({
        week: new Date(today.getTime() - (11 - index) * 7 * day).toISOString().slice(0, 10),
        n: Math.round(30 + index * 3 + random() * 25),
      })),
    },
    reading: Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today.getTime() - (29 - index) * day)
      const weekend = date.getDay() === 0 || date.getDay() === 6
      const reads = Math.round((weekend ? 120 : 210) + index * 3 + random() * 80)
      return { day: date.toISOString().slice(0, 10), reads, readers: Math.round(reads * (0.55 + random() * 0.1)) }
    }),
    authors,
    agent: {
      waiting: articles.filter((article) => article.origin === "bot" && !article.authorId && article.status !== "published").length,
      claimed: articles.filter((article) => article.origin === "bot" && article.authorId && article.status !== "published").length,
      published: articles.filter((article) => article.origin === "bot" && article.status === "published").length,
      runs,
    },
  }
}
