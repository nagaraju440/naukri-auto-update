// Run once on your laptop: opens a real browser, you log in to Naukri yourself
// (including any OTP), and the logged-in session is saved to state.json.
// It also writes state.b64.txt — paste its contents into the NAUKRI_STATE GitHub secret.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  const page = await context.newPage();
  await page.goto('https://www.naukri.com/nlogin/login');

  console.log('\nLog in to Naukri in the browser window (complete OTP if asked).');
  console.log('When your profile page is open, come back here and press Enter.\n');
  await new Promise((r) => readline.createInterface({ input: process.stdin }).once('line', r));

  const statePath = path.join(__dirname, 'state.json');
  await context.storageState({ path: statePath });
  fs.writeFileSync(path.join(__dirname, 'state.b64.txt'), fs.readFileSync(statePath).toString('base64'));
  console.log('Saved state.json and state.b64.txt');
  await browser.close();
  process.exit(0);
})();
