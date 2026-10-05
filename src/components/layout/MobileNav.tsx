"use client";

import { useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { navigation } from "@/data/navigation";
import { siteConfig } from "@/data/site-config";
import { ContactLink } from "@/components/ui/ContactLink";
import { Wordmark } from "@/components/ui/Wordmark";

export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  function openMenu() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    setOpen(true);
  }

  function closeMenu() {
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border lg:hidden"
        aria-expanded={open}
        aria-controls="menu-mobile"
        onClick={openMenu}
      >
        <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
        <span className="sr-only">Abrir menu</span>
      </button>

      <dialog
        ref={dialogRef}
        id="menu-mobile"
        className="nav-dialog"
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
      >
        <div className="flex h-full flex-col px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <p id={titleId} className="min-w-0 text-base text-foreground">
              <Wordmark />
            </p>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-lg border border-border"
              onClick={closeMenu}
            >
              <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">Fechar menu</span>
            </button>
          </div>

          <nav className="mt-10" aria-label="Mobile">
            <ul className="flex flex-col">
              {navigation.map((item) => (
                <li key={item.href} className="border-b border-border">
                  <a
                    href={item.href}
                    className="flex min-h-14 items-center text-2xl font-semibold tracking-tight"
                    onClick={closeMenu}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto pt-10">
            <ContactLink location="mobile_menu" className="w-full" onClick={closeMenu}>
              {siteConfig.ctas.primary}
            </ContactLink>
          </div>
        </div>
      </dialog>
    </>
  );
}
