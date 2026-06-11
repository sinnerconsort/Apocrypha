// Apocrypha — ui.js
// The debug eye. FAB on #form_sheld (flat Lexicon pattern, inline styles,
// z-index 31000) opening a panel with the attention readout you'll need
// while tuning — users of the finished thing never see the number.

import { getSettings, getChatState, saveChatState, getStage, getStageIndex, applyRitualFloor, logGain } from './state.js';
import { STAGES, HUNGER, defaultChatState, EXT_ID } from './config.js';
import { gainAttention } from './attention.js';
import { maybeWhisper, renderAllWhispers, clearWallBreak } from './whispers.js';
import { chat, chat_metadata } from '../../../../../script.js';

const FAB_ID = 'apocrypha-fab';
const PANEL_ID = 'apocrypha-panel';

// ── FAB ──────────────────────────────────────────────────────────────

export function createFab() {
    removeFab();
    const s = getSettings();
    if (!s.showDebugEye) return;

    const $sheld = $('#form_sheld');
    if (!$sheld.length) return;

    const fab = $(`
        <div id="${FAB_ID}" title="Apocrypha" style="
            position: absolute;
            top: -38px;
            right: 6px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(18, 10, 26, 0.85);
            border: 1px solid rgba(126, 87, 160, 0.6);
            color: #b9a7cf;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 31000;
            font-size: 14px;
        "><i class="fa-solid fa-eye"></i></div>
    `);

    fab.on('click', togglePanel);
    $sheld.css('position', 'relative').append(fab);
}

export function removeFab() {
    $(`#${FAB_ID}`).remove();
    $(`#${PANEL_ID}`).remove();
}

// ── Panel ────────────────────────────────────────────────────────────

function togglePanel() {
    if ($(`#${PANEL_ID}`).length) {
        $(`#${PANEL_ID}`).remove();
    } else {
        openPanel();
    }
}

function openPanel() {
    $(`#${PANEL_ID}`).remove();

    const panel = $(`
        <div id="${PANEL_ID}" style="
            position: fixed;
            bottom: 90px;
            left: 50%;
            transform: translateX(-50%);
            width: min(420px, 92vw);
            max-height: 60vh;
            overflow-y: auto;
            background: rgba(14, 8, 20, 0.96);
            border: 1px solid rgba(126, 87, 160, 0.5);
            border-radius: 10px;
            padding: 14px;
            z-index: 31001;
            color: #cfc3de;
            font-size: 0.85em;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        "></div>
    `);

    $('body').append(panel);
    refreshPanel();
}

export function refreshPanel() {
    const $panel = $(`#${PANEL_ID}`);
    if (!$panel.length) return;

    const st = getChatState();
    if (!st) { $panel.html('<i>No chat loaded.</i>'); return; }

    const stageIdx = getStageIndex(st);
    const stage = STAGES[stageIdx];
    const next = STAGES[stageIdx + 1];
    const max = STAGES[STAGES.length - 1].threshold;
    const pct = Math.min(100, (st.attention / max) * 100);

    const logHtml = (st.log || []).slice(0, 12).map(e =>
        `<div style="opacity:.75; padding:1px 0;"><span style="color:#8e6fb0;">+${e.amount}</span> — ${escapeHtml(e.reason)}</div>`
    ).join('') || '<i style="opacity:.5;">nothing yet</i>';

    const btn = `style="flex:1; min-width:0; padding:7px 4px; background:rgba(126,87,160,.18); border:1px solid rgba(126,87,160,.5); border-radius:6px; color:#cfc3de; cursor:pointer; font-size:.95em;"`;

    $panel.html(`
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
            <b style="color:#b9a7cf; letter-spacing:1px;">APOCRYPHA</b>
            <span id="apocrypha-panel-close" style="cursor:pointer; opacity:.6; padding:0 4px;">✕</span>
        </div>

        <div style="margin-bottom:4px;">
            Stage: <b style="color:#d9c8f0;">${stage.name}</b>
            <span style="opacity:.6;"> · attention ${Math.round(st.attention * 10) / 10}${next ? ` / next at ${next.threshold}` : ' · terminal'}</span>
        </div>
        <div style="height:6px; background:rgba(255,255,255,.07); border-radius:3px; margin-bottom:10px;">
            <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, #4a3566, #8e6fb0); border-radius:3px;"></div>
        </div>

        <div style="display:flex; gap:6px; margin-bottom:10px;">
            <button id="apocrypha-feed" ${btn}>Feed +10</button>
            <button id="apocrypha-force" ${btn}>Force whisper</button>
            <button id="apocrypha-reset" ${btn}>Reset chat</button>
        </div>

        <div style="display:flex; gap:6px; align-items:center; margin-bottom:10px;">
            <span style="opacity:.7;">Ritual:</span>
            <select id="apocrypha-ritual-now" style="flex:1; background:rgba(0,0,0,.4); color:#cfc3de; border:1px solid rgba(126,87,160,.4); border-radius:6px; padding:5px;">
                ${STAGES.map((s2, i) => `<option value="${i}" ${i === stageIdx ? 'selected' : ''}>${s2.name}</option>`).join('')}
            </select>
        </div>

        <div style="opacity:.6; margin-bottom:3px; letter-spacing:1px; font-size:.85em;">RECENT GAINS</div>
        <div style="font-family:monospace; font-size:.85em;">${logHtml}</div>
    `);

    $('#apocrypha-panel-close').on('click', () => $panel.remove());

    $('#apocrypha-feed').on('click', () => {
        gainAttention(10, 'fed by hand (debug)');
        refreshPanel();
    });

    $('#apocrypha-force').on('click', async () => {
        const lastIdx = findLastAiMessageIndex();
        if (lastIdx === null) { toastr.warning('No AI message to whisper beneath.'); return; }
        toastr.info('It draws breath…', 'Apocrypha');
        await maybeWhisper(lastIdx, true);
        refreshPanel();
    });

    $('#apocrypha-reset').on('click', () => {
        if (chat_metadata) {
            chat_metadata[EXT_ID] = defaultChatState();
            saveChatState();
            clearWallBreak();
            $('#chat .apocrypha-whisper').remove();
            toastr.success('It has forgotten you. For now.', 'Apocrypha');
            refreshPanel();
        }
    });

    $('#apocrypha-ritual-now').on('change', function () {
        const st2 = getChatState();
        applyRitualFloor(st2, parseInt($(this).val()));
        logGain(st2, 0, `ritual performed — floor: ${STAGES[st2.ritualFloor].name}`);
        saveChatState();
        refreshPanel();
    });
}

function findLastAiMessageIndex() {
    if (!chat || !chat.length) return null;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i].is_user && !chat[i].is_system) return i;
    }
    return null;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
