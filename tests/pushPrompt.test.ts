import assert from 'node:assert/strict';
import { pushPromptMode, PUSH_DISMISS_MS } from '../src/lib/pushPrompt';
const S = (o: any = {}) => ({ supported: true, permission: 'default', subscribed: false, ...o });
const now = 1_000_000_000_000;
assert.equal(pushPromptMode(undefined, S(), 0, now), 'hidden');                       // pas connecté
assert.equal(pushPromptMode('u', S(), 0, now), 'ask');                                // connecté, jamais abonné
assert.equal(pushPromptMode('u', S({ permission: 'granted' }), 0, now), 'ask');       // permission OK mais pas abonné chez OneSignal
assert.equal(pushPromptMode('u', S({ permission: 'granted', subscribed: true }), 0, now), 'hidden'); // déjà abonné
assert.equal(pushPromptMode('u', S({ permission: 'denied' }), 0, now), 'blocked');    // bloqué dans le navigateur
assert.equal(pushPromptMode('u', S({ supported: false }), 0, now), 'hidden');         // navigateur sans notifications
assert.equal(pushPromptMode('u', S(), now - 1000, now), 'hidden');                    // « Plus tard » cliqué
assert.equal(pushPromptMode('u', S(), now - PUSH_DISMISS_MS - 1, now), 'ask');        // revient après 3 jours
console.log('  ✓ pushPrompt: 8 assertions OK');
