import { spawnSync } from "node:child_process"
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

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [substackRss(), react(), tailwindcss()],
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
