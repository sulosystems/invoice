-- TEMPORARY. Pairs with NEXT_PUBLIC_DISABLE_AUTH in the app: lets the anon
-- key (i.e. a signed-out browser) read/write these tables so the UI can be
-- driven without the magic-link flow.
--
-- To revert once login is back on, run:
--   drop policy "TEMP anon full access" on products;
--   drop policy "TEMP anon full access" on templates;
--   drop policy "TEMP anon full access" on invoices;
--   drop policy "TEMP anon full access" on stock_moves;
-- The "authenticated full access" policies from 0001 are untouched and keep
-- working once you're signed in again.

create policy "TEMP anon full access" on products
  for all to anon using (true) with check (true);
create policy "TEMP anon full access" on templates
  for all to anon using (true) with check (true);
create policy "TEMP anon full access" on invoices
  for all to anon using (true) with check (true);
create policy "TEMP anon full access" on stock_moves
  for all to anon using (true) with check (true);
