import assert from 'node:assert/strict';
import { mergeIncoming } from '../src/lib/messageDedupe';
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222';
const M = (o: any): any => ({ senderId: 'a', recipientId: 'b', text: 'Hi', createdAt: '2026-10-23T22:28:13.000Z', ...o });

// cas du bug : copie locale msg-… + message du serveur (autre id) => un seul message
let r = mergeIncoming([M({ id: 'msg-1' })], [M({ id: U1, createdAt: '2026-10-23T22:28:13.400Z' })]);
assert.deepEqual(r.map(m => m.id), [U1]);
// deux envois identiques, un seul confirmé pour l'instant : l'autre copie locale reste
r = mergeIncoming([M({ id: 'msg-1' }), M({ id: 'msg-2' })], [M({ id: U1 })]);
assert.deepEqual(r.map(m => m.id).sort(), ['msg-2', U1].sort());
r = mergeIncoming(r, [M({ id: U2 })]);
assert.deepEqual(r.map(m => m.id), [U1, U2]);
// même id => remplacé, pas dupliqué
r = mergeIncoming([M({ id: U1, isRead: false })], [M({ id: U1, isRead: true })]);
assert.equal(r.length, 1); assert.equal(r[0].isRead, true);
// textes ou destinataires différents, ou trop espacés dans le temps : on ne touche à rien
assert.equal(mergeIncoming([M({ id: 'msg-1', text: 'Salut' })], [M({ id: U1 })]).length, 2);
assert.equal(mergeIncoming([M({ id: 'msg-1', recipientId: 'z' })], [M({ id: U1 })]).length, 2);
assert.equal(mergeIncoming([M({ id: 'msg-1', createdAt: '2026-10-23T20:00:00.000Z' })], [M({ id: U1 })]).length, 2);
// un vrai message (UUID) n'est jamais supprimé par erreur
assert.equal(mergeIncoming([M({ id: U1 })], [M({ id: U2 })]).length, 2);
console.log('  ✓ messageDedupe: 9 assertions OK');
