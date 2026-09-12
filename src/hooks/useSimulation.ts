import { useMemo } from 'react';
import { create } from 'zustand';

import {
  resolveScenarioGraph,
  type ResolvedFlow,
  type ResolvedScenario,
  type WhatIfInputs,
} from '@/core/engine';
import { FREELANCE_SASU_PRESET } from '@/core/presets';
import type { FlowCategory, FlowLayer, ScenarioState } from '@/core/types';
import { FLOW_LAYERS } from '@/core/types';

/** Flow enriched for canvas filtering / Money Tracer highlight. */
export type ViewFlow = ResolvedFlow & {
  /** True when Money Tracer marks this edge on the cash path. */
  traceHighlight?: boolean;
  /** True when hidden by layer or timeline filters (data flag; canvas may omit). */
  hidden?: boolean;
};

export type MoneyTraceState = {
  active: boolean;
  amount: number;
  /** Ordered flow ids on the traced cash path. */
  pathFlowIds: string[];
};

/** Serializable share / URL payload bridged into the Zustand store. */
export type SharePayload = {
  scenario: ScenarioState;
  whatIf?: WhatIfInputs;
  activeLayers?: FlowLayer[];
};

export type SimulationState = {
  scenario: ScenarioState;
  whatIf: WhatIfInputs;
  activeLayers: FlowLayer[];
  moneyTrace: MoneyTraceState;

  setScenario: (scenario: ScenarioState) => void;
  setWhatIf: (patch: Partial<WhatIfInputs>) => void;
  resetWhatIf: () => void;
  /** Apply a share/API payload into the store (scenario + whatIf + layers). */
  hydrateFromShare: (payload: SharePayload) => void;
  setActiveLayers: (layers: FlowLayer[]) => void;
  toggleLayer: (layer: FlowLayer) => void;
  injectMoneyTrace: (amount: number) => void;
  clearMoneyTrace: () => void;
};

const EMPTY_WHAT_IF: WhatIfInputs = {};

const DEFAULT_LAYERS: FlowLayer[] = [...FLOW_LAYERS];

export function filterFlowsByLayers<T extends { layer: FlowLayer }>(
  flows: T[],
  activeLayers: readonly FlowLayer[],
): T[] {
  if (activeLayers.length === 0) return [];
  const set = new Set(activeLayers);
  return flows.filter((f) => set.has(f.layer));
}

export function filterFlowsByCategories<T extends { category: FlowCategory }>(
  flows: T[],
  visibleCategories: readonly FlowCategory[],
): T[] {
  const set = new Set(visibleCategories);
  return flows.filter((f) => set.has(f.category));
}

/**
 * Walk outgoing edges in timeline order from the revenue sink (OpCo),
 * collecting a cash-path for Money Tracer highlighting.
 */
export function computeMoneyTracePath(flows: ResolvedFlow[]): string[] {
  if (flows.length === 0) return [];

  const revenue = flows.find((f) => f.category === 'revenue');
  const startId = revenue?.targetId ?? flows[0]!.targetId;

  const bySource = new Map<string, ResolvedFlow[]>();
  for (const flow of flows) {
    const list = bySource.get(flow.sourceId) ?? [];
    list.push(flow);
    bySource.set(flow.sourceId, list);
  }

  const path: string[] = [];
  const visitedFlows = new Set<string>();
  const queue: string[] = [startId];
  const visitedNodes = new Set<string>([startId]);

  if (revenue) {
    path.push(revenue.id);
    visitedFlows.add(revenue.id);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const outgoing = bySource.get(nodeId) ?? [];
    for (const flow of outgoing) {
      if (visitedFlows.has(flow.id)) continue;
      visitedFlows.add(flow.id);
      path.push(flow.id);
      if (!visitedNodes.has(flow.targetId)) {
        visitedNodes.add(flow.targetId);
        queue.push(flow.targetId);
      }
    }
  }

  return path;
}

export function buildViewFlows(
  resolved: ResolvedScenario,
  activeLayers: readonly FlowLayer[],
  visibleCategories: readonly FlowCategory[],
  moneyTrace: MoneyTraceState,
): ViewFlow[] {
  const layerSet = new Set(activeLayers);
  const catSet = new Set(visibleCategories);
  const pathSet = new Set(moneyTrace.active ? moneyTrace.pathFlowIds : []);

  return resolved.flows.map((flow) => {
    const layerOk = layerSet.has(flow.layer);
    const catOk = catSet.has(flow.category);
    return {
      ...flow,
      hidden: !(layerOk && catOk),
      traceHighlight: pathSet.has(flow.id),
    };
  });
}

export function getResolvedScenario(
  scenario: ScenarioState,
  whatIf: WhatIfInputs,
  moneyTrace: MoneyTraceState,
): ResolvedScenario {
  const inputs: WhatIfInputs = { ...whatIf };
  if (moneyTrace.active && moneyTrace.amount > 0) {
    inputs.caHt = moneyTrace.amount;
  }
  return resolveScenarioGraph(scenario, inputs);
}

export const useSimulationStore = create<SimulationState>()((set, get) => ({
  scenario: FREELANCE_SASU_PRESET,
  whatIf: { ...EMPTY_WHAT_IF },
  activeLayers: [...DEFAULT_LAYERS],
  moneyTrace: { active: false, amount: 0, pathFlowIds: [] },

  setScenario: (scenario) =>
    set({
      scenario,
      whatIf: { ...EMPTY_WHAT_IF },
      activeLayers:
        scenario.activeLayers.length > 0
          ? [...scenario.activeLayers]
          : [...DEFAULT_LAYERS],
      moneyTrace: { active: false, amount: 0, pathFlowIds: [] },
    }),

  setWhatIf: (patch) =>
    set((state) => ({
      whatIf: { ...state.whatIf, ...patch },
    })),

  resetWhatIf: () => set({ whatIf: { ...EMPTY_WHAT_IF } }),

  hydrateFromShare: (payload) => {
    const layers =
      payload.activeLayers && payload.activeLayers.length > 0
        ? [...payload.activeLayers]
        : payload.scenario.activeLayers.length > 0
          ? [...payload.scenario.activeLayers]
          : [...DEFAULT_LAYERS];
    set({
      scenario: payload.scenario,
      whatIf: { ...(payload.whatIf ?? EMPTY_WHAT_IF) },
      activeLayers: layers,
      moneyTrace: { active: false, amount: 0, pathFlowIds: [] },
    });
  },

  setActiveLayers: (layers) => set({ activeLayers: [...layers] }),

  toggleLayer: (layer) =>
    set((state) => {
      const has = state.activeLayers.includes(layer);
      if (has) {
        const next = state.activeLayers.filter((l) => l !== layer);
        // Keep at least one layer so the canvas is not empty by accident.
        return { activeLayers: next.length > 0 ? next : state.activeLayers };
      }
      return { activeLayers: [...state.activeLayers, layer] };
    }),

  injectMoneyTrace: (amount) => {
    const { scenario, whatIf } = get();
    const safeAmount = Math.max(0, amount);
    const resolved = resolveScenarioGraph(scenario, {
      ...whatIf,
      caHt: safeAmount > 0 ? safeAmount : whatIf.caHt,
    });
    const pathFlowIds = computeMoneyTracePath(resolved.flows);
    set({
      moneyTrace: {
        active: true,
        amount: safeAmount,
        pathFlowIds,
      },
    });
  },

  clearMoneyTrace: () =>
    set({ moneyTrace: { active: false, amount: 0, pathFlowIds: [] } }),
}));

/**
 * Hook façade over the Zustand simulation store + derived resolution.
 * Prefer selectors for fine-grained subscriptions in hot paths.
 */
export function useSimulation() {
  const scenario = useSimulationStore((s) => s.scenario);
  const whatIf = useSimulationStore((s) => s.whatIf);
  const activeLayers = useSimulationStore((s) => s.activeLayers);
  const moneyTrace = useSimulationStore((s) => s.moneyTrace);
  const setScenario = useSimulationStore((s) => s.setScenario);
  const setWhatIf = useSimulationStore((s) => s.setWhatIf);
  const resetWhatIf = useSimulationStore((s) => s.resetWhatIf);
  const hydrateFromShare = useSimulationStore((s) => s.hydrateFromShare);
  const setActiveLayers = useSimulationStore((s) => s.setActiveLayers);
  const toggleLayer = useSimulationStore((s) => s.toggleLayer);
  const injectMoneyTrace = useSimulationStore((s) => s.injectMoneyTrace);
  const clearMoneyTrace = useSimulationStore((s) => s.clearMoneyTrace);

  const resolved = useMemo(
    () => getResolvedScenario(scenario, whatIf, moneyTrace),
    [scenario, whatIf, moneyTrace],
  );

  return {
    scenario,
    whatIf,
    activeLayers,
    moneyTrace,
    resolved,
    setScenario,
    setWhatIf,
    resetWhatIf,
    hydrateFromShare,
    setActiveLayers,
    toggleLayer,
    injectMoneyTrace,
    clearMoneyTrace,
  };
}

/**
 * Slider display seeds from the currently resolved graph (preset bases when
 * whatIf keys are empty). Prefer these over hardcoded WhatIfSliders defaults.
 */
export function whatIfDefaultsFromResolved(
  resolved: ResolvedScenario,
): Required<
  Pick<
    WhatIfInputs,
    'caHt' | 'expensesHt' | 'executiveNetSalary' | 'dividendAmount' | 'holdingDividendAmount' | 'sciRentHt'
  >
> {
  const salaryFlow = resolved.flows.find((f) => f.category === 'salary');
  const entityType = (id: string) => resolved.entities.find((entity) => entity.id === id)?.entityType;
  const dividendFlow = resolved.flows.find((flow) => flow.category === 'dividend' && entityType(flow.sourceId) === 'sasu');
  const holdingDividendFlow = resolved.flows.find((flow) => {
    const sourceType = entityType(flow.sourceId);
    return flow.category === 'dividend' && entityType(flow.targetId) === 'person' &&
      (sourceType === 'holding_sas' || sourceType === 'holding_sarl');
  });
  const rentFlow = resolved.flows.find((f) => f.category === 'rent');
  return {
    caHt: resolved.summary.caHt,
    expensesHt: resolved.summary.expensesHt,
    executiveNetSalary: salaryFlow?.taxResult?.netAmount ?? salaryFlow?.resolvedAmount ?? 0,
    dividendAmount: dividendFlow?.resolvedAmount ?? dividendFlow?.amount ?? 0,
    holdingDividendAmount: holdingDividendFlow?.resolvedAmount ?? 0,
    sciRentHt: rentFlow?.resolvedAmount ?? rentFlow?.amount ?? 0,
  };
}

/** Test helper — reset store to defaults. */
export function resetSimulationStoreForTests(): void {
  useSimulationStore.setState({
    scenario: FREELANCE_SASU_PRESET,
    whatIf: { ...EMPTY_WHAT_IF },
    activeLayers: [...DEFAULT_LAYERS],
    moneyTrace: { active: false, amount: 0, pathFlowIds: [] },
  });
}
