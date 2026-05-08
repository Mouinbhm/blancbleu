import { useState, useEffect, useCallback } from "react";
import { userService } from "../services/api";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  { value: "admin", label: "Administrateur", color: "bg-red-100 text-red-700" },
  { value: "dispatcher", label: "Dispatcher", color: "bg-blue-100 text-blue-700" },
  { value: "ambulancier", label: "Ambulancier", color: "bg-green-100 text-green-700" },
  { value: "comptable", label: "Comptable", color: "bg-yellow-100 text-yellow-700" },
];

function roleBadge(role) {
  const r = ROLES.find((x) => x.value === role);
  return r ? (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.color}`}>
      {r.label}
    </span>
  ) : (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
      {role}
    </span>
  );
}

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let pwd = "";
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

const EMPTY_FORM = { prenom: "", nom: "", email: "", role: "dispatcher", password: "" };

export default function Utilisateurs() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("tous");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const [resetModal, setResetModal] = useState(null); // { user }
  const [resetPwd, setResetPwd] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const [deleteModal, setDeleteModal] = useState(null); // { user }
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userService.getAll();
      setUsers(data.users || data || []);
    } catch {
      showToast("Impossible de charger les utilisateurs", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.prenom?.toLowerCase().includes(q) ||
      u.nom?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q);
    const matchRole = roleFilter === "tous" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  // ── Création ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({ ...EMPTY_FORM, password: genPassword() });
    setFormErr({});
    setShowPwd(false);
    setModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!form.prenom.trim()) errors.prenom = "Requis";
    if (!form.nom.trim()) errors.nom = "Requis";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email))
      errors.email = "Email invalide";
    if (!form.password || form.password.length < 8)
      errors.password = "8 caractères minimum";
    return errors;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length) { setFormErr(errors); return; }
    setSubmitting(true);
    try {
      await userService.create(form);
      showToast(`Compte créé pour ${form.prenom} ${form.nom}. Email envoyé.`);
      setModalOpen(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Erreur lors de la création", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Toggle actif ───────────────────────────────────────────────────────────
  const handleToggle = async (u) => {
    if (u._id === me?._id) { showToast("Impossible de désactiver votre propre compte", "error"); return; }
    try {
      await userService.toggle(u._id);
      showToast(`Compte ${u.actif ? "désactivé" : "activé"}`);
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Erreur", "error");
    }
  };

  // ── Réinitialisation mdp ───────────────────────────────────────────────────
  const openReset = (u) => { setResetModal({ user: u }); setResetPwd(genPassword()); };

  const handleReset = async () => {
    if (!resetPwd || resetPwd.length < 8) { showToast("8 caractères minimum", "error"); return; }
    setResetSubmitting(true);
    try {
      await userService.resetPassword(resetModal.user._id, resetPwd);
      showToast(`Mot de passe réinitialisé. Email envoyé à ${resetModal.user.email}.`);
      setResetModal(null);
    } catch (err) {
      showToast(err.response?.data?.message || "Erreur", "error");
    } finally {
      setResetSubmitting(false);
    }
  };

  // ── Suppression ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleteSubmitting(true);
    try {
      await userService.delete(deleteModal.user._id);
      showToast(`Compte de ${deleteModal.user.prenom} ${deleteModal.user.nom} supprimé.`);
      setDeleteModal(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Erreur", "error");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-brand font-bold text-navy">Gestion des utilisateurs</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {users.length} compte{users.length > 1 ? "s" : ""} — accès réservé aux administrateurs
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Nouvel utilisateur
        </button>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="tous">Tous les rôles</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <span className="material-symbols-outlined animate-spin text-3xl">refresh</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-4xl block mb-2">group_off</span>
            <p className="text-sm">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-mono text-slate-400 uppercase tracking-wider">
                <th className="text-left px-6 py-3">Utilisateur</th>
                <th className="text-left px-6 py-3">Email</th>
                <th className="text-left px-6 py-3">Rôle</th>
                <th className="text-left px-6 py-3">Statut</th>
                <th className="text-left px-6 py-3">Créé le</th>
                <th className="text-right px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u._id}
                  className={`border-b border-slate-50 transition-colors hover:bg-slate-50/50 ${
                    !u.actif ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {`${u.prenom?.[0] ?? ""}${u.nom?.[0] ?? ""}`.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-navy">
                          {u.prenom} {u.nom}
                          {u._id === me?._id && (
                            <span className="ml-2 text-xs text-primary font-mono">(vous)</span>
                          )}
                        </p>
                        {u.mustChangePassword && (
                          <p className="text-xs text-amber-600 font-medium">
                            Doit changer son mot de passe
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{u.email}</td>
                  <td className="px-6 py-4">{roleBadge(u.role)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                        u.actif
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${u.actif ? "bg-green-500" : "bg-slate-400"}`} />
                      {u.actif ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString("fr-FR")
                      : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggle(u)}
                        title={u.actif ? "Désactiver" : "Activer"}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {u.actif ? "toggle_on" : "toggle_off"}
                        </span>
                      </button>
                      <button
                        onClick={() => openReset(u)}
                        title="Réinitialiser le mot de passe"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">key</span>
                      </button>
                      {u._id !== me?._id && (
                        <button
                          onClick={() => setDeleteModal({ user: u })}
                          title="Supprimer"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal création ─────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-brand font-bold text-navy text-lg">Nouvel utilisateur</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Prénom</label>
                  <input
                    type="text"
                    value={form.prenom}
                    onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      formErr.prenom ? "border-red-400" : "border-slate-200"
                    }`}
                    placeholder="Jean"
                  />
                  {formErr.prenom && <p className="text-xs text-red-500 mt-1">{formErr.prenom}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nom</label>
                  <input
                    type="text"
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      formErr.nom ? "border-red-400" : "border-slate-200"
                    }`}
                    placeholder="Dupont"
                  />
                  {formErr.nom && <p className="text-xs text-red-500 mt-1">{formErr.nom}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    formErr.email ? "border-red-400" : "border-slate-200"
                  }`}
                  placeholder="jean.dupont@blancbleu.fr"
                />
                {formErr.email && <p className="text-xs text-red-500 mt-1">{formErr.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Rôle</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Mot de passe temporaire
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className={`w-full px-3 py-2 pr-10 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono ${
                        formErr.password ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPwd ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, password: genPassword() }))}
                    title="Générer un mot de passe"
                    className="px-3 rounded-xl border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">autorenew</span>
                  </button>
                </div>
                {formErr.password && (
                  <p className="text-xs text-red-500 mt-1">{formErr.password}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  L'employé recevra ses identifiants par email et devra changer ce mot de passe à la première connexion.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {submitting ? (
                    <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                  ) : (
                    <span className="material-symbols-outlined text-lg">person_add</span>
                  )}
                  Créer le compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal réinitialisation mdp ──────────────────────────────────────── */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-brand font-bold text-navy text-lg">Réinitialiser le mot de passe</h3>
              <button
                onClick={() => setResetModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                Nouveau mot de passe temporaire pour{" "}
                <span className="font-bold text-navy">
                  {resetModal.user.prenom} {resetModal.user.nom}
                </span>
                . Il devra le changer à sa prochaine connexion.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Nouveau mot de passe
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resetPwd}
                    onChange={(e) => setResetPwd(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setResetPwd(genPassword())}
                    className="px-3 rounded-xl border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">autorenew</span>
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setResetModal(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetSubmitting}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-60"
                >
                  {resetSubmitting ? (
                    <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                  ) : (
                    <span className="material-symbols-outlined text-lg">key</span>
                  )}
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal suppression ──────────────────────────────────────────────── */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-red-600 text-2xl">person_remove</span>
              </div>
              <div className="text-center">
                <h3 className="font-brand font-bold text-navy text-lg">Supprimer ce compte ?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Le compte de{" "}
                  <span className="font-bold">
                    {deleteModal.user.prenom} {deleteModal.user.nom}
                  </span>{" "}
                  sera définitivement supprimé. Cette action est irréversible.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-1">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteSubmitting}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {deleteSubmitting ? (
                    <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                  ) : (
                    <span className="material-symbols-outlined text-lg">delete</span>
                  )}
                  Supprimer définitivement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-white text-sm font-semibold ${
            toast.type === "error" ? "bg-red-600" : "bg-green-600"
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.type === "error" ? "error" : "check_circle"}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
