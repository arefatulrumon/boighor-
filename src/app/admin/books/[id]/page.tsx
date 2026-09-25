import Link from "next/link";
import { notFound } from "next/navigation";
import { BookForm } from "@/components/admin/book-form";
import { createClient } from "@/lib/supabase/server";
import type { Book } from "@/types/database";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditBookPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: bookData }, { data: categories }] = await Promise.all([
    supabase.from("books").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name_bn").eq("is_active", true).order("sort_order"),
  ]);

  if (!bookData) notFound();
  const book = bookData as unknown as Book;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/books" className="text-sm text-stone-500 hover:text-emerald-800">
            ← সব বই
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-stone-900">{book.title_bn}</h1>
          <p className="mt-1 text-sm text-stone-600">
            স্লাগ: <code className="rounded bg-stone-100 px-1.5 py-0.5">{book.slug}</code>
          </p>
        </div>

        <Link
          href={`/books/${book.slug ?? book.id}`}
          target="_blank"
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
        >
          ↗ ওয়েবসাইটে দেখুন
        </Link>
      </div>

      <BookForm categories={categories ?? []} book={book} />
    </div>
  );
}
