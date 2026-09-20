/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LayerSwitcher } from '../LayerSwitcher';
import { VIEW_COMPTABLE } from '@/core/presets';

afterEach(cleanup);

describe('LayerSwitcher', () => {
  it('applies a view preset in one click and marks it as active', () => {
    const onSelectLayers = vi.fn();
    const { rerender } = render(
      <LayerSwitcher activeLayers={['treasury']} onToggle={() => {}} onSelectLayers={onSelectLayers} />,
    );

    fireEvent.click(screen.getByRole('button', { name: VIEW_COMPTABLE.label }));
    expect(onSelectLayers).toHaveBeenCalledWith(VIEW_COMPTABLE.layers);

    rerender(
      <LayerSwitcher activeLayers={VIEW_COMPTABLE.layers} onToggle={() => {}} onSelectLayers={onSelectLayers} />,
    );
    expect(screen.getByRole('button', { name: VIEW_COMPTABLE.label })).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides the presets when no handler is given', () => {
    render(<LayerSwitcher activeLayers={['treasury']} onToggle={() => {}} />);
    expect(screen.queryByTestId('view-presets')).toBeNull();
  });
});
