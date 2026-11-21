// ===== Verbindung zur Supabase-Datenbank =====
// Alle Lese- und Schreibzugriffe laufen über diese Datei.

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Alle (nicht gelöschten) Speisen holen. Mit mitGeloeschten = true auch die gelöschten
// (wichtig, damit alte Wahlen noch ihren Namen zeigen).
async function ladeSpeisen(mitGeloeschten = false) {
  let abfrage = db.from("speisen").select("*").order("name");
  if (!mitGeloeschten) abfrage = abfrage.eq("geloescht", false);
  const { data, error } = await abfrage;
  if (error) throw error;
  return data;
}

// Alle Wahlen, Wünsche und Festlegungen einer Woche. woche = "2026-11-30"
async function ladeAuswahl(woche) {
  const { data, error } = await db.from("auswahl").select("*").eq("woche", woche).order("id");
  if (error) throw error;
  return data;
}

// Eine Wahl oder einen Wunsch speichern
async function auswahlHinzufuegen(eintrag) {
  const { data, error } = await db.from("auswahl").insert(eintrag).select().single();
  if (error) throw error;
  return data;
}

// Eine Wahl oder einen Wunsch entfernen
async function auswahlEntfernen(id) {
  const { data, error } = await db.from("auswahl").delete().eq("id", id).select();
  if (error) throw error;
  if (data.length === 0) throw new Error("Das kann nicht mehr geändert werden.");
}

// Datenbank-Fehlermeldungen in verständliches Deutsch übersetzen
function freundlicherFehler(err) {
  const text = String(err && err.message);
  if (text.includes("Portion") || text.includes("portionen_check")) return "Ui, davon ist leider keine Portion mehr übrig! 😕";
  if (text.includes("row-level security") || text.includes("nicht mehr geändert")) {
    return "Die Zeit zum Aussuchen ist leider abgelaufen ⏰";
  }
  return "Das hat leider nicht geklappt 😟 (" + text + ")";
}

// Eine Woche (Ausnahmen, abgeschlossen?) holen. start = "2026-11-23". Gibt null zurück, wenn noch nichts gespeichert ist.
async function ladeWoche(start) {
  const { data, error } = await db.from("wochen").select("*").eq("start", start).maybeSingle();
  if (error) throw error;
  return data;
}

// Die eingestellte Frist, z. B. { tag: 5, stunde: 14, minute: 0 } (oder null)
async function ladeFrist() {
  const { data, error } = await db.from("einstellungen").select("wert").eq("schluessel", "frist").maybeSingle();
  if (error) throw error;
  return data ? data.wert : null;
}

// ---------- Admin (alles mit PIN) ----------

// Etwas festlegen: für eine Person (fehlende Wahl) oder für "alle" (Entscheidung bei Wünschen)
async function adminFestlegen(woche, tag, mahlzeit, person, speiseId) {
  const { data, error } = await db.rpc("admin_auswahl_setzen", {
    pin: adminPin(), p_woche: woche, p_tag: tag, p_mahlzeit: mahlzeit,
    p_person: person, p_speise_id: speiseId, p_art: "festgelegt",
  });
  if (error) throw error;
  return data;
}

// Irgendeinen Eintrag entfernen (auch nach der Frist)
async function adminEintragLoeschen(id) {
  const { error } = await db.rpc("admin_auswahl_loeschen", { pin: adminPin(), p_id: id });
  if (error) throw error;
}

// Ausnahmen und "abgeschlossen" einer Woche speichern
async function wocheSpeichern(start, ausnahmen, abgeschlossen) {
  const { error } = await db.rpc("admin_woche_speichern", {
    pin: adminPin(), p_start: start, p_ausnahmen: ausnahmen, p_abgeschlossen: abgeschlossen,
  });
  if (error) throw error;
}

async function fristSpeichern(frist) {
  const { error } = await db.rpc("admin_frist_speichern", {
    pin: adminPin(), p_tag: frist.tag, p_stunde: frist.stunde, p_minute: frist.minute,
  });
  if (error) throw error;
}

function adminPin() {
  return sessionStorage.getItem("adminPin");
}

// Speise anlegen (ohne id) oder ändern (mit id). Nur die Felder in "daten" werden geändert.
async function speiseSpeichern(daten) {
  const { data, error } = await db.rpc("admin_speise_speichern", { pin: adminPin(), daten });
  if (error) throw error;
  return data;
}

// Fragt die Datenbank, ob die PIN stimmt. Die PIN selbst steht NICHT im App-Code.
async function pinPruefen(pin) {
  const { data, error } = await db.rpc("admin_pin_ok", { pin });
  if (error) throw error;
  return data === true;
}
