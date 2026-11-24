/**
 * app.js — YouTube Video Downloader Client Application
 *
 * Full-featured controller with custom accessible dropdowns, SSE queue stream,
 * playlist selection, settings modal, history search/filter, and keyboard shortcuts.
 */

"use strict";

(function () {
  // ── Global State ─────────────────────────────────────────────────────────────
  let sessionToken = "";
  let currentSettings = {};
  let queueItems = [];
  let historyItems = [];
  let activeVideoInfo = null;
  let activePlaylistInfo = null;
  let sseEventSource = null;
  let fetchDebounceTimer = null;
  let commandPreviewTimer = null;

  // ── DOM Element Cache ────────────────────────────────────────────────────────
  const urlInput = document.getElementById("url-input");
  const btnPaste = document.getElementById("btn-paste");
  const btnFetch = document.getElementById("btn-fetch");
  const urlValidationList = document.getElementById("url-validation-list");
  const previewPlaceholder = document.getElementById("preview-placeholder");
  const previewSkeleton = document.getElementById("preview-skeleton");
  const previewError = document.getElementById("preview-error");
  const previewErrorMsg = document.getElementById("preview-error-msg");

  const videoPreview = document.getElementById("video-preview");
  const previewThumb = document.getElementById("preview-thumb");
  const previewDuration = document.getElementById("preview-duration");
  const previewTitle = document.getElementById("preview-title");
  const previewAuthor = document.getElementById("preview-author");
  const previewViews = document.getElementById("preview-views");
  const previewDate = document.getElementById("preview-date");
  const previewEstSize = document.getElementById("preview-est-size");
  const previewQualitiesList = document.getElementById("preview-qualities-list");

  const playlistPreview = document.getElementById("playlist-preview");
  const playlistTitle = document.getElementById("playlist-title");
  const playlistCount = document.getElementById("playlist-count");
  const playlistItemsList = document.getElementById("playlist-items-list");
  const playlistRangeStart = document.getElementById("playlist-range-start");
  const playlistRangeEnd = document.getElementById("playlist-range-end");
  const btnPlaylistSelectAll = document.getElementById("btn-playlist-select-all");
  const btnPlaylistSelectNone = document.getElementById("btn-playlist-select-none");
  const btnPlaylistApplyRange = document.getElementById("btn-playlist-apply-range");
  const chkPlaylistNumbering = document.getElementById("chk-playlist-numbering");
  const chkPlaylistSubfolder = document.getElementById("chk-playlist-subfolder");

  const batchPreview = document.getElementById("batch-preview");
  const batchPreviewTitle = document.getElementById("batch-preview-title");
  const batchPreviewCount = document.getElementById("batch-preview-count");
  const batchPreviewList = document.getElementById("batch-preview-list");
  const batchVideoMap = new Map();
  let currentBatchFetchController = null;

  // Dropdowns
  const selectType = document.getElementById("select-type");
  const selectQuality = document.getElementById("select-quality");
  const dropdownQualityOptions = document.getElementById("dropdown-quality-options");
  const selectContainer = document.getElementById("select-container");
  const selectAudioFormat = document.getElementById("select-audio-format");
  const selectAudioQuality = document.getElementById("select-audio-quality");
  const selectSubtitles = document.getElementById("select-subtitles");
  const subtitlesDisplay = document.getElementById("subtitles-display");
  const subtitlesItemsList = document.getElementById("subtitles-items-list");

  const fieldVideoQuality = document.getElementById("field-video-quality");
  const fieldVideoContainer = document.getElementById("field-video-container");
  const fieldAudioFormat = document.getElementById("field-audio-format");
  const fieldAudioQuality = document.getElementById("field-audio-quality");
  const fieldSubtitles = document.getElementById("field-subtitles");

  // Options
  const optEmbedChapters = document.getElementById("opt-embed-chapters");
  const optSaveThumb = document.getElementById("opt-save-thumb");
  const chkEmbedThumb = document.getElementById("chk-embed-thumb");
  const chkEmbedMeta = document.getElementById("chk-embed-meta");
  const chkEmbedChapters = document.getElementById("chk-embed-chapters");
  const chkSaveThumb = document.getElementById("chk-save-thumb");
  const chkSponsorblock = document.getElementById("chk-sponsorblock");
  const sponsorblockCategories = document.getElementById("sponsorblock-categories");

  // Group 2: Download Features Elements
  const customPresetsList = document.getElementById("custom-presets-list");
  const btnSavePreset = document.getElementById("btn-save-preset");
  const savePresetModal = document.getElementById("save-preset-modal");
  const inputPresetName = document.getElementById("input-preset-name");
  const btnCloseSavePreset = document.getElementById("btn-close-save-preset");
  const btnCancelSavePreset = document.getElementById("btn-cancel-save-preset");
  const btnConfirmSavePreset = document.getElementById("btn-confirm-save-preset");

  const lblLiveFilename = document.getElementById("lbl-live-filename");

  const clipStart = document.getElementById("clip-start");
  const clipEnd = document.getElementById("clip-end");
  const clipSliderStart = document.getElementById("clip-slider-start");
  const clipSliderEnd = document.getElementById("clip-slider-end");
  const clipRangeHighlight = document.getElementById("clip-range-highlight");
  const clipDurationText = document.getElementById("clip-duration-text");
  const btnResetClip = document.getElementById("btn-reset-clip");
  const btnPreviewCut = document.getElementById("btn-preview-cut");
  const clipActiveBadge = document.getElementById("clip-active-badge");

  const btnPreviewModeThumb = document.getElementById("btn-preview-mode-thumb");
  const btnPreviewModePlayer = document.getElementById("btn-preview-mode-player");
  const btnThumbQuickPlay = document.getElementById("btn-thumb-quick-play");
  const btnSyncPlayerCut = document.getElementById("btn-sync-player-cut");
  const previewThumbContainer = document.getElementById("preview-thumb-container");
  const previewPlayerContainer = document.getElementById("preview-player-container");
  const previewIframe = document.getElementById("preview-iframe");
  const playerClipRangeText = document.getElementById("player-clip-range-text");

  const chkAudioNormalize = document.getElementById("chk-audio-normalize");
  const metaTitle = document.getElementById("meta-title");
  const metaArtist = document.getElementById("meta-artist");
  const metaAlbum = document.getElementById("meta-album");

  const inputCustomFilename = document.getElementById("input-custom-filename");
  const btnClearCustomFilename = document.getElementById("btn-clear-custom-filename");

  const duplicateConfirmModal = document.getElementById("duplicate-confirm-modal");
  const dupModalMsg = document.getElementById("dup-modal-msg");
  const btnCloseDup = document.getElementById("btn-close-dup");
  const btnSkipDup = document.getElementById("btn-skip-dup");
  const btnConfirmDup = document.getElementById("btn-confirm-dup");
  let pendingQueuePayload = null;

  // Footer Actions
  const btnFooterFolder = document.getElementById("btn-footer-folder");
  const btnFooterChangeFolder = document.getElementById("btn-footer-change-folder");

  // Action Buttons
  const btnAddQueue = document.getElementById("btn-add-queue");
  const btnAddText = document.getElementById("btn-add-text");
  const btnOpenDownloads = document.getElementById("btn-open-downloads");

  // Tabs & Badges
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const tabQueueCount = document.getElementById("tab-queue-count");
  const tabHistoryCount = document.getElementById("tab-history-count");

  // Queue
  const queueList = document.getElementById("queue-list");
  const queueEmpty = document.getElementById("queue-empty");
  const queueStatusSummary = document.getElementById("queue-status-summary");
  const btnClearQueueFinished = document.getElementById("btn-clear-queue-finished");
  const btnPauseAllQueue = document.getElementById("btn-pause-all-queue");
  const btnResumeAllQueue = document.getElementById("btn-resume-all-queue");
  const queueGlobalStats = document.getElementById("queue-global-stats");

  // History
  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");
  const historyTotalBadge = document.getElementById("history-total-badge");
  const historySearch = document.getElementById("history-search");
  const historyFilterType = document.getElementById("history-filter-type");
  const historyFilterDate = document.getElementById("history-filter-date");
  const historySort = document.getElementById("history-sort");
  const btnClearHistory = document.getElementById("btn-clear-history");
  const btnHistoryListView = document.getElementById("btn-history-list-view");
  const btnHistoryGridView = document.getElementById("btn-history-grid-view");
  const chkHistorySelectAll = document.getElementById("chk-history-select-all");
  const lblHistorySelectedCount = document.getElementById("lbl-history-selected-count");
  const btnBulkRedownload = document.getElementById("btn-bulk-redownload");
  const btnBulkDelete = document.getElementById("btn-bulk-delete");
  const btnExportHistoryJson = document.getElementById("btn-export-history-json");
  const btnExportHistoryCsv = document.getElementById("btn-export-history-csv");

  let historyViewMode = localStorage.getItem("ytdl_hist_view") || "list";
  const selectedHistoryIds = new Set();

  // Media Preview Player Modal
  const mediaPreviewModal = document.getElementById("media-preview-modal");
  const mediaPreviewTitle = document.getElementById("media-preview-title");
  const btnCloseMediaPreview = document.getElementById("btn-close-media-preview");
  const btnDismissMediaPreview = document.getElementById("btn-dismiss-media-preview");
  const previewVideoContainer = document.getElementById("preview-video-container");
  const previewVideoPlayer = document.getElementById("preview-video-player");
  const previewAudioContainer = document.getElementById("preview-audio-container");
  const previewAudioPlayer = document.getElementById("preview-audio-player");
  const btnPreviewShowFolder = document.getElementById("btn-preview-show-folder");
  const btnPreviewOpenSystem = document.getElementById("btn-preview-open-system");
  let currentPreviewFile = null;

  // Header & Health
  const healthPill = document.getElementById("health-pill");
  const healthText = document.getElementById("health-text");
  const btnUpdateYtdlp = document.getElementById("btn-update-ytdlp");
  const healthBanner = document.getElementById("health-banner");
  const healthBannerText = document.getElementById("health-banner-text");
  const healthBannerActions = document.getElementById("health-banner-actions");
  const footerDiskUsed = document.getElementById("footer-disk-used");
  const footerFolderPath = document.getElementById("footer-folder-path");

  // Settings Modal
  const settingsModal = document.getElementById("settings-modal");
  const btnOpenSettings = document.getElementById("btn-open-settings");
  const btnCloseSettings = document.getElementById("btn-close-settings");
  const btnCancelSettings = document.getElementById("btn-cancel-settings");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const settingFolder = document.getElementById("setting-folder");
  const btnVerifyFolder = document.getElementById("btn-verify-folder");
  const settingTemplate = document.getElementById("setting-template");
  const settingConcurrency = document.getElementById("setting-concurrency");
  const settingSpeed = document.getElementById("setting-speed");
  const settingCookies = document.getElementById("setting-cookies");
  const settingRetries = document.getElementById("setting-retries");
  const settingAutoOpen = document.getElementById("setting-auto-open");
  const settingSound = document.getElementById("setting-sound");
  const settingRunInBackground = document.getElementById("setting-run-in-background");

  // Log Modal
  const logModal = document.getElementById("log-modal");
  const btnCloseLog = document.getElementById("btn-close-log");
  const btnDismissLog = document.getElementById("btn-dismiss-log");
  const btnCopyLog = document.getElementById("btn-copy-log");
  const logContentBox = document.getElementById("log-content-box");

  const toastContainer = document.getElementById("toast-container");

  // Group 4 App-Level Elements
  const btnExportSettings = document.getElementById("btn-export-settings");
  const btnImportSettings = document.getElementById("btn-import-settings");
  const inputImportSettings = document.getElementById("input-import-settings");
  const btnResetSettings = document.getElementById("btn-reset-settings");
  const btnQuitServer = document.getElementById("btn-quit-server");

  // Shortcuts Modal
  const shortcutsModal = document.getElementById("shortcuts-modal");
  const btnCloseShortcuts = document.getElementById("btn-close-shortcuts");
  const btnDismissShortcuts = document.getElementById("btn-dismiss-shortcuts");

  // ── Connection Heartbeat & Status Indicator Elements ─────────────────────────
  const connPill = document.getElementById("conn-pill");
  const connText = document.getElementById("conn-text");
  const btnConnRetry = document.getElementById("btn-conn-retry");
  const serverStatusBanner = document.getElementById("server-status-banner");
  const serverStatusBannerText = document.getElementById("server-status-banner-text");
  const serverStatusBannerActions = document.getElementById("server-status-banner-actions");

  let serverConnState = "connected"; // "connected" | "reconnecting" | "offline"
  let missedHeartbeats = 0;
  let activeServerPort = null;
  let isPortMismatched = false;

  function updateConnUI(state, serverPort = null) {
    serverConnState = state;
    if (!connPill || !connText) return;

    connPill.className = `status-badge conn-${state}`;
    if (btnConnRetry) btnConnRetry.hidden = state !== "offline";

    if (state === "connected") {
      connText.textContent = "Connected";
      connPill.title = "Connected to local server";
      if (serverStatusBanner && !isPortMismatched) {
        serverStatusBanner.hidden = true;
      }
    } else if (state === "reconnecting") {
      connText.textContent = "Reconnecting…";
      connPill.title = "Attempting to reconnect to local server…";
    } else if (state === "offline") {
      connText.textContent = "Server offline";
      connPill.title = "Local server is offline. Click Retry now or run start.bat.";
      if (serverStatusBanner && !isPortMismatched) {
        serverStatusBanner.hidden = false;
        serverStatusBannerText.textContent = "Local server is offline. Run start.bat or click Retry now to reconnect.";
        serverStatusBannerActions.innerHTML = `<button id="btn-banner-retry" class="btn-primary-xs">Retry Now</button>`;
        const b = document.getElementById("btn-banner-retry");
        if (b) b.addEventListener("click", () => checkHeartbeat(true));
      }
    }

    // Check if the page port doesn't match the server's reported port
    if (serverPort && window.location.port && String(serverPort) !== window.location.port) {
      isPortMismatched = true;
      if (serverStatusBanner) {
        serverStatusBanner.hidden = false;
        serverStatusBannerText.innerHTML = `This page was opened on port <strong>:${window.location.port}</strong>, but the server is running on port <strong>:${serverPort}</strong>.`;
        serverStatusBannerActions.innerHTML = `<a href="http://127.0.0.1:${serverPort}" class="btn-primary-xs">Switch to Port ${serverPort}</a>`;
      }
    } else if (serverPort) {
      isPortMismatched = false;
    }
  }

  async function checkHeartbeat(isManual = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    try {
      const res = await fetch("/api/health", { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        activeServerPort = data.serverPort || null;

        // If recovered from offline/reconnecting, re-sync session and queue
        if (serverConnState !== "connected" || missedHeartbeats > 0) {
          await initSession();
          initSSE();
          loadQueue();
          loadHistory();
        }

        missedHeartbeats = 0;
        updateConnUI("connected", activeServerPort);
        return true;
      } else {
        throw new Error("HTTP " + res.status);
      }
    } catch {
      clearTimeout(timer);
      missedHeartbeats++;
      if (missedHeartbeats >= 2 || isManual) {
        updateConnUI("offline");
      } else {
        updateConnUI("reconnecting");
      }
      return false;
    }
  }

  if (btnConnRetry) {
    btnConnRetry.addEventListener("click", () => checkHeartbeat(true));
  }

  // Periodic heartbeat every 4 seconds
  setInterval(() => checkHeartbeat(false), 4000);

  // ── Session Token & Secure Fetch Wrapper ─────────────────────────────────────
  async function initSession() {
    try {
      const res = await fetch("/api/session-token");
      if (res.ok) {
        const data = await res.json();
        sessionToken = data.token || "";
      }
    } catch (err) {
      console.warn("Could not obtain session token:", err);
    }
  }

  async function apiFetch(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
      "X-Session-Token": sessionToken,
    };
    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }

    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (netErr) {
      updateConnUI("reconnecting");
      checkHeartbeat();
      throw netErr;
    }

    // Auto-recover if session token was invalidated by server restart
    if (res.status === 403) {
      const clone = res.clone();
      try {
        const errJson = await clone.json();
        if (errJson && errJson.error && errJson.error.toLowerCase().includes("session token")) {
          await initSession();
          headers["X-Session-Token"] = sessionToken;
          res = await fetch(url, { ...options, headers });
        }
      } catch {}
    }

    return res;
  }

  // ── Toast Notifications ──────────────────────────────────────────────────────
  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      toast.style.transition = "all 0.25s ease";
      setTimeout(() => toast.remove(), 250);
    }, 3800);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[m]);
  }

  // ── Web Audio Synthesizer (Chime) ────────────────────────────────────────────
  function playCompletionChime() {
    if (currentSettings && currentSettings.playChime === false) return;
    if (localStorage.getItem("yt_sound") === "false") return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.25); // G5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {}
  }

  // ── Theme Management ─────────────────────────────────────────────────────────
  function applyTheme(theme) {
    const effectiveTheme = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;

    document.documentElement.setAttribute("data-theme", effectiveTheme);
    const radio = document.querySelector(`input[name="theme-choice"][value="${theme}"]`);
    if (radio) radio.checked = true;
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (currentSettings.theme === "system") applyTheme("system");
  });

  // ── Tab Switching ────────────────────────────────────────────────────────────
  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      navTabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tabPanes.forEach((p) => {
        p.classList.remove("active");
        p.hidden = true;
      });

      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      const targetPane = document.getElementById(tab.dataset.tab);
      if (targetPane) {
        targetPane.classList.add("active");
        targetPane.hidden = false;
      }
    });
  });

  // ── Accessible Custom Select Component ───────────────────────────────────────
  function setupCustomSelect(selectEl, onChange) {
    const trigger = selectEl.querySelector(".select-trigger");
    const valueSpan = selectEl.querySelector(".select-value");
    const dropdown = selectEl.querySelector(".select-dropdown");
    if (!trigger || !dropdown) return;

    function open() {
      closeAllDropdowns();
      selectEl.classList.add("open");
      dropdown.setAttribute("aria-expanded", "true");
    }

    function close() {
      selectEl.classList.remove("open");
      dropdown.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      selectEl.classList.contains("open") ? close() : open();
    });

    dropdown.addEventListener("click", (e) => {
      const opt = e.target.closest(".select-option");
      if (!opt) return;
      dropdown.querySelectorAll(".select-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      valueSpan.textContent = opt.textContent;
      valueSpan.dataset.value = opt.dataset.value;
      close();
      if (onChange) onChange(opt.dataset.value, opt.textContent);
      triggerCommandPreviewUpdate();
    });

    // Keyboard navigation
    selectEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectEl.classList.contains("open") ? close() : open();
      } else if (e.key === "Escape") {
        close();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!selectEl.classList.contains("open")) {
          open();
          return;
        }
        const options = Array.from(dropdown.querySelectorAll(".select-option"));
        const currentIndex = options.findIndex((o) => o.classList.contains("selected"));
        let nextIndex = e.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex < 0) nextIndex = 0;
        if (nextIndex >= options.length) nextIndex = options.length - 1;
        const nextOpt = options[nextIndex];
        if (nextOpt) {
          options.forEach((o) => o.classList.remove("selected"));
          nextOpt.classList.add("selected");
          valueSpan.textContent = nextOpt.textContent;
          valueSpan.dataset.value = nextOpt.dataset.value;
          nextOpt.scrollIntoView({ block: "nearest" });
          if (onChange) onChange(nextOpt.dataset.value, nextOpt.textContent);
          triggerCommandPreviewUpdate();
        }
      }
    });
  }

  function getSelectValue(selectEl) {
    if (!selectEl) return "";
    const valSpan = selectEl.querySelector(".select-value");
    return valSpan ? (valSpan.dataset.value || "") : "";
  }

  function setSelectValue(selectEl, value) {
    const valueSpan = selectEl.querySelector(".select-value");
    const dropdown = selectEl.querySelector(".select-dropdown");
    const opt = dropdown.querySelector(`.select-option[data-value="${value}"]`);
    if (opt && valueSpan) {
      dropdown.querySelectorAll(".select-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      valueSpan.textContent = opt.textContent;
      valueSpan.dataset.value = opt.dataset.value;
    }
  }

  function closeAllDropdowns() {
    document.querySelectorAll(".custom-select.open, .custom-multiselect.open").forEach((el) => {
      el.classList.remove("open");
    });
  }

  document.addEventListener("click", () => closeAllDropdowns());

  // Subtitles Multiselect
  function setupSubtitlesMultiselect() {
    const trigger = selectSubtitles.querySelector(".multiselect-trigger");
    const dropdown = selectSubtitles.querySelector(".multiselect-dropdown");

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = selectSubtitles.classList.contains("open");
      closeAllDropdowns();
      if (!isOpen) selectSubtitles.classList.add("open");
    });

    dropdown.addEventListener("click", (e) => e.stopPropagation());

    dropdown.addEventListener("change", () => {
      updateSubtitlesDisplay();
      triggerCommandPreviewUpdate();
    });
  }

  function updateSubtitlesDisplay() {
    const checked = Array.from(subtitlesItemsList.querySelectorAll("input:checked")).map((i) => i.value);
    if (checked.length === 0) {
      subtitlesDisplay.textContent = "None";
    } else if (checked.length === 1) {
      subtitlesDisplay.textContent = checked[0].toUpperCase();
    } else {
      subtitlesDisplay.textContent = `${checked.length} Languages`;
    }
  }

  function populateSubtitlesList(availableLangs) {
    subtitlesItemsList.innerHTML = "";

    // Always include English default
    const allLangs = Array.from(new Set(["en", ...(availableLangs || [])]));

    allLangs.forEach((lang) => {
      const label = document.createElement("label");
      label.className = "multiselect-item";
      label.innerHTML = `
        <input type="checkbox" value="${escapeHtml(lang)}" ${lang === "en" ? "" : ""} />
        <span>${escapeHtml(lang.toUpperCase())}</span>
      `;
      subtitlesItemsList.appendChild(label);
    });
    updateSubtitlesDisplay();
  }

  // ── Context-Aware Form & Dropdowns ───────────────────────────────────────────
  function syncFormContext() {
    const type = getSelectValue(selectType);
    if (type === "audio_only") {
      fieldVideoQuality.hidden = true;
      fieldVideoContainer.hidden = true;
      if (fieldSubtitles) fieldSubtitles.hidden = true;
      if (optEmbedChapters) optEmbedChapters.hidden = true;
      if (optSaveThumb) optSaveThumb.hidden = true;
      fieldAudioFormat.hidden = false;
      fieldAudioQuality.hidden = false;
    } else if (type === "video_only") {
      fieldVideoQuality.hidden = false;
      fieldVideoContainer.hidden = false;
      if (fieldSubtitles) fieldSubtitles.hidden = false;
      if (optEmbedChapters) optEmbedChapters.hidden = false;
      if (optSaveThumb) optSaveThumb.hidden = false;
      fieldAudioFormat.hidden = true;
      fieldAudioQuality.hidden = true;
    } else {
      // video + audio
      fieldVideoQuality.hidden = false;
      fieldVideoContainer.hidden = false;
      if (fieldSubtitles) fieldSubtitles.hidden = false;
      if (optEmbedChapters) optEmbedChapters.hidden = false;
      if (optSaveThumb) optSaveThumb.hidden = false;
      fieldAudioFormat.hidden = true;
      fieldAudioQuality.hidden = true;
    }

    updateAddButtonLabel();
    updateEstimatedFileSize();
    syncPresetHighlight();
    triggerCommandPreviewUpdate();
  }

  // ── Preset / Dropdown Bidirectional Highlight Synchronization ───────────────
  function syncPresetHighlight() {
    const currentType = getSelectValue(selectType);
    const currentQuality = getSelectValue(selectQuality);
    const currentContainer = getSelectValue(selectContainer);
    const currentAudioFmt = getSelectValue(selectAudioFormat);
    const currentAudioQ = getSelectValue(selectAudioQuality);

    let matchedPreset = null;
    if (currentType === "video_audio" && currentContainer === "mp4") {
      if (currentQuality === "best") matchedPreset = "best";
      else if (currentQuality === "1080") matchedPreset = "1080";
      else if (currentQuality === "720") matchedPreset = "720";
    } else if (currentType === "audio_only" && currentAudioFmt === "mp3" && (currentAudioQ === "best" || currentAudioQ === "320")) {
      matchedPreset = "mp3";
    }

    document.querySelectorAll(".btn-preset").forEach((btn) => {
      if (btn.dataset.preset === matchedPreset) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  // ── Quick Presets Handlers ───────────────────────────────────────────────────
  document.querySelectorAll(".btn-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;

      if (preset === "best") {
        setSelectValue(selectType, "video_audio");
        setSelectValue(selectQuality, "best");
        setSelectValue(selectContainer, "mp4");
      } else if (preset === "1080") {
        setSelectValue(selectType, "video_audio");
        setSelectValue(selectQuality, "1080");
        setSelectValue(selectContainer, "mp4");
      } else if (preset === "720") {
        setSelectValue(selectType, "video_audio");
        setSelectValue(selectQuality, "720");
        setSelectValue(selectContainer, "mp4");
      } else if (preset === "mp3") {
        setSelectValue(selectType, "audio_only");
        setSelectValue(selectAudioFormat, "mp3");
        setSelectValue(selectAudioQuality, "best");
      }

      syncFormContext();
    });
  });

  // ── Byte / Size Formatting Helpers ───────────────────────────────────────────
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  // ── Estimated File Size Live Calculation ─────────────────────────────────────
  function computeEstimatedBytes(durationSec, type, quality, audioQuality) {
    if (!durationSec || durationSec <= 0) return 0;
    if (type === "audio_only") {
      let kbps = 192;
      if (audioQuality === "320") kbps = 320;
      else if (audioQuality === "128") kbps = 128;
      else if (audioQuality === "best") kbps = 256;
      return (kbps * 1000 / 8) * durationSec;
    }

    let kbps = 3800; // 1080p
    if (quality === "2160" || quality === "4k") kbps = 14000;
    else if (quality === "1440" || quality === "2k") kbps = 7500;
    else if (quality === "1080") kbps = 3800;
    else if (quality === "720") kbps = 2000;
    else if (quality === "480") kbps = 1000;
    else if (quality === "360") kbps = 600;
    else if (quality === "best") kbps = 4500;
    return (kbps * 1000 / 8) * durationSec;
  }

  function updatePlaylistEstimates() {
    if (!activePlaylistInfo || !playlistPreview || playlistPreview.hidden) return;
    const type = getSelectValue(selectType);
    const quality = getSelectValue(selectQuality);
    const audioQ = getSelectValue(selectAudioQuality);

    let totalSelectedBytes = 0;
    let selectedCount = 0;

    const items = playlistItemsList.querySelectorAll(".playlist-item");
    items.forEach((itemEl) => {
      const chk = itemEl.querySelector(".playlist-chk");
      const duration = parseInt(itemEl.dataset.duration || "0", 10);
      const estBytes = computeEstimatedBytes(duration, type, quality, audioQ);
      const sizeEl = itemEl.querySelector(".playlist-item-size");
      if (sizeEl) {
        sizeEl.textContent = estBytes > 0 ? `~${formatBytes(estBytes)}` : "--";
      }

      if (chk && chk.checked) {
        selectedCount++;
        totalSelectedBytes += estBytes;
      }
    });

    if (playlistCount) {
      if (selectedCount === 0) {
        playlistCount.textContent = "0 videos selected";
      } else {
        const totalStr = totalSelectedBytes > 0 ? ` • Est. Total: ~${formatBytes(totalSelectedBytes)}` : "";
        playlistCount.textContent = `${selectedCount} of ${activePlaylistInfo.itemCount} selected${totalStr}`;
      }
    }
  }

  function updateEstimatedFileSize() {
    updatePlaylistEstimates();
    if (!activeVideoInfo || !previewEstSize) return;

    const type = getSelectValue(selectType);
    const duration = activeVideoInfo.duration || 0;

    if (type === "audio_only") {
      const q = getSelectValue(selectAudioQuality);
      let kbps = 192;
      if (q === "320") kbps = 320;
      else if (q === "128") kbps = 128;
      else if (q === "192") kbps = 192;

      if (duration > 0) {
        const estBytes = (kbps * 1000 / 8) * duration;
        previewEstSize.textContent = `~${formatBytes(estBytes)} (Audio ${kbps} kbps)`;
      } else {
        previewEstSize.textContent = `~${kbps} kbps`;
      }
      return;
    }

    // Video + Audio or Video only
    const chosenQuality = getSelectValue(selectQuality);
    const quals = activeVideoInfo.availableQualities || [];

    let targetQ = null;
    if (chosenQuality === "best") {
      targetQ = quals.length > 0 ? quals[0] : null;
    } else {
      const h = parseInt(chosenQuality, 10);
      targetQ = quals.find((q) => q.height === h) || quals[0];
    }

    if (targetQ && targetQ.sizeBytes) {
      previewEstSize.textContent = `~${formatBytes(targetQ.sizeBytes)} (${targetQ.height}p)`;
    } else if (targetQ) {
      previewEstSize.textContent = `${targetQ.height}p`;
    } else {
      previewEstSize.textContent = "Best Available";
    }
  }

  // ── Contextual Dynamic Label on Primary Add Button ───────────────────────────
  function updateAddButtonLabel() {
    if (!btnAddText) return;

    if (!playlistPreview.hidden && activePlaylistInfo) {
      const checkedBoxes = playlistItemsList.querySelectorAll(".playlist-chk:checked");
      const count = checkedBoxes.length;
      btnAddText.textContent = count > 1 ? `Add ${count} Items to Queue` : (count === 1 ? "Add 1 Item to Queue" : "No Items Selected");
      return;
    }

    const raw = urlInput.value.trim();
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    const validLines = lines.filter((l) => isYouTubeUrl(l));
    const uniqueValid = Array.from(new Set(validLines));

    if (uniqueValid.length > 1) {
      btnAddText.textContent = `Add ${uniqueValid.length} Videos to Queue`;
      return;
    }

    const type = getSelectValue(selectType);
    if (type === "audio_only") {
      btnAddText.textContent = "Add Audio to Queue";
    } else if (type === "video_only") {
      btnAddText.textContent = "Add Video (Silent) to Queue";
    } else {
      btnAddText.textContent = "Add Video to Queue";
    }
  }

  // ── URL Textarea Auto-Grow & Per-Line Validation ─────────────────────────────
  function autoGrowUrlInput() {
    urlInput.style.height = "auto";
    const newH = Math.min(Math.max(urlInput.scrollHeight, 38), 220);
    urlInput.style.height = newH + "px";
  }

  function validateUrlLines() {
    autoGrowUrlInput();
    const raw = urlInput.value;
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

    if (lines.length === 0) {
      if (urlValidationList) {
        urlValidationList.hidden = true;
        urlValidationList.innerHTML = "";
      }
      if (previewPlaceholder) previewPlaceholder.hidden = false;
      videoPreview.hidden = true;
      playlistPreview.hidden = true;
      if (batchPreview) batchPreview.hidden = true;
      previewSkeleton.hidden = true;
      previewError.hidden = true;
      activeVideoInfo = null;
      activePlaylistInfo = null;
      batchVideoMap.clear();
      if (currentBatchFetchController) {
        currentBatchFetchController.abort();
      }
      updateAddButtonLabel();
      return;
    }

    // Duplicate detection and line validation
    const seen = new Set();
    const results = [];

    for (const line of lines) {
      const valid = isYouTubeUrl(line);
      const isDup = seen.has(line);
      if (valid && !isDup) {
        seen.add(line);
      }
      results.push({ url: line, valid, isDup });
    }

    if (lines.length > 1 && urlValidationList) {
      urlValidationList.hidden = false;
      urlValidationList.innerHTML = "";
      results.forEach((res, idx) => {
        const item = document.createElement("div");
        item.className = `url-validation-item ${res.isDup ? "duplicate" : res.valid ? "valid" : "invalid"}`;

        let icon = "✓";
        let badge = "Valid";
        if (res.isDup) {
          icon = "⚠";
          badge = "Duplicate";
        } else if (!res.valid) {
          icon = "✕";
          badge = "Invalid";
        }

        item.innerHTML = `
          <div class="url-val-left">
            <span class="url-val-icon">${icon}</span>
            <span class="url-val-text">Line ${idx + 1}: ${escapeHtml(res.url)}</span>
          </div>
          <span class="url-val-badge">${badge}</span>
        `;
        urlValidationList.appendChild(item);
      });
    } else if (urlValidationList) {
      urlValidationList.hidden = true;
    }

    updateAddButtonLabel();
  }

  // ── URL & Video Fetching ─────────────────────────────────────────────────────
  function isYouTubeUrl(str) {
    if (!str) return false;
    try {
      const u = new URL(str.trim());
      const host = u.hostname.toLowerCase();
      return host.includes("youtube.com") || host === "youtu.be";
    } catch {
      return false;
    }
  }

  function isPlaylistUrl(str) {
    if (!str) return false;
    try {
      const u = new URL(str.trim());
      return u.searchParams.has("list");
    } catch {
      return false;
    }
  }

  async function handleUrlInput() {
    const raw = urlInput.value.trim();
    if (!raw) {
      setPreviewMode("thumb");
      if (videoPreview) videoPreview.hidden = true;
      if (playlistPreview) playlistPreview.hidden = true;
      if (batchPreview) batchPreview.hidden = true;
      if (previewError) previewError.hidden = true;
      if (previewPlaceholder) previewPlaceholder.hidden = false;
      return;
    }

    const lines = raw.split("\n").map((l) => l.trim()).filter((l) => Boolean(l) && isYouTubeUrl(l));

    if (lines.length === 0) {
      setPreviewMode("thumb");
      if (videoPreview) videoPreview.hidden = true;
      if (playlistPreview) playlistPreview.hidden = true;
      if (batchPreview) batchPreview.hidden = true;
      if (previewError) previewError.hidden = true;
      if (previewPlaceholder) previewPlaceholder.hidden = false;
      return;
    }

    if (lines.length === 1) {
      const url = lines[0];
      if (batchPreview) batchPreview.hidden = true;
      if (isPlaylistUrl(url)) {
        fetchPlaylist(url);
      } else {
        fetchVideo(url);
      }
      return;
    }

    // Multiple valid YouTube URLs: Render Batch Preview Card
    if (previewPlaceholder) previewPlaceholder.hidden = true;
    if (previewSkeleton) previewSkeleton.hidden = true;
    if (videoPreview) videoPreview.hidden = true;
    if (playlistPreview) playlistPreview.hidden = true;
    if (previewError) previewError.hidden = true;
    if (batchPreview) batchPreview.hidden = false;

    renderBatchPreview(lines);
  }

  function renderBatchPreview(urls) {
    if (!batchPreviewList) return;
    if (batchPreviewTitle) batchPreviewTitle.textContent = "Batch Download";
    if (batchPreviewCount) batchPreviewCount.textContent = `${urls.length} videos queued`;

    batchPreviewList.innerHTML = "";

    urls.forEach((url, idx) => {
      const cached = batchVideoMap.get(url);
      const li = document.createElement("li");
      li.className = "batch-preview-item";
      li.dataset.url = url;

      let thumbHtml = "";
      if (cached && cached.thumbnail) {
        thumbHtml = `<img class="batch-item-thumb" src="${escapeHtml(cached.thumbnail)}" alt="Thumb" />`;
      } else {
        thumbHtml = `<div class="batch-item-thumb-placeholder">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>`;
      }

      const titleText = cached && cached.title ? cached.title : "Fetching video details…";
      const metaText = cached
        ? `${cached.uploader ? escapeHtml(cached.uploader) + " • " : ""}${formatDuration(cached.duration)}`
        : escapeHtml(url.length > 50 ? url.substring(0, 48) + "…" : url);

      li.innerHTML = `
        <span class="batch-item-index">${idx + 1}</span>
        ${thumbHtml}
        <div class="batch-item-info">
          <span class="batch-item-title">${escapeHtml(titleText)}</span>
          <span class="batch-item-meta">${metaText}</span>
        </div>
      `;
      batchPreviewList.appendChild(li);
    });

    fetchBatchVideoInfo(urls);
  }

  function updateBatchItemUI(url, data) {
    if (!batchPreviewList) return;
    const items = batchPreviewList.querySelectorAll(".batch-preview-item");
    for (const item of items) {
      if (item.dataset.url === url) {
        if (data && data.title) {
          const titleEl = item.querySelector(".batch-item-title");
          const metaEl = item.querySelector(".batch-item-meta");
          if (titleEl) titleEl.textContent = data.title;
          if (metaEl) {
            metaEl.textContent = `${data.uploader ? data.uploader + " • " : ""}${formatDuration(data.duration)}`;
          }

          if (data.thumbnail) {
            const placeholder = item.querySelector(".batch-item-thumb-placeholder");
            if (placeholder) {
              const img = document.createElement("img");
              img.className = "batch-item-thumb";
              img.src = data.thumbnail;
              img.alt = "Thumb";
              placeholder.replaceWith(img);
            }
          }
        }
        break;
      }
    }
  }

  async function fetchBatchVideoInfo(urls) {
    if (currentBatchFetchController) {
      currentBatchFetchController.abort();
    }
    currentBatchFetchController = new AbortController();
    const signal = currentBatchFetchController.signal;

    const toFetch = urls.filter((u) => !batchVideoMap.has(u));
    if (toFetch.length === 0) return;

    const chunkSize = 2;
    for (let i = 0; i < toFetch.length; i += chunkSize) {
      if (signal.aborted) break;
      const chunk = toFetch.slice(i, i + chunkSize);
      await Promise.allSettled(
        chunk.map(async (u) => {
          if (signal.aborted) return;
          try {
            const res = await apiFetch(`/api/info?url=${encodeURIComponent(u)}`, { signal });
            if (res.ok) {
              const data = await res.json();
              batchVideoMap.set(u, data);
              updateBatchItemUI(u, data);
            } else {
              batchVideoMap.set(u, { title: "YouTube Video", thumbnail: "", uploader: "", duration: 0 });
            }
          } catch {
            if (!signal.aborted) {
              batchVideoMap.set(u, { title: "YouTube Video", thumbnail: "", uploader: "", duration: 0 });
            }
          }
        })
      );
    }
  }

  urlInput.addEventListener("input", () => {
    validateUrlLines();
    clearTimeout(fetchDebounceTimer);
    fetchDebounceTimer = setTimeout(handleUrlInput, 500);
    triggerCommandPreviewUpdate();
  });

  btnFetch.addEventListener("click", () => {
    validateUrlLines();
    handleUrlInput();
  });

  btnPaste.addEventListener("click", async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        urlInput.value = clip.trim();
        validateUrlLines();
        handleUrlInput();
      }
    } catch {
      urlInput.focus();
    }
  });

  async function fetchVideo(url) {
    if (previewPlaceholder) previewPlaceholder.hidden = true;
    previewSkeleton.hidden = false;
    videoPreview.hidden = true;
    playlistPreview.hidden = true;
    if (batchPreview) batchPreview.hidden = true;
    previewError.hidden = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await apiFetch(`/api/info?url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Server returned an invalid response.");
      }

      previewSkeleton.hidden = true;

      if (!res.ok) {
        if (previewPlaceholder) previewPlaceholder.hidden = true;
        previewError.hidden = false;
        previewErrorMsg.textContent = data.error || "Failed to load video info.";
        return;
      }

      activeVideoInfo = data;
      previewTitle.textContent = data.title;
      previewAuthor.textContent = data.uploader;
      previewViews.textContent = formatViews(data.viewCount);
      previewDuration.textContent = formatDuration(data.duration);
      previewDate.textContent = formatDate(data.uploadDate);
      if (data.thumbnail) previewThumb.src = data.thumbnail;

      // Populate Qualities Chips & Filter Quality Dropdown
      previewQualitiesList.innerHTML = "";
      dropdownQualityOptions.innerHTML = '<li class="select-option selected" data-value="best" role="option">Best Quality</li>';

      if (Array.isArray(data.availableQualities) && data.availableQualities.length > 0) {
        data.availableQualities.forEach((q) => {
          const chip = document.createElement("span");
          chip.className = "quality-chip";
          chip.textContent = `${q.height}p${q.sizeStr ? ` (${q.sizeStr})` : ""}`;
          previewQualitiesList.appendChild(chip);

          const li = document.createElement("li");
          li.className = "select-option";
          li.dataset.value = q.height.toString();
          li.textContent = `${q.height}p ${q.sizeStr ? `(~${q.sizeStr})` : ""}`;
          dropdownQualityOptions.appendChild(li);
        });
      }

      // Populate Subtitles
      populateSubtitlesList(data.availableSubtitles);

      // Set metadata placeholders to current video info
      if (metaTitle) {
        metaTitle.placeholder = data.title || "Custom title (optional)";
      }
      if (metaArtist) {
        metaArtist.placeholder = data.uploader || "Custom channel / artist (optional)";
      }

      // Update clip timeline sliders with duration
      if (data.duration && clipSliderStart && clipSliderEnd) {
        clipSliderStart.max = data.duration;
        clipSliderEnd.max = data.duration;
        clipSliderStart.value = 0;
        clipSliderEnd.value = data.duration;
        if (clipStart) clipStart.value = "00:00";
        if (clipEnd) clipEnd.value = formatDuration(data.duration);
        updateDualSliderUI();
      }
      checkClipBadge();
      setPreviewMode("thumb");

      if (previewPlaceholder) previewPlaceholder.hidden = true;
      videoPreview.hidden = false;
      updateEstimatedFileSize();
      updateAddButtonLabel();
      updateLiveFilenamePreview();
      triggerCommandPreviewUpdate();
    } catch (err) {
      clearTimeout(timeoutId);
      previewSkeleton.hidden = true;
      if (previewPlaceholder) previewPlaceholder.hidden = true;
      previewError.hidden = false;

      console.error("fetchVideo failed:", err);

      if (err.name === "AbortError") {
        previewErrorMsg.textContent = "Request timed out after 25s while fetching video details.";
      } else if (serverConnState === "offline") {
        previewErrorMsg.textContent = "Local server is offline. Run start.bat to start the server.";
      } else if (err.name === "TypeError" && err.message.toLowerCase().includes("fetch")) {
        previewErrorMsg.textContent = `Network error connecting to local server (${window.location.origin}). Check if the server is running.`;
      } else {
        previewErrorMsg.textContent = err.message || "Failed to retrieve video information.";
      }
    }
  }

  async function fetchPlaylist(url) {
    if (previewPlaceholder) previewPlaceholder.hidden = true;
    previewSkeleton.hidden = false;
    videoPreview.hidden = true;
    playlistPreview.hidden = true;
    if (batchPreview) batchPreview.hidden = true;
    previewError.hidden = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await apiFetch(`/api/playlist?url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Server returned an invalid response.");
      }

      previewSkeleton.hidden = true;

      if (!res.ok) {
        if (previewPlaceholder) previewPlaceholder.hidden = true;
        previewError.hidden = false;
        previewErrorMsg.textContent = data.error || "Failed to load playlist.";
        return;
      }

      activePlaylistInfo = data;
      playlistTitle.textContent = data.title;
      playlistCount.textContent = `${data.itemCount} videos`;
      playlistItemsList.innerHTML = "";

      const type = getSelectValue(selectType);
      const quality = getSelectValue(selectQuality);
      const audioQ = getSelectValue(selectAudioQuality);

      data.items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "playlist-item";
        li.dataset.duration = (item.duration || 0).toString();

        const estBytes = computeEstimatedBytes(item.duration, type, quality, audioQ);
        const estStr = estBytes > 0 ? `~${formatBytes(estBytes)}` : "--";

        li.innerHTML = `
          <input type="checkbox" class="playlist-chk" data-url="${escapeHtml(item.url)}" data-title="${escapeHtml(item.title)}" data-thumb="${escapeHtml(item.thumbnail)}" data-duration="${item.duration || 0}" checked />
          ${item.thumbnail ? `<img class="playlist-item-thumb" src="${escapeHtml(item.thumbnail)}" alt="" onerror="this.style.display='none'" />` : `<div class="playlist-item-thumb-placeholder"></div>`}
          <span class="playlist-item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
          <span class="playlist-item-size" title="Estimated download size">${estStr}</span>
          <span class="playlist-item-duration">${formatDuration(item.duration)}</span>
        `;
        playlistItemsList.appendChild(li);
      });

      playlistRangeEnd.placeholder = data.itemCount.toString();
      if (previewPlaceholder) previewPlaceholder.hidden = true;
      playlistPreview.hidden = false;
      updatePlaylistEstimates();
      updateAddButtonLabel();
      triggerCommandPreviewUpdate();
    } catch (err) {
      clearTimeout(timeoutId);
      previewSkeleton.hidden = true;
      if (previewPlaceholder) previewPlaceholder.hidden = true;
      previewError.hidden = false;

      console.error("fetchPlaylist failed:", err);

      if (err.name === "AbortError") {
        previewErrorMsg.textContent = "Request timed out after 35s while fetching playlist details.";
      } else if (serverConnState === "offline") {
        previewErrorMsg.textContent = "Local server is offline. Run start.bat to start the server.";
      } else if (err.name === "TypeError" && err.message.toLowerCase().includes("fetch")) {
        previewErrorMsg.textContent = `Network error connecting to local server (${window.location.origin}). Check if the server is running.`;
      } else {
        previewErrorMsg.textContent = err.message || "Failed to load playlist.";
      }
    }
  }

  // Playlist Controls
  playlistItemsList.addEventListener("change", () => {
    updatePlaylistEstimates();
    updateAddButtonLabel();
  });

  btnPlaylistSelectAll.addEventListener("click", () => {
    playlistItemsList.querySelectorAll(".playlist-chk").forEach((c) => (c.checked = true));
    updatePlaylistEstimates();
    updateAddButtonLabel();
  });

  btnPlaylistSelectNone.addEventListener("click", () => {
    playlistItemsList.querySelectorAll(".playlist-chk").forEach((c) => (c.checked = false));
    updatePlaylistEstimates();
    updateAddButtonLabel();
  });

  btnPlaylistApplyRange.addEventListener("click", () => {
    const start = parseInt(playlistRangeStart.value, 10) || 1;
    const end = parseInt(playlistRangeEnd.value, 10) || 9999;
    const checkboxes = Array.from(playlistItemsList.querySelectorAll(".playlist-chk"));
    checkboxes.forEach((c, idx) => {
      const num = idx + 1;
      c.checked = num >= start && num <= end;
    });
    updatePlaylistEstimates();
    updateAddButtonLabel();
    showToast(`Selected items ${start} to ${end}`, "info");
  });

  // Toggle SponsorBlock visibility
  chkSponsorblock.addEventListener("change", () => {
    sponsorblockCategories.hidden = !chkSponsorblock.checked;
    triggerCommandPreviewUpdate();
  });

  // ── Gather Current Form Download Options ─────────────────────────────────────
  function getSelectedOptions() {
    const type = selectType.querySelector(".select-value").dataset.value || "video_audio";
    const quality = selectQuality.querySelector(".select-value").dataset.value || "best";
    const container = selectContainer.querySelector(".select-value").dataset.value || "mp4";
    const audioFormat = selectAudioFormat.querySelector(".select-value").dataset.value || "mp3";
    const audioQuality = selectAudioQuality.querySelector(".select-value").dataset.value || "best";

    const subMode = document.querySelector('input[name="sub-mode"]:checked')?.value || "embed";
    const subLangs = Array.from(subtitlesItemsList.querySelectorAll("input:checked")).map((i) => i.value);

    const sbCategories = Array.from(sponsorblockCategories.querySelectorAll("input:checked")).map((i) => i.value);

    const clipActive = isClipActive();
    const cStart = clipActive && clipStart && clipStart.value.trim() ? clipStart.value.trim() : null;
    const cEnd = clipActive && clipEnd && clipEnd.value.trim() ? clipEnd.value.trim() : null;

    return {
      type,
      quality,
      container,
      audioFormat,
      audioQuality,
      subtitlesMode: subMode,
      subLangs,
      embedThumbnail: chkEmbedThumb.checked,
      embedMetadata: chkEmbedMeta.checked,
      embedChapters: chkEmbedChapters.checked,
      saveThumbnailImage: chkSaveThumb.checked,
      sponsorBlock: chkSponsorblock.checked,
      sponsorBlockCategories: sbCategories,
      clipStart: cStart,
      clipEnd: cEnd,
      audioNormalize: chkAudioNormalize ? chkAudioNormalize.checked : false,
      metaTitle: metaTitle && metaTitle.value.trim() ? metaTitle.value.trim() : null,
      metaArtist: metaArtist && metaArtist.value.trim() ? metaArtist.value.trim() : null,
      metaAlbum: metaAlbum && metaAlbum.value.trim() ? metaAlbum.value.trim() : null,
      customFilename: inputCustomFilename && inputCustomFilename.value.trim() ? inputCustomFilename.value.trim() : null,
      isPlaylist: false,
      numberFiles: chkPlaylistNumbering.checked,
      folderPerPlaylist: chkPlaylistSubfolder.checked,
    };
  }

  // ── Smart Live Filename Preview ──────────────────────────────────────────────
  function updateLiveFilenamePreview() {
    if (!lblLiveFilename) return;
    const tpl = currentSettings.filenameTemplate || "%(title)s.%(ext)s";
    const type = getSelectValue(selectType);
    const ext = type === "audio_only" ? getSelectValue(selectAudioFormat) : getSelectValue(selectContainer);
    const title = (metaTitle && metaTitle.value.trim()) || (activeVideoInfo ? activeVideoInfo.title : "YouTube Video Title");
    const id = activeVideoInfo ? activeVideoInfo.id : "dQw4w9WgXcQ";
    const channel = (metaArtist && metaArtist.value.trim()) || (activeVideoInfo ? activeVideoInfo.uploader : "Channel");

    const customName = inputCustomFilename ? inputCustomFilename.value.trim() : "";
    if (btnClearCustomFilename) {
      btnClearCustomFilename.hidden = !customName;
    }

    if (customName) {
      // Strip trailing extension if entered by user, as yt-dlp container controls the extension
      const clean = customName.replace(/\.(mp4|mkv|webm|mp3|m4a|opus|flac|wav)$/i, "");
      lblLiveFilename.textContent = `${clean}.${ext || "mp4"}`;
      return;
    }

    let preview = tpl
      .replace(/%\(title\)(?:\.?\d*B|s)?/g, title)
      .replace(/%\(id\)s?/g, id)
      .replace(/%\(uploader\)s?/g, channel)
      .replace(/%\(channel\)s?/g, channel)
      .replace(/%\(ext\)s?/g, ext || "mp4")
      .replace(/%\(playlist_title\)s?/g, "Playlist")
      .replace(/%\(playlist_index\)(?:02d|s)?/g, "01");

    lblLiveFilename.textContent = preview;
  }

  // ── Clip / Trim Timeline Sliders & Inputs ────────────────────────────────────
  function parseDurationToSeconds(str) {
    if (!str || typeof str !== "string") return 0;
    const parts = str.trim().split(":").map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  function isClipActive() {
    if (!clipStart || !clipEnd) return false;
    const sVal = clipStart.value.trim();
    const eVal = clipEnd.value.trim();
    if (!sVal && !eVal) return false;

    const startSec = parseDurationToSeconds(sVal);
    if (startSec > 0) return true;

    if (activeVideoInfo && activeVideoInfo.duration) {
      const endSec = parseDurationToSeconds(eVal);
      if (endSec > 0 && endSec < activeVideoInfo.duration - 1) return true;
    } else if (eVal && eVal !== "inf" && eVal !== "") {
      return true;
    }

    return false;
  }

  function checkClipBadge() {
    if (clipActiveBadge) clipActiveBadge.hidden = !isClipActive();
  }

  function updateDualSliderUI() {
    if (!clipSliderStart || !clipSliderEnd) return;
    const maxVal = parseFloat(clipSliderStart.max) || 100;
    const sVal = parseFloat(clipSliderStart.value) || 0;
    const eVal = parseFloat(clipSliderEnd.value) || maxVal;

    if (clipRangeHighlight && maxVal > 0) {
      const leftPct = (sVal / maxVal) * 100;
      const rightPct = (eVal / maxVal) * 100;
      clipRangeHighlight.style.left = `${leftPct}%`;
      clipRangeHighlight.style.width = `${Math.max(0, rightPct - leftPct)}%`;
    }

    if (clipDurationText) {
      const diffSec = Math.max(0, Math.round(eVal - sVal));
      if (sVal === 0 && (eVal >= maxVal || Math.abs(eVal - maxVal) < 1)) {
        clipDurationText.textContent = `Full Video (${formatDuration(diffSec)})`;
      } else {
        clipDurationText.textContent = `${formatDuration(diffSec)} (${formatDuration(sVal)} → ${formatDuration(eVal)})`;
      }
    }

    if (playerClipRangeText) {
      const duration = activeVideoInfo ? activeVideoInfo.duration : 0;
      if (sVal > 0 || (eVal > 0 && eVal < duration)) {
        playerClipRangeText.textContent = `${formatDuration(sVal)} → ${eVal > 0 ? formatDuration(eVal) : "End"}`;
      } else {
        playerClipRangeText.textContent = `Full Video (${formatDuration(duration || 0)})`;
      }
    }
  }

  function getActiveVideoId() {
    if (activeVideoInfo && activeVideoInfo.id) return activeVideoInfo.id;
    const raw = urlInput ? urlInput.value.trim().split("\n")[0].trim() : "";
    if (!raw) return null;
    try {
      const u = new URL(raw);
      if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
      return u.searchParams.get("v");
    } catch {
      return null;
    }
  }

  let activePreviewMode = "thumb";
  let playerPollInterval = null;
  let isResettingToStart = false;
  let resetCooldownTimer = null;

  function postYouTubeCommand(func, args = []) {
    if (!previewIframe || !previewIframe.contentWindow) return;
    try {
      previewIframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: func,
          args: args
        }),
        "*"
      );
    } catch {}
  }

  function sendYouTubeListening() {
    if (!previewIframe || !previewIframe.contentWindow) return;
    try {
      previewIframe.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "*");
      previewIframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }),
        "*"
      );
    } catch {}
  }

  function startPlayerPolling() {
    stopPlayerPolling();
    sendYouTubeListening();
    playerPollInterval = setInterval(() => {
      if (activePreviewMode === "player") {
        sendYouTubeListening();
      } else {
        stopPlayerPolling();
      }
    }, 400);
  }

  function stopPlayerPolling() {
    if (playerPollInterval) {
      clearInterval(playerPollInterval);
      playerPollInterval = null;
    }
  }

  function handleYouTubeWindowMessage(event) {
    if (!previewIframe || activePreviewMode !== "player") return;
    let data = event.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (!data || typeof data !== "object") return;

    const startSec = parseDurationToSeconds(clipStart ? clipStart.value : "0") || 0;
    const endSec = parseDurationToSeconds(clipEnd ? clipEnd.value : "");
    const duration = activeVideoInfo ? activeVideoInfo.duration : 0;
    const hasCustomEnd = endSec > 0 && (!duration || endSec < duration);
    const targetEnd = hasCustomEnd ? endSec : (duration > 0 ? duration : 0);

    // 1. YouTube Player State Change: 0 = ENDED
    if (data.event === "onStateChange" && data.info === 0) {
      if (!isResettingToStart) {
        isResettingToStart = true;
        postYouTubeCommand("pauseVideo");
        postYouTubeCommand("seekTo", [startSec, true]);
        clearTimeout(resetCooldownTimer);
        resetCooldownTimer = setTimeout(() => {
          isResettingToStart = false;
        }, 800);
      }
      return;
    }

    // 2. Playback progress via infoDelivery
    if (data.info && typeof data.info.currentTime === "number") {
      const curTime = data.info.currentTime;
      if (isResettingToStart) {
        if (Math.abs(curTime - startSec) < 1.0) {
          isResettingToStart = false;
        }
        return;
      }

      if (targetEnd > 0 && targetEnd > startSec && curTime >= targetEnd) {
        isResettingToStart = true;
        postYouTubeCommand("pauseVideo");
        postYouTubeCommand("seekTo", [startSec, true]);
        clearTimeout(resetCooldownTimer);
        resetCooldownTimer = setTimeout(() => {
          isResettingToStart = false;
        }, 800);
      }
    }
  }

  function setPreviewMode(mode, autoplay = false) {
    activePreviewMode = mode;
    const isPlayer = mode === "player";

    if (btnPreviewModeThumb) {
      btnPreviewModeThumb.classList.toggle("active", !isPlayer);
      btnPreviewModeThumb.setAttribute("aria-selected", !isPlayer ? "true" : "false");
    }
    if (btnPreviewModePlayer) {
      btnPreviewModePlayer.classList.toggle("active", isPlayer);
      btnPreviewModePlayer.setAttribute("aria-selected", isPlayer ? "true" : "false");
    }
    if (previewThumbContainer) previewThumbContainer.hidden = isPlayer;
    if (previewPlayerContainer) previewPlayerContainer.hidden = !isPlayer;
    if (btnSyncPlayerCut) btnSyncPlayerCut.hidden = !isPlayer;

    if (isPlayer) {
      loadPreviewPlayerIframe(autoplay);
      startPlayerPolling();
    } else {
      stopPlayerPolling();
      if (previewIframe) previewIframe.src = "";
    }
  }

  function loadPreviewPlayerIframe(autoplay = true) {
    const videoId = getActiveVideoId();
    if (!videoId || !previewIframe) return;

    const startSec = parseDurationToSeconds(clipStart ? clipStart.value : "0");
    const duration = activeVideoInfo ? activeVideoInfo.duration : 0;
    const endSec = parseDurationToSeconds(clipEnd ? clipEnd.value : "");

    let embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&rel=0&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`;
    if (startSec > 0) {
      embedUrl += `&start=${Math.floor(startSec)}`;
    }
    if (endSec > 0 && (!duration || endSec < duration)) {
      embedUrl += `&end=${Math.floor(endSec)}`;
    }
    if (autoplay) {
      embedUrl += `&autoplay=1`;
    }

    previewIframe.src = embedUrl;

    if (playerClipRangeText) {
      if (startSec > 0 || (endSec > 0 && endSec < duration)) {
        playerClipRangeText.textContent = `${formatDuration(startSec)} → ${endSec > 0 ? formatDuration(endSec) : "End"}`;
      } else {
        playerClipRangeText.textContent = `Full Video (${formatDuration(duration || 0)})`;
      }
    }
  }

  function setupClipControls() {
    if (!clipSliderStart || !clipSliderEnd) return;

    clipSliderStart.addEventListener("input", () => {
      let sVal = parseFloat(clipSliderStart.value) || 0;
      let eVal = parseFloat(clipSliderEnd.value) || 0;
      if (sVal > eVal) {
        clipSliderStart.value = eVal;
        sVal = eVal;
      }
      clipSliderStart.style.zIndex = "4";
      clipSliderEnd.style.zIndex = "3";
      if (clipStart) clipStart.value = formatDuration(sVal);
      updateDualSliderUI();
      checkClipBadge();
      triggerCommandPreviewUpdate();
    });

    clipSliderEnd.addEventListener("input", () => {
      let sVal = parseFloat(clipSliderStart.value) || 0;
      let eVal = parseFloat(clipSliderEnd.value) || 0;
      if (eVal < sVal) {
        clipSliderEnd.value = sVal;
        eVal = sVal;
      }
      clipSliderEnd.style.zIndex = "4";
      clipSliderStart.style.zIndex = "3";
      if (clipEnd) clipEnd.value = formatDuration(eVal);
      updateDualSliderUI();
      checkClipBadge();
      triggerCommandPreviewUpdate();
    });

    if (clipStart) {
      clipStart.addEventListener("input", () => {
        const sSec = parseDurationToSeconds(clipStart.value);
        const maxVal = parseFloat(clipSliderStart.max) || 100;
        const eVal = parseFloat(clipSliderEnd.value) || maxVal;
        if (!isNaN(sSec) && sSec >= 0 && sSec <= eVal) {
          clipSliderStart.value = sSec;
          updateDualSliderUI();
        }
        checkClipBadge();
        triggerCommandPreviewUpdate();
      });
    }

    if (clipEnd) {
      clipEnd.addEventListener("input", () => {
        const eSec = parseDurationToSeconds(clipEnd.value);
        const maxVal = parseFloat(clipSliderEnd.max) || 100;
        const sVal = parseFloat(clipSliderStart.value) || 0;
        if (!isNaN(eSec) && eSec >= sVal && eSec <= maxVal) {
          clipSliderEnd.value = eSec;
          updateDualSliderUI();
        }
        checkClipBadge();
        triggerCommandPreviewUpdate();
      });
    }

    if (btnResetClip) {
      btnResetClip.addEventListener("click", () => {
        const maxVal = activeVideoInfo && activeVideoInfo.duration ? activeVideoInfo.duration : 100;
        if (clipSliderStart) clipSliderStart.value = 0;
        if (clipSliderEnd) clipSliderEnd.value = maxVal;
        if (clipStart) clipStart.value = "00:00";
        if (clipEnd) clipEnd.value = formatDuration(maxVal);
        updateDualSliderUI();
        checkClipBadge();
        triggerCommandPreviewUpdate();
        if (activePreviewMode === "player") {
          loadPreviewPlayerIframe(true);
        }
      });
    }

    // Video Preview Player controls
    if (btnPreviewModeThumb) {
      btnPreviewModeThumb.addEventListener("click", () => setPreviewMode("thumb"));
    }
    if (btnPreviewModePlayer) {
      btnPreviewModePlayer.addEventListener("click", () => setPreviewMode("player", true));
    }
    if (btnThumbQuickPlay) {
      btnThumbQuickPlay.addEventListener("click", () => setPreviewMode("player", true));
    }
    if (btnPreviewCut) {
      btnPreviewCut.addEventListener("click", () => {
        if (videoPreview) videoPreview.hidden = false;
        setPreviewMode("player", true);
      });
    }
    if (btnSyncPlayerCut) {
      btnSyncPlayerCut.addEventListener("click", () => loadPreviewPlayerIframe(true));
    }

    if (previewIframe) {
      previewIframe.addEventListener("load", () => {
        sendYouTubeListening();
      });
    }
    window.addEventListener("message", handleYouTubeWindowMessage);

    updateDualSliderUI();
  }

  // ── Custom Presets Manager ───────────────────────────────────────────────────
  const CUSTOM_PRESETS_KEY = "ytdl_custom_presets_v1";

  function getStoredCustomPresets() {
    try {
      const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveStoredCustomPresets(presets) {
    try {
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
    } catch {}
  }

  function renderCustomPresets() {
    if (!customPresetsList) return;
    customPresetsList.innerHTML = "";
    const presets = getStoredCustomPresets();

    presets.forEach((p, idx) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "btn-preset-custom";
      pill.dataset.presetId = p.id;
      pill.innerHTML = `
        <span>${escapeHtml(p.name)}</span>
        <span class="preset-del-btn" title="Delete preset" data-delete-idx="${idx}">✕</span>
      `;

      pill.addEventListener("click", (e) => {
        if (e.target.classList.contains("preset-del-btn")) {
          e.stopPropagation();
          deleteCustomPreset(idx);
          return;
        }
        applyCustomPreset(p);
      });

      customPresetsList.appendChild(pill);
    });
  }

  function applyCustomPreset(p) {
    if (!p) return;
    document.querySelectorAll(".btn-preset, .btn-preset-custom").forEach((b) => b.classList.remove("active"));
    const matchBtn = customPresetsList.querySelector(`[data-preset-id="${p.id}"]`);
    if (matchBtn) matchBtn.classList.add("active");

    if (p.type) setSelectValue(selectType, p.type);
    if (p.quality) setSelectValue(selectQuality, p.quality);
    if (p.container) setSelectValue(selectContainer, p.container);
    if (p.audioFormat) setSelectValue(selectAudioFormat, p.audioFormat);
    if (p.audioQuality) setSelectValue(selectAudioQuality, p.audioQuality);

    if (typeof p.embedThumbnail === "boolean") chkEmbedThumb.checked = p.embedThumbnail;
    if (typeof p.embedMetadata === "boolean") chkEmbedMeta.checked = p.embedMetadata;
    if (typeof p.embedChapters === "boolean") chkEmbedChapters.checked = p.embedChapters;
    if (typeof p.saveThumbnailImage === "boolean") chkSaveThumb.checked = p.saveThumbnailImage;
    if (typeof p.sponsorBlock === "boolean") chkSponsorblock.checked = p.sponsorBlock;
    if (typeof p.audioNormalize === "boolean" && chkAudioNormalize) chkAudioNormalize.checked = p.audioNormalize;

    syncFormContext();
    showToast(`Applied preset: ${p.name}`, "info");
  }

  function deleteCustomPreset(index) {
    const list = getStoredCustomPresets();
    const removed = list.splice(index, 1);
    saveStoredCustomPresets(list);
    renderCustomPresets();
    syncPresetHighlight();
    if (removed.length > 0) showToast(`Deleted preset "${removed[0].name}"`, "info");
  }

  function setupCustomPresets() {
    renderCustomPresets();

    if (btnSavePreset) {
      btnSavePreset.addEventListener("click", () => {
        savePresetModal.hidden = false;
        inputPresetName.value = "";
        inputPresetName.focus();
      });
    }

    if (btnCloseSavePreset) {
      btnCloseSavePreset.addEventListener("click", () => (savePresetModal.hidden = true));
    }
    if (btnCancelSavePreset) {
      btnCancelSavePreset.addEventListener("click", () => (savePresetModal.hidden = true));
    }

    if (btnConfirmSavePreset) {
      btnConfirmSavePreset.addEventListener("click", () => {
        const name = inputPresetName.value.trim();
        if (!name) {
          showToast("Please enter a preset name.", "error");
          return;
        }

        const opts = getSelectedOptions();
        const newPreset = {
          id: "custom_" + Date.now(),
          name,
          ...opts,
        };

        const list = getStoredCustomPresets();
        list.push(newPreset);
        saveStoredCustomPresets(list);
        renderCustomPresets();
        savePresetModal.hidden = true;
        showToast(`Preset "${name}" saved!`, "success");
      });
    }
  }


  // ── Duplicate Detection Modal Helper ─────────────────────────────────────────
  function checkUrlInHistory(url) {
    if (!historyItems || historyItems.length === 0) return null;
    let vidId = null;
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") vidId = u.pathname.slice(1);
      else vidId = u.searchParams.get("v");
    } catch {}

    return historyItems.find((h) => {
      if (vidId && h.id === vidId) return true;
      if (h.url && h.url === url) return true;
      return false;
    });
  }

  function promptDuplicateDownload(matchedItem, onConfirm) {
    if (!duplicateConfirmModal) {
      onConfirm();
      return;
    }

    const dateStr = matchedItem.completedAt ? new Date(matchedItem.completedAt).toLocaleDateString() : "previously";
    dupModalMsg.textContent = `"${matchedItem.title || 'This video'}" was already downloaded on ${dateStr}. Would you like to download it again or skip?`;
    duplicateConfirmModal.hidden = false;

    btnConfirmDup.onclick = () => {
      duplicateConfirmModal.hidden = true;
      onConfirm();
    };

    btnSkipDup.onclick = () => {
      duplicateConfirmModal.hidden = true;
      showToast("Skipped already downloaded video", "info");
    };

    btnCloseDup.onclick = () => {
      duplicateConfirmModal.hidden = true;
    };
  }

  // ── Advanced Command Preview (Removed per user request) ───────────────────────
  function triggerCommandPreviewUpdate() {}

  // ── Add to Queue (Single or Multiple URLs) ────────────────────────────────────
  btnAddQueue.addEventListener("click", async () => {
    const rawText = urlInput.value.trim();
    if (!rawText) {
      showToast("Please enter a YouTube video or playlist link.", "error");
      return;
    }

    const opts = getSelectedOptions();

    // Check if downloading from active playlist selector
    if (!playlistPreview.hidden && activePlaylistInfo) {
      const checkedBoxes = Array.from(playlistItemsList.querySelectorAll(".playlist-chk:checked"));
      if (checkedBoxes.length === 0) {
        showToast("No videos selected from the playlist.", "error");
        return;
      }

      const playlistItemsPayload = checkedBoxes.map((c) => ({
        url: c.dataset.url,
        title: c.dataset.title,
        thumbnail: c.dataset.thumb,
        options: { ...opts, isPlaylist: false },
      }));

      try {
        const res = await apiFetch("/api/queue/add", {
          method: "POST",
          body: { items: playlistItemsPayload },
        });
        if (res.ok) {
          showToast(`Added ${checkedBoxes.length} playlist videos to the queue!`, "success");
          urlInput.value = "";
          validateUrlLines();
          playlistPreview.hidden = true;
          activePlaylistInfo = null;
          if (previewPlaceholder) previewPlaceholder.hidden = false;
          switchToQueueTab();
        }
      } catch (err) {
        showToast("Error adding playlist items to queue: " + err.message, "error");
      }
      return;
    }

    // Handle single or multi-line URLs
    const lines = rawText.split("\n").map((l) => l.trim()).filter((l) => isYouTubeUrl(l));

    if (lines.length === 0) {
      showToast("Please enter a valid YouTube URL.", "error");
      return;
    }

    const executeAdd = async () => {
      try {
        let res;
        if (lines.length === 1 && isPlaylistUrl(lines[0])) {
          if (!activePlaylistInfo || !activePlaylistInfo.items) {
            btnAddText.textContent = "Fetching playlist videos…";
            btnAddQueue.disabled = true;
            try {
              const plRes = await apiFetch(`/api/playlist?url=${encodeURIComponent(lines[0])}`);
              if (plRes.ok) {
                activePlaylistInfo = await plRes.json();
              }
            } catch { }
            btnAddQueue.disabled = false;
            updateAddButtonLabel();
          }

          if (activePlaylistInfo && Array.isArray(activePlaylistInfo.items) && activePlaylistInfo.items.length > 0) {
            const playlistItemsPayload = activePlaylistInfo.items.map((it) => ({
              url: it.url,
              title: it.title,
              thumbnail: it.thumbnail,
              options: { ...opts, isPlaylist: false },
            }));

            res = await apiFetch("/api/queue/add", {
              method: "POST",
              body: { items: playlistItemsPayload },
            });
          } else {
            res = await apiFetch("/api/queue/add", {
              method: "POST",
              body: {
                url: lines[0],
                title: activeVideoInfo ? activeVideoInfo.title : "",
                thumbnail: activeVideoInfo ? activeVideoInfo.thumbnail : "",
                options: opts,
              },
            });
          }
        } else if (lines.length === 1) {
          if (!activeVideoInfo || !activeVideoInfo.title) {
            btnAddText.textContent = "Fetching video details…";
            btnAddQueue.disabled = true;
            try {
              const infoRes = await apiFetch(`/api/info?url=${encodeURIComponent(lines[0])}`);
              if (infoRes.ok) {
                activeVideoInfo = await infoRes.json();
              }
            } catch { }
            btnAddQueue.disabled = false;
            updateAddButtonLabel();
          }

          res = await apiFetch("/api/queue/add", {
            method: "POST",
            body: {
              url: lines[0],
              title: activeVideoInfo ? activeVideoInfo.title : "",
              thumbnail: activeVideoInfo ? activeVideoInfo.thumbnail : "",
              options: opts,
            },
          });
        } else {
          // Pre-fetch any missing video metadata so all cards have titles and thumbnails
          const missingUrls = lines.filter((u) => !batchVideoMap.has(u) || !batchVideoMap.get(u).title);
          if (missingUrls.length > 0) {
            btnAddText.textContent = `Fetching details (${lines.length - missingUrls.length}/${lines.length})…`;
            btnAddQueue.disabled = true;
            await Promise.allSettled(
              missingUrls.map(async (u) => {
                try {
                  const r = await apiFetch(`/api/info?url=${encodeURIComponent(u)}`);
                  if (r.ok) {
                    const d = await r.json();
                    batchVideoMap.set(u, d);
                  }
                } catch { }
              })
            );
            btnAddQueue.disabled = false;
            updateAddButtonLabel();
          }

          const itemsPayload = lines.map((url) => {
            const meta = batchVideoMap.get(url);
            return {
              url,
              title: meta && meta.title ? meta.title : "",
              thumbnail: meta && meta.thumbnail ? meta.thumbnail : "",
              options: opts,
            };
          });
          res = await apiFetch("/api/queue/add", {
            method: "POST",
            body: {
              items: itemsPayload,
            },
          });
        }
        const data = await res.json();

        if (res.ok) {
          const addedCount = data && typeof data.count === "number" ? data.count : lines.length;
          showToast(addedCount === 1 ? "Added video to queue!" : `Added ${addedCount} videos to queue!`, "success");
          urlInput.value = "";
          validateUrlLines();
          videoPreview.hidden = true;
          playlistPreview.hidden = true;
          setPreviewMode("thumb");
          if (batchPreview) batchPreview.hidden = true;
          activeVideoInfo = null;
          activePlaylistInfo = null;
          batchVideoMap.clear();
          if (currentBatchFetchController) {
            currentBatchFetchController.abort();
          }
          if (previewPlaceholder) previewPlaceholder.hidden = false;
          switchToQueueTab();
        } else {
          showToast(data.error || "Failed to add to queue.", "error");
        }
      } catch (err) {
        showToast("Error connecting to server.", "error");
      }
    };

    if (lines.length === 1) {
      const duplicate = checkUrlInHistory(lines[0]);
      if (duplicate) {
        promptDuplicateDownload(duplicate, executeAdd);
        return;
      }
    }
    executeAdd();
  });

  function switchToQueueTab() {
    const queueTab = document.querySelector('.nav-tab[data-tab="tab-queue"]');
    if (queueTab) queueTab.click();
  }

  // ── Open Downloads Folder ───────────────────────────────────────────────────
  btnOpenDownloads.addEventListener("click", () => {
    apiFetch("/api/open-folder", { method: "POST", body: {} });
  });

  // ── Queue Rendering & Server-Sent Events (SSE) ──────────────────────────────
  function initSSE() {
    if (sseEventSource) {
      try {
        sseEventSource.close();
      } catch {}
    }
    sseEventSource = new EventSource("/api/events");

    sseEventSource.onopen = () => {
      updateConnUI("connected");
      missedHeartbeats = 0;
    };

    sseEventSource.onmessage = (event) => {
      updateConnUI("connected");
      missedHeartbeats = 0;
      try {
        const data = JSON.parse(event.data);
        handleQueueEvent(data);
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    sseEventSource.onerror = () => {
      console.warn("SSE connection error. Reconnecting…");
      updateConnUI("reconnecting");
      checkHeartbeat();
    };
  }

  function handleQueueEvent(evt) {
    if (evt.type === "init") {
      queueItems = evt.payload || [];
      renderQueue();
    } else if (evt.type === "item_added") {
      queueItems.push(evt.payload);
      renderQueue();
    } else if (evt.type === "batch_added") {
      queueItems.push(...evt.payload);
      renderQueue();
    } else if (evt.type === "item_updated" || evt.type === "item_progress") {
      const idx = queueItems.findIndex((x) => x.id === evt.payload.id);
      if (idx !== -1) {
        queueItems[idx] = evt.payload;
        updateQueueCard(evt.payload);
      } else {
        queueItems.push(evt.payload);
        renderQueue();
      }

      if (evt.payload.status === "done" && evt.type === "item_updated") {
        playCompletionChime();
        showToast(`Finished: "${evt.payload.title}"`, "success");
        loadHistory();
        refreshDiskUsage();
      }
    } else if (evt.type === "item_removed") {
      queueItems = queueItems.filter((x) => x.id !== evt.payload.id);
      renderQueue();
    } else if (evt.type === "queue_cleared") {
      queueItems = evt.payload || [];
      renderQueue();
    }

    updateQueueBadges();
  }

  function parseSpeedToBytesPerSec(speedStr) {
    if (!speedStr || typeof speedStr !== "string") return 0;
    const match = speedStr.match(/([\d\.]+)\s*([KMGkmg]?i?B)\/s/i);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit.startsWith("G")) return val * 1024 * 1024 * 1024;
    if (unit.startsWith("M")) return val * 1024 * 1024;
    if (unit.startsWith("K")) return val * 1024;
    return val;
  }

  function formatBytesPerSec(bytes) {
    if (bytes <= 0) return "";
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB/s`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${Math.round(bytes)} B/s`;
  }

  function parseSizeInBytes(sizeStr) {
    if (!sizeStr || typeof sizeStr !== "string") return 0;
    const match = sizeStr.match(/([\d\.]+)\s*([KMGkmg]?i?B)/i);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit.startsWith("G")) return val * 1024 * 1024 * 1024;
    if (unit.startsWith("M")) return val * 1024 * 1024;
    if (unit.startsWith("K")) return val * 1024;
    return val;
  }

  function updateQueueBadges() {
    const activeItems = queueItems.filter((i) => i.status === "downloading" || i.status === "processing");
    const queuedItems = queueItems.filter((i) => i.status === "queued");
    const activeCount = activeItems.length + queuedItems.length;

    if (activeCount > 0) {
      tabQueueCount.hidden = false;
      tabQueueCount.textContent = activeCount;
    } else {
      tabQueueCount.hidden = true;
    }
    queueStatusSummary.textContent = `${queueItems.length} ${queueItems.length === 1 ? "item" : "items"}`;

    if (queueGlobalStats) {
      if (activeItems.length > 0) {
        let totalSpeedBps = 0;
        let etas = [];
        for (const it of activeItems) {
          totalSpeedBps += parseSpeedToBytesPerSec(it.speed);
          if (it.eta && it.eta !== "N/A") etas.push(it.eta);
        }

        const formattedSpeed = formatBytesPerSec(totalSpeedBps);
        const combinedEta = etas.length > 0 ? etas[0] : "";

        if (formattedSpeed) {
          queueGlobalStats.hidden = false;
          queueGlobalStats.textContent = `⚡ ${formattedSpeed}${combinedEta ? ` • ETA: ${combinedEta}` : ""}`;
        } else {
          queueGlobalStats.hidden = true;
        }
      } else {
        queueGlobalStats.hidden = true;
      }
    }
  }

  function renderQueue() {
    updateQueueBadges();

    if (queueItems.length === 0) {
      queueEmpty.hidden = false;
      queueList.hidden = true;
      return;
    }

    queueEmpty.hidden = true;
    queueList.hidden = false;
    queueList.innerHTML = "";

    queueItems.forEach((item) => {
      const card = createQueueCardElement(item);
      queueList.appendChild(card);
    });
  }

  let draggedCardId = null;

  function setupCardDrag(cardEl, id) {
    cardEl.addEventListener("dragstart", (e) => {
      draggedCardId = id;
      cardEl.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    });

    cardEl.addEventListener("dragend", () => {
      cardEl.classList.remove("dragging");
      document.querySelectorAll(".queue-card.drag-over").forEach((c) => c.classList.remove("drag-over"));
    });

    cardEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      cardEl.classList.add("drag-over");
    });

    cardEl.addEventListener("dragleave", () => {
      cardEl.classList.remove("drag-over");
    });

    cardEl.addEventListener("drop", async (e) => {
      e.preventDefault();
      cardEl.classList.remove("drag-over");
      if (!draggedCardId || draggedCardId === id) return;

      const fromIdx = queueItems.findIndex((x) => x.id === draggedCardId);
      const toIdx = queueItems.findIndex((x) => x.id === id);
      if (fromIdx === -1 || toIdx === -1) return;

      const [moved] = queueItems.splice(fromIdx, 1);
      queueItems.splice(toIdx, 0, moved);
      renderQueue();

      const orderIds = queueItems.map((x) => x.id);
      await apiFetch("/api/queue/reorder", {
        method: "POST",
        body: { orderIds },
      });
    });
  }

  function createThumbPlaceholder() {
    const div = document.createElement("div");
    div.className = "queue-thumb queue-thumb-placeholder";
    div.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="6 4 18 12 6 20 6 4" fill="currentColor"></polygon></svg>`;
    return div;
  }

  function renderThumbHtml(thumbUrl) {
    if (thumbUrl && typeof thumbUrl === "string" && thumbUrl.trim() && !thumbUrl.includes("icon48.png")) {
      return `<img class="queue-thumb" src="${escapeHtml(thumbUrl)}" alt="" onerror="this.onerror=null;this.replaceWith(createThumbPlaceholder())" />`;
    }
    return `<div class="queue-thumb queue-thumb-placeholder"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="6 4 18 12 6 20 6 4" fill="currentColor"></polygon></svg></div>`;
  }

  function createQueueCardElement(item) {
    const li = document.createElement("li");
    li.className = "queue-card";
    li.id = `q-${item.id}`;
    li.dataset.id = item.id;

    const isRunning = item.status === "downloading" || item.status === "processing";
    const isPaused = item.status === "paused";
    const isQueued = item.status === "queued";
    const isDone = item.status === "done";
    const isFailed = item.status === "failed" || item.status === "interrupted";
    const isCancelled = item.status === "cancelled";

    if (isQueued || isPaused) {
      li.draggable = true;
    }

    li.innerHTML = `
      <div class="queue-card-top">
        ${(isQueued || isPaused) ? `<span class="drag-handle" title="Drag to reorder">⋮⋮</span>` : ""}
        ${renderThumbHtml(item.thumbnail)}
        <div class="queue-info">
          <p class="queue-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</p>
          <div class="queue-sub">
            <span class="status-tag ${item.status}">${item.status.toUpperCase()}</span>
            <span class="queue-status-text">${escapeHtml(item.statusText || "")}</span>
          </div>
        </div>
        <div class="queue-actions">
          ${(isQueued || isPaused) ? `<button class="btn-tool-sm btn-top-task" data-id="${item.id}" title="Move to top">↑ Top</button>` : ""}
          ${isRunning ? `<button class="btn-tool-sm btn-pause-task" data-id="${item.id}">Pause</button>` : ""}
          ${isPaused ? `<button class="btn-tool-sm btn-resume-task" data-id="${item.id}">Resume</button>` : ""}
          ${isRunning ? `<button class="btn-tool-sm btn-cancel-task" data-id="${item.id}">Cancel</button>` : ""}
          ${isFailed || isCancelled ? `<button class="btn-tool-sm btn-retry-task" data-id="${item.id}">Retry</button>` : ""}
          ${isDone && item.destFile ? `<button class="btn-tool-sm btn-preview-task" data-file="${escapeHtml(item.destFile)}" data-title="${escapeHtml(item.title)}">▶ Preview</button>` : ""}
          ${isDone && item.destFile ? `<button class="btn-tool-sm btn-open-system" data-file="${escapeHtml(item.destFile)}">Open</button>` : ""}
          ${isDone && item.destFile ? `<button class="btn-tool-sm btn-show-file" data-file="${escapeHtml(item.destFile)}">Folder</button>` : ""}
          <button class="btn-tool-sm btn-view-log" data-id="${item.id}" title="View yt-dlp log">Log</button>
          <button class="btn-tool-sm btn-remove-task" data-id="${item.id}">✕</button>
        </div>
      </div>

      <div class="queue-progress-row" ${isDone || isCancelled ? 'style="display:none;"' : ""}>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${item.percent || 0}%"></div>
        </div>
        <div class="progress-stats">
          <span class="stat-pct">${(item.percent || 0).toFixed(1)}%</span>
          <span class="stat-speed">${item.speed ? item.speed : ""}</span>
          <span class="stat-eta">${item.eta ? `ETA: ${item.eta}` : ""}</span>
          <span class="stat-size">${item.size ? item.size : ""}</span>
        </div>
      </div>
    `;

    // Bind action listeners
    const btnPause = li.querySelector(".btn-pause-task");
    if (btnPause) {
      btnPause.addEventListener("click", () => apiFetch(`/api/queue/${item.id}/pause`, { method: "POST" }));
    }

    const btnResume = li.querySelector(".btn-resume-task");
    if (btnResume) {
      btnResume.addEventListener("click", () => apiFetch(`/api/queue/${item.id}/resume`, { method: "POST" }));
    }

    const btnTop = li.querySelector(".btn-top-task");
    if (btnTop) {
      btnTop.addEventListener("click", () => apiFetch(`/api/queue/${item.id}/top`, { method: "POST" }));
    }

    const btnCancel = li.querySelector(".btn-cancel-task");
    if (btnCancel) {
      btnCancel.addEventListener("click", () => apiFetch(`/api/queue/${item.id}/cancel`, { method: "POST" }));
    }

    const btnRetry = li.querySelector(".btn-retry-task");
    if (btnRetry) {
      btnRetry.addEventListener("click", () => apiFetch(`/api/queue/${item.id}/retry`, { method: "POST" }));
    }

    const btnRemove = li.querySelector(".btn-remove-task");
    if (btnRemove) {
      btnRemove.addEventListener("click", () => apiFetch(`/api/queue/${item.id}`, { method: "DELETE" }));
    }

    const btnPreview = li.querySelector(".btn-preview-task");
    if (btnPreview) {
      btnPreview.addEventListener("click", () => openMediaPreview(item.destFile, item.title));
    }

    const btnOpenSys = li.querySelector(".btn-open-system");
    if (btnOpenSys) {
      btnOpenSys.addEventListener("click", () => apiFetch("/api/open-file", {
        method: "POST",
        body: { file: item.destFile }
      }));
    }

    const btnShow = li.querySelector(".btn-show-file");
    if (btnShow) {
      btnShow.addEventListener("click", () => apiFetch("/api/open-folder", {
        method: "POST",
        body: { file: item.destFile }
      }));
    }

    const btnLog = li.querySelector(".btn-view-log");
    if (btnLog) {
      btnLog.addEventListener("click", () => openLogModal(item.id, item.title));
    }

    if (isQueued || isPaused) {
      setupCardDrag(li, item.id);
    }

    return li;
  }

  function updateQueueCard(item) {
    const existing = document.getElementById(`q-${item.id}`);
    if (!existing) {
      renderQueue();
      return;
    }

    const tag = existing.querySelector(".status-tag");
    if (tag) {
      tag.className = `status-tag ${item.status}`;
      tag.textContent = item.status.toUpperCase();
    }

    const titleEl = existing.querySelector(".queue-title");
    if (titleEl && item.title && item.title !== "YouTube Video" && titleEl.textContent !== item.title) {
      titleEl.textContent = item.title;
      titleEl.title = item.title;
    }

    const currentThumbWrap = existing.querySelector(".queue-thumb-wrap");
    if (currentThumbWrap && item.thumbnail && !currentThumbWrap.querySelector("img")) {
      currentThumbWrap.outerHTML = renderThumbHtml(item.thumbnail);
    }

    const statusTextEl = existing.querySelector(".queue-status-text");
    if (statusTextEl) statusTextEl.textContent = item.statusText || "";

    const progressRow = existing.querySelector(".queue-progress-row");
    if (progressRow) {
      if (item.status === "downloading" || item.status === "processing") {
        progressRow.style.display = "";
      }
    }

    const fill = existing.querySelector(".progress-fill");
    if (fill) fill.style.width = `${item.percent || 0}%`;

    const statPct = existing.querySelector(".stat-pct");
    if (statPct) statPct.textContent = `${(item.percent || 0).toFixed(1)}%`;

    const statSpeed = existing.querySelector(".stat-speed");
    if (statSpeed) statSpeed.textContent = item.speed || "";

    const statEta = existing.querySelector(".stat-eta");
    if (statEta) statEta.textContent = item.eta ? `ETA: ${item.eta}` : "";

    const statSize = existing.querySelector(".stat-size");
    if (statSize) statSize.textContent = item.size || "";

    if (item.status === "done" || item.status === "failed" || item.status === "paused" || item.status === "queued" || item.status === "interrupted") {
      const newCard = createQueueCardElement(item);
      existing.replaceWith(newCard);
    }
  }

  if (btnClearQueueFinished) {
    btnClearQueueFinished.addEventListener("click", () => {
      apiFetch("/api/queue/clear-finished", { method: "POST" });
    });
  }

  if (btnPauseAllQueue) {
    btnPauseAllQueue.addEventListener("click", () => apiFetch("/api/queue/pause-all", { method: "POST" }));
  }

  if (btnResumeAllQueue) {
    btnResumeAllQueue.addEventListener("click", () => apiFetch("/api/queue/resume-all", { method: "POST" }));
  }

  // ── History Management ───────────────────────────────────────────────────────
  async function loadHistory() {
    try {
      const res = await apiFetch("/api/history");
      const data = await res.json();
      historyItems = data.history || [];
      renderHistory();
    } catch {}
  }

  function updateHistoryBulkToolbar(filtered) {
    const count = selectedHistoryIds.size;
    if (lblHistorySelectedCount) {
      lblHistorySelectedCount.textContent = count > 0 ? `${count} selected` : "Select all";
    }
    if (btnBulkDelete) btnBulkDelete.disabled = count === 0;
    if (btnBulkRedownload) btnBulkRedownload.disabled = count === 0;
    if (chkHistorySelectAll) {
      const allSelected = filtered.length > 0 && filtered.every((it) => selectedHistoryIds.has(it.id));
      chkHistorySelectAll.checked = allSelected;
      chkHistorySelectAll.indeterminate = count > 0 && !allSelected;
    }
  }

  function renderHistory() {
    tabHistoryCount.textContent = historyItems.length;
    tabHistoryCount.hidden = historyItems.length === 0;
    historyTotalBadge.textContent = `${historyItems.length} items`;

    if (historyItems.length === 0) {
      historyEmpty.hidden = false;
      historyList.hidden = true;
      if (chkHistorySelectAll) chkHistorySelectAll.checked = false;
      updateHistoryBulkToolbar([]);
      return;
    }

    const searchTerm = historySearch.value.trim().toLowerCase();
    const filterType = historyFilterType.value;
    const filterDate = historyFilterDate ? historyFilterDate.value : "all";
    const sortBy = historySort.value;
    const now = Date.now();

    let filtered = historyItems.filter((item) => {
      const matchesSearch = !searchTerm || item.title.toLowerCase().includes(searchTerm);
      const isAudio = item.format && item.format.toLowerCase().includes("audio");
      const matchesType = filterType === "all" ||
        (filterType === "audio" && isAudio) ||
        (filterType === "video" && !isAudio);

      let matchesDate = true;
      if (filterDate === "today") {
        matchesDate = now - item.timestamp <= 24 * 3600 * 1000;
      } else if (filterDate === "week") {
        matchesDate = now - item.timestamp <= 7 * 24 * 3600 * 1000;
      } else if (filterDate === "month") {
        matchesDate = now - item.timestamp <= 30 * 24 * 3600 * 1000;
      }

      return matchesSearch && matchesType && matchesDate;
    });

    // Sort
    if (sortBy === "oldest") {
      filtered.sort((a, b) => a.timestamp - b.timestamp);
    } else if (sortBy === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "size") {
      filtered.sort((a, b) => parseSizeInBytes(b.size) - parseSizeInBytes(a.size));
    } else {
      filtered.sort((a, b) => b.timestamp - a.timestamp);
    }

    historyEmpty.hidden = filtered.length > 0;
    historyList.hidden = filtered.length === 0;
    historyList.className = historyViewMode === "grid" ? "history-list grid-view" : "history-list list-view";
    historyList.innerHTML = "";

    updateHistoryBulkToolbar(filtered);

    filtered.forEach((item) => {
      const li = document.createElement("li");
      li.className = "history-card-item";
      li.innerHTML = `
        <div class="history-card-left">
          <label class="history-chk-wrap" title="Select item">
            <input type="checkbox" class="history-select-chk" data-id="${item.id}" ${selectedHistoryIds.has(item.id) ? "checked" : ""} />
          </label>
          ${renderThumbHtml(item.thumbnail)}
          <div class="history-card-info">
            <p class="history-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</p>
            <p class="history-meta-sub">${escapeHtml(item.format)} • ${item.size} • ${new Date(item.timestamp).toLocaleDateString()}</p>
          </div>
        </div>
        <div class="history-actions">
          <button type="button" class="btn-tool-sm btn-preview-history" data-file="${escapeHtml(item.file)}" data-title="${escapeHtml(item.title)}" title="Preview video/audio inline">▶ Preview</button>
          <button type="button" class="btn-tool-sm btn-open-history-file" data-file="${escapeHtml(item.file)}" title="Open file in default player">Open</button>
          <button type="button" class="btn-tool-sm btn-copy-history-file" data-file="${escapeHtml(item.file)}" title="Copy file to clipboard (Paste with Ctrl+V into CapCut)">Copy</button>
          <button type="button" class="btn-tool-sm btn-show-history-folder" data-file="${escapeHtml(item.file)}" title="Locate in Downloads folder">Folder</button>
          <button type="button" class="btn-tool-sm btn-re-download" data-url="${escapeHtml(item.url)}" data-title="${escapeHtml(item.title)}" title="Load back into New Download">Re-download</button>
          <button type="button" class="btn-tool-sm btn-delete-history btn-danger-text" data-id="${item.id}" title="Delete from history and disk">Delete</button>
        </div>
      `;

      const chk = li.querySelector(".history-select-chk");
      if (chk) {
        chk.addEventListener("change", (e) => {
          if (e.target.checked) selectedHistoryIds.add(item.id);
          else selectedHistoryIds.delete(item.id);
          updateHistoryBulkToolbar(filtered);
        });
      }

      const btnPrev = li.querySelector(".btn-preview-history");
      if (btnPrev) {
        btnPrev.addEventListener("click", () => openMediaPreview(item.file, item.title));
      }

      const btnOpen = li.querySelector(".btn-open-history-file");
      if (btnOpen) {
        btnOpen.addEventListener("click", () => apiFetch("/api/open-file", { method: "POST", body: { file: item.file } }));
      }

      const btnCopy = li.querySelector(".btn-copy-history-file");
      if (btnCopy) {
        btnCopy.addEventListener("click", async () => {
          try {
            const res = await apiFetch("/api/copy-file", {
              method: "POST",
              body: { file: item.file },
            });
            const data = await res.json();
            if (data.success) {
              showToast("File copied! Press Ctrl+V in CapCut or any app to import.", "success");
            } else {
              showToast(data.error || "Failed to copy file", "error");
            }
          } catch (err) {
            showToast("Failed to copy file: " + err.message, "error");
          }
        });
      }

      const btnShowFolder = li.querySelector(".btn-show-history-folder");
      if (btnShowFolder) {
        btnShowFolder.addEventListener("click", () => apiFetch("/api/open-folder", { method: "POST", body: { file: item.file } }));
      }

      li.querySelector(".btn-re-download").addEventListener("click", () => {
        urlInput.value = item.url;
        handleUrlInput();
        const dlTab = document.querySelector('.nav-tab[data-tab="tab-download"]');
        if (dlTab) dlTab.click();
        showToast("Loaded link into New Download!", "info");
      });

      const btnDel = li.querySelector(".btn-delete-history");
      if (btnDel) {
        btnDel.addEventListener("click", async () => {
          if (!confirm(`Delete "${item.title}"?\n\nPress OK to remove this entry and delete the file from your computer.`)) {
            return;
          }
          await apiFetch(`/api/history/${item.id}?deleteFile=true`, { method: "DELETE" });
          selectedHistoryIds.delete(item.id);
          showToast("Item deleted", "info");
          loadHistory();
        });
      }

      historyList.appendChild(li);
    });
  }

  historySearch.addEventListener("input", renderHistory);
  historyFilterType.addEventListener("change", renderHistory);
  if (historyFilterDate) historyFilterDate.addEventListener("change", renderHistory);
  historySort.addEventListener("change", renderHistory);

  if (btnHistoryListView) {
    btnHistoryListView.addEventListener("click", () => {
      historyViewMode = "list";
      localStorage.setItem("ytdl_hist_view", "list");
      btnHistoryListView.classList.add("active");
      btnHistoryGridView.classList.remove("active");
      renderHistory();
    });
  }

  if (btnHistoryGridView) {
    btnHistoryGridView.addEventListener("click", () => {
      historyViewMode = "grid";
      localStorage.setItem("ytdl_hist_view", "grid");
      btnHistoryGridView.classList.add("active");
      btnHistoryListView.classList.remove("active");
      renderHistory();
    });
  }

  if (chkHistorySelectAll) {
    chkHistorySelectAll.addEventListener("change", () => {
      const searchTerm = historySearch.value.trim().toLowerCase();
      const filterType = historyFilterType.value;
      const filterDate = historyFilterDate ? historyFilterDate.value : "all";
      const now = Date.now();
      const filtered = historyItems.filter((item) => {
        const matchesSearch = !searchTerm || item.title.toLowerCase().includes(searchTerm);
        const isAudio = item.format && item.format.toLowerCase().includes("audio");
        const matchesType = filterType === "all" || (filterType === "audio" && isAudio) || (filterType === "video" && !isAudio);
        let matchesDate = true;
        if (filterDate === "today") matchesDate = now - item.timestamp <= 24 * 3600 * 1000;
        else if (filterDate === "week") matchesDate = now - item.timestamp <= 7 * 24 * 3600 * 1000;
        else if (filterDate === "month") matchesDate = now - item.timestamp <= 30 * 24 * 3600 * 1000;
        return matchesSearch && matchesType && matchesDate;
      });

      if (chkHistorySelectAll.checked) {
        filtered.forEach((it) => selectedHistoryIds.add(it.id));
      } else {
        selectedHistoryIds.clear();
      }
      renderHistory();
    });
  }

  if (btnBulkDelete) {
    btnBulkDelete.addEventListener("click", async () => {
      if (selectedHistoryIds.size === 0) return;
      if (confirm(`Delete ${selectedHistoryIds.size} selected history item(s)?\n\nPress OK to remove them and delete their files from your computer.`)) {
        const ids = Array.from(selectedHistoryIds);
        await apiFetch("/api/history/bulk-delete", {
          method: "POST",
          body: { ids, deleteFiles: true },
        });
        selectedHistoryIds.clear();
        await loadHistory();
        showToast("Selected items deleted", "info");
      }
    });
  }

  if (btnBulkRedownload) {
    btnBulkRedownload.addEventListener("click", () => {
      const selectedItems = historyItems.filter((it) => selectedHistoryIds.has(it.id));
      if (selectedItems.length === 0) return;
      urlInput.value = selectedItems.map((it) => it.url).join("\n");
      validateUrlLines();
      handleUrlInput();
      const dlTab = document.querySelector('.nav-tab[data-tab="tab-download"]');
      if (dlTab) dlTab.click();
      showToast(`Loaded ${selectedItems.length} links into New Download!`, "info");
    });
  }

  if (btnExportHistoryJson) {
    btnExportHistoryJson.addEventListener("click", () => {
      window.location.href = "/api/history/export?format=json";
    });
  }

  if (btnExportHistoryCsv) {
    btnExportHistoryCsv.addEventListener("click", () => {
      window.location.href = "/api/history/export?format=csv";
    });
  }

  btnClearHistory.addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear your download history?")) {
      await apiFetch("/api/history/clear", { method: "POST" });
      selectedHistoryIds.clear();
      loadHistory();
      showToast("History cleared.", "info");
    }
  });

  // ── Media Preview Player Modal ───────────────────────────────────────────────
  function openMediaPreview(filePath, title) {
    if (!filePath || !mediaPreviewModal) return;
    currentPreviewFile = filePath;
    mediaPreviewTitle.textContent = title || "Media Preview";

    const ext = filePath.split(".").pop().toLowerCase();
    const isAudio = ["mp3", "m4a", "wav", "flac", "opus", "ogg"].includes(ext);
    const streamUrl = `/api/stream-file?file=${encodeURIComponent(filePath)}`;

    if (isAudio) {
      if (previewVideoContainer) previewVideoContainer.hidden = true;
      if (previewVideoPlayer) {
        previewVideoPlayer.pause();
        previewVideoPlayer.src = "";
      }
      if (previewAudioContainer) previewAudioContainer.hidden = false;
      if (previewAudioPlayer) {
        previewAudioPlayer.src = streamUrl;
        previewAudioPlayer.play().catch(() => {});
      }
    } else {
      if (previewAudioContainer) previewAudioContainer.hidden = true;
      if (previewAudioPlayer) {
        previewAudioPlayer.pause();
        previewAudioPlayer.src = "";
      }
      if (previewVideoContainer) previewVideoContainer.hidden = false;
      if (previewVideoPlayer) {
        previewVideoPlayer.src = streamUrl;
        previewVideoPlayer.play().catch(() => {});
      }
    }

    mediaPreviewModal.hidden = false;
  }

  function closeMediaPreview() {
    if (!mediaPreviewModal) return;
    if (previewVideoPlayer) {
      previewVideoPlayer.pause();
      previewVideoPlayer.src = "";
    }
    if (previewAudioPlayer) {
      previewAudioPlayer.pause();
      previewAudioPlayer.src = "";
    }
    mediaPreviewModal.hidden = true;
    currentPreviewFile = null;
  }

  if (btnCloseMediaPreview) btnCloseMediaPreview.addEventListener("click", closeMediaPreview);
  if (btnDismissMediaPreview) btnDismissMediaPreview.addEventListener("click", closeMediaPreview);

  if (btnPreviewShowFolder) {
    btnPreviewShowFolder.addEventListener("click", () => {
      if (currentPreviewFile) {
        apiFetch("/api/open-folder", { method: "POST", body: { file: currentPreviewFile } });
      }
    });
  }

  if (btnPreviewOpenSystem) {
    btnPreviewOpenSystem.addEventListener("click", () => {
      if (currentPreviewFile) {
        apiFetch("/api/open-file", { method: "POST", body: { file: currentPreviewFile } });
      }
    });
  }

  // ── Settings Modal ───────────────────────────────────────────────────────────
  async function loadSettings() {
    try {
      const res = await apiFetch("/api/settings");
      currentSettings = await res.json();
      populateSettingsForm();
      applyTheme(currentSettings.theme || "system");
      footerFolderPath.textContent = currentSettings.downloadDir || "Downloads\\YouTube";
    } catch {}
  }

  function populateSettingsForm() {
    settingFolder.value = currentSettings.downloadDir || "";
    settingTemplate.value = currentSettings.filenameTemplate || "%(title)s.%(ext)s";
    settingConcurrency.value = currentSettings.concurrency || 2;
    settingSpeed.value = currentSettings.speedLimit || "";
    settingCookies.value = currentSettings.browserCookies || "none";
    settingRetries.value = currentSettings.maxRetries || 3;
    settingAutoOpen.checked = Boolean(currentSettings.autoOpenFolder);
    settingSound.checked = currentSettings.playChime !== undefined
      ? Boolean(currentSettings.playChime)
      : (localStorage.getItem("yt_sound") !== "false");
    if (settingRunInBackground) {
      settingRunInBackground.checked = Boolean(currentSettings.runInBackground);
    }
  }

  btnOpenSettings.addEventListener("click", () => {
    populateSettingsForm();
    settingsModal.hidden = false;
  });

  function closeSettings() {
    settingsModal.hidden = true;
  }

  btnCloseSettings.addEventListener("click", closeSettings);
  btnCancelSettings.addEventListener("click", closeSettings);

  btnVerifyFolder.addEventListener("click", async () => {
    const candidate = settingFolder.value.trim();
    if (!candidate) {
      showToast("Please enter a valid directory path.", "error");
      return;
    }
    const res = await apiFetch("/api/open-folder", {
      method: "POST",
      body: { file: candidate },
    });
    if (res.ok) {
      showToast("Folder verified and opened in Explorer!", "success");
    } else {
      showToast("Could not access or create that folder.", "error");
    }
  });

  document.querySelectorAll(".template-presets .btn-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      settingTemplate.value = btn.dataset.tpl;
    });
  });

  btnSaveSettings.addEventListener("click", async () => {
    const selectedTheme = document.querySelector('input[name="theme-choice"]:checked')?.value || "system";
    const soundEnabled = settingSound.checked;
    localStorage.setItem("yt_sound", soundEnabled ? "true" : "false");

    const patch = {
      downloadDir: settingFolder.value.trim(),
      filenameTemplate: settingTemplate.value.trim(),
      concurrency: parseInt(settingConcurrency.value, 10),
      speedLimit: settingSpeed.value,
      browserCookies: settingCookies.value,
      maxRetries: parseInt(settingRetries.value, 10),
      autoOpenFolder: settingAutoOpen.checked,
      playChime: soundEnabled,
      runInBackground: settingRunInBackground ? settingRunInBackground.checked : false,
      theme: selectedTheme,
    };

    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        body: patch,
      });
      const data = await res.json();
      if (res.ok) {
        currentSettings = data.settings;
        applyTheme(currentSettings.theme);
        footerFolderPath.textContent = currentSettings.downloadDir;
        closeSettings();
        showToast("Settings saved!", "success");
        triggerCommandPreviewUpdate();
      } else {
        showToast(data.error || "Failed to save settings.", "error");
      }
    } catch {
      showToast("Failed to connect to server.", "error");
    }
  });

  if (btnExportSettings) {
    btnExportSettings.addEventListener("click", () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentSettings, null, 2));
      const a = document.createElement("a");
      a.setAttribute("href", dataStr);
      a.setAttribute("download", "youtube_downloader_settings.json");
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Settings exported as JSON!", "success");
    });
  }

  if (btnImportSettings && inputImportSettings) {
    btnImportSettings.addEventListener("click", () => inputImportSettings.click());

    inputImportSettings.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          const res = await apiFetch("/api/settings", {
            method: "POST",
            body: parsed,
          });
          const data = await res.json();
          if (res.ok) {
            currentSettings = data.settings;
            populateSettingsForm();
            applyTheme(currentSettings.theme);
            showToast("Settings imported successfully!", "success");
          } else {
            showToast(data.error || "Failed to import settings", "error");
          }
        } catch {
          showToast("Invalid JSON settings file", "error");
        }
      };
      reader.readAsText(file);
      inputImportSettings.value = "";
    });
  }

  if (btnResetSettings) {
    btnResetSettings.addEventListener("click", async () => {
      if (confirm("Reset all settings to default values?")) {
        try {
          const res = await apiFetch("/api/settings/reset", { method: "POST" });
          const data = await res.json();
          if (res.ok) {
            currentSettings = data.settings;
            populateSettingsForm();
            applyTheme(currentSettings.theme);
            footerFolderPath.textContent = currentSettings.downloadDir;
            showToast("Settings restored to defaults", "info");
          }
        } catch {
          showToast("Failed to reset settings", "error");
        }
      }
    });
  }

  if (btnQuitServer) {
    btnQuitServer.addEventListener("click", async () => {
      if (confirm("Are you sure you want to stop the YouTube Downloader server?")) {
        try {
          await apiFetch("/api/shutdown", { method: "POST" });
        } catch {}
        closeSettings();
        document.body.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0d0e12;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:20px;">
            <h1 style="font-size:24px;margin-bottom:8px;">Server Stopped</h1>
            <p style="color:#8b8e9e;font-size:14px;max-width:400px;line-height:1.5;">The YouTube Downloader server process has terminated cleanly and all active downloads have been stopped. You can safely close this browser tab.</p>
          </div>
        `;
      }
    });
  }

  // ── Shortcuts Modal ──────────────────────────────────────────────────────────
  function openShortcutsModal() {
    if (shortcutsModal) shortcutsModal.hidden = false;
  }

  function closeShortcutsModal() {
    if (shortcutsModal) shortcutsModal.hidden = true;
  }

  if (btnCloseShortcuts) btnCloseShortcuts.addEventListener("click", closeShortcutsModal);
  if (btnDismissShortcuts) btnDismissShortcuts.addEventListener("click", closeShortcutsModal);

  // ── Raw Log Viewer Modal ─────────────────────────────────────────────────────
  async function openLogModal(taskId, title) {
    document.getElementById("log-heading").textContent = `Log: ${title}`;
    logContentBox.textContent = "Loading task logs…";
    logModal.hidden = false;

    try {
      const res = await apiFetch(`/api/logs/${taskId}`);
      const data = await res.json();
      const lines = data.logs || [];
      logContentBox.textContent = lines.length ? lines.join("\n") : "No output recorded for this task.";
      logContentBox.scrollTop = logContentBox.scrollHeight;
    } catch {
      logContentBox.textContent = "Could not fetch log lines.";
    }
  }

  function closeLogModal() {
    logModal.hidden = true;
  }

  btnCloseLog.addEventListener("click", closeLogModal);
  btnDismissLog.addEventListener("click", closeLogModal);

  btnCopyLog.addEventListener("click", () => {
    navigator.clipboard.writeText(logContentBox.textContent);
    showToast("Log copied to clipboard!", "success");
  });

  // ── System Health & Updates ──────────────────────────────────────────────────
  async function checkHealth() {
    try {
      const res = await apiFetch("/api/health");
      const data = await res.json();

      if (data.ytdlp) {
        healthPill.className = "status-badge ready";
        healthText.textContent = `yt-dlp ${data.ytdlpVersion || "Ready"}`;
      } else {
        healthPill.className = "status-badge error";
        healthText.textContent = "yt-dlp missing";
        showHealthBanner("yt-dlp is not installed or not in PATH.", "Install yt-dlp via: py -m pip install -U yt-dlp or winget install yt-dlp.yt-dlp");
      }

      if (!data.ffmpeg) {
        showHealthBanner(
          "FFmpeg was not found. High-definition 1080p+ video merging and MP3 audio conversion require FFmpeg.",
          "Install via: winget install Gyan.FFmpeg"
        );
      }

      if (data.diskUsage && data.diskUsage.formatted) {
        footerDiskUsed.textContent = data.diskUsage.formatted;
      }
    } catch {
      healthPill.className = "status-badge error";
      healthText.textContent = "Server offline";
    }
  }

  function showHealthBanner(msg, fixHint) {
    healthBanner.hidden = false;
    healthBannerText.textContent = `${msg} ${fixHint}`;
  }

  async function refreshDiskUsage() {
    try {
      const res = await apiFetch("/api/disk-usage");
      const data = await res.json();
      if (data.formatted) footerDiskUsed.textContent = data.formatted;
    } catch {}
  }

  btnUpdateYtdlp.addEventListener("click", async () => {
    btnUpdateYtdlp.disabled = true;
    btnUpdateYtdlp.querySelector("span:last-child").textContent = "Updating…";
    showToast("Checking for yt-dlp updates…", "info");

    try {
      const res = await apiFetch("/api/update-ytdlp", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast(`yt-dlp updated! New version: ${data.version}`, "success");
        checkHealth();
      } else {
        showToast(data.output || "Could not complete yt-dlp update.", "error");
      }
    } catch {
      showToast("Error executing updater.", "error");
    } finally {
      btnUpdateYtdlp.disabled = false;
      btnUpdateYtdlp.querySelector("span:last-child").textContent = "Update yt-dlp";
    }
  });

  // ── Keyboard Shortcuts ───────────────────────────────────────────────────────
  window.addEventListener("keydown", (e) => {
    // Esc closes modals and dropdowns
    if (e.key === "Escape") {
      closeAllDropdowns();
      closeSettings();
      closeLogModal();
      closeMediaPreview();
      closeShortcutsModal();
    }

    // ? opens shortcuts help dialog when not typing in an input
    const isEditingText = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if (e.key === "?" && !isEditingText && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      openShortcutsModal();
    }

    // Ctrl + 1, 2, 3 switches tabs
    if (e.ctrlKey && !e.shiftKey && !e.altKey) {
      if (e.key === "1") {
        e.preventDefault();
        const tab = document.querySelector('.nav-tab[data-tab="tab-download"]');
        if (tab) tab.click();
      } else if (e.key === "2") {
        e.preventDefault();
        const tab = document.querySelector('.nav-tab[data-tab="tab-queue"]');
        if (tab) tab.click();
      } else if (e.key === "3") {
        e.preventDefault();
        const tab = document.querySelector('.nav-tab[data-tab="tab-history"]');
        if (tab) tab.click();
      } else if (e.key === ",") {
        e.preventDefault();
        btnOpenSettings.click();
      }
    }

    // Enter in textarea adds to queue if Ctrl or single line
    if (e.key === "Enter" && !e.shiftKey && document.activeElement === urlInput) {
      e.preventDefault();
      btnAddQueue.click();
    }
  });

  // ── Utility Formatters ───────────────────────────────────────────────────────
  function formatDuration(sec) {
    if (!sec || isNaN(sec)) return "00:00";
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const remM = m % 60;
    const remS = s % 60;
    if (h > 0) return `${h}:${remM.toString().padStart(2, "0")}:${remS.toString().padStart(2, "0")}`;
    return `${remM.toString().padStart(2, "0")}:${remS.toString().padStart(2, "0")}`;
  }

  function formatViews(num) {
    if (!num) return "";
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M views`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K views`;
    return `${num} views`;
  }

  function formatDate(str) {
    if (!str || str.length !== 8) return "";
    const y = str.slice(0, 4);
    const m = str.slice(4, 6);
    const d = str.slice(6, 8);
    return `${y}-${m}-${d}`;
  }

  // ── Initialize App ───────────────────────────────────────────────────────────
  async function init() {
    await initSession();

    // Setup Custom Selects with Bidirectional Preset & Context Sync
    setupCustomSelect(selectType, () => syncFormContext());
    setupCustomSelect(selectQuality, () => {
      syncPresetHighlight();
      updateEstimatedFileSize();
    });
    setupCustomSelect(selectContainer, () => {
      syncPresetHighlight();
    });
    setupCustomSelect(selectAudioFormat, () => {
      syncPresetHighlight();
    });
    setupCustomSelect(selectAudioQuality, () => {
      syncPresetHighlight();
      updateEstimatedFileSize();
    });
    setupSubtitlesMultiselect();

    // Footer actions
    if (btnFooterFolder) {
      btnFooterFolder.addEventListener("click", async () => {
        try {
          const res = await apiFetch("/api/open-folder", { method: "POST" });
          const data = await res.json();
          if (res.ok) {
            showToast("Opened download folder in File Explorer", "info");
          } else {
            showToast(data.error || "Could not open folder", "error");
          }
        } catch {
          showToast("Failed to open folder", "error");
        }
      });
    }

    if (btnFooterChangeFolder) {
      btnFooterChangeFolder.addEventListener("click", () => {
        settingsModal.hidden = false;
        settingFolder.focus();
        settingFolder.select();
      });
    }

    await loadSettings();
    await checkHealth();
    initSSE();
    loadHistory();
    setupClipControls();
    setupCustomPresets();

    if (inputCustomFilename) {
      inputCustomFilename.addEventListener("input", () => {
        updateLiveFilenamePreview();
        triggerCommandPreviewUpdate();
      });
    }

    if (btnClearCustomFilename) {
      btnClearCustomFilename.addEventListener("click", () => {
        if (inputCustomFilename) inputCustomFilename.value = "";
        updateLiveFilenamePreview();
        triggerCommandPreviewUpdate();
        if (inputCustomFilename) inputCustomFilename.focus();
      });
    }

    if (metaTitle) {
      metaTitle.addEventListener("input", () => {
        updateLiveFilenamePreview();
        triggerCommandPreviewUpdate();
      });
    }
    if (metaArtist) {
      metaArtist.addEventListener("input", () => {
        updateLiveFilenamePreview();
        triggerCommandPreviewUpdate();
      });
    }
    if (metaAlbum) metaAlbum.addEventListener("input", triggerCommandPreviewUpdate);
    if (chkAudioNormalize) chkAudioNormalize.addEventListener("change", triggerCommandPreviewUpdate);

    syncFormContext();
    autoGrowUrlInput();
    updateLiveFilenamePreview();
    triggerCommandPreviewUpdate();
  }

  init();
})();
