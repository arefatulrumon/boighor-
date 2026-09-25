import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // ব্যক্তিগত এলাকা সার্চ ইঞ্জিন থেকে লুকানো
        disallow: ["/admin", "/admin/", "/cart", "/checkout", "/order/", "/login", "/track"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
