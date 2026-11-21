// ===== Mampf-Plan: Die Familien-Regeln =====
// Hier steht an EINER Stelle, wer wann was essen/wählen darf.
// Diese Datei greift nicht auf die Seite oder die Datenbank zu, deshalb kann tests.html sie prüfen.

const ALLE = ["mama", "papa", "noah", "amelie"];
const KINDER = ["noah", "amelie"];

const MAX_SNACKS_PRO_TAG = 2;
const MAX_EXTRAS_PRO_WOCHE = 2;

// Ausnahmen, die du pro Tag ankreuzen kannst (Stufe 6)
const AUSNAHMEN = {
  kein_schultag: "Kein Schultag (Ferien / Feiertag)",
  keine_mensa:   "Amelie hat keine Mensa",
  papa_zuhause:  "Papa ist mittags zu Hause",
  entfaellt:     "Tag entfällt (z. B. Urlaub)",
};

// ---------- Datum ----------

// Montag der Woche, in der das Datum liegt (um 0:00 Uhr)
function montagVon(datum) {
  const m = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate());
  const tagNr = (m.getDay() + 6) % 7; // Montag = 0 ... Sonntag = 6
  m.setDate(m.getDate() - tagNr);
  return m;
}

function plusTage(datum, tage) {
  const d = new Date(datum);
  d.setDate(d.getDate() + tage);
  return d;
}

// Datum als "2026-11-23" (so speichert es die Datenbank)
function isoDatum(datum) {
  const zwei = n => String(n).padStart(2, "0");
  return `${datum.getFullYear()}-${zwei(datum.getMonth() + 1)}-${zwei(datum.getDate())}`;
}

// "2026-11-23" → Datum (0:00 Uhr Ortszeit)
function ausIsoDatum(text) {
  const [j, m, t] = text.split("-").map(Number);
  return new Date(j, m - 1, t);
}

function kurzDatum(datum) {
  return datum.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
}

// Die Frist: Wochentag (0 = Montag ... 6 = Sonntag) in der Woche VOR der geplanten Woche + Uhrzeit.
// Die echte Einstellung kommt aus der Datenbank (Tabelle "einstellungen") und wird beim Start geladen.
const STANDARD_FRIST = { tag: 5, stunde: 14, minute: 0 }; // Samstag 14:00
let FRIST_EINSTELLUNG = { ...STANDARD_FRIST };

// Geplant wird immer die NÄCHSTE Woche. Wählen geht bis zur Frist in dieser Woche.
function planungsWoche(nun, frist = FRIST_EINSTELLUNG) {
  const dieserMontag = montagVon(nun);
  const start = plusTage(dieserMontag, 7);
  const fristDatum = plusTage(dieserMontag, frist.tag);
  fristDatum.setHours(frist.stunde, frist.minute, 0, 0);
  return { start, frist: fristDatum, offen: nun < fristDatum };
}

// "14:00"
function uhrzeitText(datum) {
  return `${String(datum.getHours()).padStart(2, "0")}:${String(datum.getMinutes()).padStart(2, "0")}`;
}

// Text wie "2 Tage und 5 Stunden" bzw. "3 Stunden und 12 Minuten"
function restzeitText(ms) {
  const minutenGesamt = Math.floor(ms / 60000);
  const tage = Math.floor(minutenGesamt / (60 * 24));
  const stunden = Math.floor((minutenGesamt % (60 * 24)) / 60);
  const minuten = minutenGesamt % 60;
  const einheit = (zahl, eins, viele) => `${zahl} ${zahl === 1 ? eins : viele}`;
  if (tage > 0) return `${einheit(tage, "Tag", "Tage")} und ${einheit(stunden, "Stunde", "Stunden")}`;
  if (stunden > 0) return `${einheit(stunden, "Stunde", "Stunden")} und ${einheit(minuten, "Minute", "Minuten")}`;
  return einheit(Math.max(minuten, 1), "Minute", "Minuten");
}

// ---------- Wer isst wann was? ----------
// tagNr: 0 = Montag ... 6 = Sonntag
// ausnahmen: z. B. { kein_schultag: true, papa_zuhause: true }
//
// Ergebnis: Liste der Mahlzeiten des Tages. Jede Mahlzeit hat:
//   mahlzeit:  "fruehstueck" | "snack" | "mittag" | "abend" | "abend_extra"
//   modus:     "fest"   = steht fest, nichts zu wählen
//              "wahl"   = jede Person wählt selbst
//              "wunsch" = jede Person wünscht, die Küchenchefin entscheidet
//              "extra"  = freiwilliges Abend-Extra (max. 2 pro Woche)
//   kategorie: aus welcher Speisen-Liste gewählt wird
//   max:       wie viele Speisen eine Person hier höchstens wählen darf
//   personen:  wer dabei ist
function tagesRegeln(tagNr, ausnahmen) {
  const a = ausnahmen || {};
  if (a.entfaellt) return { tagNr, entfaellt: true, mahlzeiten: [] };

  const werktag = tagNr <= 4;
  const schultag = werktag && !a.kein_schultag;
  const frischGekocht = tagNr === 0 || tagNr >= 5; // Mo, Sa, So
  const mahlzeiten = [];

  // Frühstück
  if (tagNr === 5) {
    mahlzeiten.push({ mahlzeit: "fruehstueck", modus: "fest", fest: "Brötchen", personen: [...ALLE] });
  } else if (tagNr === 6) {
    mahlzeiten.push({ mahlzeit: "fruehstueck", modus: "fest", fest: "Müsli", personen: [...ALLE] });
  } else {
    mahlzeiten.push({ mahlzeit: "fruehstueck", modus: "wahl", kategorie: "fruehstueck", max: 1, personen: [...KINDER] });
  }

  // Pausensnack: nur an Schultagen, nur Kinder, bis zu zwei Sachen
  if (schultag) {
    mahlzeiten.push({ mahlzeit: "snack", modus: "wahl", kategorie: "snack", max: MAX_SNACKS_PRO_TAG, personen: [...KINDER] });
  }

  // Mittagessen
  let mittag = [...ALLE];
  if (werktag && !a.papa_zuhause) mittag = mittag.filter(p => p !== "papa");   // Papa isst Mo–Fr auf der Arbeit
  if (!frischGekocht) mittag = mittag.filter(p => p !== "mama");                // Di–Fr ohne Mama
  if ((tagNr === 2 || tagNr === 3) && schultag && !a.keine_mensa) {
    mittag = mittag.filter(p => p !== "amelie");                                  // Mi + Do Mensa
  }
  mahlzeiten.push({
    mahlzeit: "mittag",
    modus: frischGekocht ? "wunsch" : "wahl",
    kategorie: frischGekocht ? "mittag_frisch" : "mittag_mealprep",
    max: 1,
    personen: mittag,
  });

  // Abendessen: immer Brotzeit, Kinder dürfen ein Extra dazuwünschen
  mahlzeiten.push({ mahlzeit: "abend", modus: "fest", fest: "Brotzeit", personen: [...ALLE] });
  mahlzeiten.push({ mahlzeit: "abend_extra", modus: "extra", kategorie: "abend_extra", max: 1, personen: [...KINDER] });

  return { tagNr, entfaellt: false, schultag, frischGekocht, mahlzeiten };
}

// Eine bestimmte Mahlzeit eines Tages heraussuchen (oder null)
function findeMahlzeit(regeln, mahlzeit) {
  return regeln.mahlzeiten.find(m => m.mahlzeit === mahlzeit) || null;
}

// ---------- Speisen und Auswahl ----------

// Welche Speisen werden in der Auswahl angezeigt?
function waehlbareSpeisen(speisen, kategorie) {
  return speisen.filter(s =>
    s.kategorie === kategorie &&
    !s.geloescht &&
    !s.nicht_moeglich &&
    (s.portionen === null || s.portionen === undefined || s.portionen > 0));
}

// auswahl = Liste der Einträge einer Woche: { tag, mahlzeit, person, speise_id, art }

function eintraegeVon(auswahl, person, tagNr, mahlzeit) {
  return auswahl.filter(e => e.person === person && e.tag === tagNr && e.mahlzeit === mahlzeit);
}

function extrasGenutzt(auswahl, person) {
  return auswahl.filter(e => e.person === person && e.mahlzeit === "abend_extra").length;
}

// Darf die Person hier noch eine (weitere) Speise auswählen?
function kannNochWaehlen(auswahl, person, regeln, mahlzeit) {
  const m = findeMahlzeit(regeln, mahlzeit);
  if (!m || m.modus === "fest" || !m.personen.includes(person)) return false;
  if (eintraegeVon(auswahl, person, regeln.tagNr, mahlzeit).length >= m.max) return false;
  if (mahlzeit === "abend_extra" && extrasGenutzt(auswahl, person) >= MAX_EXTRAS_PRO_WOCHE) return false;
  return true;
}
