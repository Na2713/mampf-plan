-- =====================================================================
-- Mampf-Plan: Datenbank-Aufbau
-- Wird EINMAL im Supabase "SQL Editor" ausgeführt.
-- =====================================================================

-- ---------- 1) Tabellen ----------

-- Alle Speisen, die du im Admin-Bereich einträgst
create table public.speisen (
  id bigint generated always as identity primary key,
  name text not null,
  emoji text not null default '🍽️',
  -- Zu welcher Mahlzeit gehört die Speise?
  kategorie text not null check (kategorie in
    ('fruehstueck', 'snack', 'mittag_frisch', 'mittag_mealprep', 'abend_extra')),
  portionen int check (portionen >= 0),          -- leer = unbegrenzt
  nicht_moeglich boolean not null default false, -- dein Häkchen "nicht möglich"
  geloescht boolean not null default false,      -- gelöschte Speisen bleiben für alte Pläne erhalten
  erstellt timestamptz not null default now()
);

-- Eine Zeile pro geplanter Woche (start = Montag der Woche)
create table public.wochen (
  start date primary key,
  ausnahmen jsonb not null default '{}',  -- z. B. Ferien, Papa zu Hause
  abgeschlossen boolean not null default false
);

-- Jede Wahl, jeder Wunsch und jede Festlegung durch dich
create table public.auswahl (
  id bigint generated always as identity primary key,
  woche date not null,                               -- Montag der Woche
  tag int not null check (tag between 0 and 6),      -- 0 = Montag ... 6 = Sonntag
  mahlzeit text not null check (mahlzeit in ('fruehstueck', 'snack', 'mittag', 'abend_extra')),
  person text not null check (person in ('mama', 'papa', 'noah', 'amelie', 'alle')),
  speise_id bigint not null references public.speisen(id) on delete restrict,
  art text not null check (art in ('wahl', 'wunsch', 'festgelegt')),
  erstellt timestamptz not null default now()
);
create index auswahl_woche on public.auswahl (woche);

-- Geheime Werte (die Admin-PIN). Von außen NICHT lesbar.
create table public.geheimnisse (
  schluessel text primary key,
  wert text not null
);
-- Die echte PIN steht NUR in der Datenbank. Beim Neu-Einrichten hier eine eigene PIN eintragen:
insert into public.geheimnisse values ('admin_pin', 'HIER-DEINE-PIN');


-- ---------- 2) Zugriffsregeln (Row Level Security) ----------
-- Die App darf alles LESEN, aber selbst nur Wahlen/Wünsche eintragen oder entfernen,
-- und das nur bis Samstag 14 Uhr vor der jeweiligen Woche.
-- Alles andere geht nur über die Admin-Funktionen unten (mit PIN).

alter table public.speisen enable row level security;
alter table public.wochen enable row level security;
alter table public.auswahl enable row level security;
alter table public.geheimnisse enable row level security;

revoke all on public.geheimnisse from anon, authenticated;
grant select on public.speisen, public.wochen, public.auswahl to anon, authenticated;
grant insert, delete on public.auswahl to anon, authenticated;

create policy "alle lesen" on public.speisen for select using (true);
create policy "alle lesen" on public.wochen for select using (true);
create policy "alle lesen" on public.auswahl for select using (true);

create policy "waehlen bis frist" on public.auswahl for insert
  with check (
    art in ('wahl', 'wunsch') and person <> 'alle'
    and now() < ((woche - 2)::timestamp + interval '14 hours') at time zone 'Europe/Berlin'
  );

create policy "abwaehlen bis frist" on public.auswahl for delete
  using (
    art in ('wahl', 'wunsch')
    and now() < ((woche - 2)::timestamp + interval '14 hours') at time zone 'Europe/Berlin'
  );


-- ---------- 3) Portionen automatisch zählen ----------
-- Wird eine Speise gewählt oder festgelegt, sinkt ihre Portionenzahl um 1.
-- Wird die Wahl entfernt, steigt sie wieder. Wünsche zählen nicht.
-- Bei 0 Portionen wird die Speise in der Auswahl nicht mehr angezeigt.

create or replace function public.portionen_zaehlen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.art <> 'wunsch' then
      update speisen set portionen = portionen - 1
        where id = new.speise_id and portionen is not null;
      if exists (select 1 from speisen where id = new.speise_id and portionen < 0) then
        raise exception 'Leider ist keine Portion mehr übrig.';
      end if;
    end if;
    return new;
  else -- DELETE
    if old.art <> 'wunsch' then
      update speisen set portionen = portionen + 1
        where id = old.speise_id and portionen is not null;
    end if;
    return old;
  end if;
end $$;

create trigger auswahl_portionen
  before insert or delete on public.auswahl
  for each row execute function public.portionen_zaehlen();


-- ---------- 4) Admin-Funktionen (funktionieren nur mit der richtigen PIN) ----------

create or replace function public.admin_pin_ok(pin text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from geheimnisse where schluessel = 'admin_pin' and wert = pin);
$$;

create or replace function public.pruefe_pin(pin text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not admin_pin_ok(pin) then
    raise exception 'Falsche PIN';
  end if;
end $$;

-- Speise neu anlegen (ohne id) oder ändern (mit id)
create or replace function public.admin_speise_speichern(pin text, daten jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  neue_id bigint;
begin
  perform pruefe_pin(pin);
  if daten->>'id' is not null then
    update speisen set
      name           = coalesce(daten->>'name', name),
      emoji          = coalesce(daten->>'emoji', emoji),
      kategorie      = coalesce(daten->>'kategorie', kategorie),
      portionen      = case when daten ? 'portionen' then (daten->>'portionen')::int else portionen end,
      nicht_moeglich = coalesce((daten->>'nicht_moeglich')::boolean, nicht_moeglich),
      geloescht      = coalesce((daten->>'geloescht')::boolean, geloescht)
    where id = (daten->>'id')::bigint
    returning id into neue_id;
  else
    insert into speisen (name, emoji, kategorie, portionen)
    values (daten->>'name', coalesce(daten->>'emoji', '🍽️'), daten->>'kategorie', (daten->>'portionen')::int)
    returning id into neue_id;
  end if;
  return neue_id;
end $$;

-- Etwas für eine Person (oder 'alle') festlegen
create or replace function public.admin_auswahl_setzen(
  pin text, p_woche date, p_tag int, p_mahlzeit text, p_person text, p_speise_id bigint,
  p_art text default 'festgelegt'
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  neue_id bigint;
begin
  perform pruefe_pin(pin);
  insert into auswahl (woche, tag, mahlzeit, person, speise_id, art)
  values (p_woche, p_tag, p_mahlzeit, p_person, p_speise_id, p_art)
  returning id into neue_id;
  return neue_id;
end $$;

create or replace function public.admin_auswahl_loeschen(pin text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pruefe_pin(pin);
  delete from auswahl where id = p_id;
end $$;

-- Ausnahmen / Abschluss einer Woche speichern
create or replace function public.admin_woche_speichern(
  pin text, p_start date, p_ausnahmen jsonb, p_abgeschlossen boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pruefe_pin(pin);
  insert into wochen (start, ausnahmen, abgeschlossen)
  values (p_start, coalesce(p_ausnahmen, '{}'), coalesce(p_abgeschlossen, false))
  on conflict (start) do update
    set ausnahmen = excluded.ausnahmen, abgeschlossen = excluded.abgeschlossen;
end $$;

grant execute on function
  public.admin_pin_ok(text),
  public.admin_speise_speichern(text, jsonb),
  public.admin_auswahl_setzen(text, date, int, text, text, bigint, text),
  public.admin_auswahl_loeschen(text, bigint),
  public.admin_woche_speichern(text, date, jsonb, boolean)
to anon, authenticated;


-- ---------- 5) Startdaten: die Abend-Extras ----------

insert into public.speisen (name, emoji, kategorie) values
  ('Linsensuppe', '🥣', 'abend_extra'),
  ('Bohnensuppe', '🫘', 'abend_extra'),
  ('Ofenkäse', '🧀', 'abend_extra'),
  ('Würstchen', '🌭', 'abend_extra'),
  ('Tomate/Mozzarella', '🍅', 'abend_extra');
