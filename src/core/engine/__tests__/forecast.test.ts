import { describe, expect, it } from 'vitest';

import { FREELANCE_SASU_PRESET } from '@/core/presets';

import { forecastScenario } from '../forecast';

const inputs = { caHt: 120_000, expensesHt: 24_000 };

describe('forecastScenario', () => {
  it('projects the requested number of consecutive years', () => {
    const { years } = forecastScenario(FREELANCE_SASU_PRESET, inputs, {
      years: 5,
      startYear: 2026,
    });

    expect(years.map((y) => y.year)).toEqual([2026, 2027, 2028, 2029, 2030]);
  });

  it('leaves the first year on the current figures', () => {
    const { years } = forecastScenario(FREELANCE_SASU_PRESET, inputs, { caGrowth: 0.2 });

    expect(years[0]!.caHt).toBe(inputs.caHt);
    expect(years[0]!.expensesHt).toBe(inputs.expensesHt);
  });

  it('compounds growth rather than adding it', () => {
    const { years } = forecastScenario(FREELANCE_SASU_PRESET, inputs, {
      years: 3,
      caGrowth: 0.1,
    });

    expect(years[1]!.caHt).toBeCloseTo(132_000, 2);
    expect(years[2]!.caHt).toBeCloseTo(145_200, 2);
  });

  it('lets expenses grow on their own rate', () => {
    const { years } = forecastScenario(FREELANCE_SASU_PRESET, inputs, {
      years: 2,
      caGrowth: 0.1,
      expenseGrowth: 0,
    });

    expect(years[1]!.expensesHt).toBe(inputs.expensesHt);
    expect(years[1]!.caHt).toBeGreaterThan(years[0]!.caHt);
  });

  it('accumulates cash across the projected years', () => {
    const { years } = forecastScenario(FREELANCE_SASU_PRESET, inputs, { years: 4 });
    const summed = years.reduce((total, y) => total + y.netGroupCash, 0);

    expect(years.at(-1)!.cumulativeGroupCash).toBeCloseTo(summed, 2);
    expect(years[0]!.cumulativeGroupCash).toBe(years[0]!.netGroupCash);
  });

  it('flags a loss-making projection and never hides its blind spots', () => {
    const { warnings } = forecastScenario(
      FREELANCE_SASU_PRESET,
      { caHt: 30_000, expensesHt: 50_000 },
      { years: 3 },
    );

    expect(warnings[0]).toContain('déficitaire');
    expect(warnings.join(' ')).toContain('Taux figés');
  });

  it('projects a single year when asked for one', () => {
    const { years } = forecastScenario(FREELANCE_SASU_PRESET, inputs, { years: 1 });

    expect(years).toHaveLength(1);
  });
});
