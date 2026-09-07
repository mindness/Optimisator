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
