"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkImportBooks, type BulkImportResult } from "@/lib/actions/book-import";
import {
  BOOK_CSV_HEADERS,
  BOOK_CSV_LABELS,
  buildTemplateCsv,
  validateBookImportRow,
  type BookImportRowResult,
} from "@/lib/book-import";
import { downloadCsv, parseCsv, rowToObject, toCsv } from "@/lib/csv";
import { toBanglaDigits } from "@/lib/format";
import { cn } from "@/components/ui";
import { Alert, Button, Card, CardHeader } from "@/components/ui";

const PREVIEW_LIMIT = 60;

interface Parsed {
  headers: string[];
  rows: Array<Record<string, string>>;
  results: BookImportRowResult[];
  fatal: string | null;
  missingColumns: string[];
}

export function CsvImport({ categorySlugs }: { categorySlugs: Array<{ slug: string; name_bn: string }> }) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  const slugMap = useMemo(
    () => new Map(categorySlugs.map((c) => [c.slug, c.slug])),
    [categorySlugs]
  );

  const okCount = parsed?.results.filter((r) => r.ok).length ?? 0;
  const badCount = parsed?.results.filter((r) => !r.ok).length ?? 0;

  /* ------------------------------ টেমপ্লেট নামানো ------------------------------ */
  function downloadTemplate() {
    const { headers, example } = buildTemplateCsv();
    // দ্বিতীয় লাইনে বাংলা নাম (লেবেল) — কোন কলাম কী বোঝায়
    const labelRow = BOOK_CSV_HEADERS.map((h) => BOOK_CSV_LABELS[h]);
    downloadCsv("boi-import-template.csv", toCsv(headers, [labelRow, example], { bom: true }));
  }

  /* -------------------------------- ফাইল পড়া -------------------------------- */
  async function handleFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setFileName(file.name);

    const text = await file.text();
    const { headers, rows, errors } = parseCsv(text);

    if (headers.length === 0) {
      setParsed({
        headers: [],
        rows: [],
        results: [],
        fatal: errors[0] ?? "ফাইলটি পড়া যায়নি।",
        missingColumns: [],
      });
      return;
    }

    // আবশ্যক কলাম আছে কি না
    const missingColumns = (["title_bn", "price"] as const).filter(
      (col) => !headers.includes(col)
    );

    const objects = rows.map((r) => rowToObject(headers, r));

    // ⚠️ এখানে ডেটাবেসের category map নেই, তাই slug → slug ধরে যাচাই হয়।
    //    আসল যাচাই সার্ভারে হয়, যেখানে সত্যিকারের uuid ম্যাপ আছে।
    const results = objects.map((o, i) => validateBookImportRow(o, i + 1, slugMap));

    setParsed({
      headers,
      rows: objects,
      results,
      fatal: missingColumns.length > 0
        ? `আবশ্যক কলাম নেই: ${missingColumns.join(", ")}`
        : null,
      missingColumns,
    });
  }

  /* -------------------------------- ইমপোর্ট -------------------------------- */
  function runImport() {
    if (!parsed || parsed.rows.length === 0) return;

    // শুধু বৈধ সারিগুলো পাঠানো হয় — ফলে অপ্রয়োজনীয় ডেটা ট্রান্সফার হয় না
    const validObjects = parsed.rows.filter((_, i) => parsed.results[i].ok);

    startTransition(async () => {
      const res = await bulkImportBooks(validObjects);
      setResult(res);
      router.refresh();
    });
  }

  /* ---------------------------------- UI ---------------------------------- */
  return (
    <div className="space-y-5">
      {/* ধাপ ১ — ফাইল */}
      <Card>
        <CardHeader
          title="১. CSV ফাইল বাছুন"
          action={
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              ⬇️ নমুনা ফাইল
            </Button>
          }
        />
        <div className="px-5 py-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void handleFile(e.dataTransfer.files[0]);
            }}
            className={cn(
              "rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors",
              dragOver ? "border-emerald-700 bg-emerald-50" : "border-stone-300 bg-stone-50"
            )}
          >
            <p className="text-3xl" aria-hidden>📄</p>
            <p className="mt-2 text-sm font-medium text-stone-800">
              CSV ফাইল টেনে ছাড়ুন
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Excel থেকে &quot;CSV UTF-8&quot; হিসেবে সেভ করে নিন
            </p>

            <label className="mt-4 inline-flex cursor-pointer items-center rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900">
              অথবা ফাইল বাছুন
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </label>

            {fileName && (
              <p className="mt-3 text-xs text-stone-600">
                বাছা হয়েছে: <strong>{fileName}</strong>
              </p>
            )}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-stone-600 hover:text-stone-800">
              কলামগুলোর তালিকা ও নিয়ম দেখুন
            </summary>
            <div className="mt-3 space-y-3 text-xs text-stone-600">
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {BOOK_CSV_HEADERS.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <code className="rounded bg-stone-100 px-1 py-0.5 text-[11px] text-stone-800">
                      {h}
                    </code>
                    <span>{BOOK_CSV_LABELS[h]}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-lg bg-stone-50 p-3">
                <p><strong>আবশ্যক:</strong> title_bn, price</p>
                <p className="mt-1">
                  <strong>লেখার নিয়ম:</strong> ভাষা — bangla / english / arabic / hindi;
                  বাঁধাই — paperback / hardcover / spiral / ebook; তারিখ — 2024 আকারে;
                  সংখ্যা ইংরেজিতে (৪৫০ নয়, 450); নির্বাচিত — হ্যাঁ / না।
                </p>
                <p className="mt-1">
                  <strong>বিভাগের slug:</strong>{" "}
                  {categorySlugs.map((c) => `${c.slug} (${c.name_bn})`).join(", ")}
                </p>
              </div>
            </div>
          </details>
        </div>
      </Card>

      {/* ধাপ ২ — প্রিভিউ */}
      {parsed && (
        <Card>
          <CardHeader title="২. যাচাইয়ের ফলাফল" />
          <div className="px-5 py-4">
            {parsed.fatal ? (
              <Alert tone="error">{parsed.fatal}</Alert>
            ) : (
              <>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
                    ✅ ঠিক আছে: <strong>{toBanglaDigits(okCount)}</strong>
                  </span>
                  {badCount > 0 && (
                    <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-800">
                      ⚠️ সমস্যা: <strong>{toBanglaDigits(badCount)}</strong>
                    </span>
                  )}
                  <span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-stone-700">
                    মোট: <strong>{toBanglaDigits(parsed.rows.length)}</strong>
                  </span>
                </div>

                <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-50 text-left uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">অবস্থা</th>
                        <th className="px-3 py-2">বই</th>
                        <th className="px-3 py-2">লেখক</th>
                        <th className="px-3 py-2 text-right">দাম</th>
                        <th className="px-3 py-2 text-right">স্টক</th>
                        <th className="px-3 py-2">সমস্যা</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {parsed.results.slice(0, PREVIEW_LIMIT).map((r) => (
                        <tr key={r.line} className={cn(!r.ok && "bg-rose-50/60")}>
                          <td className="tabular px-3 py-2 text-stone-500">
                            {toBanglaDigits(r.line)}
                          </td>
                          <td className="px-3 py-2">
                            {r.ok ? (
                              <span className="text-emerald-700">✓</span>
                            ) : (
                              <span className="text-rose-600">✕</span>
                            )}
                          </td>
                          <td className="max-w-56 truncate px-3 py-2 text-stone-800">
                            {r.preview.title}
                          </td>
                          <td className="max-w-32 truncate px-3 py-2 text-stone-600">
                            {r.preview.author}
                          </td>
                          <td className="tabular px-3 py-2 text-right text-stone-700">
                            {r.preview.price}
                          </td>
                          <td className="tabular px-3 py-2 text-right text-stone-700">
                            {r.preview.stock}
                          </td>
                          <td className="px-3 py-2 text-rose-700">
                            {r.errors.join("; ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {parsed.results.length > PREVIEW_LIMIT && (
                    <p className="border-t border-stone-200 bg-stone-50 px-3 py-2 text-center text-xs text-stone-500">
                      প্রথম {toBanglaDigits(PREVIEW_LIMIT)}টি দেখানো হচ্ছে, মোট{" "}
                      {toBanglaDigits(parsed.results.length)}টি।
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* ধাপ ৩ — ইমপোর্ট */}
      {parsed && !parsed.fatal && (
        <Card>
          <CardHeader title="৩. ইমপোর্ট করুন" />
          <div className="space-y-3 px-5 py-4">
            <p className="text-sm text-stone-600">
              {toBanglaDigits(okCount)}টি বৈধ বই যোগ করা হবে।
              {badCount > 0 &&
                ` ${toBanglaDigits(badCount)}টি সারি বাদ পড়বে — সমস্যা ঠিক করে আবার আপলোড করতে পারবেন।`}
            </p>

            {result && (
              <Alert tone={result.ok ? "success" : "error"}>
                <p>{result.message}</p>
                {result.errors && result.errors.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {result.errors.slice(0, 15).map((e) => (
                      <li key={e.line}>
                        সারি {toBanglaDigits(e.line)}: {e.problems.join("; ")}
                      </li>
                    ))}
                    {result.errors.length > 15 && (
                      <li>…আরও {toBanglaDigits(result.errors.length - 15)}টি</li>
                    )}
                  </ul>
                )}
              </Alert>
            )}

            <Button
              type="button"
              size="lg"
              disabled={pending || okCount === 0 || Boolean(result?.ok && badCount === 0)}
              onClick={runImport}
            >
              {pending
                ? "ইমপোর্ট হচ্ছে..."
                : `${toBanglaDigits(okCount)}টি বই যোগ করুন`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
