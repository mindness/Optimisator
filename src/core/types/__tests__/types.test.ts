import { describe, expect, it } from 'vitest';

import {
  ENTITY_TYPES,
  FLOW_CATEGORIES,
  FLOW_LAYERS,
  parseScenarioState,
  parseSourcedRate,
  sourcedRateSchema,
  type EntityNodeData,
  type FlowEdgeData,
  type ScenarioState,
  type SourcedRate,
  type TaxCalculationResult,
} from '../index';

describe('EntityType union', () => {
  it('contains exactly the design-spec entity kinds', () => {
    expect(ENTITY_TYPES).toEqual([
      'sasu',
      'eurl',
      'sarl',
      'holding_sas',
      'holding_sarl',
      'sci_is',
      'sci_ir',
      'micro_entreprise',
      'entreprise_individuelle',
      'person',
      'client',
      'vendor',
      'tax_authority',
      'urssaf',
      'bank',
    ]);
    expect(ENTITY_TYPES).toHaveLength(15);
  });
});

describe('FlowCategory union', () => {
  it('contains exactly the design-spec flow categories', () => {
    expect(FLOW_CATEGORIES).toEqual([
      'revenue',
      'expense',
      'management_fees',
      'dividend',
      'salary',
      'social_charges',
      'rent',
      'is_tax',
      'vat',
      'cca_advance',
      'cca_reimbursement',
      'loan_payment',
      'capital_contribution',
    ]);
    expect(FLOW_CATEGORIES).toHaveLength(13);
  });
});

describe('FlowLayer union', () => {
  it('lists the five thematic canvas layers', () => {
    expect(FLOW_LAYERS).toEqual(['treasury', 'vat', 'tax', 'social', 'legal']);
  });
});

describe('SourcedRate provenance contract', () => {
  const verifiedRate: SourcedRate = {
    value: 0.25,
    unit: 'ratio',
    source: 'CGI art. 219',
    asOf: '2026-09-07',
    status: 'verified',
  };

  it('accepts a valid sourced rate', () => {
    expect(parseSourcedRate(verifiedRate)).toEqual(verifiedRate);
  });

  it('rejects rates missing source or asOf', () => {
    expect(() =>
      sourcedRateSchema.parse({
        value: 0.15,
        unit: 'ratio',
        source: '',
        asOf: '2026-09-07',
        status: 'placeholder',
      }),
    ).toThrow();
  });

  it('rejects unknown status values', () => {
    expect(() =>
      sourcedRateSchema.parse({
        ...verifiedRate,
        status: 'guessed',
      }),
    ).toThrow();
  });
});

describe('ScenarioState sample', () => {
  const sampleScenario: ScenarioState = {
    id: 'scenario-freelance-sasu',
    name: 'Freelance SASU seule',
    entities: [
      {
        id: 'sasu-1',
        label: 'SASU OpCo',
        entityType: 'sasu',
        inputs: { caHt: 120_000 },
      } satisfies EntityNodeData,
      {
        id: 'person-1',
        label: 'Dirigeant',
        entityType: 'person',
      },
    ],
    flows: [
      {
        id: 'flow-revenue',
        sourceId: 'client-ext',
        targetId: 'sasu-1',
        category: 'revenue',
        label: 'Chiffre d affaires',
        amount: 120_000,
        periodicity: 'annual',
        layer: 'treasury',
      } satisfies FlowEdgeData,
      {
        id: 'flow-salary',
        sourceId: 'sasu-1',
        targetId: 'person-1',
        category: 'salary',
        label: 'Rémunération nette',
        amount: 48_000,
        periodicity: 'annual',
        layer: 'social',
      },
    ],
    activeLayers: ['treasury', 'social', 'tax'],
    version: 1,
    createdAt: '2026-09-07T00:00:00.000Z',
    updatedAt: '2026-09-07T00:00:00.000Z',
  };

  it('type-checks and validates at runtime via zod', () => {
    const parsed = parseScenarioState(sampleScenario);
    expect(parsed.id).toBe('scenario-freelance-sasu');
    expect(parsed.entities).toHaveLength(2);
    expect(parsed.flows).toHaveLength(2);
    expect(parsed.activeLayers).toContain('treasury');
  });

  it('rejects scenarios without entities', () => {
    expect(() =>
      parseScenarioState({
        ...sampleScenario,
        entities: [],
      }),
    ).toThrow();
  });
});

describe('TaxCalculationResult shape', () => {
  it('accepts a dividend mère-fille breakdown sample', () => {
    const result: TaxCalculationResult = {
      flowId: 'flow-dividend',
      category: 'dividend',
      grossAmount: 50_000,
      taxAmount: 625,
      netAmount: 49_375,
      provenance: 'derived',
      breakdown: [
        {
          label: 'QPFC 5 %',
          amount: 2_500,
          rate: {
            value: 0.05,
            unit: 'ratio',
            source: 'CGI art. 216',
            asOf: '2026-09-07',
            status: 'placeholder',
          },
          formula: 'dividendAmount * 0.05',
        },
        {
          label: 'IS holding sur QPFC',
          amount: 625,
        },
      ],
      legalNoteId: 'mere-fille-art-145',
    };

    expect(result.netAmount).toBe(result.grossAmount - result.taxAmount);
    expect(result.breakdown).toHaveLength(2);
  });
});
