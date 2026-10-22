"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingPageRenderer } from "@/components/landing-page/LandingPageRenderer";
import { buttonClass } from "@/lib/button-styles";
import {
  PUBLICATION_ACK_COPY,
  PUBLICATION_CONFIRM_COPY,
  PUBLICATION_COURSE_COMPLETE_COPY,
  PUBLICATION_EXPERIENCE_HREF,
  PUBLICATION_FORM_LIVE_COPY,
  PUBLICATION_LIVE_COPY,
  PUBLICATION_METRICS_COPY,
  PUBLICATION_NEXT_COURSE_COPY,
  PUBLICATION_NEXT_COURSE_HREF,
  PUBLICATION_READY_COPY,
  PUBLICATION_RESTORE_COPY,
  PUBLICATION_RUNTIME_OFF_COPY,
  PUBLICATION_SERVICE_HREF,
  PUBLICATION_SLUG_LOCK_COPY,
  PUBLICATION_STALE_COPY,
  PUBLICATION_UNPUBLISHED_COPY,
  PUBLICATION_WHATSAPP_CHECK_COPY,
  publicationActionLabel,
  publicationBlockedMessage,
  publicationLessonMessage,
  publicationPageReadiness,
  publicationReadinessGroups,
  publicationReviewLabel,
  type PublicationPageView,
} from "@/lib/landing-page/publication/lesson-flow";
import { LANDING_PAGE_MEASUREMENT_LABELS } from "@/lib/landing-page/measurement/schema";

export type PublicationEditorOutcome = {
  ok: boolean;
  lessonComplete?: boolean;
  code?: string;
  message?: string;
  page?: PublicationPageView;
};

export function LandingPagePublicationEditor({
  page,
  previewOpen = false,
  onPublish,
  onRestore,
  onHide,
}: {
  page: PublicationPageView;
  previewOpen?: boolean;
  onPublish: (input: { expectedDraftRevision: number; acknowledgedWarningCodes: string[] }) => Promise<PublicationEditorOutcome>;
  onRestore?: (publicationVersion: number) => Promise<PublicationEditorOutcome>;
  onHide?: () => Promise<PublicationEditorOutcome>;
}) {
  const [current, setCurrent] = useState(page);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(previewOpen);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [pending, setPending] = useState(false);
  const [hideArmed, setHideArmed] = useState(false);
  const readiness = publicationPageReadiness(current);
  const groups = publicationReadinessGroups(readiness);
  const warningsReady = groups.warnings.every((item) => acknowledged.includes(item.code));
  const stale = groups.blockers.some((item) => item.code === "EXPERIENCE_REVIEW_STALE" || item.code === "EXPERIENCE_REVIEW_REVISION");
  const hasForm = current.document.sections.some((section) => section.enabled && section.type === "FORM");
  const action = current.document.conversion.primaryAction;
  const republish = current.activeVersion != null;

  function toggleWarning(code: string) {
    setAcknowledged((currentCodes) =>
      currentCodes.includes(code) ? currentCodes.filter((item) => item !== code) : [...currentCodes, code],
    );
  }

  async function publish() {
    setPending(true);
    setNotice(null);
    const saved = await onPublish({ expectedDraftRevision: current.draftRevision, acknowledgedWarningCodes: acknowledged });
    setPending(false);
    if (saved.page) setCurrent(saved.page);
    if (saved.lessonComplete && saved.page?.runtimeEnabled) {
      setLive(true);
      setNotice(saved.message ?? null);
      return;
    }
    setLive(false);
    setNotice(saved.message ?? publicationLessonMessage(saved.code ?? "UNKNOWN"));
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden break-words">
      <section className="space-y-2">
        <h4 className="text-base font-semibold">Sua página está pronta?</h4>
        {groups.ready ? (
          <p className="text-sm">{PUBLICATION_READY_COPY}</p>
        ) : (
          <p className="text-sm">{publicationBlockedMessage(groups.blockers.length)}</p>
        )}
        <p className="text-sm text-muted">A página está pronta ou possui pendências. Não há nota de publicação.</p>
      </section>

      <section className="space-y-3" data-publication-group="blockers">
        <h4 className="text-base font-semibold">Pendências que precisam ser corrigidas</h4>
        {groups.blockers.length === 0 ? <p className="text-sm">Nenhum ponto bloqueia a publicação.</p> : null}
        {stale ? <p className="text-sm">{PUBLICATION_STALE_COPY}</p> : null}
        <ul className="space-y-2">
          {groups.blockers.map((item) => (
            <li key={item.code} className="text-sm">
              {item.label}{" "}
              <Link className="underline underline-offset-4" href={item.href}>
                {item.code.startsWith("EXPERIENCE_REVIEW") ? "Revisar novamente" : "Corrigir nesta etapa"}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 border-t border-border pt-4" data-publication-group="warnings">
        <h4 className="text-base font-semibold">Pontos que vale revisar</h4>
        {groups.warnings.length === 0 ? <p className="text-sm">Nenhum aviso nesta página.</p> : null}
        <ul className="space-y-3">
          {groups.warnings.map((item) => (
            <li key={item.code} className="space-y-2 text-sm">
              <p>{item.label}</p>
              <Link className="underline underline-offset-4" href={item.href}>
                Ver na etapa correspondente
              </Link>
              <label className="flex min-h-11 items-start gap-2">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={acknowledged.includes(item.code)}
                  onChange={() => toggleWarning(item.code)}
                />
                <span>{PUBLICATION_ACK_COPY}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <h4 className="text-base font-semibold">Revisão final</h4>
        <p className="text-sm">A revisão final serve para revisar. A página no ar é a versão que os visitantes realmente usam.</p>
        <button className={`${buttonClass("secondary")} min-h-11`} type="button" onClick={() => setShowPreview(true)}>
          Ver revisão final
        </button>
        {showPreview ? (
          <div className="min-w-0 max-w-full overflow-x-hidden">
            <LandingPageRenderer document={current.document} mode="PREVIEW" />
          </div>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <h4 className="text-base font-semibold">Publicar</h4>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-muted">Nome da página</dt>
            <dd>{current.title}</dd>
          </div>
          <div>
            <dt className="text-muted">Endereço</dt>
            <dd className="break-all">{current.publicUrl ?? current.publicPath}</dd>
          </div>
          <div>
            <dt className="text-muted">Ação principal</dt>
            <dd>{publicationActionLabel(action)}</dd>
          </div>
          <div>
            <dt className="text-muted">Conversão principal</dt>
            <dd>
              {current.document.measurement.primaryConversionEvent
                ? LANDING_PAGE_MEASUREMENT_LABELS[current.document.measurement.primaryConversionEvent]
                : "ainda não definida"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Seções</dt>
            <dd>{current.document.sections.filter((section) => section.enabled).length}</dd>
          </div>
          <div>
            <dt className="text-muted">Revisão</dt>
            <dd>{publicationReviewLabel(current.document, current.draftRevision)}</dd>
          </div>
          <div>
            <dt className="text-muted">Avisos reconhecidos</dt>
            <dd>
              {acknowledged.length} de {groups.warnings.length}
            </dd>
          </div>
        </dl>
        {current.history.length === 0 ? <p className="text-sm">{PUBLICATION_SLUG_LOCK_COPY}</p> : null}
        {current.unpublishedChanges ? <p className="text-sm">{PUBLICATION_UNPUBLISHED_COPY}</p> : null}
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input className="mt-1" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>{PUBLICATION_CONFIRM_COPY}</span>
        </label>
        <button
          className={`${buttonClass("primary")} min-h-11`}
          type="button"
          disabled={pending || !groups.ready || !warningsReady || !confirmed}
          onClick={() => void publish()}
        >
          {republish ? "Publicar nova versão" : "Publicar minha página"}
        </button>
        {notice ? <p className="text-sm">{notice}</p> : null}
      </section>

      {live && current.runtimeEnabled && current.publicUrl ? (
        <section className="space-y-3 border-t border-border pt-4" data-publication-live="true">
          <h4 className="text-base font-semibold">{PUBLICATION_LIVE_COPY}</h4>
          <p className="break-all text-sm">{current.publicUrl}</p>
          {current.activeVersion ? <p className="text-sm">Versão publicada: {current.activeVersion}</p> : null}
          <div className="flex flex-wrap gap-2">
            <a className={`${buttonClass("primary")} min-h-11`} href={current.publicPath} target="_blank" rel="noopener noreferrer">
              Abrir minha página
            </a>
            <button
              className={`${buttonClass("secondary")} min-h-11`}
              type="button"
              onClick={() => void navigator.clipboard?.writeText(current.publicUrl ?? current.publicPath)}
            >
              Copiar endereço
            </button>
          </div>
          <p className="text-sm">{PUBLICATION_METRICS_COPY}</p>
          {action?.type === "WHATSAPP" ? <p className="text-sm">{PUBLICATION_WHATSAPP_CHECK_COPY}</p> : null}
          {hasForm ? <p className="text-sm">{PUBLICATION_FORM_LIVE_COPY}</p> : null}
          <p className="text-sm">{PUBLICATION_COURSE_COMPLETE_COPY}</p>
          <p className="text-sm">{PUBLICATION_NEXT_COURSE_COPY}</p>
          <Link className="text-sm underline underline-offset-4" href={PUBLICATION_NEXT_COURSE_HREF}>
            Conhecer o curso de tráfego pago
          </Link>
          <Link className="block text-sm text-muted underline underline-offset-4" href={PUBLICATION_SERVICE_HREF}>
            Prefere ajuda profissional?
          </Link>
        </section>
      ) : null}

      {!current.runtimeEnabled ? <p className="text-sm">{PUBLICATION_RUNTIME_OFF_COPY}</p> : null}

      {current.history.length > 0 ? (
        <section className="space-y-2 border-t border-border pt-4">
          <h4 className="text-base font-semibold">Histórico de versões</h4>
          <ul className="space-y-2 text-sm">
            {current.history.map((item) => (
              <li key={item.version} className="flex flex-wrap items-center gap-2">
                <span>Versão {item.version}</span>
                <time dateTime={item.publishedAt}>{new Date(item.publishedAt).toLocaleDateString("pt-BR")}</time>
                {item.active ? <span>Ativa</span> : null}
                {!item.active && onRestore ? (
                  <button className="underline underline-offset-4" type="button" onClick={() => void onRestore(item.version)}>
                    Restaurar esta versão
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {!current.history.some((item) => !item.active) ? null : <p className="text-sm">{PUBLICATION_RESTORE_COPY}</p>}
        </section>
      ) : null}

      {current.activeVersion && onHide ? (
        <div className="border-t border-border pt-4 text-sm">
          {hideArmed ? (
            <div className="space-y-2">
              <p>A página deixa de abrir no endereço público. O histórico permanece.</p>
              <button className="underline underline-offset-4" type="button" onClick={() => void onHide().then(() => setHideArmed(false))}>
                Confirmar que quero tirar do ar
              </button>
            </div>
          ) : (
            <button className="text-muted underline underline-offset-4" type="button" onClick={() => setHideArmed(true)}>
              Tirar do ar
            </button>
          )}
        </div>
      ) : null}

      {stale ? (
        <Link className={buttonClass("secondary")} href={PUBLICATION_EXPERIENCE_HREF}>
          Revisar novamente
        </Link>
      ) : null}
    </div>
  );
}
