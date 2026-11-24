# 16-Bit Retro Expert Terminal

A 16-bit JRPG-styled AI chatbot built with vanilla HTML, CSS, and JavaScript. Chat with **9 built-in pixel-art experts** (or add your own), get a **second opinion** in the same thread, **save or branch** conversations, edit/delete individual messages, track your live **model context meter**, and connect to **any OpenAI-compatible API** (cloud or local).

---

## Features

- **Classic 16-Bit JRPG Interface:** Blue-gradient dialog windows, white/grey double borders, `Press Start 2P` pixel typography, animated 16-bit battle-scene character viewport, and optional Web Audio chiptune sound effects (`SFX: ON/OFF`).
- **9 Built-In Pixel-Art Experts + Custom Experts (`+ ADD` / `DEL`):**
  1. **Dr. Aris Vance** — Scientist
  2. **Hank Miller** — Everyday Guy
  3. **Marcus Cole** — DIY Guy
  4. **Chef Pierre** — Chef
  5. **Dr. Sam Carter** — Doctor
  6. **Ray Turner** — Mechanic
  7. **Prof. Arthur Reed** — Teacher
  8. **Jordan Hayes** — Counselor
  9. **Mech-Bot Alpha** — Robot
  - Click **`+ ADD`** in the roster header to create new custom experts, **`SET SPRITE`** to upload a persisted custom portrait (with `BG KEY: ON/OFF` edge flood-fill chroma-key removal), and **`DEL`** (two-step confirm) to remove an expert.
- **Hidden Per-Expert System Instructions & No-Emoji Rule:**
  - Each expert's system prompt is hidden behind a `★ CLASSIFIED ★` box by default so their personality stays a surprise.
  - Click **`OPEN`** to view or edit instructions for the currently selected expert only, **`SAVE`** changes (auto-saved to `localStorage`), or click **`DEFAULT`** to restore defaults.
  - Renaming an expert or changing their title updates their nameplate, roster slot, and chat badges everywhere.
  - A hard system rule automatically enforces **plain text only (no emojis)** across all experts.
- **Live Model Context Meter & Clear Context (`CLR`):**
  - Displays estimated tokens used vs. the active model's context window (auto-detected from `/models` metadata on **`FETCH`**, built-in model presets, or a manual **`CTX LIMIT`** override in API Settings).
  - Starts empty (**green**), turns **yellow** at 55%, and turns **red** at 75% (3/4 full).
  - Click **`CLR`** next to `CONTEXT` to insert a fresh-memory divider—keeping earlier messages visible on screen while resetting what gets sent to the AI.
- **Separate Threads + "2nd Opinion" Mode:**
  - By default, each expert keeps their own conversation history (persisted in `localStorage`).
  - Toggle **`2ND OPINION: ON`** and select another expert to bring them into your **current thread**—then type a follow-up or click **`GET OPINION`** to have them weigh in immediately.
- **Save Slots, Branching, Export, & Message Editing:**
  - Click **`SAVES`** to save snapshots of your chat, **`LOAD`** saved chats or branches, or **`EXPORT`** the current conversation as a `.md` file.
  - Every individual message (user or expert) has **`EDIT`**, **`BRANCH`** (fork a new conversation from that exact message), and **`DEL`** controls.
- **OpenAI-Compatible API Support:**
  - Presets for **OpenRouter**, **Venice**, **NanoGPT**, **Pollinations**, **LM Studio (Local)**, **Ollama (Local)**, **OpenAI**, and **Custom** endpoints.
  - Supports SSE streaming (`STREAM: ON/OFF`), **`FETCH`** model discovery (`GET /models`), temperature control, custom **`CTX LIMIT`**, and mid-response **`STOP`**.

---

## Quick Start

> **Requirement:** [Python 3](https://www.python.org/downloads/) (standard library only—no `pip install` or Node build step needed).

### Windows
Double-click **`start.bat`** (or run `./start.bat` from PowerShell / Command Prompt).

### Linux / macOS
Make the script executable once, then run it:
```bash
chmod +x start.sh
./start.sh
```

### Automatic Shutdown
`start.bat` and `start.sh` launch a lightweight local server (`server.py`) that opens the app in your default browser and uses a persistent SSE connection (`/__events`)—so backgrounded tabs never falsely time out, while closing **either** the browser tab or the terminal window shuts down the server cleanly (with a 2.5-second grace period for `F5` page refreshes).

---

## Connecting an API

Use the **Bottom-Left (`▶ API SETTINGS`)** panel:
1. Choose a **Provider Preset** (or **Custom OpenAI-Compatible**).
2. Confirm the **Base URL** (e.g. `https://openrouter.ai/api/v1` or `http://localhost:1234/v1`).
3. Enter your **API Key** (leave blank for local servers that don't require one).
4. Enter a **Model ID** or click **`FETCH`** to pull available models and their context sizes from `/models`.
5. *(Optional)* Set **`CTX LIMIT`** to override the auto-detected context window for custom local models.

> **Using LM Studio locally?** Make sure the LM Studio local server is running and **Enable CORS** is turned on in LM Studio's server settings so the browser can communicate with `http://localhost:1234/v1`.

---

## GitHub Actions & GitHub Pages

Includes [.github/workflows/ci-deploy.yml](.github/workflows/ci-deploy.yml) which runs automated JavaScript/Python syntax, DOM ID, and sprite asset checks on every push/PR and deploys the static app to **GitHub Pages** on pushes to `main` (or manual `workflow_dispatch`).

---

## Project Structure

```text
Proteutoxy/
├── index.html                   # 3-column 16-bit JRPG layout
├── styles.css                   # Retro JRPG theme, borders, scrollbars, and responsive styles
├── experts.js                   # Default 9 experts, greetings, prompts, and API presets
├── app.js                       # Sprites, viewport, SFX, API client, context meter, saves/branches
├── server.py                    # Zero-dependency local HTTP server with SSE lifecycle shutdown
├── start.bat                    # Windows startup script
├── start.sh                     # Linux / macOS startup script
├── .gitignore                   # Python & OS ignore rules
├── .github/
│   └── workflows/
│       └── ci-deploy.yml        # GitHub Actions validation & GitHub Pages deployment
└── assets/
    ├── sprites_sheet1.jpg
    ├── sprites_sheet2.jpg
    └── sprites_extra.jpg
```
