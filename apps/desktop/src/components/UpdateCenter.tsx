import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Download, LoaderCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";

export function UpdateCenter({ blocked = false }: { blocked?: boolean }) {
  const native = isTauri();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "installing"
    | "current"
    | "error"
  >("idle");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const update = useRef<Update | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const lastCheck = useRef(0);
  const checking = useCallback(async () => {
    if (!native || busy.current) return;
    busy.current = true;
    setPhase("checking");
    setError("");
    lastCheck.current = Date.now();
    try {
      const result = await check({ timeout: 15000 });
      if (!alive.current) {
        await result?.close();
        return;
      }
      await update.current?.close();
      update.current = result;
      setVersion(result?.version || "");
      setNotes(result?.body || "");
      setPhase(result ? "available" : "current");
    } catch {
      if (alive.current) {
        setPhase("error");
        setError(
          "Impossible de vérifier les mises à jour. Vérifiez votre connexion Internet puis réessayez.",
        );
      }
    } finally {
      busy.current = false;
    }
  }, [native]);
  useEffect(() => {
    alive.current = true;
    if (!native) return;
    const timer = setTimeout(() => void checking(), 1500);
    const interval = setInterval(() => void checking(), 4 * 60 * 60 * 1000);
    const focus = () => {
      if (Date.now() - lastCheck.current > 15 * 60 * 1000) void checking();
    };
    window.addEventListener("focus", focus);
    return () => {
      alive.current = false;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("focus", focus);
      void update.current?.close();
      update.current = null;
    };
  }, [native, checking]);
  const installing = phase === "downloading" || phase === "installing";
  useEffect(() => {
    if (!installing) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [installing]);
  async function install() {
    if (!update.current || busy.current || blocked) return;
    busy.current = true;
    setPhase("downloading");
    setError("");
    setProgress(null);
    let downloaded = 0,
      total = 0;
    try {
      await update.current.download(
        (event) => {
          if (event.event === "Started") total = event.data.contentLength || 0;
          if (event.event === "Progress") downloaded += event.data.chunkLength;
          if (total)
            setProgress(Math.min(100, Math.round((downloaded / total) * 100)));
        },
        { timeout: 300000 },
      );
      setPhase("installing");
      await update.current.install({ restartAfterInstall: true });
    } catch {
      setPhase("error");
      setError(
        "La mise à jour n’a pas pu être installée. La version actuelle est conservée. Vérifiez la connexion et réessayez.",
      );
    } finally {
      busy.current = false;
    }
  }
  if (!native) return null;
  return (
    <>
      <Button
        variant={phase === "available" ? "default" : "ghost"}
        size="icon"
        className={`update-button ${phase === "available" ? "update-available" : ""}`}
        aria-label={
          phase === "available"
            ? `Mise à jour ${version} disponible`
            : "Mises à jour de l’application"
        }
        title={
          phase === "available"
            ? `Version ${version} disponible`
            : "Mises à jour"
        }
        disabled={blocked}
        onClick={() => {
          setOpen(true);
          if (phase === "idle" || phase === "error") void checking();
        }}
      >
        {installing || phase === "checking" ? (
          <LoaderCircle className="spin" size={18} />
        ) : (
          <Download size={18} />
        )}
        {phase === "available" && <span className="update-dot" />}
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (!installing) setOpen(false);
        }}
        title="Mises à jour"
        description="Les nouvelles versions améliorent votre application et ses fonctionnalités."
      >
        <div className="update-content" aria-live="polite">
          {phase === "current" && (
            <p>
              <CheckCircle2 size={20} /> Votre application est à jour.
            </p>
          )}
          {phase === "checking" && (
            <p>
              <LoaderCircle className="spin" size={20} /> Recherche d’une
              nouvelle version…
            </p>
          )}
          {version && <h3>Version {version}</h3>}
          {notes && <pre className="release-notes">{notes}</pre>}
          {installing && (
            <>
              <p>
                {phase === "installing"
                  ? "Installation et redémarrage…"
                  : `Téléchargement ${progress === null ? "en cours…" : `${progress} %`}`}
              </p>
              <progress max={100} value={progress ?? undefined} />
            </>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {version && !installing && (
            <p className="notice">
              Enregistrez vos dossiers avant de continuer. L’application
              redémarrera ; vos données enregistrées seront conservées.
            </p>
          )}
        </div>
        <div className="form-footer">
          <Button
            variant="outline"
            disabled={installing || phase === "checking"}
            onClick={() => void checking()}
          >
            <RefreshCw size={16} /> Vérifier à nouveau
          </Button>
          {version && (
            <Button
              disabled={installing || phase === "checking" || blocked}
              onClick={() => void install()}
            >
              <Download size={16} /> Installer et redémarrer
            </Button>
          )}
        </div>
      </Modal>
    </>
  );
}
