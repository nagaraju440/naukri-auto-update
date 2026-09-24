# Naukri profile refresh

This adds or removes a trailing "." on your **Resume headline** three times a day (around 9:10, 13:10 and 18:10 IST, each with a random 0–15 minute delay). Naukri counts each change as a fresh profile update.

Naukri has no public API, so this uses Playwright to drive a headless browser. Automating your account is against Naukri's terms. The script keeps the footprint small: one tiny edit, random timing, and a saved login session so it doesn't log in again on every run.

## Primary setup: GitHub Actions (runs even when your laptop is off)

1. **Create a private GitHub repo** (for example `naukri-auto-update`) and push this folder to it. It must be private: the saved session is cached in the repo's Actions storage.
2. **Save a logged-in session on your laptop.** From this folder, run:
   ```
   npm install
   npx playwright install chromium
   npm run save-session
   ```
   Log in to Naukri in the window that opens (finish the OTP if it asks for one), wait until your profile loads, then press Enter in the terminal. This writes `state.b64.txt`.
3. **Add three secrets** under the repo's Settings → Secrets and variables → Actions:
   - `NAUKRI_STATE`: the full contents of `state.b64.txt`
   - `NAUKRI_EMAIL`: your Naukri login email
   - `NAUKRI_PASSWORD`: your Naukri password, used only when the saved session expires

   Then delete `state.b64.txt` from your laptop.
4. **Test it.** On the repo's Actions tab, open "Naukri profile refresh" and click "Run workflow". Then check on Naukri that your headline gained or lost a period.

If a run fails, GitHub emails you. The failed run has a `naukri-debug-…` artifact with a screenshot and the page HTML.
- If the failure says **"asked for an OTP"**, repeat step 2 and replace the `NAUKRI_STATE` secret.
- If it says **"… not found"**, Naukri changed its page. Send me the screenshot and I'll update the selectors.

## Laptop fallback (Windows Task Scheduler)

1. Do step 2 above. That leaves `state.json` in this folder.
2. Create `windows\secrets.bat` containing:
   ```
   set NAUKRI_EMAIL=you@example.com
   set NAUKRI_PASSWORD=yourpassword
   ```
3. Run `powershell -ExecutionPolicy Bypass -File .\windows\install-task.ps1`

If the laptop is asleep at a scheduled time, the task runs as soon as it wakes. Output goes to `windows\run.log`.

Run only one of the two setups. Running both means up to 6 edits a day.

## Watch it run once
`npm run update:watch` opens a visible browser and runs a single refresh.
