/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  categoriesVisibleThrough,
  getTimelineSteps,
} from '@/core/engine';
import { FREELANCE_SASU_PRESET } from '@/core/presets';
import { useTimeline } from '../useTimeline';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('categoriesVisibleThrough (timeline visibility)', () => {
  it('accumulates categories up to and including the given step', () => {
    expect(categoriesVisibleThrough('facturation')).toEqual(['revenue']);
    expect(categoriesVisibleThrough('charges')).toEqual(['revenue', 'expense']);
    expect(categoriesVisibleThrough('remuneration')).toEqual([
      'revenue',
      'expense',
      'salary',
      'social_charges',
    ]);
    expect(categoriesVisibleThrough('intra_groupe')).toEqual([
      'revenue',
      'expense',
      'salary',
      'social_charges',
      'management_fees',
      'rent',
      'cca_advance',
      'cca_reimbursement',
      'loan_payment',
    ]);
    expect(categoriesVisibleThrough('impots')).toContain('is_tax');
    expect(categoriesVisibleThrough('impots')).toContain('vat');
    expect(categoriesVisibleThrough('dividendes')).toContain('dividend');

    const allAtEnd = categoriesVisibleThrough('dividendes');
    expect(allAtEnd.length).toBeGreaterThan(categoriesVisibleThrough('facturation').length);
  });
});

describe('useTimeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('starts at the first step with matching visible categories', () => {
    const { result } = renderHook(() => useTimeline(FREELANCE_SASU_PRESET));
    const steps = getTimelineSteps(FREELANCE_SASU_PRESET);

    expect(result.current.steps).toHaveLength(6);
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.currentStep.id).toBe('facturation');
    expect(result.current.playing).toBe(false);
    expect(result.current.visibleCategories).toEqual(
      categoriesVisibleThrough(steps[0]!.id),
    );
  });

  it('next / prev / jump change the active step and visible categories', () => {
    const { result } = renderHook(() => useTimeline(FREELANCE_SASU_PRESET));

    act(() => {
      result.current.next();
    });
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.currentStep.id).toBe('charges');
    expect(result.current.visibleCategories).toEqual(
      categoriesVisibleThrough('charges'),
    );

    act(() => {
      result.current.jump(4);
    });
    expect(result.current.currentStep.id).toBe('impots');
    expect(result.current.visibleCategories).toEqual(
      categoriesVisibleThrough('impots'),
    );

    act(() => {
      result.current.prev();
    });
    expect(result.current.currentStep.id).toBe('intra_groupe');
    expect(result.current.visibleCategories).toEqual(
      categoriesVisibleThrough('intra_groupe'),
    );
  });

  it('clamps jump and does not wrap prev at start', () => {
    const { result } = renderHook(() => useTimeline(FREELANCE_SASU_PRESET));

    act(() => {
      result.current.prev();
    });
    expect(result.current.stepIndex).toBe(0);

    act(() => {
      result.current.jump(99);
    });
    expect(result.current.stepIndex).toBe(5);

    act(() => {
      result.current.next();
    });
    expect(result.current.stepIndex).toBe(5);
  });

  it('jumpToId selects a step by id', () => {
    const { result } = renderHook(() => useTimeline(FREELANCE_SASU_PRESET));

    act(() => {
      result.current.jumpToId('impots');
    });
    expect(result.current.currentStep.id).toBe('impots');
    expect(result.current.visibleCategories).toEqual(
      categoriesVisibleThrough('impots'),
    );
  });

  it('resets stepIndex when scenario id changes', () => {
    const { result, rerender } = renderHook(
      ({ scenario }) => useTimeline(scenario),
      { initialProps: { scenario: FREELANCE_SASU_PRESET } },
    );

    act(() => {
      result.current.jump(3);
    });
    expect(result.current.stepIndex).toBe(3);

    rerender({ scenario: { ...FREELANCE_SASU_PRESET, id: 'other-id' } });
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.playing).toBe(false);
  });

  it('auto-advances while playing and pauses at the last step', () => {
    const { result } = renderHook(() =>
      useTimeline(FREELANCE_SASU_PRESET, { intervalMs: 1000 }),
    );

    act(() => {
      result.current.play();
    });
    expect(result.current.playing).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.stepIndex).toBe(1);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.stepIndex).toBe(5);
    expect(result.current.playing).toBe(false);

    act(() => {
      result.current.jump(0);
      result.current.play();
    });
    act(() => {
      result.current.pause();
    });
    expect(result.current.playing).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.stepIndex).toBe(0);
  });
});
