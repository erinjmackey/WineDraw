/**
 * Admin Draw Console Controller (admin.html)
 */

import {
  drawEliminations,
  fetchBoard,
  getConfig,
  getEffectiveApiUrl,
  isDemoMode,
  resetDemoData,
  setApiUrlOverride,
  undoLastDraw,
  verifyAdminPasscode,
} from "./api.js";
import {
  escapeHtml,
  shortDayLabel,
  nowTimestamp,
  nowInputMinute,
  formatDateTime,
  formatEliminationAnnouncement,
  ICONS,
  preserveRosterParam,
} from "./ui-helpers.js";

const SESSION_PASSCODE_KEY = "mackey_wine_draw_admin_passcode";

const state = {
  passcode: "",
  unlocked: false,
  board: null,
  lastDrawResult: null,
  busy: false,
  confirmAction: null,
};

const els = {};

function cacheElements() {
  els.demoBanner = document.getElementById("demo-banner");
  els.heroTitle = document.getElementById("hero-title");
  els.heroOrnament = document.getElementById("hero-ornament");
  els.footerEventName = document.getElementById("footer-event-name");

  // Auth gate
  els.authSection = document.getElementById("auth-section");
  els.authForm = document.getElementById("auth-form");
  els.passcodeInput = document.getElementById("passcode-input");
  els.authError = document.getElementById("auth-error");
  els.authSubmitBtn = document.getElementById("auth-submit-btn");
  els.demoQuickUnlockWrap = document.getElementById("demo-quick-unlock-wrap");
  els.demoQuickUnlockBtn = document.getElementById("demo-quick-unlock-btn");
  els.demoPasscodeHint = document.getElementById("demo-passcode-hint");

  // Main admin workspace
  els.adminWorkspace = document.getElementById("admin-workspace");
  els.adminAlert = document.getElementById("admin-alert");
  els.adminStats = document.getElementById("admin-stats");
  els.adminWinnerSlot = document.getElementById("admin-winner-slot");

  // Draw form
  els.drawForm = document.getElementById("draw-form");
  els.drawCountInput = document.getElementById("draw-count-input");
  els.drawDecrementBtn = document.getElementById("draw-decrement");
  els.drawIncrementBtn = document.getElementById("draw-increment");
  els.drawMaxHint = document.getElementById("draw-max-hint");
  els.drawAutoTime = document.getElementById("draw-auto-time");
  els.drawDateInput = document.getElementById("draw-date-input");
  els.drawSubmitBtn = document.getElementById("draw-submit-btn");
  els.quickPickBtns = Array.from(document.querySelectorAll("[data-quick-pick]"));

  // Result display
  els.resultSlot = document.getElementById("draw-result-slot");

  // Undo & history & actions
  els.undoBtn = document.getElementById("undo-last-btn");
  els.undoHint = document.getElementById("undo-hint");
  els.historyListSlot = document.getElementById("admin-history-slot");
  els.demoResetWrap = document.getElementById("demo-reset-wrap");
  els.demoResetBtn = document.getElementById("demo-reset-btn");
  els.lockBtn = document.getElementById("lock-admin-btn");
  els.connectionStatus = document.getElementById("connection-status");

  // Optional API override tester
  els.apiUrlInput = document.getElementById("api-url-input");
  els.apiUrlSaveBtn = document.getElementById("api-url-save");
  els.apiUrlClearBtn = document.getElementById("api-url-clear");

  // Confirmation modal
  els.confirmModal = document.getElementById("confirm-modal");
  els.confirmTitle = document.getElementById("confirm-title");
  els.confirmBody = document.getElementById("confirm-body");
  els.confirmOkBtn = document.getElementById("confirm-ok-btn");
  els.confirmCancelBtn = document.getElementById("confirm-cancel-btn");
  els.confirmCloseBtn = document.getElementById("confirm-close-btn");

  // Print sheet
  els.printSheet = document.getElementById("print-sheet");
}

function applyBranding() {
  const cfg = getConfig();
  document.title = `Admin Console — ${cfg.eventName}`;
  if (els.heroTitle) els.heroTitle.textContent = `${cfg.eventName}`;
  if (els.heroOrnament) {
    els.heroOrnament.innerHTML = `${ICONS.wineHolly}<span class="hero-season">Drawmaster Console</span>`;
  }
  if (els.footerEventName) els.footerEventName.textContent = cfg.eventName;

  const demo = isDemoMode();
  if (els.demoBanner) els.demoBanner.hidden = !demo;
  if (els.demoQuickUnlockWrap) els.demoQuickUnlockWrap.hidden = !demo;
  if (els.demoResetWrap) els.demoResetWrap.hidden = !demo;
  if (els.demoPasscodeHint) {
    els.demoPasscodeHint.textContent = cfg.demoPasscode || "mackey";
  }

  if (els.connectionStatus) {
    const url = getEffectiveApiUrl();
    if (url) {
      els.connectionStatus.innerHTML = `<strong>Live Google Sheet connected</strong><br><span style="font-size:0.86rem; word-break:break-all; color: var(--ink-muted);">${escapeHtml(url)}</span>`;
    } else {
      els.connectionStatus.innerHTML = `<strong>Demo Mode (Browser Storage)</strong><br><span style="font-size:0.88rem; color: var(--ink-muted);">Set <code>API_URL</code> in <code>config.js</code> (or test a URL below) to connect your live Google Sheet.</span>`;
    }
  }

  if (els.apiUrlInput && !cfg.API_URL) {
    els.apiUrlInput.value = getEffectiveApiUrl();
  }
}

function showAlert(message, type = "info") {
  if (!message) {
    els.adminAlert.hidden = true;
    els.adminAlert.innerHTML = "";
    return;
  }
  els.adminAlert.hidden = false;
  els.adminAlert.className = `alert alert-${type}`;
  els.adminAlert.textContent = message;
}

function setBusy(busy) {
  state.busy = busy;
  if (els.drawSubmitBtn) els.drawSubmitBtn.disabled = busy || getMaxDrawable() < 1;
  if (els.undoBtn) els.undoBtn.disabled = busy || !hasUndoableRound();
}

function getMaxDrawable() {
  if (!state.board) return 0;
  return Math.max(0, state.board.summary.activePlayers - 1);
}

function hasUndoableRound() {
  return Boolean(state.board && state.board.summary.currentRound > 0);
}

function syncDrawInputs() {
  const max = getMaxDrawable();
  const currentVal = parseInt(els.drawCountInput.value, 10) || 1;
  const clamped = max > 0 ? Math.min(Math.max(1, currentVal), max) : 0;

  els.drawCountInput.max = String(Math.max(1, max));
  els.drawCountInput.min = max > 0 ? "1" : "0";
  els.drawCountInput.value = String(max > 0 ? clamped : 0);
  els.drawCountInput.disabled = max < 1;

  els.drawDecrementBtn.disabled = max < 1 || clamped <= 1;
  els.drawIncrementBtn.disabled = max < 1 || clamped >= max;
  els.drawSubmitBtn.disabled = state.busy || max < 1;

  els.quickPickBtns.forEach((btn) => {
    const val = Number(btn.dataset.quickPick);
    btn.disabled = max < val;
  });

  if (max < 1) {
    if (state.board?.summary?.winner) {
      els.drawMaxHint.textContent = `Draw complete! ${state.board.summary.winner.name} is the final winner.`;
    } else {
      els.drawMaxHint.textContent = "Add at least 2 active players to hold a draw.";
    }
  } else {
    els.drawMaxHint.textContent = `Up to ${max} ${max === 1 ? "name" : "names"} can be drawn right now (leaves 1 winner standing).`;
  }
}

function renderAdminWorkspace() {
  if (!state.board) return;
  const s = state.board.summary;
  const nextRound = s.currentRound + 1;

  // Winner callout if complete
  if (s.winner) {
    els.adminWinnerSlot.innerHTML = `
      <section class="winner-banner" style="padding: 1.4rem 1.25rem; margin-bottom: 1.4rem;">
        <div class="winner-kicker">${ICONS.crown} Final Winner Standing</div>
        <h2 class="winner-name" style="font-size: 2.2rem;">${escapeHtml(s.winner.name)}</h2>
        <p class="winner-team">Team: ${escapeHtml(s.winner.team)}</p>
      </section>
    `;
  } else {
    els.adminWinnerSlot.innerHTML = "";
  }

  // Stats strip
  els.adminStats.innerHTML = `
    <div class="stat-card stat-card--pine">
      <div class="stat-label">Active Players</div>
      <div class="stat-value">${s.activePlayers} <small>/ ${s.totalPlayers}</small></div>
      <div class="stat-sub">Eligible for next draw</div>
    </div>
    <div class="stat-card stat-card--pine">
      <div class="stat-label">Active Teams</div>
      <div class="stat-value">${s.activeTeams} <small>/ ${s.totalTeams}</small></div>
      <div class="stat-sub">${s.eliminatedTeams} fully eliminated</div>
    </div>
    <div class="stat-card stat-card--claret">
      <div class="stat-label">Eliminated</div>
      <div class="stat-value">${s.eliminatedPlayers}</div>
      <div class="stat-sub">${s.currentRound} ${s.currentRound === 1 ? "round" : "rounds"} completed</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Next Round</div>
      <div class="stat-value">${s.winner ? "Done" : `#${nextRound}`}</div>
      <div class="stat-sub">${s.winner ? "Winner crowned" : "Ready when you are"}</div>
    </div>
  `;


  // Undo section
  const latestRound = state.board.rounds[0];
  els.undoBtn.disabled = state.busy || !latestRound;
  if (latestRound) {
    const labelStr = latestRound.label ? ` (${latestRound.label})` : "";
    els.undoHint.textContent = `Last completed draw: Round ${latestRound.round}${labelStr} — ${latestRound.players.length} ${
      latestRound.players.length === 1 ? "name" : "names"
    }.`;
  } else {
    els.undoHint.textContent = "No draws have been run yet.";
  }

  syncDrawInputs();
  renderLastDrawResult();
  renderHistorySidebar();
}

function renderLastDrawResult() {
  const res = state.lastDrawResult;
  if (!res || !res.eliminated || res.eliminated.length === 0) {
    els.resultSlot.innerHTML = "";
    return;
  }

  const labelStr =
    res.label && res.label !== `Round ${res.round}`
      ? `Round ${res.round} &middot; ${escapeHtml(res.label)}`
      : `Round ${res.round}`;

  const itemsHtml = res.eliminated
    .map(
      (p, idx) => `
        <li class="drawn-list-item" style="animation-delay: ${Math.min(idx * 55, 650)}ms">
          <span class="drawn-list-name">${escapeHtml(p.name)}</span>
          <span class="drawn-list-team">${escapeHtml(p.team)}</span>
        </li>
      `
    )
    .join("");

  const teamOutHtml =
    res.newlyEliminatedTeams && res.newlyEliminatedTeams.length > 0
      ? `<div class="team-out-callout">
           <strong>${res.newlyEliminatedTeams.length === 1 ? "Team Eliminated:" : "Teams Eliminated:"}</strong>
           ${res.newlyEliminatedTeams.map(escapeHtml).join(", ")}
         </div>`
      : "";

  els.resultSlot.innerHTML = `
    <section class="draw-result-box" aria-live="polite">
      <div class="draw-result-head">
        <h3 class="draw-result-title">Eliminated in ${labelStr}</h3>
        <span class="history-round-date">${res.eliminated.length} ${
          res.eliminated.length === 1 ? "name" : "names"
        } removed</span>
      </div>
      ${teamOutHtml}
      <ol class="drawn-list">${itemsHtml}</ol>
      <div class="result-actions">
        <button type="button" class="btn btn-pine btn-sm" id="copy-latest-result">
          ${ICONS.copy} Copy Announcement
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="print-latest-result">
          ${ICONS.print} Print Eliminated List
        </button>
      </div>
    </section>
  `;

  document.getElementById("copy-latest-result")?.addEventListener("click", (e) => {
    copyRoundToClipboard(res, e.currentTarget);
  });
  document.getElementById("print-latest-result")?.addEventListener("click", () => {
    printRoundList(res);
  });
}

function renderHistorySidebar() {
  const rounds = state.board?.rounds || [];
  if (rounds.length === 0) {
    els.historyListSlot.innerHTML = `<p class="panel-desc" style="margin-bottom:0;">No draws recorded yet. Once you run your first draw, every round will appear here for easy re-printing or copying.</p>`;
    return;
  }

  els.historyListSlot.innerHTML = rounds
    .map((r, idx) => {
      const heading =
        r.label && r.label !== `Round ${r.round}`
          ? `Round ${r.round} &mdash; ${escapeHtml(r.label)}`
          : `Round ${r.round}`;
      const listItems = r.players
        .map(
          (p) =>
            `<li><strong>${escapeHtml(p.name)}</strong> <span class="history-team">(${escapeHtml(p.team)})</span></li>`
        )
        .join("");

      return `
        <div class="history-round">
          <div class="history-round-head">
            <h3 class="history-round-title">${heading}</h3>
            <span class="history-round-date">${r.players.length} ${r.players.length === 1 ? "name" : "names"}</span>
          </div>
          <ol class="history-list" style="margin-bottom: 0.7rem;">${listItems}</ol>
          <div class="result-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-copy-round="${idx}">
              ${ICONS.copy} Copy
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-print-round="${idx}">
              ${ICONS.print} Print
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  els.historyListSlot.querySelectorAll("[data-copy-round]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = rounds[Number(btn.dataset.copyRound)];
      copyRoundToClipboard(
        {
          round: r.round,
          label: r.label,
          eliminated: r.players,
          eliminatedAt: r.eliminatedAt,
        },
        btn
      );
    });
  });

  els.historyListSlot.querySelectorAll("[data-print-round]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = rounds[Number(btn.dataset.printRound)];
      printRoundList({
        round: r.round,
        label: r.label,
        eliminated: r.players,
        eliminatedAt: r.eliminatedAt,
      });
    });
  });
}

async function copyRoundToClipboard(roundData, buttonEl) {
  const cfg = getConfig();
  const s = state.board?.summary;
  const isLatest = s && roundData.round === s.currentRound;
  const text = formatEliminationAnnouncement({
    eventName: cfg.eventName,
    round: roundData.round,
    label: roundData.label,
    eliminated: roundData.eliminated,
    newlyEliminatedTeams: roundData.newlyEliminatedTeams || [],
    remainingPlayers: isLatest ? s.activePlayers : undefined,
    remainingTeams: isLatest ? s.activeTeams : undefined,
    winner: isLatest ? s.winner : null,
  });

  try {
    await navigator.clipboard.writeText(text);
    const original = buttonEl.innerHTML;
    buttonEl.textContent = "Copied!";
    setTimeout(() => {
      buttonEl.innerHTML = original;
    }, 1800);
  } catch {
    // Fallback prompt if clipboard permission unavailable
    window.prompt("Copy this list:", text);
  }
}

function printRoundList(roundData) {
  const cfg = getConfig();
  const labelStr =
    roundData.label && roundData.label !== `Round ${roundData.round}`
      ? `Round ${roundData.round} — ${roundData.label}`
      : `Round ${roundData.round}`;

  const rowsHtml = roundData.eliminated
    .map(
      (p, idx) => `
        <tr>
          <td style="width: 48px;">${idx + 1}</td>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>${escapeHtml(p.team)}</td>
        </tr>
      `
    )
    .join("");

  const teamCallout =
    roundData.newlyEliminatedTeams && roundData.newlyEliminatedTeams.length > 0
      ? `<p style="margin-top: 1rem;"><strong>${
          roundData.newlyEliminatedTeams.length === 1 ? "Team Eliminated:" : "Teams Eliminated:"
        }</strong> ${roundData.newlyEliminatedTeams.map(escapeHtml).join(", ")}</p>`
      : "";

  const s = state.board?.summary;
  const footerSummary =
    s && roundData.round === s.currentRound
      ? s.winner
        ? `Winner of the Wine: ${s.winner.name} (${s.winner.team})`
        : `Remaining after this draw: ${s.activePlayers} players across ${s.activeTeams} teams.`
      : `Total eliminated in this round: ${roundData.eliminated.length}.`;

  els.printSheet.innerHTML = `
    <div class="print-sheet">
      <div class="print-sheet-header">
        <h1 class="print-sheet-title">${escapeHtml(cfg.eventName)}</h1>
        <p class="print-sheet-sub">
          Eliminated Names &mdash; ${escapeHtml(labelStr)}
          ${roundData.eliminatedAt ? ` &middot; ${escapeHtml(formatDateTime(roundData.eliminatedAt))}` : ""}
        </p>
      </div>
      <table class="print-sheet-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player Name</th>
            <th>Team</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      ${teamCallout}
      <div class="print-sheet-footer">${escapeHtml(footerSummary)}</div>
    </div>
  `;

  document.body.classList.add("printing-drawn-list");
  window.print();
  // Remove class after print dialog closes
  setTimeout(() => {
    document.body.classList.remove("printing-drawn-list");
  }, 500);
}

/* ==========================================================================
   Confirmation Modal
   ========================================================================== */
function openConfirm({ title, bodyHtml, confirmLabel, onConfirm }) {
  els.confirmTitle.textContent = title;
  els.confirmBody.innerHTML = bodyHtml;
  els.confirmOkBtn.textContent = confirmLabel || "Confirm";
  state.confirmAction = onConfirm;
  els.confirmModal.hidden = false;
  els.confirmOkBtn.focus();
}

function closeConfirm() {
  els.confirmModal.hidden = true;
  state.confirmAction = null;
}

/* ==========================================================================
   Actions: Unlock, Load, Draw, Undo, Reset
   ========================================================================== */
async function unlockWithPasscode(passcode) {
  els.authError.hidden = true;
  els.authSubmitBtn.disabled = true;
  els.authSubmitBtn.textContent = "Verifying…";

  try {
    await verifyAdminPasscode(passcode);
    state.passcode = passcode;
    state.unlocked = true;
    try {
      sessionStorage.setItem(SESSION_PASSCODE_KEY, passcode);
    } catch {
      // ignore
    }

    els.authSection.hidden = true;
    els.adminWorkspace.hidden = false;
    await refreshBoard();
  } catch (err) {
    els.authError.textContent = err.message || "Invalid passcode.";
    els.authError.hidden = false;
    els.passcodeInput.focus();
  } finally {
    els.authSubmitBtn.disabled = false;
    els.authSubmitBtn.textContent = "Unlock Draw Console";
  }
}

function lockConsole() {
  state.passcode = "";
  state.unlocked = false;
  state.lastDrawResult = null;
  try {
    sessionStorage.removeItem(SESSION_PASSCODE_KEY);
  } catch {
    // ignore
  }
  els.passcodeInput.value = "";
  els.authError.hidden = true;
  els.adminWorkspace.hidden = true;
  els.authSection.hidden = false;
  els.passcodeInput.focus();
}

async function refreshBoard() {
  try {
    const board = await fetchBoard();
    state.board = board;
    renderAdminWorkspace();
  } catch (err) {
    showAlert(err.message || "Could not load the latest board data.", "error");
  }
}

async function executeDraw(count, date) {
  setBusy(true);
  showAlert("");
  try {
    const res = await drawEliminations({
      passcode: state.passcode,
      count,
      date,
    });
    state.board = res.board;
    state.lastDrawResult = res;
    if (els.drawAutoTime?.checked && els.drawDateInput) {
      els.drawDateInput.value = nowInputMinute();
    }
    renderAdminWorkspace();
    showAlert(
      `Round ${res.round} complete — ${res.eliminated.length} ${
        res.eliminated.length === 1 ? "name" : "names"
      } eliminated and saved.`,
      "success"
    );
    els.resultSlot.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    showAlert(err.message || "Could not complete the draw.", "error");
  } finally {
    setBusy(false);
  }
}

async function executeUndo() {
  setBusy(true);
  showAlert("");
  try {
    const res = await undoLastDraw({ passcode: state.passcode });
    state.board = res.board;
    if (state.lastDrawResult && state.lastDrawResult.round === res.undoneRound) {
      state.lastDrawResult = null;
    }
    renderAdminWorkspace();
    showAlert(
      `Undid Round ${res.undoneRound} — restored ${res.restored.length} ${
        res.restored.length === 1 ? "player" : "players"
      } back to Still In.`,
      "info"
    );
  } catch (err) {
    showAlert(err.message || "Could not undo the last draw.", "error");
  } finally {
    setBusy(false);
  }
}

function bindEvents() {
  els.authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    unlockWithPasscode(els.passcodeInput.value);
  });

  els.demoQuickUnlockBtn?.addEventListener("click", () => {
    const cfg = getConfig();
    const demoPass = cfg.demoPasscode || "mackey";
    els.passcodeInput.value = demoPass;
    unlockWithPasscode(demoPass);
  });

  els.lockBtn?.addEventListener("click", lockConsole);

  // Stepper controls
  els.drawDecrementBtn.addEventListener("click", () => {
    const val = Math.max(1, (parseInt(els.drawCountInput.value, 10) || 1) - 1);
    els.drawCountInput.value = String(val);
    syncDrawInputs();
  });

  els.drawIncrementBtn.addEventListener("click", () => {
    const max = getMaxDrawable();
    const val = Math.min(max, (parseInt(els.drawCountInput.value, 10) || 0) + 1);
    els.drawCountInput.value = String(val);
    syncDrawInputs();
  });

  els.drawCountInput.addEventListener("input", () => {
    const max = getMaxDrawable();
    const raw = parseInt(els.drawCountInput.value, 10);
    if (!Number.isNaN(raw)) {
      els.drawDecrementBtn.disabled = raw <= 1;
      els.drawIncrementBtn.disabled = raw >= max;
    }
  });

  els.quickPickBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      els.drawCountInput.value = btn.dataset.quickPick;
      syncDrawInputs();
    });
  });

  els.drawAutoTime?.addEventListener("change", () => {
    const auto = els.drawAutoTime.checked;
    els.drawDateInput.disabled = auto;
    if (auto || !els.drawDateInput.value) {
      els.drawDateInput.value = nowInputMinute();
    }
  });

  // Draw submission with confirmation
  els.drawForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.busy) return;

    const count = parseInt(els.drawCountInput.value, 10);
    const max = getMaxDrawable();
    if (!Number.isInteger(count) || count < 1 || count > max) {
      showAlert(`Please enter a number between 1 and ${max}.`, "error");
      return;
    }

    const useAuto = Boolean(els.drawAutoTime?.checked);
    const stamp = useAuto ? nowTimestamp() : (els.drawDateInput.value || nowTimestamp());
    const nextRound = (state.board?.summary?.currentRound || 0) + 1;
    const willCrownWinner = state.board.summary.activePlayers - count === 1;

    openConfirm({
      title: `Confirm Round ${nextRound} Draw`,
      bodyHtml: `
        <p>You are about to randomly eliminate <strong>${count} ${
          count === 1 ? "player" : "players"
        }</strong> for <strong>Round ${nextRound} (${escapeHtml(shortDayLabel(stamp))})</strong>.</p>
        ${
          willCrownWinner
            ? `<p style="color: var(--claret-deep); font-weight: 600;">This draw will leave 1 final player standing — crowning the winner of the wine!</p>`
            : `<p style="color: var(--ink-secondary);">${
                state.board.summary.activePlayers - count
              } players will remain standing afterward.</p>`
        }
      `,
      confirmLabel: `Draw ${count} ${count === 1 ? "Name" : "Names"}`,
      onConfirm: () => executeDraw(count, useAuto ? nowTimestamp() : stamp),
    });
  });

  // Undo button
  els.undoBtn.addEventListener("click", () => {
    const latest = state.board?.rounds?.[0];
    if (!latest) return;
    const namesPreview = latest.players.map((p) => escapeHtml(p.name)).join(", ");
    openConfirm({
      title: `Undo Round ${latest.round}?`,
      bodyHtml: `
        <p>This will restore all <strong>${latest.players.length} ${
          latest.players.length === 1 ? "player" : "players"
        }</strong> from Round ${latest.round} back to <strong>Still In</strong>:</p>
        <p style="background: var(--bg-parchment); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-subtle);">${namesPreview}</p>
      `,
      confirmLabel: `Yes, Undo Round ${latest.round}`,
      onConfirm: () => executeUndo(),
    });
  });

  // Demo reset button
  els.demoResetBtn?.addEventListener("click", () => {
    openConfirm({
      title: "Reset Demo Roster?",
      bodyHtml: `<p>This resets the sample teams back to the starting Demo state (8 teams, 32 players, 2 sample rounds).</p>`,
      confirmLabel: "Reset Demo Data",
      onConfirm: () => {
        state.board = resetDemoData();
        state.lastDrawResult = null;
        renderAdminWorkspace();
        showAlert("Demo roster reset to its initial state.", "info");
      },
    });
  });

  // Optional API URL override
  els.apiUrlSaveBtn?.addEventListener("click", () => {
    const url = els.apiUrlInput.value.trim();
    setApiUrlOverride(url);
    applyBranding();
    lockConsole();
  });

  els.apiUrlClearBtn?.addEventListener("click", () => {
    els.apiUrlInput.value = "";
    setApiUrlOverride("");
    applyBranding();
    lockConsole();
  });

  // Confirmation modal controls
  els.confirmOkBtn.addEventListener("click", async () => {
    const fn = state.confirmAction;
    closeConfirm();
    if (fn) await fn();
  });

  els.confirmCancelBtn.addEventListener("click", closeConfirm);
  els.confirmCloseBtn.addEventListener("click", closeConfirm);
  els.confirmModal.addEventListener("click", (e) => {
    if (e.target === els.confirmModal) closeConfirm();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.confirmModal.hidden) closeConfirm();
  });
}

function init() {
  preserveRosterParam();
  cacheElements();
  applyBranding();
  bindEvents();

  els.drawDateInput.value = nowInputMinute();
  if (els.drawAutoTime) {
    els.drawDateInput.disabled = els.drawAutoTime.checked;
  }

  // Restore session passcode if present in this tab
  let saved = "";
  try {
    saved = sessionStorage.getItem(SESSION_PASSCODE_KEY) || "";
  } catch {
    saved = "";
  }

  if (saved) {
    els.passcodeInput.value = saved;
    unlockWithPasscode(saved);
  }
}

document.addEventListener("DOMContentLoaded", init);
