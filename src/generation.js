// Apocrypha — generation.js
// Independent connection calls (Spark/Tracker Enhanced pattern) with
// generateRaw fallback. Never touches the main chat connection.

import { getContext } from '../../../../extensions.js';
import { generateRaw } from '../../../../../script.js';
import { getSettings } from './state.js';
import { LOG_PREFIX } from './config.js';

function getProfileIdByName(profileName) {
    const ctx = getContext();
    const cm = ctx.extensionSettings?.connectionManager;
    if (!cm) return null;
    if (!profileName || profileName === 'current') return cm.selectedProfile;
    const profile = (cm.profiles || []).find(p => p.name === profileName);
    return profile ? profile.id : null;
}

export function listProfiles() {
    const ctx = getContext();
    return ctx.extensionSettings?.connectionManager?.profiles || [];
}

/**
 * Generate via independent connection; falls back to generateRaw.
 * Returns cleaned text or null.
 */
export async function generateIndependent(prompt, maxTokens) {
    const ctx = getContext();
    const s = getSettings();
    maxTokens = maxTokens || s.maxWhisperTokens || 250;

    // Independent connection (preferred)
    try {
        if (ctx.ConnectionManagerRequestService) {
            const profileId = getProfileIdByName(s.selectedProfile);
            if (profileId) {
                const response = await ctx.ConnectionManagerRequestService.sendRequest(
                    profileId,
                    [{ role: 'user', content: prompt }],
                    maxTokens,
                    {
                        extractData: true,
                        includePreset: true,
                        includeInstruct: false,
                    },
                    {},
                );
                if (response?.content) return cleanReply(response.content);
            }
        }
    } catch (e) {
        console.warn(LOG_PREFIX, 'Independent connection failed, falling back:', e);
    }

    // Fallback: main connection
    try {
        const raw = await generateRaw(prompt, null, false, false, '', maxTokens);
        if (raw) return cleanReply(raw);
    } catch (e) {
        console.error(LOG_PREFIX, 'generateRaw fallback failed:', e);
    }

    return null;
}

/**
 * Hardened reply cleaner (Echo lineage).
 * Strips reasoning blocks, tags, fences, prefixes, wrapping quotes.
 */
export function cleanReply(text) {
    if (!text) return '';
    let t = String(text);

    // Reasoning / thinking blocks, any casing, unclosed included
    t = t.replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/gi, '');
    t = t.replace(/<think(ing)?>[\s\S]*/gi, '');
    t = t.replace(/<\/?[a-z_]+>/gi, '');

    // Code fences
    t = t.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');

    // Common prefixes
    t = t.replace(/^\s*(whisper|the whisper|response|output)\s*[:\-—]\s*/i, '');

    t = t.trim();

    // Wrapping quotes
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('\u201C') && t.endsWith('\u201D'))) {
        t = t.slice(1, -1).trim();
    }
    // Wrapping asterisks
    if (t.startsWith('*') && t.endsWith('*') && t.length > 2) {
        t = t.slice(1, -1).trim();
    }

    return t;
}
