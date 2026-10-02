// props.py が書いた SVG を、スライド用の PNG（透過）に変換して ../assets へ置く。
// sharp が要る（リポジトリ直下の .codex-pitch-build/node_modules に入っている）
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../../.codex-pitch-build/'));
const sharp = require('sharp');

for (const name of ['medbox', 'shelf']) {
  await sharp(path.join(here, `${name}.svg`), { density: 300 })
    .resize({ width: 1200 })
    .png()
    .toFile(path.join(here, '../assets', `${name}.png`));
  console.log(`assets/${name}.png`);
}
