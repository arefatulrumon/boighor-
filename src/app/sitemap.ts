import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { SITE_URL } from "@/lib/supabase/env";

export const revalidate = 3600; // ঘণ্টায় একবার

/**
 * sitemap.xml — Google কে জানায় কোন পেজ আছে।
 * শুধু পাবলিক পেজ; অ্যাডমিন/কার্ট/চেকআউট বাদ।
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();

  const [{ data: books }, { data: categories }] = await Promise.all([
    supabase
      .from("books")
      .select("slug, id, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(5000),
    supabase.from("categories").select("slug").eq("is_active", true),
  ]);

  const bookRows = (books ?? []) as unknown as Array<{
    slug: string | null;
    id: string;
    updated_at?: string | null;
  }>;
  const categoryRows = (categories ?? []) as unknown as Array<{ slug: string }>;

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/books`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/track`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const bookPages: MetadataRoute.Sitemap = bookRows.map((b) => ({
    url: `${SITE_URL}/books/${b.slug ?? b.id}`,
    lastModified: b.updated_at ? new Date(b.updated_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryPages: MetadataRoute.Sitemap = categoryRows.map((c) => ({
    url: `${SITE_URL}/books?category=${encodeURIComponent(c.slug)}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...categoryPages, ...bookPages];
}
