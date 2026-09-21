/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { FREELANCE_SASU_PRESET, FULL_GROUP_PRESET, SASU_HOLDING_PRESET } from '@/core/presets';
import { resetSimulationStoreForTests } from '@/hooks/useSimulation';
import { buildHashShareUrl } from '@/hooks/useUrlState';

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  resetSimulationStoreForTests();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  resetSimulationStoreForTests();
  localStorage.clear();
});

describe('App assembly', () => {
  it('shows live figures in the Synthèse document and returns without losing inputs', async () => {
    render(<App />);
    fireEvent.change(screen.getByRole('slider', { name: 'CA HT' }), { target: { value: '150000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Synthèse' }));
    const caRow = (await screen.findByRole('rowheader', { name: 'Chiffre d’affaires HT' })).closest('tr');
    expect(caRow).toHaveTextContent(/150.000/);
    fireEvent.click(screen.getByRole('button', { name: 'Simulation' }));
    expect(screen.getByTestId('flow-canvas')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'CA HT' })).toHaveValue('150000');
  });

  // Smoke prod : chaque onglet lourd (lazy) se monte sur les trois presets, sans erreur console.
  it.each([
    ['Architecture', 'Atelier architecture'],
    ['Optimisation', 'Optimisation salaire / dividendes'],
    ['Structures', 'Comparateur de structures'],
    ['Projection', 'Projection pluriannuelle'],
  ])('opens the %s tab for every preset without console errors', async (tab, region) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App />);
    for (const preset of [FREELANCE_SASU_PRESET, SASU_HOLDING_PRESET, FULL_GROUP_PRESET]) {
      fireEvent.click(screen.getByRole('button', { name: 'Simulation' }));
      fireEvent.change(screen.getByTestId('preset-select'), { target: { value: preset.id } });
      fireEvent.click(screen.getByRole('button', { name: tab }));
      // Import dynamique à froid : sous 20+ workers en parallèle, la seconde par défaut ne suffit pas toujours.
      await waitFor(() => expect(screen.getByRole('region', { name: region })).toBeInTheDocument(), { timeout: 5000 });
    }
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('initializes the salary slider with net cash and exposes an independent holding distribution', () => {
    render(<App />);
    expect(screen.getByRole('slider', { name: 'Salaire net avant IR' })).toHaveValue('36000');
    expect(screen.queryByRole('slider', { name: 'Dividendes holding → personne' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('preset-select'), { target: { value: SASU_HOLDING_PRESET.id } });
    expect(screen.getByRole('slider', { name: 'Dividendes SASU' })).toHaveValue('50000');
    const holding = screen.getByRole('slider', { name: 'Dividendes holding → personne' });
    expect(holding).toHaveValue('0');
    fireEvent.change(holding, { target: { value: '20000' } });
    expect(holding).toHaveValue('20000');
    expect(screen.getByRole('slider', { name: 'Dividendes SASU' })).toHaveValue('50000');
  });

  it('renders shell controls: preset, timeline, what-if, layers, share', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /Simulateur de Flux/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('preset-select')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-bar')).toBeInTheDocument();
    expect(screen.getByTestId('what-if-sliders')).toBeInTheDocument();
    expect(screen.getByTestId('flow-canvas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Partager/i })).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Choisir un preset de structure/i),
    ).toHaveValue(FREELANCE_SASU_PRESET.id);
  });

  it('switches preset and resets timeline to the first step', () => {
    render(<App />);

    const timeline = screen.getByTestId('timeline-bar');
    fireEvent.click(within(timeline).getByRole('button', { name: /Étape suivante|Suiv/i }));
    expect(within(timeline).getByText(/Étape 2\//i)).toBeInTheDocument();

    const select = screen.getByTestId('preset-select');
    fireEvent.change(select, { target: { value: SASU_HOLDING_PRESET.id } });

    expect(select).toHaveValue(SASU_HOLDING_PRESET.id);
    expect(screen.getByTestId('flow-canvas')).toHaveAttribute(
      'data-preset',
      'sasu-holding',
    );
    expect(within(timeline).getByText(/Étape 1\//i)).toBeInTheDocument();
  });

  it('advances timeline via step jump buttons', () => {
    render(<App />);

    const timeline = screen.getByTestId('timeline-bar');
    const chargesBtn = within(timeline).getByRole('button', {
      name: /Aller à Charges/i,
    });
    fireEvent.click(chargesBtn);

    expect(within(timeline).getByText(/Étape 2\//i)).toBeInTheDocument();
    expect(chargesBtn).toHaveAttribute('aria-current', 'step');
  });

describe('guide 1→4', () => {
  it('se masque, s’en souvient au rechargement, et revient depuis la barre latérale', () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
    expect(screen.queryByLabelText('Comment utiliser le simulateur')).not.toBeInTheDocument();

    unmount();
    render(<App />);
    expect(screen.queryByLabelText('Comment utiliser le simulateur')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le guide' }));
    expect(screen.getByLabelText('Comment utiliser le simulateur')).toBeInTheDocument();
  });
});

describe('lien de partage vs brouillon local', () => {
  it('demande confirmation avant d’écraser un brouillon local, et respecte le refus', async () => {
    localStorage.setItem(
      'optimisator.simulation',
      JSON.stringify({
        state: { scenario: SASU_HOLDING_PRESET, whatIf: { caHt: 77_000 }, activeLayers: SASU_HOLDING_PRESET.activeLayers },
        version: 1,
      }),
    );
    const hash = buildHashShareUrl({ scenario: FULL_GROUP_PRESET, whatIf: {} }).split('#')[1]!;
    window.history.replaceState(null, '', `/#${hash}`);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(await screen.findByText(SASU_HOLDING_PRESET.name)).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    confirmSpy.mockRestore();
  });

  it('applique le lien une fois confirmé', async () => {
    localStorage.setItem(
      'optimisator.simulation',
      JSON.stringify({
        state: { scenario: SASU_HOLDING_PRESET, whatIf: { caHt: 77_000 }, activeLayers: SASU_HOLDING_PRESET.activeLayers },
        version: 1,
      }),
    );
    const hash = buildHashShareUrl({ scenario: FULL_GROUP_PRESET, whatIf: {} }).split('#')[1]!;
    window.history.replaceState(null, '', `/#${hash}`);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    expect(await screen.findByText(FULL_GROUP_PRESET.name)).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
});
