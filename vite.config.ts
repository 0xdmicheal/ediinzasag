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

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [substackRss(), linkPreviewDev(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
})
