"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/lib/button-styles";

export function EditorialForm({
  action,
  children,
  submit,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
  children?: ReactNode;
  submit: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-6 space-y-4"
      action={async (formData) => {
        setPending(true);
        const result = await action(formData);
        setMessage(result.message);
        setPending(false);
        if (result.ok) router.refresh();
      }}
    >
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
      {children}
      <button className={buttonClass("primary")} type="submit" disabled={pending}>
        {pending ? "Salvando..." : submit}
      </button>
    </form>
  );
}
