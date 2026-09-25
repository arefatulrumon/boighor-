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
