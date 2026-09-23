-- Invoices bulk-imported from the old Purchase Management system carry an
-- "OLD-" number. They are historical records, so the live KPIs on the
-- Dashboard/Invoices pages exclude them; they remain visible under
-- "Previous invoices".
create or replace view invoice_metrics
with (security_invoker = true) as
select
  count(*) as total_invoices,
  count(*) filter (where exists (
    select 1 from stock_moves m where m.invoice_id = i.id
  )) as invoices_with_stock_change,
  count(*) filter (where i.created_at >= date_trunc('day', now())) as invoices_today,
  count(*) filter (where i.created_at >= now() - interval '7 days') as invoices_last_7_days,
  count(*) filter (where i.created_at >= now() - interval '30 days') as invoices_last_30_days,
  coalesce((
    select sum(li.total)
    from invoice_line_items li
    join invoices inv on inv.id = li.invoice_id
    where inv.number not like 'OLD-%'
  ), 0::numeric) as total_invoice_value
from invoices i
where i.number not like 'OLD-%';
