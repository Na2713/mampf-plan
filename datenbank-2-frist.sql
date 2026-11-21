-- =====================================================================
-- Mampf-Plan: Ergänzung 2 – einstellbare Frist
-- Wird EINMAL im Supabase "SQL Editor" ausgeführt (nach datenbank.sql).
-- =====================================================================

-- Allgemeine Einstellungen (für alle lesbar, ändern nur mit PIN)
create table public.einstellungen (
  schluessel text primary key,
  wert jsonb not null
);
alter table public.einstellungen enable row level security;
grant select on public.einstellungen to anon, authenticated;
create policy "alle lesen" on public.einstellungen for select using (true);

-- Frist: Wochentag (0 = Montag ... 6 = Sonntag) der Woche VOR der geplanten Woche + Uhrzeit
insert into public.einstellungen values ('frist', '{"tag": 5, "stunde": 14, "minute": 0}');

-- Bis wann darf für die Woche, die am Montag p_woche beginnt, gewählt werden?
create or replace function public.frist_fuer(p_woche date) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select ((p_woche - 7 + (wert->>'tag')::int)::timestamp
             + make_interval(hours => (wert->>'stunde')::int, mins => (wert->>'minute')::int))
            at time zone 'Europe/Berlin'
       from einstellungen where schluessel = 'frist'),
    ((p_woche - 2)::timestamp + interval '14 hours') at time zone 'Europe/Berlin'  -- Notfall: Samstag 14 Uhr
  );
$$;

-- Die Wahl-Regeln nutzen ab jetzt die eingestellte Frist
drop policy "waehlen bis frist" on public.auswahl;
drop policy "abwaehlen bis frist" on public.auswahl;

create policy "waehlen bis frist" on public.auswahl for insert
  with check (art in ('wahl', 'wunsch') and person <> 'alle' and now() < public.frist_fuer(woche));

create policy "abwaehlen bis frist" on public.auswahl for delete
  using (art in ('wahl', 'wunsch') and now() < public.frist_fuer(woche));

-- Frist ändern (nur mit PIN)
create or replace function public.admin_frist_speichern(pin text, p_tag int, p_stunde int, p_minute int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pruefe_pin(pin);
  if p_tag not between 0 and 6 or p_stunde not between 0 and 23 or p_minute not between 0 and 59 then
    raise exception 'Ungültige Frist';
  end if;
  insert into einstellungen values ('frist', jsonb_build_object('tag', p_tag, 'stunde', p_stunde, 'minute', p_minute))
  on conflict (schluessel) do update set wert = excluded.wert;
end $$;

grant execute on function public.frist_fuer(date), public.admin_frist_speichern(text, int, int, int)
to anon, authenticated;
