import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { prescriptionService } from "../services/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const Spinner = () => (
  <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
    <div style={{ width: 22, height: 22, border: "2px solid #e2e8f0", borderTop: "2px solid #1D6EF5", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
    Chargement…
  </div>
);

const ConfBadge = ({ v }) => {
  if (v == null) return null;
  const pct = Math.round(v * 100);
  const cls = pct >= 80 ? "bg-green-100 text-green-700" : pct >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>Confiance {pct}%</span>;
};

const OcrStatutBadge = ({ statut }) => {
  const cfg = {
    pending:    { label: "En attente",     cls: "bg-slate-100 text-slate-600" },
    processing: { label: "OCR en cours…",  cls: "bg-blue-100 text-blue-600" },
    processed:  { label: "OCR terminé",    cls: "bg-green-100 text-green-700" },
    failed:     { label: "OCR échoué",     cls: "bg-red-100 text-red-700" },
  }[statut] || { label: statut, cls: "bg-slate-100 text-slate-500" };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
};

const CHAMP_LABELS = {
  patient:            "Patient",
  medecin:            "Médecin",
  datePrescription:   "Date prescription",
  typeTransportAutorise: "Type de transport",
  mobilite:           "Mobilité",
  destination:        "Destination",
  allerRetour:        "Aller-retour",
  oxygene:            "Oxygène",
  brancardage:        "Brancardage",
  frequence:          "Fréquence",
  motif:              "Motif",
  remarques:          "Remarques",
};

// ── Composants formulaire ──────────────────────────────────────────────────────

function FieldRow({ label, uncertain, children }) {
  return (
    <div className={`grid grid-cols-3 gap-3 items-start py-3 border-b border-slate-100 last:border-0 ${uncertain ? "bg-amber-50 -mx-4 px-4 rounded" : ""}`}>
      <div className="text-xs font-semibold text-slate-600 pt-2">
        {label}
        {uncertain && <span className="ml-1 text-amber-500 text-xs">(incertain)</span>}
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

function FInput({ value, onChange, placeholder = "" }) {
  return (
    <input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1D6EF5] focus:ring-1 focus:ring-[#1D6EF5]/20"
    />
  );
}

function FTextarea({ value, onChange, rows = 2 }) {
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1D6EF5] focus:ring-1 focus:ring-[#1D6EF5]/20 resize-none"
    />
  );
}

function FCheckbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function PrescriptionValidation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [motifRejet, setMotifRejet] = useState("");

  // Données corrigées (initialisées depuis l'extraction OCR)
  const [fields, setFields] = useState({});
  const [notes, setNotes] = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await prescriptionService.getValidation(id);
      setPrescription(data);
      const src = data.validation?.donneesCorrigees
        || data.validation?.donneesOriginales
        || data.ocr?.donneesExtraites
        || data.extractionIA
        || {};
      setFields(src);
      setNotes(data.validation?.notesCorrection || "");
    } catch (e) {
      setError(e.response?.data?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Rafraîchissement auto si OCR en cours
  useEffect(() => {
    if (!prescription) return;
    if (prescription.ocr?.statut !== "processing") return;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [prescription, load]);

  const setField = (key, val) => setFields((p) => ({ ...p, [key]: val }));
  const setNestedField = (parent, key, val) => setFields((p) => ({
    ...p,
    [parent]: { ...(p[parent] || {}), [key]: val },
  }));

  const handleSaveCorrection = async () => {
    setSaving(true);
    try {
      const { data } = await prescriptionService.correct(id, fields, notes);
      setPrescription(data);
      showToast("Corrections sauvegardées");
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur de sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!window.confirm("Confirmer la validation définitive de cette prescription ?")) return;
    setSaving(true);
    try {
      await prescriptionService.validatePmt(id, fields);
      showToast("Prescription validée");
      setTimeout(() => navigate("/prescriptions"), 1500);
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur lors de la validation", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!motifRejet.trim()) return;
    setSaving(true);
    try {
      await prescriptionService.rejectPmt(id, motifRejet);
      showToast("Prescription rejetée");
      setTimeout(() => navigate("/prescriptions"), 1500);
    } catch (e) {
      showToast(e.response?.data?.message || "Erreur lors du rejet", "error");
    } finally {
      setSaving(false);
      setRejectModal(false);
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (loading) return <Spinner />;
  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-600 mb-4">{error}</p>
      <button onClick={() => navigate(-1)} className="text-blue-600 underline text-sm">Retour</button>
    </div>
  );
  if (!prescription) return null;

  const uncertain = new Set(prescription.ocr?.champsIncertains || []);
  const ocrStatut = prescription.ocr?.statut || "pending";
  const valStatut = prescription.validation?.statut || "en_attente";
  const isValidated = valStatut === "valide";
  const isRejected  = valStatut === "rejete";
  const isReadonly  = isValidated || isRejected;

  const docUrl = prescription.document?.fileUrl || prescription.fichierUrl || "";
  const mimeType = prescription.document?.mimeType || "";
  const isImage = mimeType.startsWith("image/");
  const isPdf   = mimeType === "application/pdf";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type === "error" ? "bg-red-600 text-white" : "bg-green-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="font-bold text-slate-800 text-lg">
              Validation PMT — {prescription.numero}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Créée le {fmtDate(prescription.createdAt)}
              {prescription.patientId && ` · Patient : ${prescription.patientId.prenom} ${prescription.patientId.nom}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <OcrStatutBadge statut={ocrStatut} />
          <ConfBadge v={prescription.ocr?.confiance ?? prescription.confiance} />
          {isValidated && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Validée</span>}
          {isRejected  && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Rejetée</span>}
        </div>
      </div>

      {/* OCR processing banner */}
      {ocrStatut === "processing" && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 text-sm text-blue-700 flex items-center gap-2">
          <div style={{ width: 14, height: 14, border: "2px solid #bfdbfe", borderTop: "2px solid #2563eb", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
          Extraction OCR en cours… La page se rafraîchit automatiquement.
        </div>
      )}

      {ocrStatut === "failed" && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-700">
          L'extraction OCR a échoué. Veuillez remplir les champs manuellement.
        </div>
      )}

      {/* Champs manquants */}
      {(prescription.champsManquants || []).length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-700">
          Champs manquants détectés : {(prescription.champsManquants || []).join(", ")}
        </div>
      )}

      {/* Corps — deux colonnes */}
      <div className="flex h-[calc(100vh-120px)]">

        {/* Colonne gauche — Aperçu document */}
        <div className="w-1/2 border-r border-slate-200 bg-white flex flex-col">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Document original</span>
            {docUrl && (
              <a href={docUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                Ouvrir
              </a>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50">
            {!docUrl ? (
              <div className="text-center text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-2 block">description</span>
                <p className="text-sm">Aucun document joint</p>
              </div>
            ) : isImage ? (
              <img src={docUrl} alt="PMT" className="max-w-full max-h-full object-contain rounded shadow" />
            ) : isPdf ? (
              <iframe
                src={docUrl}
                title="PMT PDF"
                className="w-full h-full rounded shadow border-0"
              />
            ) : (
              <div className="text-center text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-2 block">insert_drive_file</span>
                <p className="text-sm">Aperçu non disponible</p>
                <a href={docUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-sm underline mt-2 inline-block">Télécharger</a>
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite — Formulaire de correction */}
        <div className="w-1/2 flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4">

            {/* Info statut validation */}
            {valStatut === "valide" && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                Prescription validée le {fmtDate(prescription.validation?.valideAt || prescription.valideAt)}.
              </div>
            )}
            {valStatut === "rejete" && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                Prescription rejetée — motif : {prescription.validation?.motifRejet || "—"}
              </div>
            )}

            {/* Section Patient */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Patient extrait</h3>
              <div className="bg-white rounded-xl border border-slate-200 px-4 divide-y divide-slate-100">
                <FieldRow label="Nom" uncertain={uncertain.has("patient.nom")}>
                  <FInput value={fields.patient?.nom} onChange={(v) => setNestedField("patient", "nom", v)} placeholder="NOM" />
                </FieldRow>
                <FieldRow label="Prénom" uncertain={uncertain.has("patient.prenom")}>
                  <FInput value={fields.patient?.prenom} onChange={(v) => setNestedField("patient", "prenom", v)} placeholder="Prénom" />
                </FieldRow>
                <FieldRow label="N° Sécu" uncertain={uncertain.has("patient.numeroSecu")}>
                  <FInput value={fields.patient?.numeroSecu} onChange={(v) => setNestedField("patient", "numeroSecu", v)} placeholder="1 XX XX XX XXX XXX XX" />
                </FieldRow>
                <FieldRow label="Date naissance" uncertain={uncertain.has("patient.dateNaissance")}>
                  <FInput type="date" value={fields.patient?.dateNaissance} onChange={(v) => setNestedField("patient", "dateNaissance", v)} />
                </FieldRow>
              </div>
            </div>

            {/* Section Médecin */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Médecin prescripteur</h3>
              <div className="bg-white rounded-xl border border-slate-200 px-4 divide-y divide-slate-100">
                <FieldRow label="Nom" uncertain={uncertain.has("medecin.nom")}>
                  <FInput value={fields.medecin?.nom} onChange={(v) => setNestedField("medecin", "nom", v)} placeholder="Dr NOM" />
                </FieldRow>
                <FieldRow label="N° RPPS" uncertain={uncertain.has("medecin.rpps")}>
                  <FInput value={fields.medecin?.rpps} onChange={(v) => setNestedField("medecin", "rpps", v)} placeholder="RPPS" />
                </FieldRow>
                <FieldRow label="Spécialité" uncertain={uncertain.has("medecin.specialite")}>
                  <FInput value={fields.medecin?.specialite} onChange={(v) => setNestedField("medecin", "specialite", v)} placeholder="Généraliste" />
                </FieldRow>
              </div>
            </div>

            {/* Section Transport */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Prescription de transport</h3>
              <div className="bg-white rounded-xl border border-slate-200 px-4 divide-y divide-slate-100">
                <FieldRow label="Date prescription" uncertain={uncertain.has("datePrescription")}>
                  <FInput type="date" value={fields.datePrescription} onChange={(v) => setField("datePrescription", v)} />
                </FieldRow>
                <FieldRow label="Type transport autorisé" uncertain={uncertain.has("typeTransportAutorise")}>
                  <select
                    value={fields.typeTransportAutorise || ""}
                    onChange={(e) => setField("typeTransportAutorise", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">— Sélectionner —</option>
                    <option>VSL</option>
                    <option>Ambulance</option>
                    <option>TPMR</option>
                    <option>Taxi</option>
                    <option>Autre</option>
                  </select>
                </FieldRow>
                <FieldRow label="Mobilité" uncertain={uncertain.has("mobilite")}>
                  <select
                    value={fields.mobilite || ""}
                    onChange={(e) => setField("mobilite", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">— Sélectionner —</option>
                    <option>ASSIS</option>
                    <option>DEMI_ASSIS</option>
                    <option>ALLONGE</option>
                    <option>FAUTEUIL</option>
                  </select>
                </FieldRow>
                <FieldRow label="Destination" uncertain={uncertain.has("destination")}>
                  <FInput value={fields.destination} onChange={(v) => setField("destination", v)} placeholder="Établissement destination" />
                </FieldRow>
                <FieldRow label="Aller-retour" uncertain={uncertain.has("allerRetour")}>
                  <FCheckbox checked={fields.allerRetour} onChange={(v) => setField("allerRetour", v)} label="Aller-retour prescrit" />
                </FieldRow>
                <FieldRow label="Oxygène" uncertain={uncertain.has("oxygene")}>
                  <FCheckbox checked={fields.oxygene} onChange={(v) => setField("oxygene", v)} label="Transport avec oxygène" />
                </FieldRow>
                <FieldRow label="Brancardage" uncertain={uncertain.has("brancardage")}>
                  <FCheckbox checked={fields.brancardage} onChange={(v) => setField("brancardage", v)} label="Brancardage requis" />
                </FieldRow>
                <FieldRow label="Fréquence" uncertain={uncertain.has("frequence")}>
                  <FInput value={fields.frequence} onChange={(v) => setField("frequence", v)} placeholder="Ex : 3x/semaine" />
                </FieldRow>
                <FieldRow label="Motif" uncertain={uncertain.has("motif")}>
                  <FInput value={fields.motif} onChange={(v) => setField("motif", v)} placeholder="Motif de transport" />
                </FieldRow>
                <FieldRow label="Remarques" uncertain={uncertain.has("remarques")}>
                  <FTextarea value={fields.remarques} onChange={(v) => setField("remarques", v)} rows={3} />
                </FieldRow>
              </div>
            </div>

            {/* Notes correcteur */}
            {!isReadonly && (
              <div className="mb-5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Notes de correction</h3>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <FTextarea value={notes} onChange={setNotes} rows={3} />
                  <p className="text-xs text-slate-400 mt-1">Ces notes sont journalisées dans l'historique de validation.</p>
                </div>
              </div>
            )}

            {/* Historique */}
            {(prescription.validationHistory || []).length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Historique</h3>
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {prescription.validationHistory.slice(-6).reverse().map((h, i) => (
                    <div key={i} className="px-4 py-3 flex items-start gap-3">
                      <span className="material-symbols-outlined text-slate-400 text-sm mt-0.5">history</span>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{h.action}</p>
                        {h.notes && <p className="text-xs text-slate-500 mt-0.5">{h.notes}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">{fmtDate(h.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Barre d'actions */}
          {!isReadonly && (
            <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-3">
              <button
                onClick={() => setRejectModal(true)}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors"
              >
                Rejeter
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveCorrection}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-300 transition-colors"
                >
                  {saving ? "Sauvegarde…" : "Sauvegarder corrections"}
                </button>
                <button
                  onClick={handleValidate}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#1D6EF5] hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                >
                  {saving ? "Validation…" : "Valider la prescription"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal rejet */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="font-bold text-slate-800 text-lg mb-4">Rejeter la prescription</h2>
            <p className="text-sm text-slate-600 mb-4">
              Précisez le motif du rejet. La prescription sera marquée "Incomplet" et le dispatcher sera notifié.
            </p>
            <textarea
              value={motifRejet}
              onChange={(e) => setMotifRejet(e.target.value)}
              rows={3}
              placeholder="Motif du rejet…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200 resize-none"
            />
            <div className="flex gap-3 mt-5 justify-end">
              <button
                onClick={() => setRejectModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={!motifRejet.trim() || saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50"
              >
                {saving ? "Rejet…" : "Confirmer le rejet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
