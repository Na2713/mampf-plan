// Cartoon-Gemüse als SVG-Bilder.
// Jede Funktion gibt den Bild-Code als Text zurück, den app.js in die Seite einsetzt.

const UMRISS = "#3a2e2a"; // dunkelbraune Umrisslinie wie in einem Comic

// Ein freundliches Gesicht (Augen, Bäckchen, Lächeln) an der Stelle x/y
function gesicht(x, y) {
  return `
    <circle cx="${x - 8}" cy="${y}" r="4" fill="${UMRISS}"/>
    <circle cx="${x + 8}" cy="${y}" r="4" fill="${UMRISS}"/>
    <circle cx="${x - 6.6}" cy="${y - 1.5}" r="1.3" fill="#fff"/>
    <circle cx="${x + 9.4}" cy="${y - 1.5}" r="1.3" fill="#fff"/>
    <ellipse cx="${x - 14}" cy="${y + 7}" rx="4" ry="2.6" fill="#ff8fa3" opacity="0.75"/>
    <ellipse cx="${x + 14}" cy="${y + 7}" rx="4" ry="2.6" fill="#ff8fa3" opacity="0.75"/>
    <path d="M${x - 6} ${y + 7} Q${x} ${y + 14} ${x + 6} ${y + 7}" fill="none"
          stroke="${UMRISS}" stroke-width="3" stroke-linecap="round"/>`;
}

function svg(inhalt) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inhalt}</svg>`;
}

const FIGUREN = {
  karotte: () => svg(`
    <g fill="#5cb85c" stroke="${UMRISS}" stroke-width="3" stroke-linejoin="round">
      <path d="M48 30 C38 14 27 10 24 16 C31 20 38 26 44 32 Z"/>
      <path d="M50 30 C49 10 55 3 60 7 C59 15 55 23 53 31 Z"/>
      <path d="M53 32 C64 17 76 15 77 21 C69 23 62 29 56 34 Z"/>
    </g>
    <path d="M28 36 Q50 24 72 36 Q68 70 50 95 Q32 70 28 36 Z"
          fill="#ff8c2b" stroke="${UMRISS}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M36 66 h7 M58 74 h6 M45 84 h5" stroke="#c9600f" stroke-width="2.5" stroke-linecap="round"/>
    ${gesicht(50, 47)}`),

  brokkoli: () => svg(`
    <path d="M41 58 L59 58 L58 91 Q50 96 42 91 Z"
          fill="#a6d96a" stroke="${UMRISS}" stroke-width="3" stroke-linejoin="round"/>
    <g fill="#4caf50" stroke="${UMRISS}" stroke-width="3">
      <circle cx="31" cy="45" r="16"/>
      <circle cx="69" cy="45" r="16"/>
      <circle cx="50" cy="31" r="19"/>
      <circle cx="50" cy="52" r="18"/>
    </g>
    <circle cx="38" cy="30" r="3" fill="#7cd67f"/>
    <circle cx="66" cy="38" r="3" fill="#7cd67f"/>
    ${gesicht(50, 48)}`),

  tomate: () => svg(`
    <circle cx="50" cy="58" r="34" fill="#ff5a4f" stroke="${UMRISS}" stroke-width="3"/>
    <ellipse cx="36" cy="44" rx="7" ry="4" fill="#fff" opacity="0.45" transform="rotate(-30 36 44)"/>
    <path d="M50 30 L41 22 L46 30 L34 30 L46 34 L42 42 L50 35 L58 42 L54 34 L66 30 L54 30 L59 22 Z"
          fill="#5cb85c" stroke="${UMRISS}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M50 26 Q51 18 55 15" fill="none" stroke="${UMRISS}" stroke-width="3" stroke-linecap="round"/>
    ${gesicht(50, 61)}`),

  aubergine: () => svg(`
    <path d="M50 24 C74 24 80 56 74 74 C68 92 32 94 26 74 C20 56 26 24 50 24 Z"
          fill="#8e5bd6" stroke="${UMRISS}" stroke-width="3"/>
    <ellipse cx="37" cy="46" rx="5" ry="9" fill="#fff" opacity="0.35"/>
    <path d="M32 30 Q40 20 50 22 Q60 20 68 30 Q60 34 50 30 Q40 34 32 30 Z"
          fill="#5cb85c" stroke="${UMRISS}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M50 22 Q50 12 56 8" fill="none" stroke="${UMRISS}" stroke-width="3.5" stroke-linecap="round"/>
    ${gesicht(50, 58)}`),

  kochtopf: () => svg(`
    <path d="M38 20 Q34 14 38 8 M50 18 Q46 12 50 6 M62 20 Q58 14 62 8"
          fill="none" stroke="#b9b1a8" stroke-width="3" stroke-linecap="round"/>
    <path d="M14 46 h10 M76 46 h10" stroke="${UMRISS}" stroke-width="6" stroke-linecap="round"/>
    <path d="M22 40 h56 v36 q0 14 -14 14 h-28 q-14 0 -14 -14 Z"
          fill="#ffd23f" stroke="${UMRISS}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M18 40 h64" stroke="${UMRISS}" stroke-width="5" stroke-linecap="round"/>
    <path d="M20 32 Q50 18 80 32 Z" fill="#ff8c2b" stroke="${UMRISS}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="22" r="4" fill="${UMRISS}"/>
    ${gesicht(50, 60)}`),
};
