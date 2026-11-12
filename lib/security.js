/**
 * lib/security.js — Security & Validation Layer
 *
 * Implements:
 *  - CSRF protection: Host/Origin header checking + cryptographically random session token
 *  - YouTube URL validation (HTTPS only, strictly whitelisted YouTube hostnames)
 *  - Download directory validation (prevents system directories and unsafe roots)
 *  - Input sanitisation against strict whitelists (qualities, formats, categories)
 *  - Safe filename template validation
 */

"use strict";

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { URL } = require("url");

// Per-server session token for state-changing requests (CSRF mitigation)
const SESSION_TOKEN = crypto.randomBytes(32).toString("hex");

const ALLOWED_HOSTNAMES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const ALLOWED_TYPES = new Set(["video_audio", "audio_only", "video_only"]);

const ALLOWED_QUALITIES = new Set([
  "best",
  "2160",
  "1440",
  "1080",
  "720",
  "480",
  "360",
  "240",
  "144",
]);

const ALLOWED_CONTAINERS = new Set(["mp4", "mkv", "webm"]);

const ALLOWED_AUDIO_FORMATS = new Set(["mp3", "m4a", "opus", "flac", "wav"]);

const ALLOWED_AUDIO_QUALITIES = new Set(["best", "320", "256", "192", "128", "96"]);

const ALLOWED_SPEED_LIMITS = new Set(["", "500K", "1M", "2M", "5M", "10M", "20M"]);

const ALLOWED_BROWSERS = new Set(["none", "chrome", "edge", "firefox", "brave", "opera", "vivaldi"]);

const ALLOWED_SPONSORBLOCK_CATEGORIES = new Set([
  "sponsor",
  "intro",
  "outro",
  "selfpromo",
  "preview",
  "filler",
  "interaction",
  "music_offtopic",
]);

const SAFE_TEMPLATE_TOKENS = new Set([
  "title",
  "id",
  "ext",
  "uploader",
  "channel",
  "upload_date",
  "playlist_index",
  "playlist_title",
  "playlist_id",
  "resolution",
  "format_id",
]);

function getSessionToken() {
  return SESSION_TOKEN;
}

/**
 * Validate Host and Origin headers to ensure request originated from local browser
 */
function validateHostAndOrigin(req) {
  const host = req.headers["host"] || "";
  const hostName = host.split(":")[0].toLowerCase();
  if (hostName !== "127.0.0.1" && hostName !== "localhost") {
    return false;
  }

  // Check Origin or Referer if present (mandatory for POST/DELETE)
  const origin = req.headers["origin"];
  if (origin) {
    try {
      const u = new URL(origin);
      const oHost = u.hostname.toLowerCase();
      if (oHost !== "127.0.0.1" && oHost !== "localhost") {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Verify CSRF Session Token for state-changing HTTP methods
 */
function verifySessionToken(req) {
  const token = req.headers["x-session-token"];
  if (!token || typeof token !== "string") return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(SESSION_TOKEN));
}

/**
 * Validate YouTube URL strictly
 */
function validateYouTubeUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return null;
  const trimmed = urlStr.trim();
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return null;
    const hostname = u.hostname.toLowerCase();
    if (!ALLOWED_HOSTNAMES.has(hostname)) return null;

    // Filter disallowed control characters
    if (/[\x00-\x1f\x7f]/.test(trimmed)) return null;

    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Validate a user-specified download folder
 */
function validateDownloadPath(dirPath) {
  if (!dirPath || typeof dirPath !== "string") return null;
  const normalized = path.resolve(dirPath.trim());

  // Prevent root drives like "C:\" or "/"
  const root = path.parse(normalized).root;
  if (normalized === root) return null;

  // Prevent Windows system directories
  if (process.platform === "win32") {
    const winDir = (process.env.SystemRoot || process.env.windir || "C:\\Windows").toLowerCase();
    const progFiles = (process.env.ProgramFiles || "C:\\Program Files").toLowerCase();
    const progFilesX86 = (process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)").toLowerCase();
    const target = normalized.toLowerCase();

    if (
      target === winDir ||
      target.startsWith(winDir + path.sep) ||
      target === progFiles ||
      target.startsWith(progFiles + path.sep) ||
      target === progFilesX86 ||
      target.startsWith(progFilesX86 + path.sep)
    ) {
      return null;
    }
  }

  // Ensure path can exist or be created
  try {
    fs.mkdirSync(normalized, { recursive: true });
    fs.accessSync(normalized, fs.constants.W_OK);
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Validate custom filename template
 */
function validateFilenameTemplate(template) {
  if (!template || typeof template !== "string") return "%(title)s.%(ext)s";
  const trimmed = template.trim();
  if (trimmed.length > 200) return "%(title)s.%(ext)s";

  // Check all %(token) placeholders
  const tokenRegex = /%\(([^)]+)\)/g;
  let match;
  while ((match = tokenRegex.exec(trimmed)) !== null) {
    const rawToken = match[1];
    // Strip modifier like .150B or .200B
    const cleanToken = rawToken.split(".")[0];
    if (!SAFE_TEMPLATE_TOKENS.has(cleanToken)) {
      return "%(title)s.%(ext)s"; // fallback to safe default
    }
  }

  // Disallow directory traversal or absolute separators
  if (/[\\\/]/.test(trimmed) || trimmed.includes("..")) {
    return "%(title)s.%(ext)s";
  }

  return trimmed;
}

/**
 * Validate download options payload against whitelists
 */
function sanitizeDownloadOptions(raw) {
  const opts = typeof raw === "object" && raw !== null ? raw : {};

  const type = ALLOWED_TYPES.has(opts.type) ? opts.type : "video_audio";
  const quality = ALLOWED_QUALITIES.has(opts.quality) ? opts.quality : "best";
  const container = ALLOWED_CONTAINERS.has(opts.container) ? opts.container : "mp4";
  const audioFormat = ALLOWED_AUDIO_FORMATS.has(opts.audioFormat) ? opts.audioFormat : "mp3";
  const audioQuality = ALLOWED_AUDIO_QUALITIES.has(opts.audioQuality) ? opts.audioQuality : "best";

  // Subtitles
  const subtitlesMode = opts.subtitlesMode === "separate" ? "separate" : "embed";
  let subLangs = [];
  if (Array.isArray(opts.subLangs)) {
    subLangs = opts.subLangs
      .filter((l) => typeof l === "string" && /^[a-zA-Z0-9_\-]+$/.test(l))
      .slice(0, 10);
  }

  // SponsorBlock
  let sponsorBlockCategories = [];
  if (Array.isArray(opts.sponsorBlockCategories)) {
    sponsorBlockCategories = opts.sponsorBlockCategories.filter((c) =>
      ALLOWED_SPONSORBLOCK_CATEGORIES.has(c)
    );
  }

  // Clip / Trim sections
  const TIME_REGEX = /^(\d{1,2}:)?[0-5]?\d:[0-5]\d(\.\d+)?$|^\d+(\.\d+)?$/;
  let clipStart = null;
  let clipEnd = null;
  if (typeof opts.clipStart === "string" && TIME_REGEX.test(opts.clipStart.trim())) {
    clipStart = opts.clipStart.trim();
  }
  if (typeof opts.clipEnd === "string" && TIME_REGEX.test(opts.clipEnd.trim())) {
    clipEnd = opts.clipEnd.trim();
  }

  // Audio Loudness Normalization
  const audioNormalize = Boolean(opts.audioNormalize);

  // Custom Metadata
  const cleanMeta = (str, maxLen = 120) => {
    if (!str || typeof str !== "string") return null;
    const sanitized = str.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, maxLen);
    return sanitized || null;
  };
  const metaTitle = cleanMeta(opts.metaTitle, 150);
  const metaArtist = cleanMeta(opts.metaArtist, 100);
  const metaAlbum = cleanMeta(opts.metaAlbum, 100);

  // Custom Filename Override
  let customFilename = null;
  if (typeof opts.customFilename === "string" && opts.customFilename.trim()) {
    const safe = opts.customFilename
      .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, "_")
      .trim()
      .slice(0, 180);
    customFilename = safe || null;
  }

  return {
    type,
    quality,
    container,
    audioFormat,
    audioQuality,
    subtitlesMode,
    subLangs,
    embedThumbnail: Boolean(opts.embedThumbnail),
    embedMetadata: Boolean(opts.embedMetadata),
    embedChapters: Boolean(opts.embedChapters),
    saveThumbnailImage: Boolean(opts.saveThumbnailImage),
    sponsorBlock: Boolean(opts.sponsorBlock && sponsorBlockCategories.length > 0),
    sponsorBlockCategories,
    // Group 2 Download extras
    clipStart,
    clipEnd,
    audioNormalize,
    metaTitle,
    metaArtist,
    metaAlbum,
    customFilename,
    // Playlist options
    isPlaylist: Boolean(opts.isPlaylist),
    playlistItems: typeof opts.playlistItems === "string" && /^[\d,\-]+$/.test(opts.playlistItems) ? opts.playlistItems : null,
    numberFiles: Boolean(opts.numberFiles),
    folderPerPlaylist: Boolean(opts.folderPerPlaylist),
  };
}

module.exports = {
  getSessionToken,
  validateHostAndOrigin,
  verifySessionToken,
  validateYouTubeUrl,
  validateDownloadPath,
  validateFilenameTemplate,
  sanitizeDownloadOptions,
  ALLOWED_SPEED_LIMITS,
  ALLOWED_BROWSERS,
};
