/**
 * lib/tray.js — Windows System Tray Icon Manager
 *
 * Spawns a lightweight hidden PowerShell WinForms NotifyIcon helper and
 * communicates via stdin/stdout lines (OPEN, QUIT, EXIT).
 */

"use strict";

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");

let trayProc = null;

function startTray({ onOpen, onQuit } = {}) {
  if (process.platform !== "win32" || process.env.NODE_ENV === "test") return;
  if (trayProc) return;

  const scriptPath = path.join(__dirname, "..", "scripts", "tray.ps1");
  if (!fs.existsSync(scriptPath)) {
    logger.warn(`[Tray] Script not found at ${scriptPath}`);
    return;
  }

  const iconPath = path.join(__dirname, "..", "assets", "app.ico");
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-WindowStyle",
    "Hidden",
    "-STA",
    "-File",
    scriptPath,
  ];
  if (fs.existsSync(iconPath)) {
    args.push("-IconPath", iconPath);
  }

  try {
    const proc = spawn("powershell.exe", args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    trayProc = proc;
    let buf = "";

    proc.stdout.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      const lines = buf.split(/\r\n|\r|\n/);
      buf = lines.pop();
      for (const raw of lines) {
        const cmd = raw.trim().toUpperCase();
        if (cmd === "OPEN" && typeof onOpen === "function") {
          onOpen();
        } else if (cmd === "QUIT" && typeof onQuit === "function") {
          onQuit();
        }
      }
    });

    proc.stderr.on("data", (chunk) => {
      const msg = chunk.toString("utf8").trim();
      if (msg) logger.warn(`[Tray] ${msg}`);
    });

    proc.on("exit", () => {
      if (trayProc === proc) trayProc = null;
    });

    proc.on("error", (err) => {
      logger.warn(`[Tray] Failed to start tray helper: ${err.message}`);
      if (trayProc === proc) trayProc = null;
    });

    logger.info("[Tray] System tray icon started.");
  } catch (err) {
    logger.warn(`[Tray] Could not spawn tray helper: ${err.message}`);
  }
}

function stopTray() {
  if (!trayProc) return;
  const proc = trayProc;
  trayProc = null;
  try {
    if (proc.stdin && !proc.stdin.destroyed) {
      proc.stdin.write("EXIT\n");
      proc.stdin.end();
    }
  } catch {}
  setTimeout(() => {
    try {
      if (!proc.killed) proc.kill();
    } catch {}
  }, 600).unref();
}

module.exports = { startTray, stopTray };
