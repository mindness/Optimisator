import type { UseTimelineResult } from '@/hooks/useTimeline';

export type TimelineBarProps = {
  timeline: UseTimelineResult;
  className?: string;
};

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

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
      className={`card flex flex-col gap-2.5 px-3 py-2.5 md:px-4 ${className}`.trim()}
      aria-label="Timeline Replay"
      data-testid="timeline-bar"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1" role="group" aria-label="Contrôles timeline">
          <button
            type="button"
            className="btn btn-sm px-2"
            onClick={prev}
            aria-label="Étape précédente"
            disabled={stepIndex <= 0}
          >
            <Icon d="m15 18-6-6 6-6" />
          </button>
          {playing ? (
            <button
              type="button"
              className="btn btn-sm btn-primary px-2"
              onClick={pause}
              aria-label="Pause"
              data-testid="timeline-pause"
            >
              <Icon d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-primary px-2"
              onClick={play}
              aria-label="Lecture"
              data-testid="timeline-play"
            >
              <Icon d="M7 4v16l13-8z" />
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm px-2"
            onClick={next}
            aria-label="Étape suivante"
            disabled={stepIndex >= steps.length - 1}
          >
            <Icon d="m9 18 6-6-6-6" />
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
        className="h-1 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={stepIndex + 1}
        aria-label="Progression timeline"
      >
        <div
          className="h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <ol className="m-0 flex list-none flex-wrap gap-1 p-0" aria-label="Saut d'étape">
        {steps.map((step, i) => {
          const active = i === stepIndex;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => jump(i)}
                aria-current={active ? 'step' : undefined}
                aria-pressed={active}
                aria-label={`Aller à ${step.label}`}
                className="chip h-7 px-2"
              >
                <span className="font-amount text-[0.6875rem] text-fg-muted">{step.order}</span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
