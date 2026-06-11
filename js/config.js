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
  ONTRACK_DRAG: 0.993,    // rullemotstand på asfalt (pr. 1/60 s)
  OFFTRACK_DRAG: 0.86,    // ekstra fartstap utenfor banen
  OFFTRACK_MAXSPEED: 0.45,// andel av toppfart utenfor banen
  REVERSE_FACTOR: 0.4,    // ryggefart som andel av toppfart
  BOOST_FACTOR: 1.6,      // toppfart-multiplikator under boost
  BOOST_TIME: 1.8,        // sekunder
  BOOST_KICK: 120,        // engangs-impuls (px/s) når boost aktiveres
  WALL_BOUNCE: 0.35,      // hvor mye fart beholdes ved vegg-treff

  // Kamera
  CAM_LOOKAHEAD: 0.12,    // hvor langt fram kamera ser (× fart)
  CAM_SMOOTH: 0.001,      // lerp-basis (lavere = strammere)
  SHAKE_MAX: 4,           // maks kamera-rist (px)

  // AI / balansering
  RUBBER_GAIN: 0.15,      // hvor mye AI bak henter inn
  RUBBER_MAX: 1.10,       // maks fartsbonus for AI bak
  RUBBER_LEADER: 0.96,    // mild brems på en rømt leder

  // Power-ups
  OIL_TIME: 9,            // levetid oljesøl (s)
  SMOKE_TIME: 6,          // levetid røyksky (s)
  OIL_SLIP_TIME: 1.4,     // hvor lenge en bil sklir etter olje
  SMOKE_RADIUS: 36,
  OIL_RADIUS: 22,
  ITEM_RESPAWN: 6,        // sekunder før pickup-boks kommer tilbake

  // HUD
  KMH_SCALE: 0.8,         // px/s → "km/t" på speedometeret

  // Farger (pixel-palett) — dempet høst
  COL_GRASS: "#3c6b34",
  COL_GRASS2: "#335f2d",
  COL_DIRT: "#a98a55",
};
