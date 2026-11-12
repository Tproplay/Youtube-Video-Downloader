# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-12

### Added
- **Standalone Offline Windows Installer**: Single-file setup (`YouTube-Downloader-Setup.exe`, ~224 MB) embedding Node.js, `yt-dlp`, and `ffmpeg` (Gyan full build). Installs to `%LOCALAPPDATA%\Programs\YouTube Video Downloader` without requiring administrative privileges, registers Start Menu and Desktop shortcuts, and supports in-place upgrades.
- **Single-Instance & Dynamic Port Engine**: Automatically detects already running instances on `127.0.0.1:3000` to bring the active window to focus. If port 3000 is occupied by another application, the server gracefully discovers and binds to the next free port (`3001`, `3002`, etc.).
- **Standalone Desktop App Window**: Automatically launches in dedicated window mode using Microsoft Edge or Google Chrome (`--app` mode) for a native application feel with no browser toolbars or tabs.
- **Context-Aware Download Interface**:
  - Dynamic quality filtering fetching live stream formats and displaying estimated file sizes from 360p up to 4K (2160p).
  - Audio extraction supporting MP3, M4A, Opus, FLAC, and WAV with selectable bitrates.
  - Multi-line URL input supporting batch links and live validation.
  - Interactive section trimming (`--download-sections`) with duration-based timeline sliders.
  - EBU R128 audio loudness normalization (`-af loudnorm`).
  - SponsorBlock integration with customizable skip categories.
- **Playlist Manager**: Full playlist preview with select all/none controls, custom item range filters, per-video size estimation badges, sequential numbering, and playlist subfolder generation.
- **Concurrent Download Queue**: Multi-worker queue (1 to 4 concurrent downloads) with real-time Server-Sent Events (SSE) progress streaming, pause/resume controls, drag-and-drop reordering, and priority promotion ("Move to Top").
- **Download History & Built-In Media Player**:
  - Filterable and searchable history with grid and list views.
  - Integrated HTML5 video and audio modal player supporting HTTP Range requests.
  - One-click "Open in Default App" and "Show in Folder" actions.
  - Bulk management and export to CSV or JSON.
- **Settings & Dependency Maintenance**:
  - First-run setup wizard.
  - Dark, Light, and System theme synchronization.
  - One-click in-app `yt-dlp` updater (`yt-dlp -U`).
  - Browser cookie extraction support for age-restricted and member content.
- **Security & Safety Controls**:
  - Strict loopback binding exclusively to `127.0.0.1`.
  - CSRF token validation and Origin/Host verification on all state-changing endpoints.
  - Process spawning with explicit argument arrays (`shell: false`) to eliminate command injection.
  - Recursive process tree termination (`taskkill /T /F`) for immediate cleanup of orphan child processes and partial files.
