-- =============================================================================
--  0003_rls.sql  —  Row Level Security
--
--  নীতি (মনে রাখার সহজ নিয়ম):
--    anon          = যে কেউ, লগইন ছাড়া
--    authenticated = লগইন করা যেকোনো ইউজার
--    staff         = public.staff টেবিলে যার row আছে (is_staff() = true)
--
--  ★ সবচেয়ে গুরুত্বপূর্ণ: orders / order_items / order_status_history তে
--    anon এর কোনো সরাসরি অ্যাক্সেস নেই। অর্ডার তৈরি হয় create_order() RPC
--    দিয়ে, আর দেখা যায় track_order() দিয়ে। এটাই ভুলে যাওয়া যাবে না।
-- =============================================================================

-- -----------------------------------------------------------------------------
-- প্রথমে সব পারমিশন বন্ধ করে শুধু দরকারিটা খোলা হচ্ছে (defense in depth)।
-- RLS ভুল করে অফ হয়ে গেলেও তখনও যেন ডেটা সুরক্ষিত থাকে।
-- -----------------------------------------------------------------------------
revoke all on public.staff                from anon, authenticated;
revoke all on public.categories           from anon, authenticated;
revoke all on public.books                from anon, authenticated;
revoke all on public.delivery_zones       from anon, authenticated;
revoke all on public.coupons              from anon, authenticated;
revoke all on public.orders               from anon, authenticated;
revoke all on public.order_items          from anon, authenticated;
revoke all on public.order_status_history from anon, authenticated;
revoke all on public.reviews              from anon, authenticated;
revoke all on public.site_settings        from anon, authenticated;

grant select on public.categories     to anon, authenticated;
grant select on public.books          to anon, authenticated;
grant select on public.delivery_zones to anon, authenticated;
grant select on public.site_settings  to anon, authenticated;   -- RLS row ফিল্টার করবে
grant select on public.reviews        to anon, authenticated;
grant insert on public.reviews        to anon, authenticated;
grant select on public.staff          to authenticated;         -- RLS নিজের row তে সীমাবদ্ধ

-- staff ভূমিকার জন্য পূর্ণ CRUD (RLS is_staff() দিয়ে টেবিল ধরে ধরে যাচাই করবে)
grant all on public.staff, public.categories, public.books, public.delivery_zones,
             public.coupons, public.orders, public.order_items,
             public.order_status_history, public.reviews, public.site_settings
  to authenticated;

-- =============================================================================
--  RLS চালু
-- =============================================================================
alter table public.staff                enable row level security;
alter table public.categories           enable row level security;
alter table public.books                enable row level security;
alter table public.delivery_zones       enable row level security;
alter table public.coupons              enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.reviews              enable row level security;
alter table public.site_settings        enable row level security;

-- =============================================================================
--  পুরনো পলিসি থাকলে আগে মুছে ফেলা হচ্ছে
--
--  ⚠️ PostgreSQL-এ `create policy if not exists` নেই। তাই এই ধাপটা ছাড়া
--     ফাইলটা দ্বিতীয়বার চালালে "policy ... already exists" (42710) এররে
--     থেমে যাবে, আর বাকি পলিসিগুলো বসবে না।
--
--  নতুন পলিসি যোগ করলে তার নামও নিচের তালিকায় বসিয়ে দিন।
-- =============================================================================
drop policy if exists "staff_read_self"              on public.staff;
drop policy if exists "staff_admin_all"              on public.staff;

drop policy if exists "categories_public_read"       on public.categories;
drop policy if exists "categories_staff_all"         on public.categories;

drop policy if exists "books_public_read_active"     on public.books;
drop policy if exists "books_staff_all"              on public.books;

drop policy if exists "zones_public_read"            on public.delivery_zones;
drop policy if exists "zones_staff_all"              on public.delivery_zones;

drop policy if exists "coupons_staff_all"            on public.coupons;

drop policy if exists "orders_staff_all"             on public.orders;
drop policy if exists "order_items_staff_all"        on public.order_items;

drop policy if exists "order_history_staff_read"     on public.order_status_history;
drop policy if exists "order_history_staff_insert"   on public.order_status_history;

drop policy if exists "reviews_public_read_approved" on public.reviews;
drop policy if exists "reviews_public_insert"        on public.reviews;
drop policy if exists "reviews_staff_all"            on public.reviews;

drop policy if exists "settings_public_read"         on public.site_settings;
drop policy if exists "settings_staff_all"           on public.site_settings;

-- =============================================================================
--  STAFF
-- =============================================================================
create policy "staff_read_self" on public.staff
  for select to authenticated
  using (user_id = auth.uid());

create policy "staff_admin_all" on public.staff
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
--  CATEGORIES
-- =============================================================================
create policy "categories_public_read" on public.categories
  for select to anon, authenticated
  using (is_active);

create policy "categories_staff_all" on public.categories
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- =============================================================================
--  BOOKS
-- =============================================================================
create policy "books_public_read_active" on public.books
  for select to anon, authenticated
  using (is_active);

create policy "books_staff_all" on public.books
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- =============================================================================
--  DELIVERY ZONES
-- =============================================================================
create policy "zones_public_read" on public.delivery_zones
  for select to anon, authenticated
  using (is_active);

create policy "zones_staff_all" on public.delivery_zones
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- =============================================================================
--  COUPONS  —  ★ anon এর কোনো SELECT নেই। কোড যাচাই হয়
--              public.validate_coupon() RPC দিয়ে, যেটা SECURITY DEFINER।
-- =============================================================================
create policy "coupons_staff_all" on public.coupons
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- =============================================================================
--  ORDERS  —  ★★★ anon এর কোনো নীতি নেই (ইচ্ছাকৃত)  ★★★
--  সাইট থেকে অর্ডার আসে create_order() দিয়ে, ট্র্যাকিং হয় track_order() দিয়ে।
-- =============================================================================
create policy "orders_staff_all" on public.orders
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "order_items_staff_all" on public.order_items
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "order_history_staff_read" on public.order_status_history
  for select to authenticated
  using (public.is_staff());

create policy "order_history_staff_insert" on public.order_status_history
  for insert to authenticated
  with check (public.is_staff());

-- =============================================================================
--  REVIEWS  —  যে কেউ রিভিউ লিখতে পারবে, কিন্তু শুধু is_approved = false নিয়ে।
--  ফলে স্প্যাম রিভিউ সরাসরি সাইটে যেতে পারবে না — অ্যাডমিন অ্যাপ্রুভ করবে।
-- =============================================================================
create policy "reviews_public_read_approved" on public.reviews
  for select to anon, authenticated
  using (is_approved);

create policy "reviews_public_insert" on public.reviews
  for insert to anon, authenticated
  with check (
    is_approved = false
    and rating between 1 and 5
    and length(btrim(author_name)) between 2 and 80
    and length(coalesce(comment, '')) <= 2000
    and exists (
      select 1 from public.books b
      where b.id = book_id and b.is_active
    )
  );

create policy "reviews_staff_all" on public.reviews
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- =============================================================================
--  SITE SETTINGS
-- =============================================================================
create policy "settings_public_read" on public.site_settings
  for select to anon, authenticated
  using (is_public);

create policy "settings_staff_all" on public.site_settings
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
