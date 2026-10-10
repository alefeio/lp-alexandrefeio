"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTIONS } from "@/lib/diagnostic/definition";
import { optionLabel, type DiagnosticAnswers } from "@/lib/diagnostic/score";
import { completeDiagnosticAction, saveDiagnosticAction } from "@/lib/diagnostic/actions";
import { buttonClass } from "@/lib/button-styles";
import { DiagnosticBeacon } from "@/components/diagnostic/DiagnosticBeacon";

const choiceClass =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 text-base leading-snug has-[:focus-visible]:border-cta";

export function DiagnosticWizard({
  projectId,
  diagnosticId,
  initialAnswers,
  initialStep,
}: {
  projectId: string;
  diagnosticId: string;
  initialAnswers: DiagnosticAnswers;
  initialStep: number;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<DiagnosticAnswers>(initialAnswers);
  const [step, setStep] = useState(Math.min(initialStep, QUESTIONS.length));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const reviewing = step >= QUESTIONS.length;
  const question = QUESTIONS[step];
  const answered = QUESTIONS.filter((item) => answers[item.id as keyof DiagnosticAnswers]).length;

  async function persist(nextStep: number, nextAnswers: DiagnosticAnswers) {
    setPending(true);
    setError(null);
    try {
      const result = await saveDiagnosticAction(projectId, diagnosticId, nextAnswers, nextStep);
      if (!result.ok) {
        setError(result.message);
        return false;
      }
      setAnswers(nextAnswers);
      setStep(nextStep);
      return true;
    } catch {
      setError("Não foi possível salvar agora. Tente de novo.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function advance() {
    if (!question) return;
    const selected = answers[question.id as keyof DiagnosticAnswers];
    if (!selected) {
      setError("Escolha uma resposta para continuar.");
      return;
    }
    await persist(step + 1, answers);
  }

  async function conclude() {
    setPending(true);
    setError(null);
    try {
      const saved = await saveDiagnosticAction(projectId, diagnosticId, answers, QUESTIONS.length);
      if (!saved.ok) {
        setError(saved.message);
        return;
      }
      const result = await completeDiagnosticAction(projectId, diagnosticId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/app/projetos/${projectId}/diagnosticos/${result.diagnosticId}`);
    } catch {
      setError("Não foi possível concluir agora. Tente de novo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <DiagnosticBeacon diagnosticId={diagnosticId} event="diagnostic_started" />
      <p className="text-sm text-muted" aria-live="polite">
        {reviewing ? "Revisão das respostas" : `${Math.min(step + 1, QUESTIONS.length)} de ${QUESTIONS.length} perguntas`}
        {" · "}
        {answered} respondidas
      </p>
      {reviewing ? (
        <div className="mt-6">
          <h2 className="text-xl font-semibold tracking-tight">Revise antes de concluir</h2>
          <dl className="mt-4 space-y-4">
            {QUESTIONS.map((item) => (
              <div key={item.id}>
                <dt className="text-sm text-muted">{item.prompt}</dt>
                <dd className="mt-1 font-medium">{optionLabel(item.id, answers[item.id as keyof DiagnosticAnswers] as string | undefined)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : question ? (
        <fieldset className="mt-6">
          <legend className="text-xl font-semibold tracking-tight">{question.prompt}</legend>
          <div className="mt-4 space-y-2" role="radiogroup" aria-describedby={error ? "diagnostic-error" : undefined}>
            {question.options.map((option) => {
              const selected = answers[question.id as keyof DiagnosticAnswers] === option.id;
              return (
                <label key={option.id} className={choiceClass}>
                  <input
                    type="radio"
                    name={question.id}
                    value={option.id}
                    checked={selected}
                    onChange={() => {
                      setError(null);
                      const next = { ...answers, [question.id]: option.id };
                      setAnswers(next);
                      void saveDiagnosticAction(projectId, diagnosticId, next, step);
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
          {question.note ? (
            <div className="mt-4">
              <label htmlFor={question.note.key} className="text-sm font-medium">
                {question.note.label}
              </label>
              <textarea
                id={question.note.key}
                maxLength={280}
                rows={3}
                value={answers.q5Note ?? ""}
                onChange={(event) => setAnswers({ ...answers, q5Note: event.target.value })}
                className="mt-2 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-3 text-base"
              />
            </div>
          ) : null}
        </fieldset>
      ) : null}
      {error ? (
        <p id="diagnostic-error" role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          className={buttonClass("secondary", "w-full sm:w-auto")}
          disabled={pending || step === 0}
          onClick={() => void persist(Math.max(step - 1, 0), answers)}
        >
          Anterior
        </button>
        {reviewing ? (
          <button type="button" className={buttonClass("primary", "w-full sm:w-auto")} disabled={pending} onClick={() => void conclude()}>
            Concluir diagnóstico
          </button>
        ) : (
          <button type="button" className={buttonClass("primary", "w-full sm:w-auto")} disabled={pending} onClick={() => void advance()}>
            Avançar
          </button>
        )}
      </div>
    </div>
  );
}
