/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditableAmount } from '../EditableAmount';

afterEach(() => {
  cleanup();
});

describe('EditableAmount', () => {
  it('shows the amount as a button, then a number input on click', () => {
    render(<EditableAmount label="CA HT annuel" value={120_000} onChange={() => {}} />);

    const button = screen.getByRole('button', { name: /CA HT annuel/ });
    expect(button).toHaveTextContent('120');
    fireEvent.click(button);
    expect(screen.getByRole('spinbutton', { name: 'CA HT annuel' })).toHaveValue(120_000);
  });

  it('commits the new value on blur and clamps negatives to 0', () => {
    const onChange = vi.fn();
    render(<EditableAmount label="CA HT annuel" value={120_000} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /CA HT annuel/ }));
    const input = screen.getByRole('spinbutton', { name: 'CA HT annuel' });
    fireEvent.change(input, { target: { value: '-50' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('commits on Enter and discards on Escape without calling onChange', () => {
    const onChange = vi.fn();
    render(<EditableAmount label="CA HT annuel" value={120_000} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /CA HT annuel/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'CA HT annuel' }), { target: { value: '150000' } });
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'CA HT annuel' }), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(150_000);

    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /CA HT annuel/ }));
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'CA HT annuel' }), { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /CA HT annuel/ })).toBeInTheDocument();
  });
});
