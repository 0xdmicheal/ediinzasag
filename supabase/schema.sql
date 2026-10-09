-- EZ newsroom: team accounts, reader accounts, articles with an approval workflow, tags.
-- Run once in Supabase → SQL Editor. Safe to re-run (uses "if not exists" / "or replace").
--
-- Roles
--   writer  drafts articles and submits them for review; edits only own drafts
--   editor  edits any article, approves, requests changes, publishes, manages tags
--   admin   everything an editor can do, plus changing team roles
--
-- Readers sign up on the public site (/login). Every account gets a row in
-- public.readers; only e-mails an admin added to public.team_invites also get
-- a team profile, so opening public sign-ups never hands out newsroom access.
--
-- Every rule below is enforced by Postgres (row level security + a trigger),
-- so the browser cannot bypass it, whatever the admin UI shows.

-- ---------------------------------------------------------------- types
do $$ begin
  create type public.team_role as enum ('writer', 'editor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.article_status as enum ('draft', 'in_review', 'changes_requested', 'approved', 'published');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  role public.team_role not null default 'writer',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- readers
-- email is empty for readers who signed up with a phone number (SMS code);
-- phone is set for those. Google accounts bring their name along.
create table if not exists public.readers (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  phone text,
  name text not null default '',
  comment_anonymous boolean not null default false,  -- post comments as "Зочин"
  avatar text not null default '',                    -- "<beam|bauhaus>:<seed>", empty = default face
  birth_date date check (birth_date between date '1900-01-01' and current_date),
  gender text check (gender in ('female', 'male', 'unspecified')),
  badge text not null default '',                     -- worn badge id ('' = none), see badge_catalog
  member_no bigint,                                   -- sign-up order; 1..3000 get the founder badge
  created_at timestamptz not null default now()
);

alter table public.readers add column if not exists comment_anonymous boolean not null default false;
alter table public.readers add column if not exists phone text;
alter table public.readers alter column email drop not null;
alter table public.readers add column if not exists avatar text not null default '';
alter table public.readers add column if not exists birth_date date check (birth_date between date '1900-01-01' and current_date);
alter table public.readers add column if not exists gender text check (gender in ('female', 'male', 'unspecified'));
alter table public.readers add column if not exists badge text not null default '';
alter table public.readers add column if not exists member_no bigint;
-- Where the reader lives, chosen by them in their profile (see src/reader/regions.ts). Optional.
alter table public.readers add column if not exists region text check (region ~ '^[a-z-]{2,24}$');

-- Member numbers in sign-up order: new readers take the next one; existing ones are numbered once.
create sequence if not exists public.reader_member_no;
alter table public.readers alter column member_no set default nextval('public.reader_member_no');
update public.readers r set member_no = numbered.n
from (select id, nextval('public.reader_member_no') as n from (select id from public.readers where member_no is null order by created_at) ordered) numbered
where r.id = numbered.id;
create unique index if not exists readers_member_no_idx on public.readers (member_no);

alter table public.readers enable row level security;
drop policy if exists "reader reads self" on public.readers;
create policy "reader reads self" on public.readers for select to authenticated using (id = auth.uid());
drop policy if exists "reader updates self" on public.readers;
create policy "reader updates self" on public.readers for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Readers may change their name, comment setting, picture, birth date, gender and region, nothing else.
revoke update on public.readers from anon, authenticated;
grant update (name, comment_anonymous, avatar, birth_date, gender, badge, region) on public.readers to authenticated;

-- Reader library: stories finished (scrolled to the end) and saved, by slug.
-- Slugs cover both admin articles and the stories built into the site, so
-- there is no foreign key to articles. read_at/saved_at always come from the
-- database clock (readers may only insert a slug), so streaks cannot be backdated.
create table if not exists public.reader_reads (
  reader_id uuid not null default auth.uid() references public.readers (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$' and length(slug) <= 160),
  desk text check (desk in ('mongolia', 'world')),     -- stories only (achievements)
  topic text check (topic ~ '^[a-z0-9-]+$'),
  read_at timestamptz not null default now(),
  primary key (reader_id, slug)
);

alter table public.reader_reads add column if not exists desk text check (desk in ('mongolia', 'world'));
alter table public.reader_reads add column if not exists topic text check (topic ~ '^[a-z0-9-]+$');

create table if not exists public.reader_saves (
  reader_id uuid not null default auth.uid() references public.readers (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$' and length(slug) <= 160),
  saved_at timestamptz not null default now(),
  primary key (reader_id, slug)
);

alter table public.reader_reads enable row level security;
drop policy if exists "reader reads own history" on public.reader_reads;
create policy "reader reads own history" on public.reader_reads for select to authenticated using (reader_id = auth.uid());
drop policy if exists "reader logs own reads" on public.reader_reads;
create policy "reader logs own reads" on public.reader_reads for insert to authenticated with check (reader_id = auth.uid());
revoke insert, update on public.reader_reads from anon, authenticated;
grant insert (slug, desk, topic) on public.reader_reads to authenticated;

alter table public.reader_saves enable row level security;
drop policy if exists "reader reads own saves" on public.reader_saves;
create policy "reader reads own saves" on public.reader_saves for select to authenticated using (reader_id = auth.uid());
drop policy if exists "reader saves" on public.reader_saves;
create policy "reader saves" on public.reader_saves for insert to authenticated with check (reader_id = auth.uid());
drop policy if exists "reader unsaves" on public.reader_saves;
create policy "reader unsaves" on public.reader_saves for delete to authenticated using (reader_id = auth.uid());
revoke insert, update on public.reader_saves from anon, authenticated;
grant insert (slug) on public.reader_saves to authenticated;

-- 🔥 reactions on stories and letters (by key, like the library). Each reader
-- gives at most one per article and sees only their own; the public total is
-- in article_stats, which only the count_fires() trigger writes.
create table if not exists public.article_fires (
  slug text not null check (slug ~ '^[a-z0-9-]+$' and length(slug) <= 160),
  reader_id uuid not null default auth.uid() references public.readers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (slug, reader_id)
);

create table if not exists public.article_stats (
  slug text primary key,
  fire_count integer not null default 0
);

create or replace function public.guard_fire() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.reader_id := auth.uid();
  new.created_at := now();
  return new;
end $$;

drop trigger if exists guard_fire on public.article_fires;
create trigger guard_fire before insert on public.article_fires
  for each row execute function public.guard_fire();

create or replace function public.count_fires() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target text := coalesce(new.slug, old.slug);
begin
  insert into public.article_stats (slug, fire_count)
  values (target, (select count(*) from public.article_fires where slug = target))
  on conflict (slug) do update set fire_count = excluded.fire_count;
  return null;
end $$;

drop trigger if exists count_fires on public.article_fires;
create trigger count_fires after insert or delete on public.article_fires
  for each row execute function public.count_fires();

alter table public.article_fires enable row level security;
drop policy if exists "reader sees own fires" on public.article_fires;
create policy "reader sees own fires" on public.article_fires for select to authenticated using (reader_id = auth.uid());
drop policy if exists "reader fires" on public.article_fires;
create policy "reader fires" on public.article_fires for insert to authenticated with check (reader_id = auth.uid());
drop policy if exists "reader takes fire back" on public.article_fires;
create policy "reader takes fire back" on public.article_fires for delete to authenticated using (reader_id = auth.uid());
revoke insert, update on public.article_fires from anon, authenticated;
grant insert (slug) on public.article_fires to authenticated;

alter table public.article_stats enable row level security;
drop policy if exists "anyone reads stats" on public.article_stats;
create policy "anyone reads stats" on public.article_stats for select using (true);
revoke insert, update, delete on public.article_stats from anon, authenticated;

-- ---------------------------------------------------------------- team invites
-- Admins list an e-mail here (from /admin/team) before inviting it in Supabase.
-- When that account exists, it gets a team profile with this role.
create table if not exists public.team_invites (
  email text primary key check (email = lower(email)),
  name text not null default '',
  role public.team_role not null default 'writer',
  created_at timestamptz not null default now()
);

-- Every new account is a reader; invited e-mails also join the team.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  display_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),   -- Google
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Уншигч ' || right(coalesce(new.phone, ''), 4)
  );
  invite public.team_invites;
begin
  insert into public.readers (id, email, phone, name)
  values (new.id, nullif(new.email, ''), case when coalesce(new.phone, '') = '' then null else '+' || ltrim(new.phone, '+') end, display_name)
  on conflict (id) do nothing;

  -- Staff are invited by e-mail, so phone-only accounts never match.
  select * into invite from public.team_invites where email = lower(new.email);
  if found then
    insert into public.profiles (id, email, name, role)
    values (new.id, new.email, coalesce(nullif(invite.name, ''), display_name), invite.role)
    on conflict (id) do nothing;
    delete from public.team_invites where email = invite.email;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- A confirmed e-mail change (or a new phone) in Auth updates the reader row too.
create or replace function public.sync_reader_contact() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.readers set
    email = nullif(new.email, ''),
    phone = case when coalesce(new.phone, '') = '' then null else '+' || ltrim(new.phone, '+') end
  where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_contact on auth.users;
create trigger on_auth_user_contact after update of email, phone on auth.users
  for each row when (new.email is distinct from old.email or new.phone is distinct from old.phone)
  execute function public.sync_reader_contact();

-- Inviting someone who already has a reader account adds them to the team right away.
create or replace function public.apply_team_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  account auth.users;
begin
  select * into account from auth.users where lower(email) = new.email;
  if not found then return new; end if;
  insert into public.profiles (id, email, name, role)
  values (account.id, account.email, coalesce(nullif(new.name, ''), split_part(account.email, '@', 1)), new.role)
  on conflict (id) do nothing;
  delete from public.team_invites where email = new.email;
  return null;
end $$;

drop trigger if exists apply_team_invite on public.team_invites;
create trigger apply_team_invite after insert on public.team_invites
  for each row execute function public.apply_team_invite();

-- Accounts created before the readers table existed.
insert into public.readers (id, email, phone, name)
select id, nullif(email, ''), case when coalesce(phone, '') = '' then null else '+' || ltrim(phone, '+') end,
       coalesce(nullif(raw_user_meta_data ->> 'name', ''), nullif(raw_user_meta_data ->> 'full_name', ''),
                nullif(split_part(coalesce(email, ''), '@', 1), ''), 'Уншигч ' || right(coalesce(phone, ''), 4))
from auth.users
on conflict (id) do nothing;

create or replace function public.current_team_role() returns public.team_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_editor() returns boolean
language sql stable as $$ select coalesce(public.current_team_role() in ('editor', 'admin'), false) $$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select coalesce(public.current_team_role() = 'admin', false) $$;

alter table public.team_invites enable row level security;
drop policy if exists "admins manage invites" on public.team_invites;
create policy "admins manage invites" on public.team_invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Admins see every reader's name and e-mail (/admin/readers).
drop policy if exists "admins read readers" on public.readers;
create policy "admins read readers" on public.readers for select to authenticated using (public.is_admin());

-- Only admins may change roles; anyone may update their own display name.
create or replace function public.guard_profile_update() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Зөвхөн админ эрх өөрчилнө';
  end if;
  if new.id <> old.id or new.email <> old.email then
    raise exception 'Энэ талбарыг өөрчлөх боломжгүй';
  end if;
  return new;
end $$;

drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

alter table public.profiles enable row level security;
drop policy if exists "team reads profiles" on public.profiles;
create policy "team reads profiles" on public.profiles for select to authenticated
  using (public.current_team_role() is not null);
drop policy if exists "self or admin updates profile" on public.profiles;
create policy "self or admin updates profile" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- tags
create table if not exists public.tags (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  label text not null,
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;
drop policy if exists "anyone reads tags" on public.tags;
create policy "anyone reads tags" on public.tags for select using (true);
drop policy if exists "editors manage tags" on public.tags;
create policy "editors manage tags" on public.tags for all to authenticated using (public.is_editor()) with check (public.is_editor());

insert into public.tags (slug, label) values
  ('policy', 'Мөнгөний бодлого'), ('mining', 'Уул уурхай'), ('fuel', 'Шатахуун'),
  ('markets', 'Зах зээл'), ('energy', 'Эрчим хүч'), ('us', 'АНУ'),
  ('china', 'Хятад'), ('europe', 'Европ')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- articles
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null default '',
  dek text not null default '',
  body text not null default '',          -- HTML from the rich-text editor (sanitised in the app)
  desk text not null default 'mongolia' check (desk in ('mongolia', 'world')),
  tags text[] not null default '{}',
  cover_url text not null default '',
  cover_alt text not null default '',
  sources jsonb not null default '[]',    -- [{ "label": "...", "href": "https://..." }]
  status public.article_status not null default 'draft',
  author_id uuid not null references public.profiles (id) default auth.uid(),
  reviewer_id uuid references public.profiles (id),
  review_note text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_status_idx on public.articles (status, published_at desc);
create index if not exists articles_tags_idx on public.articles using gin (tags);

-- News automation (supabase/functions/news-agent). The agent writes translated
-- briefings with origin 'bot' and no author, straight into review. A team member
-- claims one (claim_article) and becomes its author; it can only be published
-- once a person has written the EZ take and cleared the cover image's rights.
alter table public.articles add column if not exists origin text not null default 'human' check (origin in ('human', 'bot'));
alter table public.articles add column if not exists source_url text;
alter table public.articles add column if not exists bot_notes text not null default '';   -- what the agent wants a person to verify
alter table public.articles add column if not exists take text not null default '';        -- "EZ-ийн дүгнэлт": the newsroom's own analysis
alter table public.articles add column if not exists cover_credit text not null default '';
alter table public.articles add column if not exists cover_rights_ok boolean not null default true;
alter table public.articles add column if not exists claimed_by uuid references public.profiles (id);
alter table public.articles alter column author_id drop not null;   -- null = unclaimed bot article
create unique index if not exists articles_source_url_idx on public.articles (source_url) where source_url is not null;

-- True for requests made with the service_role key (the news agent), never for browsers.
create or replace function public.is_service() returns boolean
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
$$;

-- Words in a text or HTML string, close to countWords() in src/lib/article-html.ts.
create or replace function public.word_count(t text) returns integer
language sql immutable as $$
  select coalesce(array_length(regexp_split_to_array(nullif(btrim(regexp_replace(coalesce(t, ''), '<[^>]+>|&nbsp;', ' ', 'g')), ''), '\s+'), 1), 0)
$$;

create table if not exists public.article_activity (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  action text not null,                   -- created | edited | <new status>
  note text not null default '',
  created_at timestamptz not null default now()
);

-- Workflow rules. Writers: draft ⇄ in_review, changes_requested → draft/in_review,
-- own articles only, and content is frozen while in review. Editors/admins: any step.
create or replace function public.guard_article() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r public.team_role := public.current_team_role();
  claiming boolean := coalesce(current_setting('ez.claiming', true), '') = 'on';
begin
  -- The news agent (service_role) only adds unclaimed briefings to the review queue.
  if public.is_service() then
    if tg_op <> 'INSERT' then
      raise exception 'Агент зөвхөн шинэ мэдээ нэмнэ';
    end if;
    new.origin := 'bot';
    new.status := 'in_review';
    new.author_id := null;
    new.claimed_by := null;
    new.reviewer_id := null;
    new.published_at := null;
    new.take := '';
    new.cover_rights_ok := coalesce(new.cover_url, '') = '';
    return new;
  end if;

  if r is null then
    raise exception 'Багийн гишүүн биш байна';
  end if;

  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.origin := 'human';
    new.source_url := null;
    new.bot_notes := '';
    new.claimed_by := null;
    new.cover_rights_ok := true;
    if new.status not in ('draft', 'in_review') and r = 'writer' then
      raise exception 'Сэтгүүлч зөвхөн ноорог үүсгэнэ';
    end if;
    if new.status = 'published' then new.published_at := coalesce(new.published_at, now()); end if;
    return new;
  end if;

  -- UPDATE
  new.updated_at := now();
  new.origin := old.origin;
  new.source_url := old.source_url;
  new.bot_notes := old.bot_notes;
  if claiming then
    -- claim_article() hands an unclaimed bot article to the caller as a draft.
    new.claimed_by := auth.uid();
    return new;
  end if;
  new.author_id := old.author_id;
  new.claimed_by := old.claimed_by;

  if r = 'writer' then
    if old.author_id is distinct from auth.uid() then
      raise exception 'Өөрийн нийтлэлийг л засна';
    end if;
    if new.status is distinct from old.status and not (
      (old.status in ('draft', 'changes_requested') and new.status = 'in_review') or
      (old.status in ('in_review', 'changes_requested') and new.status = 'draft')
    ) then
      raise exception 'Энэ алхмыг редактор хийнэ';
    end if;
    if old.status in ('in_review', 'approved', 'published') and (
      new.title, new.dek, new.body, new.desk, new.tags, new.cover_url, new.cover_alt, new.sources, new.slug,
      new.take, new.cover_credit, new.cover_rights_ok
    ) is distinct from (
      old.title, old.dek, old.body, old.desk, old.tags, old.cover_url, old.cover_alt, old.sources, old.slug,
      old.take, old.cover_credit, old.cover_rights_ok
    ) then
      raise exception 'Хянагдаж буй нийтлэлийг засах боломжгүй';
    end if;
    new.reviewer_id := old.reviewer_id;
    new.review_note := old.review_note;
    new.published_at := old.published_at;
  else
    if new.status is distinct from old.status and new.status in ('approved', 'changes_requested', 'published') then
      new.reviewer_id := auth.uid();
    end if;
    -- Scheduling: published_at in the future means "goes live then" (readers see it
    -- only from that moment, see the select policy). Anything else publishes now.
    if new.status = 'published' and old.status <> 'published' then
      new.published_at := case when new.published_at > now() then new.published_at else now() end;
    elsif new.status = 'published' then
      if old.published_at > now() and new.published_at is distinct from old.published_at then
        new.published_at := greatest(coalesce(new.published_at, now()), now());   -- move a schedule, never into the past
      else
        new.published_at := old.published_at;                                     -- live articles keep their date
      end if;
    else
      new.published_at := null;
    end if;
  end if;

  -- Raw agent output never goes live: a person adds the EZ take and clears the photo first.
  if new.origin = 'bot' and new.status = 'published' and old.status <> 'published' then
    if public.word_count(new.take) < 40 then
      raise exception 'EZ-ийн дүгнэлт (40+ үг) бичсэний дараа нийтэлнэ';
    end if;
    if coalesce(new.cover_url, '') <> '' and not new.cover_rights_ok then
      raise exception 'Нүүр зургийн эрхийг шалгаж баталгаажуулна уу';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_article on public.articles;
create trigger guard_article before insert or update on public.articles
  for each row execute function public.guard_article();

create or replace function public.log_article() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.article_activity (article_id, actor_id, action, note)
    values (new.id, auth.uid(), 'created', case when new.origin = 'bot' then 'agent' else '' end);
  elsif coalesce(current_setting('ez.claiming', true), '') = 'on' then
    insert into public.article_activity (article_id, actor_id, action) values (new.id, auth.uid(), 'claimed');
  elsif new.status is distinct from old.status then
    insert into public.article_activity (article_id, actor_id, action, note)
    values (new.id, auth.uid(), new.status::text, case when new.status = 'changes_requested' then new.review_note else '' end);
  else
    insert into public.article_activity (article_id, actor_id, action) values (new.id, auth.uid(), 'edited');
  end if;
  return new;
end $$;

drop trigger if exists log_article on public.articles;
create trigger log_article after insert or update on public.articles
  for each row execute function public.log_article();

alter table public.articles enable row level security;

drop policy if exists "public reads published" on public.articles;
create policy "public reads published" on public.articles for select
  using (
    (status = 'published' and published_at <= now()) or author_id = auth.uid() or public.is_editor()
    -- Unclaimed agent briefings are visible to the whole team, so anyone can pick one up.
    or (origin = 'bot' and author_id is null and public.current_team_role() is not null)
  );

-- Takes an unclaimed agent briefing: the caller becomes its author and it returns to draft.
create or replace function public.claim_article(aid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_team_role() is null then
    raise exception 'Багийн гишүүн биш байна';
  end if;
  perform set_config('ez.claiming', 'on', true);
  update public.articles set author_id = auth.uid(), status = 'draft'
  where id = aid and origin = 'bot' and author_id is null and status <> 'published';
  if not found then
    raise exception 'Энэ мэдээг өөр хүн авсан байна';
  end if;
  perform set_config('ez.claiming', '', true);
end $$;

revoke execute on function public.claim_article(uuid) from public, anon;
grant execute on function public.claim_article(uuid) to authenticated;

drop policy if exists "team creates" on public.articles;
create policy "team creates" on public.articles for insert to authenticated
  with check (public.current_team_role() is not null);

drop policy if exists "author or editor updates" on public.articles;
create policy "author or editor updates" on public.articles for update to authenticated
  using (author_id = auth.uid() or public.is_editor())
  with check (author_id = auth.uid() or public.is_editor());

drop policy if exists "admin or own draft deletes" on public.articles;
create policy "admin or own draft deletes" on public.articles for delete to authenticated
  using (public.is_admin() or (author_id = auth.uid() and status = 'draft'));

alter table public.article_activity enable row level security;
drop policy if exists "team reads activity" on public.article_activity;
create policy "team reads activity" on public.article_activity for select to authenticated
  using (public.current_team_role() is not null);

-- ---------------------------------------------------------------- comments
-- Readers comment on stories and letters (by key, like the library). Anyone can
-- read them; the author edits or deletes their own; editors and admins delete any.
-- Name and dates are set here, not by the browser. A comment is anonymous
-- ("Зочин") when the reader turned that on in their profile
-- (readers.comment_anonymous): then no name is stored on it, and since reader_id is not readable
-- by the public (column grants below), nobody can link it to its author.
-- The row still records reader_id, so abuse can be traced by the project owner.
create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9-]+$' and length(slug) <= 160),
  reader_id uuid not null default auth.uid() references public.readers (id) on delete cascade,
  author_name text not null default '',
  anonymous boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

alter table public.article_comments add column if not exists anonymous boolean not null default false;
alter table public.article_comments add column if not exists author_avatar text not null default '';
alter table public.article_comments add column if not exists author_badge text not null default '';
-- Like total (see comment likes below). Earlier versions had thumbs up/down.
alter table public.article_comments add column if not exists like_count integer not null default 0;

create index if not exists article_comments_slug_idx on public.article_comments (slug, created_at);

create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.article_comments
        where reader_id = auth.uid() and created_at > now() - interval '1 minute') >= 5 then
      raise exception 'Хэт олон сэтгэгдэл. Түр хүлээгээд дахин бичнэ үү';
    end if;
    new.reader_id := auth.uid();
    new.anonymous := coalesce((select comment_anonymous from public.readers where id = auth.uid()), false);
    new.author_name := case when new.anonymous then ''
                            else coalesce((select name from public.readers where id = auth.uid()), '') end;
    new.author_avatar := case when new.anonymous then ''
                              else coalesce((select avatar from public.readers where id = auth.uid()), '') end;
    new.author_badge := case when new.anonymous then ''
                             else coalesce((select badge from public.readers where id = auth.uid()), '') end;
    new.like_count := 0;
    new.created_at := now();
    new.edited_at := null;
  else
    new.id := old.id;
    new.slug := old.slug;
    new.reader_id := old.reader_id;
    new.author_name := old.author_name;
    new.author_avatar := old.author_avatar;
    new.author_badge := old.author_badge;
    new.anonymous := old.anonymous;
    new.created_at := old.created_at;
    new.edited_at := case when new.body is distinct from old.body then now() else old.edited_at end;
    -- like_count: readers cannot write it (no column grant); count_likes() does.
  end if;
  return new;
end $$;

drop trigger if exists guard_comment on public.article_comments;
create trigger guard_comment before insert or update on public.article_comments
  for each row execute function public.guard_comment();

-- Renaming yourself, or a new picture, updates your named comments too.
create or replace function public.sync_comment_names() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name or new.avatar is distinct from old.avatar or new.badge is distinct from old.badge then
    update public.article_comments set author_name = new.name, author_avatar = new.avatar, author_badge = new.badge
    where reader_id = new.id and not anonymous;
  end if;
  return new;
end $$;

drop trigger if exists sync_comment_names on public.readers;
create trigger sync_comment_names after update of name, avatar, badge on public.readers
  for each row execute function public.sync_comment_names();

alter table public.article_comments enable row level security;
drop policy if exists "anyone reads comments" on public.article_comments;
create policy "anyone reads comments" on public.article_comments for select using (true);
drop policy if exists "readers comment" on public.article_comments;
create policy "readers comment" on public.article_comments for insert to authenticated
  with check (reader_id = auth.uid());
drop policy if exists "author edits comment" on public.article_comments;
create policy "author edits comment" on public.article_comments for update to authenticated
  using (reader_id = auth.uid()) with check (reader_id = auth.uid());
drop policy if exists "author or editor deletes comment" on public.article_comments;
create policy "author or editor deletes comment" on public.article_comments for delete to authenticated
  using (reader_id = auth.uid() or public.is_editor());
-- Who wrote a comment (reader_id) is not readable; readers learn which comments
-- are their own through my_comment_ids() instead.
revoke select, insert, update on public.article_comments from anon, authenticated;
grant select (id, slug, author_name, author_avatar, author_badge, anonymous, body, created_at, edited_at, like_count)
  on public.article_comments to anon, authenticated;
grant insert (slug, body) on public.article_comments to authenticated;
grant update (body) on public.article_comments to authenticated;

create or replace function public.my_comment_ids(target_slug text) returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.article_comments where slug = target_slug and reader_id = auth.uid()
$$;
revoke execute on function public.my_comment_ids(text) from public, anon;
grant execute on function public.my_comment_ids(text) to authenticated;

-- ---------------------------------------------------------------- comment likes
-- One like per reader per comment, never on your own. Each reader sees only
-- their own likes; the total lives on the comment (like_count), which only the
-- count_likes() trigger can change.
create table if not exists public.comment_likes (
  comment_id uuid not null references public.article_comments (id) on delete cascade,
  reader_id uuid not null default auth.uid() references public.readers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, reader_id)
);

create or replace function public.guard_like() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.reader_id := auth.uid();
  new.created_at := now();
  if exists (select 1 from public.article_comments where id = new.comment_id and reader_id = auth.uid()) then
    raise exception 'Өөрийн сэтгэгдлийг тэмдэглэх боломжгүй';
  end if;
  return new;
end $$;

drop trigger if exists guard_like on public.comment_likes;
create trigger guard_like before insert on public.comment_likes
  for each row execute function public.guard_like();

create or replace function public.count_likes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.comment_id, old.comment_id);
begin
  update public.article_comments
  set like_count = (select count(*) from public.comment_likes where comment_id = target)
  where id = target;
  return null;
end $$;

drop trigger if exists count_likes on public.comment_likes;
create trigger count_likes after insert or delete on public.comment_likes
  for each row execute function public.count_likes();

alter table public.comment_likes enable row level security;
drop policy if exists "reader sees own likes" on public.comment_likes;
create policy "reader sees own likes" on public.comment_likes for select to authenticated using (reader_id = auth.uid());
drop policy if exists "reader likes" on public.comment_likes;
create policy "reader likes" on public.comment_likes for insert to authenticated with check (reader_id = auth.uid());
drop policy if exists "reader unlikes" on public.comment_likes;
create policy "reader unlikes" on public.comment_likes for delete to authenticated using (reader_id = auth.uid());
revoke insert, update on public.comment_likes from anon, authenticated;
grant insert (comment_id) on public.comment_likes to authenticated;

-- Upgrade from the thumbs up/down version: keep the thumbs up as likes.
do $$ begin
  if to_regclass('public.comment_votes') is not null then
    -- guard_like() would replace reader_id with the SQL editor's (empty) user.
    alter table public.comment_likes disable trigger guard_like;
    insert into public.comment_likes (comment_id, reader_id, created_at)
    select comment_id, reader_id, created_at from public.comment_votes where value = 1
    on conflict do nothing;
    alter table public.comment_likes enable trigger guard_like;
    drop table public.comment_votes;
    update public.article_comments c
    set like_count = (select count(*) from public.comment_likes l where l.comment_id = c.id);
  end if;
end $$;
alter table public.article_comments drop column if exists up_count;
alter table public.article_comments drop column if exists down_count;
drop function if exists public.guard_vote();
drop function if exists public.count_votes();

-- ---------------------------------------------------------------- badges
-- Readers trade points for badges and wear one next to their name. Points are
-- counted here with the same rules as the site (src/reader/achievements.ts):
-- 10 per finished story/letter, 50 per achievement. "founder" is free for
-- member_no 1..3000. Keep ids and costs in step with src/reader/badges.tsx.
create table if not exists public.badge_catalog (
  id text primary key,
  cost integer           -- null: not for sale (founder)
);

insert into public.badge_catalog (id, cost) values
  ('founder', null), ('tugrik', 50), ('copper', 150), ('candle', 250), ('bull', 400),
  ('bear', 400), ('gold', 700), ('eurobond', 1000), ('economist', 1500)
on conflict (id) do update set cost = excluded.cost;

alter table public.badge_catalog enable row level security;
drop policy if exists "anyone reads badges" on public.badge_catalog;
create policy "anyone reads badges" on public.badge_catalog for select using (true);

create table if not exists public.reader_badges (
  reader_id uuid not null references public.readers (id) on delete cascade,
  badge_id text not null references public.badge_catalog (id),
  cost integer not null,
  acquired_at timestamptz not null default now(),
  primary key (reader_id, badge_id)
);

alter table public.reader_badges enable row level security;
drop policy if exists "reader sees own badges" on public.reader_badges;
create policy "reader sees own badges" on public.reader_badges for select to authenticated using (reader_id = auth.uid());
-- No insert/update/delete for readers: badges are only bought through buy_badge().
revoke insert, update, delete on public.reader_badges from anon, authenticated;

-- Points earned, mirroring achievements.ts. Streak days use Ulaanbaatar time.
create or replace function public.reader_points(rid uuid) returns integer
language sql stable security definer set search_path = public as $$
  with r as (
    select desk, topic, (read_at at time zone 'Asia/Ulaanbaatar')::date as d from public.reader_reads where reader_id = rid
  ),
  counts as (select count(*) as n, count(distinct desk) as desks, count(distinct topic) as topics from r),
  saves as (select count(*) as n from public.reader_saves where reader_id = rid),
  days as (select distinct d from r),
  runs as (select d - (row_number() over (order by d))::int as run from days),
  best as (select coalesce(max(c), 0) as b from (select count(*) as c from runs group by run) x)
  select (counts.n * 10 + 50 * (
      (counts.n >= 1)::int + (counts.n >= 10)::int + (counts.n >= 50)::int +
      (counts.desks >= 2)::int + (counts.topics >= 5)::int + (saves.n >= 5)::int +
      (best.b >= 3)::int + (best.b >= 7)::int
    ))::int
  from counts, saves, best
$$;

create or replace function public.buy_badge(bid text) returns void
language plpgsql security definer set search_path = public as $$
declare
  price integer;
  spent integer;
begin
  if auth.uid() is null then raise exception 'Нэвтэрнэ үү'; end if;
  -- One purchase at a time per reader, so points cannot be spent twice.
  perform 1 from public.readers where id = auth.uid() for update;
  select cost into price from public.badge_catalog where id = bid and cost is not null;
  if not found then raise exception 'Энэ тэмдгийг оноогоор авах боломжгүй'; end if;
  if exists (select 1 from public.reader_badges where reader_id = auth.uid() and badge_id = bid) then
    raise exception 'Энэ тэмдэг танд аль хэдийн бий';
  end if;
  select coalesce(sum(cost), 0) into spent from public.reader_badges where reader_id = auth.uid();
  if public.reader_points(auth.uid()) - spent < price then raise exception 'Оноо хүрэлцэхгүй байна'; end if;
  insert into public.reader_badges (reader_id, badge_id, cost) values (auth.uid(), bid, price);
end $$;

revoke execute on function public.buy_badge(text) from public, anon;
grant execute on function public.buy_badge(text) to authenticated;
revoke execute on function public.reader_points(uuid) from public, anon, authenticated;

-- Only an owned badge (or founder, for the first 3,000) can be worn.
create or replace function public.guard_reader_badge() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- A member number, once given, never changes.
  if old.member_no is not null then new.member_no := old.member_no; end if;
  if new.badge is distinct from old.badge and new.badge <> '' then
    if not (
      (new.badge = 'founder' and old.member_no between 1 and 3000)
      or exists (select 1 from public.reader_badges where reader_id = new.id and badge_id = new.badge)
    ) then
      raise exception 'Энэ тэмдэг танд байхгүй байна';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_reader_badge on public.readers;
create trigger guard_reader_badge before update on public.readers
  for each row execute function public.guard_reader_badge();

-- ---------------------------------------------------------------- news agent runs
-- One row per run of supabase/functions/news-agent (daily cron or "Мэдээ татах").
create table if not exists public.news_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text not null default 'cron' check (trigger in ('cron', 'manual')),
  scanned integer not null default 0,     -- feed items looked at
  created integer not null default 0,     -- briefings added to review
  error text not null default ''
);
-- What each run did: feeds read/failed, stories seen, picks with priority, failures (shown on the board).
alter table public.news_runs add column if not exists details jsonb not null default '{}';

alter table public.news_runs enable row level security;
drop policy if exists "team reads runs" on public.news_runs;
create policy "team reads runs" on public.news_runs for select to authenticated
  using (public.current_team_role() is not null);

-- ---------------------------------------------------------------- admin insights
-- Everything /admin/insights shows, computed here so personal details (age,
-- region, gender) only leave the database as counts, and only for admins.
create or replace function public.admin_insights() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Зөвхөн админ харна';
  end if;

  with
  r as (
    select id, created_at, gender, region,
           case when birth_date is null then null else extract(year from age(birth_date))::int end as years
    from public.readers
    where id not in (select id from public.profiles)
  ),
  ages as (
    select bucket, count(*) as n from (
      select case
        when years is null then 'unknown'
        when years < 18 then '13-17'
        when years < 25 then '18-24'
        when years < 35 then '25-34'
        when years < 45 then '35-44'
        when years < 55 then '45-54'
        else '55+' end as bucket
      from r
    ) b group by bucket
  ),
  weeks as (
    select to_char(w, 'YYYY-MM-DD') as week,
           (select count(*) from r where r.created_at >= w and r.created_at < w + interval '7 days') as n
    from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '7 days') w
  ),
  days as (
    select to_char(d, 'YYYY-MM-DD') as day,
           (select count(*) from public.reader_reads rr where rr.read_at >= d and rr.read_at < d + interval '1 day') as reads,
           (select count(distinct rr.reader_id) from public.reader_reads rr where rr.read_at >= d and rr.read_at < d + interval '1 day') as readers
    from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
  ),
  authors as (
    select p.id, p.name, p.role,
      count(a.id) filter (where a.status = 'draft') as drafts,
      count(a.id) filter (where a.status in ('in_review', 'changes_requested', 'approved')) as in_progress,
      count(a.id) filter (where a.status = 'changes_requested') as changes_requested,
      count(a.id) filter (where a.status = 'published') as published,
      count(a.id) filter (where a.status = 'published' and a.published_at between now() - interval '30 days' and now()) as published_30d,
      count(a.id) filter (where a.origin = 'bot') as claimed,
      round(avg(extract(epoch from a.published_at - a.created_at) / 3600) filter (where a.status = 'published'))::int as hours_to_publish,
      coalesce(sum((select count(*) from public.reader_reads rr where rr.slug = a.slug)) filter (where a.status = 'published'), 0) as reads,
      coalesce(sum((select fire_count from public.article_stats s where s.slug = a.slug)) filter (where a.status = 'published'), 0) as fires,
      (select max(created_at) from public.article_activity aa where aa.actor_id = p.id) as last_active,
      (select count(*) from public.article_activity aa
        where aa.actor_id = p.id and aa.action in ('approved', 'changes_requested', 'published')) as reviews
    from public.profiles p
    left join public.articles a on a.author_id = p.id
    group by p.id, p.name, p.role
  )
  select jsonb_build_object(
    'readers', jsonb_build_object(
      'total', (select count(*) from r),
      'new7', (select count(*) from r where created_at > now() - interval '7 days'),
      'new30', (select count(*) from r where created_at > now() - interval '30 days'),
      'active30', (select count(distinct reader_id) from public.reader_reads where read_at > now() - interval '30 days'),
      'ages', coalesce((select jsonb_object_agg(bucket, n) from ages), '{}'),
      'genders', coalesce((select jsonb_object_agg(coalesce(gender, 'unknown'), n) from (select gender, count(*) n from r group by gender) g), '{}'),
      'regions', coalesce((select jsonb_object_agg(coalesce(region, 'unknown'), n) from (select region, count(*) n from r group by region) g), '{}'),
      'weeks', coalesce((select jsonb_agg(jsonb_build_object('week', week, 'n', n) order by week) from weeks), '[]')
    ),
    'reading', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'reads', reads, 'readers', readers) order by day) from days), '[]'),
    'authors', coalesce((select jsonb_agg(to_jsonb(authors) order by published_30d desc, published desc) from authors), '[]'),
    'agent', jsonb_build_object(
      'waiting', (select count(*) from public.articles where origin = 'bot' and author_id is null and status <> 'published'),
      'claimed', (select count(*) from public.articles where origin = 'bot' and author_id is not null and status <> 'published'),
      'published', (select count(*) from public.articles where origin = 'bot' and status = 'published'),
      'runs', coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc)
                        from (select * from public.news_runs order by started_at desc limit 10) x), '[]')
    )
  ) into result;
  return result;
end $$;

revoke execute on function public.admin_insights() from public, anon;
grant execute on function public.admin_insights() to authenticated;

-- ---------------------------------------------------------------- cover images
insert into storage.buckets (id, name, public) values ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists "anyone reads covers" on storage.objects;
create policy "anyone reads covers" on storage.objects for select using (bucket_id = 'covers');
drop policy if exists "team uploads covers" on storage.objects;
create policy "team uploads covers" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and public.current_team_role() is not null);

-- ---------------------------------------------------------------- first admin
-- Before inviting yourself, add your e-mail as the first admin (or run this
-- after you already have an account; it then applies immediately):
--   insert into public.team_invites (email, role) values ('you@example.com', 'admin');

-- ---------------------------------------------------------------- daily news agent
-- After deploying supabase/functions/news-agent (see ADMIN.md), schedule it once.
-- Database → Extensions: enable pg_cron and pg_net, then run (fill in the two values):
--   select cron.schedule('ez-news-agent', '0 0 * * *', $cron$
--     select net.http_post(
--       url := 'https://<project-ref>.supabase.co/functions/v1/news-agent',
--       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<NEWS_CRON_SECRET>'),
--       body := '{"trigger":"cron"}'::jsonb,
--       timeout_milliseconds := 300000)
--   $cron$);
-- 00:00 UTC is 08:00 in Ulaanbaatar. Remove with: select cron.unschedule('ez-news-agent');
