/**
 * lib/routes.js — HTTP API & Static Routing with Security & SSE
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { exec, spawn } = require("child_process");

const security = require("./security");
const logger = require("./logger");
const store = require("./store");
const ytdlp = require("./ytdlp");
const queue = require("./queue");

const PUBLIC_DIR = path.join(__dirname, "..", "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff2": "font/woff2",
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 512 * 1024) { // 512 KB limit
        reject(new Error("Request payload too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("Malformed JSON body."));
      }
    });
    req.on("error", (err) => reject(err));
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
}

function serveStatic(res, pathname) {
  let target = pathname === "/" ? "index.html" : pathname;
  target = path.normalize(target).replace(/^(\.\.[\/\\])+/, "");
  const full = path.join(PUBLIC_DIR, target);

  fs.stat(full, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(full).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(full).pipe(res);
  });
}

async function handleRequest(req, res) {
  const reqUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const pathname = reqUrl.pathname;
  const method = req.method.toUpperCase();

  // 1. Host & Origin Validation (DNS Rebinding and External CSRF defense)
  if (!security.validateHostAndOrigin(req)) {
    logger.warn(`Blocked request from forbidden host/origin: Host=${req.headers["host"]}, Origin=${req.headers["origin"]}`);
    sendJson(res, 403, { error: "Forbidden: Request origin is not allowed." });
    return;
  }

  // 2. CORS (Restricted exclusively to localhost / 127.0.0.1)
  res.setHeader("Access-Control-Allow-Origin", req.headers["origin"] || `http://${req.headers.host || "127.0.0.1:3000"}`);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Session-Token");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 3. CSRF Verification for State-Changing Requests
  if (["POST", "DELETE", "PUT"].includes(method)) {
    if (!security.verifySessionToken(req)) {
      sendJson(res, 403, { error: "Invalid or missing session token." });
      return;
    }
  }

  // ── Session Token Endpoint ──────────────────────────────────────────────────
  if (pathname === "/api/session-token" && method === "GET") {
    sendJson(res, 200, { token: security.getSessionToken() });
    return;
  }

  // ── Health & Diagnostics ───────────────────────────────────────────────────
  if (pathname === "/api/health" && method === "GET") {
    const health = ytdlp.checkSystemHealth();
    const settings = store.getSettings();
    const disk = ytdlp.getDirectorySize(settings.downloadDir);
    sendJson(res, 200, {
      status: "ok",
      serverPort: req.socket.localPort,
      pid: process.pid,
      ...health,
      downloadDir: settings.downloadDir,
      diskUsage: disk,
    });
    return;
  }

  // ── Video Metadata (Info) ───────────────────────────────────────────────────
  if (pathname === "/api/info" && method === "GET") {
    const url = reqUrl.searchParams.get("url");
    const validUrl = security.validateYouTubeUrl(url);
    if (!validUrl) {
      sendJson(res, 400, { error: "Invalid YouTube URL." });
      return;
    }

    try {
      const info = await ytdlp.fetchVideoInfo(validUrl);
      sendJson(res, 200, info);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // ── Playlist Preview ────────────────────────────────────────────────────────
  if (pathname === "/api/playlist" && method === "GET") {
    const url = reqUrl.searchParams.get("url");
    const validUrl = security.validateYouTubeUrl(url);
    if (!validUrl) {
      sendJson(res, 400, { error: "Invalid YouTube URL." });
      return;
    }

    try {
      const playlist = await ytdlp.fetchPlaylistInfo(validUrl);
      sendJson(res, 200, playlist);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // ── SSE Live Progress Stream ───────────────────────────────────────────────
  if (pathname === "/api/events" && method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Send initial snapshot
    res.write(`data: ${JSON.stringify({ type: "init", payload: queue.getSnapshot() })}\n\n`);

    const unsubscribe = queue.subscribe((event) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch {}
    });

    req.on("close", () => unsubscribe());
    return;
  }

  // ── Queue Management ───────────────────────────────────────────────────────
  if (pathname === "/api/queue" && method === "GET") {
    sendJson(res, 200, { queue: queue.getSnapshot() });
    return;
  }

  if (pathname === "/api/queue/add" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const urls = Array.isArray(body.urls) ? body.urls : (body.url ? [body.url] : []);
      const validItems = [];

      for (const rawUrl of urls) {
        const safeUrl = security.validateYouTubeUrl(rawUrl);
        if (safeUrl) {
          validItems.push({
            url: safeUrl,
            title: body.title || "",
            thumbnail: body.thumbnail || "",
            options: security.sanitizeDownloadOptions(body.options),
          });
        }
      }

      if (validItems.length === 0) {
        sendJson(res, 400, { error: "No valid YouTube URLs provided." });
        return;
      }

      const added = queue.addBatch(validItems);
      sendJson(res, 200, { success: true, count: added.length, items: added });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  const cancelMatch = pathname.match(/^\/api\/queue\/([a-zA-Z0-9]+)\/cancel$/);
  if (cancelMatch && method === "POST") {
    const id = cancelMatch[1];
    const ok = queue.cancel(id);
    sendJson(res, ok ? 200 : 404, { success: ok });
    return;
  }

  const pauseMatch = pathname.match(/^\/api\/queue\/([a-zA-Z0-9]+)\/pause$/);
  if (pauseMatch && method === "POST") {
    const id = pauseMatch[1];
    const ok = queue.pause(id);
    sendJson(res, ok ? 200 : 404, { success: ok });
    return;
  }

  const resumeMatch = pathname.match(/^\/api\/queue\/([a-zA-Z0-9]+)\/resume$/);
  if (resumeMatch && method === "POST") {
    const id = resumeMatch[1];
    const ok = queue.resume(id);
    sendJson(res, ok ? 200 : 404, { success: ok });
    return;
  }

  const topMatch = pathname.match(/^\/api\/queue\/([a-zA-Z0-9]+)\/top$/);
  if (topMatch && method === "POST") {
    const id = topMatch[1];
    const ok = queue.moveToTop(id);
    sendJson(res, ok ? 200 : 404, { success: ok });
    return;
  }

  if (pathname === "/api/queue/pause-all" && method === "POST") {
    queue.pauseAll();
    sendJson(res, 200, { success: true });
    return;
  }

  if (pathname === "/api/queue/resume-all" && method === "POST") {
    queue.resumeAll();
    sendJson(res, 200, { success: true });
    return;
  }

  if (pathname === "/api/queue/reorder" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const ok = queue.reorder(body.orderIds);
      sendJson(res, ok ? 200 : 400, { success: ok });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  const retryMatch = pathname.match(/^\/api\/queue\/([a-zA-Z0-9]+)\/retry$/);
  if (retryMatch && method === "POST") {
    const id = retryMatch[1];
    const ok = queue.retry(id);
    sendJson(res, ok ? 200 : 404, { success: ok });
    return;
  }

  const deleteMatch = pathname.match(/^\/api\/queue\/([a-zA-Z0-9]+)$/);
  if (deleteMatch && method === "DELETE") {
    const id = deleteMatch[1];
    const ok = queue.remove(id);
    sendJson(res, ok ? 200 : 404, { success: ok });
    return;
  }

  if (pathname === "/api/queue/clear-finished" && method === "POST") {
    queue.clearFinished();
    sendJson(res, 200, { success: true });
    return;
  }

  // ── History Management ─────────────────────────────────────────────────────
  if (pathname === "/api/history" && method === "GET") {
    sendJson(res, 200, { history: store.getHistory() });
    return;
  }

  if (pathname === "/api/history/clear" && method === "POST") {
    store.clearHistory();
    sendJson(res, 200, { success: true });
    return;
  }

  if (pathname === "/api/history/bulk-delete" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const updated = store.removeHistoryItems(body.ids || [], Boolean(body.deleteFiles));
      sendJson(res, 200, { success: true, history: updated });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === "/api/history/export" && method === "GET") {
    const fmt = reqUrl.searchParams.get("format") || "json";
    const history = store.getHistory();

    if (fmt === "csv") {
      const escapeCsv = (str) => {
        if (!str) return '""';
        return `"${String(str).replace(/"/g, '""')}"`;
      };
      const header = ["Title", "URL", "Format", "Size", "Date", "File"].join(",");
      const rows = history.map((item) => [
        escapeCsv(item.title),
        escapeCsv(item.url),
        escapeCsv(item.format),
        escapeCsv(item.size),
        escapeCsv(new Date(item.timestamp).toISOString()),
        escapeCsv(item.file),
      ].join(","));
      const csvContent = [header, ...rows].join("\r\n");

      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="youtube_download_history.csv"',
      });
      res.end(csvContent);
      return;
    }

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="youtube_download_history.json"',
    });
    res.end(JSON.stringify(history, null, 2));
    return;
  }

  const historyDelMatch = pathname.match(/^\/api\/history\/([a-zA-Z0-9]+)$/);
  if (historyDelMatch && method === "DELETE") {
    const id = historyDelMatch[1];
    const deleteFile = reqUrl.searchParams.get("deleteFile") === "true";
    const updated = store.removeHistoryItem(id, deleteFile);
    sendJson(res, 200, { success: true, history: updated });
    return;
  }

  // ── Settings Management ────────────────────────────────────────────────────
  if (pathname === "/api/settings" && method === "GET") {
    sendJson(res, 200, store.getSettings());
    return;
  }

  if (pathname === "/api/settings" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const updated = store.updateSettings(body);
      sendJson(res, 200, { success: true, settings: updated });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === "/api/settings/reset" && method === "POST") {
    const def = store.resetSettings();
    sendJson(res, 200, { success: true, settings: def });
    return;
  }

  // ── System Actions ─────────────────────────────────────────────────────────
  if (pathname === "/api/shutdown" && method === "POST") {
    sendJson(res, 200, { success: true, message: "Server shutting down cleanly." });
    setTimeout(() => {
      try {
        const { gracefulShutdown } = require("../server");
        gracefulShutdown("UI_QUIT");
      } catch {
        process.exit(0);
      }
    }, 300);
    return;
  }
  if (pathname === "/api/update-ytdlp" && method === "POST") {
    try {
      const result = await ytdlp.updateYtdlp();
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (pathname === "/api/open-folder" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const settings = store.getSettings();
      const target = body.file && fs.existsSync(body.file)
        ? `"${body.file}"`
        : `"${settings.downloadDir}"`;

      if (process.platform === "win32") {
        if (body.file && fs.existsSync(body.file) && fs.statSync(body.file).isFile()) {
          exec(`explorer.exe /select,${target}`, { windowsHide: true });
        } else {
          exec(`explorer.exe ${target}`, { windowsHide: true });
        }
      }
      sendJson(res, 200, { success: true });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (pathname === "/api/copy-file" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!body.file || !fs.existsSync(body.file)) {
        sendJson(res, 404, { error: "File not found on disk" });
        return;
      }
      if (process.platform === "win32") {
        const escaped = body.file.replace(/'/g, "''");
        spawn("powershell", [
          "-NoProfile",
          "-Command",
          `Set-Clipboard -Path '${escaped}'`
        ], { windowsHide: true, stdio: "ignore" });
      }
      sendJson(res, 200, { success: true, message: "File copied to clipboard. Press Ctrl+V in CapCut or any app!" });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (pathname === "/api/disk-usage" && method === "GET") {
    const settings = store.getSettings();
    const disk = ytdlp.getDirectorySize(settings.downloadDir);
    sendJson(res, 200, disk);
    return;
  }

  const logMatch = pathname.match(/^\/api\/logs\/([a-zA-Z0-9]+)$/);
  if (logMatch && method === "GET") {
    const id = logMatch[1];
    const lines = logger.getTaskLog(id);
    sendJson(res, 200, { id, logs: lines });
    return;
  }

  if (pathname === "/api/open-file" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const filePath = body.file;
      if (!filePath || typeof filePath !== "string") {
        sendJson(res, 400, { error: "File path required" });
        return;
      }
      const norm = path.normalize(filePath);
      if (fs.existsSync(norm) && fs.statSync(norm).isFile()) {
        if (process.platform === "win32") {
          exec(`explorer.exe "${norm}"`, { windowsHide: true });
        } else if (process.platform === "darwin") {
          exec(`open "${norm}"`);
        } else {
          exec(`xdg-open "${norm}"`);
        }
        sendJson(res, 200, { success: true });
      } else {
        sendJson(res, 404, { error: "File not found" });
      }
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (pathname === "/api/stream-file" && method === "GET") {
    const rawPath = reqUrl.searchParams.get("file");
    if (!rawPath) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing file parameter");
      return;
    }
    const norm = path.normalize(rawPath);
    if (!fs.existsSync(norm) || !fs.statSync(norm).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found");
      return;
    }

    const ext = path.extname(norm).toLowerCase();
    const mediaMimes = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mkv": "video/mp4",
      ".mp3": "audio/mpeg",
      ".m4a": "audio/mp4",
      ".wav": "audio/wav",
      ".flac": "audio/flac",
      ".opus": "audio/ogg",
    };
    const cType = mediaMimes[ext] || "application/octet-stream";
    const stat = fs.statSync(norm);
    const size = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(norm, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": cType,
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": size,
        "Content-Type": cType,
        "Accept-Ranges": "bytes",
      });
      fs.createReadStream(norm).pipe(res);
    }
    return;
  }

  if (pathname === "/api/preview-command" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const safeUrl = security.validateYouTubeUrl(body.url) || "https://www.youtube.com/watch?v=EXAMPLE";
      const opts = security.sanitizeDownloadOptions(body.options);
      const settings = store.getSettings();
      const runner = ytdlp.buildDownloadArgs(safeUrl, opts, settings);
      sendJson(res, 200, {
        command: runner.cmd,
        args: runner.args,
        fullCommand: `"${runner.cmd}" ${runner.args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // Default: Static File Serving
  serveStatic(res, pathname);
}

module.exports = { handleRequest };
