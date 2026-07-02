// Bil-specs. Fart i px/s, akselerasjon i px/s², turnRate i rad/s.
// grip = 0..1 (høyere = mindre sideglidning / bedre veigrep).
const CAR_SPECS = [
  {
    id: "balansert",
    name: "Tøffe-Tøffe",
    topSpeed: 250,
    accel: 360,
    turnRate: 3.0,
    grip: 0.82,
    shape: "balansert",
    colors: { body: "#2e7de0", light: "#5fa0f0", dark: "#1b4d92", stripe: "#dfeaff", helmet: "#ffd23f" },
    desc: "Balansert",
  },
  {
    id: "racer",
    name: "Il Tempo",
    topSpeed: 300,
    accel: 330,
    turnRate: 2.6,
    grip: 0.66,
    shape: "racer",
    colors: { body: "#c1272d", light: "#e64a4f", dark: "#7d1418", stripe: "#1a1a1a", helmet: "#e8e8e8" },
    desc: "Råeste toppfart, løsere i svingene",
  },
  {
    id: "rally",
    name: "Doffen",
    topSpeed: 225,
    accel: 430,
    turnRate: 3.4,
    grip: 0.92,
    shape: "rally",
    colors: { body: "#e0a020", light: "#f4c44a", dark: "#9c6b10", stripe: "#3a2a08", helmet: "#2e7de0" },
    desc: "Klistrer i svingene, kvikk start",
  },
];

function getSpec(id) { return CAR_SPECS.find((s) => s.id === id) || CAR_SPECS[0]; }

// Distinkte farger/lakk for AI-bilene (Flåklypa-inspirert rollebesetning).
const AI_LIVERIES = [
  { name: "Solan", body: "#2fae5e", light: "#5fd488", dark: "#1c7a40", stripe: "#ffffff", helmet: "#e0a020" },
  { name: "Ludvig", body: "#7b4fb0", light: "#a47fd0", dark: "#4f2f78", stripe: "#ffe066", helmet: "#fff" },
  { name: "Frimand", body: "#e06a1f", light: "#f7944a", dark: "#9c440f", stripe: "#222", helmet: "#2e7de0" },
  { name: "Mysil", body: "#19b3c4", light: "#5fd8e6", dark: "#0f7682", stripe: "#fff", helmet: "#e03c5a" },
  { name: "Frÿk", body: "#c4324f", light: "#e8627d", dark: "#841f34", stripe: "#fff", helmet: "#222" },
];
