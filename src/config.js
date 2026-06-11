// Apocrypha — config.js
// Constants, stages, hunger tiers, attention gain values, default settings.

export const EXT_ID = 'Apocrypha';
export const LOG_PREFIX = '[Apocrypha]';

// ── Stages ──────────────────────────────────────────────────────────
// Attention thresholds define when each stage begins.
// whisperChance = probability a whisper fires after an AI message
// (subject to cooldown). label = the faint header shown above a whisper.
export const STAGES = [
    { key: 'unnoticed', name: 'Unnoticed', threshold: 0,   whisperChance: 0.00, label: '' },
    { key: 'glimpsed',  name: 'Glimpsed',  threshold: 20,  whisperChance: 0.25, label: 'at the edge of hearing' },
    { key: 'regarded',  name: 'Regarded',  threshold: 50,  whisperChance: 0.40, label: 'something regards the scene' },
    { key: 'known',     name: 'Known',     threshold: 95,  whisperChance: 0.55, label: 'it speaks to you' },
    { key: 'named',     name: 'Named',     threshold: 150, whisperChance: 0.70, label: 'it speaks your name' },
];

// ── Hunger (attention gain multiplier) ──────────────────────────────
export const HUNGER = {
    dormant:  { label: 'Dormant — barely stirs',          mult: 0.25 },
    patient:  { label: 'Patient — slow burn (default)',   mult: 1.0  },
    restless: { label: 'Restless — session-length spiral', mult: 2.0 },
    ravenous: { label: 'Ravenous — one-shot horror night', mult: 4.0 },
};

// ── Attention gains (before hunger multiplier) ──────────────────────
export const GAINS = {
    perUserMessage: 1,        // every message you send, it listens
    perKeyword: 5,            // each trigger keyword in a user message
    keywordCapPerMessage: 15, // max keyword gain per message
    idlePerTenMinutes: 1,     // it accrues while you are away
    idleCap: 15,              // max gain from a single absence
    idleMinMinutes: 10,       // absences shorter than this are ignored
};

// ── Whisper memory ───────────────────────────────────────────────────
export const WHISPER_MEMORY_SIZE = 8;   // past whispers fed back as "do not repeat"
export const CONTEXT_MESSAGES = 4;      // recent chat messages given to the whisperer
export const CONTEXT_CHAR_TRIM = 600;   // per-message trim for the whisper prompt

// ── Default global settings ─────────────────────────────────────────
export const DEFAULT_SETTINGS = {
    enabled: true,
    settingsVersion: 1,

    hunger: 'patient',          // dormant | patient | restless | ravenous
    ritual: 0,                  // default starting stage index for NEW chats (0-4)

    triggerKeywords: 'ritual, altar, summon, true name, beneath, the deep, watcher, void, dream, stars, forbidden, worship',

    whisperCooldown: 3,         // min AI messages between whispers
    maxWhisperTokens: 250,      // independent-call budget (generous for reasoning models)

    selectedProfile: 'current', // connection profile name, or 'current'

    wallBreak: true,            // at Named, whispers leak into real context
    showDebugEye: true,         // the debug FAB — disable once tuned
};

// ── Default per-chat state ───────────────────────────────────────────
export function defaultChatState() {
    return {
        attention: 0,
        ritualFloor: null,      // set on first init from settings.ritual
        lastSeen: Date.now(),
        msgsSinceWhisper: 99,
        whisperMemory: [],      // recent whisper texts (anti-repetition)
        whispers: {},           // { messageIndex: [{ text, stage, ts }] }
        log: [],                // debug log of attention gains
    };
}
