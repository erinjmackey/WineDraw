/**
 * Full-Screen Projector Board Controller (projector.html)
 * Displays all teams simultaneously on a 16:9 screen with auto-refresh and fullscreen toggle.
 */

import { fetchBoard, getConfig, isDemoMode } from "./api.js";
import { escapeHtml, formatDateTime, ICONS, preserveRosterParam } from "./ui-helpers.js";

const state = {
  board: null,
  activeOnly: false,
  error: "",
};

const els = {};

function cacheElements() {
  els.ornament = document.getElementById("proj-ornament");
  els.title = document.getElementById("proj-title");
  els.demoPill = document.getElementById("proj-demo-pill");
  els.updated = document.getElementById("proj-updated");
  els.tallies = document.getElementById("proj-tallies");
  els.spotlight = document.getElementById("proj-spotlight");
  els.grid = document.getElementById("proj-grid");
  els.activeToggle = document.getElementById("proj-active-toggle");
  els.refreshBtn = document.getElementById("proj-refresh");
  els.fullscreenBtn = document.getElementById("proj-fullscreen");
}

function applyBranding() {
  const cfg = getConfig();
  document.title = `Projector — ${cfg.eventName}`;
  if (els.title) els.title.textContent = cfg.eventName;
  if (els.ornament) els.ornament.innerHTML = ICONS.wineHolly;
  if (els.demoPill) els.demoPill.hidden = !isDemoMode();
}

// Pick a grid shape close to a 16:9 screen: columns ~ sqrt(teams x 1.6), then fill rows.
// 8 teams -> 4x2, 20 teams -> 6x4, 37 teams -> 8x5.
function chooseLayout(teamCount) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(teamCount * 1.6)));
  const rows = Math.max(1, Math.ceil(teamCount / cols));
  return { cols, rows };
}

function renderTallies(board) {
  const s = board.summary;
  els.tallies.innerHTML = `
    <div class="proj-tally proj-tally--pine">
      <span class="proj-tally-num">${s.activePlayers}<small>/${s.totalPlayers}</small></span>
      <span class="proj-tally-label">Players In</span>
    </div>
    <div class="proj-tally proj-tally--pine">
      <span class="proj-tally-num">${s.activeTeams}<small>/${s.totalTeams}</small></span>
      <span class="proj-tally-label">Teams Left</span>
    </div>
    <div class="proj-tally proj-tally--claret">
      <span class="proj-tally-num">${s.eliminatedPlayers}</span>
      <span class="proj-tally-label">Out</span>
    </div>
  `;
}

function renderSpotlight(board) {
  const winner = board.summary.winner;
  if (winner) {
    els.spotlight.hidden = false;
    els.spotlight.className = "proj-spotlight proj-spotlight--winner";
    els.spotlight.innerHTML = `
      <span class="proj-spot-label">${ICONS.crown} Winner</span>
      <span class="proj-spot-winner">${escapeHtml(winner.name)} &mdash; <strong>${escapeHtml(winner.team)}</strong> wins the wine!</span>
    `;
    return;
  }

  const latest = board.rounds[0];
  if (!latest) {
    els.spotlight.hidden = true;
    els.spotlight.innerHTML = "";
    return;
  }

  els.spotlight.hidden = false;
  els.spotlight.className = "proj-spotlight";
  const chips = latest.players
    .map(
      (p) =>
        `<span class="proj-chip">${escapeHtml(p.name)} <span>(${escapeHtml(p.team)})</span></span>`
    )
    .join("");

  els.spotlight.innerHTML = `
    <span class="proj-spot-label">Round ${latest.round} Out (${latest.players.length}):</span>
    <div class="proj-spot-chips">
      <div class="proj-spot-track">
        <div class="proj-spot-group">
          ${chips}
        </div>
        <div class="proj-spot-group" aria-hidden="true">
          ${chips}
        </div>
      </div>
    </div>
  `;
}

function renderGrid(board) {
  const winnerTeam = board.summary.winner ? board.summary.winner.team : "";
  let teams = board.teams.slice();

  if (state.activeOnly) {
    teams = teams.filter((t) => !t.isEliminated);
  }

  // Active teams first, then eliminated teams, preserving sheet order within each group
  teams.sort((a, b) => {
    if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
    return a.originalOrder - b.originalOrder;
  });

  if (teams.length === 0) {
    els.grid.style.removeProperty("--proj-cols");
    els.grid.innerHTML = `<div class="proj-empty">No teams match the current filter.</div>`;
    return;
  }

  const { cols, rows } = chooseLayout(teams.length);
  els.grid.style.setProperty("--proj-cols", String(cols));
  els.grid.style.setProperty("--proj-rows", String(rows));

  els.grid.innerHTML = teams
    .map((team) => {
      const isWinnerTeam = winnerTeam && team.name === winnerTeam;
      const pct = team.totalCount > 0 ? Math.round((team.activeCount / team.totalCount) * 100) : 0;

      const badge = team.isEliminated
        ? `<span class="proj-badge proj-badge--out">Out</span>`
        : isWinnerTeam
          ? `<span class="proj-badge proj-badge--winner">Winner</span>`
          : `<span class="proj-badge proj-badge--in">${team.activeCount}/${team.totalCount}</span>`;

      const cardClass = [
        "proj-team",
        team.isEliminated ? "proj-team--out" : "",
        isWinnerTeam ? "proj-team--winner" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const playersHtml = team.players
        .map((p) => {
          const isWinnerPlayer = board.summary.winner && board.summary.winner.id === p.id;
          const rowCls = [
            "proj-player",
            p.eliminated ? "proj-player--out" : "",
            isWinnerPlayer ? "proj-player--winner" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const dot = p.eliminated
            ? `<span class="proj-dot proj-dot--out" aria-hidden="true"></span>`
            : `<span class="proj-dot proj-dot--in" aria-hidden="true"></span>`;
          const tag = p.eliminated
            ? `<span class="proj-day">Rd ${p.drawRound}</span>`
            : isWinnerPlayer
              ? `<span class="proj-day proj-day--winner">Winner</span>`
              : "";
          return `<li class="${rowCls}">${dot}<span class="proj-player-name">${escapeHtml(p.name)}</span>${tag}</li>`;
        })
        .join("");

      return `
        <article class="${cardClass}">
          <h2 class="proj-team-name">${escapeHtml(team.name)}</h2>
          <div class="proj-progress-row">
            <div class="proj-progress"><div class="proj-progress-fill" style="width:${pct}%"></div></div>
            ${badge}
          </div>
          <ul class="proj-players">${playersHtml}</ul>
        </article>
      `;
    })
    .join("");
}

function render() {
  if (state.error) {
    els.grid.innerHTML = `<div class="proj-empty">${escapeHtml(state.error)}</div>`;
    return;
  }
  if (!state.board) return;

  if (els.updated) {
    els.updated.textContent = state.board.updatedAt
      ? `Updated ${formatDateTime(state.board.updatedAt)}`
      : "Live";
  }

  renderTallies(state.board);
  renderSpotlight(state.board);
  renderGrid(state.board);
}

async function loadBoard() {
  try {
    state.board = await fetchBoard();
    state.error = "";
    render();
  } catch (err) {
    state.error = err.message || "Could not load standings.";
    render();
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

function updateFullscreenButton() {
  if (!els.fullscreenBtn) return;
  els.fullscreenBtn.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
}

function bindEvents() {
  els.activeToggle?.addEventListener("click", () => {
    state.activeOnly = !state.activeOnly;
    els.activeToggle.setAttribute("aria-pressed", String(state.activeOnly));
    els.activeToggle.textContent = state.activeOnly ? "Show All" : "Active Only";
    render();
  });

  els.refreshBtn?.addEventListener("click", loadBoard);
  els.fullscreenBtn?.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "f" || e.key === "F") toggleFullscreen();
    if (e.key === "r" || e.key === "R") loadBoard();
  });

  window.addEventListener("storage", () => {
    if (isDemoMode()) loadBoard();
  });
}

function init() {
  preserveRosterParam();
  cacheElements();
  applyBranding();
  bindEvents();
  loadBoard();

  const cfg = getConfig();
  const intervalSec = isDemoMode() ? 0 : Math.min(cfg.autoRefreshSeconds || 30, 20);
  if (intervalSec > 0) {
    setInterval(() => {
      if (!document.hidden) loadBoard();
    }, intervalSec * 1000);
  }
}

document.addEventListener("DOMContentLoaded", init);
