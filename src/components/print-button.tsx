"use client";

import { Button } from "./ui";

/**
 * প্রিন্ট বাটন — ক্লায়েন্ট কম্পোনেন্ট দরকার কারণ window.print() ব্রাউজারে চলে।
 * ইনভয়েস প্রিন্টে হেডার/ফুটার লুকাতে globals.css এ `.no-print` ক্লাস আছে।
 */
export function PrintButton({ label = "প্রিন্ট করুন" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      🖨️ {label}
    </Button>
  );
}
