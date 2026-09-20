/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StructureComparator } from '../StructureComparator';
import { WhatIfSliders } from '../WhatIfSliders';
import { compareStructures } from '@/core/engine';

afterEach(cleanup);

describe('StructureComparator', () => {
  it('affiche une ligne par structure, classée comme le moteur', () => {
    render(<StructureComparator whatIf={{ caHt: 120_000, expensesHt: 20_000 }} />);

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    const expected = compareStructures({
      caHt: 120_000,
      expensesHt: 20_000,
      capitalPrimesAndCca: 1_000,
    });

    expect(rows).toHaveLength(expected.outcomes.length);
    expect(rows[0]!.textContent).toContain(expected.outcomes[0]!.label);
  });

  it('signale la structure de tête et ses limites', () => {
    render(<StructureComparator whatIf={{ caHt: 90_000 }} />);

    const best = compareStructures({ caHt: 90_000, capitalPrimesAndCca: 1_000 }).best;
    expect(screen.getByText(best.label, { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText(/Limites du comparatif/)).toBeTruthy();
  });

  it('recalcule quand la catégorie micro change', () => {
    render(<StructureComparator whatIf={{ caHt: 100_000 }} />);

    const table = () => screen.getByRole('table').textContent ?? '';
    const before = table();
    fireEvent.change(screen.getByLabelText(/Activité micro/), { target: { value: 'bic_vente' } });

    expect(table()).not.toBe(before);
  });
});

describe('WhatIfSliders — profil fiscal', () => {
  it('affiche la TMI et remonte les changements de foyer', () => {
    const onChange = vi.fn();
    render(
      <WhatIfSliders
        values={{ caHt: 120_000 }}
        marginalRate={0.3}
        appliedDividendMode="pfu"
        onChange={onChange}
      />,
    );

    expect(screen.getByText('30 %')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Situation/), { target: { value: 'couple' } });
    expect(onChange).toHaveBeenCalledWith({ situation: 'couple' });

    fireEvent.change(screen.getByLabelText(/Parts de quotient familial/), { target: { value: '2.5' } });
    expect(onChange).toHaveBeenCalledWith({ parts: 2.5 });

    fireEvent.change(screen.getByLabelText(/Imposition des dividendes/), {
      target: { value: 'bareme' },
    });
    expect(onChange).toHaveBeenCalledWith({ dividendTaxMode: 'bareme' });
  });
});
