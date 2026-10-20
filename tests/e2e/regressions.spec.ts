import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toBeVisible();
});

test("saisie conservée après changement de profil et fermeture accidentelle", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Acquéreurs", exact: true }).click();
  await page.getByRole("button", { name: "Nouveau contact" }).click();
  await page.getByLabel("Nom complet").fill("Saisie à conserver");
  await page.getByLabel("Budget maximum").fill("525000");
  await page.getByLabel("Profil").selectOption("seller");
  await expect(page.getByLabel("Budget maximum")).toBeHidden();
  await page.getByLabel("Profil").selectOption("buyer");
  await expect(page.getByLabel("Budget maximum")).toHaveValue("525000");
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("Vos modifications ne sont pas encore enregistrées."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuer la saisie" }).click();
  await expect(page.getByLabel("Nom complet")).toHaveValue(
    "Saisie à conserver",
  );
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await page
    .getByRole("button", { name: "Abandonner les modifications" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Saisie à conserver", { exact: true }),
  ).toHaveCount(0);
});

test("recherche sans accents, tri et filtres propres à chaque liste", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Acquéreurs", exact: true }).click();
  await page.getByRole("button", { name: "Nouveau contact" }).click();
  await page.getByLabel("Nom complet").fill("Éléonore Régression");
  await page.getByLabel("Budget maximum").fill("999000");
  await page.getByRole("button", { name: "Enregistrer le contact" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Filtrer la liste" })
    .fill("eleonore regression");
  await page.getByLabel("Trier les contacts").selectOption("budget");
  await expect(
    page.getByText("Éléonore Régression", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mandats", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Filtrer la liste" }),
  ).toHaveValue("");
  await page
    .getByRole("textbox", { name: "Filtrer la liste" })
    .fill("DEMO-001");
  await page.getByRole("button", { name: "Acquéreurs", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Filtrer la liste" }),
  ).toHaveValue("eleonore regression");
  await expect(page.getByLabel("Trier les contacts")).toHaveValue("budget");
  await page.screenshot({
    path: "docs/screenshots/contacts.png",
    fullPage: true,
  });
});

test("conflit de modification visible sans perdre les champs", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Vendeurs", exact: true }).click();
  await page
    .getByRole("button", { name: "Ouvrir", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Notes du dossier")
    .fill("Ma saisie doit rester disponible");
  await page.route("**/api/contacts/*", (route) =>
    route.fulfill({
      status: 409,
      json: {
        detail: "Ce dossier a été modifié ailleurs. Actualisez la liste.",
      },
    }),
  );
  await page.getByRole("button", { name: "Enregistrer le contact" }).click();
  await expect(page.getByRole("alert")).toContainText("modifié ailleurs");
  await expect(page.getByLabel("Notes du dossier")).toHaveValue(
    "Ma saisie doit rester disponible",
  );
  await expect(
    page.getByRole("button", { name: "Enregistrer le contact" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "docs/screenshots/formulaire.png",
    fullPage: true,
  });
});

test("enregistrement confirmé malgré un échec du rafraîchissement", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Vendeurs", exact: true }).click();
  await page.getByRole("button", { name: "Nouveau contact" }).click();
  const name = `Confirmation ${Date.now()}`;
  await page.getByLabel("Nom complet").fill(name);
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Service temporairement indisponible" },
    }),
  );
  await page.getByRole("button", { name: "Enregistrer le contact" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Enregistrement confirmé. La liste reste à actualiser."),
  ).toBeVisible();
  await page.unroute("**/api/dashboard");
  await page.getByRole("button", { name: "Actualiser les données" }).click();
  await expect(page.getByText(name, { exact: true })).toHaveCount(1);
});

test("session expirée et réponse tardive ne réaffichent pas les anciennes données", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted!: () => void;
  const started = new Promise<void>((resolve) => {
    intercepted = resolve;
  });
  await page.route("**/api/contacts", async (route) => {
    const response = await route.fetch();
    intercepted();
    await gate;
    await route.fulfill({ response });
  });
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({ status: 401, json: { detail: "Session expirée" } }),
  );
  await page.getByRole("button", { name: "Actualiser les données" }).click();
  await started;
  await expect(
    page.getByText("Votre session a expiré. Reconnectez-vous pour continuer."),
  ).toBeVisible();
  release();
  await page.unroute("**/api/contacts");
  await page.unroute("**/api/dashboard");
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toBeVisible();
  await expect(
    page.getByText("Cette réponse appartient à une ancienne session."),
  ).toHaveCount(0);
});

test("lecture seule, détails lisibles et navigation sur petit écran", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.route("**/api/auth/demo", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.user.role = "reader";
    await route.fulfill({ response, json: data });
  });
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await expect(
    page.getByRole("button", { name: "Nouveau mandat" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Vendeurs", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Nouveau contact" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Ouvrir", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog").locator("dl")).toBeVisible();
  await expect(page.getByRole("dialog").locator("input")).toHaveCount(0);
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Paramètres", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Paramètres & connexions." }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "docs/screenshots/mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(
    page.getByRole("heading", { name: "Bienvenue dans votre espace." }),
  ).toBeVisible();
});

test("déconnexion locale possible quand le serveur ne répond plus", async ({
  page,
}) => {
  await page.route("**/api/auth/logout", (route) =>
    route.abort("connectionrefused"),
  );
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(
    page.getByRole("heading", { name: "Bienvenue dans votre espace." }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Déconnexion locale effectuée",
  );
});
