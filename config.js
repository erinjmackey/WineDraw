/**
 * Mackey Wine Draw — Site Configuration
 *
 * To connect your live Google Sheet:
 *   1. Follow the quick steps in README.md to deploy apps-script/Code.gs as a Web App.
 *   2. Paste your Web App URL below inside API_URL (between the quotes).
 *   3. Commit and push — GitHub Pages updates automatically!
 *
 * When API_URL is left empty (""), the site runs in built-in Demo Mode using
 * sample teams stored in your browser so you can preview and test everything.
 */
window.WINE_DRAW_CONFIG = {
  eventName: "The Mackey Wine Draw",
  eventSubtitle: "Annual Food Bank Fundraiser",
  seasonLabel: "Holiday Vintage",
  prizeDescription: "Last name standing takes home the wine",

  // Paste your deployed Google Apps Script Web App URL here:
  // Example: "https://script.google.com/macros/s/AKfycb.../exec"
  API_URL: "https://script.google.com/macros/s/AKfycbyM7_da4_xpSXsPh-muvKZFXJutevPN13ySZg3V7matJnrgugerusbl-koiXLlvik1c/exec",

  // Optional: auto-refresh the public board every N seconds (0 to disable)
  autoRefreshSeconds: 60,

  // Demo mode passcode (only used when API_URL is empty)
  demoPasscode: "mackey",
};
