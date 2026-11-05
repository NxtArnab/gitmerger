// BranchFlow desktop shell.
// Starts the Next.js standalone server in a background process (using
// Electron's bundled Node runtime), then opens it in a native window.
// Git runs as the current Windows user, so existing credentials (Git
// Credential Manager, SSH keys, global git config) are used as-is.

const { app, BrowserWindow, dialog, shell, Menu } = require("electron")
const { spawn, execFile } = require("node:child_process")
const net = require("node:net")
const http = require("node:http")
const path = require("node:path")
const fs = require("node:fs")

const DEV_URL = process.env.ELECTRON_DEV_URL // set by `npm run electron:dev`
let serverProcess = null
let mainWindow = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  app.whenReady().then(start)
}

function checkGit() {
  return new Promise((resolve) => {
    execFile("git", ["--version"], { windowsHide: true }, (err, stdout) =>
      resolve(err ? null : stdout.trim())
    )
  })
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on("error", reject)
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume()
        resolve()
      })
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("Server did not start"))
        else setTimeout(attempt, 250)
      })
    }
    attempt()
  })
}

async function startServer() {
  const serverDir = path.join(process.resourcesPath, "server")
  const serverJs = path.join(serverDir, "server.js")
  if (!fs.existsSync(serverJs)) throw new Error(`Missing ${serverJs}`)

  const dataDir = path.join(app.getPath("userData"), "data")
  fs.mkdirSync(dataDir, { recursive: true })

  const logPath = path.join(app.getPath("userData"), "server.log")
  const log = fs.createWriteStream(logPath, { flags: "a" })

  const port = await freePort()
  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      MERGER_DATA_DIR: dataDir,
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  })
  serverProcess.stdout.pipe(log)
  serverProcess.stderr.pipe(log)
  serverProcess.on("exit", (code) => {
    serverProcess = null
    if (code && !app.isQuitting) {
      dialog.showErrorBox(
        "BranchFlow stopped",
        `The background server exited (code ${code}). See log:\n${logPath}`
      )
      app.quit()
    }
  })

  const url = `http://127.0.0.1:${port}`
  await waitForServer(url)
  return url
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "BranchFlow",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  const origin = new URL(url).origin
  // Open external links in the user's browser, keep app links in-window.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith(origin)) shell.openExternal(target)
    return { action: target.startsWith(origin) ? "allow" : "deny" }
  })
  mainWindow.webContents.on("will-navigate", (e, target) => {
    if (!target.startsWith(origin)) {
      e.preventDefault()
      shell.openExternal(target)
    }
  })
  mainWindow.once("ready-to-show", () => mainWindow.show())
  mainWindow.on("closed", () => (mainWindow = null))
  mainWindow.loadURL(url)
}

async function start() {
  Menu.setApplicationMenu(null)
  const gitVersion = await checkGit()
  if (!gitVersion) {
    const { response } = await dialog.showMessageBox({
      type: "error",
      title: "Git not found",
      message: "BranchFlow needs Git 2.38 or newer installed.",
      detail:
        "Install Git for Windows, then start BranchFlow again. It uses your existing Git credentials and SSH keys.",
      buttons: ["Download Git", "Quit"],
    })
    if (response === 0) await shell.openExternal("https://git-scm.com/download/win")
    app.quit()
    return
  }
  try {
    const url = DEV_URL || (await startServer())
    createWindow(url)
    if (app.isPackaged) setupAutoUpdates()
  } catch (err) {
    dialog.showErrorBox("BranchFlow failed to start", String(err?.stack || err))
    app.quit()
  }
}

// Checks the release feed configured in package.json "build.publish" on
// startup and every 4 hours. Updates download in the background; the user is
// asked to restart, or the update installs next time the app closes.
function setupAutoUpdates() {
  let autoUpdater
  try {
    ;({ autoUpdater } = require("electron-updater"))
  } catch {
    return
  }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: (e) => console.error("[updater]", e),
  }
  autoUpdater.on("error", () => {}) // offline or no feed: stay quiet
  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox(mainWindow ?? undefined, {
      type: "info",
      title: "Update ready",
      message: `BranchFlow ${info.version} has been downloaded.`,
      detail:
        "Restart now to install it, or it will be installed the next time you close BranchFlow. Finish or publish any open run first.",
      buttons: ["Restart now", "Later"],
      defaultId: 1,
      cancelId: 1,
    })
    if (response === 0) {
      app.isQuitting = true
      stopServer()
      autoUpdater.quitAndInstall()
    }
  })
  const check = () => autoUpdater.checkForUpdates().catch(() => {})
  check()
  setInterval(check, 4 * 60 * 60 * 1000)
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}

app.on("before-quit", () => {
  app.isQuitting = true
  stopServer()
})
app.on("window-all-closed", () => app.quit())
