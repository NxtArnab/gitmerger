// Copies static assets into the Next.js standalone build so server.js can
// serve them, ready to be bundled into the Windows app.
import { cpSync, existsSync, rmSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const standalone = path.join(root, ".next", "standalone")
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("No standalone build found. Run `next build` first.")
  process.exit(1)
}

// Never ship local dev data inside the installer.
rmSync(path.join(standalone, ".merger-data"), { recursive: true, force: true })

cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
})
if (existsSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true })
}
console.log("Standalone build prepared for Electron.")
