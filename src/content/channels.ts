export const channels = {
  domain: "ediinzasag.mn",
  youtube: "https://www.youtube.com/@ediinzasag",
  substack: "https://niots.substack.com/",
  substackSubscribe: "https://niots.substack.com/subscribe",
  facebook: "https://www.facebook.com/ezediinzasag",
  instagram: "https://www.instagram.com/ez.ediinzasag",
  telegram: "https://t.me/+bgMX4V_b5XEyNjM9",
  x: "https://x.com/ezediinzasag",
  linktree: "https://linktr.ee/ediinzasag",
} as const

export type Episode = {
  n: number | null
  title: string
  date: string
  seconds: number
  href: string
  note?: string
}

export const episodes: Episode[] = [
  {
    n: null,
    title: "Монгол Улс ХК-ийн хувьцаа яагаад унаад байна вэ?",
    date: "2026.09.30",
    seconds: 1510,
    href: "https://www.youtube.com/watch?v=IFVfgD0bHkw",
  },
  {
    n: null,
    title: "Бензиний үнэ буухгүй шалтгаан нь...",
    date: "2026.09.25",
    seconds: 1766,
    href: "https://www.youtube.com/watch?v=714ilmepDKI",
  },
  {
    n: null,
    title: "Иен. Их гүрний мөнгө яаж хамгийн сул валют болов?",
    date: "2026.09.12",
    seconds: 1667,
    href: "https://www.youtube.com/watch?v=MbrWzwtxIZI",
  },
  {
    n: null,
    title: "Онцлох сэдэв нэвтрүүлэг. TenGer TV",
    date: "2026.04.20",
    seconds: 1773,
    href: "https://www.youtube.com/watch?v=H9FWFIRnX5E",
  },
  {
    n: 12,
    title: "Зах зээлийн эргэн тойронд. Bitcoin хаана хүрэх вэ?",
    date: "2026.04.15",
    seconds: 3628,
    href: "https://www.youtube.com/watch?v=z73QMDf_lYA",
  },
  {
    n: 11,
    title: "АНУ-ын дараагийн бай хэн бэ?",
    date: "2026.04.11",
    seconds: 2941,
    href: "https://www.youtube.com/watch?v=XGhoQSVUsY8",
  },
  {
    n: 10,
    title: "Мөнгөний систем өөрчлөгдөж байна. Алт",
    date: "2026.03.24",
    seconds: 4569,
    href: "https://www.youtube.com/watch?v=BBHDrd0644I",
  },
  {
    n: 9,
    title: "Английн банкийг эвдсэн хүн. Black Wednesday",
    date: "2025.10.27",
    seconds: 2896,
    href: "https://www.youtube.com/watch?v=VsG76kOMf2Q",
  },
  {
    n: 8,
    title: "Монголын 2026 оны төсөв юу болох гээд байна?",
    date: "2025.10.27",
    seconds: 2542,
    href: "https://www.youtube.com/watch?v=cwI7r4x3r-U",
    note: "Төсвийн зардал, нөхцөл байдал. Nio, Ulemj.",
  },
  {
    n: 7,
    title: "AI bubble мөн үү?",
    date: "2025.10.18",
    seconds: 3100,
    href: "https://www.youtube.com/watch?v=m6Dc2AGEsuI",
  },
  {
    n: null,
    title: "VIX индексийг ойлгож, хэзээ арилжих вэ?",
    date: "2025.06.15",
    seconds: 792,
    href: "https://www.youtube.com/watch?v=s6EVsNbbiIE",
  },
  {
    n: 6,
    title: "FOMO, алдагдал, айдас. Арилжааны сэтгэлзүй",
    date: "2025.06.15",
    seconds: 4334,
    href: "https://www.youtube.com/watch?v=H1N--YgQ5yo",
  },
  {
    n: 5,
    title: "Төсөв, төв банк, валютын нөөц",
    date: "2025.05.22",
    seconds: 4260,
    href: "https://www.youtube.com/watch?v=RIgGeDp7Ep0",
  },
  {
    n: 4,
    title: "Дэлхийн худалдааны дайн юу болоод байна?",
    date: "2025.05.13",
    seconds: 3349,
    href: "https://www.youtube.com/watch?v=0p5E1rax2Go",
    note: "Худалдааны дайн, доллар, бодлогын хүү.",
  },
  {
    n: 3,
    title: "Бондын талаар, хөрөнгийн зах зээлийн тойм",
    date: "2025.05.08",
    seconds: 4144,
    href: "https://www.youtube.com/watch?v=DJjuqwg3qUI",
  },
  {
    n: 2,
    title: "Макро эдийн засгийн талаар",
    date: "2025.05.08",
    seconds: 5023,
    href: "https://www.youtube.com/watch?v=eXUkHj0CRiQ",
    note: "Суурь шинжилгээ, макро, худалдааны дайн.",
  },
  {
    n: 1,
    title: "Nio, Ulemj",
    date: "2025.04.23",
    seconds: 6083,
    href: "https://www.youtube.com/watch?v=Xfo1PMg1VrU",
  },
  {
    n: null,
    title: "Easy Market. Тоон үзүүлэлт, Traders Forum 2024",
    date: "2024.04.02",
    seconds: 1039,
    href: "https://www.youtube.com/watch?v=D3KUK-X6Rtc",
  },
  {
    n: null,
    title: "EZ Podcast. Арилжаачин болох боломж бий юу?",
    date: "2024.04.02",
    seconds: 4473,
    href: "https://www.youtube.com/watch?v=PGfmV8THYoc",
  },
  {
    n: null,
    title: "EZ Market. 3 сарын 28",
    date: "2024.03.27",
    seconds: 1392,
    href: "https://www.youtube.com/watch?v=c8iqXU0_qcg",
  },
  {
    n: null,
    title: "Мөнгөний бодлого. Зочин Э. Мишээл",
    date: "2023.06.25",
    seconds: 5089,
    href: "https://www.youtube.com/watch?v=Suur3H2WQtY",
  },
]
