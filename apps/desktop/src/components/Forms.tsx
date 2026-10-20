import {
  cloneElement,
  isValidElement,
  useId,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Save, Upload, AlertCircle } from "lucide-react";
import { api } from "../api";
import type { Contact, Mandate } from "../types";
import { kinds, statuses } from "../types";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { useFormGuard } from "./FormGuard";

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  const id = useId();
  return (
    <div className={`field ${full ? "field-full" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id: string }>, { id })
        : children}
    </div>
  );
}
function ErrorBox({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  return message ? (
    <div className="error" role="alert" ref={ref} tabIndex={-1}>
      <AlertCircle size={17} />
      {message}
    </div>
  ) : null;
}

export function ContactForm({
  contact,
  defaultKind,
  onClose,
  onSaved,
}: {
  contact?: Contact;
  defaultKind: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [kind, setKind] = useState(contact?.kind || defaultKind);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const guard = useFormGuard(onClose, busy);
  const submitting = useRef(false);
  const [archive, setArchive] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const val = (k: string) => String(f.get(k) || "");
    const data = {
      version: contact?.version,
      name: val("name"),
      email: val("email") || null,
      phone: val("phone"),
      kind,
      city: val("city"),
      source: val("source"),
      notes: val("notes"),
      criteria: ["buyer", "both"].includes(kind)
        ? {
            budget_min: val("budget_min") || "0",
            budget_max: val("budget_max") || "0",
            min_surface: val("min_surface") || "0",
            bedrooms: Number(val("bedrooms")),
            sectors: val("sectors"),
            financing: val("financing"),
            mandatory: val("mandatory"),
          }
        : null,
    };
    try {
      await api("/contacts" + (contact ? "/" + contact.id : ""), {
        method: contact ? "PUT" : "POST",
        body: JSON.stringify(data),
      });
      guard.clean();
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function archiveContact() {
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    setBusy(true);
    try {
      await api("/contacts/" + contact!.id, { method: "DELETE" });
      guard.clean();
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={guard.close}
      title={contact ? contact.name : "Nouveau contact"}
      description="Les champs marqués d’un astérisque sont obligatoires."
      wide
    >
      {guard.notice}
      <form onSubmit={submit} onChange={guard.markDirty}>
        <fieldset className="form-fields" disabled={busy}>
          <div className="form-grid">
            <Field label="Nom complet *">
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={contact?.name}
                placeholder="Prénom et nom"
              />
            </Field>
            <Field label="Profil *">
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="buyer">Acquéreur</option>
                <option value="seller">Vendeur</option>
                <option value="both">Vendeur et acquéreur</option>
                <option value="professional">Professionnel</option>
              </select>
            </Field>
            <Field label="E-mail">
              <input
                name="email"
                type="email"
                defaultValue={contact?.email || ""}
                placeholder="nom@exemple.fr"
              />
            </Field>
            <Field label="Téléphone">
              <input
                name="phone"
                type="tel"
                maxLength={30}
                defaultValue={contact?.phone}
                placeholder="06 …"
              />
            </Field>
            <Field label="Commune">
              <input
                name="city"
                maxLength={100}
                defaultValue={contact?.city}
                placeholder="Annecy"
              />
            </Field>
            <Field label="Origine du contact">
              <input
                name="source"
                maxLength={120}
                defaultValue={contact?.source || "Saisie manuelle"}
              />
            </Field>
            <fieldset
              className="criteria-group"
              hidden={!["buyer", "both"].includes(kind)}
              disabled={!["buyer", "both"].includes(kind)}
            >
              <div className="form-section">Projet d’acquisition</div>
              <Field label="Budget minimum (€)">
                <input
                  name="budget_min"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={contact?.criteria?.budget_min || "0"}
                />
              </Field>
              <Field label="Budget maximum (€)">
                <input
                  name="budget_max"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={contact?.criteria?.budget_max || "0"}
                />
              </Field>
              <Field label="Surface minimum (m²)">
                <input
                  name="min_surface"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={contact?.criteria?.min_surface || "0"}
                />
              </Field>
              <Field label="Chambres minimum">
                <input
                  name="bedrooms"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={contact?.criteria?.bedrooms || 0}
                />
              </Field>
              <Field label="Secteurs recherchés">
                <input
                  name="sectors"
                  maxLength={500}
                  defaultValue={contact?.criteria?.sectors}
                  placeholder="Annecy, Sevrier…"
                />
              </Field>
              <Field label="Financement">
                <select
                  name="financing"
                  defaultValue={contact?.criteria?.financing || "À qualifier"}
                >
                  <option>À qualifier</option>
                  <option>Simulation réalisée</option>
                  <option>Accord de principe</option>
                  <option>Achat comptant</option>
                </select>
              </Field>
              <Field label="Critères impératifs" full>
                <textarea
                  name="mandatory"
                  maxLength={5000}
                  defaultValue={contact?.criteria?.mandatory}
                  placeholder="Ascenseur, balcon, absence de travaux…"
                />
              </Field>
            </fieldset>
            <Field label="Notes du dossier" full>
              <textarea
                name="notes"
                maxLength={10000}
                defaultValue={contact?.notes}
              />
            </Field>
          </div>
        </fieldset>
        <ErrorBox message={error} />
        <div className="form-footer">
          {contact && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => (archive ? archiveContact() : setArchive(true))}
            >
              {archive ? "Confirmer l’archivage" : "Archiver"}
            </Button>
          )}
          <span className="spacer" />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={guard.close}
          >
            Annuler
          </Button>
          <Button disabled={busy}>
            <Save size={16} />
            {busy ? "Enregistrement…" : "Enregistrer le contact"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function MandateForm({
  mandate,
  contacts,
  onClose,
  onSaved,
}: {
  mandate?: Mandate;
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [kind, setKind] = useState(mandate?.kind || "exclusive");
  const [busy, setBusy] = useState(false);
  const guard = useFormGuard(onClose, busy);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const sellers = contacts.filter((c) => ["seller", "both"].includes(c.kind));
  const p = mandate?.property;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) || "");
    const data = {
      version: mandate?.version,
      reference: v("reference"),
      seller_id: v("seller_id"),
      kind,
      status: v("status"),
      signed_date: v("signed_date"),
      end_date: v("end_date"),
      price: v("price"),
      fees: v("fees") || "0",
      partner_name: v("partner_name"),
      partner_terms: v("partner_terms"),
      commercialization_authorized: f.get("authorized") === "on",
      notes: v("notes"),
      property: {
        title: v("title"),
        address: v("address"),
        city: v("city"),
        property_type: v("property_type"),
        surface: v("surface"),
        rooms: Number(v("rooms")),
        dpe: v("dpe"),
      },
    };
    try {
      await api("/mandates" + (mandate ? "/" + mandate.id : ""), {
        method: mandate ? "PUT" : "POST",
        body: JSON.stringify(data),
      });
      guard.clean();
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={guard.close}
      title={mandate ? `Mandat ${mandate.reference}` : "Nouveau mandat"}
      description="Un bien commercialisé, un vendeur identifié, un dossier centralisé."
      wide
    >
      {guard.notice}
      <form onSubmit={submit} onChange={guard.markDirty}>
        <fieldset className="form-fields" disabled={busy}>
          <div className="form-grid">
            <Field label="Référence *">
              <input
                name="reference"
                required
                minLength={2}
                maxLength={40}
                defaultValue={mandate?.reference}
                placeholder="M-2026-001"
              />
            </Field>
            <Field label="Vendeur *">
              <select
                name="seller_id"
                required
                defaultValue={mandate?.seller_id || ""}
              >
                <option value="" disabled>
                  Sélectionner un vendeur
                </option>
                {sellers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {!sellers.length && (
              <div className="field-full error">
                Créez d’abord une fiche vendeur dans vos contacts.
              </div>
            )}
            <Field label="Intitulé du bien *" full>
              <input
                name="title"
                required
                minLength={3}
                maxLength={180}
                defaultValue={p?.title}
                placeholder="Appartement T3 avec terrasse"
              />
            </Field>
            <Field label="Adresse du bien *">
              <input
                name="address"
                required
                minLength={3}
                maxLength={250}
                defaultValue={p?.address}
              />
            </Field>
            <Field label="Commune *">
              <input
                name="city"
                required
                minLength={2}
                maxLength={100}
                defaultValue={p?.city || "Annecy"}
              />
            </Field>
            <Field label="Type de bien *">
              <select
                name="property_type"
                defaultValue={p?.property_type || "Appartement"}
              >
                {["Appartement", "Maison", "Terrain", "Local", "Autre"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="DPE">
              <select name="dpe" defaultValue={p?.dpe || "Inconnu"}>
                {["Inconnu", "A", "B", "C", "D", "E", "F", "G", "Exempté"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Surface (m²) *">
              <input
                name="surface"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                required
                defaultValue={p?.surface}
              />
            </Field>
            <Field label="Nombre de pièces *">
              <input
                name="rooms"
                type="number"
                min="1"
                max="100"
                required
                defaultValue={p?.rooms || 1}
              />
            </Field>
            <div className="form-section">Conditions du mandat</div>
            <Field label="Type de mandat *">
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(kinds).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Statut *">
              <select
                name="status"
                defaultValue={mandate?.status || "preparation"}
              >
                {Object.entries(statuses).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prix de vente (€) *">
              <input
                name="price"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={mandate?.price}
              />
            </Field>
            <Field label="Honoraires du mandat (€)">
              <input
                name="fees"
                type="number"
                min="0"
                step="0.01"
                defaultValue={mandate?.fees || "0"}
              />
            </Field>
            <Field label="Date de signature *">
              <input
                name="signed_date"
                type="date"
                required
                defaultValue={mandate?.signed_date || today}
              />
            </Field>
            <Field label="Date d’échéance *">
              <input
                name="end_date"
                type="date"
                required
                defaultValue={mandate?.end_date}
              />
            </Field>
            <fieldset
              className="criteria-group"
              hidden={kind !== "partner"}
              disabled={kind !== "partner"}
            >
              <Field label="Agence partenaire *" full>
                <input
                  name="partner_name"
                  required
                  maxLength={180}
                  defaultValue={mandate?.partner_name}
                />
              </Field>
              <Field label="Conditions et partage d’honoraires *" full>
                <textarea
                  name="partner_terms"
                  required
                  maxLength={5000}
                  defaultValue={mandate?.partner_terms}
                />
              </Field>
              <label className="checkbox field-full">
                <input
                  name="authorized"
                  type="checkbox"
                  defaultChecked={mandate?.commercialization_authorized}
                />
                Autorisation de commercialisation obtenue
              </label>
            </fieldset>
            <Field label="Notes et autorisations vendeur" full>
              <textarea
                name="notes"
                maxLength={10000}
                defaultValue={mandate?.notes}
                placeholder="Consignez notamment les autorisations de modification de prix."
              />
            </Field>
          </div>
        </fieldset>
        <ErrorBox message={error} />
        <div className="form-footer">
          <span className="spacer" />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={guard.close}
          >
            Annuler
          </Button>
          <Button disabled={busy || !sellers.length}>
            <Save size={16} />
            {busy ? "Enregistrement…" : "Enregistrer le mandat"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function DocumentForm({
  contacts,
  mandates,
  onClose,
  onSaved,
}: {
  contacts: Contact[];
  mandates: Mandate[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const guard = useFormGuard(onClose, busy);
  const submitting = useRef(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const body = new FormData(e.currentTarget);
      const file = body.get("file");
      if (
        !(file instanceof File) ||
        file.size === 0 ||
        file.size > 15 * 1024 * 1024
      ) {
        throw new Error("Choisissez un fichier non vide de 15 Mo maximum.");
      }
      await api("/documents", {
        method: "POST",
        body,
      });
      guard.clean();
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={guard.close}
      title="Ajouter un document"
      description="PDF, Word, Excel, JPG ou PNG · 15 Mo maximum."
    >
      {guard.notice}
      <form onSubmit={submit} onChange={guard.markDirty}>
        <fieldset className="form-fields" disabled={busy}>
          <div className="form-grid">
            <Field label="Fichier *" full>
              <input
                name="file"
                type="file"
                required
                accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
              />
            </Field>
            <Field label="Catégorie" full>
              <select name="category">
                {[
                  "Mandat",
                  "Diagnostic / DPE",
                  "Plan",
                  "Offre",
                  "Compromis",
                  "Justificatif",
                  "Autre",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Contact associé" full>
              <select name="contact_id">
                <option value="">Aucun</option>
                {contacts.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mandat associé" full>
              <select name="mandate_id">
                <option value="">Aucun</option>
                {mandates.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.reference} · {m.property.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </fieldset>
        <ErrorBox message={error} />
        <div className="form-footer">
          <span className="spacer" />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={guard.close}
          >
            Annuler
          </Button>
          <Button disabled={busy}>
            <Upload size={16} />
            {busy ? "Import en cours…" : "Importer le document"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
