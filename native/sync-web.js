// Copies the website (one folder up) into ./www so Capacitor & Electron can bundle it.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..'), dst = path.join(__dirname, 'www');
const SKIP = new Set(['native', 'node_modules', '.vscode', '.git', 'css.rar', 'js.rar', 'README.md', 'robots.txt', 'sitemap.xml']);
fs.rmSync(dst, { recursive: true, force: true });
(function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    if (from === src && SKIP.has(f)) continue;
    const a = path.join(from, f), b = path.join(to, f);
    fs.statSync(a).isDirectory() ? copy(a, b) : fs.copyFileSync(a, b);
  }
})(src, dst);
console.log('Web files copied to', dst);
