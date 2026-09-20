import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  categoriesVisibleThrough,
  getTimelineSteps,
  type TimelineStep,
  type TimelineStepId,
} from '@/core/engine';
import type { FlowCategory, ScenarioState } from '@/core/types';

export type UseTimelineOptions = {
  /** Auto-advance interval while playing (ms). Default 1600. */
  intervalMs?: number;
  /** Initial step index (clamped). Default 0. */
  initialIndex?: number;
};

export type UseTimelineResult = {
  steps: TimelineStep[];
  stepIndex: number;
  currentStep: TimelineStep;
  playing: boolean;
  /** Categories visible from facturation through the current step. */
  visibleCategories: FlowCategory[];
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  jump: (index: number) => void;
  jumpToId: (id: TimelineStepId) => void;
};

const DEFAULT_INTERVAL_MS = 1600;

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
}

/**
 * Timeline Replay controller: Play / Pause / Prev / Next / jump,
 * auto-advance timer, and `categoriesVisibleThrough` for canvas filtering.
 */
export function useTimeline(
  scenario: ScenarioState,
  options: UseTimelineOptions = {},
): UseTimelineResult {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const steps = useMemo(() => getTimelineSteps(scenario), [scenario]);
  const [rawIndex, setStepIndex] = useState(() =>
    clampIndex(options.initialIndex ?? 0, steps.length),
  );
  const [rawPlaying, setPlaying] = useState(false);

  // Reset replay when the preset / scenario identity changes — adjusted during
  // render rather than in an effect, which would cost a second render pass.
  const [seenScenarioId, setSeenScenarioId] = useState(scenario.id);
  if (seenScenarioId !== scenario.id) {
    setSeenScenarioId(scenario.id);
    setStepIndex(0);
    setPlaying(false);
  }

  // Index and playback are derived: a shorter step list re-clamps both without an effect.
  const stepIndex = clampIndex(rawIndex, steps.length);
  const playing = rawPlaying && stepIndex < steps.length - 1;

  const currentStep = steps[stepIndex] ?? steps[0]!;

  const visibleCategories = useMemo(
    () => categoriesVisibleThrough(currentStep.id),
    [currentStep.id],
  );

  const pause = useCallback(() => {
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    setStepIndex((i) => {
      if (i >= steps.length - 1) return 0;
      return i;
    });
    setPlaying(true);
  }, [steps.length]);

  const next = useCallback(() => {
    setStepIndex((i) => clampIndex(i + 1, steps.length));
  }, [steps.length]);

  const prev = useCallback(() => {
    setStepIndex((i) => clampIndex(i - 1, steps.length));
  }, [steps.length]);

  const jump = useCallback(
    (index: number) => {
      setStepIndex(clampIndex(index, steps.length));
    },
    [steps.length],
  );

  const jumpToId = useCallback(
    (id: TimelineStepId) => {
      const idx = steps.findIndex((s) => s.id === id);
      if (idx >= 0) setStepIndex(idx);
    },
    [steps],
  );

  useEffect(() => {
    if (!playing) return;

    const id = window.setInterval(() => {
      setStepIndex((i) => {
        if (i >= steps.length - 1) return i;
        return i + 1;
      });
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [playing, intervalMs, steps.length]);

  return {
    steps,
    stepIndex,
    currentStep,
    playing,
    visibleCategories,
    play,
    pause,
    next,
    prev,
    jump,
    jumpToId,
  };
}
