import {
  collectAlerts,
  resolveLegalNotesForFlow,
  type LegalAlert,
  type LegalArticle,
  type LegalNote,
} from '@/core/legal/legalNotes';
import type { FlowEdgeData, SourcedRateStatus } from '@/core/types';

const STATUS_LABEL: Record<SourcedRateStatus, string> = {
  verified: 'vérifié',
  assumed: 'hypothèse',
  placeholder: 'placeholder',
};

function AlertBadge({ alert }: { alert: LegalAlert }) {
  const tone =
    alert.severity === 'danger'
      ? 'bg-negative-soft text-negative'
      : alert.severity === 'warning'
        ? 'bg-disclaimer-bg text-disclaimer-fg'
        : 'bg-surface-sunken text-fg-muted';

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}
      data-testid={`alert-badge-${alert.code}`}
      title={alert.detail}
    >
      {alert.label}
    </span>
  );
}

function ArticleBlock({ article }: { article: LegalArticle }) {
  return (
    <article className="rounded-md bg-surface-sunken px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="m-0 text-sm font-semibold text-fg">{article.ref}</h4>
        <span className="text-xs text-fg-muted">
          {STATUS_LABEL[article.status]} · {article.asOf}
        </span>
      </div>
      <p className="m-0 mt-1 text-xs leading-relaxed text-fg-muted">
        {article.summary}
      </p>
      {article.url ? (
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block text-xs font-medium text-accent hover:underline"
        >
          Légifrance
        </a>
      ) : null}
    </article>
  );
}

function NoteBlock({ note }: { note: LegalNote }) {
  return (
    <div className="flex flex-col gap-2" data-legal-note={note.id}>
      <div>
        <h3 className="m-0 text-sm font-semibold text-fg">{note.title}</h3>
        <p className="m-0 mt-1 text-xs leading-relaxed text-fg-muted">
          {note.summary}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {note.articles.map((article) => (
          <ArticleBlock key={article.ref} article={article} />
        ))}
      </div>
    </div>
  );
}

export type LegalReferenceProps = {
  flow: FlowEdgeData;
  className?: string;
};

export function LegalReference({ flow, className = '' }: LegalReferenceProps) {
  const notes = resolveLegalNotesForFlow(flow);
  const alerts = collectAlerts(notes);

  return (
    <section
      className={`flex flex-col gap-3 ${className}`.trim()}
      data-testid="legal-reference"
      aria-label="Références légales"
    >
      <h3 className="panel-title">Références légales</h3>

      {alerts.length > 0 ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="status"
          aria-label="Alertes de conformité"
        >
          {alerts.map((alert) => (
            <AlertBadge key={alert.code} alert={alert} />
          ))}
        </div>
      ) : null}

      {notes.length === 0 ? (
        <p className="m-0 text-xs text-fg-muted">
          Aucune note légale catalogue pour ce flux.
        </p>
      ) : (
        notes.map((note) => <NoteBlock key={note.id} note={note} />)
      )}
    </section>
  );
}
