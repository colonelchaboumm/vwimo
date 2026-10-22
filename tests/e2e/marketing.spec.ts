import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
async function nav(page: Page, name: string) {
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toBeVisible();
});
async function preference(page: Page, state: string) {
  await page
    .getByRole("button", { name: "Préférences newsletter", exact: true })
    .click();
  await page
    .getByLabel("Rechercher un contact newsletter", { exact: true })
    .fill("Newsletter E2E");
  await page
    .getByLabel("Contact newsletter", { exact: true })
    .selectOption({ label: "Newsletter E2E · nl-e2e@example.com" });
  await page
    .getByRole("button", {
      name: "Gérer la préférence newsletter",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Préférence newsletter", { exact: true })
    .selectOption(state);
  await page
    .getByLabel("Justification de la préférence newsletter", { exact: true })
    .fill("Préférence fictive documentée pour le parcours E2E.");
  await page
    .getByRole("button", {
      name: "Enregistrer la préférence newsletter",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test("newsletter : accord spécifique, prévisualisation, confirmation, EML puis retrait", async ({
  page,
}) => {
  await nav(page, "Vendeurs");
  await page
    .getByRole("button", { name: "Nouveau contact", exact: true })
    .click();
  await page
    .getByLabel("Nom complet *", { exact: true })
    .fill("Newsletter E2E");
  await page.getByLabel("E-mail", { exact: true }).fill("nl-e2e@example.com");
  await page
    .getByRole("button", { name: "Enregistrer le contact", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "Marketing & newsletters");
  await page
    .getByRole("button", { name: "Nouveau brouillon", exact: true })
    .click();
  await page
    .getByLabel("Référence de campagne", { exact: true })
    .fill("NL-E2E");
  await page
    .getByLabel("Nom du brouillon", { exact: true })
    .fill("Lettre fictive E2E");
  await page
    .getByLabel("Segment newsletter", { exact: true })
    .selectOption("sellers");
  await page
    .getByLabel("Objet du message", { exact: true })
    .fill("Bonjour {nom}");
  await page
    .getByLabel("Nom de l’expéditeur", { exact: true })
    .fill("Agence fictive E2E");
  await page
    .getByLabel("E-mail de l’expéditeur", { exact: true })
    .fill("agence-e2e@example.com");
  await page
    .getByLabel("Texte de la newsletter", { exact: true })
    .fill("Bonjour {nom}. <script>texte seulement</script>");
  await page
    .getByLabel("Signature, identité et consignes de désinscription", {
      exact: true,
    })
    .fill("Agence fictive. Désinscription par réponse à ce message.");
  await page
    .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const card = page.locator("article").filter({ hasText: "NL-E2E" });
  await card
    .getByRole("button", { name: "Prévisualiser et préparer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Préparer le fichier EML", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await preference(page, "declared");
  await page
    .getByRole("button", { name: "Brouillons newsletter", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Prévisualiser et préparer", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.locator(".marketing-preview")).toContainText(
    "Bonjour Newsletter E2E",
  );
  await expect(dialog.locator(".marketing-preview")).toContainText(
    "<script>texte seulement</script>",
  );
  const confirm = dialog.getByRole("checkbox", {
    name: "J’ai vérifié le destinataire, son autorisation newsletter, l’expéditeur et le contenu de ce fichier individuel.",
    exact: true,
  });
  await confirm.check();
  await page.route(
    "**/api/marketing/campaigns/*/download",
    async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "Les préférences ont changé. Prévisualisez à nouveau.",
        }),
      });
    },
    { times: 1 },
  );
  await dialog
    .getByRole("button", { name: "Préparer le fichier EML", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "préférences ont changé",
  );
  await dialog
    .getByRole("button", {
      name: "Actualiser la prévisualisation",
      exact: true,
    })
    .click();
  await expect(confirm).not.toBeChecked();
  await expect(
    dialog.getByRole("button", {
      name: "Préparer le fichier EML",
      exact: true,
    }),
  ).toBeDisabled();
  await confirm.check();
  const downloaded = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Préparer le fichier EML", exact: true })
    .click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("newsletter-immo-pilot.eml");
  const content = await readFile((await file.path())!, "utf8");
  expect(content).toContain("To: Newsletter E2E <nl-e2e@example.com>");
  expect(content).toContain("X-Unsent: 1");
  expect(content).toContain("Content-Type: text/plain");
  expect(content).not.toContain("Bcc:");
  await expect(dialog.locator(".marketing-history li")).toHaveCount(1);
  await expect(
    dialog.getByRole("status").filter({ hasText: "Fichier EML préparé" }),
  ).toBeVisible();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/newsletter-preview.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(card).toContainText(
    "1 fichier(s) préparé(s) · aucun envoi confirmé",
  );
  await preference(page, "withdrawn");
  await page
    .getByRole("button", { name: "Brouillons newsletter", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Prévisualiser et préparer", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", {
      name: "Préparer le fichier EML",
      exact: true,
    }),
  ).toBeDisabled();
  await dialog.getByText(/Fiches écartées ·/).click();
  await expect(dialog.locator(".marketing-details")).toContainText(
    "Adresse exclue ou opposition enregistrée",
  );
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await page
    .getByRole("button", { name: "Exclusions e-mail", exact: true })
    .click();
  await page
    .getByLabel("Rechercher une adresse exclue", { exact: true })
    .fill("nl-e2e@example.com");
  await expect(page.locator("article")).toContainText("Exclusion active");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/newsletter-exclusions-mobile.png",
    fullPage: true,
  });
});
test("newsletter en lecture seule : aperçu accessible, préparation et modifications interdites", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await page.route("**/api/auth/demo", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.user.role = "reader";
    await route.fulfill({ response, json: data });
  });
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await nav(page, "Marketing & newsletters");
  await expect(
    page.getByRole("button", { name: "Nouveau brouillon", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Prévisualiser et préparer", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Préparer le fichier EML", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page
    .getByRole("button", { name: "Préférences newsletter", exact: true })
    .click();
  await page
    .getByLabel("Contact newsletter", { exact: true })
    .selectOption({ label: "Newsletter E2E · nl-e2e@example.com" });
  await page
    .getByRole("button", { name: "Consulter la préférence", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator("input,textarea,select"),
  ).toHaveCount(0);
});
