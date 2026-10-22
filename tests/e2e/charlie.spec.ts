import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Charlie", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Charlie, à vos côtés." }),
  ).toBeVisible();
});

test("Charlie local : briefing, brouillon fondé sur un mandat et historique privé persistant", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Nouvelle conversation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prépare mon briefing du jour", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Préparer en local", exact: true })
    .click();
  await expect(page.locator(".charlie-answer").last()).toContainText(
    "MODE LOCAL",
  );
  await expect(page.locator(".charlie-answer").last()).toContainText(
    "Europe/Paris",
  );
  await page
    .getByLabel("Type de contexte", { exact: true })
    .selectOption("mandate");
  const mandate = await page
    .getByLabel("Dossier pour Charlie", { exact: true })
    .locator("option")
    .filter({ hasText: "DEMO-001" })
    .getAttribute("value");
  await page
    .getByLabel("Dossier pour Charlie", { exact: true })
    .selectOption(mandate!);
  await page
    .getByRole("button", {
      name: "Prépare un brouillon d’annonce",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Préparer en local", exact: true })
    .click();
  const answer = page.locator(".charlie-answer").last();
  await expect(answer).toContainText("BROUILLON D’ANNONCE");
  await expect(answer).toContainText("DEMO-001");
  await expect(answer).toContainText("Aucune annonce n’a été publiée");
  await mkdir("docs/screenshots", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/charlie-local.png",
    fullPage: true,
  });
  await page
    .getByLabel("Votre message à Charlie", { exact: true })
    .fill("Brouillon non envoyé à conserver");
  await page.getByRole("button", { name: "Acquéreurs", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Charlie", exact: true })
    .click();
  await expect(
    page.getByLabel("Votre message à Charlie", { exact: true }),
  ).toHaveValue("Brouillon non envoyé à conserver");
  await page.getByLabel("Votre message à Charlie", { exact: true }).fill("");
  await page.reload();
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Charlie", exact: true })
    .click();
  await page
    .locator(".charlie-history-item")
    .filter({ hasText: "Prépare mon briefing du jour" })
    .first()
    .click();
  await expect(page.locator(".charlie-answer").last()).toContainText(
    "BROUILLON D’ANNONCE",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/charlie-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Supprimer la conversation", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Confirmer la suppression de la conversation",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Un dossier, une prochaine action." }),
  ).toBeVisible();
});

test("OpenAI simulé : confirmation, reprise du même identifiant et affichage texte sûr", async ({
  page,
}) => {
  await page.route("**/api/charlie/config", (route) =>
    route.fulfill({
      json: {
        enabled: true,
        configured: true,
        model: "gpt-5-mini",
        key_source: "environment",
        storage_supported: false,
        max_output_tokens: 2048,
        tested_at: null,
        key_error: "",
        local_available: true,
      },
    }),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Ouvrir l’espace de démonstration" })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Charlie", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nouvelle conversation", exact: true })
    .click();
  await page
    .getByLabel("Moteur de Charlie", { exact: true })
    .selectOption("openai");
  await page
    .getByLabel("Votre message à Charlie", { exact: true })
    .fill("Résumé du contexte affiché");
  await expect(
    page.getByRole("button", { name: "Transmettre à OpenAI", exact: true }),
  ).toBeDisabled();
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/charlie/conversations/*/messages", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (requests.length === 1) {
      await route.abort("failed");
      return;
    }
    const source = await page.request.get(
      route
        .request()
        .url()
        .replace(/\/messages$/, ""),
      { headers: route.request().headers() },
    );
    const conversation = await source.json();
    await route.fulfill({
      json: {
        ...conversation,
        version: conversation.version + 2,
        turns: [
          {
            id: body.request_id,
            question: body.question,
            answer: 'Réponse simulée de test. <img src="x" onerror="alert(1)">',
            engine: "openai",
            model: "gpt-5-mini",
            status: "completed",
            error: "",
            created_at: new Date().toISOString(),
            context: {
              kind: "briefing",
              id: null,
              data: {},
              sources: [],
              digest: body.context_digest,
            },
          },
        ],
      },
    });
  });
  await page.getByRole("checkbox", { name: /J’autorise l’envoi/ }).check();
  await page
    .getByRole("button", { name: "Transmettre à OpenAI", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("identifiant");
  await page.getByRole("button", { name: "Actualiser la conversation", exact: true }).click();
  await page.getByRole("checkbox", { name: /J’autorise l’envoi/ }).check();
  await page
    .getByRole("button", { name: "Transmettre à OpenAI", exact: true })
    .click();
  await expect(page.locator(".charlie-answer")).toContainText(
    "Réponse simulée de test",
  );
  expect(requests).toHaveLength(2);
  expect(requests[0].request_id).toBe(requests[1].request_id);
  expect(requests[0].allow_external).toBe(true);
  expect(requests[0]).not.toHaveProperty("history");
  await expect(page.locator(".charlie-answer img")).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", { name: /J’autorise l’envoi/ }),
  ).not.toBeChecked();
});

test("configuration OpenAI : conservation de saisie et test désactivé avant enregistrement", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Configurer OpenAI", exact: true })
    .click();
  await page
    .getByLabel("Modèle OpenAI", { exact: true })
    .fill("gpt-5-mini-test");
  await expect(
    page.getByRole("button", {
      name: "Tester la connexion (appel API)",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Fermer", exact: true })
    .first()
    .click();
  await expect(page.getByRole("alert")).toContainText("Conserver votre saisie");
  await page
    .getByRole("button", { name: "Continuer la saisie", exact: true })
    .click();
  await expect(page.getByLabel("Modèle OpenAI", { exact: true })).toHaveValue(
    "gpt-5-mini-test",
  );
  await page
    .getByRole("button", { name: "Fermer", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Abandonner les modifications", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
