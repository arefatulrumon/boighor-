import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * টেস্ট কনফিগারেশন।
 *
 * এখানে শুধু **বিশুদ্ধ ফাংশন** টেস্ট করা হয় (ফরম্যাটিং, ভ্যালিডেশন, CSV,
 * স্টেটাস ম্যাপিং) — কোনো React কম্পোনেন্ট বা ডেটাবেস নয়। তাই jsdom বা
 * ব্রাউজার এনভায়রনমেন্ট লাগে না, আর টেস্ট চলে সেকেন্ডে।
 *
 * ডেটাবেসের ব্যবসার নিয়ম (স্টক লক, কুপন হিসাব) টেস্ট করতে হলে আসল
 * Supabase প্রজেক্ট লাগবে — ROADMAP.md এ লেখা আছে।
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
