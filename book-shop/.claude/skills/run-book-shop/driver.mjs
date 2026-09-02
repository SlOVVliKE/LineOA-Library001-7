#!/usr/bin/env node
// Minimal headless-Chromium REPL for driving book-shop, since chromium-cli
// isn't installed on this machine. Reads newline commands from stdin.
// Requires: npx --yes playwright install chromium  (one-time, ~150MB)
//
// Usage:
//   node .claude/skills/run-book-shop/driver.mjs <<'EOF'
//   nav http://localhost:3000/admin
//   wait-for text=เข้าสู่ระบบ
//   screenshot login
//   fill input[name=email] owner@bookshop.local
//   fill input[name=password] bookshop1234
//   click button[type=submit]
//   wait-for text=ภาพรวม
//   screenshot admin-home
//   console
//   EOF
//
// Screenshots land in .claude/skills/run-book-shop/screenshots/<name>.png

import { chromium } from 'playwright';
import { createInterface } from 'node:readline';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shotDir = path.join(here, 'screenshots');
mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const consoleLog = [];
page.on('console', (msg) => consoleLog.push({ type: msg.type(), text: msg.text() }));
page.on('pageerror', (err) => consoleLog.push({ type: 'pageerror', text: String(err) }));

function splitArgs(rest) {
  // "sel value with spaces" -> [sel, "value with spaces"]
  const m = rest.match(/^(\S+)\s*(.*)$/);
  return [m?.[1] ?? '', m?.[2] ?? ''];
}

async function run(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const [cmd, rest] = splitArgs(trimmed);

  switch (cmd) {
    case 'nav':
      await page.goto(rest, { waitUntil: 'domcontentloaded' });
      break;
    case 'resize': {
      const [w, h] = rest.split(/\s+/).map(Number);
      await page.setViewportSize({ width: w, height: h });
      break;
    }
    case 'wait-for': {
      if (rest.startsWith('text=')) {
        await page.getByText(rest.slice(5), { exact: false }).first().waitFor({ timeout: 15000 });
      } else {
        await page.waitForSelector(rest, { timeout: 15000 });
      }
      break;
    }
    case 'click':
      await page.click(rest, { timeout: 15000 });
      break;
    case 'fill': {
      const [sel, value] = splitArgs(rest);
      await page.fill(sel, value);
      break;
    }
    case 'type': {
      const [sel, value] = splitArgs(rest);
      await page.type(sel, value);
      break;
    }
    case 'press':
      await page.keyboard.press(rest);
      break;
    case 'screenshot': {
      const name = rest || `shot-${Date.now()}`;
      const file = path.join(shotDir, `${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`screenshot -> ${file}`);
      break;
    }
    case 'eval':
      console.log(await page.evaluate(rest));
      break;
    case 'console':
      for (const entry of consoleLog) console.log(`[${entry.type}] ${entry.text}`);
      if (rest === '--errors') {
        const errors = consoleLog.filter((e) => e.type === 'error' || e.type === 'pageerror');
        console.log(errors.length ? `${errors.length} error(s)` : 'no console errors');
      }
      break;
    case 'sleep':
      await page.waitForTimeout(Number(rest) || 1000);
      break;
    default:
      console.log(`unknown command: ${cmd}`);
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
for await (const line of rl) {
  try {
    await run(line);
  } catch (err) {
    console.log(`error running "${line}": ${err.message}`);
  }
}

await browser.close();
