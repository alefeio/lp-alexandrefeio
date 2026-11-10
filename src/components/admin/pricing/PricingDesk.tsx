"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateProductPriceAction } from "@/lib/admin/pricing-actions";
import {
  projectPricingDesk,
  type PricingCourseDesk,
  type PricingDrafts,
  type PricingTarget,
} from "@/lib/admin/pricing-core";
import { formatCentsToBrl, parseBrlToCents } from "@/lib/commerce/money";
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

function parseDraftAmount(amount: string): number | null | undefined {
  if (!amount.trim()) return undefined;
  const parsed = parseBrlToCents(amount);
  return parsed.ok ? parsed.cents : undefined;
}

function PriceEditor({
  target,
  id,
  title,
  publishedCents,
  commerceStatus,
  updatedAt,
  locked,
  lockReason,
  onDraftCents,
}: {
  target: PricingTarget;
  id: string;
  title: string;
  publishedCents: number | null;
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  updatedAt: string;
  locked?: boolean;
  lockReason?: string;
  onDraftCents: (cents: number | null | undefined) => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(draftCents(publishedCents));
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [publishChangedWhileEditing, setPublishChangedWhileEditing] = useState(false);
  const amountRef = useRef(amount);
  const syncedPublishedRef = useRef(publishedCents);
  const syncedUpdatedAtRef = useRef(updatedAt);
  const onDraftCentsRef = useRef(onDraftCents);
  onDraftCentsRef.current = onDraftCents;
  amountRef.current = amount;

  useEffect(() => {
    const publishedChanged =
      syncedPublishedRef.current !== publishedCents || syncedUpdatedAtRef.current !== updatedAt;
    if (!publishedChanged) return;

    const previousForm = draftCents(syncedPublishedRef.current);
    const nextForm = draftCents(publishedCents);
    const currentAmount = amountRef.current;
    const dirty = currentAmount.trim() !== previousForm && currentAmount.trim() !== nextForm;

    if (dirty) {
      setPublishChangedWhileEditing(true);
      setConfirm(false);
      setMessage("O preço publicado mudou em outra sessão. Revise o valor proposto antes de salvar.");
    } else {
      setAmount(nextForm);
      setConfirm(false);
      setPublishChangedWhileEditing(false);
      setMessage(null);
      onDraftCentsRef.current(undefined);
    }

    syncedPublishedRef.current = publishedCents;
    syncedUpdatedAtRef.current = updatedAt;
  }, [publishedCents, updatedAt]);

  const simulation = useMemo(() => {
    if (!amount.trim()) return null;
    const parsed = parseBrlToCents(amount);
    if (!parsed.ok) return { ok: false as const, message: parsed.message };
    return {
      ok: true as const,
      cents: parsed.cents,
      display: formatCentsToBrl(parsed.cents),
      changed: publishedCents !== parsed.cents,
    };
  }, [amount, publishedCents]);

  const needsConfirm = commerceStatus === "AVAILABLE" && simulation?.ok === true && simulation.changed;
  const canSave =
    !locked &&
    !pending &&
    simulation?.ok === true &&
    (!needsConfirm || confirm);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setPending(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      if (confirm) form.set("confirmAvailable", "1");
      const result = await updateProductPriceAction(form);
      setMessage(result.message);
      if (result.ok) {
        setConfirm(false);
        setPublishChangedWhileEditing(false);
        onDraftCents(undefined);
        syncedPublishedRef.current = simulation.ok ? simulation.cents : publishedCents;
        setAmount(simulation.ok ? draftCents(simulation.cents) : draftCents(publishedCents));
        router.refresh();
      }
    } catch {
      setMessage("Não foi possível salvar o preço. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-3 border-t border-border pt-4" onSubmit={onSubmit}>
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="updatedAt" value={updatedAt} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted">
            Publicado: {formatCentsToBrl(publishedCents)} · {saleLabel(commerceStatus)}
          </p>
        </div>
        <label className="block min-w-[10rem]">
          <span className="text-xs text-muted">Proposto (R$)</span>
          <input
            className={`${fieldClass} mt-1`}
            name="amountBrl"
            inputMode="decimal"
            autoComplete="off"
            placeholder="14,90"
            value={amount}
            disabled={locked || pending}
            onChange={(event) => {
              const next = event.target.value;
              setAmount(next);
              setConfirm(false);
              setMessage(null);
              onDraftCents(parseDraftAmount(next));
            }}
          />
        </label>
      </div>
      {locked && lockReason ? <p className="text-sm text-muted">{lockReason}</p> : null}
      {publishChangedWhileEditing ? (
        <p className="text-sm text-muted" role="status">
          Publicado atual: {formatCentsToBrl(publishedCents)}. Seu rascunho local foi preservado — confirme se ainda
          deseja salvar.
        </p>
      ) : null}
      {simulation && !simulation.ok ? <p className="text-sm text-muted">{simulation.message}</p> : null}
      {simulation?.ok ? (
        <p className="text-sm">
          Proposto: {simulation.display}
          {simulation.changed ? " · ainda não salvo" : " · igual ao publicado"}
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
            Confirmo alterar o preço de um produto AVAILABLE de {formatCentsToBrl(publishedCents)} para{" "}
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
      <button className={buttonClass("primary")} type="submit" disabled={!canSave}>
        {pending ? "Salvando..." : "Salvar preço"}
      </button>
    </form>
  );
}

export function PricingDesk({ desk }: { desk: PricingCourseDesk }) {
  const [drafts, setDrafts] = useState<PricingDrafts>({ lessons: {}, modules: {} });
  const projected = useMemo(() => projectPricingDesk(desk, drafts), [desk, drafts]);
  const hasUnsavedDraft = useMemo(() => {
    return (
      drafts.course !== undefined ||
      Object.keys(drafts.modules).length > 0 ||
      Object.keys(drafts.lessons).length > 0
    );
  }, [drafts]);

  function setLessonDraft(id: string, cents: number | null | undefined) {
    setDrafts((prev) => {
      const lessons = { ...prev.lessons };
      if (cents === undefined) delete lessons[id];
      else lessons[id] = cents;
      return { ...prev, lessons };
    });
  }

  function setModuleDraft(id: string, cents: number | null | undefined) {
    setDrafts((prev) => {
      const modules = { ...prev.modules };
      if (cents === undefined) delete modules[id];
      else modules[id] = cents;
      return { ...prev, modules };
    });
  }

  function setCourseDraft(cents: number | null | undefined) {
    setDrafts((prev) => {
      if (cents === undefined) {
        return { lessons: prev.lessons, modules: prev.modules };
      }
      return { ...prev, course: cents };
    });
  }

  return (
    <div className="mt-8 space-y-10">
      {hasUnsavedDraft ? (
        <p className="rounded-lg border border-border px-3 py-2 text-sm text-muted" role="status">
          Simulação local — valores propostos ainda não estão publicados no catálogo.
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Curso completo</h2>
            <p className="mt-1 text-sm text-muted">
              {statusLabel(desk.status)} · {saleLabel(desk.commerceStatus)} · {projected.paidLessonCount}{" "}
              aulas pagas · {projected.lessonCount} aulas no total
            </p>
          </div>
          <p className="text-sm">
            Publicado: {formatCentsToBrl(desk.bundlePriceCents)}
            {drafts.course !== undefined ? ` · proposto: ${formatCentsToBrl(projected.bundlePriceCents)}` : ""}
          </p>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Soma das aulas pagas {hasUnsavedDraft ? "(simulada)" : ""}</dt>
            <dd>{formatCentsToBrl(projected.paidLessonSumCents)}</dd>
          </div>
          <div>
            <dt className="text-muted">Soma dos módulos {hasUnsavedDraft ? "(simulada)" : ""}</dt>
            <dd>{formatCentsToBrl(projected.moduleBundleSumCents)}</dd>
          </div>
          <div>
            <dt className="text-muted">Economia vs aulas</dt>
            <dd>
              {formatCentsToBrl(projected.savingsVsLessonsCents)}
              {projected.percentOffVsLessons != null ? ` (${projected.percentOffVsLessons}%)` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Economia vs módulos</dt>
            <dd>
              {formatCentsToBrl(projected.savingsVsModulesCents)}
              {projected.percentOffVsModules != null ? ` (${projected.percentOffVsModules}%)` : ""}
            </dd>
          </div>
        </dl>
        {projected.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {projected.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <PriceEditor
          target="course"
          id={desk.id}
          title={desk.title}
          publishedCents={desk.bundlePriceCents}
          commerceStatus={desk.commerceStatus}
          updatedAt={desk.updatedAt}
          onDraftCents={setCourseDraft}
        />
      </section>

      {projected.modules.map((moduleRow, index) => {
        const publishedModule = desk.modules[index]!;
        return (
          <section key={moduleRow.id} className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{moduleRow.title}</h2>
              <p className="mt-1 text-sm text-muted">
                {statusLabel(moduleRow.status)} · {saleLabel(moduleRow.commerceStatus)} ·{" "}
                {moduleRow.paidLessonCount} aulas pagas · {moduleRow.lessonCount} aulas
              </p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted">Soma das aulas {hasUnsavedDraft ? "(simulada)" : ""}</dt>
                  <dd>{formatCentsToBrl(moduleRow.paidLessonSumCents)}</dd>
                </div>
                <div>
                  <dt className="text-muted">
                    Pacote {drafts.modules[moduleRow.id] !== undefined ? "(proposto)" : "publicado"}
                  </dt>
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
              publishedCents={publishedModule.bundlePriceCents}
              commerceStatus={moduleRow.commerceStatus}
              updatedAt={moduleRow.updatedAt}
              onDraftCents={(cents) => setModuleDraft(moduleRow.id, cents)}
            />
            <ul className="space-y-6">
              {moduleRow.lessons.map((lesson, lessonIndex) => {
                const publishedLesson = publishedModule.lessons[lessonIndex]!;
                return (
                  <li key={lesson.id}>
                    <p className="text-sm text-muted">
                      {lesson.accessType === "FREE" ? "Gratuita" : "Paga"} · {statusLabel(lesson.status)} ·{" "}
                      {saleLabel(lesson.commerceStatus)}
                    </p>
                    <PriceEditor
                      target="lesson"
                      id={lesson.id}
                      title={lesson.title}
                      publishedCents={publishedLesson.priceCents}
                      commerceStatus={lesson.commerceStatus}
                      updatedAt={lesson.updatedAt}
                      locked={lesson.accessType === "FREE"}
                      lockReason="Aulas gratuitas permanecem sem preço comercial."
                      onDraftCents={(cents) => setLessonDraft(lesson.id, cents)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
