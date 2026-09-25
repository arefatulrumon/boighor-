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
