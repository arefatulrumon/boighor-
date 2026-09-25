"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CART_STORAGE_KEY, MAX_CART_LINES, MAX_QTY_PER_LINE } from "./constants";

/**
 * কার্ট কোথায় থাকে?
 *   → ব্রাউজারের localStorage এ। কোনো "carts" টেবিল নেই।
 *
 * কেন?
 *   গেস্ট চেকআউট (লগইন ছাড়াই অর্ডার) — এটাই বাংলাদেশে স্বাভাবিক।
 *   কার্ট ডেটাবেসে রাখলে প্রতিটি ভিজিটরকে একটা auth সেশন দিতে হতো,
 *   যা অপ্রয়োজনীয় জটিলতা।
 *
 * ⚠️ নিরাপত্তার নিয়ম: localStorage এর দাম কখনোই বিশ্বাস করা হয় না।
 *    অর্ডার তৈরির সময় `create_order()` RPC ডেটাবেস থেকে দাম পড়ে এবং
 *    নিজেই সব হিসাব করে। এখানে দাম শুধু দেখানোর জন্য।
 */

export interface CartLine {
  book_id: string;
  slug: string;
  title: string;
  author: string | null;
  cover: string | null;
  price: number;
  stock_qty: number;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  /** localStorage পড়া শেষ হয়েছে কি না — হাইড্রেশন মিসম্যাচ এড়াতে দরকার */
  ready: boolean;
  itemCount: number;
  subtotal: number;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (bookId: string, quantity: number) => void;
  remove: (bookId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function clampQty(qty: number, stockQty: number): number {
  const maxByStock = stockQty > 0 ? stockQty : 0;
  return Math.max(1, Math.min(qty, MAX_QTY_PER_LINE, maxByStock || 1));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  // ---- প্রথম লোডে localStorage থেকে পড়া ----
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setLines(
            parsed
              .filter(
                (l): l is CartLine =>
                  !!l && typeof l.book_id === "string" && typeof l.quantity === "number"
              )
              .map((l) => ({ ...l, quantity: Math.max(1, Math.floor(l.quantity)) }))
          );
        }
      }
    } catch {
      // করাপ্ট ডেটা থাকলে চুপচাপ খালি কার্ট দিয়ে শুরু — ক্র্যাশ করা যাবে না।
    }
    setReady(true);
  }, []);

  // ---- প্রতিবার বদলালে সেভ ----
  useEffect(() => {
    if (!ready) return; // যেন খালি কার্ট দিয়ে আসল কার্ট মুছে না যায়
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // স্টোরেজ ভরা / প্রাইভেট মোড — উপেক্ষা করা ঠিক আছে
    }
  }, [lines, ready]);

  // ---- অন্য ট্যাবে বদলালে সিঙ্ক ----
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== CART_STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) setLines(parsed);
      } catch {
        /* উপেক্ষা */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback<CartContextValue["add"]>((line, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.book_id === line.book_id);
      if (existing) {
        return prev.map((l) =>
          l.book_id === line.book_id
            ? { ...l, ...line, quantity: clampQty(l.quantity + quantity, line.stock_qty) }
            : l
        );
      }
      if (prev.length >= MAX_CART_LINES) return prev;
      return [...prev, { ...line, quantity: clampQty(quantity, line.stock_qty) }];
    });
  }, []);

  const setQuantity = useCallback<CartContextValue["setQuantity"]>((bookId, quantity) => {
    setLines((prev) =>
      prev.map((l) =>
        l.book_id === bookId ? { ...l, quantity: clampQty(quantity, l.stock_qty) } : l
      )
    );
  }, []);

  const remove = useCallback<CartContextValue["remove"]>((bookId) => {
    setLines((prev) => prev.filter((l) => l.book_id !== bookId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
    const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
    return { lines, ready, itemCount, subtotal, add, setQuantity, remove, clear };
  }, [lines, ready, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart() শুধু <CartProvider> এর ভেতরে ব্যবহার করা যাবে।");
  }
  return ctx;
}
