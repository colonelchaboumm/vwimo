import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { spawn, execFile, execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

const root = process.cwd();
const runId = Date.now().toString(36);
await mkdir(path.join(root, ".local"), { recursive: true });
const password = randomBytes(24).toString("hex");
const databaseDir = path.join(root, ".local", `postgres-test-${runId}`);
const pgCtl =
  process.platform === "win32"
    ? (await import("@embedded-postgres/windows-x64")).pg_ctl
    : null;
const runFile = promisify(execFile);
const stopArgs = ["-D", databaseDir, "-m", "fast", "-w", "-t", "10", "stop"];
let ctlStarted = false;
process.once("exit", () => {
  if (ctlStarted) {
    try {
      execFileSync(pgCtl, stopArgs, {
        windowsHide: true,
        timeout: 15000,
        stdio: "ignore",
      });
    } catch {}
  }
});
let postgresLog = "";
// Le hook de la bibliothèque peut quitter avec 0 si une promesse reste pendante.
// Notre sortie normale est explicite, après pytest et l'arrêt du serveur.
process.prependListener("beforeExit", () => {
  console.error(
    "Le lanceur PostgreSQL s'est interrompu avant sa validation finale.",
  );
  process.exit(1);
});
const pg = new EmbeddedPostgres({
  databaseDir,
  user: "immo_test",
  password,
  port: 55433,
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--locale=C", "--encoding=UTF8"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: (message) => {
    postgresLog = (postgresLog + String(message)).slice(-5000);
  },
  onError: (message) => {
    if (String(message).includes("FATAL")) console.error(String(message));
  },
});
let testExitCode = 1;
try {
  console.log("Initialisation PostgreSQL de test sur 127.0.0.1:55433…");
  await pg.initialise();
  if (pgCtl) {
    // pg_ctl retire les droits administrateur du serveur, contrairement à postgres.exe.
    // Le compte runner doit donc avoir un droit explicite sur cette seule base de test.
    await runFile(
      "icacls.exe",
      [databaseDir, "/grant", `${process.env.USERNAME}:(OI)(CI)F`, "/T", "/Q"],
      { windowsHide: true },
    );
    await runFile(
      pgCtl,
      [
        "-D",
        databaseDir,
        "-l",
        path.join(databaseDir, "server.log"),
        "-o",
        "-h 127.0.0.1 -p 55433",
        "-w",
        "-t",
        "30",
        "start",
      ],
      { windowsHide: true, timeout: 40000 },
    );
    ctlStarted = true;
  } else {
    await pg.start();
  }
  const client = pg.getPgClient("postgres", "127.0.0.1");
  try {
    await client.connect();
    await client.query('CREATE DATABASE "immo_test"');
  } finally {
    await client.end();
  }
  const url = `postgresql+psycopg://immo_test:${password}@127.0.0.1:55433/immo_test`;
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      path.join(root, ".venv", "Scripts", "python.exe"),
      ["-m", "pytest", ...process.argv.slice(2)],
      {
        cwd: root,
        env: { ...process.env, IMMO_TEST_POSTGRES_URL: url },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    child.on("error", reject);
    child.on("exit", resolve);
  });
  testExitCode = exitCode ?? 1;
} catch (error) {
  console.error(
    error ?? "Le serveur PostgreSQL s'est arrêté avant d'être prêt.",
  );
  console.error(postgresLog.replaceAll(password, "[masqué]"));
  console.error(
    await readFile(path.join(databaseDir, "server.log"), "utf8")
      .then((text) => text.slice(-5000))
      .catch(() => ""),
  );
  testExitCode = 1;
} finally {
  try {
    if (ctlStarted) {
      await runFile(pgCtl, stopArgs, { windowsHide: true, timeout: 15000 });
      ctlStarted = false;
    } else if (
      pg.process &&
      pg.process.exitCode === null &&
      pg.process.signalCode === null
    ) {
      // stop() attend un événement exit ; il ne vient plus si le processus est déjà mort.
      await pg.stop();
    }
    console.log("PostgreSQL de test arrêté.");
  } catch (error) {
    console.error(error);
    testExitCode = 1;
  }
}
// async-exit-hook, utilisé par embedded-postgres, force beforeExit à 0.
// Le cluster est déjà arrêté : transmettre explicitement le résultat pytest.
process.exit(testExitCode);
