// ===== Mampf-Plan: Hauptprogramm =====
// Startseite, Countdown, Personen-Seiten und Navigation.
// Die Regeln stehen in regeln.js, die Datenbank-Zugriffe in db.js, der Admin-Bereich in admin.js.

const PERSONEN = [
  { id: "mama",   name: "Mama",   figur: "tomate",    farbe: "tomate" },
  { id: "papa",   name: "Papa",   figur: "brokkoli",  farbe: "blatt" },
  { id: "noah",   name: "Noah",   figur: "karotte",   farbe: "karotte" },
  { id: "amelie", name: "Amelie", figur: "aubergine", farbe: "aubergine" },
];

// Die Admin-PIN steht nur in der Datenbank (Tabelle "geheimnisse"), nicht hier im Code.

const KATEGORIEN = {
  fruehstueck:     "🥐 Frühstück",
  snack:           "🍎 Pausensnack",
  mittag_frisch:   "🍲 Mittagessen – frisch gekocht",
  mittag_mealprep: "🧊 Mittagessen – Mealprep",
  abend_extra:     "🥨 Abend-Extras",
};

// Text sicher in HTML einsetzen (damit z. B. "<" in einem Speisenamen nichts kaputt macht)
function sicher(text) {
  return String(text ?? "").replace(/[&<>"']/g, z =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]);
}

const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

// ---------- Datum & Woche ----------

// "Jetzt" – zum Testen kann man in der Adresse ?jetzt=2026-11-19T10:00 anhängen
function jetzt() {
  const test = new URLSearchParams(location.search).get("jetzt");
  return test ? new Date(test) : new Date();
}

// Montag, Frist, Restzeit usw. stehen jetzt in regeln.js

const PERSONEN_NAME = Object.fromEntries(PERSONEN.map(p => [p.id, p.name]));
const MAHLZEIT_ANZEIGE = {
  fruehstueck: { symbol: "🥐", titel: "Frühstück" },
  snack:       { symbol: "🍎", titel: "Pausensnack" },
  mittag:      { symbol: "🍲", titel: "Mittagessen" },
  abend:       { symbol: "🥨", titel: "Abendessen" },
};

// Namen schön auflisten: "Mama, Noah und Amelie"
function namenListe(ids) {
  const namen = ids.map(id => PERSONEN_NAME[id]);
  return namen.length <= 1 ? namen.join("") : namen.slice(0, -1).join(", ") + " und " + namen.at(-1);
}

// ---------- Seiten ----------

const inhalt = document.getElementById("inhalt");

// Welche Woche die Startseite gerade zeigt (Montag). null = noch nicht gewählt → diese Woche
let planMontag = null;

function zeigeStartseite() {
  const { offen } = planungsWoche(jetzt());
  if (!planMontag) planMontag = montagVon(jetzt());

  const personenHtml = PERSONEN.map(p => `
    <a class="person-knopf farbe-${p.farbe}" href="#person/${p.id}">
      <span class="figur">${FIGUREN[p.figur]()}</span>
      ${p.name}
    </a>`).join("");

  inhalt.innerHTML = `
    <div class="countdown ${offen ? "" : "zu"}" id="countdown"></div>

    <h2>Wer bist du?</h2>
    <div class="personen">${personenHtml}</div>
    <div class="admin-zeile">
      <a class="admin-knopf" href="#admin"><span class="figur">${FIGUREN.kochtopf()}</span> Küchenchefin</a>
    </div>

    <h2>Unser Wochenplan</h2>
    <div class="plan-steuerung">
      <button class="rund" data-plan="-7" aria-label="Woche davor">◀</button>
      <div class="plan-knoepfe">
        <button class="knopf-klein" data-plan="diese">Diese Woche</button>
        <button class="knopf-klein" data-plan="naechste">Nächste Woche</button>
      </div>
      <button class="rund" data-plan="7" aria-label="Woche danach">▶</button>
    </div>
    <p class="plan-titel" id="plan-titel"></p>
    <div class="woche" id="woche"><p class="mitte leise">Lade den Plan …</p></div>
    <div id="druck-tabelle" class="druck-tabelle"></div>
    <p class="mitte"><button class="knopf-klein" id="drucken">🖨️ Drucken</button></p>`;

  inhalt.querySelector(".plan-steuerung").addEventListener("click", e => {
    const knopf = e.target.closest("button[data-plan]");
    if (!knopf) return;
    const was = knopf.dataset.plan;
    if (was === "diese") planMontag = montagVon(jetzt());
    else if (was === "naechste") planMontag = planungsWoche(jetzt()).start;
    else planMontag = plusTage(planMontag, Number(was));
    planLaden();
  });
  document.getElementById("drucken").addEventListener("click", () => window.print());

  aktualisiereCountdown();
  planLaden();
}

async function planLaden() {
  const montag = planMontag;
  const diese = montagVon(jetzt());
  const naechste = planungsWoche(jetzt()).start;
  const name = isoDatum(montag) === isoDatum(diese) ? "Diese Woche"
    : isoDatum(montag) === isoDatum(naechste) ? "Nächste Woche"
    : montag < diese ? "Ältere Woche" : "Spätere Woche";
  const zeitraum = `${kurzDatum(montag)} bis ${kurzDatum(plusTage(montag, 6))}`;
  document.getElementById("plan-titel").innerHTML = `<strong>${name}</strong> · ${zeitraum}`;
  document.getElementById("wochen-titel").textContent = `${name}: ${zeitraum}`;
  for (const k of document.querySelectorAll(".plan-knoepfe button")) {
    const ziel = k.dataset.plan === "diese" ? diese : naechste;
    k.classList.toggle("aktiv", isoDatum(ziel) === isoDatum(montag));
  }

  let daten;
  try {
    const [speisen, auswahl, woche] = await Promise.all([
      ladeSpeisen(true), ladeAuswahl(isoDatum(montag)), ladeWoche(isoDatum(montag)),
    ]);
    daten = { speisen, auswahl, ausnahmen: (woche && woche.ausnahmen) || {} };
  } catch (err) {
    daten = { speisen: [], auswahl: [], ausnahmen: {} }; // ohne Verbindung: nur die festen Regeln
  }
  if (planMontag !== montag || !document.getElementById("woche")) return; // inzwischen weitergeklickt
  document.getElementById("woche").innerHTML = wochenplanHtml(montag, daten);
  document.getElementById("druck-tabelle").innerHTML = druckTabelleHtml(montag, daten, `${name} · ${zeitraum}`);
}

// ---------- Inhalt einer Mahlzeit (für Karten und Drucktabelle) ----------

function speiseText(daten, id) {
  const s = daten.speisen.find(x => x.id === id) || { emoji: "❓", name: "?" };
  return `${sicher(s.emoji)} ${sicher(s.name)}`;
}

function mahlzeitInhalt(m, tagNr, daten) {
  const eintraege = daten.auswahl.filter(e => e.tag === tagNr && e.mahlzeit === m.mahlzeit);
  const vonPerson = p => eintraege.filter(e => e.person === p).map(e => speiseText(daten, e.speise_id)).join(", ");

  if (m.mahlzeit === "abend") {
    const extras = daten.auswahl.filter(e => e.tag === tagNr && e.mahlzeit === "abend_extra");
    const extraText = extras.map(e => `<b>${PERSONEN_NAME[e.person]}:</b> ${speiseText(daten, e.speise_id)}`).join(" · ");
    return `<span class="wert">${m.fest}</span>${extras.length ? `<span class="extra">+ ${extraText}</span>` : ""}`;
  }
  if (m.modus === "fest") return `<span class="wert">${m.fest}</span>`;
  if (!m.personen.length) return `<span class="wert offen">niemand zu Hause</span>`;

  if (m.modus === "wunsch") {
    const entscheidung = eintraege.find(e => e.person === "alle");
    const fuer = `<span class="wer">für ${namenListe(m.personen)}</span>`;
    if (entscheidung) return `<span class="wert">${speiseText(daten, entscheidung.speise_id)}</span>${fuer}`;
    const wuensche = eintraege.filter(e => e.art === "wunsch");
    if (!wuensche.length) return `<span class="wert offen">noch offen</span>${fuer}`;
    const liste = wuensche.map(e => `<b>${PERSONEN_NAME[e.person]}:</b> ${speiseText(daten, e.speise_id)}`).join(" · ");
    return `<span class="wert offen">noch nicht entschieden</span><span class="wunsch-liste">Wünsche: ${liste}</span>${fuer}`;
  }

  // freie Wahl: pro Person
  return `<span class="personen-wahl">${m.personen.map(p => {
    const text = vonPerson(p);
    return `<span><b>${PERSONEN_NAME[p]}:</b> ${text || `<i class="offen">noch offen</i>`}</span>`;
  }).join("")}</span>`;
}

function wochenplanHtml(montag, daten) {
  const heute = isoDatum(jetzt());
  return WOCHENTAGE.map((tagName, tagNr) => {
    const datum = plusTage(montag, tagNr);
    const tagAusnahmen = daten.ausnahmen[tagNr] || {};
    const regeln = tagesRegeln(tagNr, tagAusnahmen);
    const istHeute = isoDatum(datum) === heute;

    const hinweise = Object.keys(AUSNAHMEN)
      .filter(k => tagAusnahmen[k] && k !== "entfaellt")
      .map(k => `<span class="ausnahme">${AUSNAHMEN[k]}</span>`).join("");

    const koerper = regeln.entfaellt
      ? `<div class="mahlzeit entfaellt"><span class="symbol">🏖️</span><span class="wert">Tag entfällt</span></div>`
      : regeln.mahlzeiten.filter(m => MAHLZEIT_ANZEIGE[m.mahlzeit]).map(m => {
          const anzeige = MAHLZEIT_ANZEIGE[m.mahlzeit];
          let etikett = "";
          if (m.mahlzeit === "mittag") {
            etikett = regeln.frischGekocht
              ? `<span class="etikett frisch">frisch gekocht</span>`
              : `<span class="etikett mealprep">Mealprep</span>`;
          }
          return `
            <div class="mahlzeit">
              <span class="symbol">${anzeige.symbol}</span>
              <span class="art">${anzeige.titel} ${etikett}</span>
              <span class="inhalt">${mahlzeitInhalt(m, tagNr, daten)}</span>
            </div>`;
        }).join("");

    return `
      <article class="tag ${tagNr >= 5 ? "wochenende" : ""} ${istHeute ? "heute" : ""}">
        <div class="tag-kopf"><span>${tagName} ${istHeute ? `<span class="heute-schild">Heute</span>` : ""}</span>
          <span class="datum">${kurzDatum(datum)}</span></div>
        ${hinweise ? `<div class="ausnahmen">${hinweise}</div>` : ""}
        ${koerper}
      </article>`;
  }).join("");
}

// Tabelle nur für den Ausdruck: Tage als Spalten, Mahlzeiten als Zeilen
function druckTabelleHtml(montag, daten, titel) {
  const tage = WOCHENTAGE.map((_, tagNr) => tagesRegeln(tagNr, daten.ausnahmen[tagNr] || {}));
  const zeilen = Object.entries(MAHLZEIT_ANZEIGE).map(([mahlzeit, anzeige]) => `
    <tr><th>${anzeige.symbol} ${anzeige.titel}</th>${tage.map((regeln, tagNr) => {
      if (regeln.entfaellt) return mahlzeit === "fruehstueck" ? `<td rowspan="4" class="entfaellt">🏖️ entfällt</td>` : "";
      const m = findeMahlzeit(regeln, mahlzeit);
      return `<td>${m ? mahlzeitInhalt(m, tagNr, daten) : "–"}</td>`;
    }).join("")}</tr>`).join("");
  return `
    <h2>🥕 Mampf-Plan – ${titel}</h2>
    <table>
      <thead><tr><th></th>${WOCHENTAGE.map((t, i) => `<th>${t}<br><small>${kurzDatum(plusTage(montag, i))}</small></th>`).join("")}</tr></thead>
      <tbody>${zeilen}</tbody>
    </table>`;
}

// "Samstag, 28.11., 14:00 Uhr"
function fristText(datum) {
  return `${WOCHENTAGE[(datum.getDay() + 6) % 7]}, ${kurzDatum(datum)}, ${uhrzeitText(datum)} Uhr`;
}

function aktualisiereCountdown() {
  const box = document.getElementById("countdown");
  if (!box) return;
  const nun = jetzt();
  const { frist, offen } = planungsWoche(nun);
  if (offen) {
    box.classList.remove("zu");
    box.innerHTML = `<span class="uhr">⏰</span>
      <div><strong>Noch ${restzeitText(frist - nun)} Zeit zum Wählen</strong>
      <span>bis ${fristText(frist)}</span></div>`;
  } else {
    box.classList.add("zu");
    box.innerHTML = `<span class="uhr">🔒</span>
      <div><strong>Die Auswahl ist geschlossen</strong>
      <span>Ab Montag kann wieder gewählt werden.</span></div>`;
  }
}

// Der Personen-Bereich steht in person.js
// Der Admin-Bereich steht in admin.js

// ---------- Navigation über den Teil hinter # in der Adresse ----------

function navigiere() {
  const ziel = location.hash.slice(1); // z. B. "person/noah" oder "admin"
  const { start } = planungsWoche(jetzt());
  document.getElementById("wochen-titel").textContent =
    `Woche vom ${kurzDatum(start)} bis ${kurzDatum(plusTage(start, 6))}`;

  if (ziel.startsWith("person/")) zeigePerson(ziel.split("/")[1]);
  else if (ziel === "admin" || ziel.startsWith("admin/")) zeigeAdmin(ziel.split("/")[1]);
  else zeigeStartseite();
  window.scrollTo(0, 0);
}

document.getElementById("maskottchen").innerHTML = FIGUREN.karotte();
window.addEventListener("hashchange", navigiere);

// Zuerst die eingestellte Frist aus der Datenbank holen, dann die Seite zeigen.
// Ohne Verbindung gilt die Standard-Frist (Samstag 14 Uhr).
ladeFrist()
  .then(frist => { if (frist) FRIST_EINSTELLUNG = frist; })
  .catch(() => {})
  .finally(navigiere);
setInterval(aktualisiereCountdown, 30000); // Countdown alle 30 Sekunden neu berechnen

// Service Worker anmelden (macht die App installierbar und offline startbar)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
