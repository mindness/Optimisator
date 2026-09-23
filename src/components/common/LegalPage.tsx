import type { ReactNode } from 'react';

import { DisclaimerBanner } from './DisclaimerBanner';
import { RATES_OLDEST_SOURCE, RATES_VERIFIED_ON, formatRatesDate } from '@/core/legal/ratesFreshness';

/**
 * Identité de l'éditeur — LCEN (loi n° 2004-575) **article 1-1**, et non plus
 * l'article 6 III : l'obligation a été déplacée, l'article 6 s'y réfère
 * désormais (IV-B).
 *
 * Deux régimes :
 *
 * - `mode: 'non_professionnel'` (art. 1-1, II) — un particulier qui publie sans
 *   activité professionnelle « peut ne tenir à la disposition du public, pour
 *   préserver son anonymat, que le nom […] et l'adresse du fournisseur de
 *   services d'hébergement, sous réserve d'avoir communiqué à ce fournisseur
 *   les éléments d'identification personnelle mentionnés au I ». C'est le cas
 *   dès lors que le compte chez l'hébergeur est ouvert à votre vraie identité.
 *   Seuls `host` et `hostAddress` sont alors requis.
 *
 * - `mode: 'professionnel'` (art. 1-1, I) — dès que l'outil est exploité à
 *   titre professionnel (facturation, publicité, activité commerciale), il faut
 *   publier nom, prénoms, domicile et téléphone (ou dénomination, siège et
 *   numéro RCS/RNE pour une société), le directeur de la publication, et
 *   l'hébergeur avec son téléphone.
 *
 * `hostAddress` : reprendre l'adresse exacte figurant sur les mentions légales
 * de l'hébergeur retenu (Cloudflare Pages, Netlify, GitHub Pages…), sans la
 * reconstituer de mémoire.
 */
export const LEGAL_IDENTITY = {
  mode: 'non_professionnel' as 'non_professionnel' | 'professionnel',
  host: '',
  hostAddress: '',
  /** Facultatif : une adresse de contact reste utile même sous le régime anonyme. */
  contactEmail: '',
  // Régime professionnel uniquement (art. 1-1, I).
  editor: '',
  legalForm: '',
  address: '',
  siren: '',
  phone: '',
  publicationDirector: '',
  hostPhone: '',
};

const v = (value: string) => value || '[à compléter]';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="card space-y-3 p-5 text-sm leading-relaxed text-fg-muted">
      <h2 id={`${id}-title`} className="m-0 text-base font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

export function LegalPage() {
  const id = LEGAL_IDENTITY;
  return (
    <div className="min-h-dvh bg-canvas text-fg">
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <header className="space-y-2">
          <a href="/" className="text-sm text-fg-muted underline underline-offset-2 hover:text-fg">← Retour au simulateur</a>
          <h1 className="m-0 text-2xl font-semibold">Informations légales</h1>
          <nav aria-label="Sections" className="flex flex-wrap gap-3 text-sm">
            <a href="#mentions" className="underline underline-offset-2">Mentions légales</a>
            <a href="#cgu" className="underline underline-offset-2">Conditions d’utilisation</a>
            <a href="#confidentialite" className="underline underline-offset-2">Confidentialité</a>
          </nav>
        </header>

        <Section id="mentions" title="Mentions légales">
          {id.mode === 'professionnel' ? (
            <p className="m-0">
              Éditeur : {v(id.editor)} — {v(id.legalForm)}, {v(id.address)}. SIREN : {v(id.siren)}.
              Téléphone : {v(id.phone)}. Directeur de la publication : {v(id.publicationDirector)}.
              Contact : {v(id.contactEmail)}.
            </p>
          ) : (
            <p className="m-0">
              Ce service est édité à titre non professionnel par un particulier, qui conserve
              l’anonymat vis-à-vis du public dans les conditions prévues au II de l’article 1-1 de la
              loi n° 2004-575 du 21 juin 2004. Ses éléments d’identification ont été communiqués à
              l’hébergeur ci-dessous, tenu au secret professionnel et devant les transmettre à
              l’autorité judiciaire qui les demande.
              {id.contactEmail ? <> Contact : {id.contactEmail}.</> : null}
            </p>
          )}
          <p className="m-0">
            Hébergeur : {v(id.host)}, {v(id.hostAddress)}
            {id.mode === 'professionnel' ? <>, {v(id.hostPhone)}</> : null}.
          </p>
          <p className="m-0">
            Droit de réponse : toute personne nommée ou désignée dans ce service peut l’exercer dans
            les trois mois, auprès de l’hébergeur ci-dessus (art. 1-1, III de la même loi).
          </p>
        </Section>

        <Section id="cgu" title="Conditions générales d’utilisation">
          <p className="m-0">
            <strong className="text-fg">Objet.</strong> Le Simulateur de Flux d’Entreprise est un outil pédagogique gratuit qui
            modélise, à partir des hypothèses saisies par l’utilisateur, les flux financiers, fiscaux et sociaux d’une
            structure d’entreprise française. L’utiliser vaut acceptation des présentes conditions.
          </p>
          <p className="m-0">
            <strong className="text-fg">Absence de conseil.</strong> Les résultats sont des estimations simplifiées. Ils ne
            constituent ni un conseil fiscal, juridique, comptable ou financier, ni une consultation au sens de la loi
            n° 71-1130 du 31 décembre 1971, ni une recommandation d’investissement. Toute décision doit être validée par un
            professionnel habilité (expert-comptable, avocat, notaire) au vu de la situation réelle de l’utilisateur.
          </p>
          <p className="m-0">
            <strong className="text-fg">Barèmes.</strong> Les taux et seuils proviennent de sources publiques (Légifrance,
            BOFiP, URSSAF) citées dans l’outil, chacun avec sa date de vérification et son statut (« vérifié » ou
            « hypothèse »). Dernière revue d’ensemble : {formatRatesDate(RATES_VERIFIED_ON)} ; la source légale la plus ancienne encore utilisée date du {formatRatesDate(RATES_OLDEST_SOURCE)}. La législation évolue ; aucune
            garantie d’exactitude, d’exhaustivité ou d’actualité n’est donnée.
          </p>
          <p className="m-0">
            <strong className="text-fg">Responsabilité.</strong> L’outil est fourni « en l’état ». Dans les limites permises
            par la loi, l’éditeur ne saurait être tenu responsable des décisions prises sur la base des simulations, ni des
            dommages indirects, pertes financières ou redressements qui en résulteraient. L’utilisateur reste seul
            responsable des données qu’il saisit et de l’usage des résultats.
          </p>
          <p className="m-0">
            <strong className="text-fg">Disponibilité et droit applicable.</strong> Le service peut être modifié ou interrompu
            sans préavis. Les présentes conditions sont soumises au droit français.
          </p>
        </Section>

        <Section id="confidentialite" title="Politique de confidentialité">
          <p className="m-0">
            <strong className="text-fg">Vos scénarios restent chez vous.</strong> Il n’y a ni compte ni base de données
            d’utilisateurs. Les schémas sont calculés et enregistrés dans votre navigateur (stockage local) ; vous pouvez
            les effacer à tout moment en vidant les données du site. Un lien de partage long contient le scénario dans la
            partie de l’adresse située après « # », que le navigateur ne transmet jamais au serveur.
          </p>
          <p className="m-0">
            <strong className="text-fg">Liens courts.</strong> Si vous créez un lien court, le contenu du scénario (montants
            et structure, sans donnée d’identité demandée) est enregistré chez l’hébergeur pour être relu par toute
            personne disposant du lien. N’y saisissez pas de nom réel si vous ne souhaitez pas le partager.
          </p>
          <p className="m-0">
            <strong className="text-fg">Mesure d’audience et erreurs.</strong> Le site ne dépose aucun cookie et aucun
            traceur publicitaire. Lorsqu’elles sont activées, la mesure d’audience (Plausible, sans cookie, données
            agrégées) et la remontée d’erreurs techniques (Sentry) ne reçoivent jamais le contenu de vos scénarios :
            la partie de l’adresse qui le contient est retirée avant tout envoi.
          </p>
          <p className="m-0">
            <strong className="text-fg">Vos droits.</strong> Conformément au RGPD, vous pouvez exercer vos droits d’accès,
            de rectification et d’effacement en écrivant à {v(id.contactEmail)}, et saisir la CNIL (cnil.fr).
          </p>
        </Section>

        <DisclaimerBanner />
      </main>
    </div>
  );
}
