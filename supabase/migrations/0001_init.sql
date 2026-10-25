-- Buyer Intelligence — initial schema (domains: users, briefs, locations, properties, marketData,
-- valuations, inspections, legalChecks, documents, reports, experts, leads, billing, audit).
-- RLS is ON everywhere. Anonymous/public roles get NO access; the Next.js server uses the service role,
-- end users (when auth is enabled) only see rows they own.
-- Requires the PostGIS extension for geography columns.

create extension if not exists "pgcrypto";
create extension if not exists postgis;

create type data_kind as enum ('FACT', 'INFERENCE', 'ESTIMATE');
create type severity as enum ('green', 'yellow', 'red');
create type legal_status as enum ('green', 'yellow', 'red', 'unknown');

-- ---- locations: Country → Region → City → District → Neighborhood → Street ----
create table locations (
  id text primary key,
  parent_id text references locations(id),
  level text not null check (level in ('country','region','city','district','neighborhood','street')),
  names jsonb not null,               -- {"uk": "...", "en": "..."}
  center geography(point, 4326),
  config jsonb not null default '{}'  -- CityAdapter overrides (benchmarks, sources)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  lang text not null default 'uk',
  created_at timestamptz not null default now()
);

create table consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  email text,
  purpose text not null,              -- order | brief | ai_processing | marketing
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  city_id text references locations(id),
  answers jsonb not null,
  created_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  class text not null check (class in ('residential','commercial','land')),
  subtype text not null,
  city_id text not null references locations(id),
  district_id text references locations(id),
  address text,
  coords geography(point, 4326),
  attrs jsonb not null,               -- canonical Property fields (typed per class adapter)
  source_url text,
  created_at timestamptz not null default now()
);

-- Every important value carries provenance.
create table property_facts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  field text not null,
  kind data_kind not null,
  value jsonb not null,
  raw jsonb,
  source_id text not null,
  fetched_at timestamptz not null,
  confidence real not null check (confidence between 0 and 1),
  method_name text,
  method_version text
);

create table market_comps (
  id uuid primary key default gen_random_uuid(),
  city_id text not null references locations(id),
  district_id text references locations(id),
  attrs jsonb not null,
  ask_price numeric not null,
  area_sqm numeric not null,
  observed_at timestamptz not null,
  source_id text not null,
  is_demo boolean not null default false
);
create index on market_comps (city_id, observed_at desc);

create table valuations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  result jsonb not null,              -- ValuationResult (range, confidence components, comps used)
  method_name text not null,
  method_version text not null,
  created_at timestamptz not null default now()
);

create table experts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- inspector | lawyer | surveyor | electrician | engineer | appraiser ...
  name text not null,
  city_ids text[] not null default '{}',
  licensed boolean not null default false,
  license_ref text
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  storage_path text not null,          -- private bucket
  mime text not null,
  ai_processing_consent boolean not null default false,  -- AI extraction only when true
  created_at timestamptz not null default now()
);

create table legal_checks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  check_id text not null,
  status legal_status not null default 'unknown',
  kind data_kind,
  source_id text not null,
  note jsonb,
  extract_document_id uuid references documents(id),
  reviewed_by uuid references experts(id), -- a lawyer must review before status leaves 'unknown'
  checked_at timestamptz
);

create table inspections (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  expert_id uuid references experts(id),
  checklist_id text not null,
  scheduled_at timestamptz,
  completed_at timestamptz
);

create table inspection_issues (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  section_id text not null,
  severity severity not null,
  title jsonb not null,
  explanation jsonb not null,
  urgency text not null,
  repair_low numeric, repair_high numeric, repair_currency text,
  repair_assumption jsonb, repair_source_id text, repair_confidence real,
  specialist text,
  negotiation text,
  photo_paths text[] not null default '{}'   -- private storage paths, served via signed URLs only
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  stage text not null check (stage in ('preliminary','complete')),
  data jsonb not null,                -- ReportData snapshot (reproducible, versioned)
  methodology_version text not null,
  created_at timestamptz not null default now()
);

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references briefs(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Leads/orders from the public site (written only by the server with the service role).
create table leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                  -- brief | inspection | legal | consult | digital
  lang text not null,
  name text, email text not null, phone text, note text,
  payload jsonb not null default '{}',
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  user_id uuid references profiles(id),
  package_id text not null,
  price_amount numeric, price_currency text,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,                -- e.g. registry.extract.view, document.signed_url
  subject text,
  meta jsonb not null default '{}'
);

-- ---- Row Level Security ----
alter table locations enable row level security;
alter table profiles enable row level security;
alter table consents enable row level security;
alter table briefs enable row level security;
alter table properties enable row level security;
alter table property_facts enable row level security;
alter table market_comps enable row level security;
alter table valuations enable row level security;
alter table legal_checks enable row level security;
alter table experts enable row level security;
alter table inspections enable row level security;
alter table inspection_issues enable row level security;
alter table documents enable row level security;
alter table reports enable row level security;
alter table recommendations enable row level security;
alter table leads enable row level security;
alter table orders enable row level security;
alter table audit_log enable row level security;

-- Public reference data
create policy "locations readable" on locations for select using (true);

-- Owner-scoped access (the service role bypasses RLS)
create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own consents" on consents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own briefs" on briefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own properties" on properties for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own documents" on documents for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own property facts" on property_facts for select using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
create policy "own valuations" on valuations for select using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
create policy "own legal checks" on legal_checks for select using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
create policy "own inspections" on inspections for select using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
create policy "own issues" on inspection_issues for select using (exists (select 1 from inspections i join properties p on p.id = i.property_id where i.id = inspection_id and p.owner_id = auth.uid()));
create policy "own reports" on reports for select using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
create policy "own recommendations" on recommendations for select using (exists (select 1 from briefs b where b.id = brief_id and b.user_id = auth.uid()));
create policy "own orders" on orders for select using (user_id = auth.uid());
-- leads, audit_log, market_comps, experts: no policies = server (service role) only.

-- Storage: create a PRIVATE bucket named documents; never make it public; serve files via short-lived signed URLs.
