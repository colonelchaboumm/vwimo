import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";

const root = process.cwd();
async function occupied(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}
assert(!(await occupied(9223)), "Le port 9223 doit être libre.");
const runDir = path.join(root, ".local", `native-test-${Date.now()}`);
let backend, native, browser;
let logs = "";
function launch(file, args, env) {
  const child = spawn(file, args, {
    cwd: root,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  child.on("error", (error) => {
    logs += error.message;
  });
  return child;
}
async function waitFor(url, child) {
  for (let n = 0; n < 300; n++) {
    if (child.exitCode !== null) throw new Error(`Processus arrêté : ${logs}`);
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return await r.json();
    } catch {}
    await delay(200);
  }
  throw new Error(`Service non disponible : ${url}\n${logs}`);
}
try {
  native = launch(
    path.join(root, "apps/desktop/src-tauri/target/release/immo-pilot-ai.exe"),
    [],
    {
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9223",
      WEBVIEW2_USER_DATA_FOLDER: path.join(root, ".local/native-webview-test"),
      IMMO_DESKTOP_DATA_DIR: runDir,
      IMMO_DESKTOP_TEST_INSTANCE: "1",
    },
  );
  const endpoint = await waitFor("http://127.0.0.1:9223/json/version", native);
  browser = await chromium.connectOverCDP(endpoint.webSocketDebuggerUrl);
  const context = browser.contexts()[0];
  const page =
    context.pages()[0] ||
    (await context.waitForEvent("page", { timeout: 15000 }));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(
    page.getByRole("button", { name: "Mises à jour de l’application" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Créez votre espace privé." }),
  ).toBeVisible();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/compte-local.png",
    fullPage: true,
  });
  await page.getByLabel("Votre nom", { exact: true }).fill("Camille");
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .fill("native-account@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("Native account secret 2026!");
  await page
    .getByLabel("Confirmer le mot de passe", { exact: true })
    .fill("Une confirmation différente");
  await page.getByRole("button", { name: "Créer mon compte local" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Les deux mots de passe ne correspondent pas",
  );
  await page
    .getByLabel("Confirmer le mot de passe", { exact: true })
    .fill("Native account secret 2026!");
  await page.getByRole("button", { name: "Créer mon compte local" }).click();
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toBeVisible();
  const connection = await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke("backend_connection"),
  );
  assert.equal((await fetch(connection.origin + "/api/health")).status, 401);
  assert.equal(
    (
      await fetch(connection.origin + "/api/health", {
        headers: { "X-Immo-Desktop-Key": connection.key },
      })
    ).status,
    200,
  );
  await page.getByRole("button", { name: "Vendeurs", exact: true }).click();
  await page.getByRole("button", { name: "Nouveau contact" }).click();
  await page.getByLabel("Nom complet").fill("Vendeur natif WebView2");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("vendeur-native@example.com");
  await page.getByRole("button", { name: "Enregistrer le contact" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Vendeur natif WebView2", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter un document" }).click();
  await page.getByLabel("Fichier").setInputFiles({
    name: "native-test.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nNative test\n%%EOF"),
  });
  await page.getByRole("button", { name: "Importer le document" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const download = page.waitForEvent("download", { timeout: 15000 });
  await page.getByRole("button", { name: "Télécharger" }).click();
  const file = await download;
  assert.equal(file.suggestedFilename(), "native-test.pdf");
  assert.equal(await file.failure(), null);
  await page
    .getByRole("button", { name: "Tableau de bord", exact: true })
    .click();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/windows-webview2.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(
    page.getByRole("heading", { name: "Bienvenue dans votre espace." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Créer mon compte local" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ouvrir l’espace de démonstration" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .fill("native-account@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("Native account secret 2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Vendeurs", exact: true }).click();
  await expect(
    page.getByText("Vendeur natif WebView2", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Agenda local", exact: true }).click();
  await page.getByRole("button", { name: "Nouveau rendez-vous" }).click();
  await page.getByLabel("Titre", { exact: true }).fill("Visite native locale");
  await page
    .getByRole("button", { name: "Enregistrer le rendez-vous" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Visite native locale", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Estimations", exact: true }).click();
  await page.getByRole("button", { name: "Nouvelle estimation" }).click();
  await page.getByLabel("Nom du dossier").fill("Estimation native locale");
  await page.getByLabel("Adresse du bien").fill("Adresse fictive native");
  await page.getByLabel("Commune", { exact: true }).fill("Annecy");
  await page.getByLabel("Surface habitable (m²)").fill("70");
  await page.getByLabel("Valeur basse (€)").fill("350000");
  await page.getByLabel("Valeur centrale (€)").fill("380000");
  await page.getByLabel("Valeur haute (€)").fill("410000");
  await page.getByRole("button", { name: "Enregistrer l’estimation" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const reportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Rapport PDF" }).click();
  const report = await reportDownload;
  assert.equal(await report.failure(), null);
  const reportBytes = await readFile(await report.path());
  assert.equal(reportBytes.subarray(0, 5).toString(), "%PDF-");
  assert(
    reportBytes.length > 10000,
    "Le rapport embarque les polices nécessaires.",
  );
  await page
    .getByRole("button", { name: "Rapprochements", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Les bonnes rencontres." }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Charlie", exact: true })
    .click();
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
    "Visite native locale",
  );
  await page
    .getByRole("button", { name: "Configurer OpenAI", exact: true })
    .click();
  await page
    .getByLabel("Clé API OpenAI", { exact: true })
    .fill("sk-fictional-native-test-no-network");
  await page
    .getByRole("button", { name: "Enregistrer la connexion", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Configuration enregistrée" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Tester la connexion (appel API)",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .first()
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Radar immobilier", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ajouter une annonce", exact: true })
    .click();
  await page
    .getByLabel("Titre de l’annonce", { exact: true })
    .fill("Annonce native locale");
  await page
    .getByLabel("Source déclarée", { exact: true })
    .fill("Fiche de test native");
  await page.getByLabel("Commune", { exact: true }).fill("Annecy");
  await page.getByLabel("Prix affiché (€)", { exact: true }).fill("350000");
  await page.getByLabel("Surface (m²)", { exact: true }).fill("70");
  await page
    .getByLabel("Type de vendeur", { exact: true })
    .selectOption("private");
  await page.getByLabel("Latitude (facultatif)", { exact: true }).fill("45.90");
  await page.getByLabel("Longitude (facultatif)", { exact: true }).fill("6.12");
  await page
    .getByRole("button", { name: "Enregistrer l’annonce", exact: true })
    .click();
  await expect(page.locator(".radar-card")).toContainText(
    "Annonce native locale",
  );
  await page
    .getByRole("button", { name: "Ajouter en prospection", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Prospect ajouté" }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Prospection", exact: true })
    .click();
  await expect(page.locator(".radar-card")).toContainText(
    "Annonce native locale",
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Carte immobilière", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Carte affichée" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("button", {
      name: "Annonce : Annonce native locale · Annecy",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "Afficher le fond OpenStreetMap (connexion internet)",
    }),
  ).not.toBeChecked();
  await page
    .locator("nav")
    .getByRole("button", { name: "Commissions & revenus", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nouveau revenu", exact: true })
    .click();
  await page
    .getByLabel("Référence du revenu", { exact: true })
    .fill("REV-NATIVE");
  await page
    .getByLabel("Libellé du revenu", { exact: true })
    .fill("Courtage fictif natif");
  await page
    .getByLabel("Origine de la rémunération", { exact: true })
    .selectOption("broker");
  await page
    .getByLabel("Payeur / partenaire", { exact: true })
    .fill("Partenaire fictif natif");
  await page
    .getByLabel("Montant fixe de rémunération (€)", { exact: true })
    .fill("125.03");
  await page
    .getByLabel("Justification du droit à rémunération", { exact: true })
    .fill("Prestation fictive confirmée pour le test natif.");
  await page
    .getByRole("button", { name: "Enregistrer la prévision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator("article").filter({ hasText: "REV-NATIVE" }),
  ).toContainText("125,03");
  await page
    .getByRole("button", { name: "Calcul et encaissements", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recalculer avant validation", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Je confirme ce calcul et mon droit à rémunération à cette date.",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Confirmer le revenu validé", exact: true })
    .click();
  await page.getByLabel("Montant encaissé (€)", { exact: true }).fill("25.01");
  await page
    .getByLabel("Référence / preuve de l’encaissement", { exact: true })
    .fill("Virement fictif natif");
  await page
    .getByRole("button", {
      name: "Enregistrer l’encaissement déclaré",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog").locator(".prospect-stats"),
  ).toContainText("100,02");
  await expect(page.locator(".finance-payments li")).toHaveCount(1);
  await page.screenshot({
    path: "docs/screenshots/finance-webview2.png",
    fullPage: true,
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Courtage & recommandations", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Annuaire partenaires", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nouveau partenaire", exact: true })
    .click();
  await page
    .getByLabel("Nom / société du partenaire", { exact: true })
    .fill("Partenaire fictif natif");
  await page
    .getByLabel("Type de partenaire", { exact: true })
    .selectOption("moving");
  await page
    .getByRole("button", { name: "Enregistrer le partenaire", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Créer une mise en relation", exact: true })
    .click();
  await page
    .getByLabel("Référence du dossier partenaire", { exact: true })
    .fill("APP-NATIVE");
  await page
    .getByLabel("Libellé de la mise en relation", { exact: true })
    .fill("Service fictif natif");
  await page
    .getByLabel("Type de dossier partenaire", { exact: true })
    .selectOption("service");
  await page
    .getByLabel("Contact recommandé / acquéreur", { exact: true })
    .selectOption({ label: "Vendeur natif WebView2" });
  await page
    .getByLabel("Origine de la recommandation", { exact: true })
    .fill("Demande fictive native");
  await page
    .getByLabel("Projet / besoin du client", { exact: true })
    .fill("Déménagement fictif natif");
  await page
    .getByRole("button", {
      name: "Enregistrer le dossier partenaire",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mises en relation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Historique et revenus", exact: true })
    .click();
  await expect(page.locator(".partner-history li")).toHaveCount(1);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Statistiques", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Revenus mensuels", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/pilotage-webview2.png",
    fullPage: true,
  });
  await page
    .locator("nav")
    .getByRole("button", { name: "Marketing & newsletters", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Préférences newsletter", exact: true })
    .click();
  await page
    .getByLabel("Contact newsletter", { exact: true })
    .selectOption({
      label: "Vendeur natif WebView2 · vendeur-native@example.com",
    });
  await page
    .getByRole("button", {
      name: "Gérer la préférence newsletter",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Préférence newsletter", { exact: true })
    .selectOption("declared");
  await page
    .getByLabel("Justification de la préférence newsletter", { exact: true })
    .fill("Autorisation fictive pour le test natif.");
  await page
    .getByRole("button", {
      name: "Enregistrer la préférence newsletter",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Nouveau brouillon", exact: true })
    .click();
  await page
    .getByLabel("Référence de campagne", { exact: true })
    .fill("NL-NATIVE");
  await page
    .getByLabel("Nom du brouillon", { exact: true })
    .fill("Lettre fictive native");
  await page
    .getByLabel("Segment newsletter", { exact: true })
    .selectOption("sellers");
  await page
    .getByLabel("Objet du message", { exact: true })
    .fill("Bonjour {nom}");
  await page
    .getByLabel("Nom de l’expéditeur", { exact: true })
    .fill("Agence fictive native");
  await page
    .getByLabel("E-mail de l’expéditeur", { exact: true })
    .fill("agence-native@example.com");
  await page
    .getByLabel("Texte de la newsletter", { exact: true })
    .fill("Bonjour {nom}, contenu fictif accentué.");
  await page
    .getByLabel("Signature, identité et consignes de désinscription", {
      exact: true,
    })
    .fill("Agence fictive. Désinscription par réponse à ce message.");
  await page
    .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Brouillons newsletter", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prévisualiser et préparer", exact: true })
    .click();
  await expect(page.locator(".marketing-preview")).toContainText(
    "Bonjour Vendeur natif WebView2",
  );
  await page
    .getByRole("checkbox", {
      name: "J’ai vérifié le destinataire, son autorisation newsletter, l’expéditeur et le contenu de ce fichier individuel.",
      exact: true,
    })
    .check();
  const newsletterDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Préparer le fichier EML", exact: true })
    .click();
  const newsletterFile = await newsletterDownload;
  const newsletterContent = await readFile(await newsletterFile.path(), "utf8");
  assert(newsletterContent.includes("X-Unsent: 1"));
  assert(newsletterContent.includes("vendeur-native@example.com"));
  await expect(page.locator(".marketing-history li")).toHaveCount(1);
  await page.screenshot({
    path: "docs/screenshots/newsletter-webview2.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "WebView2 : compte, dossiers, agenda, PDF, Charlie, DPAPI, radar, carte, finance, partenaires, pilotage et newsletter EML réussis. Aucun envoi d’e-mail ni appel OpenAI ni requête de tuile OSM.",
  );
} catch (error) {
  console.error(error);
  console.error(logs.slice(-5000));
  console.error(
    await readFile(path.join(runDir, "backend.log"), "utf8")
      .then((text) => text.slice(-3000))
      .catch(() => "Backend log absent."),
  );
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (native && native.exitCode === null) native.kill();
  if (backend && backend.exitCode === null) backend.kill();
}
