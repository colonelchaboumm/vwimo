import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toBeVisible();
});
async function nav(page: Page, name: string) {
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
}
async function add(page: Page, title: string, coordinates = false) {
  await nav(page, "Radar immobilier");
  await page
    .getByRole("button", { name: "Ajouter une annonce", exact: true })
    .click();
  await page.getByLabel("Titre de l’annonce", { exact: true }).fill(title);
  await page
    .getByLabel("Source déclarée", { exact: true })
    .fill("Fiche de test déclarée");
  await page
    .getByLabel("URL source", { exact: true })
    .fill(`https://example.org/radar/${Date.now()}`);
  await page.getByLabel("Commune", { exact: true }).fill("Annecy");
  await page.getByLabel("Prix affiché (€)", { exact: true }).fill("350000");
  await page.getByLabel("Surface (m²)", { exact: true }).fill("70");
  await page
    .getByLabel("Type de vendeur", { exact: true })
    .selectOption("private");
  if (coordinates) {
    await page
      .getByLabel("Latitude (facultatif)", { exact: true })
      .fill("45.90");
    await page
      .getByLabel("Longitude (facultatif)", { exact: true })
      .fill("6.12");
  }
  await page
    .getByRole("button", { name: "Enregistrer l’annonce", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByLabel("Rechercher dans le radar", { exact: true })
    .fill(title);
  await expect(page.locator(".radar-card")).toHaveCount(1);
}

test("radar : observation de prix, historique et dossier séparé des mandats", async ({
  page,
}) => {
  await add(page, "Radar E2E historique");
  await page
    .getByRole("button", { name: "Modifier l’annonce", exact: true })
    .click();
  await page.getByLabel("Prix affiché (€)", { exact: true }).fill("325000");
  await page
    .getByLabel("Justification de l’observation de prix", { exact: true })
    .fill("Fiche révisée fournie au conseiller");
  await page
    .getByRole("button", { name: "Enregistrer l’annonce", exact: true })
    .click();
  await expect(page.locator(".radar-signals")).toContainText("Baisse depuis");
  await page
    .getByRole("button", { name: "Voir les observations", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Historique des prix déclarés" }),
  ).toBeVisible();
  await expect(dialog.locator("ol li")).toHaveCount(2);
  await expect(dialog).toContainText("Fiche révisée fournie au conseiller");
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await mkdir("docs/screenshots", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/radar.png", fullPage: true });
  await nav(page, "Mandats");
  await expect(
    page.getByText("Radar E2E historique", { exact: true }),
  ).toHaveCount(0);
});

test("CSV : prévisualisation, droits et URL répétées sans écrasement", async ({
  page,
}) => {
  await nav(page, "Radar immobilier");
  await page.getByRole("button", { name: "Importer CSV", exact: true }).click();
  const url = `https://example.org/import/${Date.now()}`;
  const text = `title;source_name;source_url;city;price;surface\nAnnonce CSV E2E;Source déclarée;${url};Annecy;400000;80\nAutre ligne même URL;Source déclarée;${url};Annecy;350000;80\n`;
  await page.getByLabel("Contenu CSV", { exact: true }).fill(text);
  await page
    .getByRole("button", { name: "Prévisualiser l’import", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "1 nouvelle(s) · 1 doublon(s) d’URL · 0 erreur(s)",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmer l’import", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "Je confirme disposer des droits d’importation de ces données.",
    })
    .check();
  await page
    .getByRole("button", { name: "Confirmer l’import", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "1 annonce(s) importée(s)" }),
  ).toBeVisible();
  await page
    .getByLabel("Rechercher dans le radar", { exact: true })
    .fill("Annonce CSV E2E");
  await expect(page.locator(".radar-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Importer CSV", exact: true }).click();
  await page.getByLabel("Contenu CSV", { exact: true }).fill(text);
  await page
    .getByRole("button", { name: "Prévisualiser l’import", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "0 nouvelle(s) · 2 doublon(s) d’URL · 0 erreur(s)",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmer l’import", exact: true }),
  ).toBeDisabled();
});

test("prospection : autorisation déclarée, journal manuel et opposition", async ({
  page,
}) => {
  await add(page, "Prospect E2E suivi");
  await page
    .getByRole("button", { name: "Ajouter en prospection", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Prospect ajouté" }),
  ).toBeVisible();
  await nav(page, "Prospection");
  await page
    .locator(".radar-card")
    .filter({ hasText: "Prospect E2E suivi" })
    .getByRole("button", { name: "Ouvrir le suivi" })
    .click();
  await page
    .getByLabel("Autorisation de contact déclarée", { exact: true })
    .selectOption("declared");
  await page
    .getByLabel("Justification / canal autorisé", { exact: true })
    .fill("Demande de rappel documentée pour le canal téléphone");
  await page
    .getByRole("button", { name: "Enregistrer le suivi", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Autorisations et notes enregistrées" }),
  ).toBeVisible();
  const prior = new Date(Date.now() - 8 * 86400000);
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(prior)
    .replace(" ", "T");
  await page
    .getByLabel("Activité effectuée", { exact: true })
    .selectOption("initial");
  await page.getByLabel("Canal utilisé", { exact: true }).selectOption("phone");
  await page
    .getByLabel("Date de l’activité · heure de Paris", { exact: true })
    .fill(date);
  await page
    .getByLabel("Preuve / référence de l’action effectuée", { exact: true })
    .fill("Compte rendu du rappel demandé");
  await page
    .getByLabel("Compte rendu / message effectivement utilisé", { exact: true })
    .fill("Échange effectué hors de l’application à la demande du vendeur");
  await page
    .getByRole("button", {
      name: "Enregistrer l’activité déclarée",
      exact: true,
    })
    .click();
  await expect(page.locator(".prospect-timeline li")).toHaveCount(1);
  await page
    .getByLabel("Activité effectuée", { exact: true })
    .selectOption("refusal");
  await page
    .getByLabel("Compte rendu / message effectivement utilisé", { exact: true })
    .fill("Le vendeur ne souhaite plus être recontacté");
  await page
    .getByRole("button", {
      name: "Enregistrer l’activité déclarée",
      exact: true,
    })
    .click();
  await expect(page.locator(".prospect-timeline li")).toHaveCount(2);
  await expect(
    page.getByRole("checkbox", {
      name: "Opposition / arrêt du suivi de contact",
    }),
  ).toBeChecked();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await expect(
    page.locator(".radar-card").filter({ hasText: "Prospect E2E suivi" }),
  ).toContainText("Opposition");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/prospection.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});

test("carte : coordonnées locales, fond externe uniquement sur demande et repli liste", async ({
  page,
}) => {
  const external: string[] = [];
  await page.route("https://tile.openstreetmap.org/**", (route) => {
    external.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1kAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  await add(page, "Point cartographique E2E", true);
  await nav(page, "Carte immobilière");
  await page
    .getByLabel("Filtrer la carte", { exact: true })
    .fill("Point cartographique E2E");
  await expect(
    page.getByRole("button", {
      name: "Annonce : Point cartographique E2E · Annecy",
    }),
  ).toBeVisible();
  expect(external).toHaveLength(0);
  await expect(page.locator(".radar-card")).toContainText("45.900000");
  await page
    .getByRole("checkbox", {
      name: "Afficher le fond OpenStreetMap (connexion internet)",
    })
    .check();
  await expect.poll(() => external.length).toBeGreaterThan(0);
  await expect(page.locator(".maplibregl-ctrl-attrib").getByText("OpenStreetMap", { exact: true })).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "Afficher le fond OpenStreetMap (connexion internet)",
    })
    .uncheck();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/carte-locale.png",
    fullPage: true,
  });
});

test("Outlook : préparation persistante, sans connexion ni secret client", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Paramètres", exact: true }).click();
  await page
    .getByRole("button", { name: "Préparer Outlook", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Non connecté à Microsoft",
  );
  await page
    .getByLabel("ID d’application Microsoft (client ID)", { exact: true })
    .fill("12345678-1234-1234-1234-123456789abc");
  await page
    .getByRole("button", {
      name: "Enregistrer la préparation Outlook",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Configuration enregistrée sur ce poste" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "Non connecté à Microsoft",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Préparer Outlook", exact: true })
    .click();
  await expect(
    page.getByLabel("ID d’application Microsoft (client ID)", { exact: true }),
  ).toHaveValue("12345678-1234-1234-1234-123456789abc");
  await page
    .getByLabel("Locataire / types de comptes Microsoft", { exact: true })
    .fill("organizations");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Conserver votre saisie");
});
