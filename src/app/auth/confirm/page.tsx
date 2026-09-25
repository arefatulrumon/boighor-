"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Card, CardHeader, Field, Input } from "@/components/ui";

/**
 * Supabase ইমেইল লিংক ধরার পেজ।
 *
 * ── কেন এই পেজটা দরকার? ──────────────────────────────────────────────
 * "পাসওয়ার্ড ভুলে গেছি" বা "invite" ইমেইলের লিংকে ক্লিক করলে Supabase
 * ব্যবহারকারীকে সাইটের মূল ঠিকানায় পাঠায়, আর সাথে টোকেন পাঠায়। ওই
 * টোকেন ধরে সেশন বানানো, তারপর নতুন পাসওয়ার্ড নেওয়া — এই কাজটা করার
 * জন্যই এই পেজ।
 *
 * এটা ছাড়া লিংকে ক্লিক করলে ব্যবহারকারী এমনিতে পৌঁছে যেতেন কিন্তু
 * পাসওয়ার্ড কখনো সেট হতো না — ঠিক যেটা প্রথমবার হয়েছিল।
 *
 * ── দুটি ফরম্যাটই সামলানো হয় ────────────────────────────────────────
 *   ১) Implicit:  #access_token=...&refresh_token=...
 *      (পুরনো ডিফল্ট; Supabase-এর ইমেইল টেমপ্লেট সাধারণত এটাই দেয়)
 *   ২) PKCE:      ?code=...
 *      (নতুন প্রজেক্টে ব্যবহৃত)
 *
 * কোনটা আসছে তা আগে থেকে ধরে নেওয়া যায় না — তাই দুটোই চেক করা হয়।
 *
 * ⚠️ Site URL সেটিংস: Supabase → Authentication → URL Configuration এ
 *    Site URL হতে হবে `https://boighor-ochre.vercel.app`, আর Redirect URLs এ
 *    `https://boighor-ochre.vercel.app/**` না থাকলে Supabase লিংক
 *    localhost এ পাঠাবে।
 */

type Phase = "working" | "set-password" | "done" | "error";

export default function AuthConfirmPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("working");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  /* --------------------------- লিংকের টোকেন ধরা --------------------------- */
  useEffect(() => {
    let cancelled = false;

    async function handle() {
      const supabase = createClient();

      try {
        const search = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

        const code = search.get("code");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const type = hash.get("type") ?? search.get("type");

        // টোকেন URL এ ফেলে রাখা নিরাপদ নয় — ব্রাউজার হিস্টরিত থেকে যেত
        const stripTokens = () =>
          window.history.replaceState(null, "", window.location.pathname);

        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          stripTokens();
          if (exErr) throw exErr;
        } else if (accessToken && refreshToken) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          stripTokens();
          if (setErr) throw setErr;
        } else {
          // টোকেন নেই — হয়তো ব্যবহারকারী আগেই লগইন করা আছেন
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            throw new Error(
              "লিংকটি অসম্পূর্ণ, অথবা এর মেয়াদ শেষ হয়ে গেছে। নতুন লিংক চেয়ে নিন।"
            );
          }
        }

        const { data: userData } = await supabase.auth.getUser();
        if (!cancelled) setEmail(userData.user?.email ?? null);

        // recovery/invite হলে নতুন পাসওয়ার্ড চাওয়া হয়; অন্যথায় সোজা ভেতরে
        const needsPassword = type === "recovery" || type === "invite";
        if (!cancelled) setPhase(needsPassword ? "set-password" : "done");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "লিংকটি কাজ করেনি।");
        setPhase("error");
      }
    }

    void handle();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------ পাসওয়ার্ড সেভ ------------------------------ */
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const savePassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPwError(null);

      if (password.length < 8) {
        setPwError("পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।");
        return;
      }
      if (password !== confirm) {
        setPwError("দুইবার লেখা পাসওয়ার্ড মিলছে না।");
        return;
      }

      setSaving(true);
      const supabase = createClient();
      const { error: updErr } = await supabase.auth.updateUser({ password });
      setSaving(false);

      if (updErr) {
        setPwError(updErr.message);
        return;
      }

      setPassword("");
      setConfirm("");
      setPhase("done");
    },
    [password, confirm]
  );

  /* --------------------------------- UI --------------------------------- */
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader title="অ্যাকাউন্ট যাচাই" />

        <div className="space-y-4 px-5 py-5">
          {phase === "working" && (
            <p className="text-sm text-stone-600">লিংক যাচাই করা হচ্ছে...</p>
          )}

          {phase === "error" && (
            <>
              <Alert tone="error">{error}</Alert>
              <p className="text-sm text-stone-600">
                আবার চেষ্টা করতে চাইলে লগইন পেজ থেকে নতুন লিংক চেয়ে নিন।
              </p>
              <Link
                href="/login"
                className="inline-block text-sm font-medium text-emerald-800 hover:underline"
              >
                ← লগইন পেজে ফিরে যান
              </Link>
            </>
          )}

          {phase === "set-password" && (
            <form onSubmit={savePassword} className="space-y-4">
              <p className="text-sm text-stone-600">
                {email ? <strong>{email}</strong> : "আপনার অ্যাকাউন্ট"} এর জন্য
                নতুন পাসওয়ার্ড দিন।
              </p>

              <Field label="নতুন পাসওয়ার্ড" required>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>

              <Field label="আবার লিখুন" required>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>

              {pwError && <Alert tone="error">{pwError}</Alert>}

              <Button type="submit" size="lg" disabled={saving} className="w-full">
                {saving ? "সেভ হচ্ছে..." : "পাসওয়ার্ড সেভ করুন"}
              </Button>
            </form>
          )}

          {phase === "done" && (
            <>
              <Alert tone="success">
                সফল হয়েছে। এখন আপনি লগইন করা অবস্থায় আছেন।
              </Alert>
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => {
                  router.replace("/admin");
                  router.refresh();
                }}
              >
                অ্যাডমিন প্যানেলে যান
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
