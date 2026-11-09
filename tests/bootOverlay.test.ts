import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');

// Le texte de secours pour les robots reste dans la page, entre ses repères
const a = html.indexOf('<!--SEO_FALLBACK_START-->'), b = html.indexOf('<!--SEO_FALLBACK_END-->');
assert.ok(a > 0 && b > a, 'texte SEO conservé');
assert.ok(html.slice(a, b).includes('Marketplace'), 'contenu SEO présent');

// L'écran de démarrage est hors des repères (le serveur remplace ce qui est entre les repères)
const boot = html.indexOf('id="vz-boot"');
assert.ok(boot > b, 'écran de démarrage placé après le texte SEO, hors repères');
// Jamais affiché sans JavaScript, et se retire seul si l'application ne démarre pas
assert.ok(/<noscript><style>#vz-boot\{display:none\}<\/style><\/noscript>/.test(html), 'masqué sans JavaScript');
assert.ok(/vz-boot-out/.test(html) && /8s forwards/.test(html), 'retrait automatique après 8 s');
// L'application le retire une fois affichée
assert.ok(main.includes("getElementById('vz-boot')"), "main.tsx retire l'écran de démarrage");
console.log('  ✓ bootOverlay: texte SEO conservé, écran de démarrage sûr');
