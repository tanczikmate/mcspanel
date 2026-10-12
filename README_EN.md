# 🎮 MCSPanel - Modern Minecraft Server Platform

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-MD3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL--mode-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue)](#-supported-operating-systems)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-orange)](web/public/manifest.json)

> **[🇬🇧 Read in English](README_EN.md) | [🇭🇺 Magyar dokumentáció](README.md)**

A modern, lightweight, elegant, and open-source Minecraft server management platform. It runs quietly in the background on your PC or server, providing a clean **Material Design 3 Monochrome** web interface on port **`24565`**. Fully responsive for desktop and mobile devices, and installable as a **native PWA application**.

---

## ✨ Key Features

- 🧙 **Zero-Config Setup Wizard:** Automatically prompts you to create a master administrator account upon first launch without manual config files.
- 👥 **Granular User Management & RBAC:**
  - Create unlimited user accounts.
  - Assign server access with fine-grained permissions (*Read console, Send commands, Start, Stop, Restart, Force kill*).
- 📁 **Safe Server Directory Detection & Whitelisting:**
  - Enter the path to your server directory on disk, and the panel automatically detects startup scripts (`start.bat`, `start.sh`, `run.bat`, `run.sh`).
  - 🛡️ **Command Injection Defense:** Does not allow arbitrary web-supplied shell commands; only whitelisted executable scripts located inside the directory can be triggered.
  - 🔍 **Auto Port & MOTD Extraction:** Automatically parses `server-port` and `motd` from `server.properties`.
- 💻 **Real-Time Interactive Web Terminal (`xterm.js`):**
  - Bidirectional, low-latency WebSocket connection.
  - Native Minecraft ANSI colors and formatting.
  - Command history (cycle through previous commands with **Up / Down** arrow keys).
- 🛑 **Robust Process Lifecycle & Graceful Shutdowns:**
  - Graceful stop via standard `stop` command.
  - Intelligent shutdown detection: recognizes `/stop` executed from in-game or console as deliberate closures rather than crashes.
  - Configurable timeout fallback with forced process-tree termination (`taskkill /T /F` on Windows, `SIGKILL` on Linux/macOS) to eliminate zombie Java processes.
- ⚡ **Auto-Start on Boot:**
  - **Per-server:** Toggle `start_on_boot` on any server to launch it automatically when MCSPanel initializes.
  - **Panel-wide:** Windows users can run MCSPanel completely headlessly via `start-hidden.vbs` without any visible console window on boot.
- 🎨 **Material Design 3 Monochrome Aesthetic:**
  - Polished black/white/dark-gray tonal palette with non-intrusive status indicators.
  - Tailored mobile layout with an ergonomic bottom navigation bar.
- 📱 **Installable Progressive Web App (PWA):**
  - Installable directly from Chrome, Edge, or Safari onto Android, iOS, or Windows as a standalone application.

---

## 🌐 Supported Operating Systems

| OS | Status | Notes |
| :--- | :---: | :--- |
| **Windows 10 / 11 / Server** | ✅ **100%** | Native `.bat` launcher, silent VBScript background launcher, process tree kill (`taskkill`). |
| **Linux (Ubuntu, Debian, Fedora, Arch)** | ✅ **100%** | Shell scripts, POSIX signal handling, ready for `systemd` unit file deployment. |
| **macOS (Intel & Apple Silicon)** | ✅ **100%** | Native ARM64 & x64 precompiled SQLite binaries, runnable as a `launchd` daemon. |

---

## 🚀 Quick Start

### 1. Windows Users

Three launcher scripts are provided in the root directory:

| Script | Purpose |
| :--- | :--- |
| **`start.bat`** | Interactive launcher. Builds the project if needed, starts the server in a terminal, and opens `http://localhost:24565`. |
| **`start-hidden.vbs`** | **Completely silent background launcher.** No command prompt or browser window will pop up. |
| **`stop.bat`** | Finds the active MCSPanel process running on port 24565 and cleanly stops it. |

### 2. Linux / macOS Users

```bash
# Grant execution rights
chmod +x start.sh stop.sh

# Start the panel
./start.sh

# Stop the panel
./stop.sh
```

---

## ⚙️ Windows Auto-Start on System Boot (Headless / Silent)

To have MCSPanel start silently in the background whenever Windows boots up:

### Step-by-step Setup (VBScript + Startup folder):

1. **Build the project once:**
   - Double-click `start.bat` once to build the server and frontend, then close it.
2. **Open the Windows Startup folder:**
   - Press **`Win + R`** on your keyboard.
   - Type `shell:startup` and press **Enter**.
   - This opens `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`.
3. **Place a shortcut:**
   - Right-click **`start-hidden.vbs`** in your MCSPanel folder.
   - Choose **Create shortcut**, and move this shortcut into the Startup folder.
4. **Done! 🎉**
   - Whenever your computer boots up, MCSPanel will launch completely hidden in the background without any console or popup windows.
   - Access the web interface anytime at `http://localhost:24565` or through the installed mobile PWA app.

> [!TIP]
> **Auto-starting Minecraft servers:**
> In the MCSPanel web interface, enable the **"Start on boot"** option in your server settings so your Minecraft world spins up automatically upon computer startup.

---

## 🛠️ Development & Build Setup

Requirements: **[Node.js 20+](https://nodejs.org/)** and **npm**.

### 1. Clone & Install
```bash
git clone https://github.com/tanczikmate/mcspanel.git
cd mcspanel
npm install
```

### 2. Start Dev Servers (with Hot Reload / HMR)
```bash
# Terminal 1: Backend API & WebSocket (port 24565)
npm run dev:server

# Terminal 2: Frontend Vite HMR (port 5173)
npm run dev:web
```

### 3. Production Build
```bash
npm run build
```

### 4. Run Integration Tests
```bash
npm test
```

---

## 🔧 Configuration & Environment Variables

MCSPanel works out of the box with zero configuration. You can optionally create a `.env` file in the project root:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `24565` | Web dashboard & REST/WebSocket port. |
| `HOST` | `0.0.0.0` | Bind address (`0.0.0.0` binds to all interfaces, `127.0.0.1` binds to localhost only). |
| `DATA_DIR` | `./data` | Directory where SQLite database and app data are stored. |
| `JWT_SECRET` | *(auto-generated)* | Token signing secret. If omitted, a persistent 64-byte random key is saved to `data/.jwt_secret`. |
| `NODE_ENV` | `development` | Environment mode (`production` or `development`). |

---

## 🌍 Remote & Internet Access

1. **Cloudflare Tunnel (Recommended):**
   - No router port forwarding required, protects your home IP address, and provides free automatic SSL.
   - Command: `cloudflared tunnel --url http://localhost:24565`.
2. **Reverse Proxy (Nginx / Caddy):**
   - Setup a reverse proxy with Let's Encrypt certificates if hosting on a VPS.
3. **Tailscale / WireGuard VPN:**
   - Connect securely to your home PC from anywhere using a private mesh network.

---

## 🏗️ Project Architecture

```
mcspanel/
├── server/                    # Fastify backend (TypeScript + better-sqlite3 + WebSocket)
│   ├── src/
│   │   ├── db/                # SQLite schemas & WAL configuration
│   │   ├── middleware/        # JWT authentication & RBAC authorization
│   │   ├── routes/            # REST & WebSocket endpoints
│   │   ├── services/          # ProcessManager, ProcessStats, InstanceService
│   │   └── utils/             # Minecraft ping, processFinder, versionDetector
├── web/                       # React frontend (TypeScript + Vite + TailwindCSS + xterm.js)
│   ├── src/
│   │   ├── components/        # Reusable UI elements (Navbar, ServerCard, ConsoleViewer)
│   │   ├── pages/             # App pages (Dashboard, Instance, Users, Login, Setup)
├── start.bat                  # Windows interactive launcher
├── start-hidden.vbs           # Windows silent background launcher (no window)
├── stop.bat                   # Windows process terminator
├── start.sh                   # Linux/macOS launcher
├── stop.sh                    # Linux/macOS stopper
├── LICENSE                    # MIT License
└── README.md                  # Documentation
```

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
