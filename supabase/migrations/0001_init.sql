-- Invoicing + inventory schema
-- Design notes:
--   * Custom user-defined fields live in jsonb, so adding a field never needs a migration.
--   * Stock on hand is DERIVED from stock_moves (see stock_levels view), never stored.
--     This makes it impossible for the ledger and the stock number to disagree.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- products
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sku         text unique,
  unit        text not null default 'ea',
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- templates
-- A "template" is just saved layout config, not a template engine.
-- layout shape: { headerText, footerText, logoUrl, showTax, taxRate, columns: [...] }
create table if not exists templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  layout      jsonb not null default '{}'::jsonb,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Only one template may be the default.
create unique index if not exists templates_one_default
  on templates (is_default) where is_default;

-- ---------------------------------------------------------------- invoices
-- Numbering uses a sequence, not count(*)+1, which would collide on
-- concurrent saves and renumber after a delete.
create sequence if not exists invoice_number_seq start 1;

create table if not exists invoices (
  id            uuid primary key default gen_random_uuid(),
  number        text not null unique
                  default 'INV-' || lpad(nextval('invoice_number_seq')::text, 4, '0'),
  invoice_date  date not null default current_date,
  customer      jsonb not null default '{}'::jsonb,  -- { name, email, address }
  fields        jsonb not null default '[]'::jsonb,  -- [{ label, value }] user-defined
  line_items    jsonb not null default '[]'::jsonb,  -- [{ description, qty, unitPrice }]
  notes         text,
  template_id   uuid references templates(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists invoices_date_idx on invoices (invoice_date desc);

-- ------------------------------------------------------------- stock_moves
-- qty is SIGNED: positive = stock in, negative = stock out.
-- invoice_id is nullable so manual adjustments (not tied to an invoice) work too.
create table if not exists stock_moves (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete restrict,
  invoice_id  uuid references invoices(id) on delete set null,
  qty         numeric(14,3) not null check (qty <> 0),
  comment     text,
  created_at  timestamptz not null default now()
);

create index if not exists stock_moves_product_idx on stock_moves (product_id, created_at desc);
create index if not exists stock_moves_invoice_idx on stock_moves (invoice_id);

-- ------------------------------------------------------------ stock_levels
-- The single source of truth for "how much do we have".
create or replace view stock_levels as
select
  p.id,
  p.name,
  p.sku,
  p.unit,
  coalesce(sum(m.qty), 0)::numeric(14,3) as on_hand,
  max(m.created_at)                      as last_movement_at
from products p
left join stock_moves m on m.product_id = p.id
group by p.id, p.name, p.sku, p.unit;

-- --------------------------------------------------------- updated_at hook
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists invoices_updated_at on invoices;
create trigger invoices_updated_at
  before update on invoices
  for each row execute function set_updated_at();
