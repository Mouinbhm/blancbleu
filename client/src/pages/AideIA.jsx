import { useState } from "react";

const TYPES = [
  "Arrêt cardiaque",
  "AVC",
  "Accident route",
  "Traumatisme",
  "Malaise",
  "Brûlures",
  "Noyade",
];
const SYMPTOMS = [
  "Douleurs thoraciques",
  "Difficultés respiratoires",
  "Hémorragie",
  "Perte de connaissance",
  "Convulsions",
  "Paralysie",
  "Fractures",
  "Douleurs abdominales",
];
const ETAT = [
  { v: "conscient", icon: "😊", label: "Conscient" },
  { v: "inconscient", icon: "😴", label: "Inconscient" },
  { v: "inconnu", icon: "❓", label: "Inconnu" },
];

function analyzeLocally(form) {
  let score = 50;
  const typeScores = {
    "Arrêt cardiaque": 40,
    AVC: 35,
    "Accident route": 25,
    Traumatisme: 20,
    Malaise: 10,
    Brûlures: 20,
    Noyade: 30,
  };
  score += typeScores[form.type] || 15;
  if (form.etat === "inconscient") score += 30;
  else if (form.etat === "conscient") score += 5;
  const critical = [
    "Douleurs thoraciques",
    "Difficultés respiratoires",
    "Hémorragie",
    "Perte de connaissance",
  ];
  score += form.symptoms.filter((s) => critical.includes(s)).length * 10;
  score += Math.min((form.victims - 1) * 5, 20);
  score = Math.min(score, 99);
  const priority = score >= 80 ? 1 : score >= 55 ? 2 : 3;
  const labels = { 1: "CRITIQUE", 2: "URGENT", 3: "STANDARD" };
  const eta = `${Math.floor(Math.random() * 4) + 2} min ${Math.floor(Math.random() * 59)} sec`;
  const risks = [];
  if (form.type === "Arrêt cardiaque")
    risks.push("Défibrillateur requis immédiatement");
  if (form.symptoms.includes("Hémorragie"))
    risks.push("Risque hémorragique élevé");
  if (form.etat === "inconscient")
    risks.push("Patient inconscient — risque vital");
  if (form.victims > 1)
    risks.push(`${form.victims} victimes — renfort recommandé`);
  risks.push("Zone de trafic dense — itinéraire alternatif suggéré");
  return {
    priority,
    priorityLabel: `PRIORITÉ ${priority} — ${labels[priority]}`,
    score: Math.round(score),
    confidence: Math.round(85 + Math.random() * 10),
    recommendedUnit: "AMB-03",
    alternativeUnit: "AMB-07",
    distanceKm: "2.1",
    eta,
    crew: "Dr. Moreau + Infirmier Diaz",
    riskFactors: risks,
  };
}

export default function AideIA() {
  const [form, setForm] = useState({
    type: "",
    etat: "",
    symptoms: [],
    address: "",
    victims: 1,
    notes: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const toggleSymptom = (s) =>
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(s)
        ? f.symptoms.filter((x) => x !== s)
        : [...f.symptoms, s],
    }));

  const handleAnalyze = async () => {
    if (!form.type) {
      alert("Sélectionnez un type d'incident");
      return;
    }
    if (!form.etat) {
      alert("Sélectionnez l'état du patient");
      return;
    }
    setLoading(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 1800));
    setResult(analyzeLocally(form));
    setLoading(false);
  };

  const pBorder =
    result?.priority === 1
      ? "border-red-500"
      : result?.priority === 2
        ? "border-yellow-500"
        : "border-blue-500";
  const pColor =
    result?.priority === 1
      ? "text-red-600"
      : result?.priority === 2
        ? "text-yellow-600"
        : "text-blue-600";
  const pIcon =
    result?.priority === 1 ? "🔴" : result?.priority === 2 ? "🟡" : "🔵";

  return (
    <div className="p-7 fade-in">
      <div className="mb-6">
        <h1 className="font-brand font-bold text-2xl text-navy">
          🤖 Aide à la décision — IA
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Priorisation automatique et optimisation des ressources BlancBleu
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* ═══ FORMULAIRE ═══ */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-navy to-blue-900 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-blue-400 tracking-widest uppercase">
                FORM-BB-2025
              </p>
              <h2 className="font-brand font-bold text-white text-base">
                Nouvelle intervention
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full ${step >= s ? "bg-primary" : "bg-white/20"}`}
                />
              ))}
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Type */}
            <div>
              <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">
                Type d'incident *
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value }))
                }
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-surface"
              >
                <option value="">Sélectionner le type...</option>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* État */}
            <div>
              <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">
                État du patient *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ETAT.map((e) => (
                  <button
                    key={e.v}
                    onClick={() => setForm((f) => ({ ...f, etat: e.v }))}
                    className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all flex flex-col items-center gap-1 ${
                      form.etat === e.v
                        ? "border-primary bg-blue-50 text-primary shadow-sm"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-xl">{e.icon}</span>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Symptômes */}
            <div>
              <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">
                Symptômes détectés
              </label>
              <div className="flex flex-wrap gap-2">
                {SYMPTOMS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSymptom(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      form.symptoms.includes(s)
                        ? "bg-primary border-primary text-white shadow-sm"
                        : "border-slate-200 text-slate-600 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">
                Adresse de l'incident
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">
                  location_on
                </span>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                  placeholder="Ex: 14 Rue Victor Hugo, Lyon"
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            {/* Victimes + Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Nombre de victimes
                </label>
                <div className="flex border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        victims: Math.max(1, f.victims - 1),
                      }))
                    }
                    className="w-11 bg-surface text-slate-600 font-bold text-xl hover:bg-slate-100 transition-colors flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="flex-1 text-center font-mono font-bold text-navy py-2.5 text-base border-x border-slate-200">
                    {form.victims}
                  </span>
                  <button
                    onClick={() =>
                      setForm((f) => ({ ...f, victims: f.victims + 1 }))
                    }
                    className="w-11 bg-surface text-slate-600 font-bold text-xl hover:bg-slate-100 transition-colors flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Heure d'appel
                </label>
                <input
                  type="time"
                  defaultValue={new Date().toTimeString().slice(0, 5)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">
                Notes complémentaires
              </label>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Informations supplémentaires..."
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary resize-none transition-all"
              />
            </div>

            {/* CTA */}
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-primary to-navy text-white rounded-xl font-brand font-bold text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">bolt</span>
                  ANALYSER AVEC L'IA BLANCBLEU
                </>
              )}
            </button>
          </div>
        </div>

        {/* ═══ RÉSULTAT ═══ */}
        <div className="sticky top-24">
          {!result && !loading ? (
            <div className="bg-white rounded-xl border border-slate-200 min-h-96 flex flex-col items-center justify-center gap-4 text-slate-300 p-10">
              <span className="text-8xl">🤖</span>
              <p className="font-brand font-semibold text-slate-400 text-lg">
                En attente d'analyse
              </p>
              <p className="text-sm text-center text-slate-300">
                Renseignez le formulaire et cliquez sur analyser pour obtenir
                une recommandation IA
              </p>
            </div>
          ) : loading ? (
            <div className="bg-white rounded-xl border border-slate-200 min-h-96 flex flex-col items-center justify-center gap-6">
              <div className="w-16 h-16 border-4 border-blue-100 border-t-primary rounded-full animate-spin" />
              <div className="text-center">
                <p className="font-brand font-bold text-navy text-lg">
                  Analyse en cours...
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  L'IA BlancBleu analyse l'incident
                </p>
              </div>
              <div className="flex gap-2">
                {[
                  "Évaluation priorité",
                  "Ressources disponibles",
                  "Calcul ETA",
                ].map((s, i) => (
                  <span
                    key={i}
                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div
              className={`bg-white rounded-xl border-l-4 overflow-hidden shadow-xl slide-up ${pBorder}`}
            >
              {/* Header */}
              <div
                className={`px-5 py-4 border-b border-slate-100 ${result.priority === 1 ? "bg-red-50/50" : ""}`}
              >
                <div
                  className={`font-brand font-bold text-2xl ${pColor} flex items-center gap-2`}
                >
                  {pIcon} {result.priorityLabel}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs text-slate-400 font-mono">
                    Confiance IA
                  </span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-1000"
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-navy">
                    {result.confidence}%
                  </span>
                </div>
              </div>

              {/* ETA */}
              <div className="mx-5 my-4 bg-navy rounded-xl px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-white text-xl">
                    timer
                  </span>
                </div>
                <div>
                  <p className="text-xs text-white/40 font-mono uppercase tracking-wider">
                    Temps de réponse estimé
                  </p>
                  <p className="font-mono font-bold text-white text-2xl">
                    {result.eta}
                  </p>
                </div>
              </div>

              {/* Unité recommandée */}
              <div className="px-5 pb-4">
                <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Unité recommandée
                </p>
                <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-2xl">
                      ambulance
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-mono font-bold text-navy text-lg">
                      {result.recommendedUnit}
                    </p>
                    <p className="text-sm text-slate-600">{result.crew}</p>
                    <p className="text-xs text-slate-400">
                      {result.distanceKm} km • Équipe disponible
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="bg-primary text-white font-mono text-xs px-3 py-1.5 rounded-lg font-bold">
                      {result.eta.split(" ").slice(0, 2).join(" ")}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">
                    info
                  </span>
                  Alternative:{" "}
                  <span className="font-mono font-bold">
                    {result.alternativeUnit}
                  </span>{" "}
                  — 3.4 km
                </p>
              </div>

              {/* Risques */}
              <div className="px-5 pb-4">
                <p className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  ⚠️ Facteurs de risque détectés
                </p>
                <div className="space-y-2">
                  {result.riskFactors.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2"
                    >
                      <span className="material-symbols-outlined text-yellow-500 text-base mt-0.5 flex-shrink-0">
                        warning
                      </span>
                      <span className="text-sm text-slate-700">{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 flex gap-3">
                <button className="flex-1 py-3.5 bg-danger text-white rounded-xl font-brand font-bold text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-200">
                  <span className="material-symbols-outlined">task_alt</span>
                  AFFECTER {result.recommendedUnit}
                </button>
                <button className="flex-1 py-3.5 border-2 border-primary text-primary rounded-xl font-brand font-bold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined">map</span>
                  VOIR CARTE
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
