import { describe, expect, it } from 'vitest';

import { FREELANCE_SASU_PRESET } from '@/core/presets';

import { resolveScenarioGraph } from '../graphResolver';
import { DEFAULT_PAYOUT_RATIOS, optimizeRemuneration } from '../optimizer';

const inputs = { caHt: 120_000, expensesHt: 24_000 };
/** Full distribution only — isolates the salary lever. */
const fullPayout = { payoutRatios: [1] } as const;

describe('optimizeRemuneration', () => {
  it('crosses every salary level with every payout ratio', () => {
    const result = optimizeRemuneration(FREELANCE_SASU_PRESET, inputs, { steps: 10 });

    expect(result.points).toHaveLength(11 * DEFAULT_PAYOUT_RATIOS.length);
    expect(result.points[0]!.executiveNetSalary).toBe(0);
    expect(result.points.at(-1)!.executiveNetSalary).toBeGreaterThan(0);
  });

  it('never proposes a salary the company cannot pay', () => {
    const available = inputs.caHt - inputs.expensesHt;
    const result = optimizeRemuneration(FREELANCE_SASU_PRESET, inputs, { steps: 20, ...fullPayout });

    for (const point of result.points) {
      const cost = resolveScenarioGraph(FREELANCE_SASU_PRESET, {
        ...inputs,
        executiveNetSalary: point.executiveNetSalary,
      }).summary.executiveSalary.totalCompanyCost;
      expect(cost).toBeLessThanOrEqual(available + 1);
    }
  });

  it('returns the best tested point for the chosen objective', () => {
    const result = optimizeRemuneration(FREELANCE_SASU_PRESET, inputs, { steps: 15 });

    const bestByScan = Math.max(...result.points.map((p) => p.netPersonalCash));
    expect(result.best.netPersonalCash).toBe(bestByScan);
    expect(result.objective).toBe('netPersonalCash');
  });

  it('honours an alternative objective', () => {
    const result = optimizeRemuneration(FREELANCE_SASU_PRESET, inputs, {
      steps: 15,
      objective: 'netGroupCash',
    });

    const bestByScan = Math.max(...result.points.map((p) => p.netGroupCash));
    expect(result.best.netGroupCash).toBe(bestByScan);
    // Keeping the money in the company is how group cash is maximised.
    expect(result.best.payoutRatio).toBe(0);
  });

  it('scales the dividend with the payout ratio', () => {
    const result = optimizeRemuneration(FREELANCE_SASU_PRESET, inputs, {
      steps: 2,
      payoutRatios: [0, 0.5, 1],
    });
    const atZeroSalary = result.points.filter((p) => p.executiveNetSalary === 0);

    expect(atZeroSalary.map((p) => p.dividendGross)).toEqual(
      [...atZeroSalary].sort((a, b) => a.dividendGross - b.dividendGross).map((p) => p.dividendGross),
    );
    expect(atZeroSalary[0]!.dividendGross).toBe(0);
    expect(atZeroSalary.at(-1)!.dividendGross).toBeGreaterThan(0);
  });

  it('prefers a low salary over a high one for take-home cash', () => {
    const result = optimizeRemuneration(FREELANCE_SASU_PRESET, inputs, { steps: 12, ...fullPayout });
    const ceiling = Math.max(...result.points.map((p) => p.executiveNetSalary));

    // The PFU beats salary once the progressive brackets are consumed.
    expect(result.best.executiveNetSalary).toBeLessThan(ceiling / 2);
  });

  it('always reports its blind spots, social rights included', () => {
    const result = optimizeRemuneration(FREELANCE_SASU_PRESET, inputs, { steps: 4 });

    expect(result.warnings.join(' ')).toContain('droits sociaux');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('degrades to the zero-salary column when charges eat the whole revenue', () => {
    const result = optimizeRemuneration(
      FREELANCE_SASU_PRESET,
      { caHt: 40_000, expensesHt: 40_000 },
      { steps: 10, ...fullPayout },
    );

    expect(result.points).toHaveLength(1);
    expect(result.best.executiveNetSalary).toBe(0);
    expect(result.warnings[0]).toContain('Aucune marge disponible');
  });
});
