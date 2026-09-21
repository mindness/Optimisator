import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ENTITY_INPUT_FIELDS } from '@/core/scenarioWorkspace';
import { ENTITY_TYPE_LABELS, type EntityNodeData, type EntityType } from '@/core/types';

import { EditableEntityInputs } from './EditableEntityInputs';

/** xyflow requires node `data` to extend Record<string, unknown>. */
export type EntityNodePayload = EntityNodeData & {
  /** Injecté par FlowCanvas — atelier Architecture uniquement (raccourci de suppression). */
  onDelete?: () => void;
  /** Injecté par FlowCanvas — atelier Architecture uniquement (édition directe des paramètres saisis). */
  onPatchInput?: (key: string, value: number) => void;
  /** Injecté par FlowCanvas — atelier Architecture uniquement (renommage au double-clic). */
  onRename?: (label: string) => void;
} & Record<string, unknown>;

export type EntityFlowNode = Node<EntityNodePayload, string>;

/** Semantic role color per entity kind — carried by the node's dot, never its whole frame. */
export function entityBorderClass(entityType: EntityType): string {
  switch (entityType) {
    case 'sasu':
    case 'client':
      return 'bg-flow-cash';
    case 'holding_sas':
    case 'holding_sarl':
    case 'person':
      return 'bg-flow-div';
    case 'sci_is':
    case 'sci_ir':
    case 'bank':
      return 'bg-flow-vat';
    case 'tax_authority':
      return 'bg-flow-is';
    case 'urssaf':
      return 'bg-flow-social';
    default:
      return 'bg-border-strong';
  }
}

export type EntityNodeShellProps = {
  data: EntityNodeData & { onDelete?: () => void; onRename?: (label: string) => void };
  selected?: boolean;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
  /** Poignées en haut / en bas quand le schéma est posé en colonne (écran étroit). */
  sourcePosition?: Position;
  targetPosition?: Position;
};

/** Shared card shell: handles, semantic border, selection ring. */
export function EntityNodeShell({
  data,
  selected = false,
  subtitle,
  children,
  className = '',
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
}: EntityNodeShellProps) {
  const dot = entityBorderClass(data.entityType);
  const [renaming, setRenaming] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (renaming) { nameRef.current?.focus(); nameRef.current?.select(); } }, [renaming]);

  return (
    <article
      className={[
        'card min-w-[13rem] max-w-[17rem] px-3.5 py-3',
        selected ? 'border-accent ring-2 ring-accent/25' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-entity-type={data.entityType}
      data-selected={selected ? 'true' : 'false'}
    >
      <Handle
        type="target"
        position={targetPosition}
        className="!h-2.5 !w-2.5"
      />
      <header className="mb-2 flex items-start gap-2">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          {renaming && data.onRename ? (
            <input
              ref={nameRef}
              defaultValue={data.label}
              aria-label={`Nom de ${data.label}`}
              className="field nodrag nopan w-full py-0.5 text-sm font-semibold"
              onBlur={(event) => {
                const next = event.target.value.trim();
                // Un nom vide n'est pas un nom : on garde l'ancien.
                if (next && next !== data.label) data.onRename?.(next);
                setRenaming(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') { event.stopPropagation(); setRenaming(false); }
              }}
            />
          ) : (
            // `nopan` : sans lui, le double-clic zoome le canevas au lieu d'ouvrir le renommage.
            // Au clavier, le renommage reste accessible par l'accordéon « Sociétés et acteurs ».
            <h3
              className={`m-0 text-sm font-semibold leading-tight text-fg ${data.onRename ? 'nopan cursor-text' : ''}`.trim()}
              onDoubleClick={data.onRename ? () => setRenaming(true) : undefined}
              title={data.onRename ? 'Double-cliquer pour renommer' : undefined}
            >
              {data.label}
            </h3>
          )}
          {subtitle ? (
            <p className="m-0 mt-0.5 text-xs text-fg-muted">
              {subtitle}
            </p>
          ) : null}
        </div>
        {data.onDelete ? (
          <button
            type="button"
            onClick={data.onDelete}
            className="nodrag nopan -mr-1 -mt-1 shrink-0 rounded p-1 text-fg-muted hover:bg-negative-soft hover:text-negative"
            aria-label={`Supprimer ${data.label}`}
            title="Supprimer cette entité et ses flux"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
      </header>
      {children ? (
        <div className="flex flex-col gap-1 border-t border-border pt-2">{children}</div>
      ) : null}
      <Handle
        type="source"
        position={sourcePosition}
        className="!h-2.5 !w-2.5"
      />
    </article>
  );
}

/** Fallback / generic entity node (EURL, SARL, micro, EI, clients, vendors, banks…). */
export function EntityNode({ data, selected, sourcePosition, targetPosition }: NodeProps<EntityFlowNode>) {
  const editable = Boolean(data.onPatchInput && ENTITY_INPUT_FIELDS[data.entityType]);
  return (
    <EntityNodeShell data={data} selected={selected} sourcePosition={sourcePosition} targetPosition={targetPosition} subtitle={ENTITY_TYPE_LABELS[data.entityType]}>
      {editable ? <EditableEntityInputs data={data} /> : null}
    </EntityNodeShell>
  );
}
