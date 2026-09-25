# Vercel-এ লাইভ করা — ধাপে ধাপে

> এই ফাইলটা ফলো করলে ১০ মিনিটে সাইট লাইভ হবে।
> তার আগে নিশ্চিত করুন Supabase-এর ৭টি migration চালানো হয়েছে
> ([`supabase/README.md`](supabase/README.md) §৩) — নাহলে সাইট লোড হবে
> কিন্তু কোনো বই দেখাবে না।

---

## যা যা লাগবে

| জিনিস | কোথায় পাবেন | আছে? |
|---|---|---|
| Supabase URL | Supabase → Settings → API Keys | `.env.local` এ আছে |
| Publishable key | একই জায়গা | `.env.local` এ আছে |
| Secret key | একই জায়গা | `.env.local` এ আছে |
| CRON_SECRET | `.env.local` এ বানিয়ে রাখা আছে | ✅ |
| GitHub অ্যাকাউন্ট | [github.com](https://github.com) | ? |
| Vercel অ্যাকাউন্ট | [vercel.com](https://vercel.com) — GitHub দিয়ে সাইন ইন করাই সহজ | ? |

**⚠️ `.env.local` ফাইলটা কখনো GitHub এ যাবে না** — এটা `.gitignore` এ আছে,
আর git আসলে সেটা এড়িয়ে যাচ্ছে কি না `git check-ignore .env.local` দিয়ে
যাচাই করা হয়েছে। তাই নিশ্চিন্ত থাকুন।

---

## পথ ক — GitHub → Vercel (এই পথটাই সুপারিশ করছি)

**কেন:** একবার সেট করলে এরপর প্রতিবার `git push` করলেই Vercel নিজে থেকে
নতুন ভার্সন লাইভ করে দেবে। "আস্তে আস্তে কোড ডেভেলপ করব" — এর জন্য এটাই
সেরা পথ।

### ১. GitHub এ খালি repo বানান

[github.com/new](https://github.com/new) এ যান:

- **Repository name:** `boighor` (বা যা ইচ্ছা)
- **Public / Private:** Private রাখাই ভালো (কোড গোপন থাকবে)
- ⚠️ **"Add a README" / ".gitignore" / "license" — কিছুই টিক দেবেন না।**
  টিক দিলে repo তে আগেই কমিট থাকবে, আর push করতে giye conflict হবে।

### ২. কোড push করুন

PowerShell-এ প্রজেক্ট ফোল্ডারে গিয়ে:

```bash
cd "C:\Users\Arefatul Rumon\AccioWork\2026-09-24-15-21-41-264-607bc387\bookstore"

git remote add origin https://github.com/<আপনার-ইউজারনেম>/boighor.git
git push -u origin main
```

`<আপনার-ইউজারনেম>` বদলে আসল ইউজারনেম বসান। পাসওয়ার্ড চাইলে **Personal
Access Token** লাগবে (GitHub ২০২১ থেকে সাধারণ পাসওয়ার্ড নেয় না) —
[github.com/settings/tokens](https://github.com/settings/tokens) →
Generate new token (classic) → `repo` স্কোপ দিয়ে বানান।

> **সহজ বিকল্প:** GitHub Desktop বা `gh auth login` দিয়ে লগইন করলে
> টোকেনের ঝামেলা নেই।

### ৩. Vercel এ import করুন

[vercel.com/new](https://vercel.com/new) এ যান:

1. GitHub অ্যাকাউন্ট কানেক্ট করুন (না থাকলে)
2. তালিকা থেকে `boighor` repo পাবেন → **Import**
3. **Framework Preset:** `Next.js` — নিজে থেকেই ধরা পড়বে, হাত দেবেন না
4. **Root Directory:** খালি রাখুন (ফাইলগুলো repo এর গোড়ায় আছে)
5. **Build / Output / Install Command:** ডিফল্টই ঠিক আছে
6. **Environment Variables** — এখনই বসান (পরের ধাপ)

### ৪. Environment Variables বসান

**Deploy চাপার আগেই** এই ছয়টি বসাতে হবে (নাহলে বিল্ড ফেল করবে):

| Name (Key ঘরে) | Value ঘরে |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vnmmvhalpqwwihxbldmy.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | আপনার `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | আপনার `sb_secret_...` |
| `NEXT_PUBLIC_STORE_NAME` | `বইঘর` |
| `NEXT_PUBLIC_SITE_URL` | আপাতত `https://example.vercel.app` — ডিপ্লয়ের পর আসল ঠিকানা দিয়ে বদলাবেন |
| `CRON_SECRET` | `.env.local` এ যেটা আছে |

> ### ⚠️ একটা একটা করে বসাতে হবে — পুরো ব্লক পেস্ট করা যাবে না
>
> Vercel-এ `.env` ফাইলের পুরো ব্লক একবারে পেস্ট করার কোনো সুবিধা **নেই**।
> (Vercel doc: "Enter the **Name** … Then, enter the **Value** … Click Save")
> ব্লক পেস্ট করলে পুরো লাইনটা **Key ঘরে** ঢুকে যায়, আর এই এরর আসে:
>
> > *The name of your Environment Variable contains invalid characters.
> > Only letters, digits, and underscores are allowed.*
>
> **সঠিক নিয়ম — প্রতিটি ভেরিয়েবলের জন্য:**
>
> 1. **Key** ঘরে শুধু নামটা লিখুন — যেমন `NEXT_PUBLIC_SUPABASE_URL`
>    (সমান চিহ্ন `=` বা মান কিছুই যাবে না)
> 2. **Value** ঘরে মানটা লিখুন — যেমন `https://vnmmvhalpqwwihxbldmy.supabase.co`
>    (কোটেশন `"` দেবেন না)
> 3. Environment টিক দিন — Production, Preview, Development **তিনটেই**
> 4. **Save** চাপুন
> 5. পরেরটার জন্য আবার **Add New**
>
> ছয়টির জন্য ছয়বার। কষ্টকর, কিন্তু এটাই একমাত্র ড্যাশবোর্ড উপায়।

ঐচ্ছিক (পরে যোগ করা যাবে):

| Name | কখন দরকার |
|---|---|
| `STEADFAST_API_KEY` | কুরিয়ারে অটো-বুকিং চালু করতে |
| `STEADFAST_SECRET_KEY` | একই সাথে |

> **Environment গুলো:** Production **এবং** Preview — দুটোতেই টিক দিন,
> নাহলে প্রিভিউ ডিপ্লয়ে সাইট ভাঙা দেখাবে।
>
> **মনে রাখুন:** env ভেরিয়েবল বদলালে **পুরনো ডিপ্লয়ে কাজ করে না** —
> নতুন করে Redeploy করতে হয় (Vercel doc এ স্পষ্ট লেখা আছে)।

### ৫. Deploy চাপুন

২–৩ মিনিট লাগবে। সফল হলে `https://boighor-xxx.vercel.app` জাতীয় একটা
লিংক পাবেন — **এটাই আপনার লাইভ সাইট।**

### ৬. site URL ঠিক করুন

`NEXT_PUBLIC_SITE_URL` এ ভুল ঠিকানা থাকলে sitemap আর Open Graph
লিংকগুলো ভুল হবে। তাই:

1. Vercel → আপনার প্রজেক্ট → **Settings → Environment Variables**
2. `NEXT_PUBLIC_SITE_URL` এডিট করে আসল লিংক বসান
3. **Deployments** → সর্বশেষ ডিপ্লয়ের `⋯` → **Redeploy**

---

## পথ খ — Vercel CLI (GitHub ছাড়াই, দ্রুত)

GitHub না চাইলে সরাসরি CLI দিয়ে দিতে পারেন। তবে **প্রতিবার কোড বদলালে
নিজে হাতে আবার deploy করতে হবে** — auto-deploy পাবেন না।

```bash
cd "C:\Users\Arefatul Rumon\AccioWork\2026-09-24-15-21-41-264-607bc387\bookstore"

npx vercel login          # ব্রাউজার খুলবে, সেখানে লগইন করবেন
npx vercel link           # নতুন প্রজেক্ট বানাবে
npx vercel --prod         # লাইভ ডিপ্লয়
```

CLI দিয়ে env বসানো:

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
# মান চাইবে — পেস্ট করে Enter
```

ছয়টি ভেরিয়েবলের জন্য ছয়বার করতে হবে। তারপর আবার `npx vercel --prod`।

---

## ডিপ্লয়ের পর যা করবেন

### ১. Supabase এ যা বাকি (যদি না করে থাকেন)

- [ ] ৭টি migration চালানো — [`supabase/README.md`](supabase/README.md) §৩
- [ ] `public.staff` এ নিজের অ্যাকাউন্ট যোগ করা (§৫)
- [ ] তারপর: Supabase → Authentication → Users → **Add user** →
      আপনার ইমেইল + পাসওয়ার্ড (auto-confirm টিক দিন)

### ২. সাইট পরীক্ষা করুন

| কী | কীভাবে |
|---|---|
| হোমপেজ খুলছে? | লিংকে ক্লিক |
| ডেমো বই দেখাচ্ছে? | `/books` — ৫টি বই থাকা উচিত |
| অ্যাডমিনে ঢুকছে? | `/login` → লগইন → `/admin` এ পৌঁছানো উচিত |
| Cron সুরক্ষিত? | `/api/cron/courier-sync` খুললে **৪০১** আসবে (এটাই ঠিক) |

### ৩. একটা টেস্ট অর্ডার দিন

নিজের ফোন নম্বর দিয়ে একটা ছোট অর্ডার করুন → `/admin/orders` এ দেখা
উচিত। এরপর সেটা বাতিল করলে স্টক ফিরে আসবে।

> **এটাই সবচেয়ে জরুরি পরীক্ষা।** এটা কাজ করলে পুরো সিস্টেম কাজ করছে।

### ৪. Cron চালু আছে কি দেখুন

Vercel → প্রজেক্ট → **Settings → Cron Jobs** — `/api/cron/courier-sync`
প্রতিদিন একবার দেখানো উচিত।

> ⚠️ **Hobby plan এ দিনে একবারের বেশি চলে না** — এর বেশি চাইলে
> **ডিপ্লয়ই ফেল করে**। কারণ `vercel.json` এ `0 3 * * *` (প্রতিদিন) দেওয়া
> আছে, প্রতি ঘণ্টা নয়। বিস্তারিত: [`supabase/README.md`](supabase/README.md) §৭

---

## সমস্যা হলে

| সমস্যা | কারণ ও সমাধান |
|---|---|
| Build fails: "পরিবেশ ভেরিয়েবল X পাওয়া যায়নি" | Vercel এ env বসানো হয়নি, বা Production/Preview দুটোতেই টিক দেওয়া হয়নি |
| Build fails: "Hobby accounts are limited to daily cron jobs" | `vercel.json` এ ঘণ্টায়-একবারের কম schedule আছে — প্রতিদিনে বদলান |
| সাইট খুলছে কিন্তু কোনো বই নেই | migration চালানো হয়নি, বা সব বই `is_active = false` |
| ছবি দেখাচ্ছে না | `0005_storage.sql` চালানো হয়নি |
| `/admin` এ গেলে আবার `/login` এ ফিরছে | আপনার অ্যাকাউন্ট `public.staff` এ নেই |
| Cron ৪০১ | Vercel এ `CRON_SECRET` সেট নেই, বা হেডারের টোকেন মিলছে না |
| ৭ দিন পর সাইট "fetch failed" | Supabase Free plan paused → Dashboard → Restore |

---

## পরের ধাপ (যখন সুবিধা হয়)

- কুরিয়ার API কী যোগ করা — [`supabase/README.md`](supabase/README.md) §৭
- নিজের ডোমেইন যোগ করা — Vercel → Settings → Domains
  (তারপর `NEXT_PUBLIC_SITE_URL` বদলে redeploy)
- Supabase secret key rotate করা (নিরাপত্তার জন্য)
- `public.staff` এ আরও কর্মী যোগ করা
