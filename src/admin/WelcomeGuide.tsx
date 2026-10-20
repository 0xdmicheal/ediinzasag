import { Link } from "react-router-dom"
import { X } from "lucide-react"

import { isEditor } from "@/admin/rules"
import type { Member } from "@/admin/types"
import { buttonClass } from "@/admin/ui"

const key = (member: Member) => `ez-admin-guide-${member.id}`

function seen(member: Member) {
  try {
    return localStorage.getItem(key(member)) === "1"
  } catch {
    return false
  }
}

/** How a piece moves through the newsroom, in the writer's words. */
const steps = [
  {
    title: "Бичих",
    body: (
      <>
        <Link to="/new" className="text-foreground underline underline-offset-4">Шинэ нийтлэл</Link>-ээр эхэлнэ, эсвэл{" "}
        <Link to="/inbox" className="text-foreground underline underline-offset-4">Мэдээний урсгал</Link>-аас агентын бэлдсэн мэдээг
        сонгоно. Бичсэн бүхэн өөрөө хадгалагдана.
      </>
    ),
  },
  {
    title: "Илгээх",
    body: <>Баруун дээд талын «Илгээх»-ийг дарж бэлэн байдлын жагсаалтаа шалгаад, редакторт хянуулахаар илгээнэ.</>,
  },
  {
    title: "Засах",
    body: <>Редактор засвар хүсвэл нийтлэл «Хийх ажил»-д буцаж ирнэ. Тэмдэглэл нь нийтлэлийн дээд талд харагдана.</>,
  },
  {
    title: "Нийтлэгдэх",
    body: <>Редактор баталж нийтэлнэ эсвэл цаг товлоно. Нийтлэгдсэн нийтлэлд засвар хэрэгтэй бол редактортоо хэлнэ.</>,
  },
]

/** EZ Writing System v2.1, the rules a new writer trips on first. */
const rules = [
  "Эх сурвалжаа текст дотор, нэр дээр нь холбоосоор өгнө. Тусдаа жагсаалт хийхгүй.",
  "Тоо бүр суурь, хугацаатай байна: «өнгөрсөн оны мөн үеэс 12 хувиар».",
  "Орчуулга шиг биш, монгол сэтгүүлчийн хэлээр бичнэ.",
  "«Яагаад чухал вэ», «Дүгнэлт» гэх мэт шошго гарчиг тавихгүй. Дэд гарчиг өөрөө санаагаа хэлнэ.",
  "Текстэд «хувь», ишлэлийг «» хашилтаар бичнэ. Анхаарлын тэмдэг хэрэглэхгүй.",
]

/**
 * The board's welcome for new members: the four steps and the house rules, until they close
 * it. "Заавар" on the board brings it back.
 */
export function WelcomeGuide({ member, open, onClose }: { member: Member; open: boolean; onClose: () => void }) {
  if (!open) return null
  const close = () => {
    try {
      localStorage.setItem(key(member), "1")
    } catch {
      // Private mode: it just shows again next time.
    }
    onClose()
  }
  return (
    <section aria-labelledby="guide-title" className="bg-card relative rounded-xl border">
      <button
        type="button"
        onClick={close}
        aria-label="Хаах"
        className="text-muted-foreground hover:text-foreground absolute top-3 right-3 grid size-8 place-items-center rounded-md"
      >
        <X className="size-4" />
      </button>
      <div className="grid gap-8 p-6 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <div>
          <p className="text-muted-foreground font-mono text-[11px] uppercase">Редакцад тавтай морил</p>
          <h2 id="guide-title" className="font-news mt-1 text-2xl">Нийтлэл дөрвөн алхмаар гарна</h2>
          <ol className="mt-5 divide-y">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                <span className="text-muted-foreground w-5 shrink-0 pt-0.5 font-mono text-[12px] tabular-nums">{index + 1}</span>
                <div>
                  <p className="text-[14px] font-semibold">{step.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-[13px] leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="lg:border-l lg:pl-12">
          <p className="text-muted-foreground font-mono text-[11px] uppercase">Бичих зарчим</p>
          <ul className="mt-3 space-y-2.5">
            {rules.map((rule) => (
              <li key={rule} className="text-muted-foreground border-foreground/15 border-l-2 pl-3 text-[13px] leading-relaxed">
                {rule}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-4 text-[12px] leading-relaxed">
            {isEditor(member)
              ? "Засвар хүсэхдээ юуг, яагаад засахыг тэмдэглэлд тодорхой бичнэ."
              : "Эргэлзвэл редактортоо асууна. Илгээхийн өмнө «Урьдчилан харах»-аар сайт дээр хэрхэн харагдахыг шалгана."}
          </p>
          <button type="button" onClick={close} className={`${buttonClass.ghost} mt-5`}>
            Ойлголоо
          </button>
        </div>
      </div>
    </section>
  )
}

/** Shown until the member closes it once. */
WelcomeGuide.initiallyOpen = (member: Member) => !seen(member)
