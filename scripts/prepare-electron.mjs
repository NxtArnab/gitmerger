// Turns the Next.js standalone build into a clean server bundle at
// .next/electron-server, ready to be copied into the Windows app.
import { cpSync, existsSync, rmSync, mkdirSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const standalone = path.join(root, ".next", "standalone")
const out = path.join(root, ".next", "electron-server")
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("No standalone build found. Run `next build` first.")
  process.exit(1)
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// Output tracing pulls in the whole project (the store uses process.cwd()),
// including source and .git. Ship only what server.js needs.
for (const entry of ["server.js", "package.json", "node_modules", ".next"]) {
  cpSync(path.join(standalone, entry), path.join(out, entry), {
    recursive: true,
    dereference: true,
  })
}
cpSync(path.join(root, ".next", "static"), path.join(out, ".next", "static"), {
  recursive: true,
})
if (existsSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public"), path.join(out, "public"), { recursive: true })
}
console.log("Server bundle prepared at .next/electron-server")
