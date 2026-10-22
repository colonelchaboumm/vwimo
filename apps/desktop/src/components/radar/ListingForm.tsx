import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { useFormGuard } from "../FormGuard";
import { Field, useSubmitLock } from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { parisInput, sellerLabels, statusLabels, type Listing } from "./types";

export function ListingForm({
  item,
  onClose,
  onSaved,
}: {
  item?: Listing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    for (const key of ["rooms", "latitude", "longitude", "published_on"])
      if (!values[key]) delete values[key];
    try {
      await api("/radar" + (item ? "/" + item.id : ""), {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({
          ...values,
          version: item?.version,
          rooms: values.rooms ? Number(values.rooms) : null,
          latitude: values.latitude || null,
          longitude: values.longitude || null,
          published_on: values.published_on || null,
        }),
      });
      guard.clean();
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  const fields = [
    ["title", "Titre de l’annonce", "text", true, 180],
    ["source_name", "Source déclarée", "text", true, 120],
    ["source_url", "URL source", "url", false, 1500],
    ["city", "Commune", "text", true, 100],
    ["district", "Quartier", "text", false, 120],
    ["address", "Adresse (si connue)", "text", false, 250],
    ["price", "Prix affiché (€)", "number", true, 999999999],
    ["surface", "Surface (m²)", "number", true, 100000],
    ["rooms", "Nombre de pièces (si connu)", "number", false, 100],
    ["published_on", "Publication déclarée", "date", false, 0],
    ["observed_on", "Date d’observation", "date", true, 0],
    ["latitude", "Latitude (facultatif)", "number", false, 85],
    ["longitude", "Longitude (facultatif)", "number", false, 180],
  ] as const;
  return (
    <Modal
      open
      wide
      onClose={guard.close}
      title={item ? "Modifier l’annonce radar" : "Ajouter une annonce radar"}
      description="Données déclarées : aucune collecte sur le portail. Cette annonce n’entre pas dans vos mandats."
    >
      <form
        className="commercial-form"
        onSubmit={submit}
        onChange={guard.markDirty}
      >
        {guard.notice}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <fieldset disabled={lock.busy} className="radar-form-grid">
          {fields.map(([name, label, type, required, max]) => (
            <Field key={name} label={label}>
              {(id) => (
                <input
                  id={id}
                  name={name}
                  type={type}
                  required={required}
                  maxLength={
                    type === "text" || type === "url" ? max : undefined
                  }
                  min={
                    type === "number"
                      ? name === "latitude"
                        ? -85
                        : name === "longitude"
                          ? -180
                          : name === "rooms"
                            ? 1
                            : 0.01
                      : undefined
                  }
                  max={
                    type === "number"
                      ? max
                      : type === "date"
                        ? parisInput().slice(0, 10)
                        : undefined
                  }
                  step={
                    type === "number"
                      ? name === "rooms"
                        ? 1
                        : ["latitude", "longitude"].includes(name)
                          ? ".000001"
                          : ".01"
                      : undefined
                  }
                  defaultValue={
                    name === "observed_on"
                      ? parisInput().slice(0, 10)
                      : String(item?.[name] ?? "")
                  }
                />
              )}
            </Field>
          ))}
          <Field label="Type de bien">
            {(id) => (
              <select
                id={id}
                name="property_type"
                defaultValue={item?.property_type || "Appartement"}
              >
                {["Appartement", "Maison", "Terrain", "Local", "Autre"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            )}
          </Field>
          <Field label="Type de vendeur">
            {(id) => (
              <select
                id={id}
                name="seller_type"
                defaultValue={item?.seller_type || "unknown"}
              >
                {Object.entries(sellerLabels).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="État de l’annonce">
            {(id) => (
              <select
                id={id}
                name="status"
                defaultValue={item?.status || "active"}
              >
                {Object.entries(statusLabels).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Droits / origine des données">
            {(id) => (
              <input
                id={id}
                name="rights_note"
                maxLength={500}
                defaultValue={item?.rights_note || ""}
              />
            )}
          </Field>
          <Field label="Justification de l’observation de prix">
            {(id) => (
              <input
                id={id}
                name="observation_note"
                maxLength={500}
                placeholder="Ex. prix constaté sur la fiche fournie"
              />
            )}
          </Field>
          <div className="radar-full">
            <Field label="Description déclarée">
              {(id) => (
                <textarea
                  id={id}
                  name="description"
                  maxLength={10000}
                  rows={4}
                  defaultValue={item?.description || ""}
                />
              )}
            </Field>
          </div>
        </fieldset>
        <p className="commercial-status">
          Les coordonnées sont saisies manuellement ; aucun géocodage d’adresse
          n’est effectué.
        </p>
        <div className="commercial-actions">
          <Button
            type="button"
            variant="outline"
            disabled={lock.busy}
            onClick={guard.close}
          >
            Annuler
          </Button>
          <Button disabled={lock.busy}>
            {lock.busy ? "Enregistrement…" : "Enregistrer l’annonce"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
