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
-- -----------------------------------------------------------------------------
create type public.order_status   as enum ('pending','confirmed','packed','shipped','delivered','cancelled','returned');
create type public.payment_method as enum ('cod','bkash','nagad');
create type public.payment_status as enum ('unpaid','pending_verification','paid','refunded','failed');
create type public.book_language  as enum ('bangla','english','arabic','hindi','other');
create type public.book_binding   as enum ('paperback','hardcover','spiral','ebook');
create type public.discount_type  as enum ('percent','fixed');
create type public.staff_role     as enum ('admin','manager','fulfillment');

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
create table public.staff (
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
create table public.categories (
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

create index categories_parent_idx on public.categories (parent_id);
create index categories_active_sort_idx on public.categories (is_active, sort_order);

-- =============================================================================
-- ৩. BOOKS  —  বইয়ের মূল ক্যাটালগ
-- =============================================================================
create table public.books (
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

create index books_category_idx      on public.books (category_id);
create index books_active_idx        on public.books (is_active, created_at desc);
create index books_featured_idx      on public.books (is_featured) where is_active;
create index books_search_trgm_idx   on public.books using gin (search_text gin_trgm_ops);
create index books_title_trgm_idx    on public.books using gin (title_bn gin_trgm_ops);

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
create table public.delivery_zones (
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
create table public.coupons (
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
create table public.orders (
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

create index orders_status_idx      on public.orders (status, created_at desc);
create index orders_phone_idx       on public.orders (customer_phone);
create index orders_created_idx     on public.orders (created_at desc);
create index orders_payment_idx     on public.orders (payment_status) where payment_status <> 'paid';

-- =============================================================================
-- ৭. ORDER ITEMS  —  অর্ডারের লাইন আইটেম (বইয়ের তথ্য snapshot করা হয়)
--    কেন snapshot? পরে বইয়ের দাম/নাম বদলালেও পুরনো ইনভয়েস অপরিবর্তিত থাকবে।
-- =============================================================================
create table public.order_items (
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

create index order_items_order_idx on public.order_items (order_id);
create index order_items_book_idx  on public.order_items (book_id);

-- =============================================================================
-- ৮. ORDER STATUS HISTORY  —  অর্ডারের অডিট ট্রেইল
-- =============================================================================
create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  note        text,
  changed_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- =============================================================================
-- ৯. REVIEWS  —  কাস্টমার রিভিউ (অ্যাডমিন অ্যাপ্রুভ করলে সাইটে দেখাবে)
-- =============================================================================
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  author_name text not null,
  author_phone text,
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  is_approved boolean not null default false,
  created_at  timestamptz not null default now()
);

create index reviews_book_idx on public.reviews (book_id, is_approved, created_at desc);

-- =============================================================================
-- ১০. SITE SETTINGS  —  key/value কনফিগ (bKash নম্বর, হোমপেজের ব্যানার ইত্যাদি)
--     is_public = true হলে ওয়েবসাইট থেকে পড়া যাবে, নাহলে শুধু staff।
-- =============================================================================
create table public.site_settings (
  key        text primary key,
  value      jsonb not null,
  is_public  boolean not null default false,
  label_bn   text,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- ট্রিগার সংযুক্তি
-- =============================================================================
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
