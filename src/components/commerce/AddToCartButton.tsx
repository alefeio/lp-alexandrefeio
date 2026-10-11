"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CART_STORAGE_KEY, readStoredCart, writeStoredCart, type StoredCartLine } from "@/lib/commerce/cart";
import { buttonClass } from "@/lib/button-styles";

export function AddToCartButton({ id, type, label }: { id: string; type: StoredCartLine["type"]; label: string }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  function add() {
    const current = readStoredCart(window.localStorage.getItem(CART_STORAGE_KEY));
    const next = current.some((line) => line.type === type && line.id === id) ? current : [...current, { type, id }];
    writeStoredCart(next);
    setAdded(true);
    router.push("/app/carrinho");
  }
  return (
    <button className={`${buttonClass("primary")} mt-6`} type="button" onClick={add}>
      {added ? "No carrinho" : label}
    </button>
  );
}
