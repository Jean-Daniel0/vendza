import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EIcon, RichText } from '../src/components/EIcon';

// Un repère [[Nom]] inconnu s'afficherait tel quel à l'écran : on vérifie que tous ceux du code ont une icône.
const names = new Set<string>();
const used = new Set<string>();
const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(p) && !p.endsWith('EIcon.tsx')) { const src = fs.readFileSync(p, 'utf8'); for (const m of src.matchAll(/\[\[([A-Z][A-Za-z0-9]+)\]\]/g)) names.add(m[1]); for (const m of src.matchAll(/<EIcon name="(\w+)"/g)) used.add(m[1]); } } };
walk(path.join(process.cwd(), 'src'));
for (const n of names) assert.ok(renderToStaticMarkup(<EIcon name={n} />).includes('<svg'), `icône manquante : ${n}`);
assert.ok(names.size > 10, 'repères trouvés');
for (const n of used) assert.ok(renderToStaticMarkup(<EIcon name={n} />).includes('<svg'), `icône utilisée mais absente de la table : ${n}`);
assert.ok(used.size > 30, 'icônes utilisées trouvées');

assert.equal(renderToStaticMarkup(<EIcon name="Inconnue" />), '');
const html = renderToStaticMarkup(<RichText text="[[Package]] Livraison validée" />);
assert.ok(html.includes('<svg') && html.includes('Livraison validée') && !html.includes('[['), html);
assert.equal(renderToStaticMarkup(<RichText text="Texte simple" />), 'Texte simple');
assert.equal(renderToStaticMarkup(<RichText text={undefined} />), '');

// Plus aucun emoji dans le code de la plateforme (hors symboles typographiques et fichiers de tests)
const EMO = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u2713\u2715\u2717]/u;
const bad: string[] = [];
const scan = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) scan(p); else if (/\.(tsx?|html|css)$/.test(p)) { const s = fs.readFileSync(p, 'utf8').replace(/[\u00a9\u00ae\u2122\u2194\u21b3]/g, ''); if (EMO.test(s)) bad.push(p); } } };
scan(path.join(process.cwd(), 'src')); scan(path.join(process.cwd(), 'server')); scan(path.join(process.cwd(), 'public'));
assert.deepEqual(bad, [], 'emojis restants : ' + bad.join(', '));
console.log('  ✓ eicon: icônes présentes pour tous les repères, rendu correct, aucun emoji restant');
