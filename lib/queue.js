/**
 * lib/queue.js — Multi-Worker Download Queue Manager
 *
 * Manages concurrent downloads (1-4 configurable), process execution,
 * cancellation with process-tree termination, pause/resume, and progress streaming.
 */

"use strict";

const crypto = require("crypto");
const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");
const store = require("./store");
const { buildDownloadArgs } = require("./ytdlp");

class DownloadQueue {
  constructor() {
    this.items = store.getSavedQueue();
    this.activeProcesses = new Map(); // id -> child_process
    this.listeners = new Set(); // SSE callback subscribers
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  broadcast(type, payload) {
    store.saveQueue(this.items);
    const eventData = { type, payload, timestamp: Date.now() };
    for (const send of this.listeners) {
      try {
        send(eventData);
      } catch {
        this.listeners.delete(send);
      }
    }
  }

  broadcastProgress(item) {
    const eventData = { type: "item_progress", payload: item, timestamp: Date.now() };
    for (const send of this.listeners) {
      try {
        send(eventData);
      } catch {
        this.listeners.delete(send);
      }
    }
  }

  getSnapshot() {
    return this.items;
  }

  getItem(id) {
    return this.items.find((x) => x.id === id);
  }

  /**
   * Add a single or multiple items to the queue
   */
  add(item) {
    const queueItem = {
      id: crypto.randomBytes(8).toString("hex"),
      url: item.url,
      title: item.title || "YouTube Video",
      thumbnail: item.thumbnail || "",
      options: item.options,
      status: "queued",
      statusText: "Waiting in queue…",
      percent: 0,
      speed: "",
      eta: "",
      size: "",
      destFile: null,
      error: null,
      createdTime: Date.now(),
      startTime: null,
      finishTime: null,
    };

    this.items.push(queueItem);
    this.broadcast("item_added", queueItem);
    this.processNext();
    return queueItem;
  }

  addBatch(batchItems) {
    const added = [];
    for (const b of batchItems) {
      const q = {
        id: crypto.randomBytes(8).toString("hex"),
        url: b.url,
        title: b.title || "YouTube Video",
        thumbnail: b.thumbnail || "",
        options: b.options,
        status: "queued",
        statusText: "Waiting in queue…",
        percent: 0,
        speed: "",
        eta: "",
        size: "",
        destFile: null,
        error: null,
        createdTime: Date.now(),
        startTime: null,
        finishTime: null,
      };
      this.items.push(q);
      added.push(q);
    }
    this.broadcast("batch_added", added);
    this.processNext();
    return added;
  }

  /**
   * Check queue and launch pending jobs up to settings.concurrency
   */
  processNext() {
    const settings = store.getSettings();
    const maxConcurrent = settings.concurrency || 2;
    const runningCount = Array.from(this.activeProcesses.keys()).length;

    if (runningCount >= maxConcurrent) return;

    const nextItem = this.items.find((x) => x.status === "queued");
    if (!nextItem) return;

    this.startDownload(nextItem);
  }

  startDownload(item) {
    const settings = store.getSettings();
    let runner;

    try {
      runner = buildDownloadArgs(item.url, item.options, settings);
    } catch (err) {
      item.status = "failed";
      item.error = err.message;
      item.statusText = "Setup failed: " + err.message;
      this.broadcast("item_updated", item);
      this.processNext();
      return;
    }

    item.status = "downloading";
    item.statusText = "Starting download…";
    item.startTime = Date.now();
    this.broadcast("item_updated", item);

    logger.info(`[Queue] Starting download for ${item.id} (${item.title}): ${runner.cmd} ${runner.args.join(" ")}`);

    const env = {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    };

    const proc = spawn(runner.cmd, runner.args, {
      shell: false,
      windowsHide: true,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.activeProcesses.set(item.id, proc);

    const DEST_RE = /(?:Destination:\s+|Merging formats into\s+)"?([^"\r\n]+)"?/;
    let lastError = "";
    let detectedFile = null;

    const parseProgressLine = (raw) => {
      if (!raw || typeof raw !== "string") return null;
      // Strip ANSI escape codes
      const line = raw.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").trim();

      // 1. Custom template: "downloading 45.2% 3.40MiB/s 00:12 24.50MiB"
      const custom = line.match(/^downloading\s+([0-9.]+)%\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i);
      if (custom) {
        const pct = parseFloat(custom[1]);
        if (!isNaN(pct) && pct >= 0 && pct <= 100) {
          return {
            pct,
            spd: custom[2] === "N/A" ? "" : custom[2],
            eta: custom[3] === "N/A" ? "" : custom[3],
            sz: custom[4] === "N/A" ? "" : custom[4] || "",
          };
        }
      }

      // 2. Standard yt-dlp: "[download]  45.2% of ~ 24.50MiB at  3.40MiB/s ETA 00:12"
      // or "[download] 100.0% of  15.62MiB in 00:04 at 3.90MiB/s"
      if (line.startsWith("[download]")) {
        const pctM = line.match(/\[download\]\s+([0-9.]+)%/);
        if (pctM) {
          const pct = parseFloat(pctM[1]);
          if (!isNaN(pct) && pct >= 0 && pct <= 100) {
            const spdM = line.match(/at\s+([0-9.]+[kKmMgGtT]i?B\/s)/i);
            const etaM = line.match(/ETA\s+(\S+)/i);
            const szM = line.match(/(?:of\s+~?\s*)([0-9.]+[kKmMgGtT]i?B)/i);
            return {
              pct,
              spd: spdM ? spdM[1] : "",
              eta: etaM && etaM[1] !== "N/A" ? etaM[1] : "",
              sz: szM ? szM[1] : "",
            };
          }
        }
      }

      // 3. Fallback: generic percentage with strict bounds check [0, 100]
      const genericPct = line.match(/\b([0-9]{1,3}(?:\.[0-9]+)?)%/);
      if (genericPct) {
        const pct = parseFloat(genericPct[1]);
        if (!isNaN(pct) && pct >= 0 && pct <= 100) {
          const spdM = line.match(/([0-9.]+[kKmMgGtT]i?B\/s)/i);
          const etaM = line.match(/ETA\s+(\S+)/i);
          const szM = line.match(/([0-9.]+[kKmMgGtT]i?B)/i);
          return {
            pct,
            spd: spdM ? spdM[1] : "",
            eta: etaM && etaM[1] !== "N/A" ? etaM[1] : "",
            sz: szM ? szM[1] : "",
          };
        }
      }

      return null;
    };

    const handleLine = (raw) => {
      const line = raw.trim();
      if (!line) return;

      logger.appendTaskLog(item.id, line);

      if (line.includes("ERROR:")) {
        lastError = line.split("ERROR:")[1].trim();
      } else if (line.toLowerCase().includes("error:") && !lastError) {
        lastError = line;
      }

      // Check metadata printed by yt-dlp
      if (line.startsWith("[meta]")) {
        const metaStr = line.substring(6).trim();
        const tabIdx = metaStr.indexOf("\t");
        let newTitle = "";
        let newThumb = "";
        if (tabIdx !== -1) {
          newTitle = metaStr.substring(0, tabIdx).trim();
          newThumb = metaStr.substring(tabIdx + 1).trim();
        } else {
          newTitle = metaStr;
        }
        let updated = false;
        if (newTitle && newTitle !== "NA" && newTitle !== item.title) {
          item.title = newTitle;
          updated = true;
        }
        if (newThumb && newThumb !== "NA" && newThumb !== item.thumbnail) {
          item.thumbnail = newThumb;
          updated = true;
        }
        if (updated) {
          this.broadcast("item_updated", item);
        }
        return;
      }

      // Check explicit destination printed by yt-dlp
      if (line.startsWith("[dest]")) {
        const p = line.substring(6).trim();
        if (p && p !== "NA") {
          detectedFile = path.isAbsolute(p) ? p : path.join(settings.downloadDir, p);
        }
        return;
      }

      // Check destination file
      const dMatch = line.match(DEST_RE);
      if (dMatch) {
        const p = dMatch[1].trim();
        detectedFile = path.isAbsolute(p) ? p : path.join(settings.downloadDir, p);
      }

      // Parse progress template
      const prog = parseProgressLine(line);
      if (prog) {
        item.percent = Math.min(100, Math.max(0, prog.pct));
        if (prog.spd) item.speed = prog.spd;
        if (prog.eta) item.eta = prog.eta;
        if (prog.sz) item.size = prog.sz;
        item.status = "downloading";
        item.statusText = `Downloading… ${item.percent.toFixed(1)}%`;
        this.broadcastProgress(item);
      } else if (
        line.includes("[Merger]") ||
        line.includes("Merging formats") ||
        line.includes("[ExtractAudio]") ||
        line.includes("[Fixup") ||
        line.includes("[VideoRemuxer]") ||
        line.includes("[EmbedSubtitle]") ||
        line.includes("[Metadata]")
      ) {
        item.status = "processing";
        item.statusText = "Processing & merging formats…";
        this.broadcast("item_updated", item);
      }
    };

    let stdoutBuffer = "";
    proc.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split(/\r\n|\r|\n/);
      stdoutBuffer = lines.pop();
      for (const l of lines) handleLine(l);
    });

    let stderrBuffer = "";
    proc.stderr.on("data", (chunk) => {
      stderrBuffer += chunk.toString("utf8");
      const lines = stderrBuffer.split(/\r\n|\r|\n/);
      stderrBuffer = lines.pop();
      for (const l of lines) handleLine(l);
    });

    proc.on("close", (code) => {
      this.activeProcesses.delete(item.id);
      if (stdoutBuffer) handleLine(stdoutBuffer);
      if (stderrBuffer) handleLine(stderrBuffer);

      item.finishTime = Date.now();

      if (code === 0) {
        // Find latest file in directory if regex didn't catch it
        if (!detectedFile) {
          try {
            const files = fs.readdirSync(settings.downloadDir).map((f) => ({
              name: f,
              path: path.join(settings.downloadDir, f),
              time: fs.statSync(path.join(settings.downloadDir, f)).mtimeMs,
            })).sort((a, b) => b.time - a.time);

            if (files.length > 0 && files[0].time >= item.startTime - 4000) {
              detectedFile = files[0].path;
            }
          } catch {}
        }

        const finalFile = detectedFile || settings.downloadDir;
        item.status = "done";
        item.percent = 100;
        item.speed = "";
        item.eta = "";
        item.statusText = "Completed!";
        item.destFile = finalFile;
        item.error = null;

        // Add to history
        let fileSize = item.size;
        try {
          if (fs.existsSync(finalFile) && fs.statSync(finalFile).isFile()) {
            fileSize = formatBytes(fs.statSync(finalFile).size);
          }
        } catch {}

        store.addHistoryItem({
          id: item.id,
          title: item.title,
          url: item.url,
          format: item.options ? `${item.options.type || "video"} (${item.options.quality || "best"})` : "best",
          file: finalFile,
          size: fileSize || "Unknown",
          thumbnail: item.thumbnail,
          timestamp: Date.now(),
        });

        // Auto open folder if enabled
        if (settings.autoOpenFolder) {
          openInExplorer(finalFile);
        }
      } else if (item.status !== "cancelled") {
        item.status = "failed";
        item.error = lastError || `yt-dlp exited with error code ${code}`;
        item.statusText = "Failed: " + item.error;
      }

      this.broadcast("item_updated", item);
      // Pick up next task in queue
      this.processNext();
    });

    proc.on("error", (err) => {
      this.activeProcesses.delete(item.id);
      item.status = "failed";
      item.error = err.message;
      item.statusText = "Process launch error: " + err.message;
      this.broadcast("item_updated", item);
      this.processNext();
    });
  }

  cancel(id) {
    const item = this.getItem(id);
    if (!item) return false;

    const proc = this.activeProcesses.get(id);
    if (proc) {
      const pid = proc.pid;
      logger.info(`[Queue] Killing process tree for download ${id} (PID ${pid})`);
      try {
        if (process.platform === "win32") {
          exec(`taskkill /pid ${pid} /T /F`, { windowsHide: true });
        } else {
          proc.kill("SIGKILL");
        }
      } catch {}
      this.activeProcesses.delete(id);
    }

    item.status = "cancelled";
    item.statusText = "Download cancelled";
    item.speed = "";
    item.eta = "";

    // Clean partial downloads
    const settings = store.getSettings();
    try {
      const files = fs.readdirSync(settings.downloadDir);
      for (const f of files) {
        if (f.endsWith(".part") || f.endsWith(".ytdl")) {
          try { fs.unlinkSync(path.join(settings.downloadDir, f)); } catch {}
        }
      }
    } catch {}

    this.broadcast("item_updated", item);
    this.processNext();
    return true;
  }

  retry(id) {
    const item = this.getItem(id);
    if (!item) return false;
    this.cancel(id);

    item.status = "queued";
    item.statusText = "Queued for retry…";
    item.percent = 0;
    item.speed = "";
    item.eta = "";
    item.error = null;
    item.destFile = null;

    this.broadcast("item_updated", item);
    this.processNext();
    return true;
  }

  remove(id) {
    this.cancel(id);
    this.items = this.items.filter((x) => x.id !== id);
    logger.clearTaskLog(id);
    this.broadcast("item_removed", { id });
    this.processNext();
    return true;
  }

  pause(id) {
    const item = this.getItem(id);
    if (!item) return false;
    if (item.status === "downloading" || item.status === "processing") {
      const proc = this.activeProcesses.get(id);
      if (proc) {
        const pid = proc.pid;
        try {
          if (process.platform === "win32") {
            exec(`taskkill /pid ${pid} /T /F`, { windowsHide: true });
          } else {
            proc.kill("SIGKILL");
          }
        } catch {}
        this.activeProcesses.delete(id);
      }
    }
    item.status = "paused";
    item.statusText = "Paused";
    item.speed = "";
    item.eta = "";
    this.broadcast("item_updated", item);
    this.processNext();
    return true;
  }

  resume(id) {
    const item = this.getItem(id);
    if (!item || item.status !== "paused") return false;
    item.status = "queued";
    item.statusText = "Waiting in queue…";
    this.broadcast("item_updated", item);
    this.processNext();
    return true;
  }

  killAll() {
    logger.info(`[Queue] Terminating all active download processes (${this.activeProcesses.size})…`);
    for (const [id, proc] of this.activeProcesses.entries()) {
      try {
        if (proc && proc.pid) {
          if (process.platform === "win32") {
            exec(`taskkill /pid ${proc.pid} /T /F`, { windowsHide: true });
          } else {
            proc.kill("SIGKILL");
          }
        }
      } catch {}
    }
    this.activeProcesses.clear();
  }

  pauseAll() {
    for (const item of this.items) {
      if (item.status === "downloading" || item.status === "processing") {
        const proc = this.activeProcesses.get(item.id);
        if (proc) {
          const pid = proc.pid;
          try {
            if (process.platform === "win32") {
              exec(`taskkill /pid ${pid} /T /F`, { windowsHide: true });
            } else {
              proc.kill("SIGKILL");
            }
          } catch {}
          this.activeProcesses.delete(item.id);
        }
        item.status = "paused";
        item.statusText = "Paused";
        item.speed = "";
        item.eta = "";
      } else if (item.status === "queued") {
        item.status = "paused";
        item.statusText = "Paused";
      }
    }
    this.broadcast("queue_cleared", this.items);
    return true;
  }

  resumeAll() {
    for (const item of this.items) {
      if (item.status === "paused") {
        item.status = "queued";
        item.statusText = "Waiting in queue…";
      }
    }
    this.broadcast("queue_cleared", this.items);
    this.processNext();
    return true;
  }

  moveToTop(id) {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    const [item] = this.items.splice(idx, 1);
    let insertIdx = 0;
    while (
      insertIdx < this.items.length &&
      (this.items[insertIdx].status === "downloading" || this.items[insertIdx].status === "processing")
    ) {
      insertIdx++;
    }
    this.items.splice(insertIdx, 0, item);
    this.broadcast("queue_cleared", this.items);
    this.processNext();
    return true;
  }

  reorder(orderIds) {
    if (!Array.isArray(orderIds)) return false;
    const idMap = new Map(this.items.map((it) => [it.id, it]));
    const newItems = [];
    for (const id of orderIds) {
      if (idMap.has(id)) {
        newItems.push(idMap.get(id));
        idMap.delete(id);
      }
    }
    for (const item of idMap.values()) {
      newItems.push(item);
    }
    this.items = newItems;
    this.broadcast("queue_cleared", this.items);
    this.processNext();
    return true;
  }

  clearFinished() {
    this.items = this.items.filter((x) => x.status === "downloading" || x.status === "queued" || x.status === "processing" || x.status === "paused");
    this.broadcast("queue_cleared", this.items);
  }
}

function openInExplorer(targetPath) {
  if (process.platform !== "win32") return;
  try {
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      exec(`explorer.exe /select,"${targetPath}"`, { windowsHide: true });
    } else {
      exec(`explorer.exe "${targetPath}"`, { windowsHide: true });
    }
  } catch {}
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

const queue = new DownloadQueue();
module.exports = queue;
