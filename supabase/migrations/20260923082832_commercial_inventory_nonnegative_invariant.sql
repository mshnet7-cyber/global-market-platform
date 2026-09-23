-- Enforce the core inventory invariant at the database boundary.
-- No commercial operation may leave quantity or weight negative.
alter table public.gmp_products
  add constraint gmp_products_inventory_nonnegative_chk
  check (current_quantity >= 0 and current_weight_grams >= 0);
