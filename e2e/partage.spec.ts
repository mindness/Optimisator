import lzString from 'lz-string';
import { expect, test } from '@playwright/test';

/** Lit la valeur d'une tuile KPI par son libellé. */
async function kpi(page: import('@playwright/test').Page, label: string) {
  return page.locator('.kpi').filter({ hasText: label }).first().innerText();
}

test('un lien de partage rouvre la simulation avec les mêmes chiffres', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Ouvrir un lien par-dessus un brouillon demande confirmation.
  page.on('dialog', (dialog) => void dialog.accept());

  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'CA HT' });
  await slider.focus();
  await slider.press('End');
  await expect(page.getByLabel(/Écart vs point de départ/).first()).toBeVisible();
  const before = await kpi(page, 'Cash perso net');

  await page.getByRole('button', { name: 'Partager' }).click();
  await page.getByRole('button', { name: /Copier le lien/ }).last().click();
  await expect(page.getByTestId('share-url-preview')).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain('#s=');

  // Repartir d'une page vierge, puis rouvrir le lien : mêmes chiffres.
  // `goto` vers un simple changement de hash ne recharge pas la page — et c'est
  // au montage que le lien est lu : sans `reload`, ce test ne vérifierait rien.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await page.reload();
  await expect(page.getByTestId('flow-canvas')).toBeVisible();
  expect(await kpi(page, 'Cash perso net')).toBe(before);
});

test('un lien aux hypothèses corrompues n’affiche jamais NaN', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto('/');
  // Le brouillon n'est écrit qu'à la première modification : on en provoque une
  // pour récupérer un scénario valide à réinjecter dans le lien.
  const slider = page.getByRole('slider', { name: 'CA HT' });
  await slider.focus();
  await slider.press('End');
  await expect(page.getByLabel(/Écart vs point de départ/).first()).toBeVisible();

  // Le contenu du hash est fourni par l'émetteur du lien : il n'est pas de confiance.
  const scenario = await page.evaluate(() => {
    const raw = localStorage.getItem('optimisator.simulation');
    return JSON.parse(raw ?? '{}')?.state?.scenario;
  });
  expect(scenario).toBeTruthy();
  const payload = { scenario, whatIf: { caHt: 'abc', parts: null, situation: 'divorcé' } };

  await page.goto(`/#s=${lzString.compressToEncodedURIComponent(JSON.stringify(payload))}`);
  await page.reload(); // cf. ci-dessus : le hash seul ne remonte pas l'application.
  await expect(page.getByTestId('flow-canvas')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NaN');
  await expect(page.locator('.kpi').first()).toContainText(/\d/);
});
