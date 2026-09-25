import { BOOK_BINDING_LABEL_BN, BOOK_LANGUAGE_LABEL_BN } from "@/lib/constants";
import type { BookBinding, BookLanguage } from "@/types/database";

/**
 * CSV থেকে বই ইমপোর্টের ভ্যালিডেশন।
 *
 * ⚠️ এই ফাইলটি ক্লায়েন্ট ও সার্ভার **দুই জায়গাতেই** ব্যবহার হয়।
 *    ফলে প্রিভিউতে যে সারি সবুজ দেখাবে, সার্ভারেও ঠিক সেটাই সফল হবে।
 *    দুই জায়গায় আলাদা নিয়ম লিখলে একদিন অমিল হয়ে যেত।
 */

export const BOOK_CSV_HEADERS = [
  "title_bn",
  "title_en",
  "author",
  "translator",
  "publisher",
  "isbn",
  "edition",
  "language",
  "binding",
  "pages",
  "publication_year",
  "price",
  "compare_at_price",
  "cost_price",
  "stock_qty",
  "weight_grams",
  "category_slug",
  "cover_image_url",
  "description_bn",
  "is_featured",
] as const;

export type BookCsvHeader = (typeof BOOK_CSV_HEADERS)[number];

/** প্রতিটি কলামের বাংলা নাম — প্রিভিউ টেবিল ও টেমপ্লেটে দেখানো হয় */
export const BOOK_CSV_LABELS: Record<BookCsvHeader, string> = {
  title_bn: "নাম (বাংলা)*",
  title_en: "নাম (ইংরেজি)",
  author: "লেখক",
  translator: "অনুবাদক",
  publisher: "প্রকাশনী",
  isbn: "ISBN",
  edition: "সংস্করণ",
  language: "ভাষা",
  binding: "বাঁধাই",
  pages: "পৃষ্ঠা",
  publication_year: "প্রকাশকাল",
  price: "দাম*",
  compare_at_price: "আগের দাম",
  cost_price: "ক্রয়মূল্য",
  stock_qty: "স্টক*",
  weight_grams: "ওজন (গ্রাম)",
  category_slug: "বিভাগের slug",
  cover_image_url: "কভার ছবির URL",
  description_bn: "বিবরণ",
  is_featured: "নির্বাচিত (হ্যাঁ/না)",
};

const LANGUAGE_LOOKUP: Record<string, BookLanguage> = {
  bangla: "bangla", বাংলা: "bangla", bn: "bangla",
  english: "english", ইংরেজি: "english", en: "english",
  arabic: "arabic", আরবি: "arabic", ar: "arabic",
  hindi: "hindi", হিন্দি: "hindi", hi: "hindi",
};

const BINDING_LOOKUP: Record<string, BookBinding> = {
  paperback: "paperback", পেপারব্যাক: "paperback", "পেপার ব্যাক": "paperback",
  hardcover: "hardcover", হার্ডকভার: "hardcover", "হার্ড কভার": "hardcover",
  spiral: "spiral", স্পাইরাল: "spiral",
  ebook: "ebook", "ই-বুক": "ebook", ইবুক: "ebook",
};

const TRUE_WORDS = new Set(["true", "1", "yes", "y", "হ্যাঁ", "হ্যা", "hae", "হাঁ"]);

/** ইংরেজি বা বাংলা সংখ্যা → number */
function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const normalized = raw
    .replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))
    .replace(/[,\s৳]/g, "")
    .trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export interface BookImportData {
  title_bn: string;
  title_en: string | null;
  author: string | null;
  translator: string | null;
  publisher: string | null;
  isbn: string | null;
  edition: string | null;
  language: BookLanguage;
  binding: BookBinding;
  pages: number | null;
  publication_year: number | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  stock_qty: number;
  weight_grams: number | null;
  category_id: string | null;
  cover_image_url: string | null;
  description_bn: string | null;
  is_featured: boolean;
}

export interface BookImportRowResult {
  /** CSV-তে সারি নম্বর (১ = প্রথম ডেটা সারি) */
  line: number;
  ok: boolean;
  errors: string[];
  data: BookImportData | null;
  /** প্রিভিউ টেবিলে দেখানোর জন্য */
  preview: { title: string; author: string; price: string; stock: string };
}

/**
 * একটি CSV সারি যাচাই করে।
 *
 * `categorySlugs` — slug → uuid ম্যাপ (ডেটাবেস থেকে একবার আনলেই হয়)
 */
export function validateBookImportRow(
  raw: Record<string, string>,
  line: number,
  categorySlugs: Map<string, string>
): BookImportRowResult {
  const errors: string[] = [];

  const title = (raw.title_bn ?? "").trim();
  if (title.length < 2) errors.push("নাম (বাংলা) নেই বা খুব ছোট");
  else if (title.length > 300) errors.push("নাম অনেক বড় (৩০০ অক্ষরের বেশি)");

  const price = parseNumber(raw.price ?? "");
  if (price === null) errors.push("দাম নেই বা সংখ্যা নয়");
  else if (price < 0) errors.push("দাম ঋণাত্মক হতে পারে না");

  const stock = parseNumber(raw.stock_qty ?? "");
  const stockQty = stock === null ? 0 : Math.trunc(stock);
  if (stockQty < 0) errors.push("স্টক ঋণাত্মক হতে পারে না");

  const compareAt = parseNumber(raw.compare_at_price ?? "");
  if (compareAt !== null && price !== null && compareAt > 0 && compareAt < price) {
    errors.push("আগের দাম বর্তমান দামের চেয়ে কম হতে পারে না");
  }

  const language = raw.language ? LANGUAGE_LOOKUP[raw.language.trim().toLowerCase()] : "bangla";
  if (raw.language && !language) {
    errors.push(
      `ভাষা "${raw.language}" চেনা যায়নি (${Object.keys(BOOK_LANGUAGE_LABEL_BN).join(", ")})`
    );
  }

  const binding = raw.binding ? BINDING_LOOKUP[raw.binding.trim().toLowerCase()] : "paperback";
  if (raw.binding && !binding) {
    errors.push(
      `বাঁধাই "${raw.binding}" চেনা যায়নি (${Object.keys(BOOK_BINDING_LABEL_BN).join(", ")})`
    );
  }

  const pages = parseNumber(raw.pages ?? "");
  if (pages !== null && pages <= 0) errors.push("পৃষ্ঠা সংখ্যা শূন্যের বেশি হতে হবে");

  const year = parseNumber(raw.publication_year ?? "");
  if (year !== null && (year < 1500 || year > 2100)) {
    errors.push("প্রকাশকাল ১৫০০–২১০০ এর মধ্যে হতে হবে");
  }

  const categorySlugRaw = (raw.category_slug ?? "").trim();
  let categoryId: string | null = null;
  if (categorySlugRaw) {
    categoryId = categorySlugs.get(categorySlugRaw) ?? null;
    if (!categoryId) errors.push(`বিভাগ "${categorySlugRaw}" পাওয়া যায়নি`);
  }

  const cover = (raw.cover_image_url ?? "").trim();
  if (cover && !/^https?:\/\//i.test(cover)) {
    errors.push("কভার ছবির URL http:// বা https:// দিয়ে শুরু হতে হবে");
  }

  const featuredRaw = (raw.is_featured ?? "").trim().toLowerCase();

  const data: BookImportData = {
    title_bn: title,
    title_en: (raw.title_en ?? "").trim() || null,
    author: (raw.author ?? "").trim() || null,
    translator: (raw.translator ?? "").trim() || null,
    publisher: (raw.publisher ?? "").trim() || null,
    isbn: (raw.isbn ?? "").trim() || null,
    edition: (raw.edition ?? "").trim() || null,
    language: language ?? "bangla",
    binding: binding ?? "paperback",
    pages: pages === null ? null : Math.trunc(pages),
    publication_year: year === null ? null : Math.trunc(year),
    price: price ?? 0,
    compare_at_price: compareAt,
    cost_price: parseNumber(raw.cost_price ?? ""),
    stock_qty: stockQty,
    weight_grams: weightGrams(raw.weight_grams),
    category_id: categoryId,
    cover_image_url: cover || null,
    description_bn: (raw.description_bn ?? "").trim() || null,
    is_featured: featuredRaw ? TRUE_WORDS.has(featuredRaw) : false,
  };

  return {
    line,
    ok: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : null,
    preview: {
      title: title || "—",
      author: (raw.author ?? "").trim() || "—",
      price: price === null ? "—" : String(price),
      stock: String(stockQty),
    },
  };
}

function weightGrams(raw: string | undefined): number | null {
  const n = parseNumber(raw ?? "");
  if (n === null || n <= 0) return null;
  return Math.trunc(n);
}

/** ডাউনলোড করার জন্য নমুনা CSV — বাংলা শিরোনাম কমেন্ট হিসেবে নিচে দেওয়া */
export function buildTemplateCsv(): { headers: string[]; example: string[] } {
  return {
    headers: [...BOOK_CSV_HEADERS],
    example: [
      "পথের পাঁচালী",
      "Pather Panchali",
      "বিভূতিভূষণ বন্দ্যোপাধ্যায়",
      "",
      "আনন্দ পাবলিশার্স",
      "978-8170660751",
      "১ম",
      "bangla",
      "hardcover",
      "288",
      "1929",
      "450",
      "550",
      "320",
      "25",
      "350",
      "fiction",
      "",
      "বাংলা সাহিত্যের অন্যতম শ্রেষ্ঠ উপন্যাস।",
      "হ্যাঁ",
    ],
  };
}
