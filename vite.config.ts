import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const root = fileURLToPath(new URL(".", import.meta.url))

function pullSubstack() {
  const result = spawnSync("python", ["scripts/pull_substack.py"], {
    cwd: root,
    encoding: "utf8",
    timeout: 20000,
    windowsHide: true,
  })
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || "unknown").trim()
    console.warn(`[substack] RSS pull skipped (${detail}). Using the last generated file.`)
  }
}

function substackRss() {
  return {
    name: "substack-rss",
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
