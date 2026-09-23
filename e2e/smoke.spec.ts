import { expect, test } from '@playwright/test';

test('le simulateur charge, recalcule et ne lève aucune erreur', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Simulateur de Flux/i })).toBeVisible();
  await expect(page.getByTestId('flow-canvas')).toBeVisible();
  await expect(page.getByTestId('rates-as-of')).toContainText(/\d{2}\/\d{2}\/\d{4}/);

  // Un What-If doit déplacer un KPI : l'écart au point de départ apparaît.
  await expect(page.getByLabel('Aucun écart vs point de départ').first()).toBeVisible();
  const slider = page.getByRole('slider', { name: 'CA HT' });
  await slider.focus();
  await slider.press('End');
  await expect(page.getByLabel(/Écart vs point de départ/).first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('les informations légales sont accessibles depuis le pied de page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Mentions légales/ }).click();
  await expect(page).toHaveURL(/\/legal$/);
  await expect(page.getByRole('heading', { name: 'Conditions générales d’utilisation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Politique de confidentialité' })).toBeVisible();
});

test('les mentions légales identifient l’hébergeur, seule mention due', async ({ page }) => {
  // Régime non professionnel (LCEN art. 1-1, II) : l'hébergeur est la seule
  // identité à publier — mais elle, elle est obligatoire.
  await page.goto('/legal');
  const mentions = page.locator('#mentions');
  await expect(mentions).toContainText('Cloudflare, Inc.');
  await expect(mentions).not.toContainText('[à compléter]');
});
