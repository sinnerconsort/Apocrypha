// Apocrypha — settings.js
// Extensions-tab drawer: hunger, default ritual, keywords, connection
// profile picker (Spark pattern), cooldown, wall-break, debug eye.

import { getSettings, saveSettings } from './state.js';
import { STAGES, HUNGER } from './config.js';
import { listProfiles } from './generation.js';
import { createFab, removeFab } from './ui.js';

export function addSettingsPanel() {
    const s = getSettings();

    const hungerOptions = Object.entries(HUNGER)
        .map(([k, v]) => `<option value="${k}" ${s.hunger === k ? 'selected' : ''}>${v.label}</option>`)
        .join('');

    const ritualOptions = STAGES
        .map((st, i) => `<option value="${i}" ${s.ritual === i ? 'selected' : ''}>${st.name}</option>`)
        .join('');

    const profileOptions = ['<option value="current">Use current connection</option>']
        .concat(listProfiles().map(p =>
            `<option value="${p.name}" ${s.selectedProfile === p.name ? 'selected' : ''}>${p.name}</option>`))
        .join('');

    const row = `style="display:flex; align-items:center; gap:8px; margin:6px 0;"`;
    const label = `style="flex:0 0 110px; opacity:.85;"`;
    const input = `style="flex:1; min-width:0;"`;

    const html = `
        <div class="inline-drawer" id="apocrypha-settings">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>👁 Apocrypha</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">

                <label class="checkbox_label">
                    <input type="checkbox" id="apocrypha-enabled" ${s.enabled ? 'checked' : ''}>
                    <span>Enabled — it is listening</span>
                </label>

                <div ${row}>
                    <span ${label}>Hunger</span>
                    <select id="apocrypha-hunger" class="text_pole" ${input}>${hungerOptions}</select>
                </div>

                <div ${row}>
                    <span ${label}>Default ritual</span>
                    <select id="apocrypha-ritual" class="text_pole" ${input}>${ritualOptions}</select>
                </div>
                <small style="opacity:.6; display:block; margin:-2px 0 6px 0;">Starting stage for <i>new</i> chats. Set per-chat from the eye panel.</small>

                <div ${row}>
                    <span ${label}>Generation profile</span>
                    <select id="apocrypha-profile" class="text_pole" ${input}>${profileOptions}</select>
                </div>

                <div ${row}>
                    <span ${label}>Whisper cooldown</span>
                    <input type="number" id="apocrypha-cooldown" class="text_pole" ${input} min="0" max="20" value="${s.whisperCooldown}">
                </div>
                <small style="opacity:.6; display:block; margin:-2px 0 6px 0;">Minimum AI messages between whispers.</small>

                <div style="margin:6px 0;">
                    <span style="opacity:.85;">Trigger keywords (comma-separated)</span>
                    <textarea id="apocrypha-keywords" class="text_pole" rows="3" style="width:100%; margin-top:4px;">${s.triggerKeywords}</textarea>
                    <small style="opacity:.6;">Speaking of these draws its attention.</small>
                </div>

                <label class="checkbox_label">
                    <input type="checkbox" id="apocrypha-wallbreak" ${s.wallBreak ? 'checked' : ''}>
                    <span>Wall-break at Named (whispers leak into context)</span>
                </label>

                <label class="checkbox_label">
                    <input type="checkbox" id="apocrypha-debugeye" ${s.showDebugEye ? 'checked' : ''}>
                    <span>Show debug eye (FAB)</span>
                </label>

            </div>
        </div>
    `;

    $('#extensions_settings2').append(html);
    wireEvents();
}

function wireEvents() {
    const s = getSettings();

    $('#apocrypha-enabled').on('change', function () {
        s.enabled = $(this).prop('checked');
        saveSettings();
        if (s.enabled) { createFab(); } else { removeFab(); }
    });

    $('#apocrypha-hunger').on('change', function () {
        s.hunger = $(this).val();
        saveSettings();
    });

    $('#apocrypha-ritual').on('change', function () {
        s.ritual = parseInt($(this).val()) || 0;
        saveSettings();
    });

    $('#apocrypha-profile').on('change', function () {
        s.selectedProfile = $(this).val();
        saveSettings();
    });

    $('#apocrypha-cooldown').on('input', function () {
        s.whisperCooldown = parseInt($(this).val()) || 0;
        saveSettings();
    });

    $('#apocrypha-keywords').on('input', function () {
        s.triggerKeywords = $(this).val();
        saveSettings();
    });

    $('#apocrypha-wallbreak').on('change', function () {
        s.wallBreak = $(this).prop('checked');
        saveSettings();
    });

    $('#apocrypha-debugeye').on('change', function () {
        s.showDebugEye = $(this).prop('checked');
        saveSettings();
        if (s.showDebugEye && s.enabled) { createFab(); } else { removeFab(); }
    });
}
