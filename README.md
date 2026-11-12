# YouTube Video Downloader

A modern, high-performance desktop web application for downloading YouTube videos, audio tracks, and playlists. Powered directly by `yt-dlp` and `ffmpeg`, with zero external npm dependencies.

---

## ✨ Complete Feature Overview

### 🎨 1. Modern Controls, Custom Dropdowns & Responsive Layout
- **Two-Column Desktop Layout**: Settings and inputs on the left, sticky live video preview on the right (automatically stacks responsively on narrow displays).
- **Consistent SVG Iconography**: Unified, clean inline SVG icon set replacing all emojis.
- **Context-Aware Form**:
  - Selecting **Audio only** hides subtitles and video-only options while exposing audio format and bitrate controls.
  - Selecting **Video only** hides audio settings and displays container controls.
  - Selecting **Video + Audio** provides comprehensive controls with automatic stream merging.
- **Dynamic Quality Filtering**: Fetches video metadata and filters the Quality dropdown to show **only** qualities available for that specific video (from 360p up to 4K 2160p), complete with estimated file sizes (`1080p (~125 MB)`).
- **1-Click Quick Presets**: Built-in presets for Best Quality (MP4), 1080p, 720p, and MP3 Audio, synchronized bidirectionally with the dropdowns.
- **Custom User Presets**: Save custom configurations as presets with custom names, displayed alongside built-in presets with delete (✕) controls.
- **Smart Live Filename Preview**: Live preview box showing the rendered filename based on your chosen template, format, and metadata.
- **Custom Exported Filename**: Specify an exact custom filename with dynamic live preview, or leave empty to use automatic video titling.
- **URL Box Auto-Growth & Validation**: The URL textarea automatically expands to fit multi-line content, validates every line in real-time with status icons, and highlights duplicate lines.

### ✂️ 2. Advanced Download Features & Media Editing
- **Section Trimming / Clipping**: Optional start and end time fields (`--download-sections`) with an interactive timeline slider synchronized to video duration.
- **Audio Extras**:
  - **Loudness Normalization**: Optional EBU R128 loudness normalization (`-af loudnorm`) for even, pleasant volume levels across tracks.
  - **Metadata Tagging**: Custom metadata editor prefilled with title and channel, embedded directly into ID3 tags.
- **SponsorBlock Integration**: Automatically cut sponsored segments, intros, outros, or self-promotions from downloaded videos.
- **Retry with Format Fallback**: Automatically falls back to the closest available quality if a specific video resolution is unavailable.
- **History Duplicate Detection**: Detects if a video was already downloaded previously and displays a confirmation dialog to re-download or skip.

### 📑 3. Playlist Handling
- Interactive playlist item list with thumbnails, durations, and titles.
- **Select All / None** buttons and **Range Selector** (e.g., items 3 to 12).
- Options to number files in order (`01 - Title.mp4`) and save inside a subfolder named after the playlist.

### ⚡ 4. Download Queue & Multi-Worker Engine
- Configurable concurrent downloads (**1 to 4 workers**, default 2).
- **Global Speed & Combined ETA**: Header stats calculate total download throughput and combined estimated time remaining across active downloads.
- Real-time progress streaming via **Server-Sent Events (SSE)**: percentage, download speed, ETA, and downloaded size.
- **Pause All & Resume All**: Temporarily suspend active downloads or the entire queue with one click.
- **Drag-to-Reorder**: Reorder queued items using drag-and-drop.
- **Move to Top**: Per-item priority button to bump urgent downloads to the front of the queue.
- **Queue Persistence**: The queue survives server restarts and page refreshes (`data/queue.json`).

### 📚 5. History & Media Player
- **List & Grid View Toggle**: Switch between compact list view and visual card grid.
- **Filters & Search**: Filter by media type (All, Video, Audio), date range (All Time, Today, This Week, This Month), and sort by newest, oldest, title, or file size.
- **Bulk Management**: Select multiple items with a master checkbox to bulk delete or bulk re-download.
- **Export History**: 1-click export as CSV or JSON for external tracking.
- **Inline Preview Player**: Built-in HTML5 media player modal with HTTP Range streaming support to preview downloaded videos and audio before opening.
- **Quick File Actions**: 1-click "Open in Default App" and "Show in Folder".

### ⚙️ 6. App-Level Architecture & Settings
- **Free Port Discovery**: Automatically detects if port 3000 is occupied and cleanly binds to the next available free port (3001, 3002...).
- **First-Run Onboarding Wizard**: 3-step setup guide on first launch (dependency check, download folder selection, default preferences).
- **Settings Backup**: Export and Import settings via JSON file, plus 1-click "Reset to Defaults".
- **Clean Quit Server**: "Quit Server" action cleanly terminates background processes and stops active downloads.
- **Keyboard Shortcuts Dialog**: Press `?` to view all application shortcuts.
- **High Contrast & Reduced Motion**: Full support for Dark, Light, and System themes with accessible color contrast and `prefers-reduced-motion` compliance.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `?` | Open keyboard shortcuts help dialog |
| `Esc` | Close open dialogs, menus, and media preview |
| `Enter` | Add URL(s) to queue (when focused in the URL field) |
| `Ctrl + 1` | Switch to **New Download** tab |
| `Ctrl + 2` | Switch to **Queue** tab |
| `Ctrl + 3` | Switch to **History** tab |
| `Ctrl + ,` | Open **Settings** |

---

## 🔒 Security Architecture

1. **Strict Localhost Binding**: The HTTP server binds exclusively to `127.0.0.1` (never `0.0.0.0`).
2. **CSRF & Origin Verification**: All state-changing requests (`POST`, `DELETE`) require a cryptographically random session token (`X-Session-Token`) and verified `Host`/`Origin` headers.
3. **Array-Based Process Execution**: All commands run via `child_process.spawn` with an argument array and `shell: false`. No raw shell string concatenation, preventing command injection.
4. **URL & Path Whitelisting**: Strict hostname validation (`youtube.com`, `youtu.be`) and path boundaries prohibiting downloads into Windows system directories.
5. **Process Tree Termination**: On Windows, cancellations execute `taskkill /pid <PID> /T /F` to ensure all spawned child processes and partial `.part`/`.ytdl` files are cleaned up immediately.

---

## 🚀 How to Run

### Method 1: Windows Search / Start Menu App (Recommended)
Simply press the **Windows Key** on your keyboard, type **"YouTube"** or **"YouTube Video Downloader"**, and press **Enter**!
- Launches silently with no command prompt / terminal window.
- Runs in dedicated **Desktop App Window Mode** (no browser address bar, tabs, or bookmarks).
- If the app is already open, searching or launching it instantly brings the active window to focus.

> To install or re-create the shortcuts at any time, run:
> ```powershell
> npm run install-app
> ```

### Method 2: Desktop Shortcut
Double-click the **YouTube Video Downloader** shortcut on your Desktop.

### Method 3: Silent Background Launcher
Double-click:
```text
start-hidden.vbs
```

### Method 4: Command Line
```powershell
node server.js
# Or with console output:
start.bat
```

---

## 📦 Sharing with Others (Standalone Setup .exe)

To share the application with friends or colleagues so they can run it on their Windows PC with **zero configuration**:

1. Send them the generated installer:
   ```text
   dist\YouTube-Downloader-Setup.exe
   ```
2. The recipient simply double-clicks `YouTube-Downloader-Setup.exe`.
3. The installer extracts all necessary files into `%LOCALAPPDATA%\Programs\YouTube Video Downloader`, bundles portable runtimes (Node.js, yt-dlp, FFmpeg), registers the app in Windows Search & Start Menu, and immediately opens the application window.
4. The recipient does **not** need to install Node.js, Python, or command-line tools.

> **To rebuild the installer executable at any time**, run:
> ```powershell
> npm run build-exe
> ```
