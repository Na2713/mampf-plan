# 🥕 Mampf-Plan

Der Familien-Essensplan für eine Woche: Jeder sucht sein Essen aus, die Küchenchefin entscheidet.

- Läuft im Browser und kann auf den Startbildschirm gelegt werden (PWA).
- Daten liegen in einer Supabase-Datenbank (`config.js` enthält nur den öffentlichen Schlüssel).
- Aufbau der Datenbank: `datenbank.sql`, danach `datenbank-2-frist.sql` und `datenbank-3-freitext.sql`.
- Regeln (wer isst wann): `regeln.js`, geprüft mit `tests.html`.
