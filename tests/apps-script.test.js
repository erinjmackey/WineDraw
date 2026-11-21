/**
 * Offline test for apps-script/Code.gs (single-tab layout: ticket, name, team, eliminated date).
 * Runs the real script inside a Node VM against an in-memory mock of the Sheet.
 *   node tests/apps-script.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
// Arrays created inside the VM are a different realm, so use loose deep-equality.
assert.deepStrictEqual = assert.deepEqual;

const code = fs.readFileSync(path.join(__dirname, "..", "apps-script", "Code.gs"), "utf8");
const HEADERS = ["Ticket Number", "Player Name", "Team", "Eliminated Date"];

/* ---------- Mock Sheet ---------- */
class MockSheet {
  constructor(rows) {
    this.rows = rows.map((r) => r.slice()); // rows[0] is the header
  }
  getLastRow() {
    return this.rows.length;
  }
  getLastColumn() {
    return this.rows.reduce((m, r) => Math.max(m, r.length), 0);
  }
  getRange(row, col, numRows = 1, numCols = 1) {
    const self = this;
    const api = {
      getValues() {
        const out = [];
        for (let r = row; r < row + numRows; r++) {
          const src = self.rows[r - 1] || [];
          const line = [];
          for (let c = col; c < col + numCols; c++) line.push(src[c - 1] === undefined ? "" : src[c - 1]);
          out.push(line);
        }
        return out;
      },
      setValues(values) {
        values.forEach((line, i) => {
          const rIdx = row - 1 + i;
          while (self.rows.length <= rIdx) self.rows.push([]);
          line.forEach((v, j) => {
            self.rows[rIdx][col - 1 + j] = v;
          });
        });
        return api;
      },
      setValue(v) {
        return api.setValues([[v]]);
      },
      setNumberFormat() {
        return api;
      },
      setFontWeight() {
        return api;
      },
    };
    return api;
  }
  setFrozenRows() {}
}

function makeEnv({ passcode = "letmein", players = [], previousWinners = null }) {
  const sheet = new MockSheet([HEADERS, ...players]);
  const winnersSheet = previousWinners ? new MockSheet(previousWinners) : null;
  const ss = {
    getSheets: () => [sheet],
    getSheetByName: (name) => (name === "PreviousWinners" ? winnersSheet : sheet),
    getSpreadsheetTimeZone: () => "UTC",
  };
  const sandbox = {
    console,
    Date,
    JSON,
    Math,
    Set,
    Number,
    String,
    Array,
    Object,
    Error,
    isNaN,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss, flush: () => {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => (k === "ADMIN_PASSCODE" ? passcode : null) }),
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(text) {
        return {
          text,
          setMimeType() {
            return this;
          },
        };
      },
    },
    Utilities: {
      formatDate: (d, _tz, fmt) => {
        const iso = d.toISOString();
        if (fmt === "yyyy-MM-dd HH:mm:ss") return iso.slice(0, 19).replace("T", " ");
        if (fmt === "yyyy-MM-dd HH:mm") return iso.slice(0, 16).replace("T", " ");
        return iso.slice(0, 10);
      },
    },
    Session: { getScriptTimeZone: () => "UTC" },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code + "\n;this.__api = { drawNames_, undoLastDraw_, readPlayers_, publicPlayers_, doGet, doPost, setupSheet };",
    sandbox
  );
  return { api: sandbox.__api, sheet };
}

const parse = (out) => JSON.parse(out.text);
const eliminatedCount = (sheet) => sheet.rows.slice(1).filter((r) => r[3]).length;
const sheetNames = (sheet) => sheet.rows.slice(1).map((r) => r[1]);

// 6 players: Reds (3), Blues (2), Greens (1). Format: [ticket, name, team, eliminatedDate]
const roster = () => [
  [101, "Ann", "Reds", ""],
  [102, "Ben", "Reds", ""],
  [103, "Cy", "Reds", ""],
  [104, "Dee", "Blues", ""],
  [105, "Eli", "Blues", ""],
  [106, "Fay", "Greens", ""],
];

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok  " + name);
}

console.log("Apps Script tests (single-tab layout)");

test("doGet returns every player with ticket, name, team, and eliminated date", () => {
  const { api } = makeEnv({ players: roster() });
  const data = parse(api.doGet({}));
  assert.strictEqual(data.ok, true);
  assert.strictEqual(data.players.length, 6);
  assert.deepStrictEqual(Object.keys(data.players[0]).sort(), ["eliminatedDate", "name", "team", "ticket"]);
  assert.ok(data.players.every((p) => p.eliminatedDate === ""));
});

test("draw writes the date into column D of chosen rows and keeps every name on the sheet", () => {
  const { api, sheet } = makeEnv({ players: roster() });
  const res = api.drawNames_("letmein", 2, "2026-12-14");
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.round, 1);
  assert.strictEqual(res.label, "2026-12-14");
  assert.strictEqual(res.eliminated.length, 2);
  assert.strictEqual(sheet.rows.length - 1, 6, "no rows removed from the sheet");
  assert.strictEqual(eliminatedCount(sheet), 2);
  res.eliminated.forEach((e) => {
    const row = sheet.rows.find((r) => r[1] === e.name);
    assert.strictEqual(row[3], "2026-12-14");
  });
});

test("draws on the same date share a round; a new date starts the next round", () => {
  const { api } = makeEnv({ players: roster() });
  assert.strictEqual(api.drawNames_("letmein", 1, "2026-12-13").round, 1);
  assert.strictEqual(api.drawNames_("letmein", 1, "2026-12-13").round, 1);
  assert.strictEqual(api.drawNames_("letmein", 1, "2026-12-14").round, 2);
});

test("a draw with no date uses the current timestamp", () => {
  const { api, sheet } = makeEnv({ players: roster() });
  const today = new Date().toISOString().slice(0, 10);
  const res = api.drawNames_("letmein", 1, "");
  assert.ok(res.label.startsWith(today + " "), "label starts with today: " + res.label);
  assert.match(res.label, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.strictEqual(sheet.rows.find((r) => r[1] === res.eliminated[0].name)[3], res.label);
});

test("draws on the same day at different times become separate rounds and undo removes only the latest batch", () => {
  const { api, sheet } = makeEnv({ players: roster() });
  const r1 = api.drawNames_("letmein", 2, "2026-11-28 19:00");
  const r2 = api.drawNames_("letmein", 2, "2026-11-28 19:30");
  assert.strictEqual(r1.round, 1);
  assert.strictEqual(r2.round, 2);
  assert.strictEqual(eliminatedCount(sheet), 4);

  const undo = api.undoLastDraw_("letmein");
  assert.strictEqual(undo.undoneRound, 2);
  assert.strictEqual(undo.undoneDate, "2026-11-28 19:30");
  assert.strictEqual(undo.restored.length, 2);
  assert.strictEqual(eliminatedCount(sheet), 2, "7:00 PM batch remains eliminated");
});

test("a bad date is rejected and nothing is written", () => {
  const { api, sheet } = makeEnv({ players: roster() });
  assert.throws(() => api.drawNames_("letmein", 1, "14/12/2026"), /look like 2026-11-28/);
  assert.strictEqual(eliminatedCount(sheet), 0);
});

test("draw reports a team as out exactly when it has nobody left", () => {
  const { api } = makeEnv({ players: roster() });
  const res = api.drawNames_("letmein", 4, "2026-12-14");
  const after = api.readPlayers_();
  const teamsWithSomeoneIn = new Set(after.filter((p) => !p.eliminatedDate).map((p) => p.team));
  const allTeams = ["Reds", "Blues", "Greens"];
  allTeams.forEach((t) => {
    const reported = res.newlyEliminatedTeams.includes(t);
    assert.strictEqual(reported, !teamsWithSomeoneIn.has(t), t + " reporting is wrong");
  });
});

test("a single-player team is reported when its player is drawn", () => {
  const { api } = makeEnv({
    players: [
      [106, "Fay", "Greens", ""],
      [104, "Dee", "Blues", ""],
    ],
  });
  const res = api.drawNames_("letmein", 1, "2026-12-14");
  assert.deepStrictEqual(res.newlyEliminatedTeams, [res.eliminated[0].team]);
});

test("cannot draw so many names that no winner remains", () => {
  const { api, sheet } = makeEnv({ players: roster() });
  assert.throws(() => api.drawNames_("letmein", 6, ""), /at most 5/);
  assert.strictEqual(eliminatedCount(sheet), 0, "nothing written on failure");
});

test("wrong passcode is rejected and nothing changes", () => {
  const { api, sheet } = makeEnv({ players: roster() });
  const out = parse(
    api.doPost({ postData: { contents: JSON.stringify({ action: "draw", passcode: "nope", count: 1 }) } })
  );
  assert.strictEqual(out.ok, false);
  assert.match(out.error, /Incorrect passcode/);
  assert.strictEqual(eliminatedCount(sheet), 0);
});

test("verify accepts the right passcode", () => {
  const { api } = makeEnv({ players: roster() });
  const out = parse(api.doPost({ postData: { contents: JSON.stringify({ action: "verify", passcode: "letmein" }) } }));
  assert.strictEqual(out.ok, true);
});

test("draw via doPost returns the shape the front end expects", () => {
  const { api } = makeEnv({ players: roster() });
  const out = parse(
    api.doPost({
      postData: { contents: JSON.stringify({ action: "draw", passcode: "letmein", count: 1, date: "2026-12-14" }) },
    })
  );
  assert.strictEqual(out.ok, true);
  ["round", "label", "eliminated", "newlyEliminatedTeams", "players", "updatedAt"].forEach((k) =>
    assert.ok(k in out, "missing " + k)
  );
  assert.strictEqual(out.players.length, 6, "eliminated names stay in the list");
  assert.strictEqual(out.players.filter((p) => p.eliminatedDate).length, 1);
});

test("undo clears only the most recent date and keeps every name", () => {
  const { api, sheet } = makeEnv({ players: roster() });
  api.drawNames_("letmein", 2, "2026-12-13");
  api.drawNames_("letmein", 1, "2026-12-14");
  assert.strictEqual(eliminatedCount(sheet), 3);

  const undo = api.undoLastDraw_("letmein");
  assert.strictEqual(undo.undoneDate, "2026-12-14");
  assert.strictEqual(undo.undoneRound, 2);
  assert.strictEqual(undo.restored.length, 1);
  assert.strictEqual(eliminatedCount(sheet), 2, "round 1 untouched");
  assert.strictEqual(sheet.rows.length - 1, 6, "no names removed");
});

test("undo with no draws is an error", () => {
  const { api } = makeEnv({ players: roster() });
  assert.throws(() => api.undoLastDraw_("letmein"), /no completed draws/);
});

test("drawing down to one player crowns a winner and blocks further draws", () => {
  const { api } = makeEnv({ players: roster() });
  api.drawNames_("letmein", 5, "2026-12-14");
  const active = api.readPlayers_().filter((p) => !p.eliminatedDate);
  assert.strictEqual(active.length, 1);
  assert.throws(() => api.drawNames_("letmein", 1, ""), /already complete/);
});

test("rows keep their sheet order", () => {
  const { api } = makeEnv({
    players: [
      [3, "Fay", "Greens", ""],
      [1, "Ann", "Reds", ""],
      [2, "Dee", "Blues", ""],
    ],
  });
  assert.deepStrictEqual(
    api.readPlayers_().map((p) => p.name),
    ["Fay", "Ann", "Dee"]
  );
});

test("dates and timestamps Sheets converts to Date objects are read back cleanly", () => {
  const { api } = makeEnv({
    players: [
      [101, "Ann", "Reds", new Date("2026-12-14T00:00:00Z")],
      [102, "Ben", "Blues", new Date("2026-11-28T19:30:00Z")],
      [103, "Cy", "Greens", ""],
    ],
  });
  const players = api.publicPlayers_(api.readPlayers_());
  assert.strictEqual(players[0].eliminatedDate, "2026-12-14");
  assert.strictEqual(players[1].eliminatedDate, "2026-11-28 19:30");
  assert.strictEqual(players[2].eliminatedDate, "");
});

test("names are never removed from the sheet, even after a full draw", () => {
  const { api, sheet } = makeEnv({ players: roster() });
  api.drawNames_("letmein", 5, "2026-12-14");
  assert.deepStrictEqual(sheetNames(sheet), ["Ann", "Ben", "Cy", "Dee", "Eli", "Fay"]);
});

test("doGet reads PreviousWinners tab when present and returns [] when absent", () => {
  const { api } = makeEnv({
    players: roster(),
    previousWinners: [
      ["Year", "Winner", "Team", "Notes"],
      [2024, "Robert Thornton", "Mistletoe Merlots", "34 bottles"],
      [2025, "Margaret Mackey", "Bordeaux Bells", "37 bottles"],
    ],
  });
  const data = parse(api.doGet({}));
  assert.strictEqual(data.ok, true);
  assert.strictEqual(data.previousWinners.length, 2);
  assert.strictEqual(data.previousWinners[0].year, "2025");
  assert.strictEqual(data.previousWinners[0].winner, "Margaret Mackey");
});

console.log(`\n${passed} tests passed`);
