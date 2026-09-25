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
      setError(
        signInError.message === "Invalid login credentials"
          ? "ইমেইল বা পাসওয়ার্ড ঠিক নেই।"
          : signInError.message
      );
      setLoading(false);
      return;
    }

    // কুকি রিফ্রেশ হয়ে সার্ভার কম্পোনেন্ট আপডেট হতে refresh() দরকার
    router.replace(nextPath);
    router.refresh();
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
        onSubmit={onSubmit}
        className="mt-8 space-y-4 rounded-xl border border-stone-200 bg-white p-6"
      >
        {error && <Alert tone="error">{error}</Alert>}

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

        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? "লগইন হচ্ছে..." : "লগইন করুন"}
        </Button>
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
