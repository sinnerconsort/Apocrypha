// Apocrypha — state.js
// Global settings (extension_settings) + per-chat state (chat_metadata).

import { extension_settings, getContext } from '../../../../extensions.js';
import { saveSettingsDebounced, chat_metadata, saveChatDebounced } from '../../../../../script.js';
import { EXT_ID, DEFAULT_SETTINGS, defaultChatState, STAGES, LOG_PREFIX } from './config.js';

// ── Global settings ──────────────────────────────────────────────────

export function initSettings() {
    if (!extension_settings[EXT_ID]) {
        extension_settings[EXT_ID] = structuredClone(DEFAULT_SETTINGS);
    }
    sanitizeSettings();
}

export function getSettings() {
    if (!extension_settings[EXT_ID]) initSettings();
    return extension_settings[EXT_ID];
}

export function saveSettings() {
    saveSettingsDebounced();
}

function sanitizeSettings() {
    const s = extension_settings[EXT_ID];
    for (const k in DEFAULT_SETTINGS) {
        if (s[k] === undefined) s[k] = structuredClone(DEFAULT_SETTINGS[k]);
    }
    if (typeof s.enabled !== 'boolean') s.enabled = true;
    if (!['dormant', 'patient', 'restless', 'ravenous'].includes(s.hunger)) s.hunger = 'patient';
    s.ritual = Math.max(0, Math.min(STAGES.length - 1, parseInt(s.ritual) || 0));
    if (isNaN(parseInt(s.whisperCooldown))) s.whisperCooldown = 3;
    if (isNaN(parseInt(s.maxWhisperTokens))) s.maxWhisperTokens = 250;
}

// ── Per-chat state ───────────────────────────────────────────────────

export function getChatState() {
    if (!chat_metadata) return null;
    if (!chat_metadata[EXT_ID]) {
        chat_metadata[EXT_ID] = defaultChatState();
        // Apply the ritual floor for new chats
        const s = getSettings();
        if (s.ritual > 0) {
            applyRitualFloor(chat_metadata[EXT_ID], s.ritual);
        }
    }
    sanitizeChatState(chat_metadata[EXT_ID]);
    return chat_metadata[EXT_ID];
}

export function saveChatState() {
    try {
        saveChatDebounced();
    } catch (e) {
        console.error(LOG_PREFIX, 'saveChatState failed:', e);
    }
}

function sanitizeChatState(st) {
    const d = defaultChatState();
    for (const k in d) {
        if (st[k] === undefined) st[k] = d[k];
    }
    if (!Array.isArray(st.whisperMemory)) st.whisperMemory = [];
    if (!Array.isArray(st.log)) st.log = [];
    if (typeof st.whispers !== 'object' || st.whispers === null) st.whispers = {};
    if (isNaN(parseFloat(st.attention))) st.attention = 0;
}

// ── Ritual floor ─────────────────────────────────────────────────────
// Setting a floor raises attention to that stage's threshold so the
// chat begins already noticed, and progression continues naturally.

export function applyRitualFloor(st, stageIndex) {
    stageIndex = Math.max(0, Math.min(STAGES.length - 1, stageIndex));
    st.ritualFloor = stageIndex;
    st.attention = Math.max(st.attention, STAGES[stageIndex].threshold);
}

// ── Stage helpers ────────────────────────────────────────────────────

export function getStageIndex(st) {
    let idx = 0;
    for (let i = 0; i < STAGES.length; i++) {
        if (st.attention >= STAGES[i].threshold) idx = i;
    }
    if (st.ritualFloor !== null && st.ritualFloor > idx) idx = st.ritualFloor;
    return idx;
}

export function getStage(st) {
    return STAGES[getStageIndex(st)];
}

// ── Debug log ────────────────────────────────────────────────────────

export function logGain(st, amount, reason) {
    st.log.unshift({ ts: Date.now(), amount: Math.round(amount * 10) / 10, reason });
    if (st.log.length > 30) st.log.length = 30;
}
