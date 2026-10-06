import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { Download, Search } from "lucide-react"

import { canManageTeam } from "@/admin/rules"
import { useTeam } from "@/admin/session"
import type { ReaderRecord } from "@/admin/types"
import { buttonClass, inputClass, Notice } from "@/admin/ui"
import { formatPhone } from "@/reader/phone"
import { ReaderAvatar } from "@/reader/ReaderAvatar"
import { genderLabel } from "@/reader/types"

function csvCell(value: string) {
  return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Downloads the list as CSV. The BOM makes Excel read Cyrillic correctly. */
function downloadCsv(readers: ReaderRecord[]) {
  const rows = [
    ["Нэр", "И-мэйл", "Утас", "Төрсөн огноо", "Хүйс", "Бүртгүүлсэн"],
    ...readers.map((reader) => [
      reader.name,
      reader.email,
      reader.phone,
      reader.birthDate,
      reader.gender ? genderLabel[reader.gender] : "",
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

/** Admin only: every registered reader's name and e-mail, with a CSV export. */
export function ReadersPage() {
  const { backend, member } = useTeam()
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

  if (!canManageTeam(member)) return <Navigate to="/admin" replace />

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
                  {reader.gender || reader.birthDate ? (
                    <span className="text-muted-foreground ml-2 text-[12px] font-normal">
                      {[reader.gender ? genderLabel[reader.gender] : "", reader.birthDate].filter(Boolean).join(" · ")}
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
