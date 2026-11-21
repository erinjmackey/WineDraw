# The Mackey Christmas Wine Draw

A team-based Christmas wine draw elimination board powered by a Google Sheet backend (Google Apps Script) and a static frontend hosted on GitHub Pages.

- **Public Board (`index.html`)** — Live team standings, remaining/eliminated counts, search and status filters, most recent draw spotlight, full draw history, and winner banner.
- **Projector Board (`projector.html`)** — Full-screen 16:9 display showing all teams on one screen with auto-refresh and an Active Only filter.
- **Drawmaster Console (`admin.html`)** — Passcode-protected admin page to draw random names with automatic timestamps, copy or print the round's eliminated list, and undo the most recent draw round.
- **Built-in Demo Mode** — Works out of the box with sample teams stored in `localStorage` whenever `API_URL` in `config.js` is blank.

---

## 1. Google Sheet Setup

Use a single tab (the first tab in your spreadsheet) with row 1 as headers and players starting in row 2:

| Column | Header | Notes |
| --- | --- | --- |
| **A** | `Ticket Number` | Ticket or entry number |
| **B** | `Player Name` | Player's display name |
| **C** | `Team` | Team name |
| **D** | `Eliminated Date` | Leave blank while still in; filled with a timestamp (`yyyy-mm-dd HH:mm:ss` or `yyyy-mm-dd`) when drawn |

Names are never deleted or moved to another tab. Each distinct timestamp counts as one round (`Round 1`, `Round 2`, ...), so nightly draws and 30-minute party-day draws stay separated.

---

## 2. Apps Script Setup & Deployment

1. Open your Google Sheet and go to **Extensions → Apps Script**.
2. Replace the default editor contents with [`apps-script/Code.gs`](apps-script/Code.gs) and save.
   - *(Optional)* If your players are not on the first tab, set `SHEET_TAB` at the top of `Code.gs`.
   - *(Optional)* Run `setupSheet` once from the editor if starting from a blank sheet to add headers and freeze row 1.
3. Set the admin passcode:
   - Open **Project Settings** (gear icon) → **Script Properties** → **Add script property**.
   - Property: `ADMIN_PASSCODE`
   - Value: your chosen drawmaster passcode.
4. Deploy as a Web App:
   - Click **Deploy → New deployment**.
   - Select type **Web app**.
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
   - Click **Deploy**, authorize when prompted, and copy the **Web app URL** (ends in `/exec`).

> **Note:** Whenever you edit `Code.gs` later, deploy a **New version** under **Deploy → Manage deployments** so the `/exec` URL serves the updated code.

---

## 3. Connect the Site (`config.js`)

Open [`config.js`](config.js) and paste your Web App URL into `API_URL`:

```js
API_URL: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
```

Commit and push to GitHub, then enable **GitHub Pages** (Settings → Pages → Deploy from `main` branch, root `/`).

*(To test without editing `config.js`, open `admin.html` in Demo Mode and use **Test an Apps Script Web App URL in this browser**.)*

---

## 4. Local Preview (Demo Mode)

Serve the folder with any static server, for example:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Then open:
- Public board: `http://127.0.0.1:8765/index.html`
- Admin console: `http://127.0.0.1:8765/admin.html` (demo passcode: `mackey`)

---

## 5. Tests

Requires Node.js (tested on Node 24) and Chrome for the end-to-end demo check:

```sh
node tests/apps-script.test.js
node tests/api.test.js
node tests/e2e-demo.js
```
