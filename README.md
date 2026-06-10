# Flåklypa Grand Prix

En pikselgrafikk-hyllest til det klassiske *Flåklypa Grand Prix*-bilspillet — top-down racing der du kjører mot AI-biler på en svingete bane, plukker opp gjenstander og kjemper om førsteplassen.

Bygget i ren **HTML5 Canvas + vanilla JavaScript** — ingen rammeverk, ingen byggetrinn. Bare åpne `index.html` i en nettleser.

![Flåklypa Grand Prix](docs/screenshot.png)

## Spille

Åpne `index.html` direkte i nettleseren (dobbeltklikk eller dra den inn i et nytt faneblad). Ingen server nødvendig.

### Kontroller

| Tast | Handling |
|------|----------|
| ↑ / W | Gass |
| ↓ / S | Brems / rygg |
| ← → / A D | Styr |
| Mellomrom | Bruk gjenstand |
| Esc | Pause |
| Enter | Start / kjør igjen |

## Funksjoner

- **Top-down pikselgrafikk** — lav intern oppløsning (480×270) skalert opp med nearest-neighbor for skarp pixel art. All grafikk er prosedyre-generert (ingen bildefiler).
- **3 valgbare biler** med ulik toppfart, veigrep og akselerasjon.
- **AI-motstandere** som følger banen, tar svinger og bruker gjenstander.
- **Power-ups:**
  - ⚡ **Fartsboost** — midlertidig høyere toppfart.
  - 🛢️ **Oljesøl** — legges igjen bak deg; biler som treffer det mister grepet og sklir.
  - 💨 **Røyksky** — skjuler sikten og bremser bilene som kjører inn i den.
- **Arcade-fysikk** med veigrep og sleng — du mister grep på gress og olje.
- **Rundetelling** (3 runder), plassering, minimap og HUD.

## Teknisk

Spillet lastes som klassiske skript i `index.html` (fungerer fra `file://`):

| Fil | Ansvar |
|-----|--------|
| `js/config.js` | Konstanter (fysikk-tuning, banebredde, farger) |
| `js/assets.js` | Prosedyre-genererte piksel-sprites (biler, dekor) |
| `js/specs.js` | Bil-specs |
| `js/track.js` | Bane (Catmull-Rom-senterlinje), off-track, rundetelling, for-rendret verdenskart |
| `js/car.js` | Arcade top-down-bilfysikk (spiller + AI) |
| `js/ai.js` | AI-styring (waypoint-følging, hindringsunngåelse) |
| `js/powerups.js` | Pickup-bokser, oljesøl, røyksky, boost |
| `js/input.js` | Tastatur |
| `js/render.js` | All tegning + HUD + minimap |
| `js/main.js` | Spilløkke + tilstandsmaskin (meny → løp → mål) |

## Lisens

MIT
