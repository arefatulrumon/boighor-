"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toBanglaDigits } from "@/lib/format";
import { cn } from "@/components/ui";

/**
 * ছবি আপলোডার — সোজা ব্রাউজার থেকে Supabase Storage এ যায়।
 *
 * কেন সার্ভার হয়ে নয়? ব্রাউজারের Supabase ক্লায়েন্টে অ্যাডমিনের সেশন কুকি
 * থাকে, আর Storage-এর RLS পলিসি (`book_covers_staff_insert`) যাচাই করে
 * তিনি staff কি না। তাই কোনো সার্ভার সিক্রেট লাগে না — অনেক নিরাপদ।
 *
 * দুটি কাজ নিজে থেকেই করে:
 *   ১) ছবি ছোট করে (সর্বোচ্চ ১৪০০px, WebP) — Free plan এ ১ GB স্টোরেজ,
 *      তাই বড় ছবি আপলোড করলে তাড়াতাড়ি ভরে যেত (প্রায় ৭০% বাঁচে)
 *   ২) ফাইলনাম ইউনিক করে — একই নামের ছবি আগেরটা মুছে দেবে না
 */

export const MEDIA_BUCKET = "book-covers";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // bucket এর সীমা (0005_storage.sql)
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];

/* -------------------------------------------------------------------------- */
/*  ছবি ছোট করা                                                                */
/* -------------------------------------------------------------------------- */

async function downscaleImage(
  file: File,
  maxWidth = 1400,
  quality = 0.85
): Promise<File> {
  // GIF (অ্যানিমেশন) বা ছোট ছবি — হাত দেব না, নষ্ট হয়ে যাবে
  if (file.type === "image/gif" || file.size < 120 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);

    if (bitmap.width <= maxWidth) {
      bitmap.close?.();
      return file;
    }

    const scale = maxWidth / bitmap.width;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );

    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], newName, { type: "image/webp" });
  } catch {
    // কোনো ব্রাউজারে canvas কাজ না করলে মূল ফাইলই পাঠানো হবে
    return file;
  }
}

/* -------------------------------------------------------------------------- */
/*  Storage এ আপলোড                                                            */
/* -------------------------------------------------------------------------- */

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function uploadToStorage(file: File, folder: string): Promise<string> {
  const supabase = createClient();

  const prepared = await downscaleImage(file);
  const ext = (prepared.name.split(".").pop() || "webp").toLowerCase();
  const path = `${folder}/${Date.now()}-${randomSuffix()}.${ext}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, prepared, {
      contentType: prepared.type,
      cacheControl: "31536000", // ১ বছর — ছবি বদলালে নতুন নাম হবে, তাই নিরাপদ
      upsert: false,
    });

  if (error) {
    // সবচেয়ে সাধারণ ভুলটি বাংলায় বুঝিয়ে দেওয়া
    const msg = error.message.toLowerCase();
    if (msg.includes("bucket") || msg.includes("not found")) {
      throw new Error(
        `"${MEDIA_BUCKET}" bucket পাওয়া যায়নি। supabase/migrations/20260924000005_storage.sql চালান।`
      );
    }
    if (msg.includes("policy") || msg.includes("unauthorized") || msg.includes("403")) {
      throw new Error(
        "আপলোডের অনুমতি নেই। আপনার অ্যাকাউন্ট public.staff টেবিলে আছে কি না দেখুন।"
      );
    }
    throw new Error(error.message);
  }

  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `"${file.name}" — শুধু JPG, PNG, WebP, AVIF বা GIF দেওয়া যাবে।`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" — ৫ MB এর বেশি। ছবিটা ছোট করে নিন।`;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  একটি ছবি (কভার)                                                            */
/* -------------------------------------------------------------------------- */

export function SingleImageUploader({
  name,
  defaultValue,
  folder = "draft",
  label = "কভার ছবি",
}: {
  name: string;
  defaultValue?: string | null;
  folder?: string;
  label?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;

      const problem = validateFile(file);
      if (problem) {
        setError(problem);
        return;
      }

      setBusy(true);
      setError(null);
      try {
        setUrl(await uploadToStorage(file, folder));
      } catch (e) {
        setError(e instanceof Error ? e.message : "আপলোড ব্যর্থ হয়েছে।");
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [folder]
  );

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-stone-800">{label}</span>

      {/* আসল মান এখানেই যায় — Server Action এটাই পড়বে */}
      <input type="hidden" name={name} value={url} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed p-3 transition-colors",
          dragOver ? "border-emerald-700 bg-emerald-50" : "border-stone-300 bg-stone-50"
        )}
      >
        {url ? (
          <div className="flex gap-3">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="কভার প্রিভিউ" className="h-full w-full object-cover" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
              <p className="truncate text-xs text-stone-500" title={url}>
                {url}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-stone-50 disabled:opacity-50"
                >
                  বদলান
                </button>
                <button
                  type="button"
                  onClick={() => setUrl("")}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                >
                  সরান
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center gap-1.5 py-6 text-center disabled:opacity-60"
          >
            <span className="text-2xl" aria-hidden>
              {busy ? "⏳" : "🖼️"}
            </span>
            <span className="text-sm font-medium text-stone-800">
              {busy ? "আপলোড হচ্ছে..." : "ছবি টেনে ছাড়ুন বা ক্লিক করুন"}
            </span>
            <span className="text-xs text-stone-500">
              JPG / PNG / WebP · সর্বোচ্চ ৫ MB · নিজে থেকেই ছোট হয়ে যাবে
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {/* বিকল্প: সরাসরি URL বসানো */}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-stone-500 hover:text-stone-700">
          অথবা ছবির লিংক সরাসরি বসান
        </summary>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://....supabase.co/storage/v1/object/public/book-covers/..."
          className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs focus:border-emerald-700 focus:outline-none"
        />
      </details>

      {error && (
        <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  একাধিক ছবি (গ্যালারি)                                                      */
/* -------------------------------------------------------------------------- */

export function GalleryUploader({
  name,
  defaultValue = [],
  folder = "draft",
}: {
  name: string;
  defaultValue?: string[];
  folder?: string;
}) {
  const [urls, setUrls] = useState<string[]>(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;

      const list = Array.from(files).slice(0, 8); // একবারে সর্বোচ্চ ৮টি
      const problems = list.map(validateFile).filter(Boolean);
      if (problems.length > 0) {
        setError(problems.join(" "));
        return;
      }

      setBusy(true);
      setError(null);
      try {
        // পরপর আপলোড — একসাথে ৮টি বড় ফাইল পাঠালে ধীর হয়ে যায়
        const uploaded: string[] = [];
        for (const file of list) {
          uploaded.push(await uploadToStorage(file, folder));
        }
        setUrls((prev) => [...prev, ...uploaded].slice(0, 12));
      } catch (e) {
        setError(e instanceof Error ? e.message : "আপলোড ব্যর্থ হয়েছে।");
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [folder]
  );

  function move(index: number, direction: -1 | 1) {
    setUrls((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-stone-800">
        অতিরিক্ত ছবি (ইচ্ছা হলে)
      </span>

      {/* সার্ভার অ্যাকশন এই JSON অ্যারে পড়ে */}
      <input type="hidden" name={name} value={JSON.stringify(urls)} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed px-3 py-4 text-center transition-colors",
          dragOver ? "border-emerald-700 bg-emerald-50" : "border-stone-300 bg-stone-50"
        )}
      >
        <p className="text-sm text-stone-700">
          {busy ? "আপলোড হচ্ছে..." : "আরও ছবি টেনে ছাড়ুন বা ক্লিক করুন"}
        </p>
        <p className="mt-0.5 text-xs text-stone-500">
          সর্বোচ্চ {toBanglaDigits(12)}টি · বর্তমানে {toBanglaDigits(urls.length)}টি
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {urls.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-white"
            >
              <Image
                src={url}
                alt={`গ্যালারি ছবি ${i + 1}`}
                fill
                sizes="120px"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-stone-900/70 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    move(i, -1);
                  }}
                  className="rounded px-1.5 text-xs text-white hover:bg-white/20"
                  aria-label="আগে সরান"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    move(i, 1);
                  }}
                  className="rounded px-1.5 text-xs text-white hover:bg-white/20"
                  aria-label="পরে সরান"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUrls((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                  className="rounded px-1.5 text-xs text-white hover:bg-rose-500/60"
                  aria-label="মুছুন"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}
    </div>
  );
}
