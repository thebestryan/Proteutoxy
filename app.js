// =========================================================================
// 16-BIT EXPERT TERMINAL // CORE APPLICATION ENGINE
// =========================================================================

(function () {
    "use strict";

    const STORAGE_KEYS = {
        API: "retro16_api_config_v1",
        EXPERTS: "retro16_expert_overrides_v1",
        EXPERTS_LIST: "retro16_experts_list_v2",
        THREADS: "retro16_chat_threads_v1",
        SAVES: "retro16_saved_chats_v1",
        MODEL_CTX: "retro16_model_ctx_v1",
        PREFS: "retro16_ui_prefs_v1"
    };

    const NO_EMOJI_HARD_RULE =
        "HARD RULE: Never use emojis, emoticons, or Unicode pictographs anywhere in your response. Use plain text only.";

    // =====================================================================
    // 1. STATE
    // =====================================================================
    const state = {
        experts: [],
        selectedId: "scientist",
        activeThreadId: "scientist",
        activeBranchLabel: null,
        secondOpinionMode: false,
        pendingOpinionSwitch: false,
        sfxEnabled: true,
        chromaKeyEnabled: true,
        instructionsOpen: false,
        isGenerating: false,
        abortController: null,
        clearConfirmArmed: false,
        clearConfirmTimeout: null,
        deleteExpertArmed: false,
        deleteExpertTimeout: null,
        api: {
            preset: "openrouter",
            baseUrl: window.API_PRESETS.openrouter.baseUrl,
            apiKey: "",
            model: window.API_PRESETS.openrouter.defaultModel,
            stream: true,
            temperature: 0.7,
            contextOverride: ""
        },
        modelContextMap: {}, // { [modelId]: number } populated by /models fetch
        threads: {}, // { [threadId]: [ { type: 'user'|'bot'|'system', text, expertId?, expertName?, expertTitle?, time } ] }
        savedChats: [], // [ { id, name, threadId, expertId, isBranch, createdAt, messages } ]
        loadedSheets: {},
        slicedSprites: {}, // { [expertId]: HTMLCanvasElement }
        customSpriteImages: {} // { [expertId]: HTMLImageElement }
    };

    // =====================================================================
    // 2. DOM REFERENCES
    // =====================================================================
    const dom = {
        portraitCanvas: document.getElementById("portrait-canvas"),
        viewportUnitCode: document.getElementById("viewport-unit-code"),
        telemetryName: document.getElementById("telemetry-name"),
        telemetryClassBadge: document.getElementById("telemetry-class-badge"),
        contextMeterBlock: document.getElementById("context-meter-block"),
        contextUsageText: document.getElementById("context-usage-text"),
        contextBarFill: document.getElementById("context-bar-fill"),
        clearContextBtn: document.getElementById("clear-context-btn"),
        toggleChromaKeyBtn: document.getElementById("toggle-chromakey-btn"),
        customSpriteInput: document.getElementById("custom-sprite-input"),
        resetSpriteBtn: document.getElementById("reset-sprite-btn"),

        apiPresetSelect: document.getElementById("api-preset-select"),
        apiBaseUrl: document.getElementById("api-base-url"),
        apiKeyInput: document.getElementById("api-key-input"),
        toggleKeyVisBtn: document.getElementById("toggle-key-vis-btn"),
        apiModelInput: document.getElementById("api-model-input"),
        apiModelList: document.getElementById("api-model-list"),
        fetchModelsBtn: document.getElementById("fetch-models-btn"),
        toggleStreamBtn: document.getElementById("toggle-stream-btn"),
        apiTempInput: document.getElementById("api-temp-input"),
        apiCtxInput: document.getElementById("api-ctx-input"),
        apiStatusBadge: document.getElementById("api-status-badge"),
        apiFeedback: document.getElementById("api-feedback"),

        threadOwnerBadge: document.getElementById("thread-owner-badge"),
        toggleSecondOpinionBtn: document.getElementById("toggle-second-opinion-btn"),
        openSavesBtn: document.getElementById("open-saves-btn"),
        savesDrawer: document.getElementById("saves-drawer"),
        closeSavesBtn: document.getElementById("close-saves-btn"),
        saveSlotNameInput: document.getElementById("save-slot-name-input"),
        saveChatBtn: document.getElementById("save-chat-btn"),
        branchCurrentBtn: document.getElementById("branch-current-btn"),
        exportChatBtn: document.getElementById("export-chat-btn"),
        savesList: document.getElementById("saves-list"),
        toggleSfxBtn: document.getElementById("toggle-sfx-btn"),
        clearLogBtn: document.getElementById("clear-log-btn"),
        chatFeed: document.getElementById("chat-feed"),
        secondOpinionBar: document.getElementById("second-opinion-bar"),
        secondOpinionText: document.getElementById("second-opinion-text"),
        askSecondOpinionBtn: document.getElementById("ask-second-opinion-btn"),
        commandForm: document.getElementById("command-form"),
        commandInput: document.getElementById("command-input"),
        transmitBtn: document.getElementById("transmit-btn"),
        stopBtn: document.getElementById("stop-btn"),

        rosterGrid: document.getElementById("roster-grid"),
        rosterModeBadge: document.getElementById("roster-mode-badge"),
        rosterModeHint: document.getElementById("roster-mode-hint"),
        addExpertBtn: document.getElementById("add-expert-btn"),

        instructionsExpertTag: document.getElementById("instructions-expert-tag"),
        expertNameInput: document.getElementById("expert-name-input"),
        expertTitleInput: document.getElementById("expert-title-input"),
        togglePromptVisBtn: document.getElementById("toggle-prompt-vis-btn"),
        openPromptBoxBtn: document.getElementById("open-prompt-box-btn"),
        systemPromptHiddenBox: document.getElementById("system-prompt-hidden-box"),
        systemPromptInput: document.getElementById("system-prompt-input"),
        saveExpertBtn: document.getElementById("save-expert-btn"),
        resetExpertBtn: document.getElementById("reset-expert-btn"),
        deleteExpertBtn: document.getElementById("delete-expert-btn"),
        instructionsFeedback: document.getElementById("instructions-feedback")
    };

    const portraitCtx = dom.portraitCanvas.getContext("2d");

    // =====================================================================
    // 3. WEB AUDIO 16-BIT SYNTH SFX
    // =====================================================================
    let audioCtx = null;

    function ensureAudioContext() {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) audioCtx = new Ctx();
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume();
        }
    }

    function playTone(freq, duration = 0.05, type = "square", gainVal = 0.035, slideTo = null) {
        if (!state.sfxEnabled) return;
        try {
            ensureAudioContext();
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            if (slideTo) {
                osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + duration);
            }
            gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch (_) {
            // Ignore autoplay restriction errors
        }
    }

    const sfx = {
        click: () => playTone(620, 0.045, "square", 0.03, 840),
        switchUnit: () => {
            playTone(440, 0.055, "square", 0.035, 660);
            setTimeout(() => playTone(880, 0.075, "triangle", 0.04), 55);
        },
        transmit: () => {
            playTone(520, 0.065, "square", 0.035, 780);
            setTimeout(() => playTone(1040, 0.08, "square", 0.035), 60);
        },
        receive: () => {
            playTone(760, 0.055, "triangle", 0.04, 580);
            setTimeout(() => playTone(920, 0.075, "triangle", 0.04), 55);
        },
        blip: () => playTone(700 + Math.random() * 140, 0.02, "square", 0.012)
    };

    // =====================================================================
    // 4. STORAGE HELPERS
    // =====================================================================
    function safeReadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function safeWriteJSON(key, val) {
        try {
            localStorage.setItem(key, JSON.stringify(val));
        } catch (_) {
            // Ignore quota errors
        }
    }

    function loadPersistedState() {
        const savedApi = safeReadJSON(STORAGE_KEYS.API, null);
        if (savedApi) {
            state.api = { ...state.api, ...savedApi };
        }

        const savedPrefs = safeReadJSON(STORAGE_KEYS.PREFS, null);
        if (savedPrefs) {
            if (typeof savedPrefs.sfxEnabled === "boolean") state.sfxEnabled = savedPrefs.sfxEnabled;
            if (typeof savedPrefs.chromaKeyEnabled === "boolean") state.chromaKeyEnabled = savedPrefs.chromaKeyEnabled;
            if (typeof savedPrefs.secondOpinionMode === "boolean") state.secondOpinionMode = savedPrefs.secondOpinionMode;
            if (savedPrefs.selectedId) state.selectedId = savedPrefs.selectedId;
        }

        const savedList = safeReadJSON(STORAGE_KEYS.EXPERTS_LIST, null);
        if (Array.isArray(savedList) && savedList.length > 0) {
            state.experts = savedList.map((item, idx) => ({
                ...item,
                slot: idx + 1,
                unitCode: item.unitCode || `UNIT-${String(idx + 1).padStart(2, "0")}`,
                signal: typeof item.signal === "number" ? item.signal : 95
            }));
        } else {
            const overrides = safeReadJSON(STORAGE_KEYS.EXPERTS, {});
            state.experts = window.DEFAULT_EXPERTS.map((def) => {
                const ov = overrides[def.id] || {};
                return {
                    ...def,
                    name: ov.name || def.name,
                    title: ov.title || def.title,
                    systemPrompt: typeof ov.systemPrompt === "string" ? ov.systemPrompt : def.systemPrompt
                };
            });
        }

        if (!getExpertById(state.selectedId)) {
            state.selectedId = state.experts[0].id;
        }
        state.activeThreadId = state.selectedId;

        const savedThreads = safeReadJSON(STORAGE_KEYS.THREADS, {});
        state.threads = savedThreads && typeof savedThreads === "object" ? savedThreads : {};

        const savedChats = safeReadJSON(STORAGE_KEYS.SAVES, []);
        state.savedChats = Array.isArray(savedChats) ? savedChats : [];

        const savedModelCtx = safeReadJSON(STORAGE_KEYS.MODEL_CTX, {});
        state.modelContextMap = savedModelCtx && typeof savedModelCtx === "object" ? savedModelCtx : {};
    }

    function saveApiConfig() {
        safeWriteJSON(STORAGE_KEYS.API, state.api);
    }

    function savePrefs() {
        safeWriteJSON(STORAGE_KEYS.PREFS, {
            sfxEnabled: state.sfxEnabled,
            chromaKeyEnabled: state.chromaKeyEnabled,
            secondOpinionMode: state.secondOpinionMode,
            selectedId: state.selectedId
        });
    }

    function saveExpertOverrides() {
        safeWriteJSON(STORAGE_KEYS.EXPERTS_LIST, state.experts);
    }

    function saveThreads() {
        safeWriteJSON(STORAGE_KEYS.THREADS, state.threads);
        // Keep active branch record synced if currently chatting in a saved branch
        const matchingBranch = state.savedChats.find((s) => s.isBranch && s.threadId === state.activeThreadId);
        if (matchingBranch) {
            matchingBranch.messages = JSON.parse(JSON.stringify(getThread(state.activeThreadId)));
            saveSavedChats();
        }
    }

    function saveSavedChats() {
        safeWriteJSON(STORAGE_KEYS.SAVES, state.savedChats);
    }

    // =====================================================================
    // 5. EXPERT HELPERS
    // =====================================================================
    function getExpertById(id) {
        return state.experts.find((e) => e.id === id);
    }

    function getActiveExpert() {
        return getExpertById(state.selectedId) || state.experts[0];
    }

    function getShortName(name) {
        const clean = (name || "").trim();
        if (clean.length <= 10) return clean;
        const firstPart = clean.split(/\s+/)[0];
        if (firstPart.length >= 3 && firstPart.length <= 10) return firstPart;
        return clean.slice(0, 9);
    }

    function getFormattedTime() {
        return new Date().toTimeString().split(" ")[0];
    }

    // =====================================================================
    // 6. SPRITE LOADER & BORDER FLOOD-FILL CHROMA-KEY ENGINE
    // =====================================================================
    function loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    // Extract a cell from a sprite sheet (or a full custom image) with optional
    // edge-seeded flood-fill background removal so dark colors inside the sprite
    // remain completely intact.
    function extractSpriteCanvas(img, col, row, cols, rows, useChromaKey) {
        const cellW = Math.floor(img.width / cols);
        const cellH = Math.floor(img.height / rows);

        const cellCanvas = document.createElement("canvas");
        cellCanvas.width = cellW;
        cellCanvas.height = cellH;
        const ctx = cellCanvas.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH);

        if (!useChromaKey) {
            return cellCanvas;
        }

        let imgData;
        try {
            imgData = ctx.getImageData(0, 0, cellW, cellH);
        } catch (_) {
            // Gracefully handle tainted canvas when opened via file://
            return cellCanvas;
        }

        const d = imgData.data;

        // Sample average background color from the 4 corners of the cell
        const corners = [
            [1, 1],
            [cellW - 2, 1],
            [1, cellH - 2],
            [cellW - 2, cellH - 2]
        ];
        let bgR = 0, bgG = 0, bgB = 0, validCorners = 0;
        for (const [cx, cy] of corners) {
            const i = (cy * cellW + cx) * 4;
            if (d[i + 3] > 200) {
                bgR += d[i];
                bgG += d[i + 1];
                bgB += d[i + 2];
                validCorners++;
            }
        }

        if (validCorners > 0) {
            bgR = Math.round(bgR / validCorners);
            bgG = Math.round(bgG / validCorners);
            bgB = Math.round(bgB / validCorners);

            // BFS flood-fill from all border pixels matching the background color
            const visited = new Uint8Array(cellW * cellH);
            const queue = new Int32Array(cellW * cellH);
            let head = 0, tail = 0;
            const tolerance = 54;

            function matchesBg(idx4) {
                const a = d[idx4 + 3];
                if (a < 20) return true;
                const dist =
                    Math.abs(d[idx4] - bgR) +
                    Math.abs(d[idx4 + 1] - bgG) +
                    Math.abs(d[idx4 + 2] - bgB);
                return dist <= tolerance;
            }

            function enqueue(x, y) {
                const p = y * cellW + x;
                if (visited[p]) return;
                if (!matchesBg(p * 4)) return;
                visited[p] = 1;
                queue[tail++] = p;
            }

            for (let x = 0; x < cellW; x++) {
                enqueue(x, 0);
                enqueue(x, cellH - 1);
            }
            for (let y = 0; y < cellH; y++) {
                enqueue(0, y);
                enqueue(cellW - 1, y);
            }

            while (head < tail) {
                const p = queue[head++];
                d[p * 4 + 3] = 0;
                const x = p % cellW;
                const y = (p - x) / cellW;
                if (x > 0) enqueue(x - 1, y);
                if (x < cellW - 1) enqueue(x + 1, y);
                if (y > 0) enqueue(x, y - 1);
                if (y < cellH - 1) enqueue(x, y + 1);
            }
        }

        // Compute tight bounding box of remaining opaque pixels
        let minX = cellW, minY = cellH, maxX = 0, maxY = 0;
        let found = false;
        for (let y = 0; y < cellH; y++) {
            for (let x = 0; x < cellW; x++) {
                const a = d[(y * cellW + x) * 4 + 3];
                if (a >= 24) {
                    found = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);

        if (found && maxX > minX && maxY > minY) {
            const trimW = maxX - minX + 1;
            const trimH = maxY - minY + 1;
            const trimmed = document.createElement("canvas");
            trimmed.width = trimW;
            trimmed.height = trimH;
            const tCtx = trimmed.getContext("2d");
            tCtx.imageSmoothingEnabled = false;
            tCtx.drawImage(cellCanvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
            return trimmed;
        }

        return cellCanvas;
    }

    // Crisp pixel fallback avatar if an image fails to load
    function createFallbackSprite(expert) {
        const c = document.createElement("canvas");
        c.width = 32;
        c.height = 44;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#102060";
        ctx.fillRect(6, 4, 20, 36);
        ctx.strokeStyle = "#f8f8f8";
        ctx.lineWidth = 2;
        ctx.strokeRect(7, 5, 18, 34);
        ctx.fillStyle = "#f8e800";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((expert.title || "?").slice(0, 1), 16, 22);
        return c;
    }

    async function loadAllSpriteSheets() {
        const entries = Object.entries(window.SPRITE_SHEETS);
        await Promise.all(
            entries.map(async ([key, cfg]) => {
                const img = await loadImage(cfg.src);
                if (img) {
                    state.loadedSheets[key] = { img, cols: cfg.cols, rows: cfg.rows };
                }
            })
        );
        // Load any persisted custom uploaded sprites
        await Promise.all(
            state.experts.map(async (exp) => {
                if (exp.customSpriteDataUrl) {
                    const img = await loadImage(exp.customSpriteDataUrl);
                    if (img) state.customSpriteImages[exp.id] = img;
                }
            })
        );
        rebuildAllSprites();
    }

    function rebuildExpertSprite(expert) {
        if (state.customSpriteImages[expert.id]) {
            state.slicedSprites[expert.id] = extractSpriteCanvas(
                state.customSpriteImages[expert.id],
                0, 0, 1, 1,
                state.chromaKeyEnabled
            );
            return;
        }
        const sheetInfo = expert.sprite && state.loadedSheets[expert.sprite.sheet];
        if (sheetInfo && sheetInfo.img) {
            state.slicedSprites[expert.id] = extractSpriteCanvas(
                sheetInfo.img,
                expert.sprite.col,
                expert.sprite.row,
                sheetInfo.cols,
                sheetInfo.rows,
                state.chromaKeyEnabled
            );
        } else {
            state.slicedSprites[expert.id] = createFallbackSprite(expert);
        }
    }

    function rebuildAllSprites() {
        state.experts.forEach(rebuildExpertSprite);
        refreshRosterThumbnails();
        refreshChatBadges();
    }

    // =====================================================================
    // 7. ANIMATED 16-BIT JRPG VIEWPORT
    // =====================================================================
    let animTick = 0;

    function drawBattleBackdrop(ctx, w, h, tick) {
        const horizon = Math.floor(h * 0.56);

        // SNES Sky Gradient
        const sky = ctx.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, "#102060");
        sky.addColorStop(1, "#3068a8");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, horizon);

        // Distant pixel hills
        ctx.fillStyle = "#183858";
        ctx.fillRect(0, horizon - 14, w, 14);
        ctx.fillRect(18, horizon - 22, 64, 8);
        ctx.fillRect(130, horizon - 26, 90, 12);
        ctx.fillRect(230, horizon - 18, 50, 4);

        // Scrolling 16-bit clouds
        ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
        const cx1 = ((tick * 0.22) % (w + 90)) - 90;
        const cx2 = ((tick * 0.13 + 140) % (w + 90)) - 90;
        ctx.fillRect(Math.floor(cx1), 24, 56, 12);
        ctx.fillRect(Math.floor(cx1) + 10, 16, 30, 8);
        ctx.fillRect(Math.floor(cx2), 48, 44, 10);
        ctx.fillRect(Math.floor(cx2) + 8, 41, 24, 7);

        // Forest Ground Gradient
        const ground = ctx.createLinearGradient(0, horizon, 0, h);
        ground.addColorStop(0, "#245824");
        ground.addColorStop(1, "#0b220b");
        ctx.fillStyle = ground;
        ctx.fillRect(0, horizon, w, h - horizon);

        // Subtle pixel grass tufts
        ctx.fillStyle = "rgba(70, 150, 70, 0.35)";
        ctx.fillRect(26, horizon + 18, 12, 3);
        ctx.fillRect(218, horizon + 26, 16, 3);
        ctx.fillRect(54, horizon + 54, 14, 3);

        // Battle shadow beneath feet
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath();
        ctx.ellipse(w / 2, h - 18, 36, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function renderViewportLoop() {
        const w = dom.portraitCanvas.width;
        const h = dom.portraitCanvas.height;
        portraitCtx.imageSmoothingEnabled = false;

        drawBattleBackdrop(portraitCtx, w, h, animTick);

        const active = getActiveExpert();
        const sprite = state.slicedSprites[active.id];
        if (sprite) {
            const bob = Math.sin(animTick * 0.065) > 0.35 ? -2 : 0;
            const maxH = h - 30;
            const maxW = w - 44;
            const scale = Math.min(maxW / sprite.width, maxH / sprite.height);
            const dw = Math.max(1, Math.round(sprite.width * scale));
            const dh = Math.max(1, Math.round(sprite.height * scale));
            const dx = Math.round((w - dw) / 2);
            const dy = Math.round(h - 19 - dh + bob);
            portraitCtx.drawImage(sprite, dx, dy, dw, dh);
        }

        animTick++;
        requestAnimationFrame(renderViewportLoop);
    }

    // =====================================================================
    // 8. ROSTER & EXPERT UI SYNC
    // =====================================================================
    function buildRosterGrid() {
        dom.rosterGrid.innerHTML = "";

        state.experts.forEach((exp) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `roster-slot ${exp.id === state.selectedId ? "active" : ""}`;
            btn.dataset.expertId = exp.id;
            btn.title = `${exp.name} — ${exp.title}`;

            const top = document.createElement("div");
            top.className = "roster-slot-top";
            top.innerHTML = `<span>${String(exp.slot).padStart(2, "0")}</span>`;

            const canvas = document.createElement("canvas");
            canvas.width = 44;
            canvas.height = 48;
            canvas.className = "pixel-canvas roster-slot-canvas";
            canvas.id = `roster-canvas-${exp.id}`;

            const nameEl = document.createElement("div");
            nameEl.className = "roster-slot-name";
            nameEl.id = `roster-name-${exp.id}`;
            nameEl.textContent = getShortName(exp.name);

            const roleEl = document.createElement("div");
            roleEl.className = "roster-slot-role";
            roleEl.id = `roster-role-${exp.id}`;
            roleEl.textContent = exp.title;

            btn.appendChild(top);
            btn.appendChild(canvas);
            btn.appendChild(nameEl);
            btn.appendChild(roleEl);

            btn.addEventListener("click", () => selectExpert(exp.id));
            dom.rosterGrid.appendChild(btn);
        });

        refreshRosterThumbnails();
    }

    function refreshRosterThumbnails() {
        state.experts.forEach((exp) => {
            const canvas = document.getElementById(`roster-canvas-${exp.id}`);
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const sprite = state.slicedSprites[exp.id];
            if (!sprite) return;

            const scale = Math.min((canvas.width - 4) / sprite.width, (canvas.height - 2) / sprite.height);
            const dw = Math.max(1, Math.round(sprite.width * scale));
            const dh = Math.max(1, Math.round(sprite.height * scale));
            ctx.drawImage(sprite, Math.round((canvas.width - dw) / 2), Math.round(canvas.height - dh), dw, dh);
        });
    }

    function drawMiniBadge(canvas, expertId) {
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const sprite = state.slicedSprites[expertId];
        if (!sprite) return;
        // Focus on upper half (head + shoulders) for portrait badge
        const cropH = Math.min(sprite.height, Math.round(sprite.width * 1.05));
        const scale = Math.min(canvas.width / sprite.width, canvas.height / cropH);
        const dw = Math.round(sprite.width * scale);
        const dh = Math.round(cropH * scale);
        ctx.drawImage(sprite, 0, 0, sprite.width, cropH, Math.round((canvas.width - dw) / 2), 1, dw, dh);
    }

    function refreshChatBadges() {
        dom.chatFeed.querySelectorAll("canvas[data-badge-expert]").forEach((canvas) => {
            drawMiniBadge(canvas, canvas.dataset.badgeExpert);
        });
    }

    // =====================================================================
    // 8B. FUNCTIONAL CONTEXT METER (AUTO-MATCHED TO ACTIVE MODEL)
    // =====================================================================
    const MODEL_CONTEXT_PATTERNS = [
        [/gemini[-_\s]?(2\.5|2\.0|1\.5)/i, 1048576],
        [/gpt-4\.1/i, 1047576],
        [/claude[-_\s]?(3|4|sonnet|opus|haiku)/i, 200000],
        [/(^|\/)(o1|o3|o4-mini)/i, 200000],
        [/gpt-4o|gpt-4-turbo|chatgpt-4o/i, 128000],
        [/gpt-4(?!o|-turbo|\.1)/i, 8192],
        [/gpt-3\.5/i, 16385],
        [/llama[-_\s]?3\.[1-9]|llama[-_\s]?4/i, 131072],
        [/llama[-_\s]?3(?![._\d])/i, 8192],
        [/deepseek/i, 131072],
        [/qwen[-_\s]?(3|2\.5)/i, 131072],
        [/qwen/i, 32768],
        [/mistral-large|mistral-small|ministral|pixtral|codestral/i, 128000],
        [/mixtral-8x22b/i, 65536],
        [/mixtral|mistral/i, 32768],
        [/gemma[-_\s]?3/i, 131072],
        [/gemma[-_\s]?2/i, 8192],
        [/grok[-_\s]?(2|3|4)/i, 131072],
        [/command-r/i, 128000],
        [/phi-4|phi-3/i, 16384]
    ];

    function getModelContextInfo() {
        const overrideNum = parseInt(state.api.contextOverride, 10);
        if (Number.isFinite(overrideNum) && overrideNum >= 512) {
            return { limit: overrideNum, source: "Custom override" };
        }

        const modelId = (state.api.model || "").trim();
        if (modelId && state.modelContextMap[modelId] >= 512) {
            return { limit: state.modelContextMap[modelId], source: `Fetched from API (${modelId})` };
        }

        if (modelId) {
            for (const [pattern, limit] of MODEL_CONTEXT_PATTERNS) {
                if (pattern.test(modelId)) {
                    return { limit, source: `Model preset (${modelId})` };
                }
            }
        }

        const isLocal = state.api.preset === "lmstudio" || state.api.preset === "ollama";
        return {
            limit: isLocal ? 8192 : 32768,
            source: isLocal ? "Local default (set CTX LIMIT or FETCH)" : "Default estimate (set CTX LIMIT or FETCH)"
        };
    }

    function estimateTextTokens(str) {
        if (!str) return 0;
        return Math.ceil(str.length / 4);
    }

    function estimateCurrentContextTokens() {
        const active = getActiveExpert();
        const messages = buildMessagesPayload(state.activeThreadId, active, null);
        let total = 3; // Assistant reply priming overhead
        for (const m of messages) {
            total += 4 + estimateTextTokens(m.content);
        }
        const draft = dom.commandInput ? dom.commandInput.value.trim() : "";
        if (draft) {
            total += 4 + estimateTextTokens(draft);
        }
        return total;
    }

    function formatTokenCount(n) {
        if (n >= 1000000) {
            const m = n / 1000000;
            return (m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")) + "M";
        }
        if (n >= 1000) {
            const k = n / 1000;
            return (k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")) + "K";
        }
        return String(n);
    }

    function updateContextMeter() {
        const used = estimateCurrentContextTokens();
        const { limit, source } = getModelContextInfo();
        const ratio = limit > 0 ? used / limit : 0;
        const pct = Math.min(100, Math.max(0, ratio * 100));

        dom.contextUsageText.textContent = `${formatTokenCount(used)} / ${formatTokenCount(limit)}`;
        dom.contextBarFill.style.width = `${pct.toFixed(1)}%`;

        dom.contextBarFill.classList.remove("ctx-warn", "ctx-danger");
        if (ratio >= 0.75) {
            dom.contextBarFill.classList.add("ctx-danger");
        } else if (ratio >= 0.55) {
            dom.contextBarFill.classList.add("ctx-warn");
        }

        dom.contextMeterBlock.title =
            `Context: ~${used.toLocaleString()} / ${limit.toLocaleString()} tokens (${pct.toFixed(1)}%)\nSource: ${source}`;
    }

    function syncExpertUI() {
        const exp = getActiveExpert();

        dom.viewportUnitCode.textContent = exp.unitCode;
        dom.telemetryName.textContent = exp.name;
        dom.telemetryClassBadge.textContent = exp.title;
        dom.resetSpriteBtn.classList.toggle("hidden", !state.customSpriteImages[exp.id]);
        updateContextMeter();

        // Highlight active slot & sync names/titles in roster
        dom.rosterGrid.querySelectorAll(".roster-slot").forEach((el) => {
            el.classList.toggle("active", el.dataset.expertId === exp.id);
        });
        const nameTag = document.getElementById(`roster-name-${exp.id}`);
        const roleTag = document.getElementById(`roster-role-${exp.id}`);
        if (nameTag) nameTag.textContent = getShortName(exp.name);
        if (roleTag) roleTag.textContent = exp.title;

        // Sync Bottom-Right Instructions & Profile Editor
        dom.instructionsExpertTag.textContent = exp.unitCode;
        dom.expertNameInput.value = exp.name;
        dom.expertTitleInput.value = exp.title;
        dom.systemPromptInput.value = exp.systemPrompt;

        // Sync Thread Badge
        const owner = getExpertById(state.activeThreadId) || exp;
        if (state.activeBranchLabel) {
            dom.threadOwnerBadge.textContent = `BRANCH: ${state.activeBranchLabel}`;
            dom.rosterModeBadge.textContent = state.secondOpinionMode ? "2ND OPINION" : `${state.experts.length} UNITS`;
            dom.rosterModeHint.classList.toggle("hidden", !state.secondOpinionMode);
        } else if (state.secondOpinionMode) {
            dom.threadOwnerBadge.textContent = `2ND OPINION // ${getShortName(exp.name)}`;
            dom.rosterModeBadge.textContent = "2ND OPINION";
            dom.rosterModeHint.classList.remove("hidden");
        } else {
            dom.threadOwnerBadge.textContent = `THREAD: ${getShortName(owner.name)}`;
            dom.rosterModeBadge.textContent = `${state.experts.length} UNITS`;
            dom.rosterModeHint.classList.add("hidden");
        }

        dom.deleteExpertBtn.disabled = state.experts.length <= 1;

        updateSecondOpinionBar();
    }

    function updateSecondOpinionBar() {
        const thread = getThread(state.activeThreadId);
        const hasConversation = thread.some((m) => m.type === "user");
        const active = getActiveExpert();

        if (state.secondOpinionMode && state.pendingOpinionSwitch && hasConversation && !state.isGenerating) {
            dom.secondOpinionText.textContent = `▶ ${active.name} READY TO WEIGH IN`;
            dom.secondOpinionBar.classList.remove("hidden");
        } else {
            dom.secondOpinionBar.classList.add("hidden");
        }
    }

    function setInstructionsOpen(isOpen) {
        state.instructionsOpen = Boolean(isOpen);
        dom.systemPromptInput.classList.toggle("hidden", !state.instructionsOpen);
        dom.systemPromptHiddenBox.classList.toggle("hidden", state.instructionsOpen);
        dom.togglePromptVisBtn.textContent = state.instructionsOpen ? "HIDE" : "OPEN";
        if (state.instructionsOpen) {
            dom.systemPromptInput.focus();
        }
    }

    function selectExpert(expertId) {
        if (expertId === state.selectedId) return;
        const nextExpert = getExpertById(expertId);
        if (!nextExpert) return;

        state.selectedId = expertId;
        setInstructionsOpen(false);
        resetDeleteExpertArm();
        sfx.switchUnit();
        savePrefs();

        if (state.secondOpinionMode) {
            // Keep the current conversation thread and bring the new expert into it!
            state.pendingOpinionSwitch = true;
            pushThreadMessage(state.activeThreadId, {
                type: "system",
                text: `${nextExpert.name} [${nextExpert.title}] JOINED THIS THREAD FOR A 2ND OPINION`,
                time: getFormattedTime()
            });
            syncExpertUI();
            renderActiveThread();
        } else {
            // Switch to this expert's own dedicated conversation thread
            state.activeThreadId = expertId;
            state.activeBranchLabel = null;
            state.pendingOpinionSwitch = false;
            ensureThreadGreeting(expertId);
            syncExpertUI();
            renderActiveThread();
        }
    }

    function resetDeleteExpertArm() {
        clearTimeout(state.deleteExpertTimeout);
        state.deleteExpertArmed = false;
        dom.deleteExpertBtn.textContent = "DEL";
    }

    function addCustomExpert() {
        const nextNum = state.experts.length + 1;
        const id = `custom_${Date.now()}`;
        const newExpert = {
            id,
            slot: nextNum,
            unitCode: `UNIT-${String(nextNum).padStart(2, "0")}`,
            name: `EXPERT ${nextNum}`,
            title: "SPECIALIST",
            signal: 95,
            sprite: null,
            isCustom: true,
            greeting: "Hello! I am ready to help. Use SET SPRITE to give me a custom portrait and edit my Name, Title, and Instructions on the right.",
            systemPrompt: "You are a helpful, knowledgeable specialist. Give clear, concise, practical answers tailored to the user's needs."
        };

        state.experts.push(newExpert);
        saveExpertOverrides();
        rebuildExpertSprite(newExpert);
        buildRosterGrid();

        state.selectedId = newExpert.id;
        if (!state.secondOpinionMode) {
            state.activeThreadId = newExpert.id;
            state.activeBranchLabel = null;
            ensureThreadGreeting(newExpert.id);
        }
        savePrefs();
        syncExpertUI();
        renderActiveThread();
        setInstructionsOpen(true);
        dom.expertNameInput.focus();
        dom.expertNameInput.select();
        sfx.switchUnit();
        flashInstructionsSaved("ADDED!");
    }

    function deleteActiveExpert() {
        if (state.experts.length <= 1) {
            flashInstructionsSaved("MIN 1 UNIT");
            return;
        }
        sfx.click();
        if (!state.deleteExpertArmed) {
            state.deleteExpertArmed = true;
            dom.deleteExpertBtn.textContent = "SURE?";
            state.deleteExpertTimeout = setTimeout(resetDeleteExpertArm, 3000);
            return;
        }

        resetDeleteExpertArm();
        const idx = state.experts.findIndex((e) => e.id === state.selectedId);
        if (idx === -1) return;

        const removed = state.experts[idx];
        state.experts.splice(idx, 1);
        delete state.slicedSprites[removed.id];
        delete state.customSpriteImages[removed.id];

        // Re-index slots cleanly
        state.experts.forEach((exp, i) => {
            exp.slot = i + 1;
        });

        const nextExpert = state.experts[Math.min(idx, state.experts.length - 1)];
        state.selectedId = nextExpert.id;
        if (state.activeThreadId === removed.id) {
            state.activeThreadId = nextExpert.id;
            state.activeBranchLabel = null;
            ensureThreadGreeting(nextExpert.id);
        }

        saveExpertOverrides();
        savePrefs();
        buildRosterGrid();
        setInstructionsOpen(false);
        syncExpertUI();
        renderActiveThread();
        flashInstructionsSaved("DELETED!");
    }

    // =====================================================================
    // 9. CHAT THREAD MANAGEMENT & RENDERING
    // =====================================================================
    function getThread(threadId) {
        if (!state.threads[threadId]) {
            state.threads[threadId] = [];
        }
        return state.threads[threadId];
    }

    function ensureThreadGreeting(expertId) {
        const thread = getThread(expertId);
        if (thread.length === 0) {
            const exp = getExpertById(expertId);
            if (!exp) return;
            thread.push({
                type: "system",
                text: `CHANNEL LINKED TO ${exp.name} [${exp.title}]`,
                time: getFormattedTime()
            });
            thread.push({
                type: "bot",
                expertId: exp.id,
                expertName: exp.name,
                expertTitle: exp.title,
                text: exp.greeting,
                time: getFormattedTime()
            });
            saveThreads();
        }
    }

    function pushThreadMessage(threadId, msg) {
        const thread = getThread(threadId);
        thread.push(msg);
        saveThreads();
        return msg;
    }

    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatMessageHTML(text) {
        let safe = escapeHTML(text);
        // Fenced code blocks
        safe = safe.replace(/```(?:\w+)?\n([\s\S]*?)```/g, "<pre>$1</pre>");
        // Inline code
        safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
        // Bold
        safe = safe.replace(/\*\*([^*]+)\*\*/g, '<span class="text-highlight">$1</span>');
        // Line breaks
        safe = safe.replace(/\n/g, "<br>");
        return safe;
    }

    function scrollToBottom() {
        dom.chatFeed.scrollTop = dom.chatFeed.scrollHeight;
    }

    function buildMsgActionsEl(msgIndex) {
        const wrap = document.createElement("div");
        wrap.className = "msg-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "msg-act-btn";
        editBtn.textContent = "EDIT";
        editBtn.title = "Edit this message";
        editBtn.addEventListener("click", () => startInlineEditMessage(msgIndex));

        const branchBtn = document.createElement("button");
        branchBtn.type = "button";
        branchBtn.className = "msg-act-btn";
        branchBtn.textContent = "BRANCH";
        branchBtn.title = "Branch a new conversation from this message";
        branchBtn.addEventListener("click", () => branchConversationAt(msgIndex));

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "msg-act-btn danger";
        delBtn.textContent = "DEL";
        delBtn.title = "Delete this message";
        delBtn.addEventListener("click", () => deleteMessageAt(msgIndex));

        wrap.appendChild(editBtn);
        wrap.appendChild(branchBtn);
        wrap.appendChild(delBtn);
        return wrap;
    }

    function startInlineEditMessage(msgIndex) {
        if (state.isGenerating) return;
        const thread = getThread(state.activeThreadId);
        const msg = thread[msgIndex];
        if (!msg || msg.type === "system") return;

        const cardEl = dom.chatFeed.querySelector(`[data-msg-index="${msgIndex}"]`);
        if (!cardEl) return;
        const bodyEl = cardEl.querySelector(".msg-body");
        if (!bodyEl || bodyEl.querySelector(".msg-edit-textarea")) return;

        sfx.click();
        bodyEl.innerHTML = "";

        const wrap = document.createElement("div");
        wrap.className = "msg-edit-wrap";

        const ta = document.createElement("textarea");
        ta.className = "msg-edit-textarea terminal-scroll";
        ta.value = msg.text;
        ta.spellcheck = false;

        const btns = document.createElement("div");
        btns.className = "msg-edit-btns";

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "btn-solid btn-xs";
        saveBtn.textContent = "SAVE";
        saveBtn.addEventListener("click", () => {
            const updated = ta.value.trim();
            if (updated) {
                msg.text = updated;
                saveThreads();
                sfx.click();
            }
            renderActiveThread();
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "btn-jrpg btn-xs";
        cancelBtn.textContent = "CANCEL";
        cancelBtn.addEventListener("click", () => {
            sfx.click();
            renderActiveThread();
        });

        btns.appendChild(cancelBtn);
        btns.appendChild(saveBtn);
        wrap.appendChild(ta);
        wrap.appendChild(btns);
        bodyEl.appendChild(wrap);
        ta.focus();
    }

    function deleteMessageAt(msgIndex) {
        if (state.isGenerating) return;
        const thread = getThread(state.activeThreadId);
        if (msgIndex < 0 || msgIndex >= thread.length) return;
        sfx.click();
        thread.splice(msgIndex, 1);
        saveThreads();
        renderActiveThread();
        updateSecondOpinionBar();
    }

    function branchConversationAt(msgIndex = null) {
        if (state.isGenerating) return;
        const sourceThread = getThread(state.activeThreadId);
        if (sourceThread.length === 0) return;

        const sliceEnd = msgIndex === null ? sourceThread.length : msgIndex + 1;
        const cloned = JSON.parse(JSON.stringify(sourceThread.slice(0, sliceEnd)));
        const active = getActiveExpert();
        const branchId = `branch_${Date.now()}`;
        const customName = dom.saveSlotNameInput.value.trim();
        const label = customName || `${getShortName(active.name)} B${state.savedChats.filter((s) => s.isBranch).length + 1}`;

        cloned.push({
            type: "system",
            text:
                msgIndex === null
                    ? `BRANCHED CONVERSATION: ${label}`
                    : `BRANCHED FROM MESSAGE #${sliceEnd}: ${label}`,
            time: getFormattedTime()
        });

        state.threads[branchId] = cloned;
        state.savedChats.unshift({
            id: `save_${Date.now()}`,
            name: label,
            threadId: branchId,
            expertId: active.id,
            isBranch: true,
            createdAt: new Date().toLocaleString(),
            messages: JSON.parse(JSON.stringify(cloned))
        });

        state.activeThreadId = branchId;
        state.activeBranchLabel = label;
        dom.saveSlotNameInput.value = "";

        saveThreads();
        saveSavedChats();
        syncExpertUI();
        renderActiveThread();
        renderSavesList();
        sfx.switchUnit();
    }

    function saveCurrentConversation() {
        const thread = getThread(state.activeThreadId);
        if (thread.length === 0) return;
        const active = getActiveExpert();
        const customName = dom.saveSlotNameInput.value.trim();
        const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const label = customName || `${getShortName(active.name)} ${stamp}`;

        state.savedChats.unshift({
            id: `save_${Date.now()}`,
            name: label,
            threadId: state.activeThreadId,
            expertId: active.id,
            isBranch: Boolean(state.activeBranchLabel),
            createdAt: new Date().toLocaleString(),
            messages: JSON.parse(JSON.stringify(thread))
        });

        dom.saveSlotNameInput.value = "";
        saveSavedChats();
        renderSavesList();
        sfx.transmit();
    }

    function loadSavedConversation(saveId) {
        if (state.isGenerating) return;
        const entry = state.savedChats.find((s) => s.id === saveId);
        if (!entry) return;

        const targetExpert = getExpertById(entry.expertId) || state.experts[0];
        state.selectedId = targetExpert.id;

        if (entry.isBranch && entry.threadId) {
            state.activeThreadId = entry.threadId;
            state.activeBranchLabel = entry.name;
            if (!state.threads[entry.threadId] || state.threads[entry.threadId].length === 0) {
                state.threads[entry.threadId] = JSON.parse(JSON.stringify(entry.messages || []));
            }
        } else {
            const loadedThreadId = `loaded_${entry.id}`;
            state.threads[loadedThreadId] = JSON.parse(JSON.stringify(entry.messages || []));
            state.activeThreadId = loadedThreadId;
            state.activeBranchLabel = entry.name;
        }

        saveThreads();
        savePrefs();
        setInstructionsOpen(false);
        syncExpertUI();
        renderActiveThread();
        renderSavesList();
        dom.savesDrawer.classList.add("hidden");
        sfx.switchUnit();
    }

    function deleteSavedConversation(saveId) {
        const idx = state.savedChats.findIndex((s) => s.id === saveId);
        if (idx === -1) return;
        state.savedChats.splice(idx, 1);
        saveSavedChats();
        renderSavesList();
        sfx.click();
    }

    function exportCurrentConversation() {
        const thread = getThread(state.activeThreadId);
        const active = getActiveExpert();
        const title = state.activeBranchLabel || active.name;
        const lines = [`# ${title}`, `Exported: ${new Date().toLocaleString()}`, ""];

        thread.forEach((m) => {
            if (m.type === "system") {
                lines.push(`> *${m.text}* [${m.time || ""}]`, "");
            } else if (m.type === "user") {
                lines.push(`### YOU [${m.time || ""}]`, m.text, "");
            } else {
                lines.push(`### ${m.expertName || active.name} (${m.expertTitle || active.title}) [${m.time || ""}]`, m.text, "");
            }
        });

        const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        sfx.click();
    }

    function renderSavesList() {
        dom.savesList.innerHTML = "";
        if (state.savedChats.length === 0) {
            dom.savesList.innerHTML = `<div class="saves-empty">NO SAVED CONVERSATIONS OR BRANCHES YET.</div>`;
            return;
        }

        state.savedChats.forEach((entry) => {
            const row = document.createElement("div");
            const isCurrent = entry.threadId === state.activeThreadId && state.activeBranchLabel === entry.name;
            row.className = `save-item ${isCurrent ? "active-save" : ""}`;

            const meta = document.createElement("div");
            meta.className = "save-item-meta";
            const msgCount = (entry.messages || []).filter((m) => m.type !== "system").length;
            meta.innerHTML = `
                <div class="save-item-title">${entry.isBranch ? '<span class="save-tag-branch">[BRANCH]</span>' : ""}${escapeHTML(entry.name)}</div>
                <div class="save-item-sub">${msgCount} MSGS // ${escapeHTML(entry.createdAt || "")}</div>
            `;

            const acts = document.createElement("div");
            acts.className = "save-item-actions";

            const loadBtn = document.createElement("button");
            loadBtn.type = "button";
            loadBtn.className = "btn-mini";
            loadBtn.textContent = "LOAD";
            loadBtn.addEventListener("click", () => loadSavedConversation(entry.id));

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "btn-mini text-danger";
            delBtn.textContent = "DEL";
            delBtn.addEventListener("click", () => deleteSavedConversation(entry.id));

            acts.appendChild(loadBtn);
            acts.appendChild(delBtn);

            row.appendChild(meta);
            row.appendChild(acts);
            dom.savesList.appendChild(row);
        });
    }

    function createMessageElement(msg, msgIndex = null) {
        if (msg.type === "context_reset") {
            const el = document.createElement("div");
            el.className = "ctx-reset-banner";
            el.innerHTML = `<span>▶ ${escapeHTML(msg.text)}</span><span class="msg-time">[${escapeHTML(msg.time || "")}]</span>`;
            return el;
        }

        if (msg.type === "system") {
            const el = document.createElement("div");
            el.className = "sys-banner";
            el.innerHTML = `<span>▶ ${escapeHTML(msg.text)}</span><span class="msg-time">[${escapeHTML(msg.time || "")}]</span>`;
            return el;
        }

        if (msg.type === "user") {
            const el = document.createElement("div");
            el.className = "msg-user";
            if (msgIndex !== null) el.dataset.msgIndex = String(msgIndex);

            const header = document.createElement("div");
            header.className = "msg-header";

            const speaker = document.createElement("span");
            speaker.className = "msg-speaker-name";
            speaker.textContent = "▶ YOU";

            const right = document.createElement("div");
            right.className = "msg-header-right";
            if (msgIndex !== null) right.appendChild(buildMsgActionsEl(msgIndex));

            const timeEl = document.createElement("span");
            timeEl.className = "msg-time";
            timeEl.textContent = `[${msg.time || ""}]`;
            right.appendChild(timeEl);

            header.appendChild(speaker);
            header.appendChild(right);

            const body = document.createElement("div");
            body.className = "msg-body";
            body.innerHTML = formatMessageHTML(msg.text);

            el.appendChild(header);
            el.appendChild(body);
            return el;
        }

        // Bot message
        const exp = getExpertById(msg.expertId) || getActiveExpert();
        const speakerName = msg.expertName || exp.name;
        const speakerTitle = msg.expertTitle || exp.title;

        const el = document.createElement("div");
        el.className = "msg-bot";
        if (msgIndex !== null) el.dataset.msgIndex = String(msgIndex);

        const header = document.createElement("div");
        header.className = "msg-header";

        const left = document.createElement("div");
        left.className = "msg-speaker-meta";

        const badge = document.createElement("canvas");
        badge.width = 26;
        badge.height = 26;
        badge.className = "pixel-canvas msg-badge-canvas";
        badge.dataset.badgeExpert = exp.id;
        drawMiniBadge(badge, exp.id);

        const labelWrap = document.createElement("div");
        labelWrap.style.display = "flex";
        labelWrap.style.alignItems = "center";
        labelWrap.style.gap = "6px";
        labelWrap.style.flexWrap = "wrap";
        labelWrap.innerHTML = `
            <span class="msg-speaker-name">▶ ${escapeHTML(speakerName)}</span>
            <span class="msg-speaker-role">${escapeHTML(speakerTitle)}</span>
        `;

        left.appendChild(badge);
        left.appendChild(labelWrap);

        const right = document.createElement("div");
        right.className = "msg-header-right";
        if (msgIndex !== null) right.appendChild(buildMsgActionsEl(msgIndex));

        const timeEl = document.createElement("span");
        timeEl.className = "msg-time";
        timeEl.textContent = `[${msg.time || ""}]`;
        right.appendChild(timeEl);

        header.appendChild(left);
        header.appendChild(right);

        const body = document.createElement("div");
        body.className = "msg-body";
        body.innerHTML = formatMessageHTML(msg.text);

        el.appendChild(header);
        el.appendChild(body);
        return el;
    }

    function renderActiveThread() {
        dom.chatFeed.innerHTML = "";
        const thread = getThread(state.activeThreadId);
        thread.forEach((msg, idx) => {
            dom.chatFeed.appendChild(createMessageElement(msg, idx));
        });
        updateContextMeter();
        scrollToBottom();
    }

    // =====================================================================
    // 10. OPENAI-COMPATIBLE API CLIENT (STREAMING + NON-STREAMING + /MODELS)
    // =====================================================================
    function normalizeBaseUrl(url) {
        return (url || "").trim().replace(/\/+$/, "");
    }

    function buildOpenAIHeaders() {
        const headers = { "Content-Type": "application/json" };
        const key = (state.api.apiKey || "").trim();
        if (key) {
            headers["Authorization"] = `Bearer ${key}`;
        }
        // Helpful optional headers for OpenRouter
        if (state.api.baseUrl.includes("openrouter.ai")) {
            headers["X-Title"] = "16-Bit Expert Terminal";
        }
        return headers;
    }

    function setApiStatus(text, kind = "ok") {
        dom.apiStatusBadge.textContent = text;
        dom.apiStatusBadge.classList.remove("error", "busy");
        if (kind === "error") dom.apiStatusBadge.classList.add("error");
        if (kind === "busy") dom.apiStatusBadge.classList.add("busy");
    }

    function showApiFeedback(text, isError = false) {
        dom.apiFeedback.textContent = text;
        dom.apiFeedback.classList.remove("hidden", "error");
        if (isError) dom.apiFeedback.classList.add("error");
    }

    function buildMessagesPayload(threadId, activeExpert, extraUserPrompt = null) {
        const thread = getThread(threadId);
        const systemContent = [
            activeExpert.systemPrompt,
            NO_EMOJI_HARD_RULE,
            state.secondOpinionMode
                ? `You are currently participating in a multi-expert conversation as ${activeExpert.name} (${activeExpert.title}). Previous replies in the thread may come from other experts—offer your own distinct perspective from your area of expertise.`
                : ""
        ].filter(Boolean).join("\n\n");

        const messages = [{ role: "system", content: systemContent }];

        // Only include messages after the most recent context reset marker
        let startIdx = 0;
        for (let i = thread.length - 1; i >= 0; i--) {
            if (thread[i].type === "context_reset") {
                startIdx = i + 1;
                break;
            }
        }

        for (let i = startIdx; i < thread.length; i++) {
            const m = thread[i];
            if (m.type === "user") {
                messages.push({ role: "user", content: m.text });
            } else if (m.type === "bot") {
                // Prefix other experts' replies so the active expert knows who said what
                const prefix =
                    m.expertId && m.expertId !== activeExpert.id
                        ? `[${m.expertName || m.expertId} (${m.expertTitle || "Expert"})]: `
                        : "";
                messages.push({ role: "assistant", content: prefix + m.text });
            }
        }

        if (extraUserPrompt) {
            messages.push({ role: "user", content: extraUserPrompt });
        }

        return messages;
    }

    async function sendChatCompletion({ promptText = null, isSecondOpinionAuto = false }) {
        if (state.isGenerating) return;

        const baseUrl = normalizeBaseUrl(state.api.baseUrl);
        const model = (state.api.model || "").trim();

        if (!baseUrl) {
            showApiFeedback("SET A BASE URL FIRST", true);
            setApiStatus("NO URL", "error");
            return;
        }
        if (!model) {
            showApiFeedback("SET A MODEL ID FIRST", true);
            setApiStatus("NO MODEL", "error");
            return;
        }

        const activeExpert = getActiveExpert();
        const threadId = state.activeThreadId;

        state.isGenerating = true;
        state.pendingOpinionSwitch = false;
        state.abortController = new AbortController();

        dom.commandInput.disabled = true;
        dom.transmitBtn.classList.add("hidden");
        dom.stopBtn.classList.remove("hidden");
        updateSecondOpinionBar();
        setApiStatus("LINKING", "busy");
        sfx.transmit();

        if (promptText) {
            const userMsg = pushThreadMessage(threadId, {
                type: "user",
                text: promptText,
                time: getFormattedTime()
            });
            dom.chatFeed.appendChild(createMessageElement(userMsg));
            scrollToBottom();
        }

        const extraInstruction = isSecondOpinionAuto
            ? `Please give your second opinion as ${activeExpert.name} (${activeExpert.title}) on the conversation above.`
            : null;

        const messagesPayload = buildMessagesPayload(threadId, activeExpert, extraInstruction);

        // Create live bot message card
        const botMsgObj = {
            type: "bot",
            expertId: activeExpert.id,
            expertName: activeExpert.name,
            expertTitle: activeExpert.title,
            text: "",
            time: getFormattedTime()
        };
        const cardEl = createMessageElement(botMsgObj);
        const bodyEl = cardEl.querySelector(".msg-body");
        bodyEl.innerHTML = `<span class="text-dim">THINKING...</span><span class="cursor-block"></span>`;
        dom.chatFeed.appendChild(cardEl);
        scrollToBottom();

        const endpoint = `${baseUrl}/chat/completions`;
        const body = {
            model,
            messages: messagesPayload,
            temperature: Number.isFinite(Number(state.api.temperature)) ? Number(state.api.temperature) : 0.7,
            stream: Boolean(state.api.stream)
        };

        let fullReply = "";
        let blipCounter = 0;

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: buildOpenAIHeaders(),
                body: JSON.stringify(body),
                signal: state.abortController.signal
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                throw new Error(`HTTP ${res.status}${errText ? ": " + errText.slice(0, 140) : ""}`);
            }

            const contentType = res.headers.get("content-type") || "";
            if (state.api.stream && res.body && contentType.includes("text/event-stream")) {
                const reader = res.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let buffer = "";

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });

                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const rawLine of lines) {
                        const line = rawLine.trim();
                        if (!line.startsWith("data:")) continue;
                        const dataStr = line.slice(5).trim();
                        if (!dataStr || dataStr === "[DONE]") continue;
                        try {
                            const parsed = JSON.parse(dataStr);
                            const delta = parsed?.choices?.[0]?.delta?.content;
                            if (typeof delta === "string" && delta.length > 0) {
                                fullReply += delta;
                                bodyEl.innerHTML = formatMessageHTML(fullReply) + '<span class="cursor-block"></span>';
                                blipCounter++;
                                if (blipCounter % 5 === 0) sfx.blip();
                                scrollToBottom();
                            }
                        } catch (_) {
                            // Skip non-JSON SSE keepalive chunks
                        }
                    }
                }
                bodyEl.innerHTML = formatMessageHTML(fullReply || "(Empty response)");
            } else {
                // Non-streaming JSON response + retro typewriter
                const data = await res.json();
                fullReply =
                    data?.choices?.[0]?.message?.content ||
                    data?.choices?.[0]?.text ||
                    "(Empty response)";
                sfx.receive();
                await typewriteInto(bodyEl, fullReply);
            }

            botMsgObj.text = fullReply || "(Empty response)";
            pushThreadMessage(threadId, botMsgObj);
            renderActiveThread();
            setApiStatus("ONLINE", "ok");
            showApiFeedback(`OK // ${model}`);
        } catch (err) {
            if (err.name === "AbortError") {
                botMsgObj.text = fullReply ? `${fullReply}\n\n[TRANSMISSION HALTED]` : "[TRANSMISSION HALTED]";
                pushThreadMessage(threadId, botMsgObj);
                renderActiveThread();
                setApiStatus("STOPPED", "busy");
            } else {
                const errMsg = `[API ERROR] ${err.message}\nCheck Base URL, Model ID, API Key, or local CORS settings (e.g. enable CORS in LM Studio).`;
                botMsgObj.text = errMsg;
                pushThreadMessage(threadId, botMsgObj);
                renderActiveThread();
                setApiStatus("ERROR", "error");
                showApiFeedback(err.message.slice(0, 48), true);
            }
        } finally {
            state.isGenerating = false;
            state.abortController = null;
            dom.commandInput.disabled = false;
            dom.transmitBtn.classList.remove("hidden");
            dom.stopBtn.classList.add("hidden");
            dom.commandInput.focus();
            updateSecondOpinionBar();
            scrollToBottom();
        }
    }

    function typewriteInto(el, text) {
        return new Promise((resolve) => {
            let idx = 0;
            const total = text.length;
            const step = total > 500 ? 6 : total > 200 ? 3 : 2;
            function tick() {
                if (idx < total) {
                    idx = Math.min(total, idx + step);
                    el.innerHTML = formatMessageHTML(text.slice(0, idx)) + '<span class="cursor-block"></span>';
                    if (idx % (step * 4) === 0) sfx.blip();
                    scrollToBottom();
                    setTimeout(tick, 12);
                } else {
                    el.innerHTML = formatMessageHTML(text);
                    scrollToBottom();
                    resolve();
                }
            }
            tick();
        });
    }

    async function fetchAvailableModels() {
        const baseUrl = normalizeBaseUrl(state.api.baseUrl);
        if (!baseUrl) {
            showApiFeedback("ENTER BASE URL FIRST", true);
            return;
        }
        sfx.click();
        setApiStatus("FETCH...", "busy");
        dom.fetchModelsBtn.disabled = true;

        try {
            const res = await fetch(`${baseUrl}/models`, {
                method: "GET",
                headers: buildOpenAIHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
            const ids = [];

            list.forEach((m) => {
                const id = typeof m === "string" ? m : m?.id;
                if (!id) return;
                ids.push(id);
                const ctxLen =
                    m?.context_length ||
                    m?.max_context_length ||
                    m?.max_model_len ||
                    m?.model_spec?.availableContextTokens ||
                    m?.top_provider?.context_length;
                if (Number.isFinite(Number(ctxLen)) && Number(ctxLen) >= 512) {
                    state.modelContextMap[id] = Number(ctxLen);
                }
            });
            ids.sort();
            safeWriteJSON(STORAGE_KEYS.MODEL_CTX, state.modelContextMap);

            dom.apiModelList.innerHTML = "";
            ids.forEach((id) => {
                const opt = document.createElement("option");
                opt.value = id;
                dom.apiModelList.appendChild(opt);
            });

            if (ids.length > 0 && !dom.apiModelInput.value.trim()) {
                dom.apiModelInput.value = ids[0];
                state.api.model = ids[0];
                saveApiConfig();
            }

            updateContextMeter();
            setApiStatus("ONLINE", "ok");
            showApiFeedback(`LOADED ${ids.length} MODELS`);
        } catch (err) {
            setApiStatus("ERROR", "error");
            showApiFeedback(`FETCH FAILED: ${err.message.slice(0, 32)}`, true);
        } finally {
            dom.fetchModelsBtn.disabled = false;
        }
    }

    // =====================================================================
    // 11. EVENT LISTENERS
    // =====================================================================
    function syncApiInputsFromState() {
        dom.apiPresetSelect.value = state.api.preset || "custom";
        dom.apiBaseUrl.value = state.api.baseUrl || "";
        dom.apiKeyInput.value = state.api.apiKey || "";
        dom.apiModelInput.value = state.api.model || "";
        dom.apiTempInput.value = state.api.temperature ?? 0.7;
        dom.apiCtxInput.value = state.api.contextOverride || "";
        dom.toggleStreamBtn.textContent = state.api.stream ? "STREAM: ON" : "STREAM: OFF";
        dom.toggleStreamBtn.classList.toggle("text-highlight", state.api.stream);
    }

    function flashInstructionsSaved(msg = "SAVED!") {
        dom.instructionsFeedback.textContent = msg;
        dom.instructionsFeedback.classList.add("visible");
        clearTimeout(flashInstructionsSaved._timer);
        flashInstructionsSaved._timer = setTimeout(() => {
            dom.instructionsFeedback.classList.remove("visible");
        }, 1400);
    }

    function applyExpertEdits(playSound = false) {
        const exp = getActiveExpert();
        const newName = dom.expertNameInput.value.trim() || exp.name;
        const newTitle = dom.expertTitleInput.value.trim() || exp.title;
        exp.name = newName;
        exp.title = newTitle;
        exp.systemPrompt = dom.systemPromptInput.value;
        saveExpertOverrides();
        syncExpertUI();
        if (playSound) sfx.click();
        flashInstructionsSaved("SAVED!");
    }

    function wireEvents() {
        // Chat submit
        dom.commandForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const text = dom.commandInput.value.trim();
            if (!text || state.isGenerating) return;
            dom.commandInput.value = "";
            sendChatCompletion({ promptText: text });
        });

        dom.commandInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                dom.commandForm.requestSubmit();
            }
        });

        dom.commandInput.addEventListener("input", updateContextMeter);

        dom.stopBtn.addEventListener("click", () => {
            if (state.abortController) {
                sfx.click();
                state.abortController.abort();
            }
        });

        // Second Opinion Toggle
        dom.toggleSecondOpinionBtn.addEventListener("click", () => {
            state.secondOpinionMode = !state.secondOpinionMode;
            state.pendingOpinionSwitch = false;
            sfx.click();
            savePrefs();

            dom.toggleSecondOpinionBtn.textContent = state.secondOpinionMode ? "2ND OPINION: ON" : "2ND OPINION: OFF";
            dom.toggleSecondOpinionBtn.classList.toggle("active", state.secondOpinionMode);

            if (!state.secondOpinionMode) {
                // Returning to 1-on-1 mode switches back to the active expert's own thread
                state.activeThreadId = state.selectedId;
                state.activeBranchLabel = null;
                ensureThreadGreeting(state.activeThreadId);
                renderActiveThread();
            } else {
                pushThreadMessage(state.activeThreadId, {
                    type: "system",
                    text: "2ND OPINION MODE ON // PICK ANY EXPERT ON THE RIGHT TO JOIN THIS THREAD",
                    time: getFormattedTime()
                });
                renderActiveThread();
            }
            syncExpertUI();
        });

        dom.askSecondOpinionBtn.addEventListener("click", () => {
            sendChatCompletion({ isSecondOpinionAuto: true });
        });

        // Saves & Branches Drawer
        dom.openSavesBtn.addEventListener("click", () => {
            sfx.click();
            dom.savesDrawer.classList.toggle("hidden");
            if (!dom.savesDrawer.classList.contains("hidden")) {
                renderSavesList();
            }
        });

        dom.closeSavesBtn.addEventListener("click", () => {
            sfx.click();
            dom.savesDrawer.classList.add("hidden");
        });

        dom.saveChatBtn.addEventListener("click", saveCurrentConversation);
        dom.branchCurrentBtn.addEventListener("click", () => branchConversationAt(null));
        dom.exportChatBtn.addEventListener("click", exportCurrentConversation);

        // Add / Delete Expert
        dom.addExpertBtn.addEventListener("click", addCustomExpert);
        dom.deleteExpertBtn.addEventListener("click", deleteActiveExpert);

        // Clear Context (keeps chat log visible, resets AI memory from this point)
        dom.clearContextBtn.addEventListener("click", () => {
            if (state.isGenerating) return;
            const thread = getThread(state.activeThreadId);
            // Avoid stacking duplicate reset banners back-to-back
            if (thread.length > 0 && thread[thread.length - 1].type === "context_reset") {
                sfx.click();
                updateContextMeter();
                return;
            }
            sfx.switchUnit();
            pushThreadMessage(state.activeThreadId, {
                type: "context_reset",
                text: "CONTEXT CLEARED // FRESH MEMORY STARTS HERE",
                time: getFormattedTime()
            });
            renderActiveThread();
        });

        // SFX Toggle
        dom.toggleSfxBtn.addEventListener("click", () => {
            state.sfxEnabled = !state.sfxEnabled;
            if (state.sfxEnabled) sfx.click();
            dom.toggleSfxBtn.textContent = state.sfxEnabled ? "SFX: ON" : "SFX: OFF";
            savePrefs();
        });

        // Two-step safe Clear
        dom.clearLogBtn.addEventListener("click", () => {
            sfx.click();
            if (!state.clearConfirmArmed) {
                state.clearConfirmArmed = true;
                dom.clearLogBtn.textContent = "CONFIRM?";
                state.clearConfirmTimeout = setTimeout(() => {
                    state.clearConfirmArmed = false;
                    dom.clearLogBtn.textContent = "CLEAR";
                }, 3000);
            } else {
                clearTimeout(state.clearConfirmTimeout);
                state.clearConfirmArmed = false;
                dom.clearLogBtn.textContent = "CLEAR";
                state.threads[state.activeThreadId] = [];
                saveThreads();
                ensureThreadGreeting(state.activeThreadId);
                renderActiveThread();
            }
        });

        // Chroma-key Toggle
        dom.toggleChromaKeyBtn.addEventListener("click", () => {
            state.chromaKeyEnabled = !state.chromaKeyEnabled;
            sfx.click();
            dom.toggleChromaKeyBtn.textContent = state.chromaKeyEnabled ? "BG KEY: ON" : "BG KEY: OFF";
            savePrefs();
            rebuildAllSprites();
        });

        // Custom single sprite upload for active expert (persisted as compact data URL)
        dom.customSpriteInput.addEventListener("change", (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const exp = getActiveExpert();
                    // Downscale huge uploads slightly so localStorage stays lightweight
                    const maxDim = 256;
                    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                    const c = document.createElement("canvas");
                    c.width = Math.max(1, Math.round(img.width * scale));
                    c.height = Math.max(1, Math.round(img.height * scale));
                    const cCtx = c.getContext("2d");
                    cCtx.imageSmoothingEnabled = false;
                    cCtx.drawImage(img, 0, 0, c.width, c.height);

                    exp.customSpriteDataUrl = c.toDataURL("image/png");
                    state.customSpriteImages[exp.id] = img;
                    saveExpertOverrides();
                    rebuildExpertSprite(exp);
                    refreshRosterThumbnails();
                    refreshChatBadges();
                    syncExpertUI();
                    sfx.switchUnit();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
            dom.customSpriteInput.value = "";
        });

        dom.resetSpriteBtn.addEventListener("click", () => {
            const exp = getActiveExpert();
            delete state.customSpriteImages[exp.id];
            delete exp.customSpriteDataUrl;
            saveExpertOverrides();
            rebuildExpertSprite(exp);
            refreshRosterThumbnails();
            refreshChatBadges();
            syncExpertUI();
            sfx.click();
        });

        // API Settings listeners
        dom.apiPresetSelect.addEventListener("change", () => {
            const key = dom.apiPresetSelect.value;
            const preset = window.API_PRESETS[key];
            state.api.preset = key;
            if (preset && key !== "custom") {
                state.api.baseUrl = preset.baseUrl;
                state.api.model = preset.defaultModel;
            }
            syncApiInputsFromState();
            saveApiConfig();
            updateContextMeter();
            sfx.click();
            showApiFeedback(`PRESET: ${preset ? preset.label.toUpperCase() : "CUSTOM"}`);
        });

        dom.apiBaseUrl.addEventListener("input", () => {
            state.api.baseUrl = dom.apiBaseUrl.value.trim();
            saveApiConfig();
        });

        dom.apiKeyInput.addEventListener("input", () => {
            state.api.apiKey = dom.apiKeyInput.value;
            saveApiConfig();
        });

        dom.toggleKeyVisBtn.addEventListener("click", () => {
            const isHidden = dom.apiKeyInput.type === "password";
            dom.apiKeyInput.type = isHidden ? "text" : "password";
            dom.toggleKeyVisBtn.textContent = isHidden ? "HIDE" : "SHOW";
            sfx.click();
        });

        dom.apiModelInput.addEventListener("input", () => {
            state.api.model = dom.apiModelInput.value.trim();
            saveApiConfig();
            updateContextMeter();
        });

        dom.apiCtxInput.addEventListener("input", () => {
            const raw = dom.apiCtxInput.value.trim();
            state.api.contextOverride = raw;
            saveApiConfig();
            updateContextMeter();
        });

        dom.apiTempInput.addEventListener("change", () => {
            const val = Math.max(0, Math.min(2, parseFloat(dom.apiTempInput.value) || 0.7));
            state.api.temperature = val;
            dom.apiTempInput.value = val;
            saveApiConfig();
        });

        dom.toggleStreamBtn.addEventListener("click", () => {
            state.api.stream = !state.api.stream;
            dom.toggleStreamBtn.textContent = state.api.stream ? "STREAM: ON" : "STREAM: OFF";
            dom.toggleStreamBtn.classList.toggle("text-highlight", state.api.stream);
            saveApiConfig();
            sfx.click();
        });

        dom.fetchModelsBtn.addEventListener("click", fetchAvailableModels);

        // Per-Expert Profile & System Instructions listeners
        dom.togglePromptVisBtn.addEventListener("click", () => {
            sfx.click();
            setInstructionsOpen(!state.instructionsOpen);
        });

        dom.openPromptBoxBtn.addEventListener("click", () => {
            sfx.click();
            setInstructionsOpen(true);
        });

        dom.saveExpertBtn.addEventListener("click", () => applyExpertEdits(true));

        let autoSaveTimer = null;
        const scheduleAutoSave = () => {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(() => applyExpertEdits(false), 350);
        };
        dom.expertNameInput.addEventListener("input", scheduleAutoSave);
        dom.expertTitleInput.addEventListener("input", scheduleAutoSave);
        dom.systemPromptInput.addEventListener("input", scheduleAutoSave);

        dom.resetExpertBtn.addEventListener("click", () => {
            const exp = getActiveExpert();
            const def = window.DEFAULT_EXPERTS.find((d) => d.id === exp.id);
            if (def) {
                exp.name = def.name;
                exp.title = def.title;
                exp.systemPrompt = def.systemPrompt;
            } else {
                exp.name = `EXPERT ${exp.slot}`;
                exp.title = "SPECIALIST";
                exp.systemPrompt = "You are a helpful, knowledgeable specialist. Give clear, concise, practical answers tailored to the user's needs.";
            }
            saveExpertOverrides();
            syncExpertUI();
            sfx.click();
            flashInstructionsSaved("RESET!");
        });
    }

    // =====================================================================
    // 12. LOCAL LAUNCHER KEEPALIVE (SSE — IMMUNE TO BACKGROUND TAB THROTTLING)
    // =====================================================================
    function startLauncherHeartbeat() {
        const host = window.location.hostname;
        if (host !== "127.0.0.1" && host !== "localhost") return;

        let es = null;
        if (typeof window.EventSource === "function") {
            es = new EventSource("/__events");
            es.onerror = () => {
                // If hosted by a plain static server without /__events, stop reconnecting
                if (es && es.readyState === EventSource.CLOSED) {
                    es = null;
                }
            };
        }

        const notifyShutdown = () => {
            if (es) {
                es.close();
                es = null;
            }
            if (navigator.sendBeacon) {
                navigator.sendBeacon("/__shutdown");
            }
        };

        window.addEventListener("pagehide", notifyShutdown);
        window.addEventListener("beforeunload", notifyShutdown);
    }

    // =====================================================================
    // 13. BOOT SEQUENCE
    // =====================================================================
    async function init() {
        startLauncherHeartbeat();
        loadPersistedState();
        syncApiInputsFromState();

        dom.toggleSfxBtn.textContent = state.sfxEnabled ? "SFX: ON" : "SFX: OFF";
        dom.toggleChromaKeyBtn.textContent = state.chromaKeyEnabled ? "BG KEY: ON" : "BG KEY: OFF";
        dom.toggleSecondOpinionBtn.textContent = state.secondOpinionMode ? "2ND OPINION: ON" : "2ND OPINION: OFF";
        dom.toggleSecondOpinionBtn.classList.toggle("active", state.secondOpinionMode);

        buildRosterGrid();
        ensureThreadGreeting(state.activeThreadId);
        syncExpertUI();
        renderActiveThread();
        wireEvents();

        requestAnimationFrame(renderViewportLoop);
        await loadAllSpriteSheets();
    }

    window.addEventListener("DOMContentLoaded", init);
})();
