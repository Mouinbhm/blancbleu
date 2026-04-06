import { useState, useEffect } from "react";
import { factureService } from "../services/api";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
const fmtMontant = (m) =>
  m != null
    ? `${Number(m).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
    : "—";

const inputStyle = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  fontSize: "14px",
  color: "#0f172a",
  outline: "none",
  width: "100%",
  backgroundColor: "#f8fafc",
  fontFamily: "inherit",
};

// ─── Modal Ajout / Modification ───────────────────────────────────────────────
function ModalFacture({ facture, onClose, onSaved }) {
  const isEdit = !!facture;
  const [form, setForm] = useState({
    date: facture
      ? new Date(facture.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    motif: facture?.motif || "",
    lieu: facture?.lieu || "",
    montant: facture?.montant ?? "",
    patient: facture?.patient || "",
    statut: facture?.statut || "en-attente",
    notes: facture?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.motif || !form.lieu || form.montant === "") {
      setError("Motif, lieu et montant sont obligatoires.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, montant: parseFloat(form.montant) };
      const { data } = isEdit
        ? await factureService.update(facture._id, payload)
        : await factureService.create(payload);
      onSaved(isEdit ? data.facture : data.facture, isEdit);
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message || "Erreur lors de l'enregistrement.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "520px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid #f1f5f9",
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                backgroundColor: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ color: "#1D6EF5", fontSize: "20px" }}
              >
                {isEdit ? "edit" : "receipt"}
              </span>
            </div>
            <div>
              <h2
                style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}
              >
                {isEdit ? "Modifier la facture" : "Nouvelle facture"}
              </h2>
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                {isEdit ? facture.numero : "Ambulances Blanc Bleu · Nice"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "18px", color: "#94a3b8" }}
            >
              close
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  color: "#DC2626",
                  fontSize: "13px",
                }}
              >
                ⚠ {error}
              </div>
            )}

            {/* Date + Statut */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#64748b",
                  }}
                >
                  Date *
                </label>
                <input
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={handleChange}
                  style={inputStyle}
                  required
                />
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#64748b",
                  }}
                >
                  Statut
                </label>
                <select
                  name="statut"
                  value={form.statut}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="en-attente">En attente</option>
                  <option value="payée">Payée</option>
                  <option value="annulée">Annulée</option>
                </select>
              </div>
            </div>

            {/* Motif */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                style={{ fontSize: "12px", fontWeight: 500, color: "#64748b" }}
              >
                Motif *
              </label>
              <input
                name="motif"
                value={form.motif}
                onChange={handleChange}
                placeholder="Transport urgent, VSL, Consultation…"
                style={inputStyle}
                required
              />
            </div>

            {/* Lieu */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                style={{ fontSize: "12px", fontWeight: 500, color: "#64748b" }}
              >
                Lieu *
              </label>
              <input
                name="lieu"
                value={form.lieu}
                onChange={handleChange}
                placeholder="Hôpital Pasteur, Nice 2e…"
                style={inputStyle}
                required
              />
            </div>

            {/* Montant + Patient */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#64748b",
                  }}
                >
                  Montant (€) *
                </label>
                <input
                  name="montant"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.montant}
                  onChange={handleChange}
                  placeholder="0.00"
                  style={inputStyle}
                  required
                />
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#64748b",
                  }}
                >
                  Patient
                </label>
                <input
                  name="patient"
                  value={form.patient}
                  onChange={handleChange}
                  placeholder="Nom du patient"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Notes */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                style={{ fontSize: "12px", fontWeight: 500, color: "#64748b" }}
              >
                Notes
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Informations complémentaires…"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              padding: "16px 24px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "none",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 500,
                color: "#64748b",
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                background: saving ? "#93c5fd" : "#1D6EF5",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: 600,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {saving ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTop: "2px solid #fff",
                      borderRadius: "50%",
                      animation: "spin .7s linear infinite",
                      display: "inline-block",
                    }}
                  />{" "}
                  Enregistrement…
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "16px" }}
                  >
                    save
                  </span>{" "}
                  {isEdit ? "Enregistrer" : "Créer la facture"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Factures() {
  const [factures, setFactures] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("Tous");
  const [modal, setModal] = useState(null); // null | "new" | facture object
  const [factureVoir, setFactureVoir] = useState(null);

  useEffect(() => {
    Promise.all([factureService.getAll(), factureService.getStats()])
      .then(([f, s]) => {
        setFactures(f.data.factures);
        setStats(s.data);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtres
  const filtered = factures.filter((f) => {
    const matchStatut =
      filterStatut === "Tous" ||
      f.statut === filterStatut.toLowerCase().replace("é", "é");
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      f.motif?.toLowerCase().includes(q) ||
      f.lieu?.toLowerCase().includes(q) ||
      f.patient?.toLowerCase().includes(q) ||
      f.numero?.toLowerCase().includes(q);
    return matchStatut && matchSearch;
  });

  const handleSaved = (facture, isEdit) => {
    if (isEdit)
      setFactures((prev) =>
        prev.map((f) => (f._id === facture._id ? facture : f)),
      );
    else setFactures((prev) => [facture, ...prev]);
  };

  const handleStatut = async (id, statut) => {
    try {
      const { data } = await factureService.updateStatut(id, statut);
      setFactures((prev) => prev.map((f) => (f._id === id ? data.facture : f)));
    } catch {
      alert("Erreur mise à jour statut.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette facture ?")) return;
    try {
      await factureService.delete(id);
      setFactures((prev) => prev.filter((f) => f._id !== id));
    } catch {
      alert("Erreur suppression.");
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = [
      "Numéro",
      "Date",
      "Motif",
      "Lieu",
      "Patient",
      "Montant €",
      "Statut",
    ];
    const rows = filtered.map((f) => [
      f.numero,
      fmtDate(f.date),
      f.motif,
      f.lieu,
      f.patient || "",
      f.montant,
      f.statut,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factures-blancbleu-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalFiltre = filtered.reduce(
    (sum, f) => sum + (f.statut !== "annulée" ? f.montant : 0),
    0,
  );

  return (
    <div className="p-7 fade-in">
      {/* Modals */}
      {(modal === "new" || (modal && modal._id)) && (
        <ModalFacture
          facture={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-brand font-bold text-2xl text-navy">Factures</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestion de la facturation — Ambulances Blanc Bleu
          </p>
        </div>
        <button
          onClick={() => setModal("new")}
          className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-lg">add</span>Nouvelle
          facture
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          {
            l: "Total factures",
            v: stats?.total || 0,
            c: "border-slate-400",
            icon: "receipt_long",
          },
          {
            l: "Payées",
            v: stats?.parStatut?.payees || 0,
            c: "border-emerald-500",
            icon: "check_circle",
          },
          {
            l: "En attente",
            v: stats?.parStatut?.enAttente || 0,
            c: "border-yellow-500",
            icon: "pending",
          },
          {
            l: "Chiffre d'affaires",
            v: fmtMontant(stats?.chiffreAffaires),
            c: "border-blue-500",
            icon: "euro",
          },
        ].map((k) => (
          <div
            key={k.l}
            className={`bg-white rounded-xl p-5 border-t-4 shadow-sm ${k.c}`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                {k.l}
              </p>
              <span className="material-symbols-outlined text-slate-300 text-xl">
                {k.icon}
              </span>
            </div>
            <p className="font-mono text-2xl font-bold text-navy">{k.v}</p>
          </div>
        ))}
      </div>

      {/* Filtres + Recherche */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex gap-2">
          {["Tous", "Payée", "En-attente", "Annulée"].map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatut(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                filterStatut === f
                  ? "bg-navy text-white"
                  : "bg-white border border-slate-200 text-slate-500 hover:border-navy"
              }`}
            >
              {f === "En-attente" ? "En attente" : f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 w-56">
            <span className="material-symbols-outlined text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder-slate-400"
            />
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 text-xs font-bold text-primary border border-primary/30 px-3 py-2 rounded-lg hover:bg-primary hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
        <table className="w-full">
          <thead>
            <tr className="bg-navy">
              {[
                "N° Facture",
                "Date",
                "Motif",
                "Lieu",
                "Patient",
                "Montant",
                "Statut",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-5 py-4 text-left font-mono text-xs text-white/70 uppercase tracking-widest"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-slate-400">
                  <div
                    style={{
                      display: "inline-block",
                      width: 20,
                      height: 20,
                      border: "2px solid #e2e8f0",
                      borderTop: "2px solid #1D6EF5",
                      borderRadius: "50%",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <span
                    className="material-symbols-outlined text-slate-300"
                    style={{ fontSize: 48 }}
                  >
                    receipt_long
                  </span>
                  <p className="text-slate-400 mt-3 text-sm">
                    Aucune facture trouvée
                  </p>
                  <button
                    onClick={() => setModal("new")}
                    className="mt-4 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                  >
                    Créer la première facture
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map((f, i) => (
                <tr
                  key={f._id}
                  className={`border-b border-slate-100 hover:bg-blue-50 transition-all ${i % 2 === 1 ? "bg-slate-50/30" : "bg-white"}`}
                >
                  <td className="px-5 py-4 font-mono font-bold text-primary text-sm">
                    {f.numero}
                  </td>
                  <td className="px-5 py-4 font-mono text-sm text-slate-600">
                    {fmtDate(f.date)}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-navy">
                    {f.motif}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">{f.lieu}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {f.patient || "—"}
                  </td>
                  <td className="px-5 py-4 font-mono font-bold text-navy text-sm">
                    {fmtMontant(f.montant)}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={f.statut}
                      onChange={(e) => handleStatut(f._id, e.target.value)}
                      className={`px-2 py-1 rounded-full text-xs font-bold border-0 cursor-pointer ${
                        f.statut === "payée"
                          ? "bg-emerald-100 text-emerald-700"
                          : f.statut === "en-attente"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      <option value="en-attente">En attente</option>
                      <option value="payée">Payée</option>
                      <option value="annulée">Annulée</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1">
                      <button
                        title="Modifier"
                        onClick={() => setModal(f)}
                        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-amber-50 hover:border-amber-400 transition-all group"
                      >
                        <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-amber-500">
                          edit
                        </span>
                      </button>
                      <button
                        title="Imprimer"
                        onClick={() => window.print()}
                        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-blue-50 hover:border-primary transition-all group"
                      >
                        <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-primary">
                          print
                        </span>
                      </button>
                      <button
                        title="Supprimer"
                        onClick={() => handleDelete(f._id)}
                        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:border-red-400 transition-all group"
                      >
                        <span className="material-symbols-outlined text-slate-400 text-sm group-hover:text-red-500">
                          delete
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {filtered.length} facture(s) affichée(s)
          </span>
          <span className="text-xs font-mono font-bold text-navy">
            Total affiché : {fmtMontant(totalFiltre)}
          </span>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
