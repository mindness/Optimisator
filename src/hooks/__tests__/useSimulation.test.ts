/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { categoriesVisibleThrough } from '@/core/engine';
import { FREELANCE_SASU_PRESET, SASU_HOLDING_PRESET } from '@/core/presets';
import type { FlowLayer } from '@/core/types';

import {
  buildViewFlows,
  computeMoneyTracePath,
  filterFlowsByCategories,
  filterFlowsByLayers,
  getResolvedScenario,
  resetSimulationStoreForTests,
  useSimulation,
  useSimulationStore,
} from '../useSimulation';

beforeEach(() => {
  resetSimulationStoreForTests();
});

afterEach(() => {
  cleanup();
  resetSimulationStoreForTests();
});

describe('filterFlowsByLayers', () => {
  it('keeps only flows whose layer is active', () => {
    const flows = FREELANCE_SASU_PRESET.flows;
    const treasuryOnly = filterFlowsByLayers(flows, ['treasury']);
    expect(treasuryOnly.every((f) => f.layer === 'treasury')).toBe(true);
    expect(treasuryOnly.length).toBeGreaterThan(0);
    expect(treasuryOnly.length).toBeLessThan(flows.length);

    const social = filterFlowsByLayers(flows, ['social']);
    expect(social.every((f) => f.layer === 'social')).toBe(true);

    expect(filterFlowsByLayers(flows, [])).toEqual([]);
  });
});

describe('filterFlowsByCategories / timeline', () => {
  it('filters with categoriesVisibleThrough at early vs late steps', () => {
    const flows = FREELANCE_SASU_PRESET.flows;
    const early = filterFlowsByCategories(
      flows,
      categoriesVisibleThrough('facturation'),
    );
    expect(early.every((f) => f.category === 'revenue')).toBe(true);

    const late = filterFlowsByCategories(
      flows,
      categoriesVisibleThrough('dividendes'),
    );
    expect(late.length).toBe(flows.length);
  });
});

describe('Money Tracer path', () => {
  it('computes a path starting from revenue and injects a test amount', () => {
    const resolved = getResolvedScenario(
      FREELANCE_SASU_PRESET,
      {},
      { active: false, amount: 0, pathFlowIds: [] },
    );
    const path = computeMoneyTracePath(resolved.flows);
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toBe('flow-revenue');

    const { result } = renderHook(() => useSimulation());

    act(() => {
      result.current.injectMoneyTrace(80_000);
    });

    expect(result.current.moneyTrace.active).toBe(true);
    expect(result.current.moneyTrace.amount).toBe(80_000);
    expect(result.current.moneyTrace.pathFlowIds.length).toBeGreaterThan(0);
    expect(result.current.resolved.summary.caHt).toBe(80_000);

    const views = buildViewFlows(
      result.current.resolved,
      result.current.activeLayers,
      categoriesVisibleThrough('dividendes'),
      result.current.moneyTrace,
    );
    const highlighted = views.filter((f) => f.traceHighlight);
    expect(highlighted.length).toBe(result.current.moneyTrace.pathFlowIds.length);

    act(() => {
      result.current.clearMoneyTrace();
    });
    expect(result.current.moneyTrace.active).toBe(false);
  });
});

describe('useSimulation What-If + layers', () => {
  it('recomputes summary when What-If CA / salary change', () => {
    const { result } = renderHook(() => useSimulation());

    act(() => {
      result.current.setWhatIf({
        caHt: 100_000,
        expensesHt: 20_000,
        executiveNetSalary: 0,
        dividendAmount: 0,
      });
    });

    expect(result.current.resolved.summary.caHt).toBe(100_000);
    expect(result.current.resolved.summary.vat.netVatDue).toBe(16_000);
  });

  it('toggles layers and marks flows hidden in buildViewFlows', () => {
    const { result } = renderHook(() => useSimulation());

    act(() => {
      result.current.setActiveLayers(['treasury', 'tax']);
    });

    const cats = categoriesVisibleThrough('dividendes');
    const views = buildViewFlows(
      result.current.resolved,
      result.current.activeLayers,
      cats,
      result.current.moneyTrace,
    );
    const visible = views.filter((f) => !f.hidden);
    expect(visible.every((f) => f.layer === 'treasury' || f.layer === 'tax')).toBe(
      true,
    );
    expect(views.some((f) => f.hidden && f.layer === 'social')).toBe(true);
  });

  it('switches preset via setScenario and clears whatIf', () => {
    act(() => {
      useSimulationStore.getState().setWhatIf({ caHt: 50_000 });
      useSimulationStore.getState().setScenario(SASU_HOLDING_PRESET);
    });
    expect(useSimulationStore.getState().scenario.presetId).toBe('sasu-holding');
    expect(useSimulationStore.getState().whatIf).toEqual({});
  });

  it('hydrateFromShare applies scenario, whatIf and layers', () => {
    act(() => {
      useSimulationStore.getState().hydrateFromShare({
        scenario: SASU_HOLDING_PRESET,
        whatIf: { caHt: 200_000 },
        activeLayers: ['treasury', 'tax'],
      });
    });
    const state = useSimulationStore.getState();
    expect(state.scenario.presetId).toBe('sasu-holding');
    expect(state.whatIf.caHt).toBe(200_000);
    expect(state.activeLayers).toEqual(['treasury', 'tax']);
  });

  it('refuses to turn off the last active layer', () => {
    const layers: FlowLayer[] = ['treasury'];
    act(() => {
      useSimulationStore.getState().setActiveLayers(layers);
      useSimulationStore.getState().toggleLayer('treasury');
    });
    expect(useSimulationStore.getState().activeLayers).toEqual(['treasury']);
  });
});

describe('buildViewFlows', () => {
  it('combines layer + timeline filters', () => {
    const resolved = getResolvedScenario(
      FREELANCE_SASU_PRESET,
      {},
      { active: false, amount: 0, pathFlowIds: [] },
    );
    const views = buildViewFlows(
      resolved,
      ['treasury'],
      categoriesVisibleThrough('charges'),
      { active: false, amount: 0, pathFlowIds: [] },
    );
    const shown = views.filter((f) => !f.hidden);
    expect(shown.every((f) => f.layer === 'treasury')).toBe(true);
    expect(
      shown.every((f) => f.category === 'revenue' || f.category === 'expense'),
    ).toBe(true);
  });
});

describe('persistance locale', () => {
  it('restaure scénario et hypothèses après rechargement, et ignore un stockage corrompu', async () => {
    const store = useSimulationStore;
    store.getState().setScenario(SASU_HOLDING_PRESET);
    store.getState().setWhatIf({ caHt: 150_000, structureCosts: { sasu: 2_500 } });

    // Rechargement : l'état mémoire repart des défauts, puis se réhydrate du stockage.
    const saved = localStorage.getItem('optimisator.simulation')!;
    resetSimulationStoreForTests();
    localStorage.setItem('optimisator.simulation', saved);
    await store.persist.rehydrate();
    expect(store.getState().scenario.id).toBe(SASU_HOLDING_PRESET.id);
    expect(store.getState().whatIf).toEqual({ caHt: 150_000, structureCosts: { sasu: 2_500 } });

    resetSimulationStoreForTests();
    localStorage.setItem('optimisator.simulation', JSON.stringify({ state: { scenario: { id: 42 } }, version: 1 }));
    await store.persist.rehydrate();
    expect(store.getState().scenario.id).toBe(FREELANCE_SASU_PRESET.id);
  });

  it('« Réinitialiser » garde les coûts de structure et le capital', () => {
    const store = useSimulationStore;
    store.getState().setWhatIf({ caHt: 150_000, structureCosts: { sasu: 2_500 }, capitalPrimesAndCca: 10_000 });
    store.getState().resetWhatIf();
    expect(store.getState().whatIf).toEqual({ structureCosts: { sasu: 2_500 }, capitalPrimesAndCca: 10_000 });
  });
});
