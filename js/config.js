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
  WALL_BOUNCE: 0.35,      // hvor mye fart beholdes ved vegg-/barriere-treff
  CAR_COLLIDE_R: 13,      // bilens kollisjonsradius mot barrierer

  // Barrierer / snarveier / ytre grense
  BARRIER_OFFSET: 78,     // hvor langt utenfor senter barriere-ringen ligger
  BARRIER_SPACING: 34,    // avstand mellom barriere-poster langs kanten
  BARRIER_CELL: 96,       // cellestørrelse i barriere-grid (kollisjonsoppslag)
  SHORTCUT_CURV: 0.05,    // kurvatur over dette → mulig gap (snarvei) på innersiden
  SHORTCUT_GAP_CHANCE: 0.7,// sannsynlighet for at et innerkant-gap åpnes
  BOUNDARY_OFFSET: 300,   // ytre ugjennomtrengelig ring (fjord/fjell)

  // Kamera
  CAM_LOOKAHEAD: 0.12,    // hvor langt fram kamera ser (× fart)
  CAM_LOOKAHEAD_2P: 0.16, // litt mer i smal delt-skjerm-visning
  CAM_SMOOTH: 0.001,      // lerp-basis (lavere = strammere)
  SHAKE_MAX: 4,           // maks kamera-rist (px)

  // AI / balansering
  RUBBER_GAIN: 0.15,      // hvor mye AI bak henter inn
  RUBBER_MAX: 1.10,       // maks fartsbonus for AI bak
  RUBBER_LEADER: 0.96,    // mild brems på en rømt leder

  // Power-ups
  OIL_TIME: 16,           // levetid oljesøl (s) — ligger lenge
  OIL_FADE: 4,            // siste sekunder der effekt/visuell dempes mot null
  SMOKE_TIME: 6,          // levetid røyksky (s)
  OIL_SLIP_TIME: 1.4,     // hvor lenge en bil sklir etter (fersk) olje
  SMOKE_RADIUS: 36,
  OIL_RADIUS: 22,
  ITEM_RESPAWN: 6,        // sekunder før pickup-boks kommer tilbake

  // Gress-spor (hjulspor som metter med trafikk)
  RUT_CELL: 8,            // slitasje-grid cellestørrelse
  RUT_CAP: 0.6,           // maks slitasje pr. celle (0..1) — feltet blir aldri svart
  RUT_GAIN: 0.12,         // hvor raskt en celle slites (avtagende mot CAP)
  RUT_STAMP_ALPHA: 0.05,  // alpha pr. spor-stamp på rutCanvas

  // HUD
  KMH_SCALE: 0.8,         // px/s → "km/t" på speedometeret

  // To-spiller
  P2_COLOR: "#5fd8e6",    // P2-aksent (HUD/minimap/resultat)

  // ---- Nordisk palett ----
  COL_GRASS: "#4a6b3f",   // dempet enggrønn
  COL_GRASS2: "#3f5e36",  // gress-speckle
  COL_DIRT: "#8a7a55",    // sand/skulder + slitespor
  COL_FJORD: "#3a6b86",   // fjordblå
  COL_FJORD_HI: "#5a8aa6",// vannrefleks
  COL_BIRCH_BARK: "#e8e6df", COL_BIRCH_MARK: "#2a2a28", COL_BIRCH_LEAF: "#8fae5a",
  COL_PINE: "#34604a",    // furu blågrønn
  COL_SPRUCE: "#1f4a37", COL_SPRUCE_HI: "#2a5e44", // gran dypgrønn
  COL_GRANITE: "#7c8088", COL_GRANITE_HI: "#9aa0a8", COL_GRANITE_SH: "#5c6066",
  COL_SNOW: "#eef2f5",
  COL_LOG: "#7a5a38", COL_LOG_HI: "#9c7548", COL_SOD: "#5a7a3a",
  COL_AUTUMN: "#c97a2a",  // sparsom høst-aksent
};
