/**
 * End-to-end check of the Demo Mode flow in real Chrome (headless).
 *
 *   1. Start the site:   python -m http.server 8765   (from the repo root)
 *   2. Run this file:    node tests/e2e-demo.js
 *
 * Requires Google Chrome at the default Windows install path. Screenshots go to SHOT_DIR.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");

const BASE = process.env.SITE_URL || "http://127.0.0.1:8765";
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SHOT_DIR = process.env.SHOT_DIR || path.join(__dirname, "..", "..", "_scratch", "wine-shots");
const PORT = 9333;
// Demo roster: 32 players, 14 already out (see js/demo-data.js), so 18 are still in.
const ACTIVE_EXPR = "parseInt(document.querySelector('#admin-stats .stat-value').textContent, 10)";

fs.mkdirSync(SHOT_DIR, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "wine-e2e-"));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--window-size=1280,1000",
    "--no-first-run",
    "--disable-gpu",
    "about:blank",
  ],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome still starting
    }
    await sleep(250);
  }
  throw new Error("Chrome DevTools did not start");
}

(async () => {
  const wsUrl = await getPageWs();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let nextId = 0;
  const pending = new Map();
  const pageErrors = [];

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    if (msg.method === "Runtime.exceptionThrown") {
      pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    }
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      pageErrors.push(msg.params.entry.text);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  async function evaluate(expression) {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) {
      throw new Error("Page script error: " + (r.result.exceptionDetails.exception?.description || expression));
    }
    return r.result.result.value;
  }

  async function waitFor(expression, label, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(expression)) return;
      await sleep(150);
    }
    throw new Error("Timed out waiting for: " + label);
  }

  async function navigate(url) {
    await send("Page.navigate", { url });
    await waitFor("document.readyState === 'complete'", "page load");
    await sleep(300);
  }

  async function shot(name, { fullPage = true } = {}) {
    let clip;
    if (fullPage) {
      const h = await evaluate("Math.ceil(document.documentElement.scrollHeight)");
      clip = { x: 0, y: 0, width: 1280, height: Math.min(h, 4000), scale: 1 };
    }
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
    fs.writeFileSync(path.join(SHOT_DIR, name + ".png"), Buffer.from(r.result.data, "base64"));
  }

  const steps = [];
  const step = (name) => steps.push(name);

  try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");

    /* ---------- Public board ---------- */
    await navigate(BASE + "/index.html");
    await waitFor("document.querySelectorAll('.team-card').length === 8", "8 team cards");
    step("board shows 8 teams");

    const boardCounts = await evaluate(`({
      players: document.querySelectorAll('.player-row').length,
      eliminatedTeams: document.querySelectorAll('.team-card--eliminated').length,
      eliminatedRows: document.querySelectorAll('.player-row--eliminated').length,
      demoBanner: !document.getElementById('demo-banner').hidden,
      winner: document.querySelectorAll('.winner-banner').length,
      stillIn: document.querySelector('.stat-card .stat-value').textContent.trim(),
    })`);
    assert.strictEqual(boardCounts.players, 32, "32 players on board");
    assert.strictEqual(boardCounts.eliminatedTeams, 1, "1 fully eliminated team (Cellar Noel)");
    assert.strictEqual(boardCounts.eliminatedRows, 14, "14 eliminated players crossed out");
    assert.strictEqual(boardCounts.demoBanner, true, "demo banner visible in demo mode");
    assert.strictEqual(boardCounts.winner, 0, "no winner yet");
    assert.match(boardCounts.stillIn, /^18/, "18 players still in");
    step("board counts: 32 players, 14 out, 1 team out, demo banner shown");

    // Search narrows to one team
    await evaluate(`(() => { const i = document.getElementById('search-input'); i.value = 'Margaret'; i.dispatchEvent(new Event('input')); })()`);
    await waitFor("document.querySelectorAll('.team-card').length === 1", "search narrows to 1 team");
    await evaluate(`(() => { document.getElementById('search-clear').click(); })()`);
    await waitFor("document.querySelectorAll('.team-card').length === 8", "search cleared");
    step("search filters and clears");

    await shot("01-board-desktop");

    // Filter: Eliminated teams only
    await evaluate(`document.querySelector('[data-filter="eliminated"]').click()`);
    await waitFor("document.querySelectorAll('.team-card').length === 1", "eliminated filter");
    await evaluate(`document.querySelector('[data-filter="all"]').click()`);
    step("status filter works");

    // Party Info modal
    await evaluate(`document.getElementById('open-party-nav').click()`);
    await waitFor("!document.getElementById('party-modal').hidden", "party info modal open");
    const partyLink = await evaluate(`document.querySelector('#party-modal a[href*="mackeywinedraw.ca"]').href`);
    assert.ok(partyLink.includes("mackeywinedraw.ca"), "party modal links to mackeywinedraw.ca");
    await evaluate(`document.getElementById('party-modal-close').click()`);
    assert.strictEqual(await evaluate(`document.getElementById('party-modal').hidden`), true, "party modal closes");
    step("party info modal displays venue, schedule, and mackeywinedraw.ca link");

    // History modal
    await evaluate(`document.getElementById('open-history-nav').click()`);
    await waitFor("!document.getElementById('history-modal').hidden", "history modal open");
    const historyRounds = await evaluate(`document.querySelectorAll('#history-modal-body .history-round').length`);
    assert.strictEqual(historyRounds, 2, "two past rounds in history");
    await evaluate(`document.getElementById('history-modal-close').click()`);
    step("draw history modal lists 2 past rounds");

    /* ---------- Admin: draw names ---------- */
    await navigate(BASE + "/admin.html");
    await waitFor("!!document.getElementById('demo-quick-unlock-btn') && !document.getElementById('demo-quick-unlock-wrap').hidden", "admin gate");
    await evaluate(`document.getElementById('demo-quick-unlock-btn').click()`);
    await waitFor("!document.getElementById('admin-workspace').hidden", "admin unlocked");
    await waitFor(ACTIVE_EXPR + " === 18", "admin stats loaded");
    step("admin unlocks in demo mode");

    // Choose 3 names and confirm
    await evaluate(`(() => {
      const input = document.getElementById('draw-count-input');
      input.value = '3';
      input.dispatchEvent(new Event('input'));
      /* date defaults to today */
      document.getElementById('draw-form').requestSubmit();
    })()`);
    await waitFor("!document.getElementById('confirm-modal').hidden", "confirm modal");
    await evaluate(`document.getElementById('confirm-ok-btn').click()`);
    await waitFor("document.querySelectorAll('#draw-result-slot .drawn-list-item').length === 3", "3 drawn names listed");
    const drawn = await evaluate(`Array.from(document.querySelectorAll('#draw-result-slot .drawn-list-name')).map(e => e.textContent)`);
    assert.strictEqual(new Set(drawn).size, 3, "3 distinct names drawn");
    step("drew 3 names and listed them: " + drawn.join(", "));

    assert.strictEqual(await evaluate(ACTIVE_EXPR), 15, "15 active after drawing 3 from 18");
    await shot("02-admin-after-draw");

    // Printable list
    await evaluate(`window.print = () => { window.__printed = true; }`);
    await evaluate(`document.getElementById('print-latest-result').click()`);
    const printed = await evaluate(`({ called: window.__printed === true, rows: document.querySelectorAll('#print-sheet tbody tr').length })`);
    assert.strictEqual(printed.called, true, "print dialog opened");
    assert.strictEqual(printed.rows, 3, "print sheet lists the 3 drawn names");
    step("printable list opens with the 3 drawn names");

    // Public board reflects the draw (same browser storage)
    await navigate(BASE + "/index.html");
    await waitFor("document.querySelectorAll('.player-row--eliminated').length === 17", "board updated with 17 out");
    const latestDrawChips = await evaluate(`document.querySelectorAll('.latest-draw .drawn-chip').length`);
    assert.strictEqual(latestDrawChips, 3, "latest draw spotlight shows the 3 new names");
    step("public board updated: 17 out, latest-draw spotlight shows 3 names");
    await shot("03-board-after-draw");

    /* ---------- Projector view (1280x720) ---------- */
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await navigate(BASE + "/projector.html");
    await waitFor("document.querySelectorAll('.proj-team').length === 8", "projector shows all 8 teams");
    const projOverflow = await evaluate(`document.documentElement.scrollWidth > window.innerWidth`);
    assert.strictEqual(projOverflow, false, "projector has no horizontal overflow");
    await shot("07-projector");
    await evaluate(`document.getElementById('proj-active-toggle').click()`);
    const activeProjCount = await evaluate(`document.querySelectorAll('.proj-team').length`);
    assert.ok(activeProjCount >= 1 && activeProjCount < 8, "projector Active Only filters out eliminated teams");
    step("projector view displays all teams full-screen and Active Only filter works");

    /* ---------- Undo ---------- */
    await navigate(BASE + "/admin.html");
    await waitFor("!document.getElementById('admin-workspace').hidden || !document.getElementById('demo-quick-unlock-btn').hidden", "admin ready");
    await evaluate(`document.getElementById('demo-quick-unlock-btn').click()`);
    await waitFor(ACTIVE_EXPR + " === 15", "admin reloaded with 15 active");
    await evaluate(`document.getElementById('undo-last-btn').click()`);
    await waitFor("!document.getElementById('confirm-modal').hidden", "undo confirm");
    await evaluate(`document.getElementById('confirm-ok-btn').click()`);
    await waitFor(ACTIVE_EXPR + " === 18", "undo restored 3 names");
    step("undo restored the 3 names (18 active again)");

    /* ---------- Draw to a winner ---------- */
    await evaluate(`(() => {
      const input = document.getElementById('draw-count-input');
      input.value = String(input.max);
      input.dispatchEvent(new Event('input'));
      /* date defaults to today */
      document.getElementById('draw-form').requestSubmit();
    })()`);
    await waitFor("!document.getElementById('confirm-modal').hidden", "final confirm");
    await evaluate(`document.getElementById('confirm-ok-btn').click()`);
    await waitFor("document.querySelectorAll('#draw-result-slot .drawn-list-item').length === 17", "17 names drawn");
    const finalDisabled = await evaluate(`document.getElementById('draw-submit-btn').disabled`);
    assert.strictEqual(finalDisabled, true, "draw button disabled once a winner exists");
    await shot("04-admin-winner");

    await navigate(BASE + "/index.html");
    await waitFor("document.querySelectorAll('.winner-banner').length === 1", "winner banner");
    const winnerName = await evaluate(`document.querySelector('.winner-name').textContent.trim()`);
    const winnerCards = await evaluate(`document.querySelectorAll('.team-card--winner').length`);
    assert.strictEqual(winnerCards, 1, "winner's team highlighted");
    step("final draw crowned a winner on the public board: " + winnerName);
    await shot("05-board-winner");

    /* ---------- Mobile width ---------- */
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await navigate(BASE + "/index.html");
    await waitFor("document.querySelectorAll('.team-card').length > 0", "mobile board");
    const overflow = await evaluate(`document.documentElement.scrollWidth > window.innerWidth`);
    assert.strictEqual(overflow, false, "no horizontal scroll on a phone-width screen");
    await shot("06-board-mobile");
    step("phone-width board has no horizontal scroll");

    assert.deepStrictEqual(pageErrors, [], "no JavaScript errors on the page");
    console.log("E2E demo flow passed:");
    steps.forEach((s) => console.log("  ok  " + s));
    console.log(`Screenshots: ${SHOT_DIR}`);
  } catch (err) {
    console.error("E2E FAILED after:");
    steps.forEach((s) => console.error("  ok  " + s));
    console.error("  FAIL", err.message);
    if (pageErrors.length) console.error("Page errors:", pageErrors);
    process.exitCode = 1;
  } finally {
    ws.close();
    chrome.kill();
    setTimeout(() => {
      try {
        fs.rmSync(profile, { recursive: true, force: true });
      } catch {
        // profile may still be locked briefly; harmless
      }
      process.exit(process.exitCode || 0);
    }, 500);
  }
})();
