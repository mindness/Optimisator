import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ReactNode } from 'react';

import type { EntityNodeData, EntityType } from '@/core/types';

/** xyflow requires node `data` to extend Record<string, unknown>. */
export type EntityNodePayload = EntityNodeData & Record<string, unknown>;

export type EntityFlowNode = Node<EntityNodePayload, string>;

/** Semantic border accent per entity kind (design tokens Emerald/Cyan/…). */
export function entityBorderClass(entityType: EntityType): string {
  switch (entityType) {
    case 'sasu':
      return 'border-flow-cash';
    case 'holding_sas':
    case 'holding_sarl':
      return 'border-flow-div';
    case 'sci_is':
    case 'sci_ir':
      return 'border-flow-vat';
    case 'person':
      return 'border-flow-div';
    case 'tax_authority':
      return 'border-flow-is';
    case 'urssaf':
      return 'border-flow-social';
    case 'client':
      return 'border-flow-cash';
    case 'vendor':
      return 'border-border-strong';
    case 'bank':
      return 'border-flow-vat';
    default:
      return 'border-border-strong';
  }
}

export type EntityNodeShellProps = {
  data: EntityNodeData;
  selected?: boolean;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
};

/** Shared card shell: handles, semantic border, selection ring. */
export function EntityNodeShell({
  data,
  selected = false,
  subtitle,
  children,
  className = '',
}: EntityNodeShellProps) {
  const border = entityBorderClass(data.entityType);

  return (
    <article
      className={[
        'min-w-[11rem] max-w-[15rem] bg-surface px-3 py-2.5 shadow-sm',
        'border-2',
        border,
        selected ? 'ring-2 ring-focus-ring ring-offset-2 ring-offset-canvas' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-entity-type={data.entityType}
      data-selected={selected ? 'true' : 'false'}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-border-strong !bg-surface"
      />
      <header className="mb-2">
        <h3 className="m-0 text-sm font-semibold leading-tight text-fg">{data.label}</h3>
        {subtitle ? (
          <p className="m-0 mt-0.5 text-xs font-medium uppercase tracking-wide text-fg-muted">
            {subtitle}
          </p>
        ) : null}
      </header>
      {children ? (
        <div className="flex flex-col gap-1.5">{children}</div>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-border-strong !bg-surface"
      />
    </article>
  );
}

/** Fallback / generic entity node (clients, vendors, banks). */
export function EntityNode({ data, selected }: NodeProps<EntityFlowNode>) {
  return (
    <EntityNodeShell data={data} selected={selected} subtitle={data.entityType} />
  );
}
