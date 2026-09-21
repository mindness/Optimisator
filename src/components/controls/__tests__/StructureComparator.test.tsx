/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StructureComparator } from '../StructureComparator';
import { WhatIfSliders } from '../WhatIfSliders';
import { compareStructures } from '@/core/engine';
import { exportScenarioFile, parseScenarioFile } from '@/core/scenarioWorkspace';
import { FREELANCE_SASU_PRESET } from '@/core/presets';

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

describe('StructureComparator — coûts de structure persistés', () => {
  it('remonte le coût saisi sans écraser ceux des autres structures, et survit à l’export JSON', () => {
    const onChange = vi.fn();
    render(<StructureComparator whatIf={{ caHt: 120_000, structureCosts: { micro: 300 } }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/Coût annuel de structure — SASU \/ SAS/), { target: { value: '2500' } });
    expect(onChange).toHaveBeenCalledWith({ structureCosts: { micro: 300, sasu: 2_500 } });

    const whatIf = { caHt: 120_000, structureCosts: { sasu: 2_500 }, capitalPrimesAndCca: 10_000 };
    expect(parseScenarioFile(exportScenarioFile(FREELANCE_SASU_PRESET, whatIf)).whatIf).toEqual(whatIf);
  });

  it('ignore un coût non numérique venu d’un fichier importé', () => {
    render(<StructureComparator whatIf={{ caHt: 120_000, structureCosts: { sasu: 'abc' as unknown as number } }} />);
    expect(screen.getByLabelText(/Coût annuel de structure — SASU \/ SAS/)).toHaveValue(0);
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

  it('masque le loyer SCI sans SCI, affiche le PFU du moteur et accepte un montant saisi', () => {
    const onChange = vi.fn();
    const { rerender } = render(<WhatIfSliders values={{ caHt: 120_000 }} onChange={onChange} />);

    expect(screen.queryByRole('slider', { name: 'Loyer SCI HT' })).toBeNull();
    // 12,8 % + 18,6 % : le libellé suit PFU_TOTAL_RATE, pas un « 30 % » écrit en dur.
    expect(screen.getByRole('option', { name: /PFU 31,4/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^CA HT :/ }));
    const input = screen.getByRole('spinbutton', { name: 'CA HT' });
    fireEvent.change(input, { target: { value: '87500' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({ caHt: 87_500 });

    // Valeur modifiée → retour à l'origine proposé, qui efface la surcharge.
    rerender(<WhatIfSliders values={{ caHt: 87_500 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Revenir à la valeur d’origine — CA HT/ }));
    expect(onChange).toHaveBeenCalledWith({ caHt: undefined });

    rerender(<WhatIfSliders values={{}} hasSci onChange={onChange} />);
    expect(screen.getByRole('slider', { name: 'Loyer SCI HT' })).toBeTruthy();
  });
});
