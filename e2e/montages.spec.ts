import { expect, test } from '@playwright/test';

/**
 * Phases du plan « exhaustivité des montages » qui touchent l'UI : l'axe des
 * exercices dans Projection (P0) et les paramètres de montage dans Architecture
 * (P2 emprunt, P3/P4 cession et apport, P5 démembrement, P6 animatrice).
 */
test('la projection expose un axe des exercices distinct de la timeline', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Projection' }).click();

  const exercise = page.getByLabel('Exercice lu');
  await expect(exercise).toBeVisible();
  const readout = page.locator('p[aria-live="polite"]');
  await expect(readout).toContainText('déficit reporté');

  const options = await exercise.locator('option').allTextContents();
  await exercise.selectOption(options[0]!);
  await expect(readout).toContainText(`Exercice ${options[0]}`);

  // Le report d'un exercice à l'autre est lisible dans le détail.
  await page.getByText('Voir le détail par exercice').click();
  await expect(page.getByRole('columnheader', { name: 'Dette restante' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('l’atelier propose les paramètres de montage et la checklist animatrice', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Architecture' }).click();

  // P6 : une holding pure annonce son absence de droit à déduction ; cochée, elle liste ses preuves.
  await page.getByRole('button', { name: 'Holding (SAS)' }).click();
  // Chaque carte contient un sélecteur de type : filtrer sur le résumé, pas sur tout le contenu.
  const holding = page.getByTestId('entity-card')
    .filter({ has: page.locator('summary', { hasText: 'Holding (SAS)' }) })
    .first();
  await holding.locator('summary').click();
  await expect(holding.getByText(/aucun droit à déduction de TVA/)).toBeVisible();
  await holding.getByLabel(/Holding animatrice/).check();
  await expect(holding.getByText(/Convention d’animation écrite/)).toBeVisible();

  // P5 : la détention porte une nature, plus seulement un pourcentage.
  await page.getByText('Détentions', { exact: true }).click();
  await expect(page.getByLabel('Nature de la détention')).toBeVisible();
});
