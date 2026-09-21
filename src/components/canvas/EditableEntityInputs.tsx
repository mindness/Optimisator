import { EditableAmount } from '@/components/common/EditableAmount';
import { ENTITY_INPUT_FIELDS, ENTITY_INPUT_FIELD_LABELS } from '@/core/scenarioWorkspace';
import type { EntityNodeData } from '@/core/types';

/**
 * Paramètres saisis (CA, charges, capital…) affichés en édition directe sur la carte —
 * atelier Architecture uniquement. `onPatchInput` absent → rien (mode Simulation, lecture seule).
 */
export function EditableEntityInputs({ data }: { data: EntityNodeData & { onPatchInput?: (key: string, value: number) => void } }) {
  const keys = ENTITY_INPUT_FIELDS[data.entityType];
  if (!keys || !data.onPatchInput) return null;
  const onPatchInput = data.onPatchInput;

  return (
    <>
      {keys.map((key) => (
        <EditableAmount
          key={key}
          label={ENTITY_INPUT_FIELD_LABELS[key] ?? key}
          value={data.inputs?.[key] ?? 0}
          onChange={(value) => onPatchInput(key, value)}
        />
      ))}
    </>
  );
}
