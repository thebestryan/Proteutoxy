# 16-Bit Retro Expert Terminal

A 16-bit JRPG-styled AI chatbot built with vanilla HTML, CSS, and JavaScript. Chat with **9 distinct pixel-art experts**, get a **second opinion** from another expert in the same conversation, customize each expert's name, title, and hidden system instructions, and connect to **any OpenAI-compatible API** (cloud or local).

---

## Features

- **Classic 16-Bit JRPG Interface:** Blue-gradient dialog windows, white/grey double borders, `Press Start 2P` pixel typography, animated 16-bit battle-scene character viewport, and optional Web Audio chiptune sound effects (`SFX: ON/OFF`).
- **9 Built-In Pixel-Art Experts:**
  1. **Dr. Aris Vance** — Scientist
  2. **Hank Miller** — Everyday Guy
  3. **Marcus Cole** — DIY Guy
  4. **Chef Pierre** — Chef
  5. **Dr. Sam Carter** — Doctor
  6. **Ray Turner** — Mechanic
  7. **Prof. Arthur Reed** — Teacher
  8. **Jordan Hayes** — Counselor
  9. **Mech-Bot Alpha** — Robot
- **Separate Threads + "2nd Opinion" Mode:**
  - By default, each expert maintains their own dedicated conversation history (saved in `localStorage`).
  - Toggle **`2ND OPINION: ON`** in the chat header and select another expert to bring them into your **current thread**—then type a follow-up or click **`GET OPINION`** to have them weigh in immediately.
- **Hidden Per-Expert System Instructions:**
  - Each expert's system prompt is hidden behind a `★ CLASSIFIED ★` box by default so their personality and behavior stay a surprise.
  - Click **`OPEN`** to view or edit instructions for the currently selected expert only, **`SAVE`** your changes (auto-saved to `localStorage`), or click **`DEFAULT`** to restore that expert's built-in persona.
  - Renaming an expert or changing their title updates their nameplate, roster slot, and chat badges everywhere.
- **OpenAI-Compatible API Support:**
  - Built-in presets for **OpenRouter**, **Venice**, **NanoGPT**, **Pollinations**, **LM Studio (Local)**, **Ollama (Local)**, **OpenAI**, and **Custom** endpoints.
  - Supports SSE streaming (`STREAM: ON/OFF`), **`FETCH`** model discovery (`GET /models`), temperature control, and mid-response **`STOP`**.
- **Custom Sprites & Chroma-Keying:**
  - Automatic edge flood-fill background removal (`BG KEY: ON/OFF`) and per-expert **`SET SPRITE`** upload.

---

## Quick Start

> **Requirement:** [Python 3](https://www.python.org/downloads/) (standard library only—no `pip install` or Node build step needed).

### Windows
Double-click **`start.bat`** (or run it from Command Prompt / PowerShell).

### Linux / macOS
Make the script executable once, then run it:
```bash
chmod +x start.sh
./start.sh
```

### Automatic Shutdown
`start.bat` and `start.sh` run a lightweight local server (`server.py`) that opens the app in your default browser automatically and shuts down cleanly when **either**:
- You **close the terminal window** (or press `Ctrl+C`), **or**
- You **close the browser tab/window** (with a brief 2.5-second grace period so refreshing with `F5` keeps the server running).

---

## Connecting an API

Use the **Bottom-Left (`▶ API SETTINGS`)** panel:
1. Choose a **Provider Preset** (or **Custom OpenAI-Compatible**).
2. Confirm the **Base URL** (e.g. `https://openrouter.ai/api/v1` or `http://localhost:1234/v1`).
3. Enter your **API Key** (leave blank for local servers that don't require one).
4. Enter a **Model ID** or click **`FETCH`** to pull available models from `/models`.

> **Using LM Studio locally?** Make sure the LM Studio local server is running and **Enable CORS** is turned on in LM Studio's server settings so the browser can communicate with `http://localhost:1234/v1`.

---

## Project Structure

```text
Proteutoxy/
├── index.html          # 3-column 16-bit JRPG layout
├── styles.css          # Retro JRPG theme, borders, scrollbars, and responsive styles
├── experts.js          # Default 9 experts, greetings, prompts, and API presets
├── app.js              # Sprite slicer, viewport animation, SFX, API client, and chat state
├── server.py           # Zero-dependency local HTTP server with auto-shutdown watchdog
├── start.bat           # Windows startup script
├── start.sh            # Linux / macOS startup script
└── assets/
    ├── sprites_sheet1.jpg
    ├── sprites_sheet2.jpg
    └── sprites_extra.jpg
```
