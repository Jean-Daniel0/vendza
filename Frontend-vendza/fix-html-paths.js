const fs = require('fs');
const path = require('path');
const root = path.dirname(__filename);
const files = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) files.push(p);
  }
}
walk(root);
const changed = [];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  const prefix = depth > 0 ? '../'.repeat(depth) : '';
  let updated = content;
  updated = updated.replace(/<base[^>]*?>\s*/gi, '');
  updated = updated.replace(/<script\s+src="\/(vendza-fix-assets\.js)"\s*>\s*<\/script>/gi, `<script src="${prefix}$1"></script>`);
  updated = updated.replace(/<script\s+src="\/(vendza-urls\.js)"\s*>\s*<\/script>/gi, `<script src="${prefix}$1"></script>`);
  if (updated !== content) {
    fs.writeFileSync(file, updated, 'utf8');
    changed.push(rel);
  }
}
console.log('changed', changed.length, 'files');
console.log(changed.join('\n'));
