import { JOURNEY_EMPTY, JOURNEY_SAMPLE_MIN, JOURNEY_SAMPLE_NOTE, type JourneyDashboardView } from "@/lib/admin/journey-report";
import { EmptyNote, ShareBar, maxCount } from "@/components/admin/journey/JourneyBars";

export function JourneyScenarioBreakdown({ view }: { view: JourneyDashboardView }) {
  const choiceMax = maxCount(view.courseChoices.map((row) => row.count));
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Qual problema trouxe a pessoa até o curso?</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">Home e catálogo permanecem separados. Cada número é de jornadas distintas, não de cliques brutos.</p>
      {view.scenarios.length === 0 ? <EmptyNote>{JOURNEY_EMPTY}</EmptyNote> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <caption className="sr-only">Gargalos declarados na home e no catálogo, por curso escolhido</caption>
            <thead>
              <tr className="border-b border-border text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Cenário</th>
                <th scope="col" className="px-3 py-2 font-medium">Home</th>
                <th scope="col" className="px-3 py-2 font-medium">Catálogo</th>
                <th scope="col" className="px-3 py-2 font-medium">Tráfego</th>
                <th scope="col" className="px-3 py-2 font-medium">Sites</th>
              </tr>
            </thead>
            <tbody>
              {view.scenarios.map((row) => (
                <tr key={row.id || "sem-cenario"} className="border-b border-border">
                  <th scope="row" className="py-2 pr-3 font-normal">{row.label}</th>
                  <td className="px-3 py-2 tabular-nums">{row.home}</td>
                  <td className="px-3 py-2 tabular-nums">{row.catalog}</td>
                  <td className="px-3 py-2 tabular-nums">{row.traffic}</td>
                  <td className="px-3 py-2 tabular-nums">{row.sites}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3 className="mt-6 text-base font-semibold">Escolha de curso</h3>
      {view.courseChoices.length === 0 ? <EmptyNote>{JOURNEY_EMPTY}</EmptyNote> : (
        <div className="mt-4 flex flex-col gap-3">
          {view.courseChoices.map((row) => (
            <ShareBar key={row.slug} label={row.label} count={row.count} max={choiceMax} />
          ))}
          <SampleNote counts={view.courseChoices.map((row) => row.count)} />
        </div>
      )}
    </section>
  );
}

export function JourneySources({ view }: { view: JourneyDashboardView }) {
  const sourceMax = maxCount(view.sources.map((row) => row.count));
  const campaignMax = maxCount(view.campaigns.map((row) => row.count));
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">De onde vieram as jornadas observadas?</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">Origem observada na jornada. Esses campos representam a atribuição capturada pela plataforma nos eventos consentidos. GA4 continua sendo a ferramenta principal para análise avançada de marketing.</p>
      {view.sources.length === 0 ? <EmptyNote>{JOURNEY_EMPTY}</EmptyNote> : (
        <div className="mt-4 flex flex-col gap-3">
          {view.sources.map((row) => (
            <ShareBar key={row.label} label={row.label} count={row.count} max={sourceMax} />
          ))}
          <SampleNote counts={view.sources.map((row) => row.count)} />
        </div>
      )}
      <h3 className="mt-6 text-base font-semibold">Campanhas observadas</h3>
      {view.campaigns.length === 0 ? <EmptyNote>{JOURNEY_EMPTY}</EmptyNote> : (
        <div className="mt-4 flex flex-col gap-3">
          {view.campaigns.map((row) => (
            <ShareBar key={row.label} label={row.label} count={row.count} max={campaignMax} />
          ))}
          <SampleNote counts={view.campaigns.map((row) => row.count)} />
        </div>
      )}
    </section>
  );
}

export function JourneyFreeLessons({ view }: { view: JourneyDashboardView }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Quais aulas gratuitas iniciam a jornada?</h2>
      {view.freeLessons.length === 0 ? <EmptyNote>{JOURNEY_EMPTY}</EmptyNote> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption className="sr-only">Aulas gratuitas que iniciam a jornada, com conclusões observadas do mesmo slug</caption>
            <thead>
              <tr className="border-b border-border text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Curso</th>
                <th scope="col" className="px-3 py-2 font-medium">Aula</th>
                <th scope="col" className="px-3 py-2 font-medium">Jornadas</th>
                <th scope="col" className="px-3 py-2 font-medium">Inícios</th>
                <th scope="col" className="px-3 py-2 font-medium">Concluíram</th>
              </tr>
            </thead>
            <tbody>
              {view.freeLessons.map((row) => (
                <tr key={`${row.courseLabel}-${row.lessonTitle}`} className="border-b border-border">
                  <td className="py-2 pr-3">{row.courseLabel}</td>
                  <td className="px-3 py-2">{row.lessonTitle}</td>
                  <td className="px-3 py-2 tabular-nums">{row.journeys}</td>
                  <td className="px-3 py-2 tabular-nums">{row.starts}</td>
                  <td className="px-3 py-2 tabular-nums">{row.completions}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <SampleNote counts={view.freeLessons.map((row) => row.journeys)} />
        </div>
      )}
    </section>
  );
}

export function JourneyCourseTransitions({ view }: { view: JourneyDashboardView }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Movimento entre as formações</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">Só entra o clique explícito de uma formação para a outra. Ver um curso e depois outro não conta como movimento.</p>
      {view.transitions.length === 0 ? <EmptyNote>{JOURNEY_EMPTY}</EmptyNote> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <caption className="sr-only">Movimento explícito entre as formações</caption>
            <thead>
              <tr className="border-b border-border text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">De</th>
                <th scope="col" className="px-3 py-2 font-medium">Para</th>
                <th scope="col" className="px-3 py-2 font-medium">Jornadas</th>
                <th scope="col" className="px-3 py-2 font-medium">Cliques</th>
              </tr>
            </thead>
            <tbody>
              {view.transitions.map((row) => (
                <tr key={`${row.from}-${row.to}`} className="border-b border-border">
                  <td className="py-2 pr-3">{row.from}</td>
                  <td className="px-3 py-2">{row.to}</td>
                  <td className="px-3 py-2 tabular-nums">{row.journeys}</td>
                  <td className="px-3 py-2 tabular-nums">{row.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <SampleNote counts={view.transitions.map((row) => row.journeys)} />
        </div>
      )}
    </section>
  );
}

function SampleNote({ counts }: { counts: number[] }) {
  const peak = maxCount(counts);
  if (peak === 0 || peak >= JOURNEY_SAMPLE_MIN) return null;
  return <p className="mt-3 text-sm text-muted">{JOURNEY_SAMPLE_NOTE}</p>;
}
