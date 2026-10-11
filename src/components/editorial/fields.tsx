import type { ReactNode } from "react";

export const fieldClass = "mt-2 min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function AssetOptions({ assets, currentPublicId }: { assets: { id: string; publicId: string; alt: string }[]; currentPublicId: string | null }) {
  const selected = assets.find((asset) => asset.publicId === currentPublicId)?.id ?? "none";
  return (
    <select className={fieldClass} name="coverAssetId" defaultValue={selected}>
      <option value="none">Sem imagem</option>
      {assets.map((asset) => (
        <option key={asset.id} value={asset.id}>
          {asset.alt || asset.publicId}
        </option>
      ))}
    </select>
  );
}
