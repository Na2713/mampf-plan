// ===== Admin-Bereich ("Küchenchefin") =====
// #admin          → Übersicht
// #admin/speisen  → Speisen verwalten

const EMOJI_VORSCHLAEGE = [
  "🍝", "🍕", "🥘", "🍲", "🍛", "🍜", "🥗", "🌮", "🍔", "🥞", "🍳", "🥣", "🥐", "🍞",
  "🥪", "🧇", "🍎", "🍌", "🍇", "🍓", "🫐", "🥕", "🥒", "🧀", "🥨", "🍪", "🥛", "🍚",
  "🍗", "🐟", "🥔", "🍅", "🌭", "🥦",
];

// ---------- Einstieg mit PIN ----------

function zeigeAdmin(unterseite) {
  if (!adminPin()) return zeigePinFormular(unterseite);
  if (unterseite === "speisen") return zeigeSpeisenVerwaltung();
  if (unterseite === "frist") return zeigeFristEinstellung();
  if (unterseite === "woche") return zeigeWocheFestlegen();
  zeigeAdminUebersicht();
}

function zeigePinFormular(unterseite) {
  inhalt.innerHTML = `
    <form class="karte farbe-gelb" id="pin-form">
      <div class="figur gross">${FIGUREN.kochtopf()}</div>
      <h2>Küchenchefin-Bereich</h2>
      <p>Bitte gib die PIN ein:</p>
      <input class="pin-feld" id="pin" type="password" inputmode="numeric"
             maxlength="4" autocomplete="off" aria-label="PIN">
      <div class="pin-fehler" id="pin-fehler"></div>
      <button class="knopf" type="submit">Los geht's</button>
    </form>
    <a class="zurueck" href="#">← Zurück zum Wochenplan</a>`;

  const form = document.getElementById("pin-form");
  const feld = document.getElementById("pin");
  const fehler = document.getElementById("pin-fehler");
  feld.focus();

  form.addEventListener("submit", async e => {
    e.preventDefault();
    fehler.textContent = "Prüfe PIN …";
    let richtig;
    try {
      richtig = await pinPruefen(feld.value); // fragt die Datenbank
    } catch (err) {
      fehler.textContent = "Keine Verbindung zur Datenbank 😟";
      return;
    }
    if (richtig) {
      // PIN merken, bis der Browser-Tab geschlossen wird – die Admin-Funktionen brauchen sie
      sessionStorage.setItem("adminPin", feld.value);
      zeigeAdmin(unterseite);
    } else {
      fehler.textContent = "Falsche PIN – versuch's nochmal!";
      feld.value = "";
      form.classList.remove("schuetteln");
      void form.offsetWidth; // Trick, damit die Wackel-Animation neu startet
      form.classList.add("schuetteln");
    }
  });
}

// Wenn die Datenbank "Falsche PIN" meldet (z. B. weil die PIN geändert wurde): neu anmelden
function adminFehler(err) {
  if (String(err.message).includes("Falsche PIN")) {
    sessionStorage.removeItem("adminPin");
    alert("Bitte melde dich neu an.");
    navigiere();
  } else {
    alert("Das hat leider nicht geklappt 😟\n" + err.message);
  }
}

// ---------- Übersicht ----------

function zeigeAdminUebersicht() {
  inhalt.innerHTML = `
    <div class="karte farbe-gelb">
      <div class="figur gross">${FIGUREN.kochtopf()}</div>
      <h2>Willkommen, Küchenchefin!</h2>
      <p>Was möchtest du machen?</p>
    </div>
    <div class="admin-kacheln">
      <a class="kachel" href="#admin/speisen"><span class="kachel-symbol">🥕</span>Speisen verwalten</a>
      <a class="kachel" href="#admin/frist"><span class="kachel-symbol">⏰</span>Frist einstellen</a>
      <a class="kachel" href="#admin/woche"><span class="kachel-symbol">📅</span>Woche festlegen</a>
    </div>
    <p class="mitte"><button class="knopf-klein" id="abmelden">🔒 Abmelden</button></p>
    <a class="zurueck" href="#">← Zurück zum Wochenplan</a>`;

  document.getElementById("abmelden").addEventListener("click", () => {
    sessionStorage.removeItem("adminPin");
    location.hash = "";
  });
}

// ---------- Speisen verwalten ----------

let bearbeiteId = null; // id der Speise, die gerade bearbeitet wird (null = neue Speise)
let alleSpeisen = [];

function zeigeSpeisenVerwaltung() {
  bearbeiteId = null;
  const kategorieOptionen = Object.entries(KATEGORIEN)
    .map(([wert, titel]) => `<option value="${wert}">${titel}</option>`).join("");
  const emojiKnoepfe = EMOJI_VORSCHLAEGE
    .map(e => `<button type="button" class="emoji-wahl" data-emoji="${e}">${e}</button>`).join("");

  inhalt.innerHTML = `
    <a class="zurueck" href="#admin">← Admin-Übersicht</a>

    <form class="karte links formular" id="speise-form">
      <h2 id="form-titel">➕ Neue Speise</h2>

      <label>Name
        <input id="f-name" required maxlength="60" placeholder="z. B. Spaghetti Bolognese">
      </label>

      <label>Mahlzeit
        <select id="f-kategorie">${kategorieOptionen}</select>
      </label>

      <label>Bild
        <span class="emoji-zeile">
          <input id="f-emoji" maxlength="8" value="🍽️" class="emoji-feld">
          <span class="leise">oder antippen:</span>
        </span>
      </label>
      <div class="emoji-auswahl">${emojiKnoepfe}</div>

      <label>Portionen
        <input id="f-portionen" type="number" min="0" max="999" inputmode="numeric" placeholder="unbegrenzt">
        <small class="leise">Leer lassen = unbegrenzt. Bei 0 wird die Speise nicht mehr angezeigt.</small>
      </label>

      <div class="knopf-reihe">
        <button class="knopf" type="submit" id="f-speichern">Speichern</button>
        <button class="knopf-klein" type="button" id="f-abbrechen" hidden>Abbrechen</button>
      </div>
    </form>

    <div id="speisen-listen"><p class="mitte leise">Lade Speisen …</p></div>`;

  const form = document.getElementById("speise-form");

  // Emoji antippen → ins Feld übernehmen
  form.querySelector(".emoji-auswahl").addEventListener("click", e => {
    const knopf = e.target.closest(".emoji-wahl");
    if (knopf) document.getElementById("f-emoji").value = knopf.dataset.emoji;
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const portionenText = document.getElementById("f-portionen").value.trim();
    const daten = {
      name: document.getElementById("f-name").value.trim(),
      kategorie: document.getElementById("f-kategorie").value,
      emoji: document.getElementById("f-emoji").value.trim() || "🍽️",
      portionen: portionenText === "" ? null : Math.max(0, parseInt(portionenText, 10)),
    };
    if (!daten.name) return;
    if (bearbeiteId) daten.id = bearbeiteId;

    const knopf = document.getElementById("f-speichern");
    knopf.disabled = true;
    try {
      await speiseSpeichern(daten);
      formularLeeren(daten.kategorie); // gleiche Mahlzeit vorauswählen – praktisch beim Eintragen vieler Speisen
      await ladeUndZeigeListen();
    } catch (err) {
      adminFehler(err);
    } finally {
      knopf.disabled = false;
    }
  });

  document.getElementById("f-abbrechen").addEventListener("click", () => formularLeeren());

  // Alle Knöpfe in den Listen (Plus, Minus, möglich, bearbeiten, löschen)
  document.getElementById("speisen-listen").addEventListener("click", listenKlick);

  ladeUndZeigeListen();
}

function formularLeeren(kategorie) {
  bearbeiteId = null;
  document.getElementById("f-name").value = "";
  document.getElementById("f-emoji").value = "🍽️";
  document.getElementById("f-portionen").value = "";
  if (kategorie) document.getElementById("f-kategorie").value = kategorie;
  document.getElementById("form-titel").textContent = "➕ Neue Speise";
  document.getElementById("f-abbrechen").hidden = true;
}

function formularFuellen(s) {
  bearbeiteId = s.id;
  document.getElementById("f-name").value = s.name;
  document.getElementById("f-kategorie").value = s.kategorie;
  document.getElementById("f-emoji").value = s.emoji;
  document.getElementById("f-portionen").value = s.portionen ?? "";
  document.getElementById("form-titel").textContent = "✏️ Speise bearbeiten";
  document.getElementById("f-abbrechen").hidden = false;
  document.getElementById("speise-form").scrollIntoView({ behavior: "smooth" });
  document.getElementById("f-name").focus();
}

async function ladeUndZeigeListen() {
  const box = document.getElementById("speisen-listen");
  try {
    alleSpeisen = await ladeSpeisen();
  } catch (err) {
    box.innerHTML = `<p class="fehler">😟 Keine Verbindung zur Datenbank: ${sicher(err.message)}</p>`;
    return;
  }

  box.innerHTML = Object.entries(KATEGORIEN).map(([schluessel, titel]) => {
    const liste = alleSpeisen.filter(s => s.kategorie === schluessel);
    const zeilen = liste.length
      ? liste.map(speiseZeile).join("")
      : `<p class="leise">Noch nichts eingetragen.</p>`;
    return `<section class="karte links"><h3>${titel} <span class="anzahl">${liste.length}</span></h3>${zeilen}</section>`;
  }).join("");
}

function speiseZeile(s) {
  const leer = s.portionen === 0;
  const aus = s.nicht_moeglich || leer;

  let hinweis = "";
  if (s.nicht_moeglich) hinweis = "nicht möglich – wird nicht angezeigt";
  else if (leer) hinweis = "keine Portionen mehr – wird nicht angezeigt";

  const portionen = s.portionen === null
    ? `<span class="portionen-zahl" title="unbegrenzt">∞</span>`
    : `<button class="rund" data-aktion="minus" aria-label="Eine Portion weniger" ${leer ? "disabled" : ""}>−</button>
       <span class="portionen-zahl">${s.portionen}</span>
       <button class="rund" data-aktion="plus" aria-label="Eine Portion mehr">+</button>`;

  return `
    <div class="speise-zeile ${aus ? "aus" : ""}" data-id="${s.id}">
      <span class="speise-emoji">${sicher(s.emoji)}</span>
      <span class="speise-name">${sicher(s.name)}${hinweis ? `<small>${hinweis}</small>` : ""}</span>
      <span class="portionen">${portionen}</span>
      <span class="speise-knoepfe">
        <button class="schalter ${s.nicht_moeglich ? "an" : ""}" data-aktion="moeglich"
                aria-pressed="${s.nicht_moeglich}">${s.nicht_moeglich ? "🚫 nicht möglich" : "✅ möglich"}</button>
        <button class="rund" data-aktion="bearbeiten" aria-label="Bearbeiten">✏️</button>
        <button class="rund" data-aktion="loeschen" aria-label="Löschen">🗑️</button>
      </span>
    </div>`;
}

async function listenKlick(e) {
  const knopf = e.target.closest("button[data-aktion]");
  if (!knopf) return;
  const zeile = knopf.closest(".speise-zeile");
  const speise = alleSpeisen.find(s => s.id === Number(zeile.dataset.id));
  if (!speise) return;

  let aenderung = null;
  switch (knopf.dataset.aktion) {
    case "plus":       aenderung = { portionen: speise.portionen + 1 }; break;
    case "minus":      aenderung = { portionen: Math.max(0, speise.portionen - 1) }; break;
    case "moeglich":   aenderung = { nicht_moeglich: !speise.nicht_moeglich }; break;
    case "bearbeiten": formularFuellen(speise); return;
    case "loeschen":
      if (!confirm(`„${speise.name}“ wirklich löschen?`)) return;
      aenderung = { geloescht: true }; // bleibt für alte Wochenpläne erhalten, wird aber nicht mehr angezeigt
      break;
  }

  zeile.querySelectorAll("button").forEach(b => (b.disabled = true));
  try {
    await speiseSpeichern({ id: speise.id, ...aenderung });
    await ladeUndZeigeListen();
  } catch (err) {
    adminFehler(err);
    await ladeUndZeigeListen();
  }
}

// ---------- Frist einstellen ----------

function zeigeFristEinstellung() {
  const f = FRIST_EINSTELLUNG;
  const zwei = n => String(n).padStart(2, "0");
  const tagOptionen = WOCHENTAGE
    .map((name, nr) => `<option value="${nr}" ${nr === f.tag ? "selected" : ""}>${name}</option>`).join("");

  inhalt.innerHTML = `
    <a class="zurueck" href="#admin">← Admin-Übersicht</a>
    <form class="karte links formular" id="frist-form">
      <h2>⏰ Bis wann darf gewählt werden?</h2>
      <p>Die Familie sucht immer für die <strong>nächste</strong> Woche aus.
         Hier stellst du ein, wann die Auswahl in der Woche <strong>davor</strong> schließt.</p>
      <label>Wochentag
        <select id="f-tag">${tagOptionen}</select>
      </label>
      <label>Uhrzeit
        <input id="f-zeit" type="time" required value="${zwei(f.stunde)}:${zwei(f.minute)}">
      </label>
      <p class="frist-vorschau" id="frist-vorschau"></p>
      <div class="knopf-reihe">
        <button class="knopf" type="submit" id="f-speichern">Speichern</button>
        <span id="frist-meldung"></span>
      </div>
    </form>`;

  const formWerte = () => {
    const [stunde, minute] = document.getElementById("f-zeit").value.split(":").map(Number);
    return { tag: Number(document.getElementById("f-tag").value), stunde: stunde || 0, minute: minute || 0 };
  };
  const vorschau = () => {
    const { start, frist, offen } = planungsWoche(jetzt(), formWerte());
    document.getElementById("frist-vorschau").innerHTML =
      `Für die Woche ab <strong>${kurzDatum(start)}</strong> kann dann bis
       <strong>${fristText(frist)}</strong> gewählt werden${offen ? "." : " – diese Frist ist schon vorbei."}`;
  };
  vorschau();

  const form = document.getElementById("frist-form");
  form.addEventListener("input", () => {
    vorschau();
    document.getElementById("frist-meldung").textContent = "";
  });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const neu = formWerte();
    const knopf = document.getElementById("f-speichern");
    knopf.disabled = true;
    try {
      await fristSpeichern(neu);
      FRIST_EINSTELLUNG = neu;
      document.getElementById("frist-meldung").innerHTML = `<span class="ok">✅ Gespeichert</span>`;
    } catch (err) {
      adminFehler(err);
    } finally {
      knopf.disabled = false;
    }
  });
}
