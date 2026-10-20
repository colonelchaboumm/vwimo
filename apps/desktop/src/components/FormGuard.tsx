import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

export function useFormGuard(onClose: () => void, busy: boolean) {
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const message = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  useEffect(() => {
    if (confirming) message.current?.focus();
  }, [confirming]);
  const close = () => {
    if (!busy) {
      if (dirty) setConfirming(true);
      else onClose();
    }
  };
  const notice = confirming ? (
    <div className="discard-confirm" role="alert" tabIndex={-1} ref={message}>
      <strong>Conserver votre saisie ?</strong>
      <p>Vos modifications ne sont pas encore enregistrées.</p>
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setConfirming(false)}
        >
          Continuer la saisie
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={busy}
          onClick={onClose}
        >
          Abandonner les modifications
        </Button>
      </div>
    </div>
  ) : null;
  return {
    close,
    notice,
    markDirty: () => setDirty(true),
    clean: () => setDirty(false),
  };
}
