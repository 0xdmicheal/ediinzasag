import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { Download, Search } from "lucide-react"

import { canManageTeam } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import type { ReaderRecord, Subscriber } from "@/admin/types"
import { buttonClass, inputClass, Notice } from "@/admin/ui"
import { formatPhone } from "@/reader/phone"
import { ReaderAvatar } from "@/reader/ReaderAvatar"
import { regionLabel } from "@/reader/regions"
import { genderLabel } from "@/reader/types"

function csvCell(value: string) {
  return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Downloads the list as CSV. The BOM makes Excel read Cyrillic correctly. */
function downloadCsv(readers: ReaderRecord[]) {
  const rows = [
    ["Нэр", "И-мэйл", "Утас", "Төрсөн огноо", "Хүйс", "Байршил", "Бүртгүүлсэн"],
    ...readers.map((reader) => [
      reader.name,
      reader.email,
      reader.phone,
      reader.birthDate,
      reader.gender ? genderLabel[reader.gender] : "",
      reader.region ? regionLabel(reader.region) : "",
      reader.joinedAt.slice(0, 10),
    ]),
  ]
  const text = "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `ez-readers-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/** Substack's importer reads one address per row; the header row is "email". */
function downloadSubscribersCsv(subscribers: Subscriber[]) {
  const text = ["email", ...subscribers.map((row) => csvCell(row.email))].join("\r\n")
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `ez-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

type Tab = "readers" | "subscribers"

/** Admin only: registered readers, and the newsletter form's e-mails for Substack. */
export function ReadersPage() {
  const { member } = useTeam()
  const [tab, setTab] = useState<Tab>("readers")
  if (!canManageTeam(member)) return <Navigate to="/" replace />
  const tabs = (
    <div role="tablist" aria-label="Жагсаалт" className="bg-muted inline-flex w-fit gap-1 rounded-lg p-1">
      {(
        [
          ["readers", "Бүртгэлтэй уншигчид"],
          ["subscribers", "Захиалагчид"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => setTab(id)}
          className={`h-8 rounded-md px-3 text-[13px] font-medium transition-colors ${tab === id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
  return tab === "readers" ? <ReadersList tabs={tabs} /> : <SubscribersList tabs={tabs} />
}

/** E-mails from the Нийтлэл page, exported as a CSV that Substack imports. */
function SubscribersList({ tabs }: { tabs: ReactNode }) {
  const { backend } = useTeam()
  const [rows, setRows] = useState<Subscriber[] | null>(null)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    backend
      .listSubscribers()
      .then(setRows)
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Ачаалж чадсангүй"))
  }, [backend])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return !rows || !needle ? (rows ?? []) : rows.filter((row) => row.email.includes(needle))
  }, [rows, query])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground font-mono text-[11px] uppercase">Админ</p>
          <h1 className="font-news mt-1 text-3xl">Уншигчид</h1>
          <p className="text-muted-foreground mt-1 text-[13px]">{rows ? `Нийт ${rows.length} захиалагч` : "Ачаалж байна…"}</p>
        </div>
        <button type="button" disabled={!shown.length} onClick={() => downloadSubscribersCsv(shown)} className={buttonClass.primary}>
          <Download className="size-4" />
          Substack-д зориулсан CSV{query.trim() ? ` (${shown.length})` : ""}
        </button>
      </header>
      {tabs}

      <Notice>
        Нийтлэл хуудсаар захиалсан хаягууд. CSV-г Substack → Settings → Import subscribers хэсэгт оруулна. Давхардсан хаягийг Substack өөрөө алгасна.
      </Notice>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <label className="relative block">
        <span className="sr-only">Хайх</span>
        <Search className="text-muted-foreground pointer-events-none absolute z-10 top-1/2 left-3 size-4 -translate-y-1/2" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="И-мэйлээр хайх" className={`${inputClass} pl-9`} />
      </label>

      {rows && shown.length === 0 ? (
        <p className="text-muted-foreground text-[14px]">{rows.length ? "Илэрц алга." : "Одоогоор захиалагч алга."}</p>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {shown.map((row) => (
            <li key={row.email} className="flex items-center gap-3 px-4 py-3">
              <a href={`mailto:${row.email}`} className="min-w-0 flex-1 truncate text-[14px] hover:underline">
                {row.email}
              </a>
              <time dateTime={row.createdAt} className="text-muted-foreground shrink-0 font-mono text-[11px]">
                {row.createdAt.slice(0, 10)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Every registered reader's name and e-mail, with a CSV export. */
function ReadersList({ tabs }: { tabs: ReactNode }) {
  const { backend } = useTeam()
  const [readers, setReaders] = useState<ReaderRecord[] | null>(null)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    backend
      .listReaders()
      .then(setReaders)
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Ачаалж чадсангүй"))
  }, [backend])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!readers || !needle) return readers ?? []
    const digits = needle.replace(/\D/g, "")
    return readers.filter(
      (reader) =>
        reader.name.toLowerCase().includes(needle) ||
        reader.email.toLowerCase().includes(needle) ||
        (digits.length >= 3 && reader.phone.includes(digits)),
    )
  }, [readers, query])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground font-mono text-[11px] uppercase">Админ</p>
          <h1 className="font-news mt-1 text-3xl">Уншигчид</h1>
          <p className="text-muted-foreground mt-1 text-[13px]">
            {readers ? `Нийт ${readers.length} бүртгэлтэй уншигч` : "Ачаалж байна…"}
          </p>
        </div>
        <button type="button" disabled={!shown.length} onClick={() => downloadCsv(shown)} className={buttonClass.primary}>
          <Download className="size-4" />
          CSV татах{query.trim() ? ` (${shown.length})` : ""}
        </button>
      </header>
      {tabs}

      <Notice>
        И-мэйлийг зөвхөн сайтын үйлчилгээнд ашиглана. Маркетингийн захидал илгээхийн өмнө уншигчаас зөвшөөрөл аваарай.
      </Notice>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <label className="relative block">
        <span className="sr-only">Хайх</span>
        <Search className="text-muted-foreground pointer-events-none absolute z-10 top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Нэр, и-мэйл эсвэл утсаар хайх"
          className={`${inputClass} pl-9`}
        />
      </label>

      {readers && shown.length === 0 ? (
        <p className="text-muted-foreground text-[14px]">{readers.length ? "Илэрц алга." : "Одоогоор бүртгэлтэй уншигч алга."}</p>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {shown.map((reader) => (
            <li key={reader.id} className="flex items-center gap-3 px-4 py-3">
              <ReaderAvatar name={reader.name || reader.email || reader.phone} avatar={reader.avatar} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">
                  {reader.name || "—"}
                  {reader.gender || reader.birthDate || reader.region ? (
                    <span className="text-muted-foreground ml-2 text-[12px] font-normal">
                      {[reader.gender ? genderLabel[reader.gender] : "", reader.birthDate, reader.region ? regionLabel(reader.region) : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground truncate text-[12px]">
                  {reader.email ? (
                    <a href={`mailto:${reader.email}`} className="hover:text-foreground">
                      {reader.email}
                    </a>
                  ) : null}
                  {reader.email && reader.phone ? " · " : null}
                  {reader.phone ? (
                    <a href={`tel:${reader.phone}`} className="hover:text-foreground">
                      {formatPhone(reader.phone)}
                    </a>
                  ) : null}
                </p>
              </div>
              <time dateTime={reader.joinedAt} className="text-muted-foreground shrink-0 font-mono text-[11px]">
                {reader.joinedAt.slice(0, 10)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
