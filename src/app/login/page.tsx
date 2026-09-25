"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Field, Input } from "@/components/ui";

/**
 * শুধু অ্যাডমিন/কর্মীদের লগইন পেজ।
 * কাস্টমার অ্যাকাউন্ট নেই — তারা লগইন ছাড়াই অর্ডার করতে পারে।
 *
 * লগইনের পর /admin লেআউট `is_staff()` দিয়ে যাচাই করে। অর্থাৎ এখানে
 * লগইন করতে পারলেই অ্যাডমিনে ঢোকা যায় না — staff টেবিলে থাকতে হয়।
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/admin";
  const notStaff = searchParams.get("error") === "not_staff";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    notStaff
      ? "আপনার অ্যাকাউন্টটি staff হিসেবে নিবন্ধিত নয়। অ্যাডমিনকে বলুন।"
      : null
  );
  const [loading, setLoading] = useState(false);

  /**
   * দুটি অবস্থা: সাধারণ লগইন, আর "পাসওয়ার্ড ভুলে গেছি"।
   * একই পেজে রাখা হয়েছে যাতে ইমেইলটা দুবার লিখতে না হয়।
   */
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      /*
       * "Invalid login credentials" এর পেছনে বেশ কয়েকটা কারণ থাকতে পারে —
       * ভুল পাসওয়ার্ড, অথবা অ্যাকাউন্টে পাসওয়ার্ডই সেট হয়নি (invite অসম্পূর্ণ)।
       * কোনটা তা সিকিউরিটির কারণে Supabase বলে না, তাই দুটো সমাধানই দেখানো হয়।
       */
      setError(
        signInError.message === "Invalid login credentials"
          ? "ইমেইল বা পাসওয়ার্ড ঠিক নেই। পাসওয়ার্ড না দিয়ে থাকলে নিচে “পাসওয়ার্ড ভুলে গেছেন?” চাপুন।"
          : signInError.message
      );
      setLoading(false);
      return;
    }

    // কুকি রিফ্রেশ হয়ে সার্ভার কম্পোনেন্ট আপডেট হতে refresh() দরকার
    router.replace(nextPath);
    router.refresh();
  }

  /**
   * পাসওয়ার্ড রিসেট ইমেইল পাঠানো।
   * লিংকটি সাইটের `/auth/confirm` এ ফিরে আসবে — ওই পেজ নতুন পাসওয়ার্ড নেয়।
   */
  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/auth/confirm` }
    );

    setLoading(false);

    // ইমেইলটি নিবন্ধিত কি না তা ফাঁস করা হয় না — সবসময় সফল দেখানো হয়
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-14">
      <div className="text-center">
        <p className="text-3xl" aria-hidden>🔐</p>
        <h1 className="mt-3 text-2xl font-bold text-stone-900">অ্যাডমিন লগইন</h1>
        <p className="mt-1.5 text-sm text-stone-600">
          শুধু দোকান পরিচালনার জন্য
        </p>
      </div>

      <form
        onSubmit={mode === "login" ? onSubmit : onForgot}
        className="mt-8 space-y-4 rounded-xl border border-stone-200 bg-white p-6"
      >
        {error && <Alert tone="error">{error}</Alert>}

        {resetSent ? (
          <>
            <Alert tone="success">
              রিসেট লিংক পাঠানো হয়েছে। <strong>{email}</strong> এর ইনবক্স
              (এবং স্প্যাম ফোল্ডার) দেখুন। লিংকে ক্লিক করলে নতুন পাসওয়ার্ড
              দেওয়ার পেজ খুলবে।
            </Alert>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setResetSent(false);
                setMode("login");
              }}
            >
              ← লগইনে ফিরে যান
            </Button>
          </>
        ) : (
          <>
            <Field label="ইমেইল" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoComplete="email"
                required
              />
            </Field>

            {/* রিসেট চাওয়ার সময় পাসওয়ার্ড ফিল্ড দেখানোর দরকার নেই */}
            {mode === "login" && (
              <Field label="পাসওয়ার্ড" required>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </Field>
            )}

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading
                ? mode === "login"
                  ? "লগইন হচ্ছে..."
                  : "পাঠানো হচ্ছে..."
                : mode === "login"
                  ? "লগইন করুন"
                  : "রিসেট লিংক পাঠান"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "forgot" : "login");
                setError(null);
              }}
              className="w-full text-center text-sm text-stone-500 transition-colors hover:text-emerald-800"
            >
              {mode === "login" ? "পাসওয়ার্ড ভুলে গেছেন?" : "← লগইনে ফিরে যান"}
            </button>
          </>
        )}
      </form>

      <p className="mt-5 text-center text-sm text-stone-500">
        ক্রেতা হিসেবে শপিং করতে{" "}
        <Link href="/books" className="font-medium text-emerald-800 hover:underline">
          বই দেখুন
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams ব্যবহার করায় Suspense লাগে
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-stone-500">লোড হচ্ছে...</div>}>
      <LoginForm />
    </Suspense>
  );
}
