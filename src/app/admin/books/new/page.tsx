import Link from "next/link";
import { BookForm } from "@/components/admin/book-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewBookPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name_bn")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/books" className="text-sm text-stone-500 hover:text-emerald-800">
          ← সব বই
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-stone-900">নতুন বই যোগ করুন</h1>
        <p className="mt-1 text-sm text-stone-600">
          নাম আর দাম দিলেই হয় — বাকিগুলো পরে যোগ করতে পারবেন।
        </p>
      </div>

      <BookForm categories={categories ?? []} />
    </div>
  );
}
