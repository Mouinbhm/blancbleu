/**
 * BlancBleu — Service d'Audit
 * Fonctions pour enregistrer les événements dans AuditLog
 */
const AuditLog = require("../models/AuditLog");

/**
 * Enregistre une entrée d'audit
 * @param {Object} params
 */
async function log({
  action,
  origine = "HUMAIN",
  utilisateur = {},
  ressource = {},
  details = {},
  succes = true,
  erreur = "",
  route = "",
  methode = "",
  dureeMs = 0,
}) {
  try {
    await AuditLog.create({
      action,
      origine,
      succes,
      erreur,
      route,
      methode,
      dureeMs,
      utilisateur: {
        id: utilisateur.id || utilisateur._id || null,
        email: utilisateur.email || "système",
        role: utilisateur.role || "système",
        ip: utilisateur.ip || "",
      },
      ressource: {
        type: ressource.type || "",
        id: ressource.id || null,
        reference: ressource.reference || "",
      },
      details: {
        avant: details.avant || null,
        apres: details.apres || null,
        metadata: details.metadata || null,
        message: details.message || "",
      },
    });
  } catch (err) {
    // Ne jamais faire crasher l'app à cause de l'audit
    console.error("Audit log error:", err.message);
  }
}

// ── Raccourcis sémantiques ────────────────────────────────────────────────────

const audit = {
  // Interventions
  interventionCreee: (intervention, utilisateur, origine = "HUMAIN") =>
    log({
      action: "INTERVENTION_CREATED",
      origine,
      utilisateur,
      ressource: {
        type: "Intervention",
        id: intervention._id,
        reference: intervention.numero,
      },
      details: {
        apres: {
          priorite: intervention.priorite,
          typeIncident: intervention.typeIncident,
          adresse: intervention.adresse,
        },
        message: `Intervention ${intervention.numero} créée`,
      },
    }),

  statutChange: (intervention, ancienStatut, nouveauStatut, utilisateur) =>
    log({
      action: "STATUT_CHANGED",
      origine: "HUMAIN",
      utilisateur,
      ressource: {
        type: "Intervention",
        id: intervention._id,
        reference: intervention.numero,
      },
      details: {
        avant: { statut: ancienStatut },
        apres: { statut: nouveauStatut },
        message: `${ancienStatut} → ${nouveauStatut}`,
      },
    }),

  uniteAssignee: (intervention, unite, utilisateur, origine = "HUMAIN") =>
    log({
      action: "UNITE_ASSIGNED",
      origine,
      utilisateur,
      ressource: {
        type: "Intervention",
        id: intervention._id,
        reference: intervention.numero,
      },
      details: {
        apres: { unite: unite.nom, type: unite.type },
        message: `Unité ${unite.nom} assignée à ${intervention.numero}`,
      },
    }),

  // IA
  predictionIA: (intervention, prediction, confiance) =>
    log({
      action: "IA_PREDICTION",
      origine: "IA",
      utilisateur: { email: "ia@blancbleu.fr", role: "ia" },
      ressource: {
        type: "Intervention",
        id: intervention._id,
        reference: intervention.numero,
      },
      details: {
        apres: { priorite: prediction, confiance },
        message: `IA prédit ${prediction} (confiance ${confiance}%)`,
      },
    }),

  overrideIA: (intervention, anciennePriorite, nouvellePriorite, regle) =>
    log({
      action: "IA_OVERRIDE",
      origine: "IA",
      utilisateur: { email: "ia@blancbleu.fr", role: "ia" },
      ressource: {
        type: "Intervention",
        id: intervention._id,
        reference: intervention.numero,
      },
      details: {
        avant: { priorite: anciennePriorite },
        apres: { priorite: nouvellePriorite },
        message: `Override IA : ${regle}`,
      },
    }),

  // Dispatch
  dispatchAuto: (intervention, unite, score, eta) =>
    log({
      action: "DISPATCH_AUTO",
      origine: "SYSTÈME",
      utilisateur: { email: "dispatch@blancbleu.fr", role: "système" },
      ressource: {
        type: "Intervention",
        id: intervention._id,
        reference: intervention.numero,
      },
      details: {
        apres: { unite: unite.nom, score, eta },
        message: `Auto-dispatch : ${unite.nom} (score ${score}/100, ETA ${eta})`,
      },
    }),

  // Escalade
  escaladeDeclenchee: (intervention, alertes) =>
    log({
      action: "ESCALADE_TRIGGERED",
      origine: "SYSTÈME",
      utilisateur: { email: "escalade@blancbleu.fr", role: "système" },
      ressource: {
        type: "Intervention",
        id: intervention._id,
        reference: intervention.numero,
      },
      details: {
        metadata: { alertes },
        message: `${alertes.length} alerte(s) déclenchée(s)`,
      },
    }),

  // Auth
  connexion: (utilisateur, ip, succes = true) =>
    log({
      action: succes ? "LOGIN" : "LOGIN_FAILED",
      origine: "HUMAIN",
      succes,
      utilisateur: {
        id: utilisateur._id,
        email: utilisateur.email,
        role: utilisateur.role,
        ip,
      },
      details: { message: succes ? `Connexion réussie` : `Tentative échouée` },
    }),

  // Unités
  uniteStatusChange: (unite, ancienStatut, nouveauStatut, utilisateur) =>
    log({
      action: "UNITE_STATUS_CHANGED",
      origine: "HUMAIN",
      utilisateur,
      ressource: { type: "Unit", id: unite._id, reference: unite.nom },
      details: {
        avant: { statut: ancienStatut },
        apres: { statut: nouveauStatut },
        message: `${unite.nom} : ${ancienStatut} → ${nouveauStatut}`,
      },
    }),

  // Factures
  factureCreee: (facture, intervention) =>
    log({
      action: "FACTURE_CREATED",
      origine: "SYSTÈME",
      utilisateur: { email: "facturation@blancbleu.fr", role: "système" },
      ressource: {
        type: "Facture",
        id: facture._id,
        reference: facture.numero,
      },
      details: {
        apres: { montant: facture.montant, statut: facture.statut },
        message: `Facture ${facture.numero} générée — ${facture.montant}€`,
      },
    }),
};

module.exports = { log, audit };
