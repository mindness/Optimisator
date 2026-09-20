/**
 * Cached legal catalogue for the flow inspector.
 * Sourced offline (OpenLegi batch) — never call MCP from the runtime path.
 */
import legalNotesCatalog from './legalNotes.json';
import type { FlowCategory, SourcedRateStatus } from '@/core/types';

export type LegalAlertSeverity = 'danger' | 'warning' | 'info';

export type LegalAlert = {
  code: string;
  label: string;
  severity: LegalAlertSeverity;
  detail: string;
};

export type LegalArticle = {
  ref: string;
  label: string;
  url: string | null;
  status: SourcedRateStatus;
  asOf: string;
  summary: string;
};

export type LegalNote = {
  id: string;
  title: string;
  summary: string;
  articles: LegalArticle[];
  alerts: LegalAlert[];
};

type CatalogShape = {
  meta: { asOf: string; source: string };
  notes: Record<string, LegalNote>;
};

const catalog = legalNotesCatalog as CatalogShape;

export function getLegalNote(id: string | undefined | null): LegalNote | undefined {
  if (!id) return undefined;
  return catalog.notes[id];
}

export function listLegalNotes(): LegalNote[] {
  return Object.values(catalog.notes);
}

/** Resolve note id(s) for a flow: explicit legalNoteId + category heuristics. */
export function resolveLegalNoteIds(flow: {
  category: FlowCategory;
  legalNoteId?: string;
  warning?: string;
}): string[] {
  const ids: string[] = [];
  if (flow.legalNoteId) ids.push(flow.legalNoteId);

  if (
    flow.category === 'cca_advance' ||
    flow.warning?.toLowerCase().includes('cca')
  ) {
    ids.push('cca-debiteur', 'cca-interets');
  }

  // Chaque convention porte ses propres articles ; la note générique reste pour
  // les avertissements libres qui mentionnent l'acte anormal de gestion.
  if (flow.category === 'management_fees') ids.push('management-fees');
  if (flow.category === 'rent') ids.push('bail-sci');
  if (flow.warning?.toLowerCase().includes('anormal')) ids.push('acte-anormal-gestion');

  if (
    flow.category === 'dividend' &&
    !flow.legalNoteId &&
    !ids.includes('mere-fille-art-145')
  ) {
    ids.push('pfu-dividendes');
  }

  return [...new Set(ids)];
}

export function resolveLegalNotesForFlow(flow: {
  category: FlowCategory;
  legalNoteId?: string;
  warning?: string;
}): LegalNote[] {
  return resolveLegalNoteIds(flow)
    .map((id) => getLegalNote(id))
    .filter((n): n is LegalNote => n !== undefined);
}

export function collectAlerts(notes: LegalNote[]): LegalAlert[] {
  const seen = new Set<string>();
  const alerts: LegalAlert[] = [];
  for (const note of notes) {
    for (const alert of note.alerts) {
      if (seen.has(alert.code)) continue;
      seen.add(alert.code);
      alerts.push(alert);
    }
  }
  return alerts;
}

export const LEGAL_CATALOG_AS_OF = catalog.meta.asOf;
