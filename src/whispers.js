// Apocrypha — whispers.js
// The first organ. Walled asides appended beneath messages — visible to
// you, invisible to the model. Until the wall breaks.

import { getContext } from '../../../../extensions.js';
import { chat, setExtensionPrompt, substituteParams } from '../../../../../script.js';
import { getSettings, getChatState, saveChatState, getStage, getStageIndex } from './state.js';
import { generateIndependent } from './generation.js';
import { STAGES, WHISPER_MEMORY_SIZE, CONTEXT_MESSAGES, CONTEXT_CHAR_TRIM, LOG_PREFIX } from './config.js';

const WALLBREAK_KEY = 'APOCRYPHA_WALLBREAK';

// ── Stage voice registers ────────────────────────────────────────────

const REGISTERS = {
    1: `REGISTER — GLIMPSED: Output a single fragment, 2 to 8 words. Broken syntax. Sensory and peripheral — a sound half-heard, a wrongness glimpsed sideways. No complete sentences. No punctuation beyond an ellipsis or a dash. It barely has language yet.`,
    2: `REGISTER — REGARDED: One or two short sentences. Impersonal observation of the scene, the way one might note the behavior of insects. It does not address anyone. It is studying. Cold, precise, faintly curious.`,
    3: `REGISTER — KNOWN: Fluent now. It addresses the user directly but obliquely — "you" — and references something specific they did or said in the recent scene. Calm, patient, unhurried. It has been watching for a long time and is in no rush.`,
    4: `REGISTER — NAMED: Fluent and direct. It knows the user's name and may use it, sparingly. It speaks with the intimacy of long observation — specific details, gentle certainty, quiet possession. Never threats. It does not need to threaten.`,
};

// ── Prompt construction ──────────────────────────────────────────────

function buildWhisperPrompt(stageIndex) {
    const ctx = getContext();
    const st = getChatState();
    const userName = ctx.name1 || 'the user';
    const charName = ctx.name2 || 'the character';

    // Recent scene context, trimmed
    const recent = (chat || [])
        .filter(m => !m.is_system)
        .slice(-CONTEXT_MESSAGES)
        .map(m => {
            let text = (m.mes || '').replace(/<[^>]*>/g, '').trim();
            if (text.length > CONTEXT_CHAR_TRIM) text = text.slice(0, CONTEXT_CHAR_TRIM) + '…';
            return `${m.name}: ${text}`;
        })
        .join('\n');

    // Anti-repetition memory
    const memory = (st.whisperMemory || []).length
        ? `\nIt has already whispered these things. NEVER repeat or echo their imagery, phrasing, or structure:\n${st.whisperMemory.map(w => `- "${w}"`).join('\n')}\n`
        : '';

    const named = stageIndex >= 4 ? `The user's name is ${userName}.` : '';

    return substituteParams(
`You are giving voice to a vast, ancient presence that has begun to notice an ongoing story. It is not malicious. It is worse than malicious: it is indifferent, patient, and increasingly attentive. Its interest is the interest of a tide in a sandcastle.

It observes a scene between ${userName} and ${charName}. The most recent moments:

---
${recent}
---

${REGISTERS[stageIndex] || REGISTERS[1]}
${named}
${memory}
RULES:
- Output ONLY the whisper itself. No quotes, no tags, no labels, no commentary, no reasoning.
- Never use stock cosmic-horror clichés (no "mortal", "insignificant", "ancient ones", "madness").
- Ground it in the actual scene. Specificity is dread.
- Brevity is power. When in doubt, say less.`);
}

// ── Firing logic ─────────────────────────────────────────────────────

let whisperBusy = false;

/**
 * Called after an AI message is received. Rolls against stage chance
 * (respecting cooldown) and generates a walled whisper if it fires.
 */
export async function maybeWhisper(messageIndex, force = false) {
    const s = getSettings();
    const st = getChatState();
    if (!s.enabled || !st || whisperBusy) return;

    const stageIndex = getStageIndex(st);
    const stage = STAGES[stageIndex];

    st.msgsSinceWhisper = (st.msgsSinceWhisper || 0) + 1;

    if (!force) {
        if (stageIndex === 0) { saveChatState(); return; }
        if (st.msgsSinceWhisper <= (parseInt(s.whisperCooldown) || 3)) { saveChatState(); return; }
        if (Math.random() > stage.whisperChance) { saveChatState(); return; }
    }
    if (force && stageIndex === 0) {
        // Forcing at Unnoticed uses the Glimpsed register
        return doWhisper(messageIndex, 1);
    }

    return doWhisper(messageIndex, stageIndex);
}

async function doWhisper(messageIndex, stageIndex) {
    const st = getChatState();
    whisperBusy = true;
    try {
        const prompt = buildWhisperPrompt(stageIndex);
        const text = await generateIndependent(prompt);
        if (!text) return;

        // Persist
        if (!st.whispers[messageIndex]) st.whispers[messageIndex] = [];
        st.whispers[messageIndex].push({ text, stage: stageIndex, ts: Date.now() });
        st.msgsSinceWhisper = 0;

        // Entity memory (anti-repetition)
        st.whisperMemory.push(text);
        if (st.whisperMemory.length > WHISPER_MEMORY_SIZE) st.whisperMemory.shift();

        saveChatState();
        renderWhisper(messageIndex, text, stageIndex);

        // The wall breaks at Named.
        updateWallBreak(text, stageIndex);

        console.log(LOG_PREFIX, `Whisper (stage ${stageIndex}):`, text);
    } catch (e) {
        console.error(LOG_PREFIX, 'Whisper generation failed:', e);
    } finally {
        whisperBusy = false;
    }
}

// ── Wall-break (experimental) ────────────────────────────────────────
// At Named, the latest whisper leaks into actual context at low depth.
// Characters may half-hear it. The architectural wall becomes diegetic.

export function updateWallBreak(latestText, stageIndex) {
    const s = getSettings();
    try {
        if (s.wallBreak && stageIndex >= 4 && latestText) {
            setExtensionPrompt(
                WALLBREAK_KEY,
                `[Something barely perceptible threads through the scene — a voice at the edge of hearing: "${latestText}". Characters may half-hear it, misattribute it, or feel it as unease. Do not name its source.]`,
                1,  // in-chat
                2,  // depth
                false,
                'system',
            );
        } else {
            setExtensionPrompt(WALLBREAK_KEY, '', 1, 2, false, 'system');
        }
    } catch (e) {
        console.warn(LOG_PREFIX, 'wall-break injection failed:', e);
    }
}

export function clearWallBreak() {
    try { setExtensionPrompt(WALLBREAK_KEY, '', 1, 2, false, 'system'); } catch (e) { /* noop */ }
}

// ── Rendering (walled — DOM only, never context) ─────────────────────

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderWhisper(messageIndex, text, stageIndex) {
    const $mes = $(`#chat .mes[mesid="${messageIndex}"]`);
    if (!$mes.length) return;

    const stage = STAGES[stageIndex] || STAGES[1];
    const html = `
        <div class="apocrypha-whisper" style="
            margin: 8px 10px 4px 10px;
            padding: 8px 12px;
            border-left: 2px solid rgba(126, 87, 160, 0.7);
            background: rgba(18, 10, 26, 0.45);
            border-radius: 0 6px 6px 0;
            font-style: italic;
            font-size: 0.9em;
            letter-spacing: 0.3px;
            color: #b9a7cf;
            opacity: 0;
            transition: opacity 1.8s ease;
        ">
            <div style="opacity:.55; font-size:.78em; font-style:normal; text-transform:lowercase; letter-spacing:1px; margin-bottom:3px;">— ${escapeHtml(stage.label || 'at the edge of hearing')}</div>
            <div>${escapeHtml(text)}</div>
        </div>`;

    const $el = $(html);
    const $block = $mes.find('.mes_block');
    ($block.length ? $block : $mes).append($el);

    // Fade in like it was always there
    requestAnimationFrame(() => requestAnimationFrame(() => $el.css('opacity', '0.88')));
}

/** Re-render all stored whispers (on chat load / switch). */
export function renderAllWhispers() {
    const st = getChatState();
    if (!st) return;
    $('#chat .apocrypha-whisper').remove();
    for (const [idx, list] of Object.entries(st.whispers || {})) {
        for (const w of (list || [])) {
            renderWhisper(idx, w.text, w.stage);
        }
    }
}
