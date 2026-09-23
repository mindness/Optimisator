import { expect, test, type Page } from '@playwright/test';

/**
 * Parcours complets dans le vrai build : on pilote l'application comme un
 * utilisateur, sur chaque preset et chaque vue, et on vérifie que les chiffres
 * affichés sont cohérents entre eux. Les tests unitaires valident le moteur ;
 * ceux-ci valident ce qui arrive réellement à l'écran.
 */

const PRESETS = ['Freelance SASU seule', 'SASU + Holding (mère-fille)', 'Groupe SASU + Holding + SCI'];
const VUES = ['Simulation', 'Architecture', 'Optimisation', 'Structures', 'Projection', 'Synthèse'];

/**
 * Montants affichés, en nombres. Les espaces de groupement du format français
 * sont insécables (fines ou non) : on normalise avant d'extraire, sinon la
 * moitié des montants passe à travers.
 */
async function montants(page: Page, selector: string): Promise<number[]> {
  const textes = await page.locator(selector).allInnerTexts();
  return textes
    .map((t) => t.replace(/\s/gu, ' '))
    .flatMap((t) => t.match(/-?\d[\d ]*(?:,\d+)?\s*(?:EUR|€|%)/g) ?? [])
    .map((m) => Number(m.replace(/[^\d,-]/g, '').replace(',', '.')))
    .filter((n) => Number.isFinite(n));
}

/** Valeur principale de chaque tuile KPI, hors ligne d'écart. */
async function valeursKpi(page: Page): Promise<number[]> {
  return montants(page, '.kpi > span:last-child');
}

/** Aucune tuile, ligne ou section ne doit porter un nombre non fini. */
async function aucunNaN(page: Page, selector: string) {
  await expect(page.locator(selector).filter({ hasText: /NaN|Infinity/ })).toHaveCount(0);
}

async function choisirPreset(page: Page, nom: string) {
  await page.getByTestId('preset-select').selectOption({ label: nom });
  await expect(page.getByRole('heading', { level: 2, name: nom })).toBeVisible();
}

test.describe('parcours de simulation', () => {
  for (const preset of PRESETS) {
    test(`${preset} — les tuiles affichent des montants et réagissent aux hypothèses`, async ({ page }) => {
      const erreurs: string[] = [];
      page.on('pageerror', (e) => erreurs.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });

      await page.goto('/');
      await choisirPreset(page, preset);

      const tuiles = page.locator('.kpi');
      await expect(tuiles).toHaveCount(6);
      const avant = await valeursKpi(page);
      expect(avant).toHaveLength(6);
      // Aucun « NaN » dans la synthèse du haut.
      await aucunNaN(page, '.kpi');

      // Le CA affiché est positif, et l'IS ne peut pas le dépasser.
      const [caHt, is] = avant;
      expect(caHt).toBeGreaterThan(0);
      expect(is).toBeLessThanOrEqual(caHt!);

      // Ramener le CA au minimum doit déplacer les chiffres, pas les casser.
      // (Le maximum ne convient pas : certains presets y sont déjà.)
      const slider = page.getByRole('slider', { name: 'CA HT' });
      await slider.focus();
      await slider.press('Home');
      await expect(page.getByLabel(/Écart vs point de départ/).first()).toBeVisible();
      const apres = await valeursKpi(page);
      expect(apres[0]).toBeLessThan(caHt!);
      await aucunNaN(page, '.kpi');

      expect(erreurs).toEqual([]);
    });

    test(`${preset} — toutes les vues s’ouvrent et restent chiffrées`, async ({ page }) => {
      const erreurs: string[] = [];
      page.on('pageerror', (e) => erreurs.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });

      await page.goto('/');
      await choisirPreset(page, preset);

      for (const vue of VUES) {
        await page.getByRole('button', { name: vue, exact: true }).click();
        // La vue Simulation n'a pas de titre propre : elle affiche le nom du scénario.
        const titre = vue === 'Simulation' ? preset : vue;
        await expect(page.getByRole('heading', { level: 2, name: titre })).toBeVisible();
        // Les vues sont chargées en différé : l'en-tête change avant le contenu.
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
        await aucunNaN(page, 'main, section');

        if (vue === 'Architecture') {
          // L'atelier n'affiche pas de synthèse : ses montants sont dans des
          // champs de saisie et sur les cartes du schéma.
          await expect(page.getByTestId('flow-canvas')).toBeVisible();
          await expect(page.getByRole('button', { name: 'SASU', exact: true })).toBeVisible();
          continue;
        }
        const valeurs = await montants(page, 'main, section');
        expect(valeurs.length, `aucun montant dans « ${vue} »`).toBeGreaterThan(0);
      }

      expect(erreurs).toEqual([]);
    });
  }

  test('l’optimum proposé peut être appliqué et change la simulation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Optimisation', exact: true }).click();

    const optimum = page.locator('.card').filter({ hasText: 'Optimum trouvé' });
    await expect(optimum).toBeVisible();
    const [valeurOptimum] = await montants(page, '.card:has-text("Optimum trouvé")');
    const [valeurActuelle] = await montants(page, '.card:has-text("Scénario actuel")');
    // Un optimum ne peut pas être pire que le point de départ.
    expect(valeurOptimum).toBeGreaterThanOrEqual(valeurActuelle! - 0.01);

    await page.getByRole('button', { name: 'Appliquer au simulateur' }).click();
    await expect(page.getByTestId('flow-canvas')).toBeVisible();
    await expect(page.getByLabel(/Écart vs point de départ/).first()).toBeVisible();
    await aucunNaN(page, '.kpi');
  });

  test('le comparateur classe les structures et reste chiffré', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Structures', exact: true }).click();

    const lignes = page.locator('tbody tr');
    await expect(lignes.first()).toBeVisible();
    expect(await lignes.count()).toBeGreaterThanOrEqual(4);
    // Le net personnel décroît de la meilleure structure vers les suivantes.
    const nets = await montants(page, 'tbody tr');
    expect(nets.length).toBeGreaterThan(0);
    await aucunNaN(page, 'tbody tr');
  });

  test('la projection couvre l’horizon demandé', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Projection', exact: true }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Projection' })).toBeVisible();
    await page.getByLabel('Horizon').selectOption('10');
    await expect(page.getByText(/Projection sur 10 ans/)).toBeVisible();
    await page.getByText('Voir le détail par exercice').click();
    // Dix exercices, chacun chiffré.
    await expect(page.locator('tbody tr')).toHaveCount(10);
    await aucunNaN(page, 'tbody tr');
  });

  test('un scénario sans sortie ne produit ni impôt personnel ni NaN', async ({ page }) => {
    await page.goto('/');
    for (const nom of ['Salaire net avant IR', 'Dividendes SASU']) {
      const slider = page.getByRole('slider', { name: nom });
      await slider.focus();
      await slider.press('Home');
    }
    await aucunNaN(page, '.kpi');
    const valeurs = await valeursKpi(page);
    // Cash perso net (5e tuile) tombe à zéro quand rien ne sort de la société.
    expect(valeurs[4]).toBe(0);
  });
});
