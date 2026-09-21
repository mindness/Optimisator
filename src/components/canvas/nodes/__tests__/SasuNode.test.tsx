/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NodeProps } from '@xyflow/react';

import type { EntityFlowNode } from '../../EntityNode';
import { SasuNode } from '../SasuNode';

afterEach(() => {
  cleanup();
});

function renderSasu(data: EntityFlowNode['data'], selected = false) {
  const props = {
    id: data.id,
    type: 'sasu',
    data,
    selected,
    isConnectable: true,
    dragging: false,
    draggable: true,
    selectable: true,
    deletable: true,
    zIndex: 1,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  } as NodeProps<EntityFlowNode>;

  return render(
    <ReactFlowProvider>
      <SasuNode {...props} />
    </ReactFlowProvider>,
  );
}

describe('SasuNode', () => {
  it('renders IS and résultat fiscal metrics from node data', () => {
    renderSasu({
      id: 'sasu-1',
      label: 'SASU OpCo',
      entityType: 'sasu',
      metrics: {
        fiscalResult: 96_000,
        corporateTax: 18_675,
      },
    });

    expect(screen.getByText('SASU OpCo')).toBeInTheDocument();
    expect(screen.getByText('Résultat')).toBeInTheDocument();
    expect(screen.getByText('IS')).toBeInTheDocument();

    const amounts = screen.getAllByText((_, node) => {
      if (node?.tagName !== 'SPAN') return false;
      if (!(node as HTMLElement).classList.contains('font-amount')) return false;
      const text = node.textContent ?? '';
      return text.includes('€');
    });

    const texts = amounts.map((n) => n.textContent ?? '');
    expect(texts.some((t) => /96/.test(t) && /000/.test(t))).toBe(true);
    expect(texts.some((t) => /18/.test(t) && /675/.test(t))).toBe(true);
  });

  it('derives résultat and IS from CA / charges inputs when metrics omitted', () => {
    // CA 120k − 24k = 96k → IS PME 15%×42.5k + 25%×53.5k = 19_750
    const { container } = renderSasu({
      id: 'sasu-2',
      label: 'SASU Live',
      entityType: 'sasu',
      inputs: { caHt: 120_000, expensesHt: 24_000 },
    });

    const root = within(container);
    expect(root.getByText('SASU Live')).toBeInTheDocument();
    expect(root.getByText('Résultat')).toBeInTheDocument();
    expect(root.getByText('IS')).toBeInTheDocument();
    expect(root.getByText('CA HT')).toBeInTheDocument();

    const amounts = root.getAllByText((_, node) => {
      if (node?.tagName !== 'SPAN') return false;
      if (!(node as HTMLElement).classList.contains('font-amount')) return false;
      return (node.textContent ?? '').includes('€');
    });
    const texts = amounts.map((n) => n.textContent ?? '');
    expect(texts.some((t) => /96/.test(t) && /000/.test(t))).toBe(true);
    expect(texts.some((t) => /19/.test(t) && /750/.test(t))).toBe(true);
  });

  it('labels treasury separately from CA HT when both exist', () => {
    renderSasu({
      id: 'sasu-3',
      label: 'SASU Split',
      entityType: 'sasu',
      inputs: { caHt: 120_000, expensesHt: 24_000 },
      metrics: {
        fiscalResult: 96_000,
        corporateTax: 19_750,
        treasury: -12_680,
      },
    });

    expect(screen.getByText('CA HT')).toBeInTheDocument();
    expect(screen.getByText('Trésorerie')).toBeInTheDocument();

    const amounts = screen.getAllByText((_, node) => {
      if (node?.tagName !== 'SPAN') return false;
      if (!(node as HTMLElement).classList.contains('font-amount')) return false;
      return (node.textContent ?? '').includes('€');
    });
    const texts = amounts.map((n) => n.textContent ?? '');
    expect(texts.some((t) => /120/.test(t) && /000/.test(t))).toBe(true);
    expect(texts.some((t) => /12/.test(t) && /680/.test(t))).toBe(true);
  });

  it('atelier Architecture : édition directe des paramètres saisis, pas de résultat calculé', () => {
    const onPatchInput = vi.fn();
    renderSasu({
      id: 'sasu-4',
      label: 'SASU Draft',
      entityType: 'sasu',
      inputs: { caHt: 120_000, expensesHt: 24_000 },
      onPatchInput,
    } as EntityFlowNode['data']);

    // Paramètres saisis, éditables — pas de Résultat/IS calculés sur le schéma de saisie.
    expect(screen.getByRole('button', { name: /CA HT annuel/ })).toHaveTextContent('120');
    expect(screen.getByRole('button', { name: /Charges HT annuelles/ })).toHaveTextContent('24');
    expect(screen.queryByText('Résultat')).not.toBeInTheDocument();
    expect(screen.queryByText('IS')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /CA HT annuel/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'CA HT annuel' }), { target: { value: '150000' } });
    fireEvent.blur(screen.getByRole('spinbutton', { name: 'CA HT annuel' }));
    expect(onPatchInput).toHaveBeenCalledWith('caHt', 150_000);
  });

  it('bouton de suppression injecté par l’atelier, absent en mode Simulation', () => {
    const onDelete = vi.fn();
    const { rerender } = renderSasu({ id: 'sasu-5', label: 'SASU Delete', entityType: 'sasu', onDelete } as EntityFlowNode['data']);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer SASU Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();

    rerender(<ReactFlowProvider><SasuNode {...({
      id: 'sasu-5', type: 'sasu', data: { id: 'sasu-5', label: 'SASU Delete', entityType: 'sasu' },
      selected: false, isConnectable: true, dragging: false, draggable: true, selectable: true,
      deletable: true, zIndex: 1, positionAbsoluteX: 0, positionAbsoluteY: 0,
    } as NodeProps<EntityFlowNode>)} /></ReactFlowProvider>);
    expect(screen.queryByRole('button', { name: /^Supprimer / })).not.toBeInTheDocument();
  });

  it('renomme au double-clic, et garde l’ancien nom si la saisie est vide', () => {
    const onRename = vi.fn();
    renderSasu({ id: 'sasu-6', label: 'SASU Avant', entityType: 'sasu', onRename });

    fireEvent.doubleClick(screen.getByRole('heading', { name: 'SASU Avant' }));
    const input = screen.getByRole('textbox', { name: 'Nom de SASU Avant' });
    fireEvent.change(input, { target: { value: '  Ma société  ' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('Ma société');

    onRename.mockClear();
    fireEvent.doubleClick(screen.getByRole('heading', { name: 'SASU Avant' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onRename).not.toHaveBeenCalled();
  });
});
