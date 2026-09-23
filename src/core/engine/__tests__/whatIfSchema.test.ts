import { describe, expect, it } from 'vitest';

import { resolveScenarioGraph } from '@/core/engine';
import { parseWhatIfInputs } from '../whatIfSchema';
import { FREELANCE_SASU_PRESET } from '@/core/presets';

describe('parseWhatIfInputs', () => {
  it('laisse passer des hypothèses valides', () => {
    const inputs = { caHt: 120_000, parts: 2, situation: 'couple', dividendTaxMode: 'auto' };
    expect(parseWhatIfInputs(inputs)).toEqual(inputs);
  });

  it('écarte les valeurs non numériques sans jeter le reste', () => {
    expect(parseWhatIfInputs({ caHt: 'abc', expensesHt: 24_000 })).toEqual({ expensesHt: 24_000 });
    expect(parseWhatIfInputs({ caHt: null, parts: 2 })).toEqual({ parts: 2 });
    expect(parseWhatIfInputs({ situation: 'marié', caHt: 1 })).toEqual({ caHt: 1 });
  });

  it('écarte NaN et l’infini, qui contaminent toute la synthèse', () => {
    expect(parseWhatIfInputs({ caHt: Number.NaN })).toEqual({});
    expect(parseWhatIfInputs({ caHt: Number.POSITIVE_INFINITY })).toEqual({});
  });

  it('ignore les clés inconnues', () => {
    expect(parseWhatIfInputs({ caHt: 1, injected: { toString: 'x' } })).toEqual({ caHt: 1 });
  });

  it('rend null pour ce qui n’est pas un objet', () => {
    expect(parseWhatIfInputs(null)).toBeNull();
    expect(parseWhatIfInputs('caHt=1')).toBeNull();
  });

  it('une hypothèse illisible ne produit plus de NaN dans la synthèse', () => {
    const inputs = parseWhatIfInputs({ caHt: 'abc' }) ?? {};
    const summary = resolveScenarioGraph(FREELANCE_SASU_PRESET, inputs).summary;
    expect(Number.isFinite(summary.caHt)).toBe(true);
    expect(Number.isFinite(summary.corporateTax.taxDue)).toBe(true);
    expect(Number.isFinite(summary.netPersonalCash)).toBe(true);
  });
});
