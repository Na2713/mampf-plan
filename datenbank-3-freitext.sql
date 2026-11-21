-- =====================================================================
-- Mampf-Plan: Ergänzung 3 – freie Wünsche (Freitext)
-- Wird EINMAL im Supabase "SQL Editor" ausgeführt (nach datenbank-2-frist.sql).
-- Bestehende Daten bleiben erhalten: es wird nur eine Spalte ergänzt.
-- =====================================================================

-- Neue Spalte für frei eingetippte Wünsche (max. 60 Zeichen)
alter table public.auswahl add column freitext text check (char_length(freitext) between 1 and 60);

-- Ein Eintrag hat jetzt ENTWEDER eine Speise aus der Liste ODER einen Freitext
alter table public.auswahl alter column speise_id drop not null;
alter table public.auswahl add constraint auswahl_speise_oder_text
  check ((speise_id is not null) <> (freitext is not null));

-- Freitext nur bei Wünschen und bei der Entscheidung der Küchenchefin für alle
alter table public.auswahl add constraint auswahl_text_nur_wunsch
  check (freitext is null or art = 'wunsch' or (art = 'festgelegt' and person = 'alle'));

-- Admin-Funktion zum Festlegen kann jetzt auch einen Freitext übernehmen
drop function public.admin_auswahl_setzen(text, date, int, text, text, bigint, text);

create function public.admin_auswahl_setzen(
  pin text, p_woche date, p_tag int, p_mahlzeit text, p_person text, p_speise_id bigint,
  p_art text default 'festgelegt', p_freitext text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  neue_id bigint;
begin
  perform pruefe_pin(pin);
  insert into auswahl (woche, tag, mahlzeit, person, speise_id, art, freitext)
  values (p_woche, p_tag, p_mahlzeit, p_person, p_speise_id, p_art, nullif(trim(p_freitext), ''))
  returning id into neue_id;
  return neue_id;
end $$;

grant execute on function public.admin_auswahl_setzen(text, date, int, text, text, bigint, text, text)
to anon, authenticated;
