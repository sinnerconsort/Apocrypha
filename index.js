// Apocrypha — index.js
// "It was always in the margins. You only started reading them."
//
// v0.1 — the spine (attention engine) + the first organ (Whispers).
// Roadmap: the Witness (walled asides about *you*), the Apocrypha organ
// (fabricated lore injection), full wall-break behavior.

import { eventSource, event_types } from '../../../../script.js';
import { LOG_PREFIX } from './src/config.js';
import { initSettings, getSettings, getChatState } from './src/state.js';
import { onUserMessage, accrueIdle, touch } from './src/attention.js';
import { maybeWhisper, renderAllWhispers, clearWallBreak } from './src/whispers.js';
import { createFab, refreshPanel } from './src/ui.js';
import { addSettingsPanel } from './src/settings.js';

import { chat } from '../../../../script.js';

// ── Event handlers ───────────────────────────────────────────────────

function onMessageSent() {
    try {
        const s = getSettings();
        if (!s.enabled) return;
        const lastUser = [...(chat || [])].reverse().find(m => m.is_user);
        onUserMessage(lastUser?.mes || '');
        refreshPanel();
    } catch (e) {
        console.error(LOG_PREFIX, 'onMessageSent failed:', e);
    }
}

async function onMessageReceived(messageId) {
    try {
        const s = getSettings();
        if (!s.enabled) return;
        touch();

        // Let the message render before we append beneath it
        setTimeout(async () => {
            const idx = typeof messageId === 'number' ? messageId : (chat?.length || 1) - 1;
            await maybeWhisper(idx, false);
            refreshPanel();
        }, 400);
    } catch (e) {
        console.error(LOG_PREFIX, 'onMessageReceived failed:', e);
    }
}

function onChatChanged() {
    try {
        const s = getSettings();
        if (!s.enabled) return;

        clearWallBreak();
        getChatState();   // initialize (applies default ritual on new chats)
        accrueIdle();     // it noticed the silence

        // Re-render stored whispers once the chat DOM settles
        setTimeout(renderAllWhispers, 600);
        refreshPanel();
    } catch (e) {
        console.error(LOG_PREFIX, 'onChatChanged failed:', e);
    }
}

function onVisibility() {
    try {
        if (document.visibilityState === 'visible') {
            const s = getSettings();
            if (!s.enabled) return;
            accrueIdle();
            refreshPanel();
        }
    } catch (e) {
        console.error(LOG_PREFIX, 'onVisibility failed:', e);
    }
}

// ── Init ─────────────────────────────────────────────────────────────

jQuery(async () => {
    try {
        console.log(LOG_PREFIX, 'Initializing…');

        // 1. Settings (non-critical)
        try {
            initSettings();
        } catch (e) {
            console.error(LOG_PREFIX, 'Settings init failed:', e);
        }

        // 2. Settings drawer (non-critical)
        try {
            addSettingsPanel();
        } catch (e) {
            console.error(LOG_PREFIX, 'Settings panel failed:', e);
        }

        const s = getSettings();
        if (!s.enabled) {
            console.log(LOG_PREFIX, 'Disabled. It sleeps.');
            return;
        }

        // 3. Debug eye (non-critical)
        try {
            createFab();
        } catch (e) {
            console.error(LOG_PREFIX, 'FAB failed:', e);
        }

        // 4. Events (critical)
        eventSource.on(event_types.MESSAGE_SENT, onMessageSent);
        eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
        eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
        document.addEventListener('visibilitychange', onVisibility);

        // 5. Current chat
        try {
            onChatChanged();
        } catch (e) {
            console.error(LOG_PREFIX, 'Initial chat load failed:', e);
        }

        console.log(LOG_PREFIX, '✅ It is listening.');
    } catch (e) {
        console.error(LOG_PREFIX, '❌ Critical failure:', e);
        if (typeof toastr !== 'undefined') {
            toastr.error('Apocrypha failed to initialize.', 'Apocrypha', { timeOut: 8000 });
        }
    }
});
