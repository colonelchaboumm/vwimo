import { useRef, useState, type FormEvent } from "react";
import { api, saveFile } from "../../api";
import { useFormGuard } from "../FormGuard";
import { useSubmitLock } from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
type Preview = {
  rows: {
    line: number;
    item: { title: string; city: string; price: string };
    duplicate: boolean;
  }[];
  errors: { line: number; message: string }[];
  new_count: number;
  duplicate_count: number;
};
export function RadarImport({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rights, setRights] = useState(false);
  const [error, setError] = useState("");
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  const inputVersion = useRef(0);
  function change(value: string) {
    inputVersion.current++;
    setText(value);
    setPreview(null);
    setRights(false);
    guard.markDirty();
  }
  async function readFile(file?: File) {
    if (!file) return;
    const revision = ++inputVersion.current;
    try {
      if (file.size > 250000)
        throw new Error("Le fichier est limité à 250 Ko et 200 annonces.");
      let value: string;
      try {
        value = new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        );
      } catch {
        throw new Error(
          "Le CSV doit être encodé en UTF-8. Réenregistrez-le dans ce format.",
        );
      }
      if (revision === inputVersion.current) change(value);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function inspect(e: FormEvent) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    try {
      setPreview(
        await api<Preview>("/radar/import/preview", {
          method: "POST",
          body: JSON.stringify({ text }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  async function commit() {
    if (!preview || !rights || !lock.start()) return;
    setError("");
    try {
      const result = await api<{ created: number; duplicates_ignored: number }>(
        "/radar/import",
        {
          method: "POST",
          body: JSON.stringify({ text, rights_confirmed: rights }),
        },
      );
      guard.clean();
      onSaved(
        `${result.created} annonce(s) importée(s), ${result.duplicates_ignored} URL déjà présente(s) ignorée(s). Aucun dossier existant écrasé.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  async function template() {
    try {
      saveFile(await api<Blob>("/radar/template/download"), "modele-radar.csv");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      open
      wide
      onClose={guard.close}
      title="Importer des annonces CSV"
      description="200 annonces maximum. Les sources ne sont pas consultées ; vous devez disposer des droits d’importation."
    >
      {guard.notice}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={inspect} className="commercial-form">
        <Button
          type="button"
          variant="outline"
          disabled={lock.busy}
          onClick={template}
        >
          Télécharger le modèle CSV
        </Button>
        <label className="radar-file">
          Fichier CSV UTF-8
          <input
            aria-label="Fichier CSV radar"
            type="file"
            accept=".csv,text/csv"
            disabled={lock.busy}
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
        </label>
        <label htmlFor="radar-csv">Contenu CSV</label>
        <textarea
          id="radar-csv"
          rows={7}
          maxLength={250000}
          required
          value={text}
          disabled={lock.busy}
          onChange={(e) => change(e.target.value)}
        />
        <p className="commercial-status">
          Séparateur ; ou virgule. Une URL source est obligatoire par ligne. Les
          URL identiques (hors paramètres utm et fragment) sont ignorées, sans
          mise à jour implicite du prix.
        </p>
        <Button disabled={lock.busy || !text.trim()}>
          Prévisualiser l’import
        </Button>
      </form>
      {preview && (
        <div className="radar-import-preview">
          <h3>
            {preview.new_count} nouvelle(s) · {preview.duplicate_count}{" "}
            doublon(s) d’URL · {preview.errors.length} erreur(s)
          </h3>
          {preview.errors.map((e) => (
            <p className="error" key={e.line}>
              Ligne {e.line} : {e.message}
            </p>
          ))}
          <ul>
            {preview.rows.map((row) => (
              <li key={row.line}>
                Ligne {row.line} · {row.item.title} · {row.item.city} ·{" "}
                {row.item.price} €{" "}
                {row.duplicate
                  ? "— ignorée (URL déjà présente)"
                  : "— à importer"}
              </li>
            ))}
          </ul>
          <label className="commercial-check">
            <input
              type="checkbox"
              checked={rights}
              disabled={lock.busy}
              onChange={(e) => setRights(e.target.checked)}
            />
            Je confirme disposer des droits d’importation de ces données.
          </label>
          <Button
            disabled={
              lock.busy ||
              !rights ||
              !!preview.errors.length ||
              !preview.new_count
            }
            onClick={commit}
          >
            Confirmer l’import
          </Button>
        </div>
      )}
    </Modal>
  );
}
