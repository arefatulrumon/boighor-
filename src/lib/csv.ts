/**
 * ছোট CSV পার্সার ও জেনারেটর।
 *
 * কেন নিজে লিখলাম? CSV আসলে জটিল — কোটেশনের ভেতরে কমা, লাইনের ভেতরে
 * নতুন লাইন, ডাবল-কোট এস্কেপ (""), BOM — এসব সামলাতে হয়। একটি ছোট,
 * বোঝা-যায় এমন ফাংশন পুরো লাইব্রেরির চেয়ে ভালো, আর টেস্টও সহজ।
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** পার্স করতে গিয়ে সমস্যা হলে (যেমন শিরোনাম না থাকলে) */
  errors: string[];
}

/** Excel থেকে নামানো ফাইলে শুরুর দিকে BOM থাকে — ওটা সরাতে হবে */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * কোন অক্ষর দিয়ে কলাম আলাদা করা হয়েছে তা অনুমান করা।
 * Excel এর কিছু লোকাল সেটিংসে সেমিকোলন (`;`) বা ট্যাব ব্যবহার হয়।
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: Array<[string, number]> = [
    [",", (firstLine.match(/,/g) ?? []).length],
    [";", (firstLine.match(/;/g) ?? []).length],
    ["\t", (firstLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/**
 * CSV টেক্সট → শিরোনাম + সারি।
 * কোটেড ফিল্ড, এস্কেপড কোট, এবং ফিল্ডের ভেতরের নতুন লাইন — সব সামলায়।
 */
export function parseCsv(input: string): ParsedCsv {
  const text = stripBom(input);
  const errors: string[] = [];

  if (!text.trim()) {
    return { headers: [], rows: [], errors: ["ফাইলটি খালি।"] };
  }

  const delimiter = detectDelimiter(text);

  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    current.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    // পুরো খালি সারি বাদ দেওয়া হয় (Excel এ প্রায়ই থাকে)
    if (!(current.length === 1 && current[0].trim() === "")) {
      rows.push(current);
    }
    current = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // এস্কেপড কোট — "" মানে একটি "
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      pushRow();
      i += text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  // শেষ সারি (ফাইল নতুন লাইন দিয়ে শেষ না হলে)
  if (field !== "" || current.length > 0) pushRow();

  if (rows.length === 0) {
    return { headers: [], rows: [], errors: ["ফাইলে কোনো সারি নেই।"] };
  }

  const headerRow = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const body = rows.slice(1);

  if (headerRow.length === 0) {
    errors.push("প্রথম সারিতে কলামের নাম থাকতে হবে।");
  }

  // প্রতিটি সারিকে শিরোনামের সংখ্যার সাথে মিলিয়ে নেওয়া (কম হলে খালি যোগ)
  const normalized = body.map((r) => {
    if (r.length < headerRow.length) {
      return [...r, ...Array(headerRow.length - r.length).fill("")];
    }
    return r.slice(0, headerRow.length);
  });

  return { headers: headerRow, rows: normalized, errors };
}

/** শিরোনাম → মান এর ম্যাপ (প্রতিটি সারির জন্য) */
export function rowToObject(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((h, idx) => {
    out[h] = (row[idx] ?? "").trim();
  });
  return out;
}

/** একটি সেল CSV-এর জন্য নিরাপদ করা — কমা/কোট/নিউলাইন থাকলে কোটে মুড়ে দেয় */
function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * CSV তৈরি।
 * ⚠️ `bom: true` দিলে শুরুর দিকে BOM বসে — Excel এ বাংলা ঠিকভাবে
 *    দেখানোর জন্য এটা দরকার, নাহলে লেখা ভেঙে যায়।
 */
export function toCsv(
  headers: string[],
  rows: Array<Array<unknown>>,
  options: { bom?: boolean } = {}
): string {
  const body = [
    headers.map(escapeCell).join(","),
    ...rows.map((r) => r.map(escapeCell).join(",")),
  ].join("\r\n");

  return (options.bom ? "\ufeff" : "") + body;
}

/** ব্রাউজারে CSV ডাউনলোড করানো */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
