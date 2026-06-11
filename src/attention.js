// Apocrypha — attention.js
// The hidden stat. Climbs from messages, trigger keywords, and absence.

import { GAINS, HUNGER, LOG_PREFIX } from './config.js';
import { getSettings, getChatState, saveChatState, getStage, getStageIndex, logGain } from './state.js';

function hungerMult() {
    const s = getSettings();
    return HUNGER[s.hunger]?.mult ?? 1.0;
}

function parseKeywords() {
    const s = getSettings();
    return (s.triggerKeywords || '')
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 1);
}

/**
 * Add attention. Returns { gained, stageChanged, newStage }.
 */
export function gainAttention(baseAmount, reason) {
    const st = getChatState();
    if (!st) return null;

    const before = getStageIndex(st);
    const gained = baseAmount * hungerMult();
    st.attention += gained;
    logGain(st, gained, reason);
    const after = getStageIndex(st);
    saveChatState();

    if (after > before) {
        console.log(LOG_PREFIX, `Stage rose: ${before} → ${after} (${getStage(st).name})`);
        return { gained, stageChanged: true, newStage: getStage(st) };
    }
    return { gained, stageChanged: false, newStage: getStage(st) };
}

/**
 * Called when the user sends a message.
 * Base gain + trigger keyword scanning.
 */
export function onUserMessage(text) {
    const st = getChatState();
    if (!st) return;

    gainAttention(GAINS.perUserMessage, 'message sent');

    if (text) {
        const lower = text.toLowerCase();
        const keywords = parseKeywords();
        let kwGain = 0;
        const hits = [];
        for (const kw of keywords) {
            if (lower.includes(kw)) {
                kwGain += GAINS.perKeyword;
                hits.push(kw);
            }
        }
        kwGain = Math.min(kwGain, GAINS.keywordCapPerMessage);
        if (kwGain > 0) {
            gainAttention(kwGain, `spoke of: ${hits.join(', ')}`);
        }
    }

    st.lastSeen = Date.now();
    saveChatState();
}

/**
 * It accrues while you are away.
 * Call on init, chat change, and visibility return.
 */
export function accrueIdle() {
    const st = getChatState();
    if (!st) return;

    const now = Date.now();
    const gapMinutes = (now - (st.lastSeen || now)) / 60000;

    if (gapMinutes >= GAINS.idleMinMinutes) {
        const base = Math.min(GAINS.idleCap, Math.floor(gapMinutes / 10) * GAINS.idlePerTenMinutes);
        if (base > 0) {
            gainAttention(base, `your absence (${Math.round(gapMinutes)} min)`);
        }
    }
    st.lastSeen = now;
    saveChatState();
}

/** Touch lastSeen without accruing (e.g. on every received message). */
export function touch() {
    const st = getChatState();
    if (!st) return;
    st.lastSeen = Date.now();
    saveChatState();
}
