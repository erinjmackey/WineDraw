/**
 * Layout check for the projector view with a full-size event roster:
 * 37 teams x 7 players (259 names), some eliminated, shown on one screen.
 *
 *   1. Start the site:   python -m http.server 8765   (from the repo root)
 *   2. Run this file:    node tests/projector-layout.js
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
const PORT = 9334;
const DEMO_KEY = "mackey_wine_draw_demo_v2";
const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
];

fs.mkdirSync(SHOT_DIR, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "wine-layout-"));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--window-size=1920,1080",
    "--no-first-run",
    "--disable-gpu",
    "about:blank",
  ],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Synthetic 37 x 7 roster ---------- */
const FIRST = ["Margaret", "Arthur", "Evelyn", "Graham", "Patricia", "Richard", "Barbara", "Thomas", "Susan", "Robert",
  "Carol", "Kenneth", "Diane", "William", "Nancy", "Edward", "Helen", "Charles", "Dorothy", "George", "Linda", "Donald",
  "Sharon", "Paul", "Karen", "David", "Betty", "Frank", "Judith", "Raymond", "Sandra", "Walter", "Gordon", "Marlene",
  "Christopher", "Alexandra", "Bruce"];
const LAST = ["Mackey", "Pendelton", "Brooks", "Whitaker", "Holloway", "Caldwell", "Sinclair", "Lindholm", "Gallagher",
  "Thornton", "Hendricks", "Marlow", "Mercer", "Halstead", "Pritchard", "Kowalski", "MacAllister", "Beaumont", "Callahan",
  "Ellison", "Fitzpatrick", "McAllister", "Alvarez", "Donovan", "O'Sullivan", "Reynolds", "Zimmerman", "Pellegrini",
  "Armstrong", "Foster", "Delgado", "Bennett", "Hale", "Fenwick"];

function buildRoster() {
  const rows = [];
  let n = 0;
  for (let t = 0; t < 37; t++) {
    const team = ["Bordeaux Bells", "Cabernet Carolers", "Mistletoe Merlots", "Fireside Pinot", "Snowfall Sauvignon",
      "Holly & Shiraz", "Champagne Sleigh", "Cellar Noel", "Rioja Reindeer", "Merlot Mistletoe", "Syrah Santa", "Gingerbread Gamay",
      "Port Partridge", "Chardonnay Christmas", "Frosty Fizz", "Shiraz Sleigh", "Noel Nebbiolo", "Tinsel Tempranillo",
      "Mulled Malbec", "Eggnog Ros\u00e9", "Pinot Pine", "Vintage Yule", "Festive Ferment", "Glühwein Gang",
      "Cork & Candle", "Bubbly Bells", "Wassail Wines", "Nog Nation", "Carol Cellar", "Wreath & Vine", "Oak Ornament",
      "Dram Dasher", "Stocking Stash", "Corkscrew Carolers", "Claret Claus", "Ruby Ribbon", "Last Cork Standing"][t];
    for (let p = 0; p < 7; p++) {
      n++;
      const name = `${FIRST[(n * 7) % FIRST.length]} ${LAST[(n * 11 + t) % LAST.length]}`;
      // Deterministic elimination pattern: a few teams fully out, the rest partially out across 3 draw days.
      let eliminatedDate = "";
      const bucket = (n * 13 + t * 5) % 10;
      if (t % 9 === 4 || bucket < 4) {
        eliminatedDate = ["2026-11-17", "2026-11-18", "2026-11-19"][(n + t) % 3];
      }
      rows.push({ ticket: n, team, name, eliminatedDate });
    }
  }
  // Make one team fully out so the greyed-card layout is exercised.
  for (const r of rows) if (r.team === rows[0].team) r.eliminatedDate = "2026-11-17";
  return rows;
}

(async () => {
  const pageList = await (async () => {
    for (let i = 0; i < 60; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
        const page = list.find((t) => t.type === "page");
        if (page) return page;
      } catch {
        // Chrome still starting
      }
      await sleep(250);
    }
    throw new Error("Chrome DevTools did not start");
  })();

  const ws = new WebSocket(pageList.webSocketDebuggerUrl);
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

  try {
    await send("Page.enable");
    await send("Runtime.enable");

    // Seed the 37 x 7 roster into this browser's demo store (same origin as the site).
    await navigate(BASE + "/projector.html");
    await evaluate(`localStorage.setItem(${JSON.stringify(DEMO_KEY)}, ${JSON.stringify(JSON.stringify(buildRoster()))})`);

    for (const size of SIZES) {
      await send("Emulation.setDeviceMetricsOverride", { ...size, deviceScaleFactor: 1, mobile: false });
      await navigate(BASE + "/projector.html");
      await waitFor("document.querySelectorAll('.proj-team').length === 37", "all 37 teams rendered");

      const m = await evaluate(`(() => {
        const grid = document.getElementById('proj-grid');
        const cards = Array.from(document.querySelectorAll('.proj-team'));
        const lists = Array.from(document.querySelectorAll('.proj-players'));
        const names = Array.from(document.querySelectorAll('.proj-player-name'));
        const cs = getComputedStyle(grid);
        return {
          pageOverflowY: document.documentElement.scrollHeight - window.innerHeight,
          pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
          gridOverflowY: grid.scrollHeight - grid.clientHeight,
          cardsClippedY: cards.filter((c) => c.scrollHeight > c.clientHeight + 1).length,
          listsClippedY: lists.filter((l) => l.scrollHeight > l.clientHeight + 1).length,
          listOverflowPx: Math.max(0, ...lists.map((l) => l.scrollHeight - l.clientHeight)),
          namesClippedX: names.filter((n) => n.scrollWidth > n.clientWidth + 1).length,
          teamNamesClipped: Array.from(document.querySelectorAll('.proj-team-name')).filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent),
          truncatedNames: names.filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent),
          columns: cs.gridTemplateColumns.split(' ').length,
          rows: cs.gridTemplateRows.split(' ').length,
          cardHeight: Math.round(cards[0].getBoundingClientRect().height),
          nameFontPx: parseFloat(getComputedStyle(names[0]).fontSize),
          spotlightHeight: Math.round(document.getElementById('proj-spotlight').getBoundingClientRect().height),
          headerHeight: Math.round(document.querySelector('.proj-header').getBoundingClientRect().height),
        };
      })()`);

      console.log(`${size.width}x${size.height}:`, JSON.stringify(m));
      await send("Page.captureScreenshot", { format: "png" }).then((r) =>
        fs.writeFileSync(path.join(SHOT_DIR, `08-projector-37x7-${size.width}.png`), Buffer.from(r.result.data, "base64"))
      );

      assert.strictEqual(m.pageOverflowX <= 0, true, `${size.width}: no horizontal overflow`);
      assert.strictEqual(m.pageOverflowY <= 0, true, `${size.width}: whole page fits on screen (overflow ${m.pageOverflowY}px)`);
      assert.strictEqual(m.gridOverflowY <= 0, true, `${size.width}: grid fits without scrolling`);
      assert.strictEqual(m.cardsClippedY, 0, `${size.width}: no team card cut off`);
      assert.strictEqual(m.listsClippedY, 0, `${size.width}: no player list cut off`);
      assert.strictEqual(m.namesClippedX, 0, `${size.width}: no player name truncated`);
      assert.deepStrictEqual(m.teamNamesClipped, [], `${size.width}: no team name truncated`);
    }

    assert.deepStrictEqual(pageErrors, [], "no JavaScript errors on the page");
    console.log("Projector layout check passed: 37 teams x 7 players fit on one screen.");
  } finally {
    ws.close();
    chrome.kill();
  }
})().catch((err) => {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
  try {
    chrome.kill();
  } catch {
    // ignore
  }
});
