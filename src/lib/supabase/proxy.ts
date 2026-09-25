import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * Next.js 16 এ প্রতিটি রিকোয়েস্টে Supabase সেশন টোকেন রিফ্রেশ করে।
 * এটা ছাড়া ইউজার কিছু সময় পর নিজে থেকেই লগআউট হয়ে যাবে।
 *
 * ⚠️ Next.js 16 এ `middleware.ts` → `proxy.ts` নাম বদলে গেছে।
 *    (15 বা তার নিচে হলে ফাইলের নাম `middleware.ts` আর ফাংশনের নাম
 *     `middleware` হতো।) এখানে ফাংশনের নাম `proxy`।
 *
 * নিরাপত্তার নিয়ম: এখানে `getSession()` ব্যবহার করা যাবে না — ওটা শুধু
 * কুকি পড়ে, টোকেন যাচাই করে না। `getClaims()` করোটার সিগনেচার ভেরিফাই করে।
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // env না থাকলে যেন পুরো সাইট ক্র্যাশ না করে — বরং চুপচাপ এগিয়ে যায়।
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // ১) রিকোয়েস্টে বসাও, যাতে Server Component নতুন টোকেন দেখে
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // ২) নতুন রেসপন্স বানাও (আগের রেসপন্সে নতুন কুকি থাকবে না)
          supabaseResponse = NextResponse.next({ request });
          // ৩) ব্রাউজারের জন্য কুকি সেট করো
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ---------- /admin রুট সুরক্ষা ----------
  // বিস্তারিত ভেরিফিকেশন হয় admin layout এ (is_staff RPC দিয়ে)।
  // এখানে শুধু দ্রুত নক-ব্যাক: লগইন ছাড়া কেউ ঢুকতে পারবে না।
  if (
    !user &&
    request.nextUrl.pathname.startsWith("/admin")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // ⚠️ এই রেসপন্সটাই রিটার্ন করতে হবে — নতুন বানালে কুকি হারিয়ে যাবে।
  return supabaseResponse;
}
