// ===== Personen-Bereich: Hier sucht jeder sein Essen aus =====

const AUSWAHL_TEXTE = {
  fruehstueck: { symbol: "🥐", titel: "Frühstück",       hinweis: "Such dir eins aus" },
  snack:       { symbol: "🍎", titel: "Pausensnack",     hinweis: "Bis zu 2 Sachen" },
  mittag:      { symbol: "🍲", titel: "Mittagessen",     hinweis: "Such dir etwas aus" },
  abend_extra: { symbol: "🥨", titel: "Extra zur Brotzeit", hinweis: "Freiwillig" },
};

// Alles, was die Personen-Seite gerade anzeigt
const ps = {
  person: null,     // z. B. { id: "noah", name: "Noah", ... }
  start: null,      // Montag der geplanten Woche (Datum)
  woche: "",        // derselbe Montag als Text "2026-11-30"
  offen: false,     // darf noch gewählt werden?
  speisen: [],      // alle Speisen (auch gelöschte, für die Namen)
  auswahl: [],      // alle Einträge der Woche (von allen Personen)
  ausnahmen: {},    // Ausnahmen der Woche
  picker: null,     // welche Auswahl-Liste gerade aufgeklappt ist, z. B. "2-mittag"
  beschaeftigt: false,
};

async function zeigePerson(id) {
  const person = PERSONEN.find(x => x.id === id);
  if (!person) return zeigeStartseite();

  const { start, offen } = planungsWoche(jetzt());
  Object.assign(ps, { person, start, woche: isoDatum(start), offen, picker: null });

  inhalt.innerHTML = `
    <div class="karte farbe-${person.farbe} person-kopf">
      <div class="figur gross">${FIGUREN[person.figur]()}</div>
      <h2>Hallo ${person.name}!</h2>
      <div id="fortschritt"></div>
    </div>
    <div class="countdown" id="countdown"></div>
    <div id="person-tage"><p class="mitte leise">Lade dein Essen …</p></div>
    <a class="zurueck" href="#">← Zurück zum Wochenplan</a>`;
  aktualisiereCountdown();

  // Klicks in der Tagesliste (Aussuchen, Speise antippen, entfernen)
  document.getElementById("person-tage").addEventListener("click", personKlick);

  await personDatenLaden();
}

async function personDatenLaden() {
  try {
    const [speisen, auswahl, woche] = await Promise.all([
      ladeSpeisen(true), ladeAuswahl(ps.woche), ladeWoche(ps.woche),
    ]);
    ps.speisen = speisen;
    ps.auswahl = auswahl;
    ps.ausnahmen = (woche && woche.ausnahmen) || {};
    if (woche && woche.abgeschlossen) ps.offen = false;
  } catch (err) {
    document.getElementById("person-tage").innerHTML =
      `<p class="fehler">😟 Keine Verbindung zur Datenbank: ${sicher(err.message)}</p>`;
    return;
  }
  personZeichnen();
}

// ---------- Zeichnen ----------

function speiseVon(id) {
  return ps.speisen.find(s => s.id === id) || { name: "?", emoji: "❓" };
}

// Alle Mahlzeiten, bei denen die Person etwas aussuchen darf/durfte
function auswahlStellen() {
  const stellen = [];
  for (let tagNr = 0; tagNr < 7; tagNr++) {
    const regeln = tagesRegeln(tagNr, ps.ausnahmen[tagNr]);
    for (const m of regeln.mahlzeiten) {
      if (m.modus !== "fest" && m.personen.includes(ps.person.id)) stellen.push({ tagNr, regeln, m });
    }
  }
  return stellen;
}

function personZeichnen() {
  const stellen = auswahlStellen();
  const p = ps.person.id;

  // Fortschritt: alle Pflicht-Stellen (alles außer den freiwilligen Extras)
  const pflicht = stellen.filter(s => s.m.modus !== "extra");
  const erledigt = pflicht.filter(s => eintraegeVon(ps.auswahl, p, s.tagNr, s.m.mahlzeit).length > 0).length;
  const prozent = pflicht.length ? Math.round((erledigt / pflicht.length) * 100) : 100;
  const hatExtras = stellen.some(s => s.m.modus === "extra");
  const extrasUebrig = MAX_EXTRAS_PRO_WOCHE - extrasGenutzt(ps.auswahl, p);

  document.getElementById("fortschritt").innerHTML = pflicht.length ? `
      <div class="balken"><div style="width:${prozent}%"></div></div>
      <p>${erledigt === pflicht.length
        ? "🎉 Super, du hast alles ausgesucht!"
        : `${erledigt} von ${pflicht.length} ausgesucht`}</p>
      ${hatExtras ? `<p class="leise">Abend-Extras: noch ${Math.max(0, extrasUebrig)} von ${MAX_EXTRAS_PRO_WOCHE} übrig</p>` : ""}`
    : `<p>Diese Woche musst du nichts aussuchen 😊</p>`;

  // Nach Tagen gruppieren
  const tageHtml = WOCHENTAGE.map((tagName, tagNr) => {
    const tagStellen = stellen.filter(s => s.tagNr === tagNr);
    if (!tagStellen.length) return "";
    return `
      <article class="tag ${tagNr >= 5 ? "wochenende" : ""}">
        <div class="tag-kopf">${tagName} <span class="datum">${kurzDatum(plusTage(ps.start, tagNr))}</span></div>
        ${tagStellen.map(stelleHtml).join("")}
      </article>`;
  }).join("");

  const tageOhne = WOCHENTAGE.filter((_, tagNr) => !stellen.some(s => s.tagNr === tagNr));
  document.getElementById("person-tage").innerHTML = `
    <div class="woche">${tageHtml}</div>
    ${tageOhne.length && tageOhne.length < 7
      ? `<p class="leise mitte">${tageOhne.join(", ")}: nichts auszusuchen.</p>` : ""}`;
}

function stelleHtml({ tagNr, regeln, m }) {
  const p = ps.person.id;
  const text = AUSWAHL_TEXTE[m.mahlzeit];
  const schluessel = `${tagNr}-${m.mahlzeit}`;
  const eigene = eintraegeVon(ps.auswahl, p, tagNr, m.mahlzeit);

  // Hat die Küchenchefin bei einem Wunsch-Essen schon entschieden?
  const entscheidung = m.modus === "wunsch"
    ? ps.auswahl.find(e => e.person === "alle" && e.tag === tagNr && e.mahlzeit === m.mahlzeit)
    : null;

  let titel = text.titel, hinweis = text.hinweis;
  if (m.modus === "wunsch") { titel += " – dein Wunsch"; hinweis = "Die Küchenchefin entscheidet"; }
  if (m.mahlzeit === "snack") hinweis = `Bis zu ${m.max} Sachen`;

  const darfAendern = ps.offen && !entscheidung;
  const chips = eigene.map(e => {
    const s = speiseVon(e.speise_id);
    const vonKueche = e.art === "festgelegt";
    const entfernen = darfAendern && !vonKueche
      ? `<button class="chip-weg" data-aktion="weg" data-id="${e.id}" aria-label="${sicher(s.name)} entfernen">✕</button>` : "";
    return `<span class="chip ${vonKueche ? "kueche" : ""}">${sicher(s.emoji)} ${sicher(s.name)}${vonKueche ? " <small>(Küchenchefin)</small>" : ""}${entfernen}</span>`;
  }).join("");

  const kannMehr = darfAendern && kannNochWaehlen(ps.auswahl, p, regeln, m.mahlzeit);
  let knopf = "";
  if (kannMehr) {
    knopf = `<button class="aussuchen" data-aktion="picker" data-stelle="${schluessel}">
               ${ps.picker === schluessel ? "▲ Zuklappen" : eigene.length ? "+ Noch etwas" : "+ Aussuchen"}</button>`;
  } else if (darfAendern && m.modus === "extra" && !eigene.length) {
    knopf = `<span class="leise">Keine Extras mehr übrig diese Woche</span>`;
  } else if (!eigene.length && !entscheidung) {
    knopf = `<span class="leise">${ps.offen ? "" : "Nichts ausgesucht – die Küchenchefin entscheidet"}</span>`;
  }

  let liste = "";
  if (kannMehr && ps.picker === schluessel) {
    const angebot = waehlbareSpeisen(ps.speisen, m.kategorie);
    liste = angebot.length
      ? `<div class="angebot">${angebot.map(s => `
          <button class="angebot-knopf" data-aktion="waehle" data-stelle="${schluessel}" data-speise="${s.id}">
            <span class="angebot-emoji">${sicher(s.emoji)}</span>${sicher(s.name)}
          </button>`).join("")}</div>`
      : `<p class="leise">Gerade gibt es hier leider nichts zum Aussuchen.</p>`;
  }

  return `
    <div class="wahl-block ${eigene.length || entscheidung ? "fertig" : ""}">
      <div class="wahl-titel">
        <span class="symbol">${text.symbol}</span>
        <span><strong>${titel}</strong><small>${hinweis}</small></span>
      </div>
      ${entscheidung ? `<p class="entscheidung">🎉 Es gibt: ${sicher(speiseVon(entscheidung.speise_id).emoji)} ${sicher(speiseVon(entscheidung.speise_id).name)}</p>` : ""}
      <div class="chips">${chips}${knopf}</div>
      ${liste}
    </div>`;
}

// ---------- Klicks ----------

async function personKlick(e) {
  const knopf = e.target.closest("button[data-aktion]");
  if (!knopf || ps.beschaeftigt) return;
  const aktion = knopf.dataset.aktion;

  if (aktion === "picker") {
    ps.picker = ps.picker === knopf.dataset.stelle ? null : knopf.dataset.stelle;
    personZeichnen();
    return;
  }

  ps.beschaeftigt = true;
  knopf.disabled = true;
  try {
    if (aktion === "waehle") {
      const [tagNr, mahlzeit] = knopf.dataset.stelle.split(/-(.+)/);
      const regeln = tagesRegeln(Number(tagNr), ps.ausnahmen[tagNr]);
      const m = findeMahlzeit(regeln, mahlzeit);
      await auswahlHinzufuegen({
        woche: ps.woche,
        tag: Number(tagNr),
        mahlzeit,
        person: ps.person.id,
        speise_id: Number(knopf.dataset.speise),
        art: m.modus === "wunsch" ? "wunsch" : "wahl",
      });
      ps.picker = null;
    } else if (aktion === "weg") {
      await auswahlEntfernen(Number(knopf.dataset.id));
    }
  } catch (err) {
    alert(freundlicherFehler(err));
  } finally {
    ps.beschaeftigt = false;
  }
  await personDatenLaden(); // neu laden, damit auch Portionen und Wahlen der anderen stimmen
}
