import { useState, useEffect, useCallback } from "react";
import { vehicleService, equipementService, maintenanceService } from "../../services/api";

// ── Config ────────────────────────────────────────────────────────────────────
const TYPE_CFG = {
  VSL:       { icon: "directions_car",  iconColor: "bg-blue-100 text-blue-700",     gradient: "from-blue-800 to-blue-900"    },
  AMBULANCE: { icon: "airport_shuttle", iconColor: "bg-red-100 text-red-700",       gradient: "from-red-800 to-red-900"      },
  TPMR:      { icon: "accessible",      iconColor: "bg-purple-100 text-purple-700", gradient: "from-purple-800 to-purple-900" },
};

const STATUT_CFG = {
  "Disponible":   { label: "Disponible",   dot: "bg-green-500",  badge: "bg-green-100 text-green-700"   },
  "En service":   { label: "En service",   dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700" },
  "Maintenance":  { label: "Maintenance",  dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700" },
  "Hors service": { label: "Hors service", dot: "bg-red-500",    badge: "bg-red-100 text-red-700"       },
  "disponible":   { label: "Disponible",   dot: "bg-green-500",  badge: "bg-green-100 text-green-700"   },
  "en_mission":   { label: "En service",   dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700" },
  "maintenance":  { label: "Maintenance",  dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700" },
  "hors_service": { label: "Hors service", dot: "bg-red-500",    badge: "bg-red-100 text-red-700"       },
};

const ENERGIES = ["Diesel", "Essence", "Hybride", "Electrique", "GPL", "Hydrogène"];
const ENERGY_ICON = {
  Diesel: "🛢️", Essence: "⛽", Hybride: "🔋", Electrique: "⚡", GPL: "🌿", Hydrogène: "💧",
};

const EQ_LIST = [
  { key: "oxygene",       label: "Oxygène",       emoji: "🫁" },
  { key: "fauteuilRampe", label: "Fauteuil",       emoji: "♿" },
  { key: "brancard",      label: "Brancard",       emoji: "🛏️" },
  { key: "dae",           label: "DAE",            emoji: "💓" },
  { key: "aspirateur",    label: "Aspirateur",     emoji: "🌀" },
  { key: "climatisation", label: "Climatisation",  emoji: "❄️" },
];

const CAT_EQUIP = ["Défibrillateur", "Monitoring", "Ventilation", "Aspiration", "Perfusion", "Immobilisation", "Oxygène", "Autre"];

const ETAT_EQUIP_CFG = {
  "opérationnel":  { label: "Opérationnel",  color: "bg-green-100 text-green-700"   },
  "en-panne":      { label: "En panne",      color: "bg-red-100 text-red-700"       },
  "à-vérifier":   { label: "À vérifier",    color: "bg-yellow-100 text-yellow-700" },
  "retiré":        { label: "Retiré",        color: "bg-slate-100 text-slate-600"   },
  "en-réparation": { label: "En réparation", color: "bg-orange-100 text-orange-700" },
};

const ETATS_EQUIP = [
  { value: "opérationnel",  label: "Opérationnel" },
  { value: "en-panne",      label: "En panne" },
  { value: "à-vérifier",   label: "À vérifier" },
  { value: "retiré",        label: "Retiré" },
  { value: "en-réparation", label: "En réparation" },
];

const TYPES_MAINT = [
  "Révision complète", "Vidange", "Freins", "Pneumatiques",
  "Carrosserie", "Électricité", "Climatisation", "Contrôle technique", "Autre",
];

const STATUT_MAINT_CFG = {
  "planifié": { label: "Planifié", color: "bg-blue-100 text-blue-700"    },
  "en-cours": { label: "En cours", color: "bg-yellow-100 text-yellow-700" },
  "terminé":  { label: "Terminé",  color: "bg-green-100 text-green-700"  },
  "annulé":   { label: "Annulé",   color: "bg-slate-100 text-slate-500"  },
};

const STATUTS_MAINT = [
  { value: "planifié", label: "Planifié" },
  { value: "en-cours", label: "En cours" },
  { value: "terminé",  label: "Terminé"  },
  { value: "annulé",   label: "Annulé"   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDateInput(val) {
  if (!val) return "";
  try { return new Date(val).toISOString().split("T")[0]; } catch { return ""; }
}

function formatDate(val) {
  if (!val) return null;
  try { return new Date(val).toLocaleDateString("fr-FR"); } catch { return null; }
}

function getKm(v) {
  if (!v.kilometrage) return { actuel: 0, prochainVidange: null, prochainControle: null };
  if (typeof v.kilometrage === "object") return v.kilometrage;
  return { actuel: v.kilometrage, prochainVidange: null, prochainControle: null };
}

function getEq(v) {
  return {
    oxygene:       v.equipements?.oxygene       ?? v.equipeOxygene   ?? false,
    fauteuilRampe: v.equipements?.fauteuilRampe ?? v.equipeFauteuil  ?? false,
    brancard:      v.equipements?.brancard      ?? v.equipeBrancard  ?? false,
    dae:           v.equipements?.dae            ?? false,
    aspirateur:    v.equipements?.aspirateur     ?? false,
    climatisation: v.equipements?.climatisation  ?? false,
  };
}

function initForm(v) {
  const km = getKm(v);
  const eq = getEq(v);
  return {
    nom:              v.nom             || "",
    type:             v.type            || "VSL",
    immatriculation:  v.immatriculation || "",
    marque:           v.marque          || "",
    modele:           v.modele          || "",
    annee:            v.annee           || new Date().getFullYear(),
    couleur:          v.couleur         || "",
    numeroSerie:      v.numeroSerie     || "",
    typeEnergie:      v.typeEnergie     || "Diesel",
    consommationL100: v.consommationL100 ?? "",
    puissanceCv:      v.puissanceCv     ?? "",
    autonomieKm:      v.autonomieKm     ?? "",
    kilometrage: {
      actuel:           km.actuel            ?? 0,
      prochainVidange:  km.prochainVidange   ?? "",
      prochainControle: km.prochainControle  ?? "",
    },
    controleTechnique: {
      dateExpiration: toDateInput(v.controleTechnique?.dateExpiration),
    },
    assurance: {
      compagnie:      v.assurance?.compagnie      || "",
      numeroPolice:   v.assurance?.numeroPolice   || "",
      dateExpiration: toDateInput(v.assurance?.dateExpiration),
    },
    equipements: eq,
    capacite: {
      placesAssises:  v.capacite?.placesAssises  ?? 1,
      placesFauteuil: v.capacite?.placesFauteuil ?? 0,
      placesBrancard: v.capacite?.placesBrancard ?? 0,
    },
    statut: v.statut || "Disponible",
    notes:  v.notes  || "",
  };
}

// ── Micro-composants ──────────────────────────────────────────────────────────
const iCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-white transition-all";

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTop: "3px solid #2563eb", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
    </div>
  );
}

function Val({ children }) {
  const empty = children === null || children === undefined || children === "";
  return empty
    ? <span className="text-sm text-slate-400 italic">—</span>
    : <span className="text-sm text-slate-800 font-medium">{children}</span>;
}

function PanelSection({ title, icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-slate-400 text-base">{icon}</span>
        <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <span className="text-xs text-slate-500 shrink-0 w-32">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function EF({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Counter({ value, onChange, min = 0, max = 10 }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      <button type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-bold"
      >−</button>
      <span className="w-6 text-center font-mono font-bold text-navy text-sm">{value}</span>
      <button type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-bold"
      >+</button>
    </div>
  );
}

// ── Modal Équipement ──────────────────────────────────────────────────────────
function ModalEquipement({ vehicleId, vehicleNom, item, onClose, onSaved }) {
  const isEdit = !!item?._id;
  const [form, setForm] = useState({
    nom:           item?.nom        || "",
    categorie:     item?.categorie  || "Défibrillateur",
    etat:          item?.etat       || "opérationnel",
    numeroSerie:   item?.numeroSerie || "",
    notes:         item?.notes      || "",
    uniteAssignee: vehicleId,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const handleSave = async () => {
    if (!form.nom.trim()) { setError("Le nom est requis."); return; }
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await equipementService.update(item._id, form);
      } else {
        await equipementService.create(form);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-navy text-base">
            {isEdit ? "Modifier l'équipement" : "Ajouter un équipement"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500 text-sm">airport_shuttle</span>
            <span className="text-sm text-blue-700 font-semibold">{vehicleNom}</span>
            <span className="text-xs text-blue-400 ml-1">(assigné automatiquement)</span>
          </div>

          <EF label="Nom">
            <input type="text" value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              className={iCls} placeholder="Ex: DAE Zoll AED Plus" />
          </EF>

          <div className="grid grid-cols-2 gap-3">
            <EF label="Catégorie">
              <select value={form.categorie}
                onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
                className={iCls}>
                {CAT_EQUIP.map((c) => <option key={c}>{c}</option>)}
              </select>
            </EF>
            <EF label="État">
              <select value={form.etat}
                onChange={(e) => setForm((f) => ({ ...f, etat: e.target.value }))}
                className={iCls}>
                {ETATS_EQUIP.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </EF>
          </div>

          <EF label="N° Série">
            <input type="text" value={form.numeroSerie}
              onChange={(e) => setForm((f) => ({ ...f, numeroSerie: e.target.value }))}
              className={iCls} placeholder="Optionnel" />
          </EF>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
            {saving ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab Équipements ───────────────────────────────────────────────────────────
function TabEquipements({ vehicleId, vehicleNom }) {
  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await equipementService.getAll({ uniteAssignee: vehicleId, limit: 200 });
      const list = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.equipements || [];
      setItems(list);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [vehicleId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    try { await equipementService.delete(id); load(); } catch { /* silencieux */ }
    setConfirmDel(null);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.length} équipement(s)</p>
        <button onClick={() => { setEditItem(null); setShowModal(true); }}
          className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors">
          <span className="material-symbols-outlined text-sm">add</span>
          Ajouter
        </button>
      </div>

      {loading ? <Spinner /> : items.length === 0 ? (
        <div className="text-center py-10">
          <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 40 }}>medical_services</span>
          <p className="text-slate-400 text-sm mt-2">Aucun équipement assigné</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const etatCfg = ETAT_EQUIP_CFG[item.etat] || { label: item.etat, color: "bg-slate-100 text-slate-600" };
            return (
              <div key={item._id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy truncate">{item.nom}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400">{item.categorie}</span>
                    {item.numeroSerie && <span className="text-xs text-slate-400 font-mono">#{item.numeroSerie}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${etatCfg.color}`}>
                    {etatCfg.label}
                  </span>
                  <button onClick={() => { setEditItem(item); setShowModal(true); }}
                    className="text-slate-400 hover:text-slate-700 transition-colors">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button onClick={() => setConfirmDel(item._id)}
                    className="text-slate-400 hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <p className="font-bold text-navy mb-2">Supprimer cet équipement ?</p>
            <p className="text-sm text-slate-500 mb-4">Cette action est irréversible.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={() => handleDelete(confirmDel)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <ModalEquipement
          vehicleId={vehicleId}
          vehicleNom={vehicleNom}
          item={editItem}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Modal Maintenance ─────────────────────────────────────────────────────────
function ModalMaintenance({ vehicleId, vehicleNom, item, onClose, onSaved }) {
  const isEdit = !!item?._id;
  const [form, setForm] = useState({
    type:        item?.type        || "Révision complète",
    statut:      item?.statut      || "planifié",
    dateDebut:   toDateInput(item?.dateDebut),
    dateFin:     toDateInput(item?.dateFin),
    garage:      item?.garage      || "",
    coutTotal:   item?.coutTotal   ?? "",
    description: item?.description || "",
    unite:       vehicleId,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        coutTotal: form.coutTotal !== "" ? parseFloat(form.coutTotal) : undefined,
        dateDebut: form.dateDebut || undefined,
        dateFin:   form.dateFin   || undefined,
      };
      if (isEdit) {
        await maintenanceService.update(item._id, payload);
      } else {
        await maintenanceService.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="font-bold text-navy text-base">
            {isEdit ? "Modifier la maintenance" : "Nouvelle maintenance"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500 text-sm">airport_shuttle</span>
            <span className="text-sm text-blue-700 font-semibold">{vehicleNom}</span>
            <span className="text-xs text-blue-400 ml-1">(assigné automatiquement)</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <EF label="Type">
              <select value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className={iCls}>
                {TYPES_MAINT.map((t) => <option key={t}>{t}</option>)}
              </select>
            </EF>
            <EF label="Statut">
              <select value={form.statut}
                onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value }))}
                className={iCls}>
                {STATUTS_MAINT.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </EF>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <EF label="Date début">
              <input type="date" value={form.dateDebut}
                onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))}
                className={iCls} />
            </EF>
            <EF label="Date fin">
              <input type="date" value={form.dateFin}
                onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))}
                className={iCls} />
            </EF>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <EF label="Garage">
              <input type="text" value={form.garage}
                onChange={(e) => setForm((f) => ({ ...f, garage: e.target.value }))}
                className={iCls} placeholder="Nom du garage" />
            </EF>
            <EF label="Coût (€)">
              <input type="number" step="0.01" min="0" value={form.coutTotal}
                onChange={(e) => setForm((f) => ({ ...f, coutTotal: e.target.value }))}
                className={iCls} placeholder="Optionnel" />
            </EF>
          </div>

          <EF label="Description">
            <textarea value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3} className={`${iCls} resize-none`} placeholder="Détails de l'intervention..." />
          </EF>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
            {saving ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab Maintenances ──────────────────────────────────────────────────────────
function TabMaintenances({ vehicleId, vehicleNom }) {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filtre,     setFiltre]     = useState("");
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await maintenanceService.getAll({ unite: vehicleId, limit: 200 });
      const list = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.maintenances || [];
      setItems(list);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [vehicleId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    try { await maintenanceService.delete(id); load(); } catch { /* silencieux */ }
    setConfirmDel(null);
  };

  const planifié = items.filter((i) => i.statut === "planifié").length;
  const enCours  = items.filter((i) => i.statut === "en-cours").length;
  const terminé  = items.filter((i) => i.statut === "terminé").length;

  const filtered = filtre ? items.filter((i) => i.statut === filtre) : items;

  return (
    <div className="p-4 space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Planifiées", value: planifié, color: "text-blue-600",   bg: "bg-blue-50"   },
          { label: "En cours",   value: enCours,  color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Terminées",  value: terminé,  color: "text-green-600",  bg: "bg-green-50"  },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl p-2.5 text-center`}>
            <p className={`text-lg font-mono font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres statut */}
      <div className="flex gap-1.5 flex-wrap">
        {[{ value: "", label: "Toutes" }, ...STATUTS_MAINT].map((f) => (
          <button key={f.value} onClick={() => setFiltre(f.value)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filtre === f.value
                ? "bg-navy text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{filtered.length} maintenance(s)</p>
        <button onClick={() => { setEditItem(null); setShowModal(true); }}
          className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors">
          <span className="material-symbols-outlined text-sm">add</span>
          Ajouter
        </button>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div className="text-center py-10">
          <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 40 }}>build</span>
          <p className="text-slate-400 text-sm mt-2">Aucune maintenance enregistrée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const statutCfg = STATUT_MAINT_CFG[item.statut] || { label: item.statut, color: "bg-slate-100 text-slate-600" };
            return (
              <div key={item._id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy">{item.type}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statutCfg.color}`}>
                        {statutCfg.label}
                      </span>
                      {item.dateDebut && (
                        <span className="text-xs text-slate-400">{formatDate(item.dateDebut)}</span>
                      )}
                      {item.garage && <span className="text-xs text-slate-400">{item.garage}</span>}
                      {item.coutTotal != null && (
                        <span className="text-xs text-slate-500 font-mono">{item.coutTotal} €</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => { setEditItem(item); setShowModal(true); }}
                      className="text-slate-400 hover:text-slate-700 transition-colors">
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onClick={() => setConfirmDel(item._id)}
                      className="text-slate-400 hover:text-red-500 transition-colors">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <p className="font-bold text-navy mb-2">Supprimer cette maintenance ?</p>
            <p className="text-sm text-slate-500 mb-4">Cette action est irréversible.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={() => handleDelete(confirmDel)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <ModalMaintenance
          vehicleId={vehicleId}
          vehicleNom={vehicleNom}
          item={editItem}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function VehicleDetailPanel({ vehicle, onClose, onUpdate, initialTab = "info" }) {
  const [tab,               setTab]               = useState(initialTab);
  const [editing,           setEditing]           = useState(false);
  const [form,              setForm]              = useState(() => initForm(vehicle));
  const [saving,            setSaving]            = useState(false);
  const [toast,             setToast]             = useState(null);
  const [confirmDesactiver, setConfirmDesactiver] = useState(false);

  useEffect(() => {
    setForm(initForm(vehicle));
    setEditing(false);
    setConfirmDesactiver(false);
    setTab(initialTab);
  }, [vehicle._id, initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const set       = (k, v)      => setForm((f) => ({ ...f, [k]: v }));
  const setNested = (k, sub, v) => setForm((f) => ({ ...f, [k]: { ...f[k], [sub]: v } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        consommationL100: form.consommationL100 !== "" ? form.consommationL100 : undefined,
        puissanceCv:      form.puissanceCv      !== "" ? form.puissanceCv      : undefined,
        autonomieKm:      form.autonomieKm      !== "" ? form.autonomieKm      : undefined,
        kilometrage: {
          actuel:           form.kilometrage.actuel || 0,
          prochainVidange:  form.kilometrage.prochainVidange  !== "" ? form.kilometrage.prochainVidange  : undefined,
          prochainControle: form.kilometrage.prochainControle !== "" ? form.kilometrage.prochainControle : undefined,
        },
        controleTechnique: {
          dateExpiration: form.controleTechnique.dateExpiration || undefined,
        },
        assurance: {
          ...form.assurance,
          dateExpiration: form.assurance.dateExpiration || undefined,
        },
      };
      const res     = await vehicleService.update(vehicle._id, payload);
      const updated = res.data;
      onUpdate(updated);
      setEditing(false);
      showToast(`✅ ${updated.nom} mis à jour`);
    } catch (err) {
      showToast(err.response?.data?.message || "Erreur lors de la sauvegarde.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDesactiver = async () => {
    try {
      await vehicleService.update(vehicle._id, { actif: false });
      onUpdate({ ...vehicle, actif: false });
      showToast(`${vehicle.nom} désactivé`, "warning");
      setTimeout(onClose, 1600);
    } catch (err) {
      showToast(err.response?.data?.message || "Erreur.", "error");
    }
    setConfirmDesactiver(false);
  };

  const typeCfg   = TYPE_CFG[vehicle.type]    || TYPE_CFG.VSL;
  const statutCfg = STATUT_CFG[vehicle.statut] || STATUT_CFG["hors_service"];
  const km        = getKm(vehicle);
  const eq        = getEq(vehicle);
  const activeEq  = EQ_LIST.filter((e) => eq[e.key]);

  const TABS = [
    { id: "info",  label: "Informations", icon: "info" },
    { id: "equip", label: "Équipements",  icon: "medical_services" },
    { id: "maint", label: "Maintenances", icon: "build" },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 flex justify-end z-50"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-[400px] h-full shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "slideInRight .25s ease" }}
      >
        {/* ── Toast ──────────────────────────────────────────────────────── */}
        {toast && (
          <div className={`absolute top-3 left-3 right-3 z-20 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg pointer-events-none ${
            toast.type === "error"   ? "bg-red-100 text-red-700 border border-red-200" :
            toast.type === "warning" ? "bg-orange-100 text-orange-700 border border-orange-200" :
                                       "bg-green-100 text-green-700 border border-green-200"
          }`}>
            {toast.msg}
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className={`bg-gradient-to-br ${typeCfg.gradient} px-5 py-5 flex-shrink-0 relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl ${typeCfg.iconColor} flex items-center justify-center shrink-0 shadow-inner`}>
              <span className="material-symbols-outlined text-2xl">{typeCfg.icon}</span>
            </div>
            <div className="flex-1 min-w-0 pr-6">
              {editing ? (
                <input
                  value={form.nom}
                  onChange={(e) => set("nom", e.target.value)}
                  className="text-white font-bold text-base bg-white/20 border border-white/30 rounded-lg px-2 py-1 w-full outline-none focus:bg-white/30 placeholder-white/50"
                />
              ) : (
                <h3 className="text-white font-brand font-bold text-base truncate">{vehicle.nom}</h3>
              )}
              <p className="text-white/70 text-sm font-mono mt-0.5">
                {vehicle.type} · {vehicle.immatriculation}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${statutCfg.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statutCfg.dot}`} />
                  {statutCfg.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Onglets ────────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-100 bg-white flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setEditing(false); }}
              className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Contenu ────────────────────────────────────────────────────── */}
        {tab === "equip" ? (
          <div className="flex-1 overflow-y-auto">
            <TabEquipements vehicleId={vehicle._id} vehicleNom={vehicle.nom} />
          </div>
        ) : tab === "maint" ? (
          <div className="flex-1 overflow-y-auto">
            <TabMaintenances vehicleId={vehicle._id} vehicleNom={vehicle.nom} />
          </div>
        ) : (
          <>
            {/* ── TAB INFO: Contenu scrollable ────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* ── IDENTIFICATION ── */}
              <PanelSection title="Identification" icon="badge">
                {editing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <EF label="Immatriculation">
                        <input type="text" value={form.immatriculation}
                          onChange={(e) => set("immatriculation", e.target.value.toUpperCase())}
                          className={iCls} />
                      </EF>
                      <EF label="Type">
                        <select value={form.type} onChange={(e) => set("type", e.target.value)} className={iCls}>
                          {["VSL", "AMBULANCE", "TPMR"].map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </EF>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <EF label="Marque">
                        <input type="text" value={form.marque}
                          onChange={(e) => set("marque", e.target.value)} className={iCls} />
                      </EF>
                      <EF label="Modèle">
                        <input type="text" value={form.modele}
                          onChange={(e) => set("modele", e.target.value)} className={iCls} />
                      </EF>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <EF label="Année">
                        <input type="number" value={form.annee} min={2000} max={2030}
                          onChange={(e) => set("annee", parseInt(e.target.value) || new Date().getFullYear())}
                          className={iCls} />
                      </EF>
                      <EF label="Couleur">
                        <input type="text" value={form.couleur}
                          onChange={(e) => set("couleur", e.target.value)} className={iCls} />
                      </EF>
                    </div>
                    <EF label="N° Série (VIN)">
                      <input type="text" value={form.numeroSerie}
                        onChange={(e) => set("numeroSerie", e.target.value.toUpperCase())} className={iCls} />
                    </EF>
                  </div>
                ) : (
                  <>
                    <InfoRow label="Immatriculation"><Val>{vehicle.immatriculation}</Val></InfoRow>
                    <InfoRow label="Marque / Modèle">
                      <Val>{[vehicle.marque, vehicle.modele].filter(Boolean).join(" ") || null}</Val>
                    </InfoRow>
                    <InfoRow label="Année"><Val>{vehicle.annee}</Val></InfoRow>
                    <InfoRow label="Couleur"><Val>{vehicle.couleur}</Val></InfoRow>
                    <InfoRow label="N° Série"><Val>{vehicle.numeroSerie}</Val></InfoRow>
                  </>
                )}
              </PanelSection>

              <hr className="border-slate-100" />

              {/* ── MOTORISATION ── */}
              <PanelSection title="Motorisation" icon="local_gas_station">
                {editing ? (
                  <div className="space-y-3">
                    <EF label="Type d'énergie">
                      <select value={form.typeEnergie} onChange={(e) => set("typeEnergie", e.target.value)} className={iCls}>
                        {ENERGIES.map((e) => (
                          <option key={e} value={e}>{ENERGY_ICON[e]} {e}</option>
                        ))}
                      </select>
                    </EF>
                    <div className="grid grid-cols-2 gap-3">
                      <EF label="Conso (L/100km)">
                        <input type="number" step="0.1" min="0" value={form.consommationL100}
                          onChange={(e) => set("consommationL100", e.target.value === "" ? "" : parseFloat(e.target.value))}
                          className={iCls} />
                      </EF>
                      <EF label="Puissance (CV)">
                        <input type="number" min="0" value={form.puissanceCv}
                          onChange={(e) => set("puissanceCv", e.target.value === "" ? "" : parseInt(e.target.value))}
                          className={iCls} />
                      </EF>
                    </div>
                    {["Electrique", "Hybride"].includes(form.typeEnergie) && (
                      <EF label="Autonomie (km)">
                        <input type="number" min="0" value={form.autonomieKm}
                          onChange={(e) => set("autonomieKm", e.target.value === "" ? "" : parseInt(e.target.value))}
                          className={iCls} />
                      </EF>
                    )}
                  </div>
                ) : (
                  <>
                    <InfoRow label="Énergie">
                      <Val>{vehicle.typeEnergie ? `${ENERGY_ICON[vehicle.typeEnergie] || ""} ${vehicle.typeEnergie}` : null}</Val>
                    </InfoRow>
                    <InfoRow label="Consommation">
                      <Val>{vehicle.consommationL100 != null ? `${vehicle.consommationL100} L/100km` : null}</Val>
                    </InfoRow>
                    <InfoRow label="Puissance">
                      <Val>{vehicle.puissanceCv != null ? `${vehicle.puissanceCv} CV` : null}</Val>
                    </InfoRow>
                    {["Electrique", "Hybride"].includes(vehicle.typeEnergie) && (
                      <InfoRow label="Autonomie">
                        <Val>{vehicle.autonomieKm != null ? `${vehicle.autonomieKm} km` : null}</Val>
                      </InfoRow>
                    )}
                  </>
                )}
              </PanelSection>

              <hr className="border-slate-100" />

              {/* ── KILOMÉTRAGE ── */}
              <PanelSection title="Kilométrage" icon="speed">
                {editing ? (
                  <div className="space-y-3">
                    <EF label="Actuel (km)">
                      <input type="number" min="0" value={form.kilometrage.actuel}
                        onChange={(e) => setNested("kilometrage", "actuel", parseInt(e.target.value) || 0)}
                        className={iCls} />
                    </EF>
                    <div className="grid grid-cols-2 gap-3">
                      <EF label="Prochain vidange">
                        <input type="number" min="0" value={form.kilometrage.prochainVidange}
                          onChange={(e) => setNested("kilometrage", "prochainVidange",
                            e.target.value === "" ? "" : parseInt(e.target.value))}
                          className={iCls} placeholder="km" />
                      </EF>
                      <EF label="Prochain CT">
                        <input type="number" min="0" value={form.kilometrage.prochainControle}
                          onChange={(e) => setNested("kilometrage", "prochainControle",
                            e.target.value === "" ? "" : parseInt(e.target.value))}
                          className={iCls} placeholder="km" />
                      </EF>
                    </div>
                  </div>
                ) : (
                  <>
                    <InfoRow label="Actuel">
                      <Val>{km.actuel != null ? `${Number(km.actuel).toLocaleString("fr-FR")} km` : null}</Val>
                    </InfoRow>
                    <InfoRow label="Prochain vidange">
                      <Val>{km.prochainVidange != null ? `${Number(km.prochainVidange).toLocaleString("fr-FR")} km` : null}</Val>
                    </InfoRow>
                    <InfoRow label="Prochain CT">
                      <Val>{km.prochainControle != null ? `${Number(km.prochainControle).toLocaleString("fr-FR")} km` : null}</Val>
                    </InfoRow>
                  </>
                )}
              </PanelSection>

              <hr className="border-slate-100" />

              {/* ── CONTRÔLES RÉGLEMENTAIRES ── */}
              <PanelSection title="Contrôles réglementaires" icon="verified">
                {editing ? (
                  <div className="space-y-3">
                    <EF label="CT — Expiration">
                      <input type="date" value={form.controleTechnique.dateExpiration}
                        onChange={(e) => setNested("controleTechnique", "dateExpiration", e.target.value)}
                        className={iCls} />
                    </EF>
                    <div className="grid grid-cols-2 gap-3">
                      <EF label="Assurance — Compagnie">
                        <input type="text" value={form.assurance.compagnie}
                          onChange={(e) => setNested("assurance", "compagnie", e.target.value)} className={iCls} />
                      </EF>
                      <EF label="N° Police">
                        <input type="text" value={form.assurance.numeroPolice}
                          onChange={(e) => setNested("assurance", "numeroPolice", e.target.value)} className={iCls} />
                      </EF>
                    </div>
                    <EF label="Assurance — Expiration">
                      <input type="date" value={form.assurance.dateExpiration}
                        onChange={(e) => setNested("assurance", "dateExpiration", e.target.value)} className={iCls} />
                    </EF>
                  </div>
                ) : (
                  <>
                    <InfoRow label="CT expiration">
                      <Val>{formatDate(vehicle.controleTechnique?.dateExpiration)}</Val>
                    </InfoRow>
                    <InfoRow label="Assurance">
                      <Val>
                        {[vehicle.assurance?.compagnie, vehicle.assurance?.numeroPolice].filter(Boolean).join(" · ") || null}
                      </Val>
                    </InfoRow>
                    <InfoRow label="Assur. expiration">
                      <Val>{formatDate(vehicle.assurance?.dateExpiration)}</Val>
                    </InfoRow>
                    <InfoRow label="Crit'Air">
                      <Val>{vehicle.vignetteControlePollution?.categorie}</Val>
                    </InfoRow>
                  </>
                )}
              </PanelSection>

              <hr className="border-slate-100" />

              {/* ── ÉQUIPEMENTS VÉHICULE ── */}
              <PanelSection title="Équipements véhicule" icon="medical_services">
                {editing ? (
                  <div className="grid grid-cols-3 gap-2">
                    {EQ_LIST.map((e) => (
                      <button key={e.key} type="button"
                        onClick={() => setNested("equipements", e.key, !form.equipements[e.key])}
                        className={`py-3 rounded-xl border-2 text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                          form.equipements[e.key]
                            ? "border-primary bg-blue-50 text-primary"
                            : "border-slate-200 text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-lg">{e.emoji}</span>
                        {e.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {activeEq.length === 0 ? (
                      <span className="text-sm text-slate-400 italic">Aucun équipement renseigné</span>
                    ) : (
                      activeEq.map((e) => (
                        <span key={e.key}
                          className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full">
                          {e.emoji} {e.label}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </PanelSection>

              <hr className="border-slate-100" />

              {/* ── CAPACITÉ ── */}
              <PanelSection title="Capacité" icon="people">
                {editing ? (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { key: "placesAssises",  label: "Assises",  min: 1, max: 6 },
                      { key: "placesFauteuil", label: "Fauteuils", min: 0, max: 2 },
                      { key: "placesBrancard", label: "Brancards", min: 0, max: 1 },
                    ].map(({ key, label, min, max }) => (
                      <div key={key}>
                        <p className="text-xs text-slate-400 mb-2">{label}</p>
                        <Counter
                          value={form.capacite[key]}
                          min={min} max={max}
                          onChange={(v) => setNested("capacite", key, v)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <InfoRow label="Places assises">
                      <Val>{vehicle.capacite?.placesAssises ?? vehicle.capacitePassagers}</Val>
                    </InfoRow>
                    <InfoRow label="Fauteuils roulants">
                      <Val>{vehicle.capacite?.placesFauteuil}</Val>
                    </InfoRow>
                    <InfoRow label="Brancards">
                      <Val>{vehicle.capacite?.placesBrancard}</Val>
                    </InfoRow>
                  </>
                )}
              </PanelSection>

              {/* ── STATUT (mode édition uniquement) ── */}
              {editing && (
                <>
                  <hr className="border-slate-100" />
                  <PanelSection title="Statut" icon="toggle_on">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { v: "Disponible",   label: "Disponible",   cls: "border-green-300 bg-green-50 text-green-700"    },
                        { v: "Maintenance",  label: "Maintenance",  cls: "border-yellow-300 bg-yellow-50 text-yellow-700" },
                        { v: "Hors service", label: "Hors service", cls: "border-red-300 bg-red-50 text-red-700"          },
                      ].map((s) => (
                        <label key={s.v}
                          className={`py-2.5 rounded-xl border-2 text-xs font-semibold text-center cursor-pointer transition-all ${
                            form.statut === s.v ? s.cls : "border-slate-200 text-slate-400 hover:border-slate-300"
                          }`}
                        >
                          <input type="radio" name="statut_panel" value={s.v}
                            checked={form.statut === s.v}
                            onChange={() => set("statut", s.v)}
                            className="sr-only"
                          />
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </PanelSection>
                </>
              )}

              {/* ── NOTES ── */}
              {(vehicle.notes || editing) && (
                <>
                  <hr className="border-slate-100" />
                  <PanelSection title="Notes internes" icon="notes">
                    {editing ? (
                      <textarea
                        value={form.notes}
                        onChange={(e) => set("notes", e.target.value)}
                        rows={3}
                        maxLength={500}
                        className={`${iCls} resize-none`}
                        placeholder="Observations, remarques..."
                      />
                    ) : (
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">
                        {vehicle.notes}
                      </p>
                    )}
                  </PanelSection>
                </>
              )}
            </div>

            {/* ── Footer (info tab only) ──────────────────────────────────── */}
            <div className="border-t border-slate-100 p-4 flex-shrink-0">
              {confirmDesactiver ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700 font-medium text-center">
                    Désactiver <span className="font-bold">{vehicle.nom}</span> ?
                  </p>
                  <p className="text-xs text-slate-400 text-center leading-relaxed">
                    Le véhicule ne sera plus disponible pour le dispatch.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDesactiver(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleDesactiver}
                      className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-all"
                    >
                      Désactiver
                    </button>
                  </div>
                </div>
              ) : editing ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditing(false); setForm(initForm(vehicle)); }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-primary/20"
                  >
                    {saving ? (
                      <>
                        <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)", borderTop: "2px solid white", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                        Sauvegarde…
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">save</span>
                        Sauvegarder
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDesactiver(true)}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">block</span>
                    Désactiver
                  </button>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-primary/20"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Modifier
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
