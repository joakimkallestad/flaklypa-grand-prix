// Globale konstanter for spillet (verdenskoordinater i piksler, tid i sekunder).
const CONFIG = {
  // Intern renderoppløsning (skaleres opp med nearest-neighbor i CSS).
  VIEW_W: 480,
  VIEW_H: 270,

  // Løp
  LAPS: 3,
  NUM_AI: 3,

  // Bane
  TRACK_HALF_WIDTH: 58,   // halve banebredden i px
  WAYPOINT_SPACING: 14,   // tetthet på interpolert senterlinje

  // Fysikk (arcade)
  DRAG: 0.96,             // generell fartstap pr. steg-faktor
  OFFTRACK_DRAG: 0.86,    // ekstra fartstap utenfor banen
  OFFTRACK_MAXSPEED: 0.45,// andel av toppfart utenfor banen
  REVERSE_FACTOR: 0.4,    // ryggefart som andel av toppfart
  BOOST_FACTOR: 1.6,      // toppfart-multiplikator under boost
  BOOST_TIME: 1.8,        // sekunder
  WALL_BOUNCE: 0.35,      // hvor mye fart beholdes ved vegg-treff

  // Power-ups
  OIL_TIME: 9,            // levetid oljesøl (s)
  SMOKE_TIME: 6,          // levetid røyksky (s)
  OIL_SLIP_TIME: 1.4,     // hvor lenge en bil sklir etter olje
  SMOKE_RADIUS: 36,
  OIL_RADIUS: 22,
  ITEM_RESPAWN: 6,        // sekunder før pickup-boks kommer tilbake

  // Farger (pixel-palett)
  COL_GRASS: "#3f7d3a",
  COL_GRASS2: "#357032",
  COL_DIRT: "#9a7b4f",
};
