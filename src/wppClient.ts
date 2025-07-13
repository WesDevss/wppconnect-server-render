import fs from 'fs';
import path from 'path';
import { install, Browser } from '@puppeteer/browsers';

// ---------- Runtime Chromium download (Render Free tier) ----------
const CHROME_BUILD = '138.0.7204.94'; // same version Puppeteer expects
const CACHE_DIR = '/tmp/chrome-cache';
const BIN_PATH = path.join(
  CACHE_DIR,
  'chromium',
  `linux-${CHROME_BUILD}`,
  'chrome-linux64',
  'chrome'
);

async function ensureChromium() {
  if (!fs.existsSync(BIN_PATH)) {
    console.log('Chromium not found in runtime, downloading...');
    await install({ browser: Browser.CHROME, buildId: CHROME_BUILD, cacheDir: CACHE_DIR });
  }
  process.env.CHROME_PATH = BIN_PATH;
  process.env.PUPPETEER_EXECUTABLE_PATH = BIN_PATH;
}

/**
 * Singleton responsible for starting the internal WPPConnect HTTP server **once** when the
 * container starts. All route handlers can import `wppReady` to await the initialized client
 * without risking multiple `initServer` calls that would clash on the same port.
 */

export const WPP_PORT = process.env.WPP_INTERNAL_PORT || '21466';

// Remove the public PORT temporarily so the internal server doesn't attempt to use it.
const savedPort = process.env.PORT;
if (savedPort) {
  delete process.env.PORT;
}


const clientPromise = (async () => {
  // Ensure Chromium exists, then dynamically import puppeteer & wppconnect
  await ensureChromium();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const puppeteer = require('puppeteer');
  const executablePath: string = process.env.CHROME_PATH || puppeteer.executablePath();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const wppconnect = require('@wppconnect/server');
  try {
    const client: any = await wppconnect.initServer({
      port: Number(WPP_PORT),
      secretKey: process.env.WPP_SECRET || 'THISISMYSECURETOKEN',
      session: process.env.SESSION_NAME,
      startAllSession: false,
      // Puppeteer launch options with explicit Chromium path
      createOptions: {
        executablePath,
        browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      }
      
    });
    // Restore the original Express port after the internal server is up.
    if (savedPort) {
      process.env.PORT = savedPort;
    }
    return client;
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      console.warn('WPPConnect internal server already running on', WPP_PORT);
      return null;
    }
    throw err;
  }
})();

export const wppReady = clientPromise;

export const INTERNAL_API_BASE = `http://localhost:${WPP_PORT}/api/${process.env.SESSION_NAME}`;
