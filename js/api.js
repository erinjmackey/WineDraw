/**
 * Unified data layer for The Mackey Christmas Wine Draw.
 *
 * Both backends return players as { ticket, name, team, eliminatedDate }, where
 * eliminatedDate is "" (still in) or "yyyy-mm-dd" (eliminated that day).
 *
 *  - Live mode (API_URL set in config.js): GET for the board, POST for admin actions.
 *  - Demo mode (API_URL empty): the same data kept in this browser's localStorage.
 */

import { createInitialDemoPlayers, createLargeDemoPlayers, DEMO_PREVIOUS_WINNERS } from "./demo-data.js";
import { nowTimestamp, shortDayLabel } from "./ui-helpers.js";

const DEMO_STORAGE_KEY = "mackey_wine_draw_demo_v2";
const DEMO_LARGE_STORAGE_KEY = "mackey_wine_draw_demo_37_v2";
const OVERRIDE_URL_KEY = "mackey_wine_draw_api_override";
const DATE_ONLY_RE = /^(\d{4}-\d{2}-\d{2})$/;
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/;

export function getConfig() {
  return Object.assign(
    {
      eventName: "The Mackey Christmas Wine Draw",
      eventSubtitle: "Annual Holiday Cellar Elimination",
      seasonLabel: "Holiday Vintage",
      prizeDescription: "Last name standing takes home the wine",
      API_URL: "",
      autoRefreshSeconds: 60,
      demoPasscode: "mackey",
    },
    window.WINE_DRAW_CONFIG || {}
  );
}

export function getEffectiveApiUrl() {
  const configured = (getConfig().API_URL || "").trim();
  if (configured) return configured;
  try {
    return (localStorage.getItem(OVERRIDE_URL_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function setApiUrlOverride(url) {
  try {
    const clean = (url || "").trim();
    if (clean) {
      localStorage.setItem(OVERRIDE_URL_KEY, clean);
    } else {
      localStorage.removeItem(OVERRIDE_URL_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function isDemoMode() {
  return !getEffectiveApiUrl();
}

function normalizeDateString(value) {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  if (!s) return "";
  const dt = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/.exec(s);
  if (dt) {
    return dt[3] && dt[3] !== "00" ? `${dt[1]} ${dt[2]}:${dt[3]}` : `${dt[1]} ${dt[2]}`;
  }
  const d = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return d ? d[1] : s;
}

function validTimestampOrBlank(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (DATE_ONLY_RE.test(s)) return s;
  const m = DATETIME_RE.exec(s);
  if (m) {
    return m[3] ? `${m[1]} ${m[2]}:${m[3]}` : `${m[1]} ${m[2]}`;
  }
  throw new Error("Please pick a valid date and time.");
}

/**
 * Turns the flat player list into the board structure used by the pages.
 * Each distinct elimination date is one round ("Day 1", "Day 2", ...).
 */
export function buildBoardFromPlayers(
  rawPlayers,
  updatedAt = new Date().toISOString(),
  rawPreviousWinners = []
) {
  const base = (rawPlayers || [])
    .map((p, idx) => ({
      id: String(p.ticket ?? p.id ?? `row-${idx + 1}`),
      ticket: p.ticket ?? "",
      team: String(p.team || "Unassigned").trim(),
      name: String(p.name || "").trim(),
      eliminatedDate: normalizeDateString(p.eliminatedDate),
    }))
    .filter((p) => p.name.length > 0);

  const dates = Array.from(
    new Set(base.filter((p) => p.eliminatedDate).map((p) => p.eliminatedDate))
  ).sort();
  const roundOf = new Map(dates.map((d, i) => [d, i + 1]));

  const players = base.map((p) => {
    const eliminated = Boolean(p.eliminatedDate);
    return {
      ...p,
      eliminated,
      drawRound: eliminated ? roundOf.get(p.eliminatedDate) : null,
      drawLabel: eliminated ? shortDayLabel(p.eliminatedDate) : "",
      eliminatedAt: p.eliminatedDate,
    };
  });

  // Teams in sheet order
  const teamMap = new Map();
  let teamIndex = 0;
  for (const player of players) {
    if (!teamMap.has(player.team)) {
      teamMap.set(player.team, { name: player.team, originalOrder: teamIndex++, players: [] });
    }
    teamMap.get(player.team).players.push(player);
  }

  const teams = Array.from(teamMap.values()).map((team) => {
    const totalCount = team.players.length;
    const activeCount = team.players.filter((p) => !p.eliminated).length;
    return {
      ...team,
      totalCount,
      activeCount,
      eliminatedCount: totalCount - activeCount,
      isEliminated: totalCount > 0 && activeCount === 0,
    };
  });

  // Rounds, newest first
  const roundsMap = new Map();
  for (const p of players) {
    if (!p.eliminated) continue;
    if (!roundsMap.has(p.drawRound)) {
      roundsMap.set(p.drawRound, {
        round: p.drawRound,
        label: p.drawLabel,
        eliminatedAt: p.eliminatedAt,
        players: [],
      });
    }
    roundsMap.get(p.drawRound).players.push({ name: p.name, team: p.team });
  }
  const rounds = Array.from(roundsMap.values()).sort((a, b) => b.round - a.round);

  const totalPlayers = players.length;
  const activePlayersList = players.filter((p) => !p.eliminated);
  const activePlayers = activePlayersList.length;
  const totalTeams = teams.length;
  const activeTeams = teams.filter((t) => !t.isEliminated).length;
  const winner = totalPlayers >= 2 && activePlayers === 1 ? activePlayersList[0] : null;

  const previousWinners = (rawPreviousWinners || [])
    .map((w) => ({
      year: String(w.year || "").trim(),
      winner: String(w.winner || "").trim(),
      team: String(w.team || "").trim(),
      notes: String(w.notes || "").trim(),
    }))
    .filter((w) => w.winner || w.year)
    .sort((a, b) => b.year.localeCompare(a.year, undefined, { numeric: true }));

  return {
    updatedAt,
    players,
    teams,
    rounds,
    previousWinners,
    summary: {
      totalPlayers,
      activePlayers,
      eliminatedPlayers: totalPlayers - activePlayers,
      totalTeams,
      activeTeams,
      eliminatedTeams: totalTeams - activeTeams,
      currentRound: dates.length,
      winner,
    },
  };
}

/* ==========================================================================
   Demo store (localStorage)
   ========================================================================== */
function isLargeDemoRoster() {
  try {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("roster") === "37";
  } catch {
    return false;
  }
}

function activeDemoKey() {
  return isLargeDemoRoster() ? DEMO_LARGE_STORAGE_KEY : DEMO_STORAGE_KEY;
}

function seedDemoPlayers() {
  return isLargeDemoRoster() ? createLargeDemoPlayers() : createInitialDemoPlayers();
}

function loadDemoPlayers() {
  try {
    const raw = localStorage.getItem(activeDemoKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fall through to seed
  }
  const initial = seedDemoPlayers();
  saveDemoPlayers(initial);
  return initial;
}

function saveDemoPlayers(players) {
  try {
    localStorage.setItem(activeDemoKey(), JSON.stringify(players));
  } catch {
    // ignore quota issues
  }
}

export function resetDemoData() {
  const initial = seedDemoPlayers();
  saveDemoPlayers(initial);
  return buildBoardFromPlayers(initial);
}

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ==========================================================================
   Live Apps Script helpers
   ========================================================================== */
async function postAppsScript(payload) {
  const res = await fetch(getEffectiveApiUrl(), {
    method: "POST",
    redirect: "follow",
    headers: {
      // text/plain avoids a CORS preflight, which Apps Script does not answer
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Google Sheet service responded with status ${res.status}.`);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Unexpected response from Apps Script. Make sure the Web App is deployed with 'Who has access: Anyone'."
    );
  }

  if (!data.ok) {
    throw new Error(data.error || "The draw service returned an error.");
  }
  return data;
}

/* ==========================================================================
   Public methods
   ========================================================================== */

export async function fetchBoard() {
  if (isDemoMode()) {
    return buildBoardFromPlayers(loadDemoPlayers(), new Date().toISOString(), DEMO_PREVIOUS_WINNERS);
  }

  const url = getEffectiveApiUrl();
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}t=${Date.now()}`, { method: "GET", redirect: "follow" });

  if (!res.ok) {
    throw new Error(`Could not load the wine draw board (HTTP ${res.status}).`);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Could not read data from Google Sheets. Confirm your Apps Script Web App URL ends in /exec and access is set to Anyone."
    );
  }

  if (!data.ok) {
    throw new Error(data.error || "Google Sheet returned an error.");
  }

  return buildBoardFromPlayers(data.players, data.updatedAt, data.previousWinners);
}

export async function verifyAdminPasscode(passcode) {
  if (isDemoMode()) {
    const cfg = getConfig();
    const expected = (cfg.demoPasscode || "mackey").trim().toLowerCase();
    const entered = String(passcode || "").trim().toLowerCase();
    if (!entered || (entered !== expected && entered !== "demo")) {
      throw new Error(`Incorrect demo passcode. Try "${cfg.demoPasscode || "mackey"}".`);
    }
    return { ok: true };
  }

  return postAppsScript({ action: "verify", passcode: String(passcode || "") });
}

/**
 * Marks `count` random players still in as eliminated at `date` (timestamp or yyyy-mm-dd, default now).
 */
export async function drawEliminations({ passcode, count, date }) {
  const num = Number(count);
  if (!Number.isInteger(num) || num < 1) {
    throw new Error("Please enter a whole number of at least 1.");
  }
  const stamp = validTimestampOrBlank(date) || nowTimestamp();

  if (isDemoMode()) {
    const players = loadDemoPlayers();
    const beforeBoard = buildBoardFromPlayers(players);
    const outBefore = new Set(beforeBoard.teams.filter((t) => t.isEliminated).map((t) => t.name));

    const active = players.filter((p) => !p.eliminatedDate);
    if (active.length <= 1) {
      throw new Error("The draw is already complete. Only one player remains.");
    }
    const maxAllowed = active.length - 1;
    if (num > maxAllowed) {
      throw new Error(
        `You can draw at most ${maxAllowed} ${maxAllowed === 1 ? "name" : "names"} so that 1 winner remains.`
      );
    }

    const chosen = shuffleArray(active).slice(0, num);
    const chosenIds = new Set(chosen.map((p) => p.id));
    const updated = players.map((p) => (chosenIds.has(p.id) ? { ...p, eliminatedDate: stamp } : p));
    saveDemoPlayers(updated);

    const afterBoard = buildBoardFromPlayers(updated);
    const newlyEliminatedTeams = afterBoard.teams
      .filter((t) => t.isEliminated && !outBefore.has(t.name))
      .map((t) => t.name);
    const round = afterBoard.players.find((p) => p.eliminatedDate === stamp).drawRound;

    return {
      ok: true,
      round,
      label: shortDayLabel(stamp),
      eliminatedAt: stamp,
      eliminated: chosen.map((p) => ({ name: p.name, team: p.team })),
      newlyEliminatedTeams,
      board: afterBoard,
    };
  }

  const res = await postAppsScript({
    action: "draw",
    passcode: String(passcode || ""),
    count: num,
    date: stamp,
  });

  return {
    ...res,
    label: shortDayLabel(res.label || stamp),
    board: buildBoardFromPlayers(res.players, res.updatedAt),
  };
}

/**
 * Clears the most recent date from every name marked with it. Names stay on the sheet.
 */
export async function undoLastDraw({ passcode }) {
  if (isDemoMode()) {
    const players = loadDemoPlayers();
    const dates = Array.from(
      new Set(players.filter((p) => p.eliminatedDate).map((p) => p.eliminatedDate))
    ).sort();
    if (dates.length === 0) {
      throw new Error("There are no completed draws to undo.");
    }

    const latest = dates[dates.length - 1];
    const restored = [];
    const updated = players.map((p) => {
      if (p.eliminatedDate !== latest) return p;
      restored.push({ name: p.name, team: p.team });
      return { ...p, eliminatedDate: "" };
    });
    saveDemoPlayers(updated);

    return {
      ok: true,
      undoneRound: dates.length,
      undoneDate: latest,
      restored,
      board: buildBoardFromPlayers(updated),
    };
  }

  const res = await postAppsScript({ action: "undo", passcode: String(passcode || "") });
  return {
    ...res,
    board: buildBoardFromPlayers(res.players, res.updatedAt),
  };
}
