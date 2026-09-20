import { useRef } from 'react';
import type { WhatIfInputs } from '@/core/engine';
import type { ScenarioState } from '@/core/types';
import { exportScenarioFile, parseScenarioFile, scenarioFileName } from '@/core/scenarioWorkspace';

const button = 'inline-flex min-h-11 items-center justify-center border border-border bg-surface px-3 text-sm font-medium text-fg hover:border-border-strong';

/** Export / import d'un schéma en fichier `.json` : aucun serveur, aucun compte. */
export function ScenarioFileButtons({ scenario, whatIf, onImport, onMessage }: {
  scenario: ScenarioState;
  whatIf: WhatIfInputs;
  onImport: (scenario: ScenarioState, whatIf: WhatIfInputs) => void;
  onMessage?: (message: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  function download() {
    const blob = new Blob([exportScenarioFile(scenario, whatIf)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = scenarioFileName(scenario);
    link.click();
    URL.revokeObjectURL(url);
    onMessage?.(`Schéma exporté : ${link.download}`);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseScenarioFile(await file.text());
      onImport(parsed.scenario, parsed.whatIf);
      onMessage?.(`Schéma importé : ${parsed.scenario.name}`);
    } catch {
      onMessage?.('Fichier illisible : attendu un export .optimisator.json ou un scénario JSON valide.');
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <>
      <button type="button" className={button} onClick={download}>Exporter (.json)</button>
      <button type="button" className={button} onClick={() => fileInput.current?.click()}>Importer (.json)</button>
      <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" aria-label="Importer un schéma JSON"
        data-testid="scenario-file-input" onChange={(event) => void upload(event.target.files?.[0])} />
    </>
  );
}
