/**
 * lib/ytdlp.js — yt-dlp & FFmpeg Command Builder, Inspector, and Runner
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync, spawn, spawnSync } = require("child_process");
const logger = require("./logger");

let cachedYtdlp = null;
let cachedFfmpeg = null;
let cachedFfprobe = null;

// ── Dependency Discovery ───────────────────────────────────────────────────────

function searchDirForExe(dir, exeName, results, depth) {
  if (depth <= 0) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === exeName.toLowerCase()) {
        results.push(full);
        return;
      }
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        searchDirForExe(full, exeName, results, depth - 1);
      }
    }
  } catch {}
}

function findBinary(binName) {
  const exeName = process.platform === "win32" ? `${binName}.exe` : binName;

  // 0. Bundled bin/ directory (standalone portable mode)
  const bundledPath = path.join(__dirname, "..", "bin", exeName);
  if (fs.existsSync(bundledPath)) {
    try {
      const res = spawnSync(bundledPath, ["-version"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 5000,
      });
      if (res.status === 0 && res.stdout) {
        const ver = res.stdout.split("\n")[0].trim();
        const binDir = path.dirname(bundledPath);
        process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ""}`;
        return { cmd: bundledPath, dir: binDir, version: ver };
      }
    } catch {}
  }

  // 1. Try PATH
  try {
    const res = spawnSync(binName, ["-version"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    });
    if (res.status === 0 && res.stdout) {
      const ver = res.stdout.split("\n")[0].trim();
      return { cmd: binName, dir: "", version: ver };
    }
  } catch {}

  // 2. Windows paths (WinGet, ProgramFiles, etc.)
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const programFiles = process.env.ProgramFiles || "";
    const candidates = [];

    if (localAppData) {
      const wingetDir = path.join(localAppData, "Microsoft", "WinGet", "Packages");
      if (fs.existsSync(wingetDir)) {
        try {
          const pkgs = fs.readdirSync(wingetDir);
          for (const pkg of pkgs) {
            if (pkg.toLowerCase().includes(binName)) {
              searchDirForExe(path.join(wingetDir, pkg), exeName, candidates, 3);
            }
          }
        } catch {}
      }
    }

    if (programFiles && candidates.length === 0) {
      searchDirForExe(programFiles, exeName, candidates, 3);
    }

    for (const exe of candidates) {
      try {
        const res = spawnSync(exe, ["-version"], {
          encoding: "utf8",
          windowsHide: true,
          timeout: 5000,
        });
        if (res.status === 0 && res.stdout) {
          const ver = res.stdout.split("\n")[0].trim();
          const binDir = path.dirname(exe);
          // Prepend to PATH
          process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ""}`;
          return { cmd: exe, dir: binDir, version: ver };
        }
      } catch {}
    }
  }

  return null;
}

function findFfmpeg() {
  if (cachedFfmpeg !== null) return cachedFfmpeg;
  cachedFfmpeg = findBinary("ffmpeg");
  return cachedFfmpeg;
}

function findFfprobe() {
  if (cachedFfprobe !== null) return cachedFfprobe;
  cachedFfprobe = findBinary("ffprobe");
  return cachedFfprobe;
}

function findYtdlp(forceRefresh = false) {
  if (cachedYtdlp && !forceRefresh) return cachedYtdlp;

  // Ensure ffmpeg is discovered first
  findFfmpeg();

  const candidates = [];

  // 0. Bundled bin/ directory (standalone portable mode)
  const bundledYtdlp = path.join(__dirname, "..", "bin", "yt-dlp.exe");
  if (fs.existsSync(bundledYtdlp)) candidates.push({ cmd: bundledYtdlp, args: [] });

  // 1. Local project .venv
  const venvYtdlp = path.join(__dirname, "..", ".venv", "Scripts", "yt-dlp.exe");
  if (fs.existsSync(venvYtdlp)) candidates.push({ cmd: venvYtdlp, args: [] });

  const venvPython = path.join(__dirname, "..", ".venv", "Scripts", "python.exe");
  if (fs.existsSync(venvPython)) candidates.push({ cmd: venvPython, args: ["-u", "-m", "yt_dlp"] });

  // 2. System PATH
  candidates.push({ cmd: "yt-dlp", args: [] });

  // 3. User Pythoncore / WinGet
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    if (localAppData) {
      const pyCoreDir = path.join(localAppData, "Python");
      if (fs.existsSync(pyCoreDir)) {
        try {
          const dirs = fs.readdirSync(pyCoreDir);
          for (const d of dirs) {
            const sExe = path.join(pyCoreDir, d, "Scripts", "yt-dlp.exe");
            if (fs.existsSync(sExe)) candidates.push({ cmd: sExe, args: [] });
            const pExe = path.join(pyCoreDir, d, "python.exe");
            if (fs.existsSync(pExe)) candidates.push({ cmd: pExe, args: ["-u", "-m", "yt_dlp"] });
          }
        } catch {}
      }

      const wingetDir = path.join(localAppData, "Microsoft", "WinGet", "Packages");
      if (fs.existsSync(wingetDir)) {
        try {
          const pkgs = fs.readdirSync(wingetDir);
          for (const pkg of pkgs) {
            if (pkg.toLowerCase().includes("yt-dlp")) {
              searchDirForExe(path.join(wingetDir, pkg), "yt-dlp.exe", candidates.map((c) => c.cmd), 3);
            }
          }
        } catch {}
      }
    }

    candidates.push({ cmd: "py", args: ["-3", "-u", "-m", "yt_dlp"] });
    candidates.push({ cmd: "python", args: ["-u", "-m", "yt_dlp"] });
  }

  for (const c of candidates) {
    try {
      const fullArgs = [...c.args, "--version"];
      const res = spawnSync(c.cmd, fullArgs, {
        encoding: "utf8",
        windowsHide: true,
        timeout: 6000,
      });
      if (res.status === 0 && res.stdout && res.stdout.trim()) {
        const out = res.stdout.trim();
        cachedYtdlp = { cmd: c.cmd, args: c.args, version: out };
        logger.info(`Discovered yt-dlp at: ${c.cmd} (version ${out})`);
        return cachedYtdlp;
      }
    } catch {}
  }

  cachedYtdlp = null;
  return null;
}

function checkSystemHealth() {
  const ytdlp = findYtdlp();
  const ffmpeg = findFfmpeg();
  const ffprobe = findFfprobe();

  return {
    ytdlp: Boolean(ytdlp),
    ytdlpVersion: ytdlp ? ytdlp.version : null,
    ytdlpPath: ytdlp ? ytdlp.cmd : null,
    ffmpeg: Boolean(ffmpeg),
    ffmpegVersion: ffmpeg ? ffmpeg.version : null,
    ffprobe: Boolean(ffprobe),
    ffprobeVersion: ffprobe ? ffprobe.version : null,
  };
}

// ── Building Command Arguments ─────────────────────────────────────────────────

function buildDownloadArgs(url, options, settings) {
  const ytdlp = findYtdlp();
  if (!ytdlp) throw new Error("yt-dlp executable not found.");

  const args = [...ytdlp.args];

  // 1. Format Selection
  const type = options.type || "video_audio";
  const quality = options.quality || "best";
  const container = options.container || "mp4";
  const audioFormat = options.audioFormat || "mp3";
  const audioQuality = options.audioQuality || "best";

  if (type === "audio_only") {
    args.push("-x", "--audio-format", audioFormat);
    if (audioQuality !== "best") {
      args.push("--audio-quality", `${audioQuality}K`);
    }
  } else if (type === "video_only") {
    if (quality === "best") {
      args.push("-f", "bv*/b");
    } else {
      // Fallback to best available video if specified height is unavailable
      args.push("-f", `bv*[height<=${quality}]/bv*/b`);
    }
    args.push("--remux-video", container);
  } else {
    // video + audio with automatic fallback to closest available format
    if (quality === "best") {
      args.push("-f", "bv*+ba/b");
    } else {
      args.push("-f", `bv*[height<=${quality}]+ba/b[height<=${quality}]/bv*+ba/b`);
    }
    args.push("--merge-output-format", container);
  }

  // 2. Subtitles
  if (Array.isArray(options.subLangs) && options.subLangs.length > 0) {
    args.push("--write-subs", "--sub-langs", options.subLangs.join(","));
    if (options.subtitlesMode === "embed") {
      args.push("--embed-subs");
    }
  }

  // 3. Metadata & Chapters
  if (options.embedMetadata) args.push("--embed-metadata");
  if (options.embedChapters) args.push("--embed-chapters");
  if (options.embedThumbnail) args.push("--embed-thumbnail");
  if (options.saveThumbnailImage) args.push("--write-thumbnail");

  // 4. Clip / Trim Section (--download-sections)
  // Only add download-sections if an actual sub-range is requested
  const isStartTime = Boolean(options.clipStart && options.clipStart !== "00:00" && options.clipStart !== "00:00:00" && options.clipStart !== "0");
  const isEndTime = Boolean(options.clipEnd && options.clipEnd !== "inf" && options.clipEnd !== "");
  if (isStartTime || isEndTime) {
    const s = options.clipStart || "00:00:00";
    const e = options.clipEnd || "inf";
    args.push("--download-sections", `*${s}-${e}`);
    args.push("--force-keyframes-at-cuts");
  }

  // 5. Audio Extras & Postprocessor Filters
  // yt-dlp only accepts one --postprocessor-args per key (ffmpeg:), so we
  // collect all ffmpeg flags and emit a single combined argument.
  // Note: Values with spaces MUST be quoted so yt-dlp's shlex parser does not split them
  // into separate tokens which would cause ffmpeg to treat words as output filenames.
  const ffmpegPostArgs = [];
  if (options.audioNormalize) {
    ffmpegPostArgs.push("-af", "loudnorm");
  }
  if (options.metaTitle) {
    const safeTitle = options.metaTitle.replace(/["\n\r]/g, " ").trim();
    ffmpegPostArgs.push("-metadata", `title="${safeTitle}"`);
  }
  if (options.metaArtist) {
    const safeArtist = options.metaArtist.replace(/["\n\r]/g, " ").trim();
    ffmpegPostArgs.push("-metadata", `artist="${safeArtist}"`);
  }
  if (options.metaAlbum) {
    const safeAlbum = options.metaAlbum.replace(/["\n\r]/g, " ").trim();
    ffmpegPostArgs.push("-metadata", `album="${safeAlbum}"`);
  }
  if (ffmpegPostArgs.length > 0) {
    // Single --postprocessor-args value: "ffmpeg:<flag1> <val1> <flag2> <val2>"
    args.push("--postprocessor-args", `ffmpeg:${ffmpegPostArgs.join(" ")}`);
  }

  // 6. SponsorBlock
  if (options.sponsorBlock && Array.isArray(options.sponsorBlockCategories) && options.sponsorBlockCategories.length > 0) {
    args.push("--sponsorblock-remove", options.sponsorBlockCategories.join(","));
  }

  // 5. Settings: Speed Limit, Retries, Cookies
  if (settings.speedLimit) {
    args.push("--limit-rate", settings.speedLimit);
  }
  if (typeof settings.maxRetries === "number" && settings.maxRetries > 0) {
    args.push("--retries", settings.maxRetries.toString());
  }
  if (settings.browserCookies && settings.browserCookies !== "none") {
    args.push("--cookies-from-browser", settings.browserCookies);
  }

  // 6. FFmpeg location
  const ffmpeg = findFfmpeg();
  if (ffmpeg && ffmpeg.dir) {
    args.push("--ffmpeg-location", ffmpeg.dir);
  }

  // 7. Playlist handling & Output template
  let targetDir = settings.downloadDir;
  let filenameTpl = settings.filenameTemplate || "%(title)s.%(ext)s";

  if (options.customFilename && typeof options.customFilename === "string" && options.customFilename.trim()) {
    let clean = options.customFilename.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
    // Strip trailing common audio/video extensions if provided by the user
    clean = clean.replace(/\.(mp4|mkv|webm|mp3|m4a|opus|flac|wav)$/i, "").trim();
    if (clean) {
      filenameTpl = `${clean}.%(ext)s`;
    }
  }

  if (options.isPlaylist) {
    args.push("--yes-playlist");
    if (options.playlistItems) {
      args.push("--playlist-items", options.playlistItems);
    }
    if (options.folderPerPlaylist) {
      targetDir = path.join(targetDir, "%(playlist_title)s");
    }
    if (options.numberFiles) {
      filenameTpl = `%(playlist_index)02d - ${filenameTpl}`;
    }
  } else {
    args.push("--no-playlist");
  }

  const fullOutputTemplate = path.join(targetDir, filenameTpl);

  args.push(
    "-o", fullOutputTemplate,
    "--restrict-filenames",
    "--no-colors",
    "--color", "never",
    "--newline",
    "--progress-delta", "0.2",
    "--progress-template",
    "download:downloading %(progress._percent_str)s %(progress._speed_str)s %(progress._eta_str)s %(progress._total_bytes_str|progress._total_bytes_estimate_str)s",
    "--print", "before_dl:[meta] %(title)s\t%(thumbnail)s",
    "--print", "after_move:[dest] %(filepath)s",
    "--",
    url
  );

  return { cmd: ytdlp.cmd, args, targetDir };
}

// ── Metadata & Playlist Inspection ─────────────────────────────────────────────

async function fetchVideoInfo(url) {
  const ytdlp = findYtdlp();
  if (!ytdlp) throw new Error("yt-dlp is not installed.");

  const store = require("./store");
  const settings = store.getSettings();

  const infoArgs = [
    ...ytdlp.args,
    "--dump-json",
    "--no-playlist",
    "--skip-download",
    "--no-warnings",
    "--socket-timeout",
    "20",
  ];

  if (settings.browserCookies && settings.browserCookies !== "none") {
    infoArgs.push("--cookies-from-browser", settings.browserCookies);
  }

  infoArgs.push("--", url);

  return new Promise((resolve, reject) => {
    logger.debug(`Fetching video info: ${ytdlp.cmd} ${infoArgs.join(" ")}`);
    const p = spawn(ytdlp.cmd, infoArgs, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let rawOut = "";
    let rawErr = "";

    p.stdout.on("data", (c) => (rawOut += c.toString("utf8")));
    p.stderr.on("data", (c) => (rawErr += c.toString("utf8")));

    p.on("close", (code) => {
      if (code === 0 && rawOut.trim()) {
        try {
          const data = JSON.parse(rawOut.trim());

          // Extract available video resolutions with estimated size
          const qualities = new Map();
          if (Array.isArray(data.formats)) {
            for (const f of data.formats) {
              if (f.vcodec && f.vcodec !== "none" && typeof f.height === "number") {
                const h = f.height;
                const size = f.filesize || f.filesize_approx || 0;
                if (!qualities.has(h) || size > qualities.get(h)) {
                  qualities.set(h, size);
                }
              }
            }
          }

          const availableQualities = Array.from(qualities.entries())
            .map(([height, sizeBytes]) => ({
              height,
              sizeBytes,
              sizeStr: sizeBytes ? formatBytes(sizeBytes) : null,
            }))
            .sort((a, b) => b.height - a.height);

          // Extract available subtitles
          const availableSubtitles = [];
          if (data.subtitles && typeof data.subtitles === "object") {
            for (const lang of Object.keys(data.subtitles)) {
              availableSubtitles.push(lang);
            }
          }

          resolve({
            id: data.id,
            title: data.title,
            uploader: data.uploader || data.channel || "",
            duration: data.duration || 0,
            viewCount: data.view_count || 0,
            uploadDate: data.upload_date || "",
            thumbnail: data.thumbnail || "",
            availableQualities,
            availableSubtitles,
            isLive: Boolean(data.is_live),
          });
          return;
        } catch (err) {
          logger.error(`Failed to parse video metadata JSON for ${url}: ${err.message}`);
          reject(new Error("Failed to parse video metadata: " + err.message));
          return;
        }
      }

      // Diagnose common yt-dlp error patterns
      let errMsg = rawErr.trim() || "Could not retrieve video information.";
      if (errMsg.includes("Private video")) errMsg = "This video is private.";
      else if (errMsg.includes("Sign in to confirm your age") || errMsg.includes("age-restricted")) {
        errMsg = "This video is age-restricted. Configure browser cookies in Settings to download.";
      } else if (errMsg.includes("Video unavailable") || errMsg.includes("This video has been removed")) {
        errMsg = "This video is unavailable or has been removed.";
      } else if (errMsg.includes("not available in your country") || errMsg.includes("geo-restricted")) {
        errMsg = "This video is geo-restricted in your country.";
      }

      logger.error(`yt-dlp metadata error for ${url} (code ${code}): ${errMsg}`);
      reject(new Error(errMsg));
    });

    p.on("error", (err) => {
      logger.error(`Failed to spawn yt-dlp for ${url}: ${err.message}`);
      reject(err);
    });
  });
}

async function fetchPlaylistInfo(url) {
  const ytdlp = findYtdlp();
  if (!ytdlp) throw new Error("yt-dlp is not installed.");

  const listArgs = [
    ...ytdlp.args,
    "--flat-playlist",
    "--dump-json",
    "--no-warnings",
    "--",
    url,
  ];

  return new Promise((resolve, reject) => {
    logger.debug(`Fetching playlist: ${ytdlp.cmd} ${listArgs.join(" ")}`);
    const p = spawn(ytdlp.cmd, listArgs, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let rawOut = "";
    let rawErr = "";

    p.stdout.on("data", (c) => (rawOut += c.toString("utf8")));
    p.stderr.on("data", (c) => (rawErr += c.toString("utf8")));

    p.on("close", (code) => {
      if (code === 0 && rawOut.trim()) {
        try {
          const lines = rawOut.trim().split("\n");
          const items = [];
          let playlistTitle = "YouTube Playlist";

          for (const line of lines) {
            if (!line.trim()) continue;
            const item = JSON.parse(line);
            if (item.playlist_title && !playlistTitle) {
              playlistTitle = item.playlist_title;
            }
            items.push({
              index: items.length + 1,
              id: item.id,
              title: item.title,
              duration: item.duration || 0,
              uploader: item.uploader || "",
              url: item.url || `https://www.youtube.com/watch?v=${item.id}`,
              thumbnail: item.thumbnails && item.thumbnails[0] ? item.thumbnails[0].url : `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
            });
          }

          resolve({
            title: playlistTitle,
            itemCount: items.length,
            items,
          });
          return;
        } catch (err) {
          reject(new Error("Failed to parse playlist: " + err.message));
          return;
        }
      }

      reject(new Error(rawErr.trim() || "Failed to fetch playlist."));
    });

    p.on("error", (err) => reject(err));
  });
}

// ── yt-dlp Self-Updater ────────────────────────────────────────────────────────

async function updateYtdlp() {
  const ytdlp = findYtdlp(true);
  if (!ytdlp) throw new Error("yt-dlp is not installed.");

  return new Promise((resolve, reject) => {
    let updateCmd = ytdlp.cmd;
    let updateArgs = [...ytdlp.args, "-U"];

    // If installed in python virtualenv or pythoncore, try pip upgrade
    if (ytdlp.cmd.includes("python.exe")) {
      updateArgs = ["-m", "pip", "install", "-U", "yt-dlp"];
    } else if (ytdlp.cmd.toLowerCase().includes(".venv")) {
      const venvPy = path.join(path.dirname(ytdlp.cmd), "python.exe");
      if (fs.existsSync(venvPy)) {
        updateCmd = venvPy;
        updateArgs = ["-m", "pip", "install", "-U", "yt-dlp"];
      }
    }

    logger.info(`Running yt-dlp updater: ${updateCmd} ${updateArgs.join(" ")}`);

    const p = spawn(updateCmd, updateArgs, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let rawOut = "";
    let rawErr = "";

    p.stdout.on("data", (c) => (rawOut += c.toString("utf8")));
    p.stderr.on("data", (c) => (rawErr += c.toString("utf8")));

    p.on("close", (code) => {
      const fullLog = `${rawOut}\n${rawErr}`.trim();
      const refreshed = findYtdlp(true);
      if (code === 0) {
        resolve({
          success: true,
          output: fullLog || "yt-dlp updated successfully.",
          version: refreshed ? refreshed.version : "Unknown",
        });
      } else {
        resolve({
          success: false,
          output: fullLog || `Update process exited with code ${code}.`,
          version: refreshed ? refreshed.version : "Unknown",
        });
      }
    });

    p.on("error", (err) => reject(err));
  });
}

// ── Directory Size Calculation ─────────────────────────────────────────────────

function getDirectorySize(dirPath) {
  let totalBytes = 0;
  let fileCount = 0;

  function traverse(cur) {
    try {
      const entries = fs.readdirSync(cur, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(cur, e.name);
        if (e.isFile()) {
          totalBytes += fs.statSync(full).size;
          fileCount++;
        } else if (e.isDirectory()) {
          traverse(full);
        }
      }
    } catch {}
  }

  if (fs.existsSync(dirPath)) {
    traverse(dirPath);
  }

  return {
    totalBytes,
    fileCount,
    formatted: formatBytes(totalBytes),
  };
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

module.exports = {
  findYtdlp,
  findFfmpeg,
  findFfprobe,
  checkSystemHealth,
  buildDownloadArgs,
  fetchVideoInfo,
  fetchPlaylistInfo,
  updateYtdlp,
  getDirectorySize,
  formatBytes,
};
