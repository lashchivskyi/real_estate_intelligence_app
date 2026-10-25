-- Payments: provider-agnostic order state (monobank acquiring / Stripe Checkout).
alter table orders
  add column if not exists provider text check (provider in ('monobank', 'stripe')),
  add column if not exists provider_ref text,
  add column if not exists amount_minor bigint,
  add column if not exists currency text,
  add column if not exists email text,
  add column if not exists updated_at timestamptz not null default now();

alter table orders alter column package_id drop not null;
create unique index if not exists orders_provider_ref on orders (provider, provider_ref);
-- Status values: created | pending | paid | failed | expired | unknown. Only server webhooks (service role) write here.
