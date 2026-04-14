// Fichier : client/src/pages/NouveauTransport.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { transportService } from "../services/api";

// Mobilité → type véhicule automatique
const MOBILITE_TYPE = {
  ASSIS: "VSL",
  FAUTEUIL_ROULANT: "TPMR",
  ALLONGE: "AMBULANCE",
  CIVIERE: "AMBULANCE",
};

const MOTIFS = [
  "Dialyse", "Chimiothérapie", "Radiothérapie", "Consultation",
  "Hospitalisation", "Sortie hospitalisation", "Rééducation", "Analyse", "Autre",
];

const JOURS = [
  { num: 1, label: "Lun" },
  { num: 2, label: "Mar" },
  { num: 3, label: "Mer" },
  { num: 4, label: "Jeu" },
  { num: 5, label: "Ven" },
  { num: 6, label: "Sam" },
  { num: 7, label: "Dim" },
];

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-white transition-colors";

const sectionCls = "bg-white rounded-xl border border-slate-200 p-5 mb-4";

function Section({ title, icon, children }) {
  return (
    <div className={sectionCls}>
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <span className="material-symbols-outlined text-primary text-xl">
          {icon}
        </span>
        <h3 className="font-brand font-bold text-navy text-sm uppercase tracking-wide">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children, error }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function NouveauTransport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    // Patient
    patientNom: "",
    patientPrenom: "",
    patientTelephone: "",
    patientMobilite: "ASSIS",
    patientOxygene: false,
    patientBrancardage: false,
    patientAccompagnateur: false,
    patientNotes: "",
    // Transport
    typeTransport: "VSL",
    motif: "Consultation",
    dateTransport: "",
    heureRDV: "",
    allerRetour: false,
    // Adresse départ
    departRue: "",
    departVille: "Nice",
    departCodePostal: "06000",
    // Adresse destination
    destNom: "",
    destRue: "",
    destVille: "Nice",
    destCodePostal: "06000",
    destService: "",
    // Récurrence
    recurrenceActive: false,
    recurrenceFrequence: "hebdomadaire",
    recurrenceJours: [],
    recurrenceDateFin: "",
    // Notes
    notes: "",
  });

  const set = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Auto-sélection type véhicule selon mobilité
      if (key === "patientMobilite") {
        next.typeTransport = MOBILITE_TYPE[value] || "VSL";
      }
      return next;
    });
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  const toggleJour = (num) => {
    setForm((f) => ({
      ...f,
      recurrenceJours: f.recurrenceJours.includes(num)
        ? f.recurrenceJours.filter((j) => j !== num)
        : [...f.recurrenceJours, num],
    }));
  };

  const validate = () => {
    const e = {};
    if (!form.patientNom.trim()) e.patientNom = "Nom obligatoire";
    if (!form.motif) e.motif = "Motif obligatoire";
    if (!form.dateTransport) e.dateTransport = "Date obligatoire";
    if (!form.heureRDV) e.heureRDV = "Heure obligatoire";
    if (!form.departRue.trim()) e.departRue = "Adresse de départ obligatoire";
    if (!form.destRue.trim() && !form.destNom.trim())
      e.destRue = "Adresse destination obligatoire";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    setErreur(null);
    try {
      const payload = {
        patient: {
          nom: form.patientNom.trim(),
          prenom: form.patientPrenom.trim(),
          telephone: form.patientTelephone.trim(),
          mobilite: form.patientMobilite,
          oxygene: form.patientOxygene,
          brancardage: form.patientBrancardage,
          accompagnateur: form.patientAccompagnateur,
          notes: form.patientNotes,
        },
        typeTransport: form.typeTransport,
        motif: form.motif,
        dateTransport: form.dateTransport,
        heureRDV: form.heureRDV,
        allerRetour: form.allerRetour,
        adresseDepart: {
          rue: form.departRue.trim(),
          ville: form.departVille.trim(),
          codePostal: form.departCodePostal.trim(),
        },
        adresseDestination: {
          nom: form.destNom.trim(),
          rue: form.destRue.trim(),
          ville: form.destVille.trim(),
          codePostal: form.destCodePostal.trim(),
          service: form.destService.trim(),
        },
        recurrence: {
          active: form.recurrenceActive,
          frequence: form.recurrenceActive ? form.recurrenceFrequence : "",
          joursSemaine: form.recurrenceActive ? form.recurrenceJours : [],
          dateFin: form.recurrenceActive && form.recurrenceDateFin
            ? form.recurrenceDateFin
            : undefined,
        },
        notes: form.notes,
      };

      const { data } = await transportService.create(payload);
      navigate(`/transports/${data.transport?._id || data._id}`);
    } catch (err) {
      setErreur(
        err.response?.data?.message ||
          "Erreur lors de la création du transport.",
      );
    } finally {
      setLoading(false);
    }
  };

  const typeLabel =
    form.typeTransport === "VSL"
      ? "VSL — Véhicule Sanitaire Léger"
      : form.typeTransport === "TPMR"
        ? "TPMR — Transport Personnes à Mobilité Réduite"
        : "Ambulance";

  return (
    <div className="p-7 fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-surface transition-colors"
        >
          <span className="material-symbols-outlined text-slate-500">
            arrow_back
          </span>
        </button>
        <div>
          <h1 className="font-brand font-bold text-navy text-xl">
            Nouveau transport
          </h1>
          <p className="text-slate-400 text-sm">
            Transport sanitaire non urgent
          </p>
        </div>
      </div>

      {erreur && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          {erreur}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Patient ── */}
        <Section title="Patient" icon="personal_injury">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom" required error={errors.patientNom}>
              <input
                type="text"
                value={form.patientNom}
                onChange={(e) => set("patientNom", e.target.value)}
                className={inputCls}
                placeholder="Nom de famille"
              />
            </Field>
            <Field label="Prénom">
              <input
                type="text"
                value={form.patientPrenom}
                onChange={(e) => set("patientPrenom", e.target.value)}
                className={inputCls}
                placeholder="Prénom"
              />
            </Field>
            <Field label="Téléphone">
              <input
                type="tel"
                value={form.patientTelephone}
                onChange={(e) => set("patientTelephone", e.target.value)}
                className={inputCls}
                placeholder="06 00 00 00 00"
              />
            </Field>
            <Field label="Mobilité" required>
              <select
                value={form.patientMobilite}
                onChange={(e) => set("patientMobilite", e.target.value)}
                className={inputCls}
              >
                <option value="ASSIS">Assis (autonome)</option>
                <option value="FAUTEUIL_ROULANT">Fauteuil roulant</option>
                <option value="ALLONGE">Allongé</option>
                <option value="CIVIERE">Civière</option>
              </select>
            </Field>
          </div>
          {/* Type transport auto */}
          <div className="mt-3 flex items-center gap-2 text-sm text-primary bg-blue-50 rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-base">info</span>
            Type de transport :{" "}
            <span className="font-bold ml-1">{typeLabel}</span>
          </div>
          {/* Besoins spéciaux */}
          <div className="flex flex-wrap gap-4 mt-4">
            {[
              { key: "patientOxygene", label: "Oxygène" },
              { key: "patientBrancardage", label: "Brancardage" },
              { key: "patientAccompagnateur", label: "Accompagnateur" },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => set(key, e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* ── Planification ── */}
        <Section title="Planification" icon="calendar_month">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Motif" required error={errors.motif}>
              <select
                value={form.motif}
                onChange={(e) => set("motif", e.target.value)}
                className={inputCls}
              >
                {MOTIFS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
            <div /> {/* spacer */}
            <Field label="Date du transport" required error={errors.dateTransport}>
              <input
                type="date"
                value={form.dateTransport}
                onChange={(e) => set("dateTransport", e.target.value)}
                className={inputCls}
                min={new Date().toISOString().split("T")[0]}
              />
            </Field>
            <Field label="Heure de RDV" required error={errors.heureRDV}>
              <input
                type="time"
                value={form.heureRDV}
                onChange={(e) => set("heureRDV", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={form.allerRetour}
              onChange={(e) => set("allerRetour", e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-slate-700 font-medium">
              Aller-retour (créer automatiquement le transport retour)
            </span>
          </label>
        </Section>

        {/* ── Adresses ── */}
        <Section title="Adresses" icon="location_on">
          <div className="mb-4">
            <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-3">
              Adresse de départ
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Rue" required error={errors.departRue}>
                  <input
                    type="text"
                    value={form.departRue}
                    onChange={(e) => set("departRue", e.target.value)}
                    className={inputCls}
                    placeholder="Numéro et nom de la rue"
                  />
                </Field>
              </div>
              <Field label="Code postal">
                <input
                  type="text"
                  value={form.departCodePostal}
                  onChange={(e) => set("departCodePostal", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <div className="col-span-3">
                <Field label="Ville">
                  <input
                    type="text"
                    value={form.departVille}
                    onChange={(e) => set("departVille", e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-3">
              Adresse de destination
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <Field label="Nom de l'établissement">
                  <input
                    type="text"
                    value={form.destNom}
                    onChange={(e) => set("destNom", e.target.value)}
                    className={inputCls}
                    placeholder="Ex : CHU de Nice, Hôpital Pasteur…"
                  />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label="Service / Unité">
                  <input
                    type="text"
                    value={form.destService}
                    onChange={(e) => set("destService", e.target.value)}
                    className={inputCls}
                    placeholder="Ex : Dialyse, Oncologie, Cardiologie…"
                  />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Rue" error={errors.destRue}>
                  <input
                    type="text"
                    value={form.destRue}
                    onChange={(e) => set("destRue", e.target.value)}
                    className={inputCls}
                    placeholder="Numéro et nom de la rue"
                  />
                </Field>
              </div>
              <Field label="Code postal">
                <input
                  type="text"
                  value={form.destCodePostal}
                  onChange={(e) => set("destCodePostal", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <div className="col-span-3">
                <Field label="Ville">
                  <input
                    type="text"
                    value={form.destVille}
                    onChange={(e) => set("destVille", e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Récurrence ── */}
        <Section title="Récurrence" icon="repeat">
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={form.recurrenceActive}
              onChange={(e) => set("recurrenceActive", e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm font-medium text-slate-700">
              Transport récurrent
            </span>
          </label>

          {form.recurrenceActive && (
            <div className="space-y-4 pl-6">
              <Field label="Fréquence">
                <select
                  value={form.recurrenceFrequence}
                  onChange={(e) => set("recurrenceFrequence", e.target.value)}
                  className={inputCls}
                >
                  <option value="hebdomadaire">Hebdomadaire</option>
                  <option value="bihebdomadaire">Bi-hebdomadaire</option>
                  <option value="mensuel">Mensuel</option>
                </select>
              </Field>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Jours de la semaine
                </p>
                <div className="flex gap-2 flex-wrap">
                  {JOURS.map(({ num, label }) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => toggleJour(num)}
                      className={`w-10 h-10 rounded-xl text-xs font-bold transition-colors ${
                        form.recurrenceJours.includes(num)
                          ? "bg-primary text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Date de fin">
                <input
                  type="date"
                  value={form.recurrenceDateFin}
                  onChange={(e) => set("recurrenceDateFin", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          )}
        </Section>

        {/* ── Notes ── */}
        <Section title="Notes" icon="notes">
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className={`${inputCls} resize-none`}
            rows={3}
            placeholder="Informations complémentaires, instructions particulières…"
          />
        </Section>

        {/* Boutons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-surface transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-primary/20"
          >
            {loading ? (
              <>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTop: "2px solid #fff",
                    borderRadius: "50%",
                    animation: "spin .7s linear infinite",
                  }}
                />
                Création…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">
                  check
                </span>
                Créer le transport
              </>
            )}
          </button>
        </div>
      </form>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
