# 🤖 AGENTS.md – Útmutató és Technikai Referencia AI Ágenseknek

Ez a dokumentum a jövőbeli AI ágensek (és fejlesztők) számára foglalja össze az **MCSPanel** architektúráját, kódolási irányelveit, biztonsági szabályait, folyamatkezelési logikáját és fejlesztői munkafolyamatait.

---

## 🏛️ 1. Rendszerarchitektúra & Áttekintés

Az **MCSPanel** egy monorepo felépítésű, pehelykönnyű és modern Minecraft szerverkezelő platform.

- **Backend (`server/`):**
  - **Keretrendszer:** Node.js (v20+) + TypeScript + Fastify 5.2.
  - **Adatbázis:** SQLite (`better-sqlite3`), WAL (Write-Ahead Logging) módban.
  - **Valós idejű kommunikáció:** `@fastify/websocket` (interaktív terminál I/O, élő erőforrás-metrikák, státusz broadcastok).
  - **Hitelesítés & Biztonság:** Argon2 jelszó-hashelés, `@fastify/jwt` (7 napos lejárattal és aktív SQLite DB-validációval), memóriabeli brute-force rate limiter a loginnál.
- **Frontend (`web/`):**
  - **Keretrendszer:** React 18 + TypeScript + Vite.
  - **Stílus:** TailwindCSS (Material Design 3 monokróm szürke-fekete felületek, mobil-első reszponzivitás alsó navigációs sávval).
  - **Konzol:** `xterm.js` natív integráció ANSI színkódokkal és parancselőzményekkel.
  - **PWA:** Service Worker és Manifest támogatás mobil és asztali telepítéshez.
- **Portok & Konfiguráció (`config.json`):**
  - Központi konfigurációs fájl a gyökérkönyvtárban: `config.json` (validációval: `config.schema.json`). Sablon: `config.example.json`.
  - **Fontos:** A `config.json` a `.gitignore`-ban van, így a lokális beállítások nem kerülnek fel a GitHubra!
  - **🚨 KÖRNYEZETI SZABÁLYZAT (Éles vs. Teszt):**
    - **Éles (Production) környezet:** A felhasználó gépén a `C:/mcspanel` mappában fut a `24565`-ös porton. **Szigorúan tilos bármelyik AI ágensnek a `C:/mcspanel` mappához vagy annak fájljaihoz nyúlnia!**
    - **Teszt (Test) környezet:** A jelenlegi WebStorm munkakönyvtár (`C:\Users\matet\WebstormProjects\mcspanel`) a tesztkörnyezet, amely a **`24566`**-os porton fut (`config.json`-ban: `"port": 24566, "environment": "test"`).
  - Development (Vite HMR): `http://localhost:5173` (automatikusan a `config.json`-ban megadott backend portra proxizik).

---

## 🗄️ 2. Adatbázis & Séma (`data/mcspanel.db`)

Az adatbázis inicializálása és migrációja a `server/src/db/schema.ts` fájlban történik.

- **`users` tábla:**
  - `id` (TEXT, UUID primary key), `username` (TEXT, UNIQUE), `password_hash` (TEXT), `is_admin` (INTEGER 0 vagy 1), `created_at`, `updated_at`.
- **`instances` tábla:**
  - `id` (TEXT, UUID primary key), `name` (TEXT), `directory_path` (TEXT), `start_command` (TEXT), `cached_port` (INTEGER), `auto_restart` (INTEGER 0/1), `start_on_boot` (INTEGER 0/1), `cached_version` (TEXT), `last_started_at`, `last_started_by`, `last_stopped_at`, `last_stopped_by`, `created_at`, `updated_at`.
- **`permissions` tábla (RBAC):**
  - `user_id`, `instance_id` (összetett primary key).
  - Jogosultság bitek: `can_view_console`, `can_send_commands`, `can_start`, `can_stop`, `can_restart`, `can_kill`, `can_edit_config`.

---

## ⚙️ 3. Folyamatkezelés & Életciklus Szabályok (`ProcessManager`)

A folyamatkezelés a `server/src/services/processManager.ts` fájlban központosított. **Minden ágensnek szigorúan be kell tartania a következő folyamatkezelési szabályokat:**

1. **Szerver indítása:**
   - A folyamat indítása a `child_process.spawn` segítségével történik a szerver saját `directory_path`-jában (`shell: true`).
   - A shell szkriptek (`.bat`, `.cmd`, `.sh`) véletlen vagy szándékos `pause` utasításait a rendszer automatikusan észleli és átlépi (`\r\n` stdin küldésével).
2. **Kíméletes leállítás (Graceful Shutdown):**
   - A leállítás során a `stop\n` parancsot küldjük a folyamat standard bemenetére (`stdin`).
   - Intelligens in-game stop felismerés: ha a játékos a játékon belül vagy a konzolban adja ki a `/stop` parancsot, a rendszer szándékos leállításként kezeli (`deliberateStop = true`), nem tekinti hibás leállásnak vagy összeomlásnak.
   - Watchdog időzítő: ha a kíméletes leállítás 25 másodpercen belül nem fejeződik be, csak ekkor futhat le a kényszerített `kill`.
3. **Újraindítás (`restart`):**
   - **Tilos** a szervert azonnal hard-killelni újraindításkor!
   - Először el kell küldeni a `stop` parancsot, meg kell várni a folyamat kilépését (max 25 másodpercig), és egy 800 ms-os várakozást kell tartani a fájlzárolások és a TCP port Windows általi elengedésére, mielőtt az új folyamat elindul.
4. **Kényszerített leállítás (`kill`):**
   - Windows alatt a teljes folyamatfát termináljuk (`taskkill /F /T /PID`).
   - **Kritikus:** A `taskkill` aszinkron futását kötelező megvárni (`await new Promise(...)`), különben race condition keletkezik az újraindítás és a port-felszabadítás között.
5. **Crash-loop védelem:**
   - Ha egy szerver hibás konfiguráció vagy portütközés miatt 60 másodpercen belül 3 alkalommal leáll, az automatikus újraindítás felfüggesztésre kerül, és a státusz `CRASHED` marad.
6. **Erőforrás-monitoring és folyamatfelderítés:**
   - Szerverindulás közben elsőként mindig a listening TCP portot vizsgáljuk (ez azonnal azonosítja a `java.exe` folyamatot anélkül, hogy lassú külső segédprogramokat indítanánk).
   - A könyvtáralapú folyamatfelderítés (WMI / PowerShell) legfeljebb 6 másodpercenként egyszer futhat le, elkerülve a CPU túlterhelését.

---

## 🔒 4. Biztonsági Szabályok & Megkötések

1. **Parancsinjekció & Path Traversal védelem:**
   - Tetszőleges parancssorozat vagy shell szöveg futtatása tilos!
   - Kizárólag a szerver mappájában lévő indítófájl indítható. A fájlnevet kötelező a `path.basename` függvénnyel és a `/^[a-zA-Z0-9._-]+\.(bat|cmd|sh)$/i` regex mintával szűrni.
2. **Aktív Adatbázis-ellenőrzés a Hitelesítésnél:**
   - Az `authMiddleware.ts`-ben nem elég a JWT aláírásának ellenőrzése; minden kérésnél aktívan le kell kérdezni a felhasználót a `users` táblából. Ha a felhasználót törölték vagy demotálták, a kérés 401/403-as hibával elutasításra kerül.
3. **RBAC Jogosultság-ellenőrzés:**
   - Minden szerverspecifikus végpont előtt (`/api/instances/:id/*`, beleértve a `/usage` metrikát és a WebSocket kapcsolatot is) kötelező meghívni a `PermissionService.checkUserPermission` ellenőrzést.
4. **Brute-force védelem:**
   - A bejelentkezési végponton kötelező fenntartani a sikertelen kísérletek számlálóját (5 hibás próbálkozás után 60 másodperces lockout).

---

## 🎨 5. Frontend & UI Irányelvek

1. **Natív böngészős modálok tiltása:**
   - **Szigorúan tilos** a `window.alert()`, `window.confirm()` vagy `window.prompt()` használata!
   - Mindig a `useDialog()` hookot használd a `web/src/context/DialogContext.tsx`-ből:
     ```tsx
     const { alert, confirm } = useDialog();
     const ok = await confirm('Biztosan törölni szeretnéd?', 'Megerősítés', { variant: 'danger' });
     ```
2. **Dizájn nyelv:**
   - Material Design 3 monokróm sötét stílus (`bg-md-surface`, `bg-md-container`, `text-neutral-200`).
   - Kerüld a rikító színeket; színek kizárólag funkcionális állapotokhoz használhatók (zöld = fut, piros = veszély/stop, sárga = indulás, szürke = offline).
3. **Reszponzivitás:**
   - Mobil és asztali nézet támogatása. Mobilon az alsó navigációs sáv (`BottomNav.tsx`) biztosítja az ergonómiát.

---

## 🚀 6. Fejlesztői Parancsok & Munkafolyamat

| Parancs | Leírás |
| :--- | :--- |
| `npm install` | Teljes függőségfa telepítése a workspace-ekkel együtt (`server` és `web`). |
| `npm run dev:server` | Backend futtatása fejlesztői módban (ts-node-dev hot reload, port 24565). |
| `npm run dev:web` | Frontend futtatása Vite HMR szerverrel (port 5173). |
| `npm run build` | Mindkét workspace teljes lefordítása (`server/dist` és `web/dist`). |
| `npm test` | Teljes automatizált integrációs tesztcsomag futtatása (Fázis 1-4). |

---

## 💡 7. Gyakori Ágens Csapdák & Jó Gyakorlatok

- **Windows kompatibilitás:** A fejlesztői környezet Windows alapú PowerShell. Mindig ügyelj a platformfüggetlen útvonalkezelésre (`path.join`, `path.resolve`), és arra, hogy Windows alatt a process killhez a `taskkill /F /T` szükséges.
- **Háttérben futtatás:** Windows alatt az automatikus indítást a [`start-hidden.vbs`](file:///C:/Users/matet/WebstormProjects/mcspanel/start-hidden.vbs) fájl végzi ablakok felugrása nélkül, a leállítást pedig a [`stop.bat`](file:///C:/Users/matet/WebstormProjects/mcspanel/stop.bat) intézi.
- **Batch szkriptek szabályai & csapdái (`.bat` / `.cmd`):**
  - **Sorvégek (CRLF vs LF):** A Windows `cmd.exe` összetett ciklusoknál (`for /f`) és blokkoknál (`if (...)`) belső bájtoffszet-hibát vét, ha a fájl csak `LF` sorvégeket tartalmaz (félresikló parancsértelmezés). A `.bat` és `.vbs` fájloknak **mindig kötelezően `CRLF` (`\r\n`)** sorvéggel kell rendelkezniük (ezt a gyökérkönyvtárbeli `.gitattributes` rögzíti).
  - **Zárójelek `if` és `else` blokkokban:** Zárójeles parancsblokkokon belül tilos menekítetlen bezáró zárójelet használni kiírásokban (pl. az `echo ... a(z) %PORT% ...` hibás, mert a `)` lezárja az `if` blokkot, és `-os was unexpected` hibával elszáll). Helyette használd: `a %PORT%-os` vagy menekítsd: `^(z^)`.
  - **Késleltetett változókiértékelés (Delayed Expansion):** Blokkon belüli dinamikus változóknál és hibakódoknál kötelező a `setlocal enabledelayedexpansion`, valamint a `!PID!` és `!errorlevel!` szintaxis a `%...%` helyett, különben a blokk beolvasásakor még a parancsok előtti értékek értékelődnek ki.
  - **Munkakönyvtár-rögzítés:** Minden indító- és vezérlőszkript legelején rögzíteni kell a helyes relatív elérési utat: Windows batch alatt `cd /d "%~dp0"`, Unix shell alatt `cd "$(dirname "$0")"`.
  - **Teljes folyamatfa leállítása:** Leállító szkriptekben kötelező a `taskkill /f /t /pid`, hogy a Node által indított gyermekfolyamatok (Minecraft szerver, `java.exe`, `cmd.exe`) se maradjanak árván a háttérben.
- **Valós RAM mérés & JVM Heap (`processStats.ts`):** A `pidusage` csomag Windows alatt a `Win32_Process.WorkingSetSize` értéket adja vissza, ami Minecraft szervernél a memóriába képzett `.jar` könyvtárak és régiófájlok (`.mca`), valamint a ZGC aliasing miatt hamis, 2+ GB-os értéket mutat még egy üres szervernél is. A valós OS RAM a folyamat privát memóriája (`PrivateMemorySize64`), amit a rendszer a `Get-Process`-szel összegez (megegyezik a Windows Feladatkezelő értékével). Emellett a Java belső állapotát a `jcmd <pid> GC.heap_info` paranccsal olvassuk ki (`jvmHeap: { used, max }`), és a lekérdezést 1,8 másodpercig gyorstárazzuk a felesleges processz-spawnt elkerülendő.
- **SPA Fallback:** A Fastify szerver production módban statikusan szolgálja ki a `web/dist` mappát, és nem-API útvonalak esetén az `index.html`-t adja vissza. Ha új API útvonalat vezetsz be, mindig `/api/` prefixszel tedd, különben az SPA fallback kapja el.
