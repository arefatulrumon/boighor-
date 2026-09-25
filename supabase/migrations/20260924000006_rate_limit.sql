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
