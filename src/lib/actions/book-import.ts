"use server";

import { revalidatePath } from "next/cache";
import { FORBIDDEN, requireStaff } from "@/lib/actions/guard";
import { validateBookImportRow, type BookImportData } from "@/lib/book-import";

export interface BulkImportResult {
  ok: boolean;
  code?: string;
  message?: string;
  inserted?: number;
  failed?: number;
  /** কোন সারিতে কী সমস্যা — ব্যবহারকারীকে দেখানোর জন্য */
  errors?: Array<{ line: number; problems: string[] }>;
}

/** একবারে সর্বোচ্চ কত সারি নেওয়া হবে (বডি সাইজ ও টাইমআউটের ভারসাম্য) */
const MAX_ROWS = 2000;
/** এক INSERT-এ কতগুলো সারি (Postgres-এর প্যারামিটার সীমা এড়াতে ছোট রাখা) */
const CHUNK = 100;

/**
 * CSV থেকে একবারে অনেক বই যোগ করা।
 *
 * ⚠️ ক্লায়েন্ট যে ভ্যালিডেশন দেখিয়েছে, সার্ভার **আবার** একই ফাংশন দিয়ে
 *    যাচাই করে (`validateBookImportRow` — একই ফাইল দুই জায়গায় ব্যবহৃত)।
 *    ক্লায়েন্টের পাঠানো ডেটা কখনো সরাসরি বিশ্বাস করা হয় না।
 *
 * কেন chunk-এ ভাঙা? একটি INSERT-এ ৫০০ সারি দিলে একটা খারাপ সারির কারণে
 * পুরোটা ব্যর্থ হয় আর বোঝা যায় না কোনটা। তাই ১০০-র চাঙ্কে ঢুকিয়ে,
 * চাঙ্ক ব্যর্থ হলে সারি-ধরে আবার চেষ্টা করা হয় — ফলে নির্দিষ্ট করে বলা যায়
 * কোন লাইনে সমস্যা।
 */
export async function bulkImportBooks(
  rows: Array<Record<string, string>>
): Promise<BulkImportResult> {
  const guard = await requireStaff();
  if (!guard.ok) return FORBIDDEN;

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, code: "EMPTY", message: "কোনো সারি পাওয়া যায়নি।" };
  }

  if (rows.length > MAX_ROWS) {
    return {
      ok: false,
      code: "TOO_MANY_ROWS",
      message: `একবারে সর্বোচ্চ ${MAX_ROWS}টি বই যোগ করা যায়। ফাইলটি ভাগ করে নিন।`,
    };
  }

  // ---- ক্যাটাগরি slug → id (একবার আনলেই হয়) ----
  const { data: categoryRows } = await guard.supabase
    .from("categories")
    .select("id, slug");

  const categorySlugs = new Map<string, string>(
    (categoryRows ?? []).map((c) => [String(c.slug), String(c.id)])
  );

  // ---- প্রতি সারি যাচাই ----
  const valid: Array<{ line: number; data: BookImportData }> = [];
  const errors: Array<{ line: number; problems: string[] }> = [];

  rows.forEach((raw, index) => {
    const line = index + 1;
    const result = validateBookImportRow(raw, line, categorySlugs);
    if (result.ok && result.data) {
      valid.push({ line, data: result.data });
    } else {
      errors.push({ line, problems: result.errors });
    }
  });

  if (valid.length === 0) {
    return {
      ok: false,
      code: "ALL_INVALID",
      message: "কোনো সারিই বৈধ নয় — নিচের তালিকা দেখুন।",
      inserted: 0,
      failed: errors.length,
      errors: errors.slice(0, 100),
    };
  }

  // ---- চাঙ্কে ইনসার্ট ----
  let inserted = 0;
  const chunks: Array<Array<{ line: number; data: BookImportData }>> = [];
  for (let i = 0; i < valid.length; i += CHUNK) {
    chunks.push(valid.slice(i, i + CHUNK));
  }

  for (const chunk of chunks) {
    const { error } = await guard.supabase
      .from("books")
      .insert(chunk.map((c) => c.data));

    if (!error) {
      inserted += chunk.length;
      continue;
    }

    // চাঙ্ক ব্যর্থ — কোন সারিগুলো সমস্যার তা বের করতে এক এক করে চেষ্টা
    console.warn("[bulkImportBooks] চাঙ্ক ব্যর্থ, সারি-ধরে আবার চেষ্টা:", error.message);

    for (const row of chunk) {
      const { error: rowError } = await guard.supabase.from("books").insert(row.data);
      if (rowError) {
        errors.push({ line: row.line, problems: [rowError.message] });
      } else {
        inserted += 1;
      }
    }
  }

  revalidatePath("/admin/books");
  revalidatePath("/books");
  revalidatePath("/");

  errors.sort((a, b) => a.line - b.line);

  return {
    ok: inserted > 0,
    inserted,
    failed: errors.length,
    errors: errors.slice(0, 100),
    message:
      errors.length === 0
        ? "সব সারি সফলভাবে যোগ হয়েছে।"
        : `${inserted}টি যোগ হয়েছে, ${errors.length}টি ব্যর্থ।`,
  };
}
