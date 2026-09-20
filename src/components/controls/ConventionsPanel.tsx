import { getLegalNote } from '@/core/legal/legalNotes';
import { conventionFlowExists, listConventionMatches, type ConditionStatus, type ConventionMatch } from '@/core/legal/conventions';
import type { ScenarioState } from '@/core/types';

const STATUS: Record<ConditionStatus, { glyph: string; label: string; tone: string }> = {
  met: { glyph: '✓', label: 'condition remplie sur le schéma', tone: 'text-flow-cash' },
  unmet: { glyph: '✗', label: 'condition non remplie sur le schéma', tone: 'text-flow-alert' },
  unknown: { glyph: '?', label: 'à vérifier hors schéma', tone: 'text-fg-muted' },
};

type Handlers = { onAddFlow?: (match: ConventionMatch) => void; onChange?: (scenario: ScenarioState) => void };

function Match({ match, scenario, onAddFlow, onChange }: { match: ConventionMatch; scenario: ScenarioState } & Handlers) {
  const note = getLegalNote(match.convention.legalNoteId);
  const exists = conventionFlowExists(scenario, match);
  const integration = match.convention.id === 'integration-fiscale';
  return (
    <details className="disclosure border border-border" data-testid={`convention-${match.convention.id}`}>
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-2 text-sm">
        <span className="truncate font-semibold">{match.convention.title}</span>
        <span className="shrink-0 text-xs text-fg-muted">
          {match.conditions.filter((c) => c.status === 'met').length}/{match.conditions.length} ✓
        </span>
      </summary>
      <div className="space-y-2 border-t border-border p-2 text-sm">
        <p className="m-0 text-xs text-fg-muted">{match.convention.parties} — ici : {match.from.label} → {match.to.label}.</p>
        <h5 className="m-0 text-xs font-semibold uppercase tracking-wide text-fg-muted">Dans quel cas</h5>
        <ul className="m-0 list-none space-y-1 p-0">
          {match.conditions.map((condition) => (
            <li key={condition.label} className="flex gap-2">
              <span className={`font-amount shrink-0 ${STATUS[condition.status].tone}`} role="img" aria-label={STATUS[condition.status].label}>
                {STATUS[condition.status].glyph}
              </span>
              <span>{condition.label}</span>
            </li>
          ))}
        </ul>
        <h5 className="m-0 text-xs font-semibold uppercase tracking-wide text-fg-muted">Ce que ça apporte</h5>
        <ul className="m-0 list-disc space-y-1 pl-4">{match.convention.brings.map((item) => <li key={item}>{item}</li>)}</ul>
        <h5 className="m-0 text-xs font-semibold uppercase tracking-wide text-fg-muted">Points d’attention</h5>
        <ul className="m-0 list-disc space-y-1 pl-4">{match.convention.risks.map((item) => <li key={item}>{item}</li>)}</ul>
        {note && (
          <p className="m-0 text-xs text-fg-muted">
            Sources : {note.articles.map((article, index) => (
              <span key={article.ref}>
                {index > 0 && ' · '}
                {article.url ? <a href={article.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{article.ref}</a> : article.ref}
              </span>
            ))}
          </p>
        )}
        {integration && onChange && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={scenario.options?.integrationFiscale ?? false}
              onChange={(event) => onChange({ ...scenario, options: { ...scenario.options, integrationFiscale: event.target.checked } })} />
            Simuler l’intégration fiscale (IS unique, QPFC 1 %)
          </label>
        )}
        {match.flow && onAddFlow && (
          <button type="button" disabled={exists}
            className="min-h-11 border border-border bg-canvas px-3 text-sm text-fg hover:border-border-strong disabled:opacity-40"
            onClick={() => onAddFlow(match)}>
            {exists ? 'Flux déjà sur le schéma' : `Ajouter le flux « ${match.flow.label} »`}
          </button>
        )}
      </div>
    </details>
  );
}

/**
 * Conventions envisageables entre les parties du schéma : conditions lues sur
 * les détentions saisies, apports et risques, articles sourcés.
 */
export function ConventionsPanel({ scenario, onAddFlow, onChange }: { scenario: ScenarioState } & Handlers) {
  const matches = listConventionMatches(scenario);
  if (matches.length === 0) {
    return <p className="m-0 text-sm text-fg-muted">Ajoutez au moins deux parties (sociétés, dirigeant) pour voir les conventions possibles entre elles.</p>;
  }
  const pairs = new Map<string, ConventionMatch[]>();
  for (const match of matches) {
    const key = [match.from.id, match.to.id].sort().join(':');
    pairs.set(key, [...(pairs.get(key) ?? []), match]);
  }
  return (
    <div className="space-y-3" data-testid="conventions-panel">
      <p className="m-0 text-xs text-fg-muted">
        ✓ lu sur les détentions du schéma · ✗ non rempli · ? à vérifier avec un conseil. Une convention n’est jamais validée par le simulateur.
      </p>
      {[...pairs.entries()].map(([key, list]) => (
        <section key={key} aria-label={`Conventions ${list[0]!.from.label} / ${list[0]!.to.label}`} className="space-y-2">
          <h4 className="m-0 text-sm font-semibold">{list[0]!.from.label} ↔ {list[0]!.to.label}</h4>
          {list.map((match) => <Match key={`${match.convention.id}:${match.from.id}:${match.to.id}`} match={match} scenario={scenario} onAddFlow={onAddFlow} onChange={onChange} />)}
        </section>
      ))}
    </div>
  );
}
