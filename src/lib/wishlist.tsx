"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * ইচ্ছেতালিকা (Wishlist) — কার্টের মতোই সম্পূর্ণ ব্রাউজারে।
 *
 * কেন ডেটাবেসে নয়?
 *   ক্রেতার কোনো অ্যাকাউন্ট নেই (গেস্ট চেকআউট — দেখুন DECISIONS.md ADR-005)।
 *   অ্যাকাউন্ট ছাড়া কোথায় রাখব? localStorage-ই সঠিক জায়গা।
 *   ফলে ক্রেতা লগইন ছাড়াই "পরে কিনব" তালিকা রাখতে পারে।
 *
 * এখানে শুধু book_id রাখা হয় — বইয়ের তথ্য সার্ভার থেকে আনা হয়।
 * কারণ Wishlist অনেক দিন থাকতে পারে, ততদিনে দাম/নাম বদলাতে পারে।
 */

const STORAGE_KEY = "boighor.wishlist.v1";
const MAX_ITEMS = 100;

interface WishlistContextValue {
  ids: string[];
  ready: boolean;
  count: number;
  has: (bookId: string) => boolean;
  toggle: (bookId: string) => void;
  remove: (bookId: string) => void;
  clear: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

function readStored(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string").slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIds(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* স্টোরেজ ভরা — উপেক্ষা */
    }
  }, [ids, ready]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      setIds(readStored());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const has = useCallback((bookId: string) => ids.includes(bookId), [ids]);

  const toggle = useCallback((bookId: string) => {
    setIds((prev) =>
      prev.includes(bookId)
        ? prev.filter((id) => id !== bookId)
        : prev.length >= MAX_ITEMS
          ? prev
          : [bookId, ...prev]
    );
  }, []);

  const remove = useCallback((bookId: string) => {
    setIds((prev) => prev.filter((id) => id !== bookId));
  }, []);

  const clear = useCallback(() => setIds([]), []);

  const value = useMemo<WishlistContextValue>(
    () => ({ ids, ready, count: ids.length, has, toggle, remove, clear }),
    [ids, ready, has, toggle, remove, clear]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error("useWishlist() শুধু <WishlistProvider> এর ভেতরে ব্যবহার করা যাবে।");
  }
  return ctx;
}
