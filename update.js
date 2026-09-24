// Naukri profile refresher: toggles a trailing "." on the Resume Headline so Naukri
// records a fresh profile update. Runs in GitHub Actions (cloud) or locally.
//
// Env:
//   NAUKRI_EMAIL, NAUKRI_PASSWORD   login (used only if the saved session has expired)
//   NAUKRI_STATE_FILE               path to saved session (default ./state.json)
//   JITTER_MAX_MIN                  random delay before running, minutes (default 0)
//   HEADLESS                        "false" to watch it run locally (default true)

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const EMAIL = process.env.NAUKRI_EMAIL;
const PASSWORD = process.env.NAUKRI_PASSWORD;
const STATE_FILE = process.env.NAUKRI_STATE_FILE || path.join(__dirname, 'state.json');
const JITTER_MAX_MIN = Number(process.env.JITTER_MAX_MIN || 0);
const HEADLESS = process.env.HEADLESS !== 'false';
const OUT_DIR = path.join(__dirname, 'debug');

const PROFILE_URL = process.env.NAUKRI_PROFILE_URL || 'https://www.naukri.com/mnjuser/profile';
const LOGIN_URL = 'https://www.naukri.com/nlogin/login';

const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = () => sleep(600 + Math.random() * 1400);

// Return the first locator in the list that is visible within the timeout.
async function firstVisible(page, selectors, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const loc = typeof sel === 'string' ? page.locator(sel) : sel(page);
      const el = loc.first();
      if (await el.isVisible().catch(() => false)) return el;
    }
    await sleep(500);
  }
  return null;
}

async function dumpDebug(page, tag) {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ path: path.join(OUT_DIR, `${stamp}-${tag}.png`), fullPage: true });
    fs.writeFileSync(path.join(OUT_DIR, `${stamp}-${tag}.html`), await page.content());
    log(`debug saved: debug/${stamp}-${tag}.png`);
  } catch (e) {
    log('could not save debug output:', e.message);
  }
}

async function isLoggedOut(page) {
  if (/nlogin|login/i.test(page.url())) return true;
  const pw = page.locator('input[type="password"]').first();
  return pw.isVisible().catch(() => false);
}

async function login(page) {
  if (!EMAIL || !PASSWORD) throw new Error('Session expired and NAUKRI_EMAIL / NAUKRI_PASSWORD are not set.');
  log('logging in');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const user = await firstVisible(page, [
    '#usernameField',
    'input[placeholder*="Email" i]',
    'input[type="email"]',
    'input[name="username"]',
  ]);
  const pass = await firstVisible(page, ['#passwordField', 'input[type="password"]']);
  if (!user || !pass) throw new Error('Login form not found.');

  await user.fill(EMAIL);
  await human();
  await pass.fill(PASSWORD);
  await human();

  const btn = await firstVisible(page, [
    'button[type="submit"]:has-text("Login")',
    (p) => p.getByRole('button', { name: /^login$/i }),
    'button[type="submit"]',
  ]);
  if (!btn) throw new Error('Login button not found.');
  await btn.click();

  await page.waitForLoadState('domcontentloaded');
  await sleep(6000);

  const body = (await page.locator('body').innerText().catch(() => '')) || '';
  if (/\bOTP\b|verification code|captcha/i.test(body) && (await isLoggedOut(page))) {
    throw new Error('Naukri asked for an OTP/captcha. Run "npm run save-session" on your laptop and refresh the NAUKRI_STATE secret.');
  }
  if (/invalid|incorrect/i.test(body) && (await isLoggedOut(page))) {
    throw new Error('Naukri rejected the email/password.');
  }
}

async function openHeadlineEditor(page) {
  // The Resume headline card has a pencil icon. Try known ids first, then locate by the card's heading text.
  const edit = await firstVisible(page, [
    '#lazyResumeHead .edit',
    '.resumeHeadline .edit',
    (p) => p.locator('div.card, div.widgetHead, section, div')
      .filter({ has: p.getByText(/^\s*Resume headline\s*$/i) })
      .locator('.edit, span.edit, [class*="edit"]'),
  ], 20000);
  if (!edit) throw new Error('Resume headline edit button not found.');
  await edit.scrollIntoViewIfNeeded();
  await human();
  await edit.click();

  const textarea = await firstVisible(page, [
    '#resumeHeadlineTxt',
    'form textarea[name*="eadline" i]',
    '.lightbox textarea, .drawer textarea, [role="dialog"] textarea',
    'form textarea',
  ]);
  if (!textarea) throw new Error('Resume headline text box did not open.');
  return textarea;
}

async function run() {
  if (JITTER_MAX_MIN > 0) {
    const wait = Math.floor(Math.random() * JITTER_MAX_MIN * 60 * 1000);
    log(`waiting ${Math.round(wait / 60000)} min (jitter)`);
    await sleep(wait);
  }

  const browser = await chromium.launch({ headless: HEADLESS, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    storageState: fs.existsSync(STATE_FILE) ? STATE_FILE : undefined,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    viewport: { width: 1366, height: 850 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });
  await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
  const page = await context.newPage();

  try {
    await page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded' });
    await sleep(4000);
    if (await isLoggedOut(page)) {
      await login(page);
      await page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded' });
      await sleep(4000);
      if (await isLoggedOut(page)) throw new Error('Still not logged in after login attempt.');
    }
    log('on profile page');

    const textarea = await openHeadlineEditor(page);
    const current = (await textarea.inputValue()).trimEnd();
    if (!current) throw new Error('Resume headline is empty; refusing to edit.');
    const next = current.endsWith('.') ? current.slice(0, -1).trimEnd() : `${current}.`;

    await textarea.fill('');
    await textarea.type(next, { delay: 5 });
    await human();

    const save = await firstVisible(page, [
      'form button[type="submit"]:has-text("Save")',
      (p) => p.getByRole('button', { name: /^save$/i }),
      'button:has-text("Save")',
    ]);
    if (!save) throw new Error('Save button not found.');
    await save.click();
    await sleep(4000);

    const body = (await page.locator('body').innerText().catch(() => '')) || '';
    const confirmed =
      /successfully (saved|updated)/i.test(body) || body.includes(next) || !(await textarea.isVisible().catch(() => false));
    if (!confirmed) throw new Error('Save did not confirm.');

    await context.storageState({ path: STATE_FILE });
    log(`headline updated (${current.endsWith('.') ? 'removed' : 'added'} trailing period)`);
  } catch (err) {
    await dumpDebug(page, 'failure');
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(new Date().toISOString(), 'FAILED:', e.message);
  process.exit(1);
});
