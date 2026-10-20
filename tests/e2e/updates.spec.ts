import { test, expect, type Page } from "@playwright/test";

async function mockUpdater(page: Page, mode: string) {
  await page.addInitScript(
    ({ mode }) => {
      const win = window as any;
      win.isTauri = true;
      win.updateCalls = [];
      win.__TAURI_INTERNALS__ = {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, args: any) => {
          win.updateCalls.push(command);
          if (command === "backend_connection")
            return { origin: "http://127.0.0.1:8011", key: "" };
          if (command === "plugin:resources|close") return;
          if (command === "plugin:updater|check") {
            if (mode === "offline") throw new Error("offline");
            if (mode === "current") return null;
            return {
              rid: 1,
              currentVersion: "0.3.0",
              version: "0.4.0",
              body: "Amélioration des dossiers.",
              rawJson: {},
            };
          }
          if (command === "plugin:updater|download") {
            if (mode === "bad-signature") throw new Error("Invalid signature");
            args.onEvent.onmessage({
              event: "Started",
              data: { contentLength: 100 },
            });
            args.onEvent.onmessage({
              event: "Progress",
              data: { chunkLength: 100 },
            });
            return 2;
          }
          if (command === "plugin:updater|install") return;
          throw new Error(`Commande inattendue : ${command}`);
        },
      };
    },
    { mode },
  );
  await page.goto("/");
}

test("une mise à jour demande un clic avant téléchargement et redémarrage", async ({
  page,
}) => {
  await mockUpdater(page, "available");
  await page
    .getByRole("button", { name: "Mise à jour 0.4.0 disponible" })
    .click();
  await expect(page.getByText("Amélioration des dossiers.")).toBeVisible();
  expect(await page.evaluate(() => (window as any).updateCalls)).not.toContain(
    "plugin:updater|download",
  );
  await page.getByRole("button", { name: "Installer et redémarrer" }).click();
  await expect(page.getByText("Installation et redémarrage…")).toBeVisible();
  const calls = await page.evaluate(() => (window as any).updateCalls);
  expect(calls.indexOf("plugin:updater|install")).toBeGreaterThan(
    calls.indexOf("plugin:updater|download"),
  );
  await page.screenshot({ path: "docs/screenshots/update-dialog.png" });
});

test("signature refusée : aucune installation et possibilité de réessayer", async ({
  page,
}) => {
  await mockUpdater(page, "bad-signature");
  await page
    .getByRole("button", { name: "Mise à jour 0.4.0 disponible" })
    .click();
  await page.getByRole("button", { name: "Installer et redémarrer" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "n’a pas pu être installée",
  );
  expect(await page.evaluate(() => (window as any).updateCalls)).not.toContain(
    "plugin:updater|install",
  );
  await expect(
    page.getByRole("button", { name: "Vérifier à nouveau" }),
  ).toBeEnabled();
});

test("erreur réseau distinguée d’une application à jour", async ({ page }) => {
  await mockUpdater(page, "offline");
  await page
    .getByRole("button", { name: "Mises à jour de l’application" })
    .click();
  await expect(page.getByRole("alert")).toContainText("Impossible de vérifier");
  await expect(page.getByText("Votre application est à jour.")).toHaveCount(0);
});

test("version courante sans action d’installation", async ({ page }) => {
  await mockUpdater(page, "current");
  await page
    .getByRole("button", { name: "Mises à jour de l’application" })
    .click();
  await expect(page.getByText("Votre application est à jour.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Installer et redémarrer" }),
  ).toHaveCount(0);
});

test("le navigateur n’affiche pas de mise à jour Windows", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Ouvrir l’espace de démonstration" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mises à jour de l’application" }),
  ).toHaveCount(0);
});
