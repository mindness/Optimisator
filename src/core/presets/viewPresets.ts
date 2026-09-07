import type { FlowLayer } from '../types';

/** One-click thematic view over canvas layers (design §5.2 / prompt presets de vue). */
export type ViewPresetId = 'dirigeant' | 'comptable' | 'associe' | 'pedagogique';

export interface ViewPreset {
  id: ViewPresetId;
  label: string;
  description: string;
  /** Layers visible when this view is selected. */
  layers: readonly FlowLayer[];
}

export const VIEW_DIRIGEANT: ViewPreset = {
  id: 'dirigeant',
  label: 'Vue Dirigeant',
  description: 'Trésorerie disponible par entité + cash personnel net après impôts.',
  layers: ['treasury', 'tax', 'social'],
};

export const VIEW_COMPTABLE: ViewPreset = {
  id: 'comptable',
  label: 'Vue Comptable',
  description: 'TVA, assiettes de cotisations et calculs d’IS.',
  layers: ['vat', 'tax', 'social'],
};

export const VIEW_ASSOCIE: ViewPreset = {
  id: 'associe',
  label: 'Vue Associé / Investisseur',
  description: 'Dividendes, CCA, détention et valorisation du groupe.',
  layers: ['treasury', 'tax', 'legal'],
};

export const VIEW_PEDAGOGIQUE: ViewPreset = {
  id: 'pedagogique',
  label: 'Vue Pédagogique',
  description: 'Affichage épuré : gros flux lisibles, calques essentiels.',
  layers: ['treasury', 'tax'],
};

export const VIEW_PRESETS = [
  VIEW_DIRIGEANT,
  VIEW_COMPTABLE,
  VIEW_ASSOCIE,
  VIEW_PEDAGOGIQUE,
] as const;
