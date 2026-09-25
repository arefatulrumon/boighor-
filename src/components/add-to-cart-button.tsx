"use client";

import { useState } from "react";
import { useCart, type CartLine } from "@/lib/cart";
import { Button } from "./ui";
import { cn } from "./ui";

interface Props {
  book: Omit<CartLine, "quantity">;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

/**
 * "কার্টে যোগ করুন" বাটন।
 * stock_qty <= 0 হলে নিষ্ক্রিয় থাকে — ফলে স্টক শেষ বই অর্ডার করা যায় না
 * (ডেটাবেস ফাংশনও আবার যাচাই করে, তাই ডাবল সুরক্ষা)।
 */
export function AddToCartButton({ book, className, size = "md", fullWidth }: Props) {
  const { add } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const outOfStock = book.stock_qty <= 0;

  function handleClick() {
    if (outOfStock) return;
    add(book, 1);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1600);
  }

  return (
    <Button
      type="button"
      size={size}
      variant={justAdded ? "secondary" : "primary"}
      disabled={outOfStock}
      onClick={handleClick}
      className={cn(fullWidth && "w-full", className)}
      aria-live="polite"
    >
      {outOfStock ? "স্টক নেই" : justAdded ? "✓ কার্টে যোগ হয়েছে" : "কার্টে যোগ করুন"}
    </Button>
  );
}
