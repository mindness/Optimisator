import { useState } from 'react';
import type { ScenarioState } from '@/core/types';
import { newId, ownershipIssues } from '@/core/scenarioWorkspace';

type Ownership = NonNullable<ScenarioState['ownerships']>[number];
type Nature = NonNullable<Ownership['nature']>;

const control = 'min-h-11 w-full card bg-canvas px-2 text-sm text-fg';
const NATURE_LABELS: Record<Nature, string> = {
  pleine_propriete: 'Pleine propriété',
  usufruit: 'Usufruit',
  nue_propriete: 'Nue-propriété',
};

export function OwnershipEditor({ scenario, onChange }: { scenario: ScenarioState; onChange: (scenario: ScenarioState) => void }) {
  const [ownerId, setOwnerId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [percent, setPercent] = useState(100);
  const [nature, setNature] = useState<Nature>('pleine_propriete');
  const [dureeAnnees, setDureeAnnees] = useState<number | ''>('');
  const [acquisitionPrice, setAcquisitionPrice] = useState<number | ''>('');
  const companies = scenario.entities.filter((entity) => ['sasu', 'holding_sas', 'holding_sarl', 'sci_is', 'sci_ir'].includes(entity.entityType));
  const owners = scenario.entities.filter((entity) => entity.entityType === 'person' || companies.some((company) => company.id === entity.id));
  const owner = owners.find((entity) => entity.id === ownerId)?.id ?? owners[0]?.id ?? '';
  const company = companies.find((entity) => entity.id === companyId)?.id ?? companies.find((entity) => entity.id !== owner)?.id ?? '';
  const demembre = nature !== 'pleine_propriete';
  const candidate: Ownership = {
    id: 'new-ownership',
    ownerId: owner,
    companyId: company,
    percent,
    ...(demembre ? { nature } : {}),
    ...(nature === 'usufruit' && dureeAnnees !== '' ? { dureeAnnees } : {}),
    ...(nature === 'usufruit' && acquisitionPrice !== '' ? { acquisitionPrice } : {}),
  };
  const next = { ...scenario, ownerships: [...(scenario.ownerships ?? []), candidate] };
  const issues = ownershipIssues(next);
  const label = (id: string) => scenario.entities.find((entity) => entity.id === id)?.label ?? id;
  return <fieldset className="space-y-2 card p-3">
    <legend>Détention du capital</legend>
    <p className="text-xs text-fg-muted">Pointillés = capital, pas de cash. Les parts non renseignées restent inconnues. Ces liens ne valident pas le régime mère-fille.</p>
    <label className="block text-sm">Associé<select className={control} value={owner} onChange={(event) => setOwnerId(event.target.value)}>{owners.map((entity) => <option key={entity.id} value={entity.id}>{entity.label}</option>)}</select></label>
    <label className="block text-sm">Société détenue<select className={control} value={company} onChange={(event) => setCompanyId(event.target.value)}><option value="">Choisir</option>{companies.map((entity) => <option key={entity.id} value={entity.id}>{entity.label}</option>)}</select></label>
    <label className="block text-sm">Capital détenu (%)<input className={control} type="number" min="0.01" max="100" step="0.01" value={Number.isFinite(percent) ? percent : ''} onChange={(event) => setPercent(event.target.valueAsNumber)} /></label>
    <label className="block text-sm">Nature de la détention<select className={control} value={nature} onChange={(event) => setNature(event.target.value as Nature)}>{(Object.keys(NATURE_LABELS) as Nature[]).map((key) => <option key={key} value={key}>{NATURE_LABELS[key]}</option>)}</select></label>
    {nature === 'usufruit' && <>
      <label className="block text-sm">Usufruit temporaire — durée (années)<input className={control} type="number" min="1" step="1" value={dureeAnnees} placeholder="vide = usufruit viager" onChange={(event) => setDureeAnnees(Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : '')} /></label>
      <label className="block text-sm">Prix payé pour l’usufruit (€)<input className={control} type="number" min="0" step="0.01" value={acquisitionPrice} placeholder="base d’amortissement chez un usufruitier à l’IS" onChange={(event) => setAcquisitionPrice(Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : '')} /></label>
      <p className="m-0 text-xs text-fg-muted">Usufruit à durée fixe : 23 % de la pleine propriété par période de dix ans entamée (CGI art. 669, II). Prix à valider par un expert indépendant ; l’abus de droit à but principalement fiscal (LPF art. L. 64 A) n’est pas arbitré ici.</p>
    </>}
    <button className={control} disabled={issues.length > 0} onClick={() => onChange({ ...next, ownerships: [...(scenario.ownerships ?? []), { ...candidate, id: newId() }] })}>Ajouter la détention</button>
    {issues.length > 0 && <p className="text-xs text-fg-muted">{issues.join(' ')}</p>}
    <ul className="space-y-2">{(scenario.ownerships ?? []).map((link) => <li key={link.id} className="border-t border-border pt-2 text-sm">
      {label(link.ownerId)} → {label(link.companyId)} : {link.percent} % {NATURE_LABELS[link.nature ?? 'pleine_propriete'].toLowerCase()}{link.dureeAnnees ? ` sur ${link.dureeAnnees} ans` : ''}
      <button className={control} aria-label={`Supprimer détention ${label(link.ownerId)} vers ${label(link.companyId)}`} onClick={() => onChange({ ...scenario, ownerships: scenario.ownerships?.filter((item) => item.id !== link.id) })}>Supprimer la détention</button>
    </li>)}</ul>
  </fieldset>;
}
