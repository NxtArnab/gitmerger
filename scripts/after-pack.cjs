// electron-builder afterPack hook: copies the prepared Next.js server bundle
// into resources/server. Done here (not via extraResources) because
// extraResources silently drops node_modules folders.
const { cpSync, existsSync } = require("node:fs")
const path = require("node:path")

exports.default = async function afterPack(context) {
  const src = path.join(context.packager.projectDir, ".next", "electron-server")
  if (!existsSync(path.join(src, "server.js")))
    throw new Error("Run `node scripts/prepare-electron.mjs` before packaging.")
  cpSync(src, path.join(context.appOutDir, "resources", "server"), {
    recursive: true,
  })
}
