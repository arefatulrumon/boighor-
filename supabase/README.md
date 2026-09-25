# Supabase সেটআপ — ধাপে ধাপে

এই ডকুমেন্ট ফলো করলে ১৫ মিনিটে ডেটাবেস তৈরি ও প্রস্তুত হয়ে যাবে।
সব কিছু **Free plan** এ চলবে।

---

## ১. প্রজেক্ট তৈরি

1. [supabase.com](https://supabase.com) এ সাইন ইন করুন → **New project**
2. তথ্য দিন:
   - **Name**: `boighor` (বা যা ইচ্ছা)
   - **Database Password**: শক্ত পাসওয়ার্ড — **এটা নিরাপদে রেখে দিন**
   - **Region**: 🇸🇬 **Southeast Asia (Singapore)** — বাংলাদেশের জন্য সবচেয়ে কাছের
3. প্রজেক্ট তৈরি হতে ২–৩ মিনিট লাগবে।

> **⚠️ Free plan এর সীমা** (supabase.com/pricing থেকে যাচাই করা):
> ৫০০ MB ডেটাবেস, ১ GB ফাইল স্টোরেজ, ৫ GB egress, সর্বোচ্চ **২টি অ্যাক্টিভ
> প্রজেক্ট**, ৫০,০০০ মাসিক অ্যাক্টিভ ইউজার। **৭ দিন কোনো রিকোয়েস্ট না হলে
> প্রজেক্ট অটো-পজ হয়ে যায়** — প্রথম ডেলিভারির পর থেকেই অর্ডার আসতে থাকলে
> এই সমস্যা হবে না। লোকাল ডেভেলপমেন্টে ৭ দিনের বেশি বিরতি দিলে
> Dashboard থেকে "Restore" চেপে আবার চালু করতে হবে।
>
> **আরও দুটি জিনিস ফ্রি প্ল্যানে নেই:** অটো-ব্যাকআপ এবং লগ রিটেনশন
> (মাত্র ১ দিন)। তাই মাসে একবার নিজে CSV ব্যাকআপ নেওয়া জরুরি —
> `supabase/README.md` §৯ দেখুন।

---

## ২. API কী সংগ্রহ

**Project Settings → API Keys** এ যান। তিনটি মান লাগবে:

| কী | উদাহরণ | কোথায় ব্যবহার হয় |
|---|---|---|
| Project URL | `https://abcdefg.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| **Publishable key** | `sb_publishable_xxx` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Secret key** | `sb_secret_xxx` | `SUPABASE_SECRET_KEY` |

> 💡 ২০২৬ সালে Supabase পুরনো `anon` ও `service_role` কী বন্ধ করে দিচ্ছে।
> নতুন নাম **publishable** ও **secret**। Dashboard এ দুটোই দেখা যেতে পারে —
> নতুনগুলো (`sb_publishable_` / `sb_secret_`) ব্যবহার করুন।

**Publishable key ব্রাউজারে যাবে** — এটা গোপন কিছু নয়। নিরাপত্তা আসে
Row Level Security (RLS) থেকে, যা এই প্রজেক্টে প্রতিটি টেবিলে চালু আছে।

**Secret key কখনো `NEXT_PUBLIC_` প্রিফিক্স দেবেন না** — ওটা ব্রাউজারে চলে যায়
এবং RLS বাইপাস করে।

---

## ৩. ডেটাবেস স্কিমা চালান

### ✅ সহজ উপায় — একবারেই সব (এই পথটাই আগে চেষ্টা করুন)

1. `supabase/RUN_ALL_IN_SQL_EDITOR.sql` ফাইলটি খুলুন
2. **পুরোটা সিলেক্ট করে কপি করুন** (Ctrl+A → Ctrl+C)
3. Supabase → **SQL Editor** → **New query** → পেস্ট (Ctrl+V) → **Run**

৭টি ফাইল ক্রম অনুযায়ী জোড়া দেওয়া আছে — তাই একটা বাদ পড়া বা ক্রম ভুল
হওয়ার সম্ভাবনা নেই। এটা `npm run db:bundle` দিয়ে তৈরি হয়, তাই
**হাতে এডিট করবেন না** — আসল source হলো `migrations/` ফোল্ডার
(migration বদলালে আবার `npm run db:bundle` চালান)।

চালানোর পর যাচাই করুন:

```sql
select count(*) as tables from information_schema.tables
  where table_schema = 'public';        -- ১১টির মতো টেবিল
select count(*) as books from public.books;   -- ৫টি ডেমো বই
select public.order_rate_limit_check('01712345678');  -- {"allowed": true}
```

---

### বিকল্প উপায় — একটি একটি করে

নিচের ৭টি ফাইল **এই ক্রমেই** `SQL Editor` এ পেস্ট করে **Run** চাপুন:

| ক্রম | ফাইল | কী করে |
|---|---|---|
| ১ | `migrations/20260924000001_schema.sql` | টেবিল, টাইপ, ইনডেক্স, ট্রিগার |
| ২ | `migrations/20260924000002_functions.sql` | `create_order()`, `track_order()` ইত্যাদি RPC |
| ৩ | `migrations/20260924000003_rls.sql` | Row Level Security নীতিমালা |
| ৪ | `migrations/20260924000004_seed.sql` | ক্যাটাগরি, ডেলিভারি চার্জ, ডেমো বই |
| ৫ | `migrations/20260924000005_storage.sql` | ছবির bucket ও তার পলিসি |
| ৬ | `migrations/20260924000006_rate_limit.sql` | অর্ডার স্প্যাম ঠেকানো (রেট লিমিট) |
| ৭ | `migrations/20260924000007_courier.sql` | কুরিয়ার কলাম + স্টেটাস সিঙ্ক ফাংশন |

> **ক্রম গুরুত্বপূর্ণ!** ৩ নম্বর ফাইল `is_staff()` ফাংশন ব্যবহার করে, যেটা
> ২ নম্বরে তৈরি হয়। উল্টো করে চালালে এরর দেবে।
>
> **আগেই চালিয়ে ফেলেছেন?** শুধু ৬ ও ৭ নম্বর ফাইল দুটি চালালেই হবে —
> সব ফাইল বারবার চালানো নিরাপদ (`create or replace`, `if not exists`)।

ফাইল চালানো হয়ে গেলে **Table Editor** এ `books`, `orders`, `categories`
টেবিলগুলো দেখা যাবে।

### Supabase CLI দিয়ে (বিকল্প)

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

---

## ৪. অ্যাডমিন অ্যাকাউন্ট তৈরি — সবচেয়ে গুরুত্বপূর্ণ ধাপ

শুধু লগইন করতে পারলেই কেউ অ্যাডমিন হতে পারবে **না**।
`public.staff` টেবিলে একটা row থাকতে হবে — এটাই আসল নিয়ম।

### ধাপ ৪.১ — ইউজার তৈরি

**Authentication → Users → Add user → Create new user**

- Email: আপনার ইমেইল
- Password: শক্ত পাসওয়ার্ড
- ✅ **Auto Confirm User** টিক দিন (নাহলে ইমেইল ভেরিফিকেশন লাগবে)

### ধাপ ৪.২ — staff হিসেবে যোগ করুন

**SQL Editor** এ চালান:

```sql
insert into public.staff (user_id, full_name, role)
select id, 'আপনার নাম', 'admin'
from auth.users
where email = 'your-email@example.com';
```

এখন `/login` পেজে গিয়ে সাইন ইন করলে `/admin` এ ঢুকতে পারবেন।
এই step বাদ পড়লে লগইন তো হবে, কিন্তু সরাসরি `/login?error=not_staff` এ
ফিরে আসবে — কারণ RLS আপনাকে staff হিসেবে চেনে না।

### ভূমিকা (role) অনুযায়ী পারমিশন

| role | কী করতে পারে |
|---|---|
| `admin` | সব কিছু, এমনকি নতুন staff যোগ করা |
| `manager` | অর্ডার, বই, রিভিউ, সেটিংস |
| `fulfillment` | শুধু অর্ডার দেখা ও স্টেটাস বদলানো |

নতুন কর্মী যোগ করতে ধাপ ৪.১ ও ৪.২ আবার করুন, role বদলে।

---

## ৫. ডেলিভারি চার্জ ঠিক করুন

`0004_seed.sql` এ ডিফল্ট চার্জ বসানো আছে (ঢাকা ৬০৳, বাইরে ১২০–১৩০৳)।
আপনার আসল কুরিয়ার রেট অনুযায়ী বদলান:

```sql
update public.delivery_zones set fee = 80,  free_above = 1500 where division = 'ঢাকা';
update public.delivery_zones set fee = 150, free_above = 2000 where division = 'চট্টগ্রাম';
-- ... বাকিগুলোও
```

`free_above` মানে: সাবটোটাল এই পরিমাণ ছাড়ালে ডেলিভারি ফ্রি।

---

## ৬. ছবি আপলোড (বইয়ের কভার)

`book-covers` bucket ইতিমধ্যেই তৈরি (ধাপ ৩ এর ৫ নম্বর ফাইল)।

### সহজ পথ — Supabase Dashboard

1. **Storage → book-covers → Upload file**
2. ফাইলে ক্লিক করে **Get URL** → **Public URL** কপি করুন
3. `/admin/books/new` ফর্মে "কভার ছবির URL" ঘরে পেস্ট করুন

### সুন্দর পথ — ফোল্ডার সাজান

প্রতিটি বইয়ের জন্য আলাদা ফোল্ডার রাখলে ম্যানেজ করা সহজ:

```
book-covers/
├── 3f2a1b4c-.../cover.webp
├── 3f2a1b4c-.../gallery-1.webp
└── 7d9e2f1a-.../cover.webp
```

### টিপস

- **WebP** ফরম্যাট ব্যবহার করুন — একই মানে ৩০–৫০% ছোট ফাইল।
- ছবির প্রস্তাবিত সাইজ: **৮০০ × ১০৬৭ px** (৩:৪ অনুপাত)
- ফাইল ৫ MB এর কম রাখুন (bucket এ সীমা দেওয়া আছে)

---

## ৭. কুরিয়ার (SteadFast) সংযুক্ত করা — ইচ্ছা হলে

**এটা না করলেও দোকান পুরোপুরি চলে।** না করলে অ্যাডমিন প্যানেলে
"কুরিয়ারে বুক করুন" বাটন নিষ্ক্রিয় থাকবে, কিন্তু:

- ট্র্যাকিং কোড হাতে লিখে স্টেটাস আপডেট করা যাবে
- **"কুরিয়ারের জন্য CSV"** বাটন দিয়ে একবারে ৫০টি অর্ডার এক্সপোর্ট করে
  কুরিয়ারের পোর্টালে পেস্ট করা যাবে

### সংযুক্ত করতে

1. [steadfast.com.bd](https://steadfast.com.bd/) এ Merchant অ্যাকাউন্ট খুলুন
2. Merchant Panel → API থেকে **Api Key** ও **Secret Key** নিন
3. `.env.local` (এবং Vercel) এ বসান:

```env
STEADFAST_API_KEY=your_api_key
STEADFAST_SECRET_KEY=your_secret_key
```

4. ডেভ সার্ভার রিস্টার্ট করুন → `/admin/orders/[যেকোনো অর্ডার]` এ
   কুরিয়ার কার্ডে **"কুরিয়ারে বুক করুন"** বাটন সক্রিয় হয়ে যাবে।

বুক করলে কী হয়: ট্র্যাকিং কোড ও consignment ID স্বয়ংক্রিয়ভাবে সেভ হয়,
অর্ডারের স্টেটাস **পাঠানো হয়েছে** হয়ে যায়, আর COD অর্ডারে কুরিয়ার
কাস্টমারের কাছে টাকা তুলবে।

### স্বয়ংক্রিয় স্টেটাস সিঙ্ক (Cron)

`vercel.json` এ **প্রতিদিন একবারের** একটা Cron সেট করা আছে (রাত ৩টা UTC =
সকাল ৯টা বাংলাদেশ সময়) — যেসব অর্ডার পাঠানো হয়েছে কিন্তু ডেলিভারি হয়নি,
সেগুলোর স্টেটাস কুরিয়ার থেকে টেনে আনা হয়।

> ⚠️ **Vercel Hobby plan এ দিনে একবারের বেশি Cron চলে না।**
> (সূত্র: vercel.com/docs/cron-jobs → Hobby: "Once per day")
> এর বেশি চাইলে **deployment-ই ফেল করে** এই এররে:
> *"Hobby accounts are limited to daily cron jobs."*
> তাই `0 */6 * * *` লেখা যাবে না — `0 3 * * *` লিখতে হবে।
>
> **এর চেয়ে ঘন ঘন সিঙ্ক দরকার হলে:** [cron-job.org](https://cron-job.org)
> জাতীয় ফ্রি সার্ভিস দিয়ে প্রতি ঘণ্টায় একই এন্ডপয়েন্টে কল করুন,
> `Authorization: Bearer <CRON_SECRET>` হেডার সহ। Vercel এর সীমা এতেও
> লাগবে না — কারণ এটা সাধারণ HTTPS রিকোয়েস্ট, Cron নয়।

এর জন্য একটি টোকেন দরকার:

```bash
# লম্বা র‍্যান্ডম স্ট্রিং বানান
openssl rand -hex 32
```

সেটা `CRON_SECRET` নামে Vercel → Settings → Environment Variables এ বসান।
(লোকালে টেস্ট করতে: `curl -H "Authorization: Bearer <secret>" http://localhost:3000/api/cron/courier-sync`)

### নতুন কুরিয়ার যোগ করতে

`src/lib/courier/` ফোল্ডারে দেখুন — `steadfast.ts` কে কপি করে একই
`CourierProvider` ইন্টারফেস মানুন, তারপর `index.ts` এর `PROVIDERS`
অ্যারেতে যোগ করুন। অ্যাডমিন UI স্বয়ংক্রিয়ভাবে সেটাও দেখাবে।

---

## ৮. নিরাপত্তা যাচাই — নিজে পরীক্ষা করুন

এই কমান্ডগুলো দিয়ে নিশ্চিত করুন আপনার ডেটা সুরক্ষিত। **SQL Editor** এ চালান,
অথবা Dashboard এর API Playground এ।

```sql
-- ১) RLS সব টেবিলে চালু আছে কি না — সবগুলো true হওয়া উচিত
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- ২) anon কী দিয়ে orders পড়া যায় কি না — ০ হওয়া উচিত
set role anon;
select count(*) from public.orders;        -- ⚠️ 0 আসতে হবে
reset role;

-- ৩) anon কী দিয়ে শুধু সক্রিয় বই দেখা যায়
set role anon;
select count(*) from public.books;         -- ✅ সক্রিয় বইয়ের সংখ্যা
select count(*) from public.coupons;       -- ⚠️ 0 আসতে হবে (কুপন গোপন)
reset role;

-- ৪) কে staff?
select s.full_name, s.role, u.email
from public.staff s join auth.users u on u.id = s.user_id;

-- ৫) রেট লিমিট কাজ করছে কি? (প্রথমবার true আসবে)
select public.order_rate_limit_check('01712345678');

-- ৬) কুরিয়ার সিঙ্কের ফাংশনগুলো কি সুরক্ষিত?
--    _sync_courier_core ও system_sync_courier_status এ anon এর
--    EXECUTE থাকা উচিত নয় — এই কুয়েরিতে কোনো সারি আসলে ভালো।
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('_sync_courier_core', 'system_sync_courier_status')
  and grantee in ('anon', 'authenticated', 'PUBLIC');
```

### যা যা নিশ্চিত করা আছে

- ✅ `orders`, `order_items` — anon এর **কোনো** অ্যাক্সেস নেই
- ✅ অর্ডার তৈরি হয় শুধু `create_order()` RPC দিয়ে, যেখানে দাম সার্ভারে হিসাব হয়
- ✅ কুপন `anon` পড়তে পারে না (শুধু `validate_coupon()` দিয়ে যাচাই)
- ✅ রিভিউ অ্যাপ্রুভ না করে সাইটে আসে না
- ✅ অ্যাডমিন প্যানেল তিন স্তরে সুরক্ষিত (proxy → layout → RLS)

---

## ৯. ডেটা ব্যাকআপ

Free plan এ অটো-ব্যাকআপ নেই। মাসে অন্তত একবার:

**Database → Backups** থেকে ম্যানুয়াল ব্যাকআপ নিন, বা CSV এক্সপোর্ট করুন:

```sql
-- বইয়ের তালিকা CSV হিসেবে (Table Editor → Export → CSV)
select * from public.books;
select * from public.orders order by created_at desc;
```

> অর্ডারের ডেটা হারানো মানে ব্যবসার রেকর্ড হারানো। মাসে একবার
> Google Sheets এ এক্সপোর্ট করে রাখা ভালো অভ্যাস।

---

## সমস্যা হলে

| সমস্যা | কারণ ও সমাধান |
|---|---|
| `/login` এ লগইন হচ্ছে কিন্তু `/admin` এ ঢুকছে না | `public.staff` এ row নেই → ধাপ ৪.২ চালান |
| "new row violates row-level security policy" | যে ইউজার কাজটি করছে সে staff নয়, বা পলিসি ভুল |
| `create_order` ফাংশন খুঁজে পাচ্ছে না | `0002_functions.sql` চালানো হয়নি |
| ৭ দিন পর সাইট "fetch failed" দিচ্ছে | প্রজেক্ট paused → Dashboard → Restore |
| ছবি আপলোড হচ্ছে না | `0005_storage.sql` চালাননি, বা ফাইল ৫ MB এর বেশি |
| "এই নম্বর থেকে সদ্য কয়েকটি অর্ডার এসেছে" | রেট লিমিট কাজ করছে (১০ মিনিটে ৩টি) — লিমিট বদলাতে: `select public.order_rate_limit_rules();` দেখুন |
| কুরিয়ার বুক হচ্ছে না | `STEADFAST_API_KEY` / `STEADFAST_SECRET_KEY` সেট করা নেই, বা ডেভ সার্ভার রিস্টার্ট করেননি |
| Cron ৪০১ দিচ্ছে | Vercel এ `CRON_SECRET` সেট করা নেই, বা হেডারের টোকেন মিলছে না |
| Cron চলছে না | Vercel → Settings → Cron Jobs এ দেখুন; Hobby plan এ দিনে ২টি Cron চলে |
| Secret key দিয়ে REST কল → ৪০১ | ⚠️ **এটা কী ভুল নয়।** নিচের বক্সটি পড়ুন |

---

### ⚠️Secret key আর `User-Agent` — একটা বিভ্রান্তিকর ফাঁদ

Supabase secret key (`sb_secret_...`) **ব্রাউজার থেকে কাজ করে না**।
Supabase `User-Agent` হেডার দেখে বোঝে অনুরোধটি ব্রাউজার থেকে এসেছে কি না,
আর সন্দেহ হলে **HTTP 401** ফেরত দেয়। এটা নিরাপত্তার জন্য ইচ্ছাকৃত।

(সূত্র: Supabase docs → API keys → *Secret keys and elevated access*)

| কোন টুল দিয়ে কল | পাঠানো `User-Agent` | ফলাফল |
|---|---|---|
| ব্রাউজার, Postman, PowerShell `Invoke-WebRequest` | `Mozilla/5.0 ...` | ❌ 401 |
| `curl` | `curl/8.x` | ✅ কাজ করে |
| Node.js / `supabase-js` (সার্ভারে) | `node` | ✅ কাজ করে |
| পেস্ট করার মতো REST ক্লায়েন্ট | নিজের UA | সাধারণত কাজ করে |

**অর্থাৎ:** অ্যাপের ভেতরে secret key ঠিকঠাক কাজ করবে, কারণ `supabase-js`
সার্ভারে চলে। শুধু **হাতে টেস্ট করার সময়** এই 401 দেখে ভুলবেন না যেন
"কী নষ্ট" ভেবে ফেলেন।

**হাতে যাচাই করার সঠিক উপায়:**

```bash
# ✅ সঠিক (curl) — 404 মানে কী ঠিক আছে, শুধু টেবিল নেই
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://<ref>.supabase.co/rest/v1/books?select=id&limit=1" \
  -H "apikey: sb_secret_..."

# ❌ ভুল (ব্রাউজারে ঠিকানা খুলে দেখা) — সবসময় 401 আসবে
```

**আরেকটি জিনিস:** নতুন কীগুলো JWT নয়। তাই `Authorization: Bearer` এর
বদলে **`apikey` হেডারে** পাঠানো উচিত। `supabase-js` নিজেই দুটোই বসায়,
তাই কোডে কিছু বদলানোর দরকার নেই — শুধু হাতে curl করার সময় মনে রাখুন।
