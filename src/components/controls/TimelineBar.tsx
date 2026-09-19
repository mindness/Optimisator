import type { UseTimelineResult } from '@/hooks/useTimeline';

export type TimelineBarProps = {
  timeline: UseTimelineResult;
  className?: string;
};

export function TimelineBar({ timeline, className = '' }: TimelineBarProps) {
  const {
    steps,
    stepIndex,
    currentStep,
    playing,
    play,
    pause,
    next,
    prev,
    jump,
  } = timeline;

  const progress = steps.length <= 1 ? 1 : stepIndex / (steps.length - 1);

  return (
    <section
      className={`border-t border-border bg-surface px-3 py-2.5 md:px-4 ${className}`.trim()}
      aria-label="Timeline Replay"
      data-testid="timeline-bar"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Contrôles timeline">
          <button
            type="button"
            className="border border-border bg-canvas px-2.5 py-1 text-sm text-fg hover:border-border-strong"
            onClick={prev}
            aria-label="Étape précédente"
            disabled={stepIndex <= 0}
          >
            Préc.
          </button>
          {playing ? (
            <button
              type="button"
              className="border border-border bg-canvas px-2.5 py-1 text-sm font-medium text-fg hover:border-border-strong"
              onClick={pause}
              aria-label="Pause"
              data-testid="timeline-pause"
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              className="border border-border bg-canvas px-2.5 py-1 text-sm font-medium text-fg hover:border-border-strong"
              onClick={play}
              aria-label="Lecture"
              data-testid="timeline-play"
            >
              Play
            </button>
          )}
          <button
            type="button"
            className="border border-border bg-canvas px-2.5 py-1 text-sm text-fg hover:border-border-strong"
            onClick={next}
            aria-label="Étape suivante"
            disabled={stepIndex >= steps.length - 1}
          >
            Suiv.
          </button>
        </div>

        <p className="m-0 min-w-0 flex-1 text-sm text-fg">
          <span className="font-medium">
            Étape {stepIndex + 1}/{steps.length} — {currentStep.label}
          </span>
          <span className="mt-0.5 block text-xs text-fg-muted md:mt-0 md:ml-2 md:inline">
            {currentStep.description}
          </span>
        </p>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden border border-border bg-canvas"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={stepIndex + 1}
        aria-label="Progression timeline"
      >
        <div
          className="h-full origin-left bg-flow-vat transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <ol className="mt-2 flex list-none flex-wrap gap-1 p-0" aria-label="Saut d'étape">
        {steps.map((step, i) => {
          const active = i === stepIndex;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => jump(i)}
                aria-current={active ? 'step' : undefined}
                aria-label={`Aller à ${step.label}`}
                className={[
                  'border px-2 py-0.5 text-xs font-medium uppercase tracking-wide',
                  active
                    ? 'border-flow-vat bg-flow-vat/15 text-fg'
                    : 'border-border bg-canvas text-fg-muted hover:border-border-strong hover:text-fg',
                ].join(' ')}
              >
                {step.order}. {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
