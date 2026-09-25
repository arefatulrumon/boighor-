"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBook, updateBook } from "@/lib/actions/admin";
import { BOOK_BINDING_LABEL_BN, BOOK_LANGUAGE_LABEL_BN } from "@/lib/constants";
import { formatTaka } from "@/lib/format";
import type { Book, BookBinding, BookLanguage, Category } from "@/types/database";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { GalleryUploader, SingleImageUploader } from "./image-uploader";

interface Props {
  categories: Pick<Category, "id" | "name_bn">[];
  book?: Book;
}

export function BookForm({ categories, book }: Props) {
  const router = useRouter();
  const isEdit = Boolean(book);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // লাইভ প্রিভিউ — অ্যাডমিন যেন দাম/ছাড় ঠিক আছে দেখে নিতে পারে
  const [price, setPrice] = useState(String(book?.price ?? ""));
  const [compareAt, setCompareAt] = useState(String(book?.compare_at_price ?? ""));

  const priceNum = Number(price) || 0;
  const compareNum = Number(compareAt) || 0;
  const off =
    compareNum > priceNum && priceNum > 0
      ? Math.round(((compareNum - priceNum) / compareNum) * 100)
      : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEdit ? await updateBook(formData) : await createBook(formData);

      if (result.ok) {
        router.push("/admin/books");
        router.refresh();
        return;
      }

      const messages: Record<string, string> = {
        DUPLICATE: "এই ISBN বা স্লাগ আগেই ব্যবহৃত হয়েছে।",
        INVALID_TITLE: "বইয়ের নাম কমপক্ষে ২ অক্ষরের হতে হবে।",
        INVALID_PRICE: "দাম সঠিক নয়।",
        FORBIDDEN: "আপনার অনুমতি নেই।",
        MISSING_INPUT: "কিছু তথ্য বাকি আছে।",
        SERVER_ERROR: "সেভ করা যায়নি — একটু পরে আবার চেষ্টা করুন।",
      };
      setError(messages[result.code] ?? "সেভ করা যায়নি।");
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {isEdit && <input type="hidden" name="id" value={book!.id} />}

      {/* ============================ মূল তথ্য ============================ */}
      <div className="space-y-5">
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-stone-900">বইয়ের তথ্য</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="বইয়ের নাম (বাংলা)" required>
                <Input name="title_bn" defaultValue={book?.title_bn ?? ""} placeholder="যেমন: পথের পাঁচালী" required />
              </Field>
            </div>

            <Field label="নাম (ইংরেজি)" hint="থাকলে ভালো — সার্চে সাহায্য করে">
              <Input name="title_en" defaultValue={book?.title_en ?? ""} placeholder="Pather Panchali" />
            </Field>

            <Field label="লেখক">
              <Input name="author" defaultValue={book?.author ?? ""} placeholder="বিভূতিভূষণ বন্দ্যোপাধ্যায়" />
            </Field>

            <Field label="অনুবাদক">
              <Input name="translator" defaultValue={book?.translator ?? ""} />
            </Field>

            <Field label="প্রকাশনী">
              <Input name="publisher" defaultValue={book?.publisher ?? ""} placeholder="আনন্দ পাবলিশার্স" />
            </Field>

            <Field label="ISBN">
              <Input name="isbn" defaultValue={book?.isbn ?? ""} placeholder="978-..." />
            </Field>

            <Field label="সংস্করণ">
              <Input name="edition" defaultValue={book?.edition ?? ""} placeholder="৩য় সংস্করণ" />
            </Field>

            <Field label="ভাষা">
              <Select name="language" defaultValue={book?.language ?? "bangla"}>
                {(Object.keys(BOOK_LANGUAGE_LABEL_BN) as BookLanguage[]).map((l) => (
                  <option key={l} value={l}>{BOOK_LANGUAGE_LABEL_BN[l]}</option>
                ))}
              </Select>
            </Field>

            <Field label="বাঁধাই">
              <Select name="binding" defaultValue={book?.binding ?? "paperback"}>
                {(Object.keys(BOOK_BINDING_LABEL_BN) as BookBinding[]).map((b) => (
                  <option key={b} value={b}>{BOOK_BINDING_LABEL_BN[b]}</option>
                ))}
              </Select>
            </Field>

            <Field label="পৃষ্ঠা সংখ্যা">
              <Input name="pages" type="number" min="1" defaultValue={book?.pages ?? ""} placeholder="288" />
            </Field>

            <Field label="প্রকাশকাল (সাল)">
              <Input
                name="publication_year"
                type="number"
                min="1500"
                max="2100"
                defaultValue={book?.publication_year ?? ""}
                placeholder="2024"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="বিভাগ">
                <Select name="category_id" defaultValue={book?.category_id ?? ""}>
                  <option value="">— বিভাগ ছাড়া —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name_bn}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="বিবরণ" hint="বইয়ের পেছনের কভারের লেখা বা নিজের বর্ণনা">
                <Textarea
                  name="description_bn"
                  defaultValue={book?.description_bn ?? ""}
                  className="min-h-32"
                  placeholder="বইটি সম্পর্কে কয়েক লাইন..."
                />
              </Field>
            </div>
          </div>
        </section>

        {/* ---------------------------- SEO ---------------------------- */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-1 text-base font-semibold text-stone-900">SEO (ইচ্ছা হলে)</h2>
          <p className="mb-4 text-xs text-stone-500">
            খালি রাখলে বইয়ের নাম ও বিবরণ থেকেই Google-এর জন্য তথ্য তৈরি হবে।
          </p>
          <div className="space-y-4">
            <Field label="SEO টাইটেল">
              <Input name="seo_title" defaultValue={book?.seo_title ?? ""} maxLength={70} />
            </Field>
            <Field label="SEO বর্ণনা" hint="১৫৫ অক্ষরের মধ্যে রাখলে ভালো">
              <Textarea name="seo_description" defaultValue={book?.seo_description ?? ""} maxLength={160} className="min-h-20" />
            </Field>
          </div>
        </section>
      </div>

      {/* ============================ ডান দিক ============================ */}
      <aside className="space-y-5">
        {/* দাম */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-stone-900">দাম ও স্টক</h2>

          <div className="space-y-4">
            <Field label="বিক্রয় মূল্য (৳)" required>
              <Input
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="450"
                required
              />
            </Field>

            <Field label="আগের দাম (৳)" hint="কাটা দাম দেখাতে — ছাড়ের শতাংশ নিজে হিসাব হবে">
              <Input
                name="compare_at_price"
                type="number"
                step="0.01"
                min="0"
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
                placeholder="550"
              />
            </Field>

            {off !== null && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                গ্রাহক দেখবে: {formatTaka(priceNum, { symbol: true })}{" "}
                <s className="text-stone-400">{formatTaka(compareNum, { symbol: true })}</s>{" "}
                — {off}% ছাড়
              </p>
            )}

            <Field label="ক্রয়মূল্য (৳)" hint="শুধু অ্যাডমিন দেখে — লাভ হিসাবের জন্য">
              <Input name="cost_price" type="number" step="0.01" min="0" defaultValue={book?.cost_price ?? ""} placeholder="320" />
            </Field>

            <Field label="স্টকে কত কপি" required>
              <Input
                name="stock_qty"
                type="number"
                min="0"
                defaultValue={book?.stock_qty ?? 0}
                placeholder="25"
                required
              />
            </Field>

            <Field label="কম স্টক সতর্কতা" hint="এই সংখ্যার নিচে নামলে ড্যাশবোর্ডে দেখাবে">
              <Input
                name="low_stock_threshold"
                type="number"
                min="0"
                defaultValue={book?.low_stock_threshold ?? 3}
              />
            </Field>

            <Field label="ওজন (গ্রাম)" hint="কুরিয়ার চার্জ হিসাবের জন্য">
              <Input name="weight_grams" type="number" min="0" defaultValue={book?.weight_grams ?? ""} placeholder="350" />
            </Field>
          </div>
        </section>

        {/* ছবি — ড্র্যাগ-অ্যান্ড-ড্রপ, সোজা Supabase Storage এ যায় */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-1 text-base font-semibold text-stone-900">ছবি</h2>
          <p className="mb-4 text-xs text-stone-500">
            ছবি নিজে থেকেই ছোট (WebP, সর্বোচ্চ ১৪০০px) হয়ে আপলোড হবে —
            Free plan এর ১ GB স্টোরেজ অনেক দিন চলবে।
          </p>

          <div className="space-y-5">
            {/* `folder` দিলে একই বইয়ের ছবিগুলো এক ফোল্ডারে জমা হয় */}
            <SingleImageUploader
              name="cover_image_url"
              defaultValue={book?.cover_image_url ?? ""}
              folder={book?.id ?? "draft"}
            />

            <GalleryUploader
              name="gallery_json"
              defaultValue={Array.isArray(book?.gallery) ? book!.gallery : []}
              folder={book?.id ?? "draft"}
            />
          </div>
        </section>

        {/* দৃশ্যমানতা */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-stone-900">দৃশ্যমানতা</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={book?.is_active ?? true}
                className="size-4 accent-emerald-800"
              />
              <span>ওয়েবসাইটে দেখাবে (সক্রিয়)</span>
            </label>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="is_featured"
                defaultChecked={book?.is_featured ?? false}
                className="size-4 accent-emerald-800"
              />
              <span>হোমপেজের &quot;নির্বাচিত বই&quot; তে দেখাবে</span>
            </label>
          </div>
        </section>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex gap-3">
          <Button type="submit" size="lg" disabled={pending} className="flex-1">
            {pending ? "সেভ হচ্ছে..." : isEdit ? "পরিবর্তন সেভ করুন" : "বই যোগ করুন"}
          </Button>
          <Link
            href="/admin/books"
            className="inline-flex items-center rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-800 hover:bg-stone-50"
          >
            বাতিল
          </Link>
        </div>
      </aside>
    </form>
  );
}
