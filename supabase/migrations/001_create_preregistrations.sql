create table if not exists public.preregistrations (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  products text[] not null check (cardinality(products) > 0),
  source text not null,
  consent boolean not null check (consent = true),
  submitted_at timestamptz not null default now(),
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed')),
  email_provider_id text
);

alter table public.preregistrations enable row level security;

-- Browser clients receive no direct table policy. Only the server-side service role can access records.
revoke all on table public.preregistrations from anon, authenticated;

-- The Render backend can access this table; browser roles remain blocked.
grant usage on schema public to service_role;
grant select, insert, update on table public.preregistrations to service_role;

create index if not exists preregistrations_submitted_at_idx
  on public.preregistrations (submitted_at desc);
