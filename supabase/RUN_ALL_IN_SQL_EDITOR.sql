-- =============================================================================
--  ⚠️  এটা জেনারেট করা ফাইল — হাতে এডিট করবেন না
--
--  এতে 7টি migration ক্রম অনুযায়ী জোড়া দেওয়া হয়েছে।
--  পুরোটা একবারে কপি করে Supabase → SQL Editor এ পেস্ট করে Run চাপুন।
--
--  ▸ আসল source:  supabase/migrations/*.sql
--  ▸ আবার বানাতে:  npm run db:bundle
--  ▸ সব ফাইল idempotent — ভুলে আবার চালালেও ক্ষতি হবে না
--
--  তৈরি হয়েছে: 2026-09-25T06:12:30.301Z
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
--  ধাপ 1/7  ·  20260924000001_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
--  0001_schema.sql  —  টেবিল, টাইপ, ইনডেক্স, ট্রিগার
--  চলান:  Supabase Dashboard → SQL Editor → এই ফাইল পেস্ট করে Run
--  অথবা:  supabase db push
-- =============================================================================

-- pg_trgm দিয়ে বাংলা/ইংরেজি টেক্সটে দ্রুত "similar to" ও ILIKE সার্চ করা যায়।
create extension if not exists pg_trgm;

-- -----------------------------------------------------------------------------
-- ENUM টাইপ — অর্ডার/পেমেন্ট/বইয়ের অবস্থা এখানে কেন্দ্রীভূত।
-- নতুন ভ্যালু লাগলে: alter type public.order_status add value 'new_status';
--
-- ⚠️ PostgreSQL-এ `create type if not exists` নেই। তাই প্রতিটিকে একটি
--    DO ব্লকে মুড়ে duplicate_object এরর ধরা হচ্ছে — নাহলে ফাইলটা দ্বিতীয়বার
--    চালালে "type already exists" (42710) এররে থেমে যাবে, আর বাকি সব
--    statement চলবে না। (এই ভুলটাই একবার ঘটেছিল।)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.order_status as enum ('pending','confirmed','packed','shipped','delivered','cancelled','returned');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum ('cod','bkash','nagad');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('unpaid','pending_verification','paid','refunded','failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.book_language as enum ('bangla','english','arabic','hindi','other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.book_binding as enum ('paperback','hardcover','spiral','ebook');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.discount_type as enum ('percent','fixed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.staff_role as enum ('admin','manager','fulfillment');
exception when duplicate_object then null;
end $$;

-- অর্ডার নম্বরের সিকোয়েন্স (BK-260924-0001 স্টাইলের জন্য)।
create sequence if not exists public.order_number_seq start 1;

-- -----------------------------------------------------------------------------
-- updated_at স্বয়ংক্রিয়ভাবে সেট করার ট্রিগার ফাংশন
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- ১. STAFF  —  অ্যাডমিন/কর্মীদের তালিকা (auth.users এর সাথে লিংকড)
-- =============================================================================
create table if not exists public.staff (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        public.staff_role not null default 'fulfillment',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.staff is
  'যারা অ্যাডমিন প্যানেল ব্যবহার করতে পারবে। এখানে row না থাকলে কোনো অ্যাক্সেস নেই।';

-- =============================================================================
-- ২. CATEGORIES  —  বিষয়/ধরন (বাংলা বিভাগ, উপবিভাগ)
-- =============================================================================
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_bn     text not null,
  name_en     text,
  parent_id   uuid references public.categories(id) on delete set null,
  icon        text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists categories_parent_idx on public.categories (parent_id);
create index if not exists categories_active_sort_idx on public.categories (is_active, sort_order);

-- =============================================================================
-- ৩. BOOKS  —  বইয়ের মূল ক্যাটালগ
-- =============================================================================
create table if not exists public.books (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique,

  -- মূল তথ্য (বাংলা বাধ্যতামূলক, ইংরেজি অপশনাল)
  title_bn            text not null,
  title_en            text,
  author              text,
  translator          text,
  publisher           text,
  isbn                text,
  edition             text,

  language            public.book_language not null default 'bangla',
  binding             public.book_binding  not null default 'paperback',
  pages               integer check (pages is null or pages > 0),
  publication_year    integer check (publication_year is null or publication_year between 1500 and 2100),

  description_bn      text,
  description_en      text,

  -- ছবি: কভার আলাদা, বাকিগুলো jsonb অ্যারে ["url1","url2"]
  cover_image_url     text,
  gallery             jsonb not null default '[]'::jsonb,

  -- দাম (টাকায়, ২ দশমিক)
  price               numeric(10,2) not null check (price >= 0),
  compare_at_price    numeric(10,2) check (compare_at_price is null or compare_at_price >= 0),
  cost_price          numeric(10,2) check (cost_price is null or cost_price >= 0),

  -- স্টক
  stock_qty           integer not null default 0 check (stock_qty >= 0),
  low_stock_threshold integer not null default 3,
  weight_grams        integer,

  category_id         uuid references public.categories(id) on delete set null,
  is_featured         boolean not null default false,
  is_active           boolean not null default true,

  seo_title           text,
  seo_description     text,

  -- সার্চের জন্য নরমালাইজড টেক্সট। PostgreSQL-এ বাংলা FTS কনফিগ নেই,
  -- তাই ILIKE + trigram ইনডেক্স ব্যবহার করা হচ্ছে (নিচের ইনডেক্স দেখুন)।
  -- ⚠️ concat_ws ব্যবহার করা যাবে না — ওটা STABLE, generated column-এ IMMUTABLE লাগে।
  search_text         text generated always as (
                        lower(
                          coalesce(title_bn,'') || ' ' ||
                          coalesce(title_en,'') || ' ' ||
                          coalesce(author,'')   || ' ' ||
                          coalesce(translator,'') || ' ' ||
                          coalesce(publisher,'')  || ' ' ||
                          coalesce(isbn,'')       || ' ' ||
                          coalesce(description_bn,'') || ' ' ||
                          coalesce(description_en,'')
                        )
                      ) stored,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists books_category_idx      on public.books (category_id);
create index if not exists books_active_idx        on public.books (is_active, created_at desc);
create index if not exists books_featured_idx      on public.books (is_featured) where is_active;
create index if not exists books_search_trgm_idx   on public.books using gin (search_text gin_trgm_ops);
create index if not exists books_title_trgm_idx    on public.books using gin (title_bn gin_trgm_ops);

-- slug খালি থাকলে টাইটেল থেকে অটো-বানাও; কিছু না হলে id দিয়ে।
create or replace function public.books_set_slug()
returns trigger
language plpgsql
as $$
declare
  base text;
begin
  if new.slug is null or btrim(new.slug) = '' then
    base := regexp_replace(
              lower(coalesce(nullif(new.title_en,''), nullif(new.title_bn,''), '')),
              '[^a-z0-9]+', '-', 'g'
            );
    base := btrim(base, '-');
    if base = '' then
      base := 'book-' || substr(replace(new.id::text, '-', ''), 1, 8);
    end if;
    new.slug := base || '-' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;
  return new;
end;
$$;

-- =============================================================================
-- ৪. DELIVERY ZONES  —  ডেলিভারি চার্জ (বিভাগভিত্তিক)
-- =============================================================================
create table if not exists public.delivery_zones (
  id                uuid primary key default gen_random_uuid(),
  name_bn           text not null,
  division          text not null,          -- 'ঢাকা', 'চট্টগ্রাম' ...
  fee               numeric(10,2) not null check (fee >= 0),
  free_above        numeric(10,2) check (free_above is null or free_above >= 0),
  cod_available     boolean not null default true,
  eta_days_min      integer not null default 2,
  eta_days_max      integer not null default 5,
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (division)
);

-- =============================================================================
-- ৫. COUPONS  —  ডিসকাউন্ট কোড
-- =============================================================================
create table if not exists public.coupons (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  description_bn text,
  discount_type  public.discount_type not null,
  discount_value numeric(10,2) not null check (discount_value > 0),
  min_order      numeric(10,2) not null default 0,
  max_discount   numeric(10,2),                 -- percent হলে সিলিং
  usage_limit    integer,                       -- null = অসীম
  used_count     integer not null default 0,
  per_phone_limit integer not null default 1,
  starts_at      timestamptz,
  ends_at        timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- কোড সবসময় uppercase রাখা হয়, যাতে ইউজার lowercase লিখলেও ম্যাচ করে।
create or replace function public.coupons_upper_code()
returns trigger language plpgsql as $$
begin
  new.code := upper(btrim(new.code));
  return new;
end; $$;

-- =============================================================================
-- ৬. ORDERS  —  অর্ডার (একটাই বড় টেবিল, snapshot সহ)
-- =============================================================================
create table if not exists public.orders (
  id                     uuid primary key default gen_random_uuid(),
  order_number           text not null unique,

  -- কাস্টমার (কোনো অ্যাকাউন্ট লাগে না — গেস্ট চেকআউট)
  customer_name          text not null,
  customer_phone         text not null,
  customer_email         text,

  -- ঠিকানা
  division               text not null,
  district               text not null,
  area                   text,
  address_line           text not null,
  postcode               text,
  delivery_note          text,

  -- হিসাব (সবসময় সার্ভারে হিসাব হয়, ক্লায়েন্টের পাঠানো দাম বিশ্বাস করা হয় না)
  subtotal               numeric(10,2) not null default 0,
  discount               numeric(10,2) not null default 0,
  delivery_fee           numeric(10,2) not null default 0,
  total                  numeric(10,2) not null default 0,
  coupon_code            text,

  -- পেমেন্ট
  payment_method         public.payment_method not null default 'cod',
  payment_status         public.payment_status not null default 'unpaid',
  payment_ref            text,          -- bKash/Nagad TrxID
  payment_sender_phone   text,
  payment_amount_received numeric(10,2),

  -- ফুলফিলমেন্ট
  status                 public.order_status not null default 'pending',
  courier                text,          -- 'Pathao','Steadfast','RedX' ...
  tracking_code          text,
  admin_note             text,
  cancel_reason          text,

  -- অ্যাবিউজ ঠেকানোর জন্য
  ip_hash                text,

  confirmed_at           timestamptz,
  shipped_at             timestamptz,
  delivered_at           timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists orders_status_idx      on public.orders (status, created_at desc);
create index if not exists orders_phone_idx       on public.orders (customer_phone);
create index if not exists orders_created_idx     on public.orders (created_at desc);
create index if not exists orders_payment_idx     on public.orders (payment_status) where payment_status <> 'paid';

-- =============================================================================
-- ৭. ORDER ITEMS  —  অর্ডারের লাইন আইটেম (বইয়ের তথ্য snapshot করা হয়)
--    কেন snapshot? পরে বইয়ের দাম/নাম বদলালেও পুরনো ইনভয়েস অপরিবর্তিত থাকবে।
-- =============================================================================
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  book_id        uuid references public.books(id) on delete set null,
  title_snapshot text not null,
  author_snapshot text,
  cover_snapshot text,
  unit_price     numeric(10,2) not null check (unit_price >= 0),
  quantity       integer not null check (quantity > 0),
  line_total     numeric(10,2) not null check (line_total >= 0),
  created_at     timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_book_idx  on public.order_items (book_id);

-- =============================================================================
-- ৮. ORDER STATUS HISTORY  —  অর্ডারের অডিট ট্রেইল
-- =============================================================================
create table if not exists public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  note        text,
  changed_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- =============================================================================
-- ৯. REVIEWS  —  কাস্টমার রিভিউ (অ্যাডমিন অ্যাপ্রুভ করলে সাইটে দেখাবে)
-- =============================================================================
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  author_name text not null,
  author_phone text,
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  is_approved boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists reviews_book_idx on public.reviews (book_id, is_approved, created_at desc);

-- =============================================================================
-- ১০. SITE SETTINGS  —  key/value কনফিগ (bKash নম্বর, হোমপেজের ব্যানার ইত্যাদি)
--     is_public = true হলে ওয়েবসাইট থেকে পড়া যাবে, নাহলে শুধু staff।
-- =============================================================================
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  is_public  boolean not null default false,
  label_bn   text,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- ট্রিগার সংযুক্তি
--
-- ⚠️ PostgreSQL-এ `create trigger if not exists` নেই। তাই আগে পুরনোটা মুছে
--    নেওয়া হয় — এতে ফাইলটা যতবারই চালানো হোক, একই ফল আসে।
-- =============================================================================
drop trigger if exists trg_books_set_slug         on public.books;
drop trigger if exists trg_coupons_upper_code     on public.coupons;
drop trigger if exists trg_categories_updated     on public.categories;
drop trigger if exists trg_books_updated          on public.books;
drop trigger if exists trg_delivery_zones_updated on public.delivery_zones;
drop trigger if exists trg_coupons_updated        on public.coupons;
drop trigger if exists trg_orders_updated         on public.orders;

create trigger trg_books_set_slug       before insert on public.books
  for each row execute function public.books_set_slug();
create trigger trg_coupons_upper_code   before insert or update on public.coupons
  for each row execute function public.coupons_upper_code();

create trigger trg_categories_updated   before update on public.categories
  for each row execute function public.set_updated_at();
create trigger trg_books_updated        before update on public.books
  for each row execute function public.set_updated_at();
create trigger trg_delivery_zones_updated before update on public.delivery_zones
  for each row execute function public.set_updated_at();
create trigger trg_coupons_updated      before update on public.coupons
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated       before update on public.orders
  for each row execute function public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
--  ধাপ 2/7  ·  20260924000002_functions.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
--  0002_functions.sql  —  হেল্পার ফাংশন + পাবলিক/অ্যাডমিন RPC
--
--  ⚠️ SECURITY DEFINER ফাংশনে `set search_path = ''` দেওয়া হয়েছে, তাই ভেতরে
--     সব টেবিল ও ফাংশনের নাম স্কিমা দিয়ে লেখা (public.books, auth.uid(), ...)।
--     এটা SQL ইনজেকশন থেকে বাঁচায় — নতুন ফাংশন লেখার সময় এই নিয়ম মানুন।
-- =============================================================================

-- -----------------------------------------------------------------------------
-- হেল্পার: বাংলাদেশি ফোন নম্বর নরমালাইজ (01XXXXXXXXX ফরম্যাটে)
-- -----------------------------------------------------------------------------
create or replace function public.normalize_bd_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when p_phone is null then null
    else (
      with d as (select regexp_replace(p_phone, '[^0-9]', '', 'g') as raw)
      select case
        when raw like '8801%' and length(raw) = 13 then substr(raw, 3)
        when raw like '01%'   and length(raw) = 11 then raw
        else raw
      end
      from d
    )
  end;
$$;

create or replace function public.is_valid_bd_phone(p_phone text)
returns boolean
language sql
immutable
as $$
  select coalesce(public.normalize_bd_phone(p_phone) ~ '^01[3-9][0-9]{8}$', false);
$$;

-- -----------------------------------------------------------------------------
-- হেল্পার: লগইন করা ইউজার staff কি না?
--   SECURITY DEFINER + STABLE — কারণ RLS পলিসির ভেতরে এটা কল হয়, আর
--   staff টেবিলে সরাসরি সাবকোয়েরি দিলে infinite recursion হয়।
-- -----------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.is_active and s.role = 'admin'
  );
$$;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- হেল্পার: কুপন ভ্যালিডেট + ডিসকাউন্ট হিসাব (পাবলিক — কার্ট প্রিভিউতে লাগে)
--   রিটার্ন: { valid, reason, code, discount, description_bn }
-- -----------------------------------------------------------------------------
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.coupons;
  v_discount numeric(10,2) := 0;
begin
  if p_code is null or btrim(p_code) = '' then
    return jsonb_build_object('valid', false, 'reason', 'EMPTY');
  end if;

  select * into c from public.coupons where code = upper(btrim(p_code));

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'NOT_FOUND');
  end if;
  if not c.is_active then
    return jsonb_build_object('valid', false, 'reason', 'INACTIVE');
  end if;
  if c.starts_at is not null and now() < c.starts_at then
    return jsonb_build_object('valid', false, 'reason', 'NOT_STARTED');
  end if;
  if c.ends_at is not null and now() > c.ends_at then
    return jsonb_build_object('valid', false, 'reason', 'EXPIRED');
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return jsonb_build_object('valid', false, 'reason', 'USAGE_LIMIT');
  end if;
  if p_subtotal < c.min_order then
    return jsonb_build_object(
      'valid', false, 'reason', 'MIN_ORDER',
      'min_order', c.min_order
    );
  end if;

  if c.discount_type = 'percent' then
    v_discount := round(p_subtotal * c.discount_value / 100.0, 2);
    if c.max_discount is not null then
      v_discount := least(v_discount, c.max_discount);
    end if;
  else
    v_discount := c.discount_value;
  end if;

  -- ডিসকাউন্ট কখনোই সাবটোটালের বেশি হবে না।
  v_discount := least(v_discount, p_subtotal);

  return jsonb_build_object(
    'valid', true,
    'code', c.code,
    'discount', v_discount,
    'description_bn', c.description_bn
  );
end;
$$;

grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;

-- =============================================================================
--  create_order()  —  ★★★ অর্ডার তৈরির একমাত্র পথ  ★★★
--
--  কেন RPC?  orders/order_items টেবিলে anon INSERT পারমিশন নেই।
--  ক্লায়েন্ট শুধু book_id + quantity পাঠায়; দাম, ডেলিভারি চার্জ, ডিসকাউন্ট,
--  স্টক — সব এই ফাংশনের ভেতরে সার্ভারে হিসাব হয়। ফলে কেউ DevTools থেকে
--  দাম বদলে দিতে পারবে না।
--
--  রিটার্ন:
--    সফল  → { "ok": true,  "order_number": "...", "total": 1234.00 }
--    ব্যর্থ → { "ok": false, "code": "OUT_OF_STOCK", "message": "..." }
-- =============================================================================
create or replace function public.create_order(
  p_customer_name        text,
  p_customer_phone       text,
  p_customer_email       text,
  p_division             text,
  p_district             text,
  p_area                 text,
  p_address_line         text,
  p_postcode             text,
  p_delivery_note        text,
  p_payment_method       text,
  p_payment_ref          text,
  p_payment_sender_phone text,
  p_coupon_code          text,
  p_items                jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id      uuid;
  v_order_number  text;
  v_phone         text;
  v_method        public.payment_method;
  v_subtotal      numeric(10,2) := 0;
  v_discount      numeric(10,2) := 0;
  v_delivery_fee  numeric(10,2) := 0;
  v_total         numeric(10,2) := 0;
  v_zone          public.delivery_zones;
  v_coupon        jsonb;
  v_coupon_code   text := null;
  v_item          jsonb;
  v_book          public.books;
  v_qty           integer;
  v_line_total    numeric(10,2);
  v_req_items     jsonb;
begin
  -- ---------- ১. ভ্যালিডেশন ----------
  if p_customer_name is null or length(btrim(p_customer_name)) < 3 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_NAME',
      'message', 'অনুগ্রহ করে পুরো নাম লিখুন।');
  end if;

  v_phone := public.normalize_bd_phone(p_customer_phone);
  if not public.is_valid_bd_phone(v_phone) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PHONE',
      'message', 'সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)।');
  end if;

  if p_address_line is null or length(btrim(p_address_line)) < 10 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_ADDRESS',
      'message', 'সম্পূর্ণ ঠিকানা লিখুন (বাসা/রোড/এলাকা)।');
  end if;

  if p_division is null or btrim(p_division) = '' or p_district is null or btrim(p_district) = '' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_LOCATION',
      'message', 'বিভাগ ও জেলা নির্বাচন করুন।');
  end if;

  if p_payment_method is null or p_payment_method not in ('cod','bkash','nagad') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYMENT',
      'message', 'পেমেন্ট পদ্ধতি সঠিক নয়।');
  end if;
  v_method := p_payment_method::public.payment_method;

  -- ম্যানুয়াল পেমেন্টে TrxID বাধ্যতামূলক।
  if v_method <> 'cod' and (p_payment_ref is null or length(btrim(p_payment_ref)) < 4) then
    return jsonb_build_object('ok', false, 'code', 'MISSING_TRX',
      'message', 'bKash/Nagad এর Transaction ID (TrxID) লিখুন।');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'code', 'EMPTY_CART',
      'message', 'আপনার কার্ট খালি।');
  end if;

  if jsonb_array_length(p_items) > 25 then
    return jsonb_build_object('ok', false, 'code', 'TOO_MANY_ITEMS',
      'message', 'এক অর্ডারে সর্বোচ্চ ২৫ ধরনের বই নেওয়া যাবে।');
  end if;

  -- ---------- ২. একই বই একাধিকবার এলে কোয়ান্টিটি যোগ করা ----------
  select jsonb_agg(jsonb_build_object('book_id', book_id, 'quantity', qty))
  into v_req_items
  from (
    select
      (i->>'book_id')::uuid as book_id,
      sum(greatest(coalesce((i->>'quantity')::int, 0), 0)) as qty
    from jsonb_array_elements(p_items) i
    where (i->>'book_id') is not null
    group by 1
  ) t
  where qty > 0;

  if v_req_items is null then
    return jsonb_build_object('ok', false, 'code', 'EMPTY_CART',
      'message', 'আপনার কার্ট খালি।');
  end if;

  -- ---------- ৩. বই লক করে দাম ও স্টক যাচাই ----------
  for v_item in select * from jsonb_array_elements(v_req_items)
  loop
    v_qty := (v_item->>'quantity')::int;

    select * into v_book
    from public.books
    where id = (v_item->>'book_id')::uuid
    for update;   -- একই সময়ে অন্য কেউ স্টক কমাচ্ছে না তা নিশ্চিত করে

    if not found then
      return jsonb_build_object('ok', false, 'code', 'BOOK_NOT_FOUND',
        'message', 'কোনো একটি বই আর পাওয়া যাচ্ছে না। কার্ট রিফ্রেশ করুন।');
    end if;

    if not v_book.is_active then
      return jsonb_build_object('ok', false, 'code', 'BOOK_INACTIVE',
        'message', format('"%s" বর্তমানে বন্ধ আছে।', v_book.title_bn));
    end if;

    if v_book.stock_qty < v_qty then
      return jsonb_build_object('ok', false, 'code', 'OUT_OF_STOCK',
        'message', format('"%s" এর স্টকে মাত্র %s কপি আছে।',
                          v_book.title_bn, v_book.stock_qty));
    end if;

    -- ⚠️ দাম আসছে ডেটাবেস থেকে, ক্লায়েন্টের পাঠানো দাম নয়।
    v_line_total := v_book.price * v_qty;
    v_subtotal   := v_subtotal + v_line_total;
  end loop;

  -- ---------- ৪. ডেলিভারি চার্জ ----------
  select * into v_zone
  from public.delivery_zones
  where division = btrim(p_division) and is_active
  limit 1;

  if found then
    v_delivery_fee := v_zone.fee;
    if v_zone.free_above is not null and v_subtotal >= v_zone.free_above then
      v_delivery_fee := 0;
    end if;
    if v_method <> 'cod' and not v_zone.cod_available then
      v_delivery_fee := v_zone.fee;
    end if;
  else
    -- অজানা বিভাগের জন্য সেফটি ডিফল্ট — সেটিংস থেকে নেওয়া।
    v_delivery_fee := coalesce(
      (select (value->>'default')::numeric from public.site_settings
       where key = 'delivery_default_fee'),
      120
    );
  end if;

  -- ---------- ৫. কুপন ----------
  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    v_coupon := public.validate_coupon(p_coupon_code, v_subtotal);
    if (v_coupon->>'valid')::boolean then
      v_discount    := coalesce((v_coupon->>'discount')::numeric, 0);
      v_coupon_code := v_coupon->>'code';
    end if;
    -- কুপন ভুল হলে অর্ডার আটকানো হয় না — শুধু ডিসকাউন্ট বাদ পড়ে।
  end if;

  v_total := greatest(v_subtotal - v_discount, 0) + v_delivery_fee;

  -- ---------- ৬. অর্ডার তৈরি ----------
  v_order_number := 'BK'
    || to_char(now() at time zone 'Asia/Dhaka', 'YYMMDD')
    || '-'
    || lpad(nextval('public.order_number_seq'::regclass)::text, 4, '0');

  insert into public.orders (
    order_number, customer_name, customer_phone, customer_email,
    division, district, area, address_line, postcode, delivery_note,
    subtotal, discount, delivery_fee, total, coupon_code,
    payment_method, payment_status, payment_ref, payment_sender_phone
  ) values (
    v_order_number,
    btrim(p_customer_name),
    v_phone,
    nullif(btrim(coalesce(p_customer_email, '')), ''),
    btrim(p_division),
    btrim(p_district),
    nullif(btrim(coalesce(p_area, '')), ''),
    btrim(p_address_line),
    nullif(btrim(coalesce(p_postcode, '')), ''),
    nullif(btrim(coalesce(p_delivery_note, '')), ''),
    v_subtotal, v_discount, v_delivery_fee, v_total, v_coupon_code,
    v_method,
    case when v_method = 'cod' then 'unpaid'::public.payment_status
         else 'pending_verification'::public.payment_status end,
    nullif(btrim(coalesce(p_payment_ref, '')), ''),
    public.normalize_bd_phone(p_payment_sender_phone)
  )
  returning id into v_order_id;

  -- ---------- ৭. আইটেম + স্টক কমানো ----------
  for v_item in select * from jsonb_array_elements(v_req_items)
  loop
    v_qty := (v_item->>'quantity')::int;

    select * into v_book from public.books where id = (v_item->>'book_id')::uuid;

    insert into public.order_items (
      order_id, book_id, title_snapshot, author_snapshot, cover_snapshot,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_book.id, v_book.title_bn, v_book.author, v_book.cover_image_url,
      v_book.price, v_qty, v_book.price * v_qty
    );

    update public.books
    set stock_qty = stock_qty - v_qty
    where id = v_book.id;
  end loop;

  -- ---------- ৮. অডিট ট্রেইল ও কুপন কাউন্ট ----------
  insert into public.order_status_history (order_id, from_status, to_status, note)
  values (v_order_id, null, 'pending', 'ওয়েবসাইট থেকে অর্ডার করা হয়েছে');

  if v_coupon_code is not null then
    update public.coupons
    set used_count = used_count + 1
    where code = v_coupon_code;
  end if;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'delivery_fee', v_delivery_fee,
    'total', v_total
  );
end;
$$;

grant execute on function public.create_order(
  text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb
) to anon, authenticated;

-- =============================================================================
--  track_order()  —  অর্ডার নম্বর + ফোন দিয়ে অর্ডার ট্র্যাক (গেস্ট ইউজারের জন্য)
--  orders টেবিলে anon SELECT নেই, তাই এই ফাংশনই একমাত্র জানালা।
--  সীমিত ফিল্ড রিটার্ন করে — সম্পূর্ণ অ্যাডমিন ডেটা নয়।
-- =============================================================================
create or replace function public.track_order(p_order_number text, p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_phone text;
  v_items jsonb;
begin
  if p_order_number is null or p_phone is null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_INPUT');
  end if;

  v_phone := public.normalize_bd_phone(p_phone);

  select * into o
  from public.orders
  where order_number = upper(btrim(p_order_number))
    and customer_phone = v_phone;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND',
      'message', 'এই অর্ডার নম্বর ও মোবাইল নম্বরের মিল পাওয়া যায়নি।');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
            'title', title_snapshot,
            'cover', cover_snapshot,
            'unit_price', unit_price,
            'quantity', quantity,
            'line_total', line_total
         )), '[]'::jsonb)
  into v_items
  from public.order_items
  where order_id = o.id;

  return jsonb_build_object(
    'ok', true,
    'order_number',  o.order_number,
    'status',        o.status,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'subtotal',      o.subtotal,
    'discount',      o.discount,
    'delivery_fee',  o.delivery_fee,
    'total',         o.total,
    'courier',       o.courier,
    'tracking_code', o.tracking_code,
    'created_at',    o.created_at,
    'shipped_at',    o.shipped_at,
    'delivered_at',  o.delivered_at,
    'items',         v_items
  );
end;
$$;

grant execute on function public.track_order(text, text) to anon, authenticated;

-- =============================================================================
--  admin_set_order_status()  —  অ্যাডমিন স্ট্যাটাস বদলাবে
--  বাতিল/ফেরত হলে স্টক ফিরিয়ে দেয় (এবং দ্বিগুণ ফেরত দেয় না)।
-- =============================================================================
create or replace function public.admin_set_order_status(
  p_order_id      uuid,
  p_status        text,
  p_note          text default null,
  p_courier       text default null,
  p_tracking_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o        public.orders;
  v_new    public.order_status;
  v_restock boolean := false;
begin
  if not public.is_staff() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  begin
    v_new := p_status::public.order_status;
  exception when invalid_text_representation then
    return jsonb_build_object('ok', false, 'code', 'BAD_STATUS');
  end;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if o.status = v_new then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;

  -- ইতিমধ্যে বাতিল/ফেরত অর্ডার আবার বাতিল করা হলে স্টক দ্বিতীয়বার ফেরত যাবে না।
  if v_new in ('cancelled','returned') and o.status not in ('cancelled','returned') then
    v_restock := true;
  end if;

  if v_restock then
    update public.books b
    set stock_qty = b.stock_qty + oi.quantity
    from public.order_items oi
    where oi.order_id = o.id and b.id = oi.book_id;
  end if;

  update public.orders
  set status         = v_new,
      courier        = coalesce(nullif(btrim(coalesce(p_courier, '')), ''), courier),
      tracking_code  = coalesce(nullif(btrim(coalesce(p_tracking_code, '')), ''), tracking_code),
      confirmed_at   = case when v_new = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
      shipped_at     = case when v_new = 'shipped'   then coalesce(shipped_at, now())   else shipped_at end,
      delivered_at   = case when v_new = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
      cancelled_at   = case when v_new in ('cancelled','returned') then coalesce(cancelled_at, now()) else cancelled_at end,
      payment_status = case when v_new = 'delivered' and payment_method = 'cod'
                            then 'paid'::public.payment_status else payment_status end
  where id = o.id;

  insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
  values (o.id, o.status, v_new, p_note, auth.uid());

  return jsonb_build_object('ok', true, 'status', v_new, 'restocked', v_restock);
end;
$$;

grant execute on function public.admin_set_order_status(uuid, text, text, text, text) to authenticated;

-- =============================================================================
--  admin_set_payment()  —  bKash/Nagad পেমেন্ট ভেরিফাই মার্ক করা
-- =============================================================================
create or replace function public.admin_set_payment(
  p_order_id       uuid,
  p_payment_status text,
  p_payment_ref    text default null,
  p_amount         numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ps public.payment_status;
begin
  if not public.is_staff() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  begin
    v_ps := p_payment_status::public.payment_status;
  exception when invalid_text_representation then
    return jsonb_build_object('ok', false, 'code', 'BAD_STATUS');
  end;

  update public.orders
  set payment_status         = v_ps,
      payment_ref            = coalesce(nullif(btrim(coalesce(p_payment_ref,'')), ''), payment_ref),
      payment_amount_received = coalesce(p_amount, payment_amount_received)
  where id = p_order_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
  select id, status, status, 'পেমেন্ট স্ট্যাটাস → ' || v_ps::text, auth.uid()
  from public.orders where id = p_order_id;

  return jsonb_build_object('ok', true, 'payment_status', v_ps);
end;
$$;

grant execute on function public.admin_set_payment(uuid, text, text, numeric) to authenticated;

-- =============================================================================
--  admin_stock_adjust()  —  স্টক বাড়ানো/কমানো (এক জায়গা থেকেই)
-- =============================================================================
create or replace function public.admin_stock_adjust(p_book_id uuid, p_delta integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new integer;
begin
  if not public.is_staff() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  update public.books
  set stock_qty = greatest(stock_qty + p_delta, 0)
  where id = p_book_id
  returning stock_qty into v_new;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  return jsonb_build_object('ok', true, 'stock_qty', v_new);
end;
$$;

grant execute on function public.admin_stock_adjust(uuid, integer) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
--  ধাপ 3/7  ·  20260924000003_rls.sql
-- ─────────────────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────────────────
--  ধাপ 4/7  ·  20260924000004_seed.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
--  0004_seed.sql  —  শুরুর ডেটা
--  এটা idempotent — কয়বার চালালেও ডুপ্লিকেট হবে না (on conflict)।
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ক্যাটাগরি
-- -----------------------------------------------------------------------------
insert into public.categories (slug, name_bn, name_en, icon, sort_order) values
  ('fiction',           'উপন্যাস',          'Fiction',            '📖', 10),
  ('stories',           'গল্পগ্রন্থ',        'Short Stories',      '📕', 20),
  ('poetry',            'কবিতা',            'Poetry',             '🪶', 30),
  ('science-fiction',   'সায়েন্স ফিকশন',    'Science Fiction',    '🚀', 40),
  ('thriller',          'থ্রিলার ও রহস্য',   'Thriller & Mystery', '🔍', 50),
  ('history',           'ইতিহাস',           'History',            '🏛️', 60),
  ('science',           'বিজ্ঞান',          'Science',            '🔬', 70),
  ('philosophy',        'দর্শন',            'Philosophy',         '💭', 80),
  ('religion',          'ধর্ম ও আধ্যাত্মিক', 'Religion',           '🕌', 90),
  ('biography',         'জীবনী ও স্মৃতিকথা', 'Biography',          '👤', 100),
  ('self-help',         'আত্মউন্নয়ন',       'Self Help',          '🌱', 110),
  ('business',          'ব্যবসা ও অর্থনীতি', 'Business',           '📈', 120),
  ('children',          'শিশু-কিশোর',       'Children',           '🧸', 130),
  ('academic',          'একাডেমিক ও পাঠ্য',  'Academic',           '🎓', 140),
  ('translated',        'অনুবাদ সাহিত্য',    'Translated',         '🌍', 150)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- ডেলিভারি চার্জ (বিভাগভিত্তিক)
-- ⚠️ এগুলো শুরুর ডিফল্ট। আপনার আসল কুরিয়ার রেট অনুযায়ী অ্যাডমিন প্যানেল বা
--    SQL Editor থেকে বদলে নিন।
-- -----------------------------------------------------------------------------
insert into public.delivery_zones
  (division, name_bn, fee, free_above, cod_available, eta_days_min, eta_days_max, sort_order) values
  ('ঢাকা',       'ঢাকা সিটি',            60,  1000, true, 1, 2, 10),
  ('চট্টগ্রাম',  'চট্টগ্রাম',            120, 1500, true, 2, 4, 20),
  ('খুলনা',      'খুলনা',               120, 1500, true, 2, 4, 30),
  ('রাজশাহী',    'রাজশাহী',             120, 1500, true, 2, 4, 40),
  ('সিলেট',      'সিলেট',               130, 1500, true, 2, 5, 50),
  ('বরিশাল',     'বরিশাল',              130, 1500, true, 2, 5, 60),
  ('রংপুর',      'রংপুর',               130, 1500, true, 3, 5, 70),
  ('ময়মনসিংহ',   'ময়মনসিংহ',            120, 1500, true, 2, 4, 80)
on conflict (division) do nothing;

-- -----------------------------------------------------------------------------
-- সাইট সেটিংস
--   is_public = true  →  ওয়েবসাইট থেকে পড়া যাবে (RLS অনুমতি দেয়)
--   is_public = false →  শুধু অ্যাডমিন প্যানেল
-- -----------------------------------------------------------------------------
insert into public.site_settings (key, value, is_public, label_bn) values
  ('store_name',           '"বইঘর"'::jsonb,                          true,  'দোকানের নাম'),
  ('store_tagline',        '"বাংলা বইয়ের বিশ্বস্ত ঠিকানা"'::jsonb,    true,  'ট্যাগলাইন'),
  ('contact_phone',        '"01700000000"'::jsonb,                    true,  'যোগাযোগের ফোন'),
  ('contact_email',        '"hello@example.com"'::jsonb,              true,  'ইমেইল'),
  ('contact_address',      '"ঢাকা, বাংলাদেশ"'::jsonb,                 true,  'ঠিকানা'),
  ('facebook_url',         '""'::jsonb,                               true,  'Facebook পেজ'),
  ('delivery_default_fee', '120'::jsonb,                              false, 'ডিফল্ট ডেলিভারি চার্জ'),
  ('free_delivery_note',   '"১০০০ টাকার উপরে ঢাকায় ফ্রি ডেলিভারি"'::jsonb, true, 'ফ্রি ডেলিভারি নোট'),

  -- ম্যানুয়াল পেমেন্টের তথ্য — চেকআউট পেজে দেখানো হয়
  ('bkash_number',         '"01700000000"'::jsonb,                    true,  'bKash নম্বর (Personal)'),
  ('nagad_number',         '"01700000000"'::jsonb,                    true,  'Nagad নম্বর (Personal)'),
  ('payment_instruction',  '"Send Money করুন উপরের নম্বরে, তারপর Transaction ID নিচে লিখুন।"'::jsonb,
                                                                      true,  'পেমেন্ট নির্দেশনা'),

  -- হোমপেজের ব্যানার
  ('hero_title',           '"বাংলার সেরা বই, এক ক্লিকেই"'::jsonb,      true,  'হিরো টাইটেল'),
  ('hero_subtitle',        '"দেশজুড়ে ক্যাশ অন ডেলিভারি — বই হাতে পেয়ে টাকা দিন"'::jsonb,
                                                                      true,  'হিরো সাবটাইটেল'),

  -- অর্ডার নিয়ে সতর্কবার্তা
  ('announcement',         '""'::jsonb,                               true,  'ঘোষণা বার (খালি = লুকানো)'),
  ('orders_paused',        'false'::jsonb,                            false, 'অর্ডার বন্ধ (true = বন্ধ)')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- ডেমো কুপন (প্রোডাকশনে যাওয়ার আগে মুছে ফেলুন বা is_active = false করুন)
-- -----------------------------------------------------------------------------
insert into public.coupons
  (code, description_bn, discount_type, discount_value, min_order, max_discount, usage_limit, ends_at) values
  ('WELCOME10', 'প্রথম অর্ডারে ১০% ছাড়',        'percent', 10, 500,  100, 500, '2027-12-31'::timestamptz),
  ('BOIMELA50', '৫০ টাকা ছাড়, ৮০০ টাকার উপরে', 'fixed',   50, 800, null, 200, '2027-12-31'::timestamptz)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- ডেমো বই (৫টি) — আপনার আসল বই যোগ করার আগে এগুলো দেখে ফরম্যাট বুঝে নিন।
-- মুছতে:  delete from public.books where slug like 'demo-%';
-- -----------------------------------------------------------------------------
insert into public.books (
  slug, title_bn, title_en, author, publisher, language, binding, pages, publication_year,
  description_bn, price, compare_at_price, stock_qty, category_id, is_featured, is_active
) values
  ('demo-pather-panchali',
   'পথের পাঁচালী', 'Pather Panchali', 'বিভূতিভূষণ বন্দ্যোপাধ্যায়', 'আনন্দ পাবলিশার্স',
   'bangla', 'hardcover', 288, 1929,
   'বাংলা সাহিত্যের অন্যতম শ্রেষ্ঠ উপন্যাস। অপু ও দুর্গার চোখ দিয়ে গ্রামবাংলার জীবন, দারিদ্র্য আর শৈশবের নিখুঁত আঁকিবুঁকি।',
   450.00, 550.00, 25, (select id from public.categories where slug = 'fiction'), true, true),

  ('demo-devdas',
   'দেবদাস', 'Devdas', 'শরৎচন্দ্র চট্টোপাধ্যায়', 'দে''জ পাবলিশিং',
   'bangla', 'paperback', 144, 1917,
   'অমর প্রেমের কাহিনি। পার্বতী আর চন্দ্রমুখীর মাঝখানে দাঁড়িয়ে থাকা দেবদাসের করুণ পরিণতি।',
   280.00, 320.00, 40, (select id from public.categories where slug = 'fiction'), true, true),

  ('demo-shesher-kobita',
   'শেষের কবিতা', 'Shesher Kabita', 'রবীন্দ্রনাথ ঠাকুর', 'বিশ্বভারতী',
   'bangla', 'paperback', 176, 1929,
   'অমিত রায় আর লাবণ্যের বুদ্ধিবৃত্তিক ও রোমান্টিক সম্পর্কের গল্প — রবীন্দ্রনাথের অন্যতম আধুনিক উপন্যাস।',
   320.00, null, 30, (select id from public.categories where slug = 'fiction'), true, true),

  ('demo-sananda',
   'সনন্দ', 'Sananda', 'হুমায়ূন আহমেদ', 'অন্যপ্রকাশ',
   'bangla', 'paperback', 96, 2010,
   'হুমায়ূন আহমেদের অনবদ্য গল্পগ্রন্থ। সহজ ভাষায় জীবনের ছোট ছোট মুহূর্তের গভীরতা।',
   200.00, 250.00, 12, (select id from public.categories where slug = 'stories'), false, true),

  ('demo-bangla-science',
   'বিজ্ঞানের বিস্ময়', 'Wonders of Science', 'মুহম্মদ জাফর ইকবাল', 'সময় প্রকাশন',
   'bangla', 'paperback', 208, 2019,
   'কিশোর-কিশোরীদের জন্য সহজ ভাষায় বিজ্ঞানের মজার দুনিয়া — মহাকাশ থেকে কোয়ান্টাম পর্যন্ত।',
   260.00, 300.00, 3, (select id from public.categories where slug = 'science'), false, true)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- পরের ধাপ: অ্যাডমিন অ্যাকাউন্ট তৈরি করা
--
-- ১) Supabase Dashboard → Authentication → Users → "Add user"
--    ইমেইল ও পাসওয়ার্ড দিন, "Auto Confirm User" টিক দিন।
-- ২) তারপর SQL Editor এ চালান:
--
--    insert into public.staff (user_id, full_name, role)
--    select id, 'Arefatul', 'admin'
--    from auth.users where email = 'your-email@example.com';
--
-- ৩) এই ইমেইল দিয়ে /login পেজে সাইন ইন করলে /admin এ ঢুকতে পারবেন।
-- -----------------------------------------------------------------------------


-- ─────────────────────────────────────────────────────────────────────────────
--  ধাপ 5/7  ·  20260924000005_storage.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
--  0005_storage.sql  —  ছবি রাখার bucket ও তার নিরাপত্তা নীতি
--
--  bucket: book-covers  (পাবলিক পড়া, শুধু staff লিখতে পারবে)
--
--  ফাইল রাখার নিয়ম:
--    book-covers/<book-id>/cover.webp
--    book-covers/<book-id>/gallery-1.webp
--  একই ফোল্ডারে বইয়ের সব ছবি থাকলে পরে ম্যানেজ করা সহজ হয়।
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-covers',
  'book-covers',
  true,                                    -- public: ছবি সবার দেখার জন্য
  5242880,                                 -- ৫ MB সর্বোচ্চ ফাইল সাইজ
  array['image/jpeg','image/png','image/webp','image/avif','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
--  storage.objects এর পলিসি
--  (Storage এর টেবিলেও RLS আছে — নিয়ম টেবিল পলিসির মতোই।)
-- -----------------------------------------------------------------------------

-- পুরনো পলিসি থাকলে মুছে নতুন করে বসানো হয় (idempotent)
drop policy if exists "book_covers_public_read"   on storage.objects;
drop policy if exists "book_covers_staff_insert"  on storage.objects;
drop policy if exists "book_covers_staff_update"  on storage.objects;
drop policy if exists "book_covers_staff_delete"  on storage.objects;

-- যে কেউ ছবি দেখতে পারবে (ওয়েবসাইটে দেখানোর জন্য দরকার)
create policy "book_covers_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'book-covers');

-- শুধু staff নতুন ছবি আপলোড করতে পারবে
create policy "book_covers_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'book-covers' and public.is_staff());

create policy "book_covers_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'book-covers' and public.is_staff())
  with check (bucket_id = 'book-covers' and public.is_staff());

create policy "book_covers_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'book-covers' and public.is_staff());

-- =============================================================================
--  কেন NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY নয়, SUPABASE_SECRET_KEY দিয়েও
--  আপলোড করা যায়?
--
--  ব্রাউজার থেকে আপলোড করলে publishable key + উপরের staff পলিসি — দুটোই
--  যথেষ্ট, এবং এটাই বেশি নিরাপদ (কোনো সার্ভার সিক্রেট লাগে না)।
--
--  `SUPABASE_SECRET_KEY` শুধু তখন দরকার যখন সার্ভার থেকে ব্যাচ আপলোড
--  করতে হয় (যেমন ৫০০ বইয়ের ছবি একবারে)। সেটার জন্য
--  `src/lib/supabase/admin.ts` এর ক্লায়েন্ট ব্যবহার করুন — RLS বাইপাস করে।
--
--  ⚠️ `supabase/README.md` এ আপলোড করার ধাপগুলো লেখা আছে।
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
--  ধাপ 6/7  ·  20260924000006_rate_limit.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
--  0006_rate_limit.sql  —  অর্ডার স্প্যাম ঠেকানো
--
--  সমস্যা: কেউ স্ক্রিপ্ট দিয়ে একই নম্বর থেকে শত শত ভুয়া COD অর্ডার দিতে পারে।
--          প্রতিটি অর্ডার স্টক কমায় এবং আপনার সময় নষ্ট করে (ফোন করে বাতিল করতে হয়)।
--
--  সমাধান: দুটি স্তর
--    ১) `order_rate_limit_check()` — অ্যাপ আগেই জিজ্ঞেস করে, ফলে কাস্টমার
--       সুন্দর বাংলা বার্তা দেখে
--    ২) একটি ট্রিগার — একই সাথে অনেক রিকোয়েস্ট এলেও ডেটাবেসেই আটকে দেয়
--       (স্তর ১ রেস-কন্ডিশনে ফাঁকা জায়গা রাখে, তাই এটা দরকার)
-- =============================================================================

-- সীমা এক জায়গায় — বদলাতে চাইলে শুধু এই মানগুলো এডিট করুন।
create or replace function public.order_rate_limit_rules()
returns table (per_10_min integer, per_24_hours integer, window_minutes integer)
language sql
immutable
as $$
  select 3, 10, 10;
$$;

-- -----------------------------------------------------------------------------
-- দ্রুত গোনার জন্য ইনডেক্স (ফোন + সময় — দুইটাই লাগে)
-- -----------------------------------------------------------------------------
create index if not exists orders_phone_created_idx
  on public.orders (customer_phone, created_at desc);

-- -----------------------------------------------------------------------------
-- স্তর ১: অ্যাপের জন্য চেক (anon কল করতে পারে, তাই SECURITY DEFINER)
--   রিটার্ন: { allowed: true }  অথবা  { allowed: false, code, message, retry_after_minutes }
-- -----------------------------------------------------------------------------
create or replace function public.order_rate_limit_check(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_phone     text;
  v_rules     record;
  v_recent    integer;
  v_daily     integer;
  v_oldest    timestamptz;
begin
  if p_phone is null or btrim(p_phone) = '' then
    return jsonb_build_object('allowed', true);
  end if;

  v_phone := public.normalize_bd_phone(p_phone);
  if v_phone is null or v_phone = '' then
    return jsonb_build_object('allowed', true);
  end if;

  select * into v_rules from public.order_rate_limit_rules();

  select count(*), min(created_at)
  into v_recent, v_oldest
  from public.orders
  where customer_phone = v_phone
    and created_at > now() - make_interval(mins => v_rules.window_minutes);

  if v_recent >= v_rules.per_10_min then
    return jsonb_build_object(
      'allowed', false,
      'code', 'RATE_LIMITED',
      'message', 'এই নম্বর থেকে সদ্য কয়েকটি অর্ডার এসেছে। ১০ মিনিট পর আবার চেষ্টা করুন, অথবা সরাসরি আমাদের কল করুন।',
      'retry_after_minutes', v_rules.window_minutes
    );
  end if;

  select count(*) into v_daily
  from public.orders
  where customer_phone = v_phone
    and created_at > now() - interval '24 hours';

  if v_daily >= v_rules.per_24_hours then
    return jsonb_build_object(
      'allowed', false,
      'code', 'DAILY_LIMIT',
      'message', 'এক দিনে এই নম্বর থেকে অনেকগুলো অর্ডার হয়েছে। আমাদের সরাসরি কল করে কথা বলুন।',
      'retry_after_minutes', 60
    );
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

grant execute on function public.order_rate_limit_check(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- স্তর ২: ডেটাবেস-স্তরের পাহারাদার (রেস-কন্ডিশন বন্ধ করে)
--
--   অ্যাডভাইজরি লক কেন? দুটি রিকোয়েস্ট একই সময়ে এলে দুজনেই "সীমার নিচে"
--   দেখতে পায় এবং দুটোই ঢুকে যায়। `pg_advisory_xact_lock` একই ফোনের দুই
--   ট্রানজেকশনকে একসাথে চলতে দেয় না — ফলে গোনাটা নির্ভুল হয়।
--   লক ট্রানজেকশন শেষে নিজে থেকেই ছেড়ে যায়।
-- -----------------------------------------------------------------------------
create or replace function public.enforce_order_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rules  record;
  v_recent integer;
  v_daily  integer;
begin
  -- staff (অ্যাডমিন) এর হাত আর বাঁধব না — টেস্ট/ম্যানুয়াল এন্ট্রি দরকার হতে পারে
  if public.is_staff() then
    return new;
  end if;

  -- এই ফোনের জন্য অন্য ট্রানজেকশন শেষ হওয়া পর্যন্ত অপেক্ষা করো
  perform pg_advisory_xact_lock(hashtext('order_rl:' || new.customer_phone));

  select * into v_rules from public.order_rate_limit_rules();

  select count(*) into v_recent
  from public.orders
  where customer_phone = new.customer_phone
    and created_at > now() - make_interval(mins => v_rules.window_minutes);

  if v_recent >= v_rules.per_10_min then
    raise exception 'RATE_LIMITED: এই নম্বর থেকে সদ্য কয়েকটি অর্ডার এসেছে, একটু পরে চেষ্টা করুন।'
      using errcode = 'P0001';
  end if;

  select count(*) into v_daily
  from public.orders
  where customer_phone = new.customer_phone
    and created_at > now() - interval '24 hours';

  if v_daily >= v_rules.per_24_hours then
    raise exception 'DAILY_LIMIT: এক দিনে এই নম্বর থেকে অনেকগুলো অর্ডার হয়েছে।'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_rate_limit on public.orders;
create trigger trg_orders_rate_limit
  before insert on public.orders
  for each row execute function public.enforce_order_rate_limit();

-- -----------------------------------------------------------------------------
-- পরীক্ষা করার উপায় (SQL Editor এ চালান):
--
--   select public.order_rate_limit_check('01712345678');
--   -- → {"allowed": true}
--
--   -- কয়েকটা ডামি অর্ডার বানিয়ে আবার চালালে false আসবে।
--   -- মুছতে: delete from public.orders where customer_phone like '017999%';
-- -----------------------------------------------------------------------------


-- ─────────────────────────────────────────────────────────────────────────────
--  ধাপ 7/7  ·  20260924000007_courier.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
--  0007_courier.sql  —  কুরিয়ার ইন্টিগ্রেশনের জন্য দরকারি কলাম
--
--  `courier` ও `tracking_code` কলাম আগেই ছিল। এখানে যোগ হচ্ছে:
--    courier_consignment_id — কুরিয়ারের নিজের আইডি (স্টেটাস জানতে লাগে)
--    courier_synced_at      — শেষবার কখন স্টেটাস মিলিয়ে দেখা হয়েছে
--
--  ⚠️ পুরনো migration এডিট না করে নতুন ফাইল কেন?
--     ইতিমধ্যে চালানো ফাইল বদলালে ডেটাবেস আর কোডের মধ্যে ফারাক তৈরি হয়।
--     সবসময় নতুন ফাইল — এটাই নিরাপদ অভ্যাস।
-- =============================================================================

alter table public.orders
  add column if not exists courier_consignment_id text,
  add column if not exists courier_synced_at timestamptz;

comment on column public.orders.courier_consignment_id is
  'SteadFast এর consignment_id — স্টেটাস জানতে এটি দিয়ে কল করা হয়।';
comment on column public.orders.courier_synced_at is
  'সর্বশেষ কুরিয়ার স্টেটাস সিঙ্কের সময়। পুরনো হলে আবার সিঙ্ক করা উচিত।';

-- কুরিয়ার স্টেটাস সিঙ্ক করতে ট্র্যাকিং কোড / কনসাইনমেন্ট আইডি দিয়ে খোঁজা হয়
create index if not exists orders_tracking_code_idx
  on public.orders (tracking_code)
  where tracking_code is not null;

create index if not exists orders_awaiting_sync_idx
  on public.orders (shipped_at)
  where status = 'shipped';

-- =============================================================================
--  কুরিয়ার তথ্য সেভ করার RPC
--
--  কেন আলাদা ফাংশন? `admin_set_order_status()` শুধু স্টেটাস বদলায়।
--  কুরিয়ার বুকিংয়ের সময় consignment_id + tracking_code একসাথে বসাতে হয়,
--  আর সেটাও staff-যাচাইয়ের ভেতর দিয়ে যাওয়া উচিত।
-- =============================================================================
create or replace function public.admin_set_courier_info(
  p_order_id        uuid,
  p_courier         text,
  p_consignment_id  text default null,
  p_tracking_code   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  update public.orders
  set courier                = coalesce(nullif(btrim(coalesce(p_courier, '')), ''), courier),
      courier_consignment_id = coalesce(nullif(btrim(coalesce(p_consignment_id, '')), ''), courier_consignment_id),
      tracking_code          = coalesce(nullif(btrim(coalesce(p_tracking_code, '')), ''), tracking_code),
      courier_synced_at      = now()
  where id = p_order_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_set_courier_info(uuid, text, text, text) to authenticated;

-- =============================================================================
--  কুরিয়ার থেকে পাওয়া স্টেটাস সেভ করা
--
--  এখানে তিনটি ফাংশন আছে — কারণ দুই ধরনের কলার আছে:
--
--    callar ১: অ্যাডমিন প্যানেলের staff  → `admin_sync_courier_status()`
--              (is_staff() যাচাই করে)
--    callar ২: Vercel Cron (কোনো ইউজার সেশন নেই) → `system_sync_courier_status()`
--              (anon/authenticated এর জন্য সম্পূর্ণ বন্ধ; শুধু secret key
--               দিয়ে কল করা যায়)
--
--  কেন একটাই ফাংশনে `if auth.uid() is null then allow` লেখা হয়নি?
--  ওরকম "সূক্ষ্ম" নিয়ম পরে কেউ ভুল বুঝে নিরাপত্তা ফাঁক করে ফেলে।
--  দুটি আলাদা, স্পষ্ট ফাংশন অনেক নিরাপদ — এবং পড়তেও সহজ।
--
--  আসল কাজটা `_sync_courier_core()` এ — দুটি wrapper সেটাই কল করে।
-- =============================================================================

-- ---------- ভেতরের আসল কাজ (সবার জন্য বন্ধ) ----------
create or replace function public._sync_courier_core(
  p_order_id    uuid,
  p_new_status  text,
  p_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o        public.orders;
  v_new    public.order_status;
  v_restock boolean := false;
begin
  begin
    v_new := p_new_status::public.order_status;
  exception when invalid_text_representation then
    return jsonb_build_object('ok', false, 'code', 'BAD_STATUS');
  end;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  -- ইতিমধ্যে চূড়ান্ত অবস্থায় থাকলে আর ছোঁব না
  if o.status in ('delivered', 'cancelled', 'returned') then
    update public.orders set courier_synced_at = now() where id = o.id;
    return jsonb_build_object('ok', true, 'skipped', true, 'status', o.status);
  end if;

  if v_new = o.status then
    update public.orders set courier_synced_at = now() where id = o.id;
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;

  -- কুরিয়ার বলছে ফেরত এসেছে — স্টক ফিরিয়ে দাও
  if v_new in ('cancelled', 'returned') then
    v_restock := true;
    update public.books b
    set stock_qty = b.stock_qty + oi.quantity
    from public.order_items oi
    where oi.order_id = o.id and b.id = oi.book_id;
  end if;

  update public.orders
  set status            = v_new,
      delivered_at      = case when v_new = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
      cancelled_at      = case when v_new in ('cancelled','returned') then coalesce(cancelled_at, now()) else cancelled_at end,
      payment_status    = case when v_new = 'delivered' and payment_method = 'cod'
                               then 'paid'::public.payment_status else payment_status end,
      courier_synced_at = now()
  where id = o.id;

  insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
  values (o.id, o.status, v_new,
          coalesce(p_note, 'কুরিয়ার থেকে স্বয়ংক্রিয়ভাবে আপডেট'), null);

  return jsonb_build_object('ok', true, 'status', v_new, 'restocked', v_restock);
end;
$$;

revoke all on function public._sync_courier_core(uuid, text, text) from public, anon, authenticated;

-- ---------- wrapper ১: অ্যাডমিন প্যানেল ----------
create or replace function public.admin_sync_courier_status(
  p_order_id    uuid,
  p_new_status  text,
  p_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  return public._sync_courier_core(p_order_id, p_new_status, p_note);
end;
$$;

grant execute on function public.admin_sync_courier_status(uuid, text, text) to authenticated;

-- ---------- wrapper ২: শুধু সার্ভার / Cron (secret key) ----------
create or replace function public.system_sync_courier_status(
  p_order_id    uuid,
  p_new_status  text,
  p_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public._sync_courier_core(p_order_id, p_new_status, p_note);
end;
$$;

revoke all on function public.system_sync_courier_status(uuid, text, text) from public, anon, authenticated;

-- =============================================================================
--  যেসব অর্ডারের স্টেটাস সিঙ্ক করা দরকার তাদের তালিকা
-- =============================================================================
create or replace function public.orders_needing_courier_sync(p_limit integer default 30)
returns table (
  id uuid,
  order_number text,
  courier text,
  courier_consignment_id text,
  tracking_code text,
  courier_synced_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.order_number, o.courier, o.courier_consignment_id,
         o.tracking_code, o.courier_synced_at
  from public.orders o
  where o.status = 'shipped'
    and (o.tracking_code is not null or o.courier_consignment_id is not null)
    and (o.courier_synced_at is null or o.courier_synced_at < now() - interval '6 hours')
  order by o.shipped_at asc nulls last
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.orders_needing_courier_sync(integer) from public, anon, authenticated;
