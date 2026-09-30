// panel.html を A4 の大きさで開き、はみ出し・文字の大きさ・余白の割合を確かめる。
// 使い方: node check.mjs [切り出し画像の保存先]
// 印刷PDFは overflow:hidden で静かに切れるので、書き出したら必ずこれで見る。
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.HOME + '/.cache/puppeteer/chrome/mac_arm-148.0.7778.97/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const cropDir = process.argv[2];
const PORT = 9335;
const profile = mkdtempSync(join(tmpdir(), 'panel-check-'));
const chrome = spawn(CHROME, ['--headless', `--remote-debugging-port=${PORT}`, '--allow-file-access-from-files',
  `--user-data-dir=${profile}`, 'about:blank']);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(200); }
  }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

  // A4 = 794×1123 CSS px
  await send('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 2, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: 'file://' + join(here, 'panel.html') });
  await sleep(2500);

  const report = await evaluate(`(() => {
    const MM = 25.4 / 96, mm = px => +(px * MM).toFixed(1);
    const page = document.querySelector('.page');
    const pr = page.getBoundingClientRect();
    const cs = getComputedStyle(page);
    const innerBottom = pr.bottom - parseFloat(cs.paddingBottom);
    const innerRight = pr.right - parseFloat(cs.paddingRight);
    const issues = [];
    let bottom = 0, minPt = Infinity, minWhere = '';
    for (const el of page.querySelectorAll('*')) {
      const b = el.getBoundingClientRect();
      if (!b.width || el.closest('[data-bleed]')) continue;
      bottom = Math.max(bottom, b.bottom);
      if (b.right > innerRight + 1) issues.push('右にはみ出し ' + mm(b.right - innerRight) + 'mm: ' + el.textContent.trim().slice(0, 16));
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).whiteSpace === 'nowrap')
        issues.push('一行に収まらない: ' + el.textContent.trim().slice(0, 16));
      // 直下に文字を持つ要素だけ文字の大きさを見る
      if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
        const pt = parseFloat(getComputedStyle(el).fontSize) * 0.75;
        if (pt < minPt) { minPt = pt; minWhere = el.textContent.trim().slice(0, 16); }
      }
    }
    const blocks = [...page.children].filter(e => !e.hasAttribute('data-bleed')).map(e => {
      const b = e.getBoundingClientRect();
      return (e.className || e.tagName.toLowerCase()) + ' ' + mm(b.top - pr.top) + '→' + mm(b.bottom - pr.top) + 'mm';
    });
    // margin-top:auto で下に寄せた段があると余りが隠れるので、高さを外して中身だけの高さを測る
    const fixed = page.style.height; page.style.height = 'auto';
    const natural = page.getBoundingClientRect().height; page.style.height = fixed;
    const slack = mm(pr.height - natural);
    if (slack < 0) issues.push('下にはみ出し ' + (-slack) + 'mm');
    return { blocks, slack, minPt: +minPt.toFixed(2), minWhere, issues: [...new Set(issues)] };
  })()`);

  // 余白の割合：文字の行・画像・塗りや枠のある箱が占める所を 1mm 角で塗り、残った所を余白とみなす
  const space = await evaluate(`(() => {
    const page = document.querySelector('.page'); const pr = page.getBoundingClientRect();
    const PX = 96 / 25.4, W = 210, H = 297, grid = new Uint8Array(W * H);
    const paint = (b) => {
      for (let y = Math.max(0, Math.floor((b.top - pr.top) / PX)); y < Math.min(H, Math.ceil((b.bottom - pr.top) / PX)); y++)
        for (let x = Math.max(0, Math.floor((b.left - pr.left) / PX)); x < Math.min(W, Math.ceil((b.right - pr.left) / PX)); x++) grid[y * W + x] = 1;
    };
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      if (!n.textContent.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const b of r.getClientRects()) paint(b);
    }
    for (const el of page.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      const filled = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'rgb(255, 255, 255)';
      if (el.tagName === 'IMG' || el.tagName === 'svg' || filled || parseFloat(s.borderTopWidth) > 0) paint(el.getBoundingClientRect());
    }
    const cs = getComputedStyle(page);
    const [t, r, b, l] = ['Top', 'Right', 'Bottom', 'Left'].map(k => Math.round(parseFloat(cs['padding' + k]) / PX));
    let all = 0, inner = 0, innerN = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const empty = !grid[y * W + x]; all += empty;
      if (y >= t && y < H - b && x >= l && x < W - r) { innerN++; inner += empty; }
    }
    return { all: Math.round(all / (W * H) * 100), inner: Math.round(inner / innerN * 100) };
  })()`);

  console.log('段の位置:\n  ' + report.blocks.join('\n  '));
  console.log(`下の余り: ${report.slack}mm（詰めずに置いたときに余る高さ）`);
  console.log(`いちばん小さい文字: ${report.minPt}pt（A1で約${Math.round(report.minPt * 2.83)}pt）「${report.minWhere}」`);
  console.log(`余白: 紙全体の約${space.all}%（外周の余白を除くと約${space.inner}%）`);
  console.log(report.issues.length ? '問題:\n  ' + report.issues.join('\n  ') : '問題: なし');

  if (cropDir) {
    mkdirSync(cropDir, { recursive: true });
    // 上・中・下の3つに切って、2倍で保存する
    for (const [name, y, h] of [['top', 0, 380], ['middle', 360, 420], ['bottom', 760, 363]]) {
      const c = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y, width: 794, height: h, scale: 1 } });
      writeFileSync(join(cropDir, `crop-${name}.png`), Buffer.from(c.data, 'base64'));
    }
    console.log('切り出し: ' + cropDir);
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
