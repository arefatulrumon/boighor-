#!/usr/bin/env node
/**
 * সব migration কে একটি ফাইলে জোড়া দেয় → supabase/RUN_ALL_IN_SQL_EDITOR.sql
 *
 * কেন দরকার?
 *   Supabase Dashboard এর SQL Editor একবারে একটি স্ক্রিপ্ট চালায়।
 *   ৭টি ফাইল হাতে হাতে কপি করলে ক্রম ভুল হওয়া, বাদ পড়া বা দুইবার চালানোর
 *   ঝুঁকি থাকে। এক ফাইলে জোড়া দিলে একবার পেস্ট করলেই পুরো ডেটাবেস তৈরি।
 *
 * ⚠️ এই ফাইলটি **জেনারেট করা** — হাতে এডিট করবেন না।
 *    আসল source হলো `supabase/migrations/*.sql`।
 *    migration বদলালে আবার চালান:  npm run db:bundle
 *
 * চালান:  node scripts/bundle-migrations.mjs
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const migrationsDir = join(root, "supabase", "migrations");
const outFile = join(root, "supabase", "RUN_ALL_IN_SQL_EDITOR.sql");

// ফাইলের নামের শুরুতে টাইমস্ট্যাম্প আছে, তাই নাম অনুযায়ী সাজালেই ক্রম ঠিক হয়
const files = readdirSync(migrationsDir)
  .filter((f) => f.toLowerCase().endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("❌ supabase/migrations/ এ কোনো .sql ফাইল নেই।");
  process.exit(1);
}

const header = `-- =============================================================================
--  ⚠️  এটা জেনারেট করা ফাইল — হাতে এডিট করবেন না
--
--  এতে ${files.length}টি migration ক্রম অনুযায়ী জোড়া দেওয়া হয়েছে।
--  পুরোটা একবারে কপি করে Supabase → SQL Editor এ পেস্ট করে Run চাপুন।
--
--  ▸ আসল source:  supabase/migrations/*.sql
--  ▸ আবার বানাতে:  npm run db:bundle
--  ▸ সব ফাইল idempotent — ভুলে আবার চালালেও ক্ষতি হবে না
--
--  তৈরি হয়েছে: ${new Date().toISOString()}
-- =============================================================================


`;

const parts = files.map((file, i) => {
  const body = readFileSync(join(migrationsDir, file), "utf8").trimEnd();
  const rule = "─".repeat(77);
  return `-- ${rule}
--  ধাপ ${i + 1}/${files.length}  ·  ${file}
-- ${rule}

${body}
`;
});

const output = header + parts.join("\n\n");

mkdirSync(dirname(outFile), { recursive: true });
// BOM ছাড়া UTF-8 — নাহলে SQL Editor প্রথম লাইনে অদ্ভুত অক্ষর দেখাতে পারে
writeFileSync(outFile, output, "utf8");

const lines = output.split("\n").length;
console.log(`✅ ${files.length}টি migration জোড়া দেওয়া হলো`);
console.log(`   → supabase/RUN_ALL_IN_SQL_EDITOR.sql  (${lines} লাইন)`);
for (const [i, f] of files.entries()) {
  console.log(`   ${String(i + 1).padStart(2)}. ${f}`);
}
