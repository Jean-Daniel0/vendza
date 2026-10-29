import assert from 'node:assert/strict';
import { parseOrderContacts, displayName, cleanPhone } from '../src/lib/contacts';

// réponse complète de la fonction SQL
const full = parseOrderContacts({ buyer: { prenom: 'Ana', nom: 'B', telephone: ' 509 11 ', avatar_url: 'u', email: 'x@y.z' }, vendor: { prenom: 'Vic', nom: 'T', telephone: '509 22' } });
assert.deepEqual(full, { buyer: { prenom: 'Ana', nom: 'B', telephone: '509 11', avatar_url: 'u' }, vendor: { prenom: 'Vic', nom: 'T', telephone: '509 22' } });
assert.equal((full.buyer as any).email, undefined); // un e-mail ne passe jamais, même si la réponse en contenait un
// réponses vides, nulles ou mal formées : pas d'exception
for (const bad of [null, undefined, 'x', 3, [], { buyer: 'x', vendor: [] }]) {
  assert.deepEqual(parseOrderContacts(bad), { buyer: null, vendor: null });
}
// téléphone vide ignoré
assert.equal(parseOrderContacts({ buyer: { prenom: 'A', telephone: '  ' } }).buyer?.telephone, undefined);
// nom affiché : jamais d'e-mail comme repli
assert.equal(displayName('Ana', 'Bel'), 'Ana Bel');
assert.equal(displayName('Ana', null), 'Ana');
assert.equal(displayName('', '', 'Client'), 'Client');
assert.equal(displayName(undefined, undefined), 'Utilisateur Vendza');
// téléphone du vendeur
assert.equal(cleanPhone(' 509 33 '), '509 33');
assert.equal(cleanPhone(''), undefined);
assert.equal(cleanPhone(null), undefined);
assert.equal(cleanPhone(42), undefined);
console.log('  ✓ contacts: 16 assertions OK');
