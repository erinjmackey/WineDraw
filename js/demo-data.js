/**
 * Built-in Demo Dataset for The Mackey Christmas Wine Draw.
 * Mirrors the Sheet layout: ticket, name, team, eliminated date ("" = still in).
 * 8 teams, 32 players, two past draw days (two days ago and yesterday),
 * including one fully eliminated team.
 */

function pad(n) {
  return String(n).padStart(2, "0");
}

function localIsoDaysAgo(days, time = "") {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return time ? `${datePart} ${time}` : datePart;
}

export const DEMO_PREVIOUS_WINNERS = [
  { year: "2025", winner: "Margaret Mackey", team: "Bordeaux Bells", notes: "37 bottles" },
  { year: "2024", winner: "Robert Thornton", team: "Mistletoe Merlots", notes: "34 bottles" },
  { year: "2023", winner: "Patricia Holloway", team: "The Cabernet Carolers", notes: "32 bottles" },
];

export function createInitialDemoPlayers() {
  const dateForDay = { 1: localIsoDaysAgo(2, "19:00"), 2: localIsoDaysAgo(1, "19:00") };

  const rows = [
    // Bordeaux Bells: all 4 in
    { team: "Bordeaux Bells", name: "Margaret Mackey" },
    { team: "Bordeaux Bells", name: "Arthur Pendelton" },
    { team: "Bordeaux Bells", name: "Evelyn Brooks" },
    { team: "Bordeaux Bells", name: "Graham Whitaker" },

    // The Cabernet Carolers: 3 in, 1 out
    { team: "The Cabernet Carolers", name: "Patricia Holloway" },
    { team: "The Cabernet Carolers", name: "Richard Caldwell", out: 1 },
    { team: "The Cabernet Carolers", name: "Barbara Sinclair" },
    { team: "The Cabernet Carolers", name: "Thomas Lindholm" },

    // Mistletoe Merlots: 2 in, 2 out
    { team: "Mistletoe Merlots", name: "Susan Gallagher", out: 1 },
    { team: "Mistletoe Merlots", name: "Robert Thornton" },
    { team: "Mistletoe Merlots", name: "Carol Hendricks", out: 2 },
    { team: "Mistletoe Merlots", name: "Kenneth Marlow" },

    // Fireside Pinot: 3 in, 1 out
    { team: "Fireside Pinot", name: "Diane Mercer" },
    { team: "Fireside Pinot", name: "William Halstead" },
    { team: "Fireside Pinot", name: "Nancy Pritchard" },
    { team: "Fireside Pinot", name: "Edward Kowalski", out: 2 },

    // Snowfall Sauvignon: 2 in, 2 out
    { team: "Snowfall Sauvignon", name: "Helen MacAllister", out: 1 },
    { team: "Snowfall Sauvignon", name: "Charles Beaumont" },
    { team: "Snowfall Sauvignon", name: "Dorothy Callahan" },
    { team: "Snowfall Sauvignon", name: "George Ellison", out: 2 },

    // Holly & Shiraz: 1 in, 3 out
    { team: "Holly & Shiraz", name: "Linda Fitzpatrick", out: 1 },
    { team: "Holly & Shiraz", name: "Donald McAllister", out: 1 },
    { team: "Holly & Shiraz", name: "Sharon Alvarez" },
    { team: "Holly & Shiraz", name: "Paul Donovan", out: 2 },

    // Champagne Sleigh: 3 in, 1 out
    { team: "Champagne Sleigh", name: "Karen O'Sullivan" },
    { team: "Champagne Sleigh", name: "David Reynolds" },
    { team: "Champagne Sleigh", name: "Betty Zimmerman", out: 2 },
    { team: "Champagne Sleigh", name: "Frank Pellegrini" },

    // Cellar Noel: fully eliminated
    { team: "Cellar Noel", name: "Judith Armstrong", out: 1 },
    { team: "Cellar Noel", name: "Raymond Foster", out: 1 },
    { team: "Cellar Noel", name: "Sandra Delgado", out: 2 },
    { team: "Cellar Noel", name: "Walter Bennett", out: 2 },
  ];

  return rows.map((row, idx) => ({
    id: idx + 1,
    ticket: idx + 1,
    team: row.team,
    name: row.name,
    eliminatedDate: row.out ? dateForDay[row.out] : "",
  }));
}

/**
 * Full-scale demo dataset: 37 teams x 7 players (259 total) across 3 draw days.
 * Activated via ?roster=37 on any page.
 */
export function createLargeDemoPlayers() {
  const dateForDay = {
    1: localIsoDaysAgo(2, "19:00"),
    2: localIsoDaysAgo(1, "19:00"),
    3: localIsoDaysAgo(1, "19:30"),
  };
  const teams = [
    "Bordeaux Bells", "Cabernet Carolers", "Mistletoe Merlots", "Fireside Pinot", "Snowfall Sauvignon",
    "Holly & Shiraz", "Champagne Sleigh", "Cellar Noel", "Rioja Reindeer", "Merlot Mistletoe",
    "Syrah Santa", "Gingerbread Gamay", "Port Partridge", "Chardonnay Christmas", "Frosty Fizz",
    "Shiraz Sleigh", "Noel Nebbiolo", "Tinsel Tempranillo", "Mulled Malbec", "Eggnog Ros\u00e9",
    "Pinot Pine", "Vintage Yule", "Festive Ferment", "Gl\u00fchwein Gang", "Cork & Candle",
    "Bubbly Bells", "Wassail Wines", "Nog Nation", "Carol Cellar", "Wreath & Vine",
    "Oak Ornament", "Dram Dasher", "Stocking Stash", "Corkscrew Carolers", "Claret Claus",
    "Ruby Ribbon", "Last Cork Standing",
  ];
  const firstNames = [
    "Margaret", "Arthur", "Evelyn", "Graham", "Patricia", "Richard", "Barbara", "Thomas",
    "Susan", "Robert", "Carol", "Kenneth", "Diane", "William", "Nancy", "Edward",
    "Helen", "Charles", "Dorothy", "George", "Linda", "Donald", "Sharon", "Paul",
    "Karen", "David", "Betty", "Frank", "Judith", "Raymond", "Sandra", "Walter",
    "Gordon", "Marlene", "Christopher", "Alexandra", "Bruce",
  ];
  const lastNames = [
    "Mackey", "Pendelton", "Brooks", "Whitaker", "Holloway", "Caldwell", "Sinclair", "Lindholm",
    "Gallagher", "Thornton", "Hendricks", "Marlow", "Mercer", "Halstead", "Pritchard", "Kowalski",
    "MacAllister", "Beaumont", "Callahan", "Ellison", "Fitzpatrick", "McAllister", "Alvarez", "Donovan",
    "O'Sullivan", "Reynolds", "Zimmerman", "Pellegrini", "Armstrong", "Foster", "Delgado", "Bennett",
    "Hale", "Fenwick",
  ];

  const rows = [];
  let n = 0;
  for (let t = 0; t < teams.length; t++) {
    const team = teams[t];
    for (let p = 0; p < 7; p++) {
      n++;
      const name = `${firstNames[(n * 7) % firstNames.length]} ${lastNames[(n * 11 + t) % lastNames.length]}`;
      const bucket = (n * 13 + t * 5) % 10;
      const out = (t === 0 || t % 9 === 4 || bucket < 4) ? ((n + t) % 3) + 1 : 0;
      rows.push({
        id: n,
        ticket: n,
        team,
        name,
        eliminatedDate: out ? dateForDay[out] : "",
      });
    }
  }
  return rows;
}
