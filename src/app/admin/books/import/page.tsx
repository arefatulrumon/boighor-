import Link from "next/link";
import { CsvImport } from "@/components/admin/csv-import";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "CSV থেকে বই যোগ করুন",
  robots: { index: false, follow: false },
};

export default async function ImportBooksPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("slug, name_bn")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/books" className="text-sm text-stone-500 hover:text-emerald-800">
          ← সব বই
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-stone-900">CSV থেকে বই যোগ করুন</h1>
        <p className="prose-bn mt-1 text-sm text-stone-600">
          একবারে শত শত বই যোগ করুন। ফাইল আপলোড করার সাথে সাথেই যাচাই হয়ে যাবে —
          কোন সারিতে কী সমস্যা আছে তা ইমপোর্টের আগেই দেখতে পাবেন।
        </p>
      </div>

      <CsvImport categorySlugs={categories ?? []} />
    </div>
  );
}
