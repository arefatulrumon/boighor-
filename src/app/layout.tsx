import type { Metadata, Viewport } from "next";
import { Noto_Sans_Bengali, Noto_Serif_Bengali } from "next/font/google";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SITE_URL } from "@/lib/supabase/env";
import { getPublicSettings } from "@/lib/settings";

/**
 * বাংলা ফন্ট — next/font নিজেই ডাউনলোড করে সেল্ফ-হোস্ট করে,
 * তাই ব্রাউজার Google সার্ভারে আলাদা রিকোয়েস্ট করে না (দ্রুত + প্রাইভেট)।
 *
 * 💡 দুটোই variable font (weight 100–900), তাই `weight` দেওয়া হয়নি —
 *    দিলে next/font এরর দেবে।
 *
 *   bangla       → --font-bangla          (বডি, UI)  = font-sans
 *   banglaDisplay→ --font-bangla-display  (হেডলাইন)  = font-display
 *
 * বিস্তারিত ব্যাখ্যা globals.css এর @theme এ।
 */
const bangla = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bangla",
  display: "swap",
});

const banglaDisplay = Noto_Serif_Bengali({
  subsets: ["bengali"],
  variable: "--font-bangla-display",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getPublicSettings();

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${s.store_name} — ${s.store_tagline}`,
      template: `%s | ${s.store_name}`,
    },
    description: `${s.hero_subtitle} ক্যাশ অন ডেলিভারি, bKash ও Nagad পেমেন্ট।`,
    keywords: ["বাংলা বই", "অনলাইন বইঘর", "বই কিনুন", "bangla books online", s.store_name],
    openGraph: {
      type: "website",
      locale: "bn_BD",
      siteName: s.store_name,
      url: SITE_URL,
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#065f46",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getPublicSettings();

  return (
    <html lang="bn" className={`${bangla.variable} ${banglaDisplay.variable}`}>
      {/*
        ⚠️ `flex min-h-screen flex-col` (body) + `flex-1` (main) — এর কারণ:
        ছোট পেজে (যেমন /track বা খালি ইচ্ছেতালিকা) ফুটারের উপরে বড় ফাঁকা
        সাদা জায়গা তৈরি হতো। আগে `min-h-[60vh]` দিয়ে আন্দাজে সামলানো হতো;
        এখন লেখা যত ছোটই হোক, ফুটার সবসময় একেবারে নিচে বসে।
      */}
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <CartProvider>
          <WishlistProvider>
            {settings.announcement && (
              <div className="no-print bg-brand-950 px-4 py-2 text-center text-sm text-brand-50">
                {settings.announcement}
              </div>
            )}

            {/*
              SiteHeader একটি Client Component আর `useSearchParams` ব্যবহার করে।
              Next.js এর নিয়ম: এভাবে ব্যবহার করলে Suspense boundary লাগে,
              নাহলে স্ট্যাটিক পেজ বিল্ডের সময় এরর দেয়।
            */}
            <Suspense
              fallback={<div className="h-16 border-b border-stone-200 bg-white" />}
            >
              <SiteHeader
                storeName={settings.store_name}
                phone={settings.contact_phone}
                freeDeliveryNote={settings.free_delivery_note}
              />
            </Suspense>

            <main className="flex-1">{children}</main>

            <SiteFooter
              info={{
                storeName: settings.store_name,
                tagline: settings.store_tagline,
                phone: settings.contact_phone,
                email: settings.contact_email,
                address: settings.contact_address,
                facebookUrl: settings.facebook_url,
              }}
            />
          </WishlistProvider>
        </CartProvider>

        {/*
          Vercel Analytics ও Speed Insights — ডিপ্লয় করার পর Vercel
          ড্যাশবোর্ডে কে কোথা থেকে আসছে, কোন বই দেখা হচ্ছে কিন্তু কেনা হচ্ছে
          না — এসব দেখা যাবে। ডেটা Vercel-এই থাকে, কোনো কুকি লাগে না।
          লোকাল ডেভেলপমেন্টে চুপচাপ নিষ্ক্রিয় থাকে।
        */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
