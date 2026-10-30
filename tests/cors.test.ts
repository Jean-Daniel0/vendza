import assert from 'node:assert/strict';
import { corsOriginFor, allowedOrigins } from '../server/cors';

const prod = { NODE_ENV: 'production' };
// origines de Vendza autorisées
assert.equal(corsOriginFor('https://www.vendza.store', prod), 'https://www.vendza.store');
assert.equal(corsOriginFor('https://vendza.store', prod), 'https://vendza.store');
assert.equal(corsOriginFor('https://sellerex.vendza.store', prod), 'https://sellerex.vendza.store');
assert.equal(corsOriginFor('HTTPS://WWW.VENDZA.STORE', prod), 'https://www.vendza.store');
// jamais de joker, jamais une origine inconnue
for (const bad of ['https://evil.com', 'https://www.vendza.store.evil.com', 'https://evilvendza.store', 'http://www.vendza.store', 'null', '*', '', undefined, null, 42, 'pas une url']) {
  assert.equal(corsOriginFor(bad, prod), null, String(bad));
}
// localhost refusé en production, accepté en développement
assert.equal(corsOriginFor('http://localhost:3000', prod), null);
assert.equal(corsOriginFor('http://localhost:3000', { NODE_ENV: 'development' }), 'http://localhost:3000');
assert.equal(corsOriginFor('http://sellerex.localhost:3999', {}), 'http://sellerex.localhost:3999');
assert.equal(corsOriginFor('http://localhost.evil.com', {}), null);
// origines ajoutées par l'environnement
const env = { NODE_ENV: 'production', BASE_URL: 'https://staging.vendza.store/', ALLOWED_ORIGINS: 'https://a.example.com, https://b.example.com/x' };
assert.equal(corsOriginFor('https://staging.vendza.store', env), 'https://staging.vendza.store');
assert.equal(corsOriginFor('https://b.example.com', env), 'https://b.example.com');
assert.equal(allowedOrigins({ ALLOWED_ORIGINS: 'n importe quoi' }).size, 3);
console.log('  ✓ cors: liste d\'origines, jamais de joker');
