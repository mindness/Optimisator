/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { annotate } from '../Glossary';

afterEach(cleanup);

describe('annotate', () => {
  it('enveloppe les sigles connus avec leur définition, sans toucher aux mots qui les contiennent', () => {
    render(<p>{annotate('Cash après IS, URSSAF et PFU — VISION du foyer')}</p>);

    expect(screen.getByText('IS').tagName).toBe('ABBR');
    expect(screen.getByText('IS')).toHaveAttribute('title', expect.stringContaining('Impôt sur les sociétés'));
    // Le taux affiché vient du moteur : 12,8 % + 18,6 %.
    expect(screen.getByText('PFU')).toHaveAttribute('title', expect.stringContaining('31,4'));
    // « VISION » contient « IS » : la frontière de mot l'épargne.
    expect(screen.getAllByText(/./, { selector: 'abbr' })).toHaveLength(3);
  });

  it('rend le texte tel quel quand il ne contient aucun sigle', () => {
    expect(annotate('Cash perso net')).toBe('Cash perso net');
  });
});
