/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ScenarioWorkspace } from '../ScenarioWorkspace';
import { FREELANCE_SASU_PRESET } from '@/core/presets';

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
});

// Le brouillon d'atelier vit en sessionStorage : sans purge, il fuit d'un test au suivant.
afterEach(() => { cleanup(); sessionStorage.clear(); });

function entityList() {
  return screen.getByText('Sociétés et acteurs').closest('details') as HTMLDetailsElement;
}

describe('ScenarioWorkspace', () => {
  it('adds an entity from the palette and empties the schema on reset', () => {
    render(<ScenarioWorkspace initialScenario={FREELANCE_SASU_PRESET} whatIf={{}} onApply={() => {}} />);

    const before = within(entityList()).getAllByTestId('entity-card').length;
    fireEvent.click(screen.getByRole('button', { name: 'Holding (SAS)' }));
    expect(within(entityList()).getAllByTestId('entity-card')).toHaveLength(before + 1);

    fireEvent.click(screen.getByRole('button', { name: 'Repartir de zéro' }));
    expect(screen.getByText('Aucune entité : commencez par la palette.')).toBeInTheDocument();
    // getByRole parcourt tout le DOM : lent sous 20 workers jsdom.
  }, 15_000);

  it('undoes and redoes with Ctrl+Z / Ctrl+Y', () => {
    render(<ScenarioWorkspace initialScenario={FREELANCE_SASU_PRESET} whatIf={{}} onApply={() => {}} />);
    const count = () => within(entityList()).getAllByTestId('entity-card').length;

    const before = count();
    fireEvent.click(screen.getByRole('button', { name: 'Holding (SAS)' }));
    expect(count()).toBe(before + 1);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(count()).toBe(before);
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(count()).toBe(before + 1);
  }, 15_000);

  it('lists conventions between the parties and adds their flow', () => {
    render(<ScenarioWorkspace initialScenario={FREELANCE_SASU_PRESET} whatIf={{}} onApply={() => {}} />);
    const distribution = screen.getByTestId('convention-distribution-personne');
    expect(within(distribution).getByText('Flux déjà sur le schéma')).toBeDisabled();
    const cca = screen.getByTestId('convention-cca-associe');
    fireEvent.click(within(cca).getByText(/Ajouter le flux/));
    expect(within(cca).getByText('Flux déjà sur le schéma')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Apport en compte courant');
  }, 15_000);
});
