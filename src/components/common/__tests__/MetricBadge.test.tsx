/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { formatEuro, MetricBadge } from '../MetricBadge';

describe('formatEuro', () => {
  it('formats with non-breaking space and euro sign (fr-FR)', () => {
    const formatted = formatEuro(124_500);

    expect(formatted).toContain('€');
    expect(formatted).toMatch(/124/);
    expect(formatted).toMatch(/500/);
    // fr-FR currency uses NBSP (U+00A0) and/or NNBSP (U+202F)
    expect(/[\u00A0\u202F]/.test(formatted)).toBe(true);
  });
});

describe('MetricBadge', () => {
  it('renders monetary amount with tabular-nums class and FR formatting', () => {
    render(<MetricBadge amount={124_500} label="CA" tone="cash" />);

    const amount = screen.getByText((_, node) => {
      const text = node?.textContent ?? '';
      return (
        node?.tagName === 'SPAN' &&
        text.includes('€') &&
        text.includes('124') &&
        text.includes('500') &&
        (node as HTMLElement).classList.contains('font-amount')
      );
    });

    expect(amount).toBeTruthy();
    expect(amount.textContent).toMatch(/[\u00A0\u202F]/);
    expect(screen.getByText('CA')).toBeInTheDocument();
  });
});
