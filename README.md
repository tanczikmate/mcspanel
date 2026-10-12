# 🎮 MCSPanel - Modern Minecraft Szerver Platform

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-MD3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL--mode-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue)](#-támogatott-operációs-rendszerek)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-orange)](web/public/manifest.json)

> **[🇬🇧 Read in English](README_EN.md) | [🇭🇺 Magyar dokumentáció](README.md)**

Egy modern, pehelykönnyű, elegáns és nyílt forráskódú Minecraft szervermenedzsment platform. A háttérben fut a számítógépeden vagy szervereden, és egy letisztult **Material Design 3 monokróm** felületet biztosít a **`24565`**-ös porton. Mobilra és asztali környezetre optimalizált, és **PWA-ként natív appként is telepíthető**.

---

## ✨ Főbb Funkciók

- 🧙 **Zero-Config Kezdeti Varázsló (Setup Wizard):** Első indításkor azonnal felajánlja a mester adminisztrátori fiók létrehozását, nincs szükség kézi konfigurációs fájlok szerkesztésére.
- 👥 **Részletes Felhasználókezelés & Szerepkörök (RBAC):**
  - Korlátlan felhasználói fiók létrehozása.
  - Szerverek hozzárendelése felhasználókhoz egyedi jogosultságokkal (*Konzol olvasása, Parancsküldés, Indítás, Leállítás, Újraindítás, Kényszerített leállítás*).
- 📁 **Biztonságos Szerver Hozzáadás & Mappaészlelés:**
  - Add meg a szerver mappájának elérési útját, és a rendszer automatikusan észleli a futtató fájlt (`start.bat`, `start.sh`, `run.bat`, `run.sh`).
  - 🛡️ **Parancsinjekció Védelem:** Nem engedélyez tetszőleges webes parancsszöveg futtatását; kizárólag a mappában lévő, jóváhagyott indítófájl futtatható.
  - 🔍 **Automatikus Port és MOTD Felismerés:** A rendszer azonnal kiolvassa a szerver portját és MOTD-jét a helyi `server.properties` fájlból.
- 💻 **Valós Idejű Interaktív Web Terminál (`xterm.js`):**
  - Kétirányú, alacsony késleltetésű WebSocket adatfolyam.
  - Minecraft ANSI színkódok és formázások natív megjelenítése.
  - Parancselőzmények (a konzolban a **Felfelé / Lefelé** nyilakkal azonnal visszahívhatók a korábbi parancsok).
- 🛑 **Biztonságos Folyamatkezelés & Intelligens Leállítás:**
  - Kíméletes leállítás (`stop` parancs továbbítása a szervernek).
  - Intelligens állapotkezelés: a konzolból vagy játékon belül kiadott `/stop` parancsot is szándékos leállításként érzékeli (nem omlásként).
  - Időtúllépés és kényszerített fa-leállítás (`taskkill /T /F` Windows-on, `SIGKILL` Linux/Mac-en) a beragadt Java folyamatok ellen.
- ⚡ **Automatikus Indítás Gépbekapcsoláskor:**
  - **Szerver szinten:** Tetszőleges szervereknél bekapcsolható a `start_on_boot` opció, így a panel indulásakor a szerverek automatikusan elindulnak.
  - **Panel szinten:** Windows alatt a mellékelt `start-hidden.vbs` szkripttel a panel teljesen rejtve, ablakok felugrása nélkül indul el a Windows bootolásakor.
- 🎨 **Material Design 3 Monokróm Stílus:**
  - Letisztult fekete-fehér-szürke felületi szintek, nem tolakodó funkcionális állapotjelzők.
  - Teljesen reszponzív felület telefonon és tableten (alsó navigációs sávval).
- 📱 **Telepíthető PWA Alkalmazás:**
  - Androidon, iOS-en és Windows-on egy kattintással telepíthető önálló, teljes képernyős appként a böngészőből.

---

## 🌐 Támogatott Operációs Rendszerek

| Rendszer | Támogatottság | Megjegyzés |
| :--- | :---: | :--- |
| **Windows 10 / 11 / Server** | ✅ **100%** | Natív `.bat` indító, VBScript rejtett háttérfutás, process fa terminálás (`taskkill`). |
| **Linux (Ubuntu, Debian, Fedora, Arch)** | ✅ **100%** | Shell script indítás, POSIX szignálok, alkalmas `systemd` háttérszolgáltatásként való futtatásra. |
| **macOS (Intel & Apple Silicon)** | ✅ **100%** | Natív ARM64 / x64 támogatás előre fordított SQLite binárisokkal, `launchd` háttérfolyamatként futtatható. |

---

## 🚀 Gyors Indítás

### 1. Windows Felhasználóknak

A repóban három előre elkészített indítószkript található a gyökérkönyvtárban:

| Fájl | Működés | Mikor használd? |
| :--- | :--- | :--- |
| **`start.bat`** | Megnyit egy parancssori ablakot, szükség esetén felépíti a projektet, és megnyitja a böngészőt (`http://localhost:24565`). | Első indításkor, teszteléskor vagy fejlesztéskor. |
| **`start-hidden.vbs`** | **Teljesen csendes indítás.** Semmilyen fekete terminál ablak vagy böngésző nem ugrik fel, a háttérben fut. | Gépindításkor (Startup), vagy ha nem akarod látni a parancssort. |
| **`stop.bat`** | Megkeresi a 24565-ös porton futó folyamatot és biztonságosan leállítja. | Amikor be akarod zárni a háttérben futó panelt. |

### 2. Linux / macOS Felhasználóknak

```bash
# Futtatási jog adása
chmod +x start.sh stop.sh

# Indítás
./start.sh

# Leállítás
./stop.sh
```

---

## ⚙️ Automatikus Indítás Gép Bekapcsolásakor (Windows)

Ha azt szeretnéd, hogy a számítógéped bekapcsolásakor az **MCSPanel azonnal elinduljon a háttérben úgy, hogy SEMMILYEN ablak nem ugrik fel**:

### Lépésről lépésre útmutató (VBScript + Indítópult):

1. **Első felépítés (ha még nem tetted meg):**
   - Kattints duplán a `start.bat` fájlra egyszer, hogy leforduljon a szerver és a webes felület, majd zárd be.
2. **Indítópult (Startup) mappa megnyitása:**
   - Nyomd meg a billentyűzeten a **`Win + R`** kombinációt.
   - Írd be: `shell:startup`, majd nyomj **Entert**.
   - Megnyílik a Windows felhasználói indítási mappája (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`).
3. **Parancsikon elhelyezése:**
   - Kattints a jobb gombbal az MCSPanel mappájában lévő **`start-hidden.vbs`** fájlra.
   - Válaszd a **További beállítások megjelenítése** -> **Parancsikon létrehozása** opciót (vagy húzd át jobb gombbal az Indítópult mappába és válaszd a *Parancsikon létrehozása itt* lehetőséget).
   - Helyezd át az újonnan létrejött parancsikont az Indítópult mappába!
4. **Kész! 🎉**
   - A számítógép minden egyes bekapcsolásakor / bejelentkezéskor az MCSPanel automatikusan elindul a háttérben.
   - **Egyetlen ablak sem nyílik meg**, a panel pedig azonnal elérhető a `http://localhost:24565` címen vagy a telefonodon a PWA appból!

> [!TIP]
> **Szerverek automatikus indítása:**
> Ha azt szeretnéd, hogy a Minecraft szervered is azonnal elinduljon a panel indításakor, a webes felületen a szerver kártyáján kapcsold be az **"Automatikus indítás a panel indulásakor"** (`start_on_boot`) opciót!

---

## 🛠️ Telepítés és Fejlesztői Környezet (Dev Mode)

Szükséges szoftverek: **[Node.js 20+](https://nodejs.org/)** és **npm**.

### 1. Függőségek telepítése
```bash
git clone https://github.com/tanczikmate/mcspanel.git
cd mcspanel
npm install
```

### 2. Fejlesztői szerverek indítása (Hot Reloading / HMR)
```bash
# Terminál 1: Backend API és WebSocket (port 24565)
npm run dev:server

# Terminál 2: Frontend Vite HMR szerver (port 5173)
npm run dev:web
```

### 3. Teljes éles build készítése
```bash
npm run build
```
*(Ez lefordítja a TypeScript backendet a `server/dist/` mappába és a Vite frontendet a `web/dist/` mappába.)*

### 4. Automatizált tesztek futtatása
```bash
npm test
```

---

## 📖 Részletes Használati Útmutató

### 1. Első indítás & Setup Wizard
Amikor először nyitod meg a felületet (`http://localhost:24565`), a rendszer észleli, hogy az adatbázis még üres, és megjeleníti a **Telepítési varázslót**:
- Adj meg egy tetszőleges **Adminisztrátori felhasználónevet** és egy biztonságos **jelszót** (minimum 6 karakter).
- A rendszer létrehozza a fiókot és azonnal bejelentkeztet.

### 2. Minecraft Szerver Hozzáadása
1. A vezérlőpulton kattints a **`+ Szerver hozzáadása`** gombra.
2. Töltsd ki a mezőket:
   - **Szerver könyvtárának elérési útja:** A gépeden lévő Minecraft szerver mappa teljes elérési útja (pl. `C:\Minecraft\Paper1.20` vagy `/srv/minecraft`).
   - A rendszer automatikusan átvizsgálja a mappát:
     - Észleli az indítófájlokat (`start.bat`, `run.bat`, `start.sh`, `run.sh`).
     - Kiolvassa a szerver portját és MOTD-jét a `server.properties` fájlból.
   - **Szerver megnevezése:** Tetszőleges név (pl. `SMP Túlélő Szerver`).
3. Kattints a **`Szerver hozzáadása`** gombra.

### 3. Valós Idejű Konzol & Parancsok
- Kattints a szerverkártyán a **`Konzol`** gombra.
- A terminálban valós időben látod a szerver logjait színes ANSI formázással.
- **Parancsok küldése:** Írd be a parancsot a beviteli mezőbe és nyomj Entert (pl. `op jatekos`, `gamemode creative`, `whitelist add barat`).
- **Előzmények:** A billentyűzet **Felfelé** és **Lefelé** nyilaival visszahívhatod a korábban elküldött parancsokat.

### 4. Felhasználók & Jogosultságok (RBAC)
1. Lépj a felső menüben a **`Felhasználók`** menüpontra (csak adminoknak elérhető).
2. Hozz létre egy új felhasználót felhasználónév és jelszó megadásával.
3. A felhasználó melletti **`Jogok`** gombra kattintva szerverenként beállíthatod a hozzáférést:
   - *Konzol megtekintése*
   - *Parancsok küldése*
   - *Szerver indítása*
   - *Szerver leállítása*
   - *Újraindítás*
   - *Kényszerített leállítás (kill)*

### 5. Mobil Alkalmazás Telepítése (PWA)
1. Nyisd meg a böngészőben a vezérlőpult címét (pl. `http://<számítógéped-IP>:24565`).
2. **Android (Chrome):** Kattints a jobb felső három pontra -> *"Alkalmazás telepítése"* vagy a felugró telepítési értesítőre.
3. **iOS (Safari):** Kattints a Megosztás gombra -> *"Főképernyőhöz adás"*.
4. Az MCSPanel ettől kezdve önálló mobilalkalmazásként viselkedik keretmentes teljes képernyős módban.

---

## 🔧 Konfiguráció & Tesztkörnyezet (`config.json`)

Az alkalmazás nulla konfigurációval is azonnal működik, a viselkedése azonban egyszerűen testreszabható a gyökérkönyvtárban lévő **`config.json`** fájlban (amelyhez a szerkesztőkben teljes kódkiegészítést ad a `config.schema.json`):

```json
{
  "$schema": "./config.schema.json",
  "port": 24565,
  "host": "0.0.0.0",
  "dataDir": "data",
  "openBrowserOnStart": true,
  "environment": "production"
}
```

### ⚙️ Beállítási lehetőségek:
| Kulcs | Alapérték | Leírás |
| :--- | :--- | :--- |
| `port` | `24565` | A webes kezelőfelület és REST API HTTP/WebSocket portja. |
| `host` | `0.0.0.0` | Címkötés (`0.0.0.0` = helyi hálózatról is elérhető; `127.0.0.1` = csak localhost). |
| `dataDir` | `data` | Az SQLite adatbázis (`mcspanel.db`) és munkamenet fájlok tárolási könyvtára. |
| `openBrowserOnStart` | `true` | Automatikusan megnyissa-e az alapértelmezett böngészőt indításkor. |
| `environment` | `production` | Futtatási mód (`production`, `development`, `test`). |

---

### 🧪 Éles és Tesztkörnyezet párhuzamos futtatása egy gépen

A rendszer lehetővé teszi, hogy egyetlen számítógépen egyszerre fusson a hivatalos éles panel és egy elszeparált tesztkörnyezet:

- **Éles környezet:**
  - Indítás: [`start.bat`](file:///C:/Users/matet/WebstormProjects/mcspanel/start.bat) -> Port: `24565`, Adatbázis: `data/`
  - Leállítás: [`stop.bat`](file:///C:/Users/matet/WebstormProjects/mcspanel/stop.bat)
- **Teszt környezet:**
  - Indítás: [`start-test.bat`](file:///C:/Users/matet/WebstormProjects/mcspanel/start-test.bat) -> Port: `24566`, Adatbázis: `data-test/` (automatikusan létrehozza a `config.test.json` profilt)
  - Leállítás: [`stop-test.bat`](file:///C:/Users/matet/WebstormProjects/mcspanel/stop-test.bat) (vagy `stop.bat 24566`)

---

## 🌍 Távoli Elérés (Internet felőli elérés)

Ha a panelt nemcsak otthonról, hanem útközben vagy mobilnetről is szeretnéd elérni:

1. **Cloudflare Tunnel (Legjobb és legbiztonságosabb megoldás):**
   - Nem igényel router porttovábbítást (port forward) és nem teszi közzé a nyilvános otthoni IP címedet.
   - Automatikus ingyenes HTTPS tanúsítványt biztosít.
   - Parancs: `cloudflared tunnel --url http://localhost:24565`.
2. **Reverse Proxy (Nginx / Caddy):**
   - Ha VPS-en vagy dedikált Linux szerveren futtatod, állíts be egy Nginx vagy Caddy reverse proxyt Let's Encrypt tanúsítvánnyal.
3. **VPN (Tailscale / WireGuard):**
   - Hozz létre egy privát Tailscale hálózatot a telefonod és a géped között, így titkosított privát IP-n keresztül éred el a panelt.

---

## 🏗️ Technológiai Architektúra

```
mcspanel/
├── server/                    # Backend (Node.js + TypeScript + Fastify)
│   ├── src/
│   │   ├── db/                # SQLite adatbázis inicializálás & séma (better-sqlite3 WAL)
│   │   ├── middleware/        # JWT hitelesítés & RBAC jogosultságkezelő middleware
│   │   ├── routes/            # REST és WebSocket végpontok (auth, instance, console ws, setup)
│   │   ├── services/          # Folyamatkezelő (ProcessManager), ProcessStats, InstanceService
│   │   └── utils/             # Minecraft ping, processFinder, versionDetector, ansiParser
│   └── package.json
├── web/                       # Frontend (React 18 + TypeScript + Vite + TailwindCSS)
│   ├── src/
│   │   ├── components/        # UI komponensek (Navbar, ServerCard, ConsoleViewer, Modal, BottomNav)
│   │   ├── pages/             # Nézetek (Dashboard, Instance, Users, Login, Setup)
│   │   └── services/          # Axios API és WebSocket kliens
│   └── package.json
├── start.bat                  # Windows interaktív indító (fordít és megnyitja a böngészőt)
├── start-hidden.vbs           # Windows rejtett / ablakmentes háttérben futó indító
├── stop.bat                   # Windows folyamat leállító
├── start.sh                   # Linux/macOS indító
├── stop.sh                    # Linux/macOS leállító
├── LICENSE                    # MIT Licenc
└── README.md                  # Dokumentáció
```

---

## 🤝 Hozzájárulás & Hibabejelentés

Bármilyen visszajelzést, javaslatot vagy pull requestet örömmel fogadunk!
- Ha hibát találsz, nyiss egy **Issue**-t a GitHubon a hiba pontos leírásával.
- Ha új funkciót készítenél, nyiss egy **Pull Request**-et!

---

## 📄 Licenc

A projekt nyílt forráskódú és a szabadon felhasználható **[MIT Licenc](LICENSE)** alatt áll.
