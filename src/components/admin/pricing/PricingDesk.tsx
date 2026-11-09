"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateProductPriceAction } from "@/lib/admin/pricing-actions";
import type { PricingCourseDesk, PricingTarget } from "@/lib/admin/pricing";
import { formatCentsToBrl, parseBrlToCents, percentOff, savingsCents } from "@/lib/commerce/money";
import { buttonClass } from "@/lib/button-styles";
import { fieldClass } from "@/components/editorial/fields";

function statusLabel(status: "DRAFT" | "PUBLISHED") {
  return status === "PUBLISHED" ? "Publicado" : "Rascunho";
}

function saleLabel(status: "NOT_FOR_SALE" | "AVAILABLE") {
  return status === "AVAILABLE" ? "À venda" : "Fora de venda";
}

function draftCents(value: number | null): string {
  if (value == null) return "";
  const whole = Math.floor(value / 100);
  const fraction = String(value % 100).padStart(2, "0");
  return `${whole},${fraction}`;
}

function PriceEditor({
  target,
  id,
  title,
  currentCents,
  commerceStatus,
  updatedAt,
  locked,
  lockReason,
}: {
  target: PricingTarget;
  id: string;
  title: string;
  currentCents: number | null;
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  updatedAt: string;
  locked?: boolean;
  lockReason?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(draftCents(currentCents));
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const simulation = useMemo(() => {
    if (!amount.trim()) return null;
    const parsed = parseBrlToCents(amount);
    if (!parsed.ok) return { ok: false as const, message: parsed.message };
    return {
      ok: true as const,
      cents: parsed.cents,
      display: formatCentsToBrl(parsed.cents),
      changed: currentCents !== parsed.cents,
    };
  }, [amount, currentCents]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    if (confirm) form.set("confirmAvailable", "1");
    const result = await updateProductPriceAction(form);
    setMessage(result.message);
    setPending(false);
    if (result.ok) {
      setConfirm(false);
      router.refresh();
    }
  }

  const needsConfirm = commerceStatus === "AVAILABLE" && simulation?.ok === true && simulation.changed;

  return (
    <form className="space-y-3 border-t border-border pt-4" onSubmit={onSubmit}>
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="updatedAt" value={updatedAt} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted">
            Atual: {formatCentsToBrl(currentCents)} · {saleLabel(commerceStatus)}
          </p>
        </div>
        <label className="block min-w-[10rem]">
          <span className="text-xs text-muted">Novo valor (R$)</span>
          <input
            className={`${fieldClass} mt-1`}
            name="amountBrl"
            inputMode="decimal"
            autoComplete="off"
            placeholder="14,90"
            value={amount}
            disabled={locked || pending}
            onChange={(event) => {
              setAmount(event.target.value);
              setConfirm(false);
            }}
          />
        </label>
      </div>
      {locked && lockReason ? <p className="text-sm text-muted">{lockReason}</p> : null}
      {simulation && !simulation.ok ? <p className="text-sm text-muted">{simulation.message}</p> : null}
      {simulation?.ok ? (
        <p className="text-sm">
          Simulação: {simulation.display}
          {simulation.changed ? " (diferente do atual)" : " (sem alteração)"}
        </p>
      ) : null}
      {needsConfirm ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={confirm}
            onChange={(event) => setConfirm(event.target.checked)}
          />
          <span>
            Confirmo alterar o preço de um produto AVAILABLE de {formatCentsToBrl(currentCents)} para{" "}
            {simulation.ok ? simulation.display : "—"}. Novas cotações usarão o novo preço; pedidos já
            criados preservam o snapshot. Status de venda não muda.
          </span>
        </label>
      ) : null}
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
      <button className={buttonClass("primary")} type="submit" disabled={locked || pending}>
        {pending ? "Salvando..." : "Salvar preço"}
      </button>
    </form>
  );
}

export function PricingDesk({ desk }: { desk: PricingCourseDesk }) {
  return (
    <div className="mt-8 space-y-10">
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Curso completo</h2>
            <p className="mt-1 text-sm text-muted">
              {statusLabel(desk.status)} · {saleLabel(desk.commerceStatus)} · {desk.paidLessonCount} aulas
              pagas · {desk.lessonCount} aulas no total
            </p>
          </div>
          <p className="text-sm">Pacote: {formatCentsToBrl(desk.bundlePriceCents)}</p>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Soma das aulas pagas</dt>
            <dd>{formatCentsToBrl(desk.paidLessonSumCents)}</dd>
          </div>
          <div>
            <dt className="text-muted">Soma dos módulos</dt>
            <dd>{formatCentsToBrl(desk.moduleBundleSumCents)}</dd>
          </div>
          <div>
            <dt className="text-muted">Economia vs aulas</dt>
            <dd>
              {formatCentsToBrl(desk.savingsVsLessonsCents)}
              {desk.percentOffVsLessons != null ? ` (${desk.percentOffVsLessons}%)` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Economia vs módulos</dt>
            <dd>
              {formatCentsToBrl(desk.savingsVsModulesCents)}
              {desk.percentOffVsModules != null ? ` (${desk.percentOffVsModules}%)` : ""}
            </dd>
          </div>
        </dl>
        {desk.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {desk.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <PriceEditor
          target="course"
          id={desk.id}
          title={desk.title}
          currentCents={desk.bundlePriceCents}
          commerceStatus={desk.commerceStatus}
          updatedAt={desk.updatedAt}
        />
      </section>

      {desk.modules.map((moduleRow) => (
        <section key={moduleRow.id} className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{moduleRow.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {statusLabel(moduleRow.status)} · {saleLabel(moduleRow.commerceStatus)} ·{" "}
              {moduleRow.paidLessonCount} aulas pagas · {moduleRow.lessonCount} aulas
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted">Soma das aulas</dt>
                <dd>{formatCentsToBrl(moduleRow.paidLessonSumCents)}</dd>
              </div>
              <div>
                <dt className="text-muted">Pacote</dt>
                <dd>{formatCentsToBrl(moduleRow.bundlePriceCents)}</dd>
              </div>
              <div>
                <dt className="text-muted">Economia</dt>
                <dd>
                  {formatCentsToBrl(moduleRow.savingsCents)}
                  {moduleRow.percentOff != null ? ` (${moduleRow.percentOff}%)` : ""}
                </dd>
              </div>
            </dl>
            {moduleRow.warnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {moduleRow.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <PriceEditor
            target="module"
            id={moduleRow.id}
            title={`Módulo · ${moduleRow.title}`}
            currentCents={moduleRow.bundlePriceCents}
            commerceStatus={moduleRow.commerceStatus}
            updatedAt={moduleRow.updatedAt}
          />
          <ul className="space-y-6">
            {moduleRow.lessons.map((lesson) => (
              <li key={lesson.id}>
                <p className="text-sm text-muted">
                  {lesson.accessType === "FREE" ? "Gratuita" : "Paga"} · {statusLabel(lesson.status)} ·{" "}
                  {saleLabel(lesson.commerceStatus)}
                </p>
                <PriceEditor
                  target="lesson"
                  id={lesson.id}
                  title={lesson.title}
                  currentCents={lesson.priceCents}
                  commerceStatus={lesson.commerceStatus}
                  updatedAt={lesson.updatedAt}
                  locked={lesson.accessType === "FREE"}
                  lockReason="Aulas gratuitas permanecem sem preço comercial."
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <LiveCoherenceHint desk={desk} />
    </div>
  );
}

/** Ajuda a explicar percentuais recalculados no cliente sem persistir. */
function LiveCoherenceHint({ desk }: { desk: PricingCourseDesk }) {
  if (desk.bundlePriceCents == null || desk.paidLessonSumCents <= 0) return null;
  const save = savingsCents(desk.paidLessonSumCents, desk.bundlePriceCents);
  const pct = percentOff(desk.paidLessonSumCents, desk.bundlePriceCents);
  return (
    <p className="text-xs text-muted">
      Referência do curso: economia de {formatCentsToBrl(save)}
      {pct != null ? ` (${pct}%)` : ""} frente às aulas pagas. A estratégia comercial definitiva fica para a
      COM-3.
    </p>
  );
}
