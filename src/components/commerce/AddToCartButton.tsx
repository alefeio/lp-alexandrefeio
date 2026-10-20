"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CART_STORAGE_KEY, readStoredCart, writeStoredCart, type StoredCartLine } from "@/lib/commerce/cart";
import { mergeCartLine, type CartProductCover } from "@/lib/commerce/cart-normalize";
import { buttonClass } from "@/lib/button-styles";

export function AddToCartButton({
  id,
  type,
  label,
  lessonIds = [],
}: {
  id: string;
  type: StoredCartLine["type"];
  label: string;
  /** Aulas cobertas pelo produto — usadas para normalizar o carrinho no cliente. */
  lessonIds?: string[];
}) {
  const router = useRouter();
  const [added, setAdded] = useState(false);

  function add() {
    const current = readStoredCart(window.localStorage.getItem(CART_STORAGE_KEY));
    const cover: CartProductCover = { type, id, lessonIds };
    const next = mergeCartLine(current, cover);
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
