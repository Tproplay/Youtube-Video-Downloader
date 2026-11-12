/**
 * lib/logger.js — Local Logger with File & In-Memory Per-Task Buffer
 */

"use strict";

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const LOG_FILE = path.join(DATA_DIR, "app.log");
const MAX_LOG_SIZE = 3 * 1024 * 1024; // 3 MB

// Ensure data directory exists
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch {}

// Rolling memory buffer for per-task logs (up to 20 tasks, 300 lines each)
const taskLogs = new Map();

function writeToFile(line) {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stat = fs.statSync(LOG_FILE);
      if (stat.size > MAX_LOG_SIZE) {
        const backup = path.join(DATA_DIR, "app.log.old");
        try { if (fs.existsSync(backup)) fs.unlinkSync(backup); } catch {}
        fs.renameSync(LOG_FILE, backup);
      }
    }
    fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
  } catch {}
}

function formatMsg(level, msg) {
  const ts = new Date().toISOString();
  return `[${ts}] [${level.toUpperCase()}] ${msg}`;
}

const logger = {
  info(msg, ...args) {
    const formatted = formatMsg("info", `${msg} ${args.length ? JSON.stringify(args) : ""}`.trim());
    console.log(formatted);
    writeToFile(formatted);
  },

  warn(msg, ...args) {
    const formatted = formatMsg("warn", `${msg} ${args.length ? JSON.stringify(args) : ""}`.trim());
    console.warn(formatted);
    writeToFile(formatted);
  },

  error(msg, ...args) {
    const formatted = formatMsg("error", `${msg} ${args.length ? JSON.stringify(args) : ""}`.trim());
    console.error(formatted);
    writeToFile(formatted);
  },

  debug(msg, ...args) {
    const formatted = formatMsg("debug", `${msg} ${args.length ? JSON.stringify(args) : ""}`.trim());
    writeToFile(formatted);
  },

  appendTaskLog(taskId, line) {
    if (!taskLogs.has(taskId)) {
      taskLogs.set(taskId, []);
    }
    const buf = taskLogs.get(taskId);
    buf.push(line);
    if (buf.length > 500) buf.shift(); // Keep last 500 lines

    // Maintain max 30 recent tasks
    if (taskLogs.size > 30) {
      const oldestKey = taskLogs.keys().next().value;
      taskLogs.delete(oldestKey);
    }
  },

  getTaskLog(taskId) {
    return taskLogs.get(taskId) || [];
  },

  clearTaskLog(taskId) {
    taskLogs.delete(taskId);
  },
};

module.exports = logger;
