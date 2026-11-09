// UI verification script using Playwright to test Hub and all 6 games
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { chromium } from '@playwright/test';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const PORT = 4173;
const DIST_DIR = join(process.cwd(), 'dist');
const SCREENSHOT_DIR =
  '/home/scott/.gemini/antigravity-cli/brain/bd9b77f5-6603-4bd5-8529-f85985e46738/screenshots';

// MIME types
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Simple static server
const server = createServer((req, res) => {
  let urlPath = req.url || '/';
  if (urlPath.includes('?')) urlPath = urlPath.split('?')[0];

  let filePath = join(DIST_DIR, urlPath);
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
    const ext = extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(readFileSync(filePath));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Not found: ${urlPath}`);
  }
});

async function main() {
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Static server listening on http://localhost:${PORT}`);

  const browser = await chromium.launch({
    executablePath: '/home/scott/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
    headless: true,
  });

  const routes = [
    { name: 'hub', path: '/' },
    { name: 'cocoa-drop', path: '/games/cocoa-drop/' },
    { name: 'crystal-defender', path: '/games/crystal-defender/' },
    { name: 'fizz-invaders', path: '/games/fizz-invaders/' },
    { name: 'gloop-slugger', path: '/games/gloop-slugger/' },
    { name: 'gumdrop-pacman', path: '/games/gumdrop-pacman/' },
    { name: 'pogo-panic', path: '/games/pogo-panic/' },
    { name: 'fizz-pong', path: '/games/fizz-pong/' },
    { name: 'defrag', path: '/games/defrag/' },
  ];

  let errorsFound = 0;

  for (const r of routes) {
    const page = await browser.newPage();
    const consoleLogs: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const targetUrl = `http://localhost:${PORT}${r.path}`;
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    // Wait 1.5 seconds for game loops, particles, and canvases to render
    await page.waitForTimeout(1000);

    if (r.name === 'gumdrop-pacman') {
      // Press Space to dismiss attract start screen and enter READY phase
      await page.keyboard.press('Space');
      await page.waitForTimeout(2000);
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(500);
    } else {
      await page.waitForTimeout(500);
    }

    const screenshotPath = join(SCREENSHOT_DIR, `${r.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${screenshotPath}`);

    if (pageErrors.length > 0) {
      console.error(`Page errors on ${r.name}:`, pageErrors);
      errorsFound++;
    }
    if (consoleLogs.length > 0) {
      console.error(`Console errors on ${r.name}:`, consoleLogs);
      errorsFound++;
    }

    await page.close();
  }

  await browser.close();
  server.close();

  if (errorsFound > 0) {
    console.error(`Verification completed with ${errorsFound} issues.`);
    process.exit(1);
  } else {
    console.log('All routes verified cleanly with zero errors!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  server.close();
  process.exit(1);
});
