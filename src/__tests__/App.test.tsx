/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import App from '@/App';
import { FREELANCE_SASU_PRESET, SASU_HOLDING_PRESET } from '@/core/presets';
import { resetSimulationStoreForTests } from '@/hooks/useSimulation';

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
});

describe('App assembly', () => {
  it.each(['Kbis', 'Liasse', 'Ticket'])('returns from the %s preview without losing inputs', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('slider', { name: 'CA HT' }), { target: { value: '150000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kbis' }));
    expect(screen.getByText(/Maquette visuelle avec données fictives/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Simulation', exact: true }));
    expect(screen.getByTestId('flow-canvas')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'CA HT' })).toHaveValue('150000');
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
});
