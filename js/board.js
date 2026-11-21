/**
 * Public Wine Draw Board Controller (index.html)
 */

import { fetchBoard, getConfig, isDemoMode } from "./api.js";
import { escapeHtml, formatDateTime, ICONS, preserveRosterParam } from "./ui-helpers.js";

const state = {
  board: null,
  filter: "all", // all | active | eliminated
  sort: "active-first", // active-first | most-remaining | alpha | original
  search: "",
  loading: true,
  error: "",
};

const els = {};

function cacheElements() {
  els.demoBanner = document.getElementById("demo-banner");
  els.heroSeason = document.getElementById("hero-season");
  els.heroTitle = document.getElementById("hero-title");
  els.heroSubtitle = document.getElementById("hero-subtitle");
  els.heroOrnament = document.getElementById("hero-ornament");
  els.winnerSlot = document.getElementById("winner-slot");
  els.statsSlot = document.getElementById("stats-slot");
  els.latestDrawSlot = document.getElementById("latest-draw-slot");
  els.teamsSlot = document.getElementById("teams-slot");
  els.searchInput = document.getElementById("search-input");
  els.searchClear = document.getElementById("search-clear");
  els.filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  els.sortSelect = document.getElementById("sort-select");
  els.historyModal = document.getElementById("history-modal");
  els.historyBody = document.getElementById("history-modal-body");
  els.historyClose = document.getElementById("history-modal-close");
  els.openHistoryNav = document.getElementById("open-history-nav");

  els.winnersModal = document.getElementById("winners-modal");
  els.winnersBody = document.getElementById("winners-modal-body");
  els.winnersClose = document.getElementById("winners-modal-close");
  els.openWinnersNav = document.getElementById("open-winners-nav");
  els.partyModal = document.getElementById("party-modal");
  els.partyClose = document.getElementById("party-modal-close");
  els.openPartyNav = document.getElementById("open-party-nav");
  els.refreshBtn = document.getElementById("refresh-btn");
  els.lastUpdated = document.getElementById("last-updated");
  els.footerEventName = document.getElementById("footer-event-name");
}

function applyBranding() {
  const cfg = getConfig();
  document.title = cfg.eventName;
  if (els.heroSeason) els.heroSeason.textContent = cfg.seasonLabel || "Holiday Vintage";
  if (els.heroTitle) els.heroTitle.textContent = cfg.eventName;
  if (els.heroSubtitle) {
    els.heroSubtitle.textContent = cfg.eventSubtitle || cfg.prizeDescription;
  }
  if (els.heroOrnament) {
    els.heroOrnament.innerHTML = `${ICONS.wineHolly}<span class="hero-season">${escapeHtml(
      cfg.seasonLabel || "Holiday Vintage"
    )}</span>`;
  }
  if (els.footerEventName) els.footerEventName.textContent = cfg.eventName;
  if (els.demoBanner) {
    els.demoBanner.hidden = !isDemoMode();
  }
}

function renderWinnerBanner(board) {
  const winner = board?.summary?.winner;
  if (!winner) {
    els.winnerSlot.innerHTML = "";
    return;
  }
  const cfg = getConfig();
  els.winnerSlot.innerHTML = `
    <section class="winner-banner" aria-label="Wine Draw Winner">
      <div class="winner-kicker">${ICONS.crown} Grand Vintage Champion</div>
      <h2 class="winner-name">${escapeHtml(winner.name)}</h2>
      <p class="winner-team">Representing ${escapeHtml(winner.team)}</p>
      <p class="winner-note">Last name standing — cheers to the winner of ${escapeHtml(cfg.eventName)}!</p>
    </section>
  `;
}

function renderStats(board) {
  const s = board.summary;
  const latestRound = board.rounds[0];
  const latestTitle = latestRound
    ? latestRound.label || `Round ${latestRound.round}`
    : "No draws yet";
  const latestSub = latestRound
    ? `${latestRound.players.length} ${latestRound.players.length === 1 ? "name" : "names"} drawn (Round ${latestRound.round})`
    : "Ready for Round 1";

  els.statsSlot.innerHTML = `
    <div class="stat-card stat-card--pine">
      <div class="stat-label">Players Still In</div>
      <div class="stat-value">${s.activePlayers} <small>/ ${s.totalPlayers}</small></div>
      <div class="stat-sub">${s.winner ? "Final winner crowned!" : "Still in the running"}</div>
    </div>
    <div class="stat-card stat-card--pine">
      <div class="stat-label">Teams Remaining</div>
      <div class="stat-value">${s.activeTeams} <small>/ ${s.totalTeams}</small></div>
      <div class="stat-sub">${s.eliminatedTeams} ${s.eliminatedTeams === 1 ? "team" : "teams"} eliminated</div>
    </div>
    <div class="stat-card stat-card--claret">
      <div class="stat-label">Eliminated So Far</div>
      <div class="stat-value">${s.eliminatedPlayers}</div>
      <div class="stat-sub">${s.currentRound} ${s.currentRound === 1 ? "draw round" : "draw rounds"} completed</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Latest Draw</div>
      <div class="stat-value" style="font-size: 1.65rem; padding-top: 0.25rem;">${escapeHtml(latestTitle)}</div>
      <div class="stat-sub">${escapeHtml(latestSub)}</div>
    </div>
  `;
}

function renderLatestDraw(board) {
  const latest = board.rounds[0];
  if (!latest) {
    els.latestDrawSlot.innerHTML = "";
    return;
  }

  const labelPart = latest.label && latest.label !== `Round ${latest.round}`
    ? `Round ${latest.round} &middot; ${escapeHtml(latest.label)}`
    : `Round ${latest.round}`;

  const chips = latest.players
    .map(
      (p) =>
        `<span class="drawn-chip">${escapeHtml(p.name)} <span>(${escapeHtml(p.team)})</span></span>`
    )
    .join("");

  els.latestDrawSlot.innerHTML = `
    <section class="latest-draw" aria-label="Most recent elimination draw">
      <div class="latest-draw-header">
        <div>
          <h2 class="latest-draw-title">Most Recent Draw &mdash; ${labelPart}</h2>
          <div class="latest-draw-meta">
            ${latest.players.length} ${latest.players.length === 1 ? "name" : "names"} eliminated${
              latest.eliminatedAt ? ` &middot; ${escapeHtml(formatDateTime(latest.eliminatedAt))}` : ""
            }
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm no-print" id="open-history-inline">
          ${ICONS.history} Full Draw History (${board.rounds.length})
        </button>
      </div>
      <div class="latest-draw-chips">${chips}</div>
    </section>
  `;

  const inlineBtn = document.getElementById("open-history-inline");
  if (inlineBtn) {
    inlineBtn.addEventListener("click", openHistoryModal);
  }
}

function getFilteredAndSortedTeams(board) {
  const q = state.search.trim().toLowerCase();

  let teams = board.teams.filter((team) => {
    if (state.filter === "active" && team.isEliminated) return false;
    if (state.filter === "eliminated" && !team.isEliminated) return false;

    if (!q) return true;
    if (team.name.toLowerCase().includes(q)) return true;
    return team.players.some((p) => p.name.toLowerCase().includes(q));
  });

  teams = teams.slice();
  if (state.sort === "active-first") {
    teams.sort((a, b) => {
      if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
      return a.originalOrder - b.originalOrder;
    });
  } else if (state.sort === "most-remaining") {
    teams.sort((a, b) => {
      if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
      return a.originalOrder - b.originalOrder;
    });
  } else if (state.sort === "alpha") {
    teams.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    teams.sort((a, b) => a.originalOrder - b.originalOrder);
  }

  return teams;
}

function renderTeams(board) {
  if (board.teams.length === 0) {
    els.teamsSlot.innerHTML = `
      <div class="state-box">
        <p><strong>No teams found yet.</strong> Add teams and players to your Google Sheet to see them here.</p>
      </div>
    `;
    return;
  }

  const teams = getFilteredAndSortedTeams(board);
  const winner = board.summary.winner;
  const q = state.search.trim().toLowerCase();

  if (teams.length === 0) {
    els.teamsSlot.innerHTML = `
      <div class="state-box">
        <p>No teams or players match your current filter or search.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="clear-filters-btn">Show All Teams</button>
      </div>
    `;
    const clearBtn = document.getElementById("clear-filters-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        state.search = "";
        state.filter = "all";
        els.searchInput.value = "";
        els.searchClear.hidden = true;
        updateFilterButtons();
        renderBoard();
      });
    }
    return;
  }

  const cardsHtml = teams
    .map((team) => {
      const isWinnerTeam = Boolean(winner && winner.team === team.name && !team.isEliminated);
      const cardClass = isWinnerTeam
        ? "team-card team-card--winner"
        : team.isEliminated
          ? "team-card team-card--eliminated"
          : "team-card team-card--active";

      let badgeHtml;
      if (isWinnerTeam) {
        badgeHtml = `<span class="team-status-badge team-status-badge--winner">${ICONS.crown} Winner</span>`;
      } else if (team.isEliminated) {
        badgeHtml = `<span class="team-status-badge team-status-badge--eliminated">Eliminated</span>`;
      } else {
        badgeHtml = `<span class="team-status-badge team-status-badge--active">${team.activeCount} of ${team.totalCount} left</span>`;
      }

      const pct = team.totalCount > 0 ? Math.round((team.activeCount / team.totalCount) * 100) : 0;

      // Keep active players listed cleanly above eliminated players? Keep original sheet order so families stay easy to spot!
      const playersHtml = team.players
        .map((player) => {
          const isWinnerPlayer = Boolean(
            winner && winner.name === player.name && winner.team === player.team && !player.eliminated
          );
          const isMatch = q && player.name.toLowerCase().includes(q);

          const rowClasses = [
            "player-row",
            player.eliminated ? "player-row--eliminated" : "player-row--active",
            isMatch ? "player-row--match" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const dotClass = isWinnerPlayer
            ? "player-dot player-dot--winner"
            : player.eliminated
              ? "player-dot player-dot--eliminated"
              : "player-dot player-dot--active";

          let tagHtml;
          if (isWinnerPlayer) {
            tagHtml = `<span class="player-tag player-tag--winner">Winner!</span>`;
          } else if (player.eliminated) {
            const detailText = player.drawRound ? `Out &middot; Rd ${player.drawRound}` : "Out";
            const when = player.eliminatedAt ? ` title="Eliminated ${escapeHtml(formatDateTime(player.eliminatedAt))}"` : "";
            tagHtml = `<span class="player-tag player-tag--eliminated"${when}>${detailText}</span>`;
          } else {
            tagHtml = `<span class="player-tag player-tag--active">Still In</span>`;
          }

          return `
            <li class="${rowClasses}">
              <span class="player-left">
                <span class="${dotClass}" aria-hidden="true"></span>
                <span class="player-name">${escapeHtml(player.name)}</span>
              </span>
              ${tagHtml}
            </li>
          `;
        })
        .join("");

      const eliminatedRibbon = team.isEliminated
        ? `<div class="team-eliminated-ribbon">Team Eliminated &middot; All ${team.totalCount} Out</div>`
        : `<div class="team-meter" aria-hidden="true"><div class="team-meter-fill" style="width: ${pct}%"></div></div>`;

      return `
        <article class="${cardClass}" aria-label="Team ${escapeHtml(team.name)}">
          <div class="team-card-header">
            <h3 class="team-name">${escapeHtml(team.name)}</h3>
            ${badgeHtml}
          </div>
          ${eliminatedRibbon}
          <ul class="player-list">
            ${playersHtml}
          </ul>
        </article>
      `;
    })
    .join("");

  els.teamsSlot.innerHTML = `<div class="teams-grid">${cardsHtml}</div>`;
}

function renderBoard() {
  if (state.loading && !state.board) {
    els.teamsSlot.innerHTML = `
      <div class="state-box">
        <div class="spinner" aria-hidden="true"></div>
        <p>Uncorking the latest team standings&hellip;</p>
      </div>
    `;
    return;
  }

  if (state.error && !state.board) {
    els.teamsSlot.innerHTML = `
      <div class="state-box">
        <div class="alert alert-error" style="max-width: 560px; margin: 0 auto 1rem;">
          ${escapeHtml(state.error)}
        </div>
        <button type="button" class="btn btn-primary" id="retry-load-btn">Try Again</button>
      </div>
    `;
    document.getElementById("retry-load-btn")?.addEventListener("click", () => loadBoard(true));
    return;
  }

  if (!state.board) return;

  renderWinnerBanner(state.board);
  renderStats(state.board);
  renderLatestDraw(state.board);
  renderTeams(state.board);

  if (els.lastUpdated) {
    els.lastUpdated.textContent = state.board.updatedAt
      ? `Updated ${formatDateTime(state.board.updatedAt)}`
      : "";
  }
}

function openHistoryModal() {
  if (!state.board) return;
  const rounds = state.board.rounds;

  if (rounds.length === 0) {
    els.historyBody.innerHTML = `<p>No elimination draws have been held yet. Everyone is still in!</p>`;
  } else {
    els.historyBody.innerHTML = rounds
      .map((r) => {
        const heading =
          r.label && r.label !== `Round ${r.round}`
            ? `Round ${r.round} &mdash; ${escapeHtml(r.label)}`
            : `Round ${r.round}`;
        const items = r.players
          .map(
            (p) =>
              `<li><strong>${escapeHtml(p.name)}</strong> <span class="history-team">&mdash; ${escapeHtml(p.team)}</span></li>`
          )
          .join("");
        return `
          <div class="history-round">
            <div class="history-round-head">
              <h3 class="history-round-title">${heading}</h3>
              <span class="history-round-date">${r.players.length} ${r.players.length === 1 ? "name" : "names"}</span>
            </div>
            <ol class="history-list">${items}</ol>
          </div>
        `;
      })
      .join("");
  }

  els.historyModal.hidden = false;
  els.historyClose.focus();
}

function closeHistoryModal() {
  els.historyModal.hidden = true;
}

function openWinnersModal() {
  if (!state.board || !els.winnersModal) return;
  const winners = state.board.previousWinners || [];

  if (winners.length === 0) {
    els.winnersBody.innerHTML = `<p>No previous winners have been recorded yet.</p>`;
  } else {
    const winnersByYear = new Map();
    winners.forEach((winner) => {
      const year = winner.year || "—";
      if (!winnersByYear.has(year)) winnersByYear.set(year, []);
      winnersByYear.get(year).push(winner);
    });

    els.winnersBody.innerHTML = `
      <div class="winners-list">
        ${Array.from(winnersByYear.entries())
          .map(
            ([year, yearWinners]) => `
          <section class="winners-year-group">
            <h3 class="winners-year">${escapeHtml(year)}</h3>
            <ul class="winners-year-list">
              ${yearWinners
                .map(
                  (w) => `
                <li class="winners-item">
                  <div class="winners-info">
                    <strong class="winners-name">${escapeHtml(w.winner)}</strong>
                    ${w.team ? `<span class="winners-team">${escapeHtml(w.team)}</span>` : ""}
                  </div>
                  ${w.notes ? `<span class="winners-notes">${escapeHtml(w.notes)}</span>` : ""}
                </li>
              `
                )
                .join("")}
            </ul>
          </section>
        `
          )
          .join("")}
      </div>
    `;
  }

  els.winnersModal.hidden = false;
  els.winnersClose?.focus();
}

function closeWinnersModal() {
  if (els.winnersModal) els.winnersModal.hidden = true;
}

function openPartyModal() {
  if (!els.partyModal) return;
  els.partyModal.hidden = false;
  els.partyClose?.focus();
}

function closePartyModal() {
  if (!els.partyModal) return;
  els.partyModal.hidden = true;
}

function updateFilterButtons() {
  els.filterButtons.forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.filter === state.filter ? "true" : "false");
  });
}

async function loadBoard(showSpinner = false) {
  if (showSpinner) {
    state.loading = true;
    state.error = "";
    renderBoard();
  }
  try {
    const board = await fetchBoard();
    state.board = board;
    state.error = "";
    state.loading = false;
    renderBoard();
  } catch (err) {
    state.loading = false;
    state.error = err.message || "Could not load the Wine Draw standings.";
    renderBoard();
  }
}

function bindEvents() {
  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value;
    els.searchClear.hidden = state.search.length === 0;
    renderBoard();
  });

  els.searchClear.addEventListener("click", () => {
    state.search = "";
    els.searchInput.value = "";
    els.searchClear.hidden = true;
    els.searchInput.focus();
    renderBoard();
  });

  els.filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      updateFilterButtons();
      renderBoard();
    });
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    renderBoard();
  });

  els.openPartyNav?.addEventListener("click", (e) => {
    e.preventDefault();
    openPartyModal();
  });

  els.openHistoryNav?.addEventListener("click", (e) => {
    e.preventDefault();
    openHistoryModal();
  });

  els.openWinnersNav?.addEventListener("click", (e) => {
    e.preventDefault();
    openWinnersModal();
  });

  els.refreshBtn?.addEventListener("click", () => loadBoard(false));

  els.partyClose?.addEventListener("click", closePartyModal);
  els.partyModal?.addEventListener("click", (e) => {
    if (e.target === els.partyModal) closePartyModal();
  });

  els.historyClose?.addEventListener("click", closeHistoryModal);
  els.historyModal?.addEventListener("click", (e) => {
    if (e.target === els.historyModal) closeHistoryModal();
  });

  els.winnersClose?.addEventListener("click", closeWinnersModal);
  els.winnersModal?.addEventListener("click", (e) => {
    if (e.target === els.winnersModal) closeWinnersModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!els.historyModal.hidden) closeHistoryModal();
      if (els.winnersModal && !els.winnersModal.hidden) closeWinnersModal();
      if (els.partyModal && !els.partyModal.hidden) closePartyModal();
    }
  });

  // Live sync across tabs in Demo Mode
  window.addEventListener("storage", () => {
    if (isDemoMode()) {
      loadBoard(false);
    }
  });
}

function init() {
  preserveRosterParam();
  cacheElements();
  applyBranding();
  bindEvents();
  loadBoard(true);

  const cfg = getConfig();
  if (!isDemoMode() && cfg.autoRefreshSeconds > 0) {
    setInterval(() => {
      if (!document.hidden) loadBoard(false);
    }, cfg.autoRefreshSeconds * 1000);
  }
}

document.addEventListener("DOMContentLoaded", init);
