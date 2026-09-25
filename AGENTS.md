# AGENTS.md — AI অ্যাসিস্ট্যান্টের জন্য নির্দেশিকা

> **তুমি যদি একটি AI হয় এবং এই কোডবেসে কাজ করতে চাও — এই ফাইলটি প্রথমে পড়ো।**
> এটি মানুষ ডেভেলপারদের জন্যও কাজে লাগবে।

---

## ০. শুরুতেই যা পড়বে

নিচের ক্রমে পড়লে ১০ মিনিটে পুরো সিস্টেম বুঝে যাবে:

1. **`ARCHITECTURE.md`** ← সবচেয়ে গুরুত্বপূর্ণ। ডেটা মডেল, নিরাপত্তা, ফ্লো — সব এখানে।
2. **`supabase/migrations/20260924000001_schema.sql`** ← ডেটার সত্যিকারের রূপ
3. **`supabase/migrations/20260924000002_functions.sql`** ← ব্যবসার নিয়মগুলো এখানে
4. **`src/types/database.ts`** ← সব টাইপ একসাথে
5. **`DECISIONS.md`** ← কেন এমন করা হয়েছে (ভুল "উন্নতি" করতে বাধা দেবে)

---

## ১. এই প্রজেক্ট কী

একক বিক্রেতার বাংলা অনলাইন বইয়ের দোকান। Next.js 16 + Supabase + Vercel।
কার্ট localStorage এ, অর্ডার ডেটাবেসে, পেমেন্ট COD + ম্যানুয়াল bKash/Nagad।

---

## ২. অলঙ্ঘনীয় নিয়ম (কখনো ভাঙবে না)

### 🔴 নিয়ম ১ — দাম কখনো ক্লায়েন্ট থেকে নেওয়া যাবে না

```ts
// ❌ ভুল — কেউ DevTools থেকে দাম বদলে দিতে পারবে
await supabase.from("orders").insert({ total: cartTotal, ... });

// ✅ সঠিক — ডেটাবেসই হিসাব করে
await supabase.rpc("create_order", { p_items: items, ... });
```

`orders` / `order_items` টেবিলে ক্লায়েন্টের **কোনো** সরাসরি INSERT পারমিশন নেই।
অর্ডার তৈরি হয় শুধু `create_order()` RPC দিয়ে।

### 🔴 নিয়ম ২ — অ্যাডমিন অ্যাকশনে `requireStaff()` বাধ্যতামূলক

```ts
// src/lib/actions/*.ts এর প্রতিটি এক্সপোর্টেড অ্যাডমিন ফাংশনে
import { FORBIDDEN, requireStaff } from "@/lib/actions/guard";

const guard = await requireStaff();
if (!guard.ok) return FORBIDDEN;
// ... তারপর guard.supabase দিয়ে কাজ করুন
```

`proxy.ts` শুধু "লগইন করেছ?" দেখে, "staff কি?" দেখে না।
তাই প্রতিটি অ্যাডমিন ফাংশনে চেক দিতে হবে।
(সব অ্যাডমিন অ্যাকশন এখন `src/lib/actions/` এ — `admin.ts`, `courier.ts`,
`book-import.ts`)।

### 🔴 নিয়ম ৩ — `admin.ts` (secret key) কখনো ক্লায়েন্টে নয়

`src/lib/supabase/admin.ts` এ `import "server-only"` আছে। সরাবেন না।
এটি RLS সম্পূর্ণ বাইপাস করে — শুধু ব্যাচ ছবি আপলোডের মতো কাজে।

### 🔴 নিয়ম ৪ — সেশন যাচাইয়ে `getSession()` নয়, `getClaims()`

```ts
// ❌ সার্ভারে কখনো
const { data } = await supabase.auth.getSession();   // কুকি অন্ধভাবে বিশ্বাস করে

// ✅
const { data } = await supabase.auth.getClaims();     // টোকেনের সিগনেচার যাচাই করে
```

### 🔴 নিয়ম ৫ — SECURITY DEFINER ফাংশনে `set search_path = ''`

```sql
-- ✅ সব টেবিল ও ফাংশন স্কিমা দিয়ে লিখুন
select * from public.books where id = p_id;
```

নতুন কোনো PL/pgSQL ফাংশন লিখলে এই নিয়ম মানুন — নাহলে SQL ইনজেকশনের ঝুঁকি।

### 🟡 নিয়ম ৬ — নতুন টেবিল বানালে RLS চালু করুন

```sql
alter table public.your_table enable row level security;
create policy "your_table_staff_all" on public.your_table
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
```

RLS ছাড়া টেবিল বানানো মানে পুরো ডেটা পাবলিক করে দেওয়া।

### 🟡 নিয়ম ৭ — `stock_qty` কখনো সরাসরি UPDATE করবেন না

সবসময় `admin_stock_adjust()` RPC ব্যবহার করুন — লকিং ও ভ্যালিডেশন আছে।

---

## ৩. কাজ করার আগে যাচাই

পরিবর্তন করার আগে এই কমান্ডগুলো চালান:

```bash
npm install
npm run typecheck     # টাইপ এরর আছে কি? (সবচেয়ে দ্রুত চেক)
npm run test          # ৯২টি ইউনিট টেস্ট (~২ সেকেন্ড)
npm run build         # সব ঠিক আছে কি?
npm run dev           # http://localhost:3000 (Vercel এ ডিপ্লয় করার আগে)
```

কোড জমা দেওয়ার আগে **এক কমান্ডেই সব**:

```bash
npm run check         # typecheck → test → build
```

CI (`.github/workflows/ci.yml`) ঠিক এটাই চালায়, তাই এখানে পাস করলে
CI-ও পাস করবে।

---

## ৪. কোডিং রীতি

| বিষয় | নিয়ম |
|---|---|
| **কমেন্টের ভাষা** | **বাংলা** — যাতে স্থানীয় ডেভেলপারও বুঝতে পারে |
| **ভেরিয়েবল/ফাংশন নাম** | ইংরেজি (snake_case ডেটাবেসে, camelCase JS এ) |
| **ইমপোর্ট** | `@/` অ্যালিয়াস (যেমন `@/lib/cart`) — `../../` নয় |
| **সার্ভার vs ক্লায়েন্ট** | ডিফল্ট Server Component। `"use client"` শুধু দরকার হলে |
| **ডেটা পড়া** | পাবলিক ডেটা → `lib/queries.ts`, ইউজার-নির্দিষ্ট → `lib/supabase/server.ts` |
| **ডেটা লেখা** | সবসময় Server Action (`lib/actions/`) |
| **আকার** | ছোট, এক-কাজের ফাংশন। ৩০০+ লাইনের কম্পোনেন্ট ভাঙুন |
| **টাকা** | `numeric(10,2)` ডেটাবেসে; UI তে `formatTaka()` |
| **তারিখ** | সবসময় `Asia/Dhaka` টাইমজোন; UI তে `formatDateBn()` |
| **সংখ্যা (UI)** | `toBanglaDigits()` — কিন্তু ইনপুট ফিল্ডে ইংরেজি |

### কম্পোনেন্ট লেখার প্যাটার্ন

```tsx
// সার্ভার কম্পোনেন্ট — ডেটা আনে, ক্লায়েন্টকে পাঠায়
export default async function Page() {
  const data = await getBooks();            // lib/queries.ts
  return <ClientPart data={data} />;        // ডেটা prop হিসেবে
}

// ক্লায়েন্ট কম্পোনেন্ট — শুধু ইন্টারঅ্যাকশন
"use client";
export function ClientPart({ data }: Props) {
  const [state, setState] = useState();
  // ...
}
```

**সার্ভার কম্পোনেন্টে `useState`/`onClick` ব্যবহার করলে বিল্ড এরর দেবে।**

---

## ৫. সাধারণ কাজের রেসিপি

### নতুন ফিল্ড যোগ করা (যেমন `books.discount_percent`)

1. **ডেটাবেস** — নতুন migration ফাইল বানান (পুরনো ফাইল এডিট করবেন না):
   `supabase/migrations/2026092400000X_add_discount.sql`
   ```sql
   alter table public.books add column discount_percent integer default 0;
   ```
2. **টাইপ** — `src/types/database.ts` এর `Book` ইন্টারফেসে যোগ করুন
3. **ফর্ম** — `src/components/admin/book-form.tsx` এ ইনপুট যোগ করুন
4. **অ্যাকশন** — `src/lib/actions/admin.ts` এর `readBookForm()` এ যোগ করুন
5. **যাচাই** — `npm run typecheck`

> ⚠️ **পুরনো migration ফাইল কখনো এডিট করবেন না।** ইতিমধ্যে চালানো ফাইল বদলালে
> ডেটাবেস ও কোডের মধ্যে ফারাক তৈরি হয়। সবসময় নতুন ফাইল যোগ করুন।

### নতুন পেজ যোগ করা

```
src/app/your-page/page.tsx          →  /your-page
src/app/books/[slug]/page.tsx       →  /books/কোনো-স্লাগ
src/app/admin/your-page/page.tsx    →  /admin/your-page (স্বয়ংক্রিয়ভাবে সুরক্ষিত)
```

`params` আর `searchParams` **Promise** — `await` করতে হয় (Next.js 15+)।

### নতুন অ্যাডমিন অ্যাকশন

```ts
// src/lib/actions/admin.ts
export async function doSomething(formData: FormData): Promise<AdminActionResult> {
  const guard = await requireStaff();          // ← কখনো বাদ দেবেন না
  if (!guard.ok) return FORBIDDEN;

  const { error } = await guard.supabase.from("table").update({...}).eq("id", id);
  if (error) return { ok: false, code: "SERVER_ERROR" };

  revalidatePath("/admin/wherever");           // ← ক্যাশ রিফ্রেশ করুন
  return { ok: true };
}
```

### নতুন কুরিয়ার যোগ করা (Pathao / RedX)

1. `src/lib/courier/pathao.ts` বানান — `steadfast.ts` কপি করে
2. `CourierProvider` ইন্টারফেস মানুন: `id`, `name`, `isConfigured()`,
   `createBooking()`, `getStatusByTrackingCode()`
3. `src/lib/courier/index.ts` এর `PROVIDERS` অ্যারেতে যোগ করুন
4. `types.database.ts` এর `COURIERS` (constants.ts) এ নামটাও যোগ করুন

**⚠️ এন্ডপয়েন্ট অনুমান করবেন না।** কুরিয়ারের অফিসিয়াল ডক থেকে হুবহু
মিলিয়ে নিন — ভুল এন্ডপয়েন্টে অর্ডার পাঠালে কিছুই হবে না, কোনো এররও আসবে না।
SteadFast এর জন্য যাচাই করা মান `steadfast.ts` এর উপরের কমেন্টে লেখা আছে।

### নতুন রেট লিমিট নিয়ম

`supabase/migrations/` এ নতুন ফাইল — পুরনো `create_order` এ হাত দেবেন না:

```sql
create or replace function public.order_rate_limit_rules()
returns table (per_10_min integer, per_24_hours integer, window_minutes integer)
language sql immutable as $$ select 5, 20, 15; $$;
```

`src/lib/validation.ts` বা `orders.ts` এ কিছু বদলাতে হবে না — ফাংশনটাই
এক জায়গায় নিয়ম ধরে রাখে।

### নতুন সেটিং যোগ করা

1. SQL: `insert into public.site_settings (key, value, is_public, label_bn) values (...)`
2. `src/lib/settings.ts` এর `StoreSettings` ইন্টারফেসে key যোগ করুন
3. `DEFAULTS` অবজেক্টেও ডিফল্ট মান দিন
4. অ্যাডমিন সেটিংস পেজ স্বয়ংক্রিয়ভাবে নতুন key দেখাবে — কোনো কোড বদলাতে হবে না

### নতুন ডেটাবেস ফাংশন (RPC)

```sql
create or replace function public.my_function(p_x uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''                        -- ← বাধ্যতামূলক
as $$
begin
  if not public.is_staff() then             -- ← staff-শুধু হলে
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  -- ... সব টেবিল public. দিয়ে লিখুন
end;
$$;

grant execute on function public.my_function(uuid) to authenticated;
```

কাস্টমার-facing হলে `to anon, authenticated` দিন।

---

## ৬. ডিবাগ করার সময়

| উপসর্গ | সম্ভাব্য কারণ |
|---|---|
| "fetch failed" সব জায়গায় | Supabase প্রজেক্ট paused (৭ দিন নিষ্ক্রিয়) → Dashboard → Restore |
| এরর: `পরিবেশ ভেরিয়েবল "X" পাওয়া যায়নি` | `.env.local` এ X নেই |
| `new row violates row-level security` | ইউজার staff নয়, বা INSERT টেবিলে পলিসি নেই |
| `function public.create_order(...) does not exist` | `0002_functions.sql` চালানো হয়নি |
| পেজ লোড হচ্ছে না, `params` undefined | `await params` করতে ভুলে গেছেন |
| `useSearchParams() should be wrapped in Suspense` | Client কম্পোনেন্ট Suspense এ মুড়ুন |
| ছবি দেখাচ্ছে না | `next.config.ts` এর `remotePatterns` এ ডোমেইন নেই |
| বাংলা ফন্ট ভাঙা | `globals.css` এ `--font-bangla` ভেরিয়েবল নেই |
| ছবি আপলোড "bucket not found" | `0005_storage.sql` চালানো হয়নি |
| ছবি আপলোড "policy" / "403" | অ্যাকাউন্টটি `public.staff` এ নেই |
| কুরিয়ার বাটন নিষ্ক্রিয় | `STEADFAST_API_KEY` / `STEADFAST_SECRET_KEY` নেই, বা ডেভ সার্ভার রিস্টার্ট করেননি |
| Cron ৪০১ | `CRON_SECRET` সেট নেই, বা হেডার মিলছে না |
| **Secret key দিয়ে REST কল → ৪০১** | ⚠️ এটা কী ভুল নয়! Supabase `User-Agent` দেখে ব্রাউজার শনাক্ত করে secret key ব্লক করে। `curl`/`node` UA দিলে কাজ করে। বিস্তারিত নিচে |
| "RATE_LIMITED" এরর | রেট লিমিট কাজ করছে (১০ মিনিটে ৩টি) — এটা বাগ নয় |
| কুরিয়ার স্টেটাস "unknown" | নতুন স্টেটাস — কনসোল লগ দেখে `courier/types.ts` এর ম্যাপে যোগ করুন |
| CSV ইমপোর্টে ভুল লাইন নম্বর | সার্ভারের লাইন = প্রিভিউয়ের লাইন + ১ (শিরোনাম সারি বাদ) |

### লগ দেখার জায়গা

- **Vercel**: Deployments → Functions → Runtime Logs
- **Supabase**: Logs → Postgres / API / Auth
- **লোকাল**: `npm run dev` চালানো টার্মিনাল

---

## ৭. করার আগে ভাবুন

| করবেন না | কারণ |
|---|---|
| কার্ট/উইশলিস্ট ডেটাবেসে সরানো | গেস্ট চেকআউটের সরলতা নষ্ট হবে (ADR-005) |
| অর্ডারে ক্লায়েন্টের দাম বিশ্বাস | সরাসরি আর্থিক ক্ষতি |
| `middleware.ts` বানানো | Next.js 16 এ নাম `proxy.ts`, ফাংশন `proxy` |
| `tailwind.config.js` বানানো | Tailwind v4 এ কনফিগ `globals.css` এর `@theme` এ |
| `concat_ws()` generated column এ | STABLE ফাংশন, IMMUTABLE লাগে |
| RLS বন্ধ করা "ডিবাগের জন্য" | একবার ভুলে গেলেই ডেটা ফাঁস |
| পুরনো migration এডিট | ডেটাবেস ও কোডের ফারাক তৈরি হবে |
| ভ্যালিডেশন দুই জায়গায় আলাদা করে লেখা | `book-import.ts` একটাই — দুই জায়গায় ব্যবহৃত |
| কুরিয়ার এন্ডপয়েন্ট অনুমান করা | ভুল হলে কোনো এরর ছাড়াই চুপচাপ ব্যর্থ হবে |
| `_sync_courier_core` এ EXECUTE দেওয়া | system function — কখনো anon/authenticated নয় |
| কুরিয়ার স্টেটাস জোর করে ম্যাপ করা | সন্দেহ হলে `null` দিন — ভুল স্টেটাসের চেয়ে না বদলানো ভালো |

---

## ৮. পরিবর্তনের পর ডকুমেন্ট আপডেট

আর্কিটেকচার বদলালে সংশ্লিষ্ট ডকুমেন্টও আপডেট করুন:

| কী বদলেছে | কোথায় লিখবেন |
|---|---|
| নতুন টেবিল / কলাম | `ARCHITECTURE.md` §৪ + `src/types/database.ts` |
| নিরাপত্তা নীতিমালা | `ARCHITECTURE.md` §৫ |
| নতুন ফোল্ডার/ফাইল | `ARCHITECTURE.md` §৩ (ডিরেক্টরি ম্যাপ) |
| গুরুত্বপূর্ণ সিদ্ধান্ত | `DECISIONS.md` (নতুন ADR যোগ করুন) |
| নতুন ফিচার প্ল্যান | `ROADMAP.md` |

---

## ৯. দ্রুত রেফারেন্স

```
ডেটা পড়া (পাবলিক)     → src/lib/queries.ts  → createPublicClient()
ডেটা পড়া (লগইন করা)   → src/lib/supabase/server.ts → createClient()
ডেটা লেখা              → src/lib/actions/*.ts (Server Action)
অ্যাডমিন যাচাই          → requireStaff() in src/lib/actions/guard.ts
টাইপ                   → src/types/database.ts
ব্যবসার নিয়ম            → supabase/migrations/..._0002_functions.sql
অর্ডারের সীমা           → ..._0006_rate_limit.sql → order_rate_limit_rules()
কুরিয়ার               → src/lib/courier/types.ts (ইন্টারফেস), index.ts (রেজিস্ট্রি)
নিরাপত্তার নিয়ম        → supabase/migrations/..._0003_rls.sql
UI প্রিমিটিভ             → src/components/ui.tsx
টাকা/তারিখ ফরম্যাট      → src/lib/format.ts
বিভাগ/জেলা/লেবেল        → src/lib/constants.ts
CSV                    → src/lib/csv.ts (পার্সার), book-import.ts (নিয়ম)
টেস্ট চালাতে            → npm run test
```

### env ভেরিয়েবল

```
# ---- বাধ্যতামূলক ----
NEXT_PUBLIC_SUPABASE_URL                 # https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY     # sb_publishable_xxx (পাবলিক)
SUPABASE_SECRET_KEY                      # sb_secret_xxx      (গোপন!)
NEXT_PUBLIC_SITE_URL                     # https://your-domain.com
NEXT_PUBLIC_STORE_NAME                   # দোকানের নাম

# ---- ঐচ্ছিক (না দিলেও সাইট পুরো চলে) ----
STEADFAST_API_KEY                        # কুরিয়ার অটো-বুকিং (না দিলে CSV এক্সপোর্ট চলবে)
STEADFAST_SECRET_KEY
STEADFAST_BASE_URL                       # ডিফল্ট: https://portal.packzy.com/api/v1
CRON_SECRET                              # Cron এন্ডপয়েন্ট সুরক্ষা
```

**না দিলে কী কী বন্ধ হয়:**

| কোন ভেরিয়েবল না থাকলে | ফলাফল |
|---|---|
| `STEADFAST_*` | কুরিয়ারে বুক বাটন নিষ্ক্রিয় — CSV এক্সপোর্ট ও হাতে ট্র্যাকিং কোড কাজ করবে |
| `CRON_SECRET` | স্বয়ংক্রিয় স্টেটাস সিঙ্ক চলবে না (Cron ৪০১ দেবে) |
| `SUPABASE_SECRET_KEY` | শুধু ব্যাচ ছবি আপলোড ও Cron আটকাবে |
