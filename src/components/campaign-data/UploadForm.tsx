"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/lib/button-styles";
import { finalizeCampaignImportAction, prepareCampaignImportAction } from "@/lib/campaign-data/actions";

export function UploadForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setMessage(null);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("Escolha um arquivo CSV ou XLSX.");
      setPending(false);
      return;
    }
    const prepared = await prepareCampaignImportAction(projectId, {
      fileName: file.name,
      sizeBytes: file.size,
      sourcePlatform: String(formData.get("source") ?? ""),
      mimeType: file.type,
    });
    if (!prepared.ok) {
      setMessage(prepared.message);
      setPending(false);
      return;
    }
    try {
      const { uploadPresigned } = await import("@vercel/blob/client");
      await uploadPresigned(prepared.pathname, file, {
        access: "private",
        handleUploadUrl: "/api/campaign-data/upload",
        clientPayload: JSON.stringify({ importId: prepared.importId }),
        contentType: file.type || "application/octet-stream",
        multipart: false,
      });
    } catch {
      setMessage("Não foi possível enviar o arquivo. Tente novamente.");
      setPending(false);
      return;
    }
    const finalized = await finalizeCampaignImportAction(projectId, prepared.importId);
    setPending(false);
    if (!finalized.ok) {
      setMessage(finalized.message);
      return;
    }
    router.push(`/app/projetos/${projectId}/dados/${prepared.importId}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium">Fonte</span>
        <select name="source" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3" defaultValue="UNKNOWN">
          <option value="GOOGLE_ADS">Google Ads</option>
          <option value="META_ADS">Meta Ads</option>
          <option value="UNKNOWN">Não sei / Outro</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium">Arquivo</span>
        <input name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="mt-1 block w-full text-sm" required />
      </label>
      <button className={buttonClass("primary")} type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar arquivo"}
      </button>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
