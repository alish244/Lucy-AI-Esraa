# Lucy — Intelligent Neural Assistant

> An interactive AI assistant with a pulsing neural interface, built for
> **Al-Esraa University — Technical Engineering College — Computer Techniques
> Engineering — First Stage, Section A3**.

[![Live Demo](https://img.shields.io/badge/Live-Demo-00e5ff?style=flat-square)](https://www.esraa.edu.iq/)
[![Language](https://img.shields.io/badge/native-C++17-blue?style=flat-square)](#native-launcher-c)
[![UI](https://img.shields.io/badge/UI-HTML%2FCSS%2FJS-7c4dff?style=flat-square)](#web-ui)
[![AI](https://img.shields.io/badge/AI-Gemini%20%2B%20Local-ff2d92?style=flat-square)](#ai-engine)
[![License](https://img.shields.io/badge/License-MIT-36ffb0?style=flat-square)](LICENSE)

---

## Overview

Lucy is a desktop AI assistant whose scope is strictly bound to **Al-Esraa
University**. She can answer questions about the university, the Technical
Engineering College, the Computer Techniques Engineering department, the
96-student Section **A3**, the project itself, and its team.

The project is intentionally split into two layers:

| Layer | Technology | Role |
|-------|-----------|------|
| **Native launcher** | C++17 / Win32 / WebView2 | Ships as `Lucy.exe`, renders the UI in a chromeless Edge WebView2 control |
| **Web UI** | HTML5 · CSS3 · Vanilla JavaScript · Canvas2D · Web Speech API | All visuals, voice, conversation, and AI logic |

The web UI can also run standalone from GitHub Pages — no compilation required.

---

## Project Credits

- **University**: Al-Esraa University (جامعة الإسراء) — [esraa.edu.iq](https://www.esraa.edu.iq/)
- **College**: Technical Engineering College (الكلية التقنية الهندسية)
- **Department**: Computer Techniques Engineering (قسم هندسة تقنيات الحاسوب)
- **Stage / Section**: First Stage — Section **A3** (96 students)
- **Supervisor**: Prof. Ali Hussein (الأستاذ علي حسين)
- **Developers**:
  - Zahraa Haider Abdulmutallib (زهراء حيدر عبدالمطلب)
  - Ali Shihab Ahmed (علي شهاب احمد)
  - Rafid Jawad Kadhim (رافد جواد كاظم)

---

## Features

- **Professional splash screen** — animated introduction with team photos,
  supervisor, university, college, department, and section — with a boot-style
  progress sequence.
- **Pulsing neural interface** — a Canvas2D visualization of concentric
  neural rings with live nodes, edges, and traveling pulses. The core changes
  color and rhythm based on state: `idle` · `listening` · `thinking` ·
  `speaking` · `error`.
- **Bilingual** — the full codebase, identifiers, comments, and commit
  messages are in English. All user-facing responses are in Arabic, with
  English technical terms preserved (AI, Neural Network, etc.).
- **Voice in and out** — Web Speech API for Arabic speech recognition
  (`ar-SA`) and speech synthesis. Auto-picks a female Arabic voice (e.g.
  Hoda, Salma, Zariyah) when available.
- **Dual-mode AI engine** — a deterministic local knowledge base for the
  common questions, and an optional Google Gemini free-tier integration for
  open-ended conversations. Local is tried first; Gemini is used only for
  complex questions when a key is configured.
- **Strict scope** — questions outside the university domain receive a
  polite redirect, not a hallucination.
- **Student directory** — fuzzy Arabic search over all 96 Section A3 students
  (with diacritic/alif/yaa/taa-marbuta normalization).

---

## Running

### Option 1 — Open the web UI directly (easiest)

Because the UI uses the Web Speech API, the **page must be served over
`https://` or `localhost`** — opening `index.html` with `file://` will
disable the microphone.

```bash
# From the project root:
python -m http.server 5173
# Then open http://localhost:5173/
```

Or deploy it to GitHub Pages (see below) and open the Pages URL.

### Option 2 — Build the native Lucy.exe launcher (WebView2 / Visual Studio)

Requires:

- Windows 10 or 11
- Visual Studio 2022 (or Build Tools for VS 2022 with the C++ workload)
- CMake 3.20+
- PowerShell (included with Windows)

```bat
build.bat
```

`build.bat` will:

1. Download the Microsoft WebView2 SDK into `third_party/webview2/`.
2. Run CMake with the Visual Studio 17 2022 x64 generator.
3. Build `Lucy.exe` in Release mode.
4. Stage the web UI inside `build/Release/app/` so the folder ships
   self-contained.

Double-click `build\Release\Lucy.exe` to launch.

> **First-time runtime**: Lucy uses Microsoft Edge WebView2 Runtime. It ships
> on every up-to-date Windows 10/11. If it is missing, Lucy will prompt you
> with a download link.

### Option 3 — Build the lightweight Lucy.exe launcher (MinGW, no VS required)

If you don't have Visual Studio installed, use the MinGW-friendly variant. It
builds `Lucy.exe` from [native/launcher_edge.cpp](native/launcher_edge.cpp)
in a single `g++` call — no CMake, no SDK download.

Requires:

- Windows 10 or 11
- Microsoft Edge (preinstalled on Windows 10/11)
- MinGW-w64 `g++` on PATH (via scoop, msys2, w64devkit, or chocolatey)

```bat
build_mingw.bat
```

The produced `Lucy.exe` spawns Microsoft Edge in `--app` mode pointed at the
bundled `app/index.html`, giving the same chromeless window experience as the
WebView2 host. Double-click `build\Release\Lucy.exe` to launch.

---

## AI Engine

Lucy prefers a **local-first** strategy:

1. **Local knowledge base** — Arabic tokenized search over `data/university.json`
   and `data/students_a3.json`. Handles the full roster, supervisor, team,
   college, department, and project metadata. Instant, offline, no API key.
2. **Google Gemini (free tier, optional)** — for open-ended questions
   (`why…`, `how…`, `explain…`, and anything longer than ~40 chars), Lucy
   falls back to `gemini-1.5-flash-latest` with a system prompt that restricts
   scope to the university.

### Configuring Gemini

1. Visit [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and
   generate a free API key.
2. Launch Lucy, click the ⚙️ (Settings) icon in the header.
3. Paste your key into the `Google Gemini API Key` field and click **Save**.

The key is stored in `localStorage` on your machine only. It is never uploaded
to this repository.

---

## Folder layout

```
lucy/
├── index.html                # Web UI entry
├── styles/                   # CSS — main, splash, neural
├── scripts/                  # JS — neural, voice, ai, knowledge, splash, main
├── data/                     # JSON — university + A3 students
├── assets/
│   └── images/               # Team photos
├── native/                   # C++17 WebView2 launcher
│   ├── main.cpp
│   ├── app.rc
│   ├── app.manifest
│   └── resource.h
├── scripts/setup-sdk.ps1     # Downloads the WebView2 SDK
├── CMakeLists.txt
├── build.bat                 # One-click native build
├── .github/workflows/        # GitHub Pages auto-deploy
└── README.md
```

---

## How the neural UI works

`scripts/neural.js` draws three concentric rings of nodes on a `<canvas>`
each frame:

- Rings rotate at different speeds; the middle ring reverses direction.
- Edges connect nearby nodes with a distance-attenuated alpha.
- Pulses travel outward from random nodes, more frequently in `thinking` and
  `speaking` states.
- A radial gradient core breathes in the current state's color.
- The color palette and emission rate change on every state transition
  (`idle` → cyan, `listening` → magenta, `thinking` → violet,
  `speaking` → mint, `error` → red).

No WebGL, no 3D library, no external assets — everything is drawn with
vanilla 2D Canvas.

---

## License

MIT — see [LICENSE](LICENSE).

University logos and team photographs are **not** licensed for reuse; they
belong to their respective owners.

---

## Acknowledgements

- Microsoft Edge **WebView2** — Chromium-based embedded browser.
- Google **Gemini** — free-tier LLM for open-ended answers.
- Google Fonts **Cairo** and **Orbitron**.
- Al-Esraa University for the environment, encouragement, and data.
