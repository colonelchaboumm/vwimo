import { readFile, copyFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const config = JSON.parse(
  await readFile("apps/desktop/src-tauri/tauri.conf.json", "utf8"),
);
const version = config.version;
const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.version !== version) throw new Error("Versions incohérentes.");
if (
  process.env.GITHUB_REF_TYPE === "tag" &&
  process.env.GITHUB_REF_NAME !== `v${version}`
)
  throw new Error("Le tag ne correspond pas à la version compilée.");
const directory = "apps/desktop/src-tauri/target/release/bundle/nsis";
const filename = `IMMO PILOT AI_${version}_x64-setup.exe`;
// GitHub normalise les espaces des pièces jointes : publier un nom stable.
const publishedFilename = `IMMO-PILOT-AI_${version}_x64-setup.exe`;
const signature = (
  await readFile(path.join(directory, filename + ".sig"), "utf8")
).trim();
if (!signature) throw new Error("Signature absente.");
const notes = await readFile(`docs/releases/${version}.md`, "utf8");
const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/colonelchaboumm/vwimo/releases/download/v${version}/${publishedFilename}`,
    },
  },
};
await mkdir(".local/release", { recursive: true });
await copyFile(path.join(directory, filename), `.local/release/${publishedFilename}`);
await copyFile(path.join(directory, filename + ".sig"), `.local/release/${publishedFilename}.sig`);
await writeFile(
  ".local/release/latest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
const digest = createHash("sha256")
  .update(await readFile(path.join(directory, filename)))
  .digest("hex");
await writeFile(".local/release/SHA256SUMS.txt", `${digest}  ${publishedFilename}\n`);
console.log(`Manifeste signé préparé pour ${version}.`);
