import { describe, expect, it } from "vitest";
import {
  BOOK_CSV_HEADERS,
  buildTemplateCsv,
  validateBookImportRow,
} from "@/lib/book-import";

const CATEGORIES = new Map<string, string>([
  ["fiction", "11111111-1111-1111-1111-111111111111"],
  ["science", "22222222-2222-2222-2222-222222222222"],
]);

/** একটি বৈধ সারি — তারপর এক এক করে ভাঙা হবে */
function row(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    title_bn: "পথের পাঁচালী",
    author: "বিভূতিভূষণ বন্দ্যোপাধ্যায়",
    price: "450",
    stock_qty: "25",
    ...overrides,
  };
}

function check(overrides: Record<string, string> = {}) {
  return validateBookImportRow(row(overrides), 1, CATEGORIES);
}

describe("validateBookImportRow — বৈধ সারি", () => {
  it("আবশ্যক ফিল্ড থাকলে পাস করে", () => {
    const r = check();
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.data).not.toBeNull();
  });

  it("সংখ্যা ও বুলিয়ান ঠিকভাবে রূপান্তর করে", () => {
    const r = check({
      pages: "288",
      publication_year: "1929",
      compare_at_price: "550",
      is_featured: "হ্যাঁ",
    });
    expect(r.data?.pages).toBe(288);
    expect(r.data?.publication_year).toBe(1929);
    expect(r.data?.compare_at_price).toBe(550);
    expect(r.data?.is_featured).toBe(true);
  });

  it("বাংলা সংখ্যাও পড়তে পারে", () => {
    const r = check({ price: "৪৫০", stock_qty: "২৫" });
    expect(r.data?.price).toBe(450);
    expect(r.data?.stock_qty).toBe(25);
  });

  it("বাংলা ভাষার নাম বুঝে নেয়", () => {
    expect(check({ language: "বাংলা" }).data?.language).toBe("bangla");
    expect(check({ language: "english" }).data?.language).toBe("english");
    expect(check({ language: "" }).data?.language).toBe("bangla"); // ডিফল্ট
  });

  it("বাংলা বাঁধাইয়ের নাম বুঝে নেয়", () => {
    expect(check({ binding: "হার্ডকভার" }).data?.binding).toBe("hardcover");
    expect(check({ binding: "" }).data?.binding).toBe("paperback"); // ডিফল্ট
  });

  it("বিভাগের slug কে uuid তে বদলায়", () => {
    const r = check({ category_slug: "fiction" });
    expect(r.data?.category_id).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("স্টক না দিলে ০ ধরে নেয় (ক্র্যাশ করে না)", () => {
    const r = validateBookImportRow({ title_bn: "বই", price: "১০০" }, 1, CATEGORIES);
    expect(r.ok).toBe(true);
    expect(r.data?.stock_qty).toBe(0);
  });

  it("হ্যাঁ ছাড়া অন্য কিছু দিলে false", () => {
    expect(check({ is_featured: "না" }).data?.is_featured).toBe(false);
    expect(check({ is_featured: "false" }).data?.is_featured).toBe(false);
    expect(check({ is_featured: "yes" }).data?.is_featured).toBe(true);
  });
});

describe("validateBookImportRow — ভুল সারি", () => {
  it("নাম না থাকলে এরর", () => {
    const r = check({ title_bn: "" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("নাম");
  });

  it("দাম না থাকলে এরর", () => {
    expect(check({ price: "" }).ok).toBe(false);
    expect(check({ price: "abc" }).ok).toBe(false);
  });

  it("ঋণাত্মক দাম বা স্টক প্রত্যাখ্যান করে", () => {
    expect(check({ price: "-১০" }).ok).toBe(false);
    expect(check({ stock_qty: "-৫" }).ok).toBe(false);
  });

  it("আগের দাম বর্তমানের চেয়ে কম হলে এরর", () => {
    const r = check({ price: "500", compare_at_price: "400" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("আগের দাম");
  });

  it("অচেনা ভাষা বা বাঁধাই ধরতে পারে", () => {
    expect(check({ language: "জাপানি" }).ok).toBe(false);
    expect(check({ binding: "স্ক্রু" }).ok).toBe(false);
  });

  it("অচেনা বিভাগ ধরতে পারে", () => {
    const r = check({ category_slug: "porikkha" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("porikkha");
  });

  it("প্রকাশকাল সীমার বাইরে হলে এরর", () => {
    expect(check({ publication_year: "1200" }).ok).toBe(false);
    expect(check({ publication_year: "3000" }).ok).toBe(false);
  });

  it("ভুল কভার URL ধরতে পারে", () => {
    expect(check({ cover_image_url: "chobi.jpg" }).ok).toBe(false);
    expect(check({ cover_image_url: "https://x.com/a.jpg" }).ok).toBe(true);
  });

  it("একাধিক সমস্যা একসাথে রিপোর্ট করে", () => {
    const r = check({ title_bn: "", price: "", language: "??" });
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("ব্যর্থ হলে data null থাকে (ভুল ডেটা ইনসার্ট হতে পারে না)", () => {
    expect(check({ price: "" }).data).toBeNull();
  });
});

describe("আউটপুট আকৃতি", () => {
  it("প্রিভিউ তথ্য সবসময় থাকে, ভুল সারিতেও", () => {
    const bad = check({ price: "" });
    expect(bad.preview.title).toBe("পথের পাঁচালী");
    expect(bad.preview.price).toBe("—");
  });
});

describe("buildTemplateCsv", () => {
  it("শিরোনামের সংখ্যা ও উদাহরণ সারির সংখ্যা সমান", () => {
    const { headers, example } = buildTemplateCsv();
    expect(headers.length).toBe(example.length);
  });

  it("শিরোনামগুলো BOOK_CSV_HEADERS এর সাথে হুবহু মেলে", () => {
    expect(buildTemplateCsv().headers).toEqual([...BOOK_CSV_HEADERS]);
  });

  it("উদাহরণ সারিটা নিজেই বৈধ (ব্যবহারকারী খালি টেমপ্লেট আপলোড করলেও কাজ করবে)", () => {
    const { headers, example } = buildTemplateCsv();
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      raw[h] = example[i];
    });

    // category_slug "fiction" সিড করা আছে ধরে নিয়ে
    const r = validateBookImportRow(raw, 1, CATEGORIES);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
