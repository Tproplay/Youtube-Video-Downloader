/**
 * server.js — YouTube Video Downloader
 *
 * Secure, zero-dependency Node.js HTTP server.
 * Binds strictly to 127.0.0.1 (never 0.0.0.0) for local security.
 * Implements single-instance verification, clean PID tracking, and graceful shutdown.
 */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec, spawn, spawnSync } = require("child_process");
const logger = require("./lib/logger");
const store = require("./lib/store");
const ytdlp = require("./lib/ytdlp");
const { handleRequest } = require("./lib/routes");

const HOST = "127.0.0.1";
const BASE_PORT = parseInt(process.env.PORT, 10) || 3000;
const DATA_DIR = path.join(__dirname, "data");
const PID_FILE = path.join(DATA_DIR, "server.pid");
const PORT_FILE = path.join(DATA_DIR, "server.port");

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch {}

let activeServer = null;
let browserOpened = false;

function cleanPidFiles() {
  try {
    if (fs.existsSync(PID_FILE)) {
      const savedPid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
      if (savedPid === process.pid) fs.unlinkSync(PID_FILE);
    }
  } catch {}
  try {
    if (fs.existsSync(PORT_FILE)) fs.unlinkSync(PORT_FILE);
  } catch {}
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function pingHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: HOST,
        port,
        path: "/api/health",
        timeout: 1200,
      },
      (res) => {
        if (res.statusCode === 200) {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            try {
              const data = JSON.parse(body);
              resolve(Boolean(data && (data.status === "ok" || data.ytdlp !== undefined)));
            } catch {
              resolve(false);
            }
          });
        } else {
          resolve(false);
        }
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function verifyIsOurServer(pid) {
  if (process.platform === "win32") {
    try {
      const psRes = spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -like "*node*") { try { (Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" -ErrorAction Stop).CommandLine } catch { (Get-WmiObject Win32_Process -Filter "ProcessId = ${pid}" -ErrorAction SilentlyContinue).CommandLine } }`,
        ],
        { encoding: "utf8", timeout: 3500 }
      );
      const out = psRes.stdout ? psRes.stdout.trim().toLowerCase() : "";
      if (out.includes("server.js")) return true;

      // Fallback: check process name + window title
      const nameRes = spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p) { $p.ProcessName + "|" + $p.MainWindowTitle }`,
        ],
        { encoding: "utf8", timeout: 3000 }
      );
      const nameOut = nameRes.stdout ? nameRes.stdout.trim().toLowerCase() : "";
      return nameOut.includes("node") && (nameOut.includes("youtube") || nameOut.includes("server.js"));
    } catch {
      return false;
    }
  } else {
    try {
      const res = spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
      const cmd = res.stdout ? res.stdout.trim().toLowerCase() : "";
      return cmd.includes("server.js");
    } catch {
      return false;
    }
  }
}

function killProcessTree(pid) {
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, timeout: 3000 });
    } else {
      process.kill(pid, "SIGKILL");
    }
  } catch {}
}

function openBrowserOnce(url) {
  if (browserOpened || process.env.NODE_ENV === "test") return;
  browserOpened = true;

  if (process.platform === "win32") {
    // Check for Edge or Chrome to run in standalone desktop app window mode (--app=)
    const candidates = [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Microsoft\\Edge\\Application\\msedge.exe"),
      path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft\\Edge\\Application\\msedge.exe"),
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    ];

    let browserExe = null;
    for (const cand of candidates) {
      if (cand && fs.existsSync(cand)) {
        browserExe = cand;
        break;
      }
    }

    if (browserExe) {
      try {
        const child = spawn(browserExe, [`--app=${url}`], {
          detached: true,
          stdio: "ignore",
          windowsHide: false,
        });
        child.unref();
        return;
      } catch (err) {
        logger.warn(`Failed to spawn app window with ${browserExe}: ${err.message}. Falling back to default browser.`);
      }
    }

    // Fallback: standard system default browser
    try {
      const child = spawn("cmd.exe", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();
    } catch {
      exec(`start "" "${url}"`, { windowsHide: true });
    }
  } else if (process.platform === "darwin") {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

async function handleExistingInstance() {
  if (!fs.existsSync(PID_FILE)) return;

  try {
    const rawPid = fs.readFileSync(PID_FILE, "utf8").trim();
    const savedPid = parseInt(rawPid, 10);
    const savedPort = fs.existsSync(PORT_FILE) ? parseInt(fs.readFileSync(PORT_FILE, "utf8").trim(), 10) : BASE_PORT;

    if (savedPid && !isNaN(savedPid) && isPidAlive(savedPid)) {
      // 1. Check if healthy
      const isHealthy = await pingHealth(savedPort);
      if (isHealthy) {
        logger.info(`====================================================`);
        logger.info(`  YouTube Video Downloader is ALREADY running!`);
        logger.info(`  URL: http://${HOST}:${savedPort}`);
        logger.info(`  Active PID: ${savedPid}`);
        logger.info(`  Opening app window to existing instance…`);
        logger.info(`====================================================`);
        openBrowserOnce(`http://${HOST}:${savedPort}`);
        setTimeout(() => process.exit(0), 400);
        return;
      }

      // 2. Not responding: only kill if verifiably our server.js
      const isOurServer = verifyIsOurServer(savedPid);
      if (isOurServer) {
        logger.warn(`Stale/unresponsive server detected (PID: ${savedPid}). Terminating old instance…`);
        killProcessTree(savedPid);
        await new Promise((r) => setTimeout(r, 600));
      } else {
        logger.warn(`Process PID ${savedPid} is running on system but could not be verified as our server. Leaving it intact.`);
      }
    }
  } catch (err) {
    logger.warn(`PID verification check error: ${err.message}`);
  }

  // Clear stale files
  cleanPidFiles();
}

function startServer(port, maxAttempts = 10) {
  const srv = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      logger.error("Unhandled route error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal Server Error" }));
      }
    });
  });

  const onError = (err) => {
    srv.removeListener("error", onError);
    srv.removeListener("listening", onListening);
    try {
      srv.close();
    } catch {}

    if (err.code === "EADDRINUSE" && maxAttempts > 0) {
      logger.warn(`Port ${port} is in use by another application. Trying port ${port + 1}…`);
      startServer(port + 1, maxAttempts - 1);
    } else {
      logger.error(`Server fatal error on port ${port}:`, err);
      cleanPidFiles();
      process.exit(1);
    }
  };

  const onListening = () => {
    srv.removeListener("error", onError);
    activeServer = srv;
    const address = srv.address();
    const activePort = address ? address.port : port;
    const url = `http://${HOST}:${activePort}`;
    const settings = store.getSettings();

    // Atomically write PID and port files
    try {
      fs.writeFileSync(PID_FILE, String(process.pid), "utf8");
      fs.writeFileSync(PORT_FILE, String(activePort), "utf8");
    } catch {}

    const portNote = activePort !== BASE_PORT ? ` (Port ${BASE_PORT} was occupied by another app)` : "";

    logger.info(`====================================================`);
    logger.info(`  YouTube Video Downloader Server Running`);
    logger.info(`  URL: ${url}${portNote}`);
    logger.info(`  PID: ${process.pid}`);
    logger.info(`  Downloads Directory: ${settings.downloadDir}`);
    logger.info(`====================================================`);

    // Detect dependencies in background
    const health = ytdlp.checkSystemHealth();
    if (health.ytdlp) {
      logger.info(`[yt-dlp] Ready (${health.ytdlpVersion}) at ${health.ytdlpPath}`);
    } else {
      logger.warn(`[yt-dlp] WARNING: yt-dlp was not found on your system!`);
    }

    if (health.ffmpeg) {
      logger.info(`[ffmpeg] Ready (${health.ffmpegVersion})`);
    } else {
      logger.warn(`[ffmpeg] WARNING: ffmpeg was not found (required for 1080p+ merging and MP3 conversion)`);
    }

    // Launch browser exactly once
    openBrowserOnce(url);
  };

  srv.once("error", onError);
  srv.once("listening", onListening);
  srv.listen(port, HOST);
}

// Graceful shutdown helper
function gracefulShutdown(signal = "QUIT") {
  logger.info(`Server shutting down (${signal})…`);
  const queue = require("./lib/queue");
  try {
    queue.killAll(); // Kill all running yt-dlp child processes
  } catch {}

  cleanPidFiles();

  if (activeServer) {
    activeServer.close(() => {
      logger.info("Server terminated cleanly.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // Force exit after timeout if sockets linger
  setTimeout(() => process.exit(0), 1200).unref();
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("exit", () => cleanPidFiles());

// Startup execution
(async () => {
  await handleExistingInstance();
  startServer(BASE_PORT);
})();

module.exports = { gracefulShutdown };
