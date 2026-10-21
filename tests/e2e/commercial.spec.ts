import { test, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toBeVisible();
});

test("agenda local : création, export ICS, modification et suppression", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Agenda local", exact: true }).click();
  await page.getByLabel("Date de l’agenda", { exact: true }).fill("2026-10-25");
  await page.getByRole("button", { name: "Jour", exact: true }).click();
  await page.getByRole("button", { name: "Nouveau rendez-vous" }).click();
  await page.getByLabel("Titre", { exact: true }).fill("Visite E2E locale");
  await page.getByLabel("Début · heure de Paris").fill("2026-10-25T02:30");
  await page
    .getByRole("button", { name: "Enregistrer le rendez-vous" })
    .click();
  await expect(page.getByRole("alert")).toContainText("inexistant ou ambigu");
  await page.getByLabel("Début · heure de Paris").fill("2026-10-25T09:00");
  await page.getByLabel("Fin · heure de Paris").fill("2026-10-25T10:00");
  await page
    .getByLabel("Notes de préparation")
    .fill("Préparer les diagnostics.");
  await page
    .getByRole("button", { name: "Enregistrer le rendez-vous" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Visite E2E locale", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter ICS" }).click();
  const ics = await download;
  expect(ics.suggestedFilename()).toBe("agenda-immo-pilot.ics");
  expect(await readFile((await ics.path())!, "utf8")).toContain(
    "DTSTART:20261025T080000Z",
  );
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/agenda-local.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Visite E2E locale/ }).click();
  await page.getByLabel("Titre", { exact: true }).fill("Visite E2E confirmée");
  await page
    .getByRole("button", { name: "Enregistrer le rendez-vous" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /Visite E2E confirmée/ }).click();
  await page.getByRole("button", { name: "Supprimer le rendez-vous" }).click();
  await page.getByRole("button", { name: "Confirmer la suppression" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Visite E2E confirmée", { exact: true }),
  ).toHaveCount(0);
});

test("estimation sourcée : ventes séparées des annonces, rapport PDF et persistance", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Estimations", exact: true }).click();
  await page.getByRole("button", { name: "Nouvelle estimation" }).click();
  await page.getByLabel("Nom du dossier").fill("Estimation E2E Albigny");
  await page.getByLabel("Adresse du bien").fill("Adresse fictive de test");
  await page.getByLabel("Commune", { exact: true }).fill("Annecy");
  await page.getByLabel("Surface habitable (m²)").fill("70");
  for (const [n, price, surface, kind] of [
    [1, "200000", "40", "sale"],
    [2, "350000", "50", "sale"],
    [3, "990000", "40", "asking"],
  ] as const) {
    await page.getByRole("button", { name: "Ajouter un comparable" }).click();
    await page
      .getByLabel(`Comparable ${n} · désignation`, { exact: true })
      .fill(`Référence ${n} de test`);
    await page
      .getByLabel(`Comparable ${n} · source`, { exact: true })
      .fill("Source fictive E2E déclarée");
    await page
      .getByLabel(`Comparable ${n} · nature du prix`, { exact: true })
      .selectOption(kind);
    await page
      .getByLabel(`Comparable ${n} · prix (€)`, { exact: true })
      .fill(price);
    await page
      .getByLabel(`Comparable ${n} · surface (m²)`, { exact: true })
      .fill(surface);
  }
  await page.getByLabel("Base de référence").selectOption("sale");
  await page
    .getByRole("button", { name: "Suggérer depuis les comparables" })
    .click();
  await expect(page.getByLabel("Valeur basse (€)")).toHaveValue("350000.00");
  await expect(page.getByLabel("Valeur centrale (€)")).toHaveValue("420000.00");
  await expect(page.getByLabel("Valeur haute (€)")).toHaveValue("490000.00");
  await page
    .getByLabel("Analyse et stratégie de commercialisation")
    .fill("Évaluation de test, références fictives explicitement déclarées.");
  await page.getByRole("button", { name: "Enregistrer l’estimation" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const card = page
    .locator(".estimate-card")
    .filter({ hasText: "Estimation E2E Albigny" });
  await expect(card).toBeVisible();
  const download = page.waitForEvent("download");
  await card.getByRole("button", { name: "Rapport PDF" }).click();
  const pdf = await download;
  const bytes = await readFile((await pdf.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  await page.screenshot({
    path: "docs/screenshots/estimations.png",
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await page.getByRole("button", { name: "Estimations", exact: true }).click();
  await page
    .locator(".estimate-card")
    .filter({ hasText: "Estimation E2E Albigny" })
    .getByRole("button", { name: "Modifier" })
    .click();
  await expect(page.getByLabel("Valeur centrale (€)")).toHaveValue("420000.00");
  await expect(
    page.getByLabel("Comparable 3 · nature du prix", { exact: true }),
  ).toHaveValue("asking");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});

test("rapprochements explicables et navigation vers les dossiers", async ({
  page,
  request,
}) => {
  const login = await request.post("http://127.0.0.1:8011/api/auth/demo");
  const headers = { Authorization: "Bearer " + (await login.json()).token };
  const contacts = await (
    await request.get("http://127.0.0.1:8011/api/contacts", { headers })
  ).json();
  const buyer = await (
    await request.post("http://127.0.0.1:8011/api/contacts", {
      headers,
      data: {
        name: "Acquéreur E2E rapprochement",
        kind: "buyer",
        criteria: {
          budget_min: "300000",
          budget_max: "450000",
          min_surface: "60",
          bedrooms: 2,
          sectors: "Annecy",
          mandatory: "Ascenseur",
        },
      },
    })
  ).json();
  const mandate = await request.post("http://127.0.0.1:8011/api/mandates", {
    headers,
    data: {
      reference: "MATCH-E2E",
      seller_id: contacts.find((c: { kind: string }) => c.kind === "seller").id,
      kind: "exclusive",
      status: "active",
      signed_date: "2026-10-01",
      end_date: "2027-01-01",
      price: "420000",
      fees: "15000",
      property: {
        title: "Bien compatible E2E",
        address: "Adresse de test",
        city: "Annecy",
        property_type: "Appartement",
        surface: "72",
        rooms: 3,
        dpe: "C",
      },
    },
  });
  expect(mandate.status()).toBe(201);
  await page.reload();
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await page
    .getByRole("button", { name: "Rapprochements", exact: true })
    .click();
  await page.getByLabel("Acquéreur", { exact: true }).selectOption(buyer.id);
  const card = page.locator(".match-card").filter({ hasText: "MATCH-E2E" });
  await expect(card).toContainText("100 %");
  await card.getByText(/Points à vérifier/).click();
  await expect(card).toContainText("Ascenseur");
  await expect(card).toContainText("les pièces ne sont pas des chambres");
  await page.screenshot({
    path: "docs/screenshots/rapprochements.png",
    fullPage: true,
  });
  await card.getByRole("button", { name: "Mandat", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Référence *", { exact: true })).toHaveValue(
    "MATCH-E2E",
  );
});
