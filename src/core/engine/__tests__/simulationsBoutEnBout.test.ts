import { describe, expect, it } from 'vitest';

import { resolveScenarioGraph, emptyCarryOver } from '../graphResolver';
import { forecastScenario } from '../forecast';
import { optimizeRemuneration } from '../optimizer';
import {
  FREELANCE_SASU_PRESET,
  SASU_HOLDING_PRESET,
  FULL_GROUP_PRESET,
} from '@/core/presets';
import type { ScenarioState } from '@/core/types';
import type { WhatIfInputs } from '../graphResolver';

const PRESETS: ReadonlyArray<[string, ScenarioState]> = [
  ['Freelance SASU', FREELANCE_SASU_PRESET],
  ['SASU + Holding', SASU_HOLDING_PRESET],
  ['Groupe SASU + Holding + SCI', FULL_GROUP_PRESET],
];

/** Balayage d'hypothèses : extrêmes inclus, parce que l'utilisateur y va. */
const WHAT_IFS: ReadonlyArray<[string, WhatIfInputs]> = [
  ['par défaut', {}],
  ['CA nul', { caHt: 0 }],
  ['charges supérieures au CA', { caHt: 50_000, expensesHt: 200_000 }],
  ['tout en salaire', { caHt: 150_000, executiveNetSalary: 90_000, dividendAmount: 0 }],
  ['tout en dividendes', { caHt: 150_000, executiveNetSalary: 0, dividendAmount: 60_000 }],
  ['aucune sortie', { caHt: 150_000, executiveNetSalary: 0, dividendAmount: 0 }],
  ['CA élevé', { caHt: 2_000_000, executiveNetSalary: 200_000, dividendAmount: 400_000 }],
  ['couple, 3 parts, 2 enfants', { caHt: 200_000, parts: 3, situation: 'couple', dependents: 2 }],
  ['barème forcé', { caHt: 150_000, dividendAmount: 40_000, dividendTaxMode: 'bareme' }],
  ['PFU forcé', { caHt: 150_000, dividendAmount: 40_000, dividendTaxMode: 'pfu' }],
  ['autres revenus du foyer', { caHt: 120_000, otherIncome: 150_000 }],
  ['PER au plafond', { caHt: 200_000, executiveNetSalary: 100_000, perContribution: 35_000 }],
  ['exercice écourté', { caHt: 120_000, exerciseDays: 180 }],
  ['loyer SCI élevé', { caHt: 150_000, sciRentHt: 60_000 }],
];

/** Tous les nombres d'une valeur, y compris imbriqués, avec leur chemin. */
function numbersIn(value: unknown, path = '', out: Array<[string, number]> = []): Array<[string, number]> {
  if (typeof value === 'number') out.push([path, value]);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      numbersIn(child, path ? path + '.' + key : key, out);
    }
  }
  return out;
}

describe('simulations de bout en bout — invariants', () => {
  for (const [presetName, preset] of PRESETS) {
    for (const [caseName, whatIf] of WHAT_IFS) {
      describe(presetName + ' · ' + caseName, () => {
        const resolved = resolveScenarioGraph(preset, whatIf);
        const s = resolved.summary;

        it('ne produit aucun NaN ni infini, nulle part', () => {
          const scanned = numbersIn(s, 'summary')
            .concat(resolved.entities.flatMap((e) => numbersIn(e.metrics, 'entity:' + e.id)))
            .concat(resolved.flows.map((f) => ['flow:' + f.id, f.resolvedAmount] as [string, number]));
          // maxTaxableSalaryAtTmi vaut Infinity à 45 % : c'est sa valeur légitime.
          const bad = scanned.filter(([path, n]) => !Number.isFinite(n) && !path.endsWith('maxTaxableSalaryAtTmi'));
          expect(bad).toEqual([]);
        });

        it('ne réclame jamais un impôt ou une cotisation négatifs', () => {
          expect(s.corporateTax.taxDue).toBeGreaterThanOrEqual(0);
          expect(s.personalIncomeTax.taxDue).toBeGreaterThanOrEqual(0);
          expect(s.executiveSalary.employerCharges).toBeGreaterThanOrEqual(0);
          expect(s.executiveSalary.employeeCharges).toBeGreaterThanOrEqual(0);
          expect(s.sciTaxDue).toBeGreaterThanOrEqual(0);
          for (const entity of resolved.entities) {
            expect(entity.metrics.corporateTax ?? 0).toBeGreaterThanOrEqual(0);
          }
        });

        it('garde la TMI dans le barème légal et le taux moyen en dessous', () => {
          expect([0, 0.11, 0.3, 0.41, 0.45]).toContain(s.personalIncomeTax.marginalRate);
          expect(s.personalIncomeTax.averageRate).toBeGreaterThanOrEqual(0);
          expect(s.personalIncomeTax.averageRate).toBeLessThanOrEqual(s.personalIncomeTax.marginalRate + 1e-9);
          expect(['pfu', 'bareme']).toContain(s.dividendTaxMode);
        });

        it('n’impose jamais une société au-delà du taux normal de l’IS', () => {
          for (const entity of resolved.entities) {
            const taxable = entity.metrics.fiscalResult ?? 0;
            if (taxable <= 0) continue;
            expect(entity.metrics.corporateTax ?? 0).toBeLessThanOrEqual(taxable * 0.25 + 0.01);
          }
        });

        it('retient le régime de dividendes le moins coûteux quand il est automatique', () => {
          if (whatIf.dividendTaxMode && whatIf.dividendTaxMode !== 'auto') return;
          const { pfu, bareme, best } = s.dividendArbitrage;
          expect(best.totalTax).toBeLessThanOrEqual(Math.min(pfu.totalTax, bareme.totalTax) + 0.01);
          expect(s.dividendTaxMode).toBe(best.mode);
        });

        it('n’émet que des avertissements lisibles', () => {
          expect(Array.isArray(resolved.warnings)).toBe(true);
          for (const warning of resolved.warnings) {
            expect(typeof warning).toBe('string');
            expect(warning.trim().length).toBeGreaterThan(0);
          }
        });
      });
    }
  }
});

describe('simulations de bout en bout — stabilité', () => {
  it('donne le même résultat à hypothèses égales', () => {
    for (const [, preset] of PRESETS) {
      const a = resolveScenarioGraph(preset, { caHt: 180_000 });
      const b = resolveScenarioGraph(preset, { caHt: 180_000 });
      expect(a.summary).toEqual(b.summary);
    }
  });

  it('ne modifie pas le scénario qu’on lui passe', () => {
    const before = JSON.stringify(FREELANCE_SASU_PRESET);
    resolveScenarioGraph(FREELANCE_SASU_PRESET, { caHt: 500_000, executiveNetSalary: 80_000 });
    expect(JSON.stringify(FREELANCE_SASU_PRESET)).toBe(before);
  });

  it('fait croître l’IS avec le chiffre d’affaires, jamais l’inverse', () => {
    let previous = -1;
    for (const caHt of [50_000, 100_000, 200_000, 400_000, 800_000]) {
      const { summary } = resolveScenarioGraph(FREELANCE_SASU_PRESET, {
        caHt, executiveNetSalary: 30_000, dividendAmount: 0,
      });
      expect(summary.corporateTax.taxDue).toBeGreaterThanOrEqual(previous);
      previous = summary.corporateTax.taxDue;
    }
  });
});

describe('simulations de bout en bout — projection et optimiseur', () => {
  it('projette cinq exercices cohérents sur chaque preset', () => {
    for (const [, preset] of PRESETS) {
      const forecast = forecastScenario(preset, {}, { years: 5, caGrowth: 0.05 });
      expect(forecast.years).toHaveLength(5);
      for (const year of forecast.years) {
        for (const [, n] of numbersIn(year)) expect(Number.isFinite(n)).toBe(true);
        expect(year.corporateTaxDue).toBeGreaterThanOrEqual(0);
        expect(year.debtOutstanding).toBeGreaterThanOrEqual(0);
        expect(year.deficitCarryForward).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('balaye l’arbitrage sans proposer un optimum pire que le scénario courant', () => {
    for (const [, preset] of PRESETS) {
      const result = optimizeRemuneration(preset, { caHt: 200_000 });
      expect(result.points.length).toBeGreaterThan(0);
      for (const point of result.points) {
        for (const [, n] of numbersIn(point)) expect(Number.isFinite(n)).toBe(true);
      }
      expect(result.best.netPersonalCash).toBeGreaterThanOrEqual(result.baseline.netPersonalCash - 0.01);
    }
  });

  it('enchaîne deux exercices en reportant le déficit', () => {
    const deficitaire = resolveScenarioGraph(FREELANCE_SASU_PRESET, { caHt: 10_000, expensesHt: 80_000 });
    expect(deficitaire.summary.corporateTax.taxDue).toBe(0);
    const carry = { ...emptyCarryOver(2026), deficits: deficitaire.carryOut.deficits };
    const avecReport = resolveScenarioGraph(FREELANCE_SASU_PRESET, { caHt: 200_000 }, carry);
    const sansReport = resolveScenarioGraph(FREELANCE_SASU_PRESET, { caHt: 200_000 });
    expect(avecReport.summary.corporateTax.taxDue).toBeLessThan(sansReport.summary.corporateTax.taxDue);
  });
});
