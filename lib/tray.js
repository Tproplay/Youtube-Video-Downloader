/**
 * lib/tray.js — Windows System Tray Icon Manager
 *
 * Spawns bin/tray.exe (compiled .NET WinForms NotifyIcon helper) with
 * fallback to scripts/tray.ps1, communicating via stdin/stdout (OPEN, QUIT, EXIT).
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

  const iconPath = path.join(__dirname, "..", "assets", "app.ico");
  const hasIcon = fs.existsSync(iconPath);
  const exePath = path.join(__dirname, "..", "bin", "tray.exe");
  const scriptPath = path.join(__dirname, "..", "scripts", "tray.ps1");

  let cmd = null;
  let args = [];

  if (fs.existsSync(exePath)) {
    cmd = exePath;
    if (hasIcon) args.push(iconPath);
  } else if (fs.existsSync(scriptPath)) {
    cmd = "powershell.exe";
    args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-STA",
      "-File",
      scriptPath,
    ];
    if (hasIcon) args.push("-IconPath", iconPath);
  } else {
    logger.warn("[Tray] Neither bin/tray.exe nor scripts/tray.ps1 found.");
    return;
  }

  try {
    const proc = spawn(cmd, args, {
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
        const cmdLine = raw.trim().toUpperCase();
        if (cmdLine === "OPEN" && typeof onOpen === "function") {
          onOpen();
        } else if (cmdLine === "QUIT" && typeof onQuit === "function") {
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

    logger.info(`[Tray] System tray icon started (${path.basename(cmd)}).`);
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
