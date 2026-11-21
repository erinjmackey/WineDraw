/**
 * The Mackey Christmas Wine Draw - Google Apps Script API
 *
 * Sheet layout (first tab; row 1 = headers, players from row 2 down):
 *   A  Ticket Number
 *   B  Player Name
 *   C  Team
 *   D  Eliminated Date   (blank = still in; date or timestamp = eliminated in that round)
 *
 * Names are never deleted or moved. A draw writes a timestamp (yyyy-MM-dd HH:mm[:ss])
 * into column D for the chosen players. Each distinct timestamp is one round
 * ("Round 1", "Round 2", ...), so multiple draws on party day stay separate.
 * Undo clears column D for every name marked with the most recent timestamp.
 *
 * Set the admin passcode under Project Settings > Script Properties > ADMIN_PASSCODE.
 */

const SHEET_ID = '';   // Leave blank when this script is attached to the Sheet (Extensions > Apps Script).
const SHEET_TAB = '';  // Leave blank to use the first tab.
const WINNERS_TAB = 'PreviousWinners';
const COL_TICKET = 1;
const COL_NAME = 2;
const COL_TEAM = 3;
const COL_ELIMINATED = 4;
const HEADERS = ['Ticket Number', 'Player Name', 'Team', 'Eliminated Date'];
const DATE_ONLY_RE = /^(\d{4}-\d{2}-\d{2})$/;
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/;

/* ==========================================================================
   Web App entry points
   ========================================================================== */

// Public read: full board data + previous winners for index.html
function doGet(e) {
  try {
    return json_({
      ok: true,
      players: publicPlayers_(readPlayers_()),
      previousWinners: readPreviousWinners_(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json_({ ok: false, error: errorMessage_(err) });
  }
}

// Admin writes: verify | draw | undo (all require the passcode)
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const passcode = String(body.passcode || '');

    switch (body.action) {
      case 'verify':
        requirePasscode_(passcode);
        return json_({ ok: true });
      case 'draw':
        return json_(drawNames_(passcode, Number(body.count), String(body.date || '')));
      case 'undo':
        return json_(undoLastDraw_(passcode));
      default:
        return json_({ ok: false, error: 'Unknown action.' });
    }
  } catch (err) {
    return json_({ ok: false, error: errorMessage_(err) });
  }
}

/* ==========================================================================
   Draw / Undo
   ========================================================================== */

function drawNames_(passcode, count, dateInput) {
  requirePasscode_(passcode);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Please enter a whole number of at least 1.');
  }
  const stamp = normalizeTimestamp_(dateInput) || nowTimestamp_();
  const numFormat = stampFormat_(stamp);

  return withLock_(function () {
    const before = readPlayers_();
    const active = before.filter(isActive_);

    if (active.length <= 1) {
      throw new Error('The draw is already complete. Only one player remains.');
    }
    if (count > active.length - 1) {
      throw new Error('You can draw at most ' + (active.length - 1) + ' names so that one winner remains.');
    }

    const chosen = shuffle_(active).slice(0, count);
    const sheet = getSheet_();
    chosen.forEach(function (p) {
      sheet.getRange(p.row, COL_ELIMINATED).setNumberFormat(numFormat).setValue(stamp);
    });
    SpreadsheetApp.flush();

    const after = readPlayers_();
    const outBefore = teamsOut_(before);
    const newlyEliminatedTeams = teamsOut_(after).filter(function (t) {
      return outBefore.indexOf(t) === -1;
    });

    return {
      ok: true,
      round: roundNumberFor_(after, stamp),
      label: stamp,
      eliminatedAt: stamp,
      eliminated: chosen.map(function (p) { return { name: p.name, team: p.team }; }),
      newlyEliminatedTeams: newlyEliminatedTeams,
      players: publicPlayers_(after),
      updatedAt: new Date().toISOString(),
    };
  });
}

function undoLastDraw_(passcode) {
  requirePasscode_(passcode);

  return withLock_(function () {
    const players = readPlayers_();
    const dates = roundDates_(players);
    if (dates.length === 0) {
      throw new Error('There are no completed draws to undo.');
    }

    const latest = dates[dates.length - 1];
    const toRestore = players.filter(function (p) { return p.eliminatedDate === latest; });

    const sheet = getSheet_();
    toRestore.forEach(function (p) {
      sheet.getRange(p.row, COL_ELIMINATED).setValue('');
    });
    SpreadsheetApp.flush();

    return {
      ok: true,
      undoneRound: dates.length,
      undoneDate: latest,
      restored: toRestore.map(function (p) { return { name: p.name, team: p.team }; }),
      players: publicPlayers_(readPlayers_()),
      updatedAt: new Date().toISOString(),
    };
  });
}

/* ==========================================================================
   Reading the sheet
   ========================================================================== */

// One entry per named row, in sheet order. row = sheet row number (used for writes).
function readPlayers_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, COL_ELIMINATED).getValues();
  const players = [];
  values.forEach(function (v, i) {
    const name = text_(v[COL_NAME - 1]);
    if (!name) return;
    players.push({
      row: i + 2,
      ticket: text_(v[COL_TICKET - 1]),
      name: name,
      team: text_(v[COL_TEAM - 1]) || 'Unassigned',
      eliminatedDate: dateText_(v[COL_ELIMINATED - 1]),
    });
  });
  return players;
}

// What the browser sees. No row numbers.
function publicPlayers_(players) {
  return players.map(function (p) {
    return {
      ticket: p.ticket,
      name: p.name,
      team: p.team,
      eliminatedDate: p.eliminatedDate,
    };
  });
}

function isActive_(p) {
  return !p.eliminatedDate;
}

// Teams with nobody left in them.
function teamsOut_(players) {
  const status = Object.create(null);
  players.forEach(function (p) {
    if (!(p.team in status)) status[p.team] = true; // assume out until someone is still in
    if (isActive_(p)) status[p.team] = false;
  });
  return Object.keys(status).filter(function (t) { return status[t]; });
}

// Distinct elimination dates, oldest first. Index + 1 = round number.
function roundDates_(players) {
  const seen = Object.create(null);
  players.forEach(function (p) {
    if (p.eliminatedDate) seen[p.eliminatedDate] = true;
  });
  return Object.keys(seen).sort();
}

function roundNumberFor_(players, date) {
  return roundDates_(players).indexOf(date) + 1;
}

// Reads the optional 'PreviousWinners' tab (Year, Winner/Name, Team, Notes).
function readPreviousWinners_() {
  const sheet = getSpreadsheet_().getSheetByName(WINNERS_TAB);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const rows = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = rows[0].map(function (h) { return text_(h).toLowerCase(); });
  const findCol = function (names, fallback) {
    for (let i = 0; i < headers.length; i++) {
      if (names.indexOf(headers[i]) !== -1) return i;
    }
    return fallback < headers.length ? fallback : -1;
  };

  const colYear = findCol(['year', 'draw year'], 0);
  const colWinner = findCol(['winner', 'player name', 'name', 'player'], 1);
  const colTeam = findCol(['team', 'team name'], 2);
  const colNotes = findCol(['notes', 'prize', 'bottles', 'details'], 3);

  const list = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const winner = colWinner >= 0 ? text_(row[colWinner]) : '';
    const year = colYear >= 0 ? text_(row[colYear]) : '';
    if (!winner && !year) continue;
    list.push({
      year: year,
      winner: winner,
      team: colTeam >= 0 ? text_(row[colTeam]) : '',
      notes: colNotes >= 0 ? text_(row[colNotes]) : '',
    });
  }
  return list.sort(function (a, b) {
    return String(b.year).localeCompare(String(a.year), undefined, { numeric: true });
  });
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function requirePasscode_(passcode) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSCODE');
  if (!expected) {
    throw new Error('ADMIN_PASSCODE is not set. Add it under Project Settings > Script Properties.');
  }
  if (passcode !== expected) {
    throw new Error('Incorrect passcode.');
  }
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Another draw is in progress. Wait a moment and try again.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_() {
  const ss = getSpreadsheet_();
  const sheet = SHEET_TAB ? ss.getSheetByName(SHEET_TAB) : ss.getSheets()[0];
  if (!sheet) {
    throw new Error('Could not find the players tab. Check SHEET_TAB at the top of Code.gs.');
  }
  return sheet;
}

function tz_() {
  return getSpreadsheet_().getSpreadsheetTimeZone();
}

function nowTimestamp_() {
  return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm:ss');
}

// Accepts blank (use current timestamp), yyyy-mm-dd, or yyyy-mm-dd[T ]HH:mm[:ss].
function normalizeTimestamp_(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (DATE_ONLY_RE.test(s)) return s;
  const m = DATETIME_RE.exec(s);
  if (m) {
    return m[3] ? (m[1] + ' ' + m[2] + ':' + m[3]) : (m[1] + ' ' + m[2]);
  }
  throw new Error('Timestamp must look like 2026-11-28 19:30 or 2026-11-28.');
}

function stampFormat_(stamp) {
  if (stamp.length === 10) return 'yyyy-mm-dd';
  if (stamp.length === 16) return 'yyyy-mm-dd hh:mm';
  return 'yyyy-mm-dd hh:mm:ss';
}

function shuffle_(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function text_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

// Sheets turns date/time strings into Date objects, so convert back cleanly.
function dateText_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    const full = Utilities.formatDate(v, tz_(), 'yyyy-MM-dd HH:mm:ss');
    if (full.slice(11) === '00:00:00') return full.slice(0, 10);
    if (full.slice(17) === '00') return full.slice(0, 16);
    return full;
  }
  const s = String(v).trim();
  const m = DATETIME_RE.exec(s);
  if (m) {
    return m[3] ? (m[1] + ' ' + m[2] + ':' + m[3]) : (m[1] + ' ' + m[2]);
  }
  return s;
}

function errorMessage_(err) {
  return String((err && err.message) || err);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/* ==========================================================================
   One-time setup: run once from the Apps Script editor
   ========================================================================== */

function setupSheet() {
  const sheet = getSheet_();
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  }
  sheet.setFrozenRows(1);
}
