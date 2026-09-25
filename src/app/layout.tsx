import type { Metadata, Viewport } from "next";
import { Noto_Sans_Bengali } from "next/font/google";
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
 * বাংলা ফন্ট — next/font নিজেই ফন্ট ডাউনলোড করে সেল্ফ-হোস্ট করে,
 * তাই ব্রাউজার Google সার্ভারে আলাদা রিকোয়েস্ট করে না (দ্রুত + প্রাইভেট)।
 *
 * 💡 Noto Sans Bengali একটি variable font (weight 100–900), তাই `weight`
 *    দেওয়া হয়নি — দিলে next/font এরর দেবে।
 */
const bangla = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bangla",
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
    <html lang="bn" className={bangla.variable}>
      <body className="font-sans antialiased">
        <CartProvider>
          <WishlistProvider>
            {settings.announcement && (
              <div className="no-print bg-emerald-900 px-4 py-2 text-center text-sm text-white">
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
              <SiteHeader storeName={settings.store_name} />
            </Suspense>

            <main className="min-h-[60vh]">{children}</main>

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
