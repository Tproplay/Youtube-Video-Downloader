/**
 * lib/store.js — Persistent Storage for Settings, Queue, and History
 *
 * Uses safe atomic file writes (write to temp file then rename) to prevent corruption.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const { validateDownloadPath, validateFilenameTemplate, ALLOWED_SPEED_LIMITS, ALLOWED_BROWSERS } = require("./security");

const DATA_DIR = path.join(__dirname, "..", "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const QUEUE_FILE = path.join(DATA_DIR, "queue.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

const DEFAULT_DOWNLOAD_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME || path.join(__dirname, ".."),
  "Downloads",
  "YouTube"
);

// Ensure directories
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(DEFAULT_DOWNLOAD_DIR, { recursive: true });
} catch {}

const DEFAULT_SETTINGS = {
  downloadDir: DEFAULT_DOWNLOAD_DIR,
  filenameTemplate: "%(title)s.%(ext)s",
  concurrency: 2,
  speedLimit: "",
  maxRetries: 3,
  browserCookies: "none",
  autoOpenFolder: false,
  playChime: true,
  runInBackground: true,
  theme: "system",
  defaultFormat: {
    type: "video_audio",
    quality: "best",
    container: "mp4",
    audioFormat: "mp3",
    audioQuality: "best",
    embedThumbnail: true,
    embedMetadata: true,
    embedChapters: true,
    saveThumbnailImage: false,
    sponsorBlock: false,
    sponsorBlockCategories: ["sponsor", "intro", "outro"],
  },
};

function safeWriteJson(filePath, data) {
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    logger.error(`Failed to write JSON to ${filePath}:`, err);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
  }
}

function safeReadJson(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    }
  } catch (err) {
    logger.warn(`Could not read ${filePath}, using defaults:`, err.message);
  }
  return defaultValue;
}

// ── Settings Store ────────────────────────────────────────────────────────────

let cachedSettings = null;

function getSettings() {
  if (cachedSettings) return cachedSettings;
  const raw = safeReadJson(SETTINGS_FILE, {});
  cachedSettings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    defaultFormat: {
      ...DEFAULT_SETTINGS.defaultFormat,
      ...(raw.defaultFormat || {}),
    },
  };

  // Validate loaded downloadDir
  const validDir = validateDownloadPath(cachedSettings.downloadDir);
  if (!validDir) {
    cachedSettings.downloadDir = DEFAULT_DOWNLOAD_DIR;
  }
  return cachedSettings;
}

function updateSettings(patch) {
  const current = getSettings();
  const updated = { ...current };

  if (patch.downloadDir) {
    const validDir = validateDownloadPath(patch.downloadDir);
    if (validDir) updated.downloadDir = validDir;
  }

  if (patch.filenameTemplate) {
    updated.filenameTemplate = validateFilenameTemplate(patch.filenameTemplate);
  }

  if (typeof patch.concurrency === "number") {
    updated.concurrency = Math.min(4, Math.max(1, Math.round(patch.concurrency)));
  }

  if (patch.speedLimit !== undefined && ALLOWED_SPEED_LIMITS.has(patch.speedLimit)) {
    updated.speedLimit = patch.speedLimit;
  }

  if (typeof patch.maxRetries === "number") {
    updated.maxRetries = Math.min(10, Math.max(0, Math.round(patch.maxRetries)));
  }

  if (patch.browserCookies !== undefined && ALLOWED_BROWSERS.has(patch.browserCookies)) {
    updated.browserCookies = patch.browserCookies;
  }

  if (typeof patch.autoOpenFolder === "boolean") {
    updated.autoOpenFolder = patch.autoOpenFolder;
  }

  if (typeof patch.playChime === "boolean") {
    updated.playChime = patch.playChime;
  }

  if (typeof patch.runInBackground === "boolean") {
    updated.runInBackground = patch.runInBackground;
  }

  if (["system", "dark", "light"].includes(patch.theme)) {
    updated.theme = patch.theme;
  }

  if (patch.defaultFormat && typeof patch.defaultFormat === "object") {
    updated.defaultFormat = {
      ...updated.defaultFormat,
      ...patch.defaultFormat,
    };
  }

  cachedSettings = updated;
  safeWriteJson(SETTINGS_FILE, updated);
  logger.info("Settings updated successfully.");
  return updated;
}

function resetSettings() {
  cachedSettings = {
    ...DEFAULT_SETTINGS,
    defaultFormat: { ...DEFAULT_SETTINGS.defaultFormat },
  };
  safeWriteJson(SETTINGS_FILE, cachedSettings);
  logger.info("Settings reset to defaults.");
  return cachedSettings;
}

// ── Queue Store ───────────────────────────────────────────────────────────────

function getSavedQueue() {
  const items = safeReadJson(QUEUE_FILE, []);
  if (!Array.isArray(items)) return [];
  // Clean up states on load (if app previously exited while downloading)
  return items.map((item) => {
    if (item.status === "downloading" || item.status === "processing") {
      return {
        ...item,
        status: "interrupted",
        statusText: "Download interrupted (server restarted).",
        speed: "",
        eta: "",
      };
    }
    return item;
  });
}

function saveQueue(items) {
  safeWriteJson(QUEUE_FILE, items);
}

// ── History Store ─────────────────────────────────────────────────────────────

function getHistory() {
  const items = safeReadJson(HISTORY_FILE, []);
  if (!Array.isArray(items)) return [];

  // Filter out any items whose files have been moved or deleted from the download folder
  const existing = items.filter((item) => {
    if (!item.file || typeof item.file !== "string") return false;
    try {
      return fs.existsSync(item.file);
    } catch {
      return false;
    }
  });

  // Automatically persist cleaned history if any missing files were pruned
  if (existing.length !== items.length) {
    safeWriteJson(HISTORY_FILE, existing);
    logger.info(`Pruned ${items.length - existing.length} missing/moved file(s) from history.`);
  }

  return existing;
}

function addHistoryItem(item) {
  const list = getHistory();
  const filtered = list.filter((x) => x.id !== item.id && x.file !== item.file);
  filtered.unshift(item);
  const trimmed = filtered.slice(0, 100); // keep up to 100 entries
  safeWriteJson(HISTORY_FILE, trimmed);
  return trimmed;
}

function clearHistory() {
  safeWriteJson(HISTORY_FILE, []);
}

function removeHistoryItem(id, deleteFile = false) {
  const list = getHistory();
  const target = list.find((x) => x.id === id);
  if (target && deleteFile && target.file && fs.existsSync(target.file)) {
    try {
      fs.unlinkSync(target.file);
      logger.info(`Deleted file from disk: ${target.file}`);
    } catch (err) {
      logger.warn(`Failed to delete file from disk: ${err.message}`);
    }
  }
  const updated = list.filter((x) => x.id !== id);
  safeWriteJson(HISTORY_FILE, updated);
  return updated;
}

function removeHistoryItems(ids, deleteFiles = false) {
  if (!Array.isArray(ids)) return getHistory();
  const idSet = new Set(ids);
  const list = getHistory();

  if (deleteFiles) {
    for (const item of list) {
      if (idSet.has(item.id) && item.file && fs.existsSync(item.file)) {
        try {
          fs.unlinkSync(item.file);
          logger.info(`Deleted file from disk: ${item.file}`);
        } catch (err) {
          logger.warn(`Failed to delete file from disk: ${err.message}`);
        }
      }
    }
  }

  const updated = list.filter((x) => !idSet.has(x.id));
  safeWriteJson(HISTORY_FILE, updated);
  return updated;
}

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
  getSavedQueue,
  saveQueue,
  getHistory,
  addHistoryItem,
  clearHistory,
  removeHistoryItem,
  removeHistoryItems,
  DEFAULT_DOWNLOAD_DIR,
};
