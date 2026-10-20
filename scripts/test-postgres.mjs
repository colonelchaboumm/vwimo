import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runId = Date.now().toString(36);
await mkdir(path.join(root, ".local"), { recursive: true });
const password = randomBytes(24).toString("hex");
const pg = new EmbeddedPostgres({
  databaseDir: path.join(root, ".local", `postgres-test-${runId}`),
  user: "immo_test",
  password,
  port: 55433,
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--locale=C", "--encoding=UTF8"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (message) => {
    if (String(message).includes("FATAL")) console.error(String(message));
  },
});
let testExitCode = 1;
try {
  console.log("Initialisation PostgreSQL de test sur 127.0.0.1:55433…");
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("immo_test");
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
  console.error(error);
  testExitCode = 1;
} finally {
  try {
    await pg.stop();
    console.log("PostgreSQL de test arrêté.");
  } catch (error) {
    console.error(error);
    testExitCode = 1;
  }
}
// async-exit-hook, utilisé par embedded-postgres, force beforeExit à 0.
// Le cluster est déjà arrêté : transmettre explicitement le résultat pytest.
process.exit(testExitCode);
