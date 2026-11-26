import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isFreshIncoming, playNotifSound, isSoundEnabled, setSoundEnabled } from '../src/lib/notifSound';

const NOW = Date.parse('2026-11-26T10:00:00Z'); const iso = (s: number) => new Date(NOW - s * 1000).toISOString();
assert.equal(isFreshIncoming({ senderId: 'b', recipientId: 'me', createdAt: iso(2) }, 'me', NOW), true);
assert.equal(isFreshIncoming({ senderId: 'me', recipientId: 'me', createdAt: iso(2) }, 'me', NOW), false);      // écrit par moi
assert.equal(isFreshIncoming({ senderId: 'b', recipientId: 'autre', createdAt: iso(2) }, 'me', NOW), false);    // pas pour moi
assert.equal(isFreshIncoming({ senderId: 'b', recipientId: 'me', createdAt: iso(3600) }, 'me', NOW), false);    // historique relu : pas de son
assert.equal(isFreshIncoming({ senderId: 'b', recipientId: 'me' }, 'me', NOW), false);                           // sans date : par prudence, pas de son
assert.equal(isFreshIncoming({ senderId: 'b', recipientId: 'me', createdAt: iso(2) }, '', NOW), false);
// Hors navigateur (pas de lecteur audio) : aucune erreur, aucun son
assert.equal(playNotifSound(NOW), false); assert.equal(isSoundEnabled(), true); setSoundEnabled(false);
// Le fichier son existe et reste léger
const f = fs.statSync('public/sounds/vendza-notification.mp3'); assert.ok(f.size > 1000 && f.size < 60_000);
console.log('  ✓ notifSound: son seulement pour un message reçu tout juste arrivé, fichier présent');
