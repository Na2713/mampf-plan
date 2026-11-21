// ===== Admin: Woche festlegen (#admin/woche) =====
// Wünsche entscheiden, fehlende Wahlen festlegen, Ausnahmen ankreuzen, Woche abschließen.

const aw = {
  start: null,       // Montag der angezeigten Woche (Datum)
  woche: "",         // derselbe Montag als Text
  speisen: [],
  auswahl: [],
  ausnahmen: {},
  abgeschlossen: false,
  beschaeftigt: false,
};

const AW_MAHLZEIT = {
  fruehstueck: "🥐 Frühstück",
  snack:       "🍎 Pausensnack",
  mittag:      "🍲 Mittagessen",
  abend_extra: "🥨 Abend-Extras",
};

function zeigeWocheFestlegen() {
  if (!aw.start) aw.start = planungsWoche(jetzt()).start; // beim ersten Mal: die Woche, die gerade geplant wird
  inhalt.innerHTML = `
    <a class="zurueck" href="#admin">← Admin-Übersicht</a>
    <div id="aw-inhalt"><p class="mitte leise">Lade die Woche …</p></div>`;
  const box = document.getElementById("aw-inhalt");
  box.addEventListener("click", awKlick);
  box.addEventListener("change", awAenderung);
  box.addEventListener("submit", awFreitext);
  awLaden();
}

async function awLaden() {
  aw.woche = isoDatum(aw.start);
  try {
    const [speisen, auswahl, woche] = await Promise.all([
      ladeSpeisen(true), ladeAuswahl(aw.woche), ladeWoche(aw.woche),
    ]);
    aw.speisen = speisen;
    aw.auswahl = auswahl;
    aw.ausnahmen = (woche && woche.ausnahmen) || {};
    aw.abgeschlossen = !!(woche && woche.abgeschlossen);
  } catch (err) {
    document.getElementById("aw-inhalt").innerHTML =
      `<p class="fehler">😟 Keine Verbindung zur Datenbank: ${sicher(err.message)}</p>`;
    return;
  }
  awZeichnen();
}

// ---------- Hilfen ----------

function awSpeise(e) {
  return eintragSpeise(aw.speisen, e);
}
function awName(id) {
  return id === "alle" ? "Alle" : PERSONEN_NAME[id];
}
function chipHtml(e, mitName) {
  const s = awSpeise(e);
  const wer = mitName ? `<small>${awName(e.person)}:</small> ` : "";
  return `<span class="chip ${e.art === "festgelegt" ? "kueche" : ""}">${wer}${sicher(s.emoji)} ${sicher(s.name)}
    <button class="chip-weg" data-aktion="loeschen" data-id="${e.id}" aria-label="Entfernen">✕</button></span>`;
}

// Auswahlliste zum Festlegen. Leere Portionen sind gesperrt, "nicht möglich" ist markiert.
function speisenSelect(kategorie, daten, text) {
  const optionen = aw.speisen
    .filter(s => s.kategorie === kategorie && !s.geloescht)
    .map(s => {
      const leer = s.portionen === 0;
      const zusatz = leer ? " (keine Portion mehr)" : s.nicht_moeglich ? " (nicht möglich)" : "";
      return `<option value="${s.id}" ${leer ? "disabled" : ""}>${sicher(s.emoji)} ${sicher(s.name)}${zusatz}</option>`;
    }).join("");
  return `<select class="festlegen" data-aktion="festlegen" ${daten}>
            <option value="">${text}</option>${optionen}</select>`;
}

// Was ist in dieser Woche noch offen?
function offenePunkte() {
  let offen = 0;
  for (let tagNr = 0; tagNr < 7; tagNr++) {
    const regeln = tagesRegeln(tagNr, aw.ausnahmen[tagNr]);
    for (const m of regeln.mahlzeiten) {
      if (m.modus === "wahl") {
        offen += m.personen.filter(p => !eintraegeVon(aw.auswahl, p, tagNr, m.mahlzeit).length).length;
      } else if (m.modus === "wunsch" && m.personen.length) {
        if (!eintraegeVon(aw.auswahl, "alle", tagNr, m.mahlzeit).length) offen++;
      }
    }
  }
  return offen;
}

// ---------- Zeichnen ----------

function awZeichnen() {
  const { start: planStart } = planungsWoche(jetzt());
  const frist = planungsWoche(plusTage(aw.start, -7)).frist; // Frist liegt in der Woche davor
  const fristVorbei = jetzt() >= frist;
  const offen = offenePunkte();
  const istPlanwoche = isoDatum(planStart) === aw.woche;

  let status;
  if (aw.abgeschlossen) status = "🔒 Abgeschlossen – die Familie kann nichts mehr ändern.";
  else if (fristVorbei) status = `🔒 Frist vorbei (${fristText(frist)}).`;
  else status = `⏰ Die Familie kann noch bis ${fristText(frist)} wählen.`;

  const tageHtml = WOCHENTAGE.map((name, tagNr) => awTagHtml(name, tagNr)).join("");

  document.getElementById("aw-inhalt").innerHTML = `
    <div class="karte farbe-gelb aw-kopf">
      <div class="wochen-wahl">
        <button class="rund" data-aktion="woche" data-schritt="-7" aria-label="Woche davor">◀</button>
        <div><strong>Woche ${kurzDatum(aw.start)} – ${kurzDatum(plusTage(aw.start, 6))}</strong>
          ${istPlanwoche ? `<small>wird gerade geplant</small>` : ""}</div>
        <button class="rund" data-aktion="woche" data-schritt="7" aria-label="Woche danach">▶</button>
      </div>
      <p>${status}</p>
      <p class="${offen ? "fehler" : "ok"}">${offen
        ? `Noch ${offen} ${offen === 1 ? "Entscheidung" : "Entscheidungen"} offen`
        : "✅ Alles entschieden!"}</p>
      <button class="knopf-klein" data-aktion="abschliessen">
        ${aw.abgeschlossen ? "🔓 Woche wieder öffnen" : "🔒 Woche abschließen"}</button>
    </div>
    <div class="woche aw-woche">${tageHtml}</div>`;
}

function awTagHtml(name, tagNr) {
  const tagAusnahmen = aw.ausnahmen[tagNr] || {};
  const regeln = tagesRegeln(tagNr, tagAusnahmen);
  const anzahl = Object.values(tagAusnahmen).filter(Boolean).length;

  const haekchen = Object.entries(AUSNAHMEN).map(([schluessel, text]) => `
    <label class="haekchen">
      <input type="checkbox" data-aktion="ausnahme" data-tag="${tagNr}" data-schluessel="${schluessel}"
             ${tagAusnahmen[schluessel] ? "checked" : ""}> ${text}
    </label>`).join("");

  const bloecke = regeln.entfaellt
    ? `<div class="wahl-block"><strong>🏖️ Tag entfällt</strong></div>`
    : regeln.mahlzeiten.filter(m => m.modus !== "fest").map(m => awMahlzeitHtml(tagNr, m)).join("");

  return `
    <article class="tag ${tagNr >= 5 ? "wochenende" : ""}">
      <div class="tag-kopf">${name} <span class="datum">${kurzDatum(plusTage(aw.start, tagNr))}</span></div>
      <details class="ausnahmen-wahl" ${anzahl ? "open" : ""}>
        <summary>Ausnahmen${anzahl ? ` (${anzahl})` : ""}</summary>${haekchen}
      </details>
      ${bloecke}
    </article>`;
}

function awMahlzeitHtml(tagNr, m) {
  const titel = AW_MAHLZEIT[m.mahlzeit];
  const daten = p => `data-tag="${tagNr}" data-mahlzeit="${m.mahlzeit}" data-person="${p}"`;

  // Wünsche (Mo/Sa/So mittags): Küchenchefin entscheidet für alle
  if (m.modus === "wunsch") {
    if (!m.personen.length) return "";
    const entscheidung = eintraegeVon(aw.auswahl, "alle", tagNr, m.mahlzeit)[0];
    const wuensche = aw.auswahl.filter(e => e.tag === tagNr && e.mahlzeit === m.mahlzeit && e.art === "wunsch");
    const ohneWunsch = m.personen.filter(p => !wuensche.some(w => w.person === p));

    // Gleiche Wünsche zusammenfassen: Pizza – Noah, Mama
    // (frei getippte Wünsche gelten als gleich, wenn der Text gleich ist – egal ob groß/klein)
    const gruppen = {};
    for (const w of wuensche) {
      const schluessel = w.freitext ? "t:" + w.freitext.trim().toLowerCase() : "s:" + w.speise_id;
      (gruppen[schluessel] ||= []).push(w);
    }
    const wunschListe = Object.values(gruppen)
      .sort((a, b) => b.length - a.length)
      .map(liste => {
        const erster = liste[0];
        const s = awSpeise(erster);
        const was = erster.freitext
          ? `data-text="${sicher(erster.freitext)}"`
          : `data-speise="${erster.speise_id}"`;
        return `<div class="wunsch-zeile">
          <span>${sicher(s.emoji)} <strong>${sicher(s.name)}</strong>
            <small>${liste.map(w => awName(w.person)).join(", ")}${erster.freitext ? " · eigener Wunsch" : ""}</small></span>
          ${entscheidung ? "" : `<button class="knopf-klein" data-aktion="nehmen" ${daten("alle")} ${was}>✔ Das gibt's</button>`}
        </div>`;
      }).join("");

    return `
      <div class="wahl-block ${entscheidung ? "fertig" : ""}">
        <strong>${titel} – Wünsche</strong>
        ${entscheidung
          ? `<p class="entscheidung">🎉 Es gibt: ${sicher(awSpeise(entscheidung).emoji)} ${sicher(awSpeise(entscheidung).name)}
               <button class="chip-weg" data-aktion="loeschen" data-id="${entscheidung.id}" aria-label="Entscheidung zurücknehmen">✕</button></p>`
          : ""}
        ${wunschListe || `<p class="leise">Noch keine Wünsche.</p>`}
        ${ohneWunsch.length ? `<p class="leise">Ohne Wunsch: ${ohneWunsch.map(awName).join(", ")}</p>` : ""}
        ${entscheidung ? "" : speisenSelect(m.kategorie, daten("alle"), "… oder etwas anderes festlegen")}
        ${entscheidung ? "" : `
          <form class="freitext-form" ${daten("alle")}>
            <div class="freitext-zeile">
              <input name="wunsch" maxlength="60" required autocomplete="off" aria-label="Eigenes Essen festlegen"
                     placeholder="… oder selbst eintippen">
              <button class="knopf-klein" type="submit">✔ Festlegen</button>
            </div>
          </form>`}
      </div>`;
  }

  // Abend-Extras: freiwillig – nur anzeigen, was gewünscht wurde
  if (m.modus === "extra") {
    const extras = aw.auswahl.filter(e => e.tag === tagNr && e.mahlzeit === m.mahlzeit);
    if (!extras.length) return "";
    return `<div class="wahl-block"><strong>${titel}</strong>
      <div class="chips">${extras.map(e => chipHtml(e, true)).join("")}</div></div>`;
  }

  // Freie Wahl: pro Person anzeigen, Lücken festlegen
  if (!m.personen.length) return "";
  const zeilen = m.personen.map(p => {
    const eigene = eintraegeVon(aw.auswahl, p, tagNr, m.mahlzeit);
    return `<div class="person-zeile ${eigene.length ? "" : "fehlt"}">
      <span class="person-name">${awName(p)}</span>
      <span class="chips">${eigene.map(e => chipHtml(e, false)).join("")}
        ${eigene.length ? "" : speisenSelect(m.kategorie, daten(p), "fehlt – festlegen …")}</span>
    </div>`;
  }).join("");
  return `<div class="wahl-block"><strong>${titel}</strong>${zeilen}</div>`;
}

// ---------- Klicks und Änderungen ----------

async function awAktion(fn) {
  if (aw.beschaeftigt) return;
  aw.beschaeftigt = true;
  document.getElementById("aw-inhalt").classList.add("laedt");
  try {
    await fn();
  } catch (err) {
    adminFehler(err);
  } finally {
    aw.beschaeftigt = false;
    document.getElementById("aw-inhalt")?.classList.remove("laedt");
  }
  await awLaden();
}

function awKlick(e) {
  const knopf = e.target.closest("button[data-aktion]");
  if (!knopf) return;
  const d = knopf.dataset;

  if (d.aktion === "woche") {
    aw.start = plusTage(aw.start, Number(d.schritt));
    document.getElementById("aw-inhalt").innerHTML = `<p class="mitte leise">Lade die Woche …</p>`;
    awLaden();
  } else if (d.aktion === "nehmen") {
    awAktion(() => d.text
      ? adminFestlegen(aw.woche, Number(d.tag), d.mahlzeit, "alle", null, d.text)
      : adminFestlegen(aw.woche, Number(d.tag), d.mahlzeit, "alle", Number(d.speise)));
  } else if (d.aktion === "loeschen") {
    awAktion(() => adminEintragLoeschen(Number(d.id)));
  } else if (d.aktion === "abschliessen") {
    awAktion(() => wocheSpeichern(aw.woche, aw.ausnahmen, !aw.abgeschlossen));
  }
}

function awAenderung(e) {
  const feld = e.target;
  const d = feld.dataset;

  if (d.aktion === "festlegen" && feld.value) {
    awAktion(() => adminFestlegen(aw.woche, Number(d.tag), d.mahlzeit, d.person, Number(feld.value)));
  }

  if (d.aktion === "ausnahme") {
    const tagNr = Number(d.tag);
    const neu = JSON.parse(JSON.stringify(aw.ausnahmen));
    const tag = { ...(neu[tagNr] || {}) };
    if (feld.checked) tag[d.schluessel] = true;
    else delete tag[d.schluessel];
    if (Object.keys(tag).length) neu[tagNr] = tag;
    else delete neu[tagNr];

    // Welche Einträge passen mit der neuen Ausnahme nicht mehr? (z. B. Pausensnack in den Ferien)
    const regeln = tagesRegeln(tagNr, neu[tagNr]);
    const unpassend = aw.auswahl.filter(e => {
      if (e.tag !== tagNr) return false;
      const m = findeMahlzeit(regeln, e.mahlzeit);
      if (!m) return true;
      return e.person === "alle" ? m.modus !== "wunsch" : !m.personen.includes(e.person);
    });
    if (unpassend.length && !confirm(
      `Dadurch ${unpassend.length === 1 ? "fällt 1 Auswahl" : `fallen ${unpassend.length} Auswahlen`} an diesem Tag weg. Trotzdem ändern?`)) {
      feld.checked = !feld.checked;
      return;
    }
    awAktion(async () => {
      await wocheSpeichern(aw.woche, neu, aw.abgeschlossen);
      for (const e of unpassend) await adminEintragLoeschen(e.id);
    });
  }
}

// Küchenchefin tippt selbst ein, was es gibt
function awFreitext(e) {
  e.preventDefault();
  const form = e.target.closest("form.freitext-form");
  if (!form) return;
  const text = form.elements.wunsch.value.trim();
  if (!text) return;
  const d = form.dataset;
  awAktion(() => adminFestlegen(aw.woche, Number(d.tag), d.mahlzeit, d.person, null, text.slice(0, 60)));
}
