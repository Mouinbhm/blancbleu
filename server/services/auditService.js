/**
 * BlancBleu — Service d'Audit v4.0
 * Transport sanitaire NON urgent
 *
 * Journalise toutes les actions critiques de la plateforme.
 * Vocabulaire : Transport, Vehicule, PMT (Prescription Médicale de Transport).
 * Aucune notion d'urgence, d'escalade ou de priorité P1/P2/P3.
 */
const AuditLog = require("../models/AuditLog");

/**
 * Enregistre une entrée d'audit dans la base de données.
 * Ne fait jamais crasher l'application — silencieux en cas d'erreur.
 *
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
    console.error("[Audit] Erreur d'enregistrement:", err.message);
  }
}

// ── Raccourcis sémantiques ────────────────────────────────────────────────────
const audit = {

  // ─── Transport — Cycle de vie ─────────────────────────────────────────────

  transportCree: (transport, utilisateur) =>
    log({
      action: "TRANSPORT_CREATED",
      origine: "HUMAIN",
      utilisateur,
      ressource: {
        type: "Transport",
        id: transport._id,
        reference: transport.numero,
      },
      details: {
        apres: {
          motif: transport.motif,
          typeTransport: transport.typeTransport,
          patient: `${transport.patient?.nom} ${transport.patient?.prenom}`,
          adresseDepart: transport.adresseDepart,
          adresseDestination: transport.adresseDestination,
        },
        message: `Transport ${transport.numero} créé`,
      },
    }),

  transportConfirme: (transport, utilisateur) =>
    log({
      action: "TRANSPORT_CONFIRMED",
      origine: "HUMAIN",
      utilisateur,
      ressource: { type: "Transport", id: transport._id, reference: transport.numero },
      details: { message: `Transport ${transport.numero} confirmé` },
    }),

  transportPlanifie: (transport, utilisateur) =>
    log({
      action: "TRANSPORT_SCHEDULED",
      origine: "HUMAIN",
      utilisateur,
      ressource: { type: "Transport", id: transport._id, reference: transport.numero },
      details: {
        apres: { dateTransport: transport.dateTransport, heureDepart: transport.heureDepart },
        message: `Transport ${transport.numero} planifié`,
      },
    }),

  transportAnnule: (transport, utilisateur, motifAnnulation) =>
    log({
      action: "TRANSPORT_CANCELLED",
      origine: "HUMAIN",
      utilisateur,
      ressource: { type: "Transport", id: transport._id, reference: transport.numero },
      details: {
        apres: { motifAnnulation },
        message: `Transport ${transport.numero} annulé — ${motifAnnulation || "motif non précisé"}`,
      },
    }),

  transportNoShow: (transport, utilisateur) =>
    log({
      action: "TRANSPORT_NO_SHOW",
      origine: "HUMAIN",
      utilisateur,
      ressource: { type: "Transport", id: transport._id, reference: transport.numero },
      details: { message: `Patient absent — ${transport.numero}` },
    }),

  transportReprogramme: (transport, utilisateur, nouvelleDateHeure) =>
    log({
      action: "TRANSPORT_RESCHEDULED",
      origine: "HUMAIN",
      utilisateur,
      ressource: { type: "Transport", id: transport._id, reference: transport.numero },
      details: {
        apres: nouvelleDateHeure,
        message: `Transport ${transport.numero} reprogrammé`,
      },
    }),

  statutChange: (transport, ancienStatut, nouveauStatut, utilisateur) =>
    log({
      action: "STATUT_CHANGED",
      origine: "HUMAIN",
      utilisateur,
      ressource: {
        type: "Transport",
        id: transport._id,
        reference: transport.numero,
      },
      details: {
        avant: { statut: ancienStatut },
        apres: { statut: nouveauStatut },
        message: `${transport.numero} : ${ancienStatut} → ${nouveauStatut}`,
      },
    }),

  // ─── Affectation véhicule ─────────────────────────────────────────────────

  vehiculeAssigne: (transport, vehicule, utilisateur, origine = "HUMAIN") =>
    log({
      action: "VEHICULE_ASSIGNED",
      origine,
      utilisateur,
      ressource: {
        type: "Transport",
        id: transport._id,
        reference: transport.numero,
      },
      details: {
        apres: {
          vehicule: vehicule.immatriculation,
          type: vehicule.type,
        },
        message: `Véhicule ${vehicule.immatriculation} assigné à ${transport.numero}`,
      },
    }),

  // ─── Dispatch automatique ─────────────────────────────────────────────────

  dispatchAuto: (transport, vehicule, score, eta) =>
    log({
      action: "DISPATCH_AUTO",
      origine: "SYSTÈME",
      utilisateur: { email: "dispatch@blancbleu.fr", role: "système" },
      ressource: {
        type: "Transport",
        id: transport._id,
        reference: transport.numero,
      },
      details: {
        apres: { vehicule: vehicule.immatriculation, score, eta },
        message: `Auto-dispatch : ${vehicule.immatriculation} (score ${score}/100)`,
      },
    }),

  // ─── PMT (Prescription Médicale de Transport) ─────────────────────────────

  pmtUploaded: (transport, utilisateur, fichier) =>
    log({
      action: "PMT_UPLOADED",
      origine: "HUMAIN",
      utilisateur,
      ressource: { type: "Transport", id: transport._id, reference: transport.numero },
      details: {
        apres: { fichier },
        message: `PMT téléversée pour ${transport.numero}`,
      },
    }),

  pmtExtraite: (transport, extraction, confiance) =>
    log({
      action: "PMT_EXTRACTED",
      origine: "IA",
      utilisateur: { email: "ia@blancbleu.fr", role: "ia" },
      ressource: { type: "Transport", id: transport._id, reference: transport.numero },
      details: {
        apres: { extraction, confiance },
        message: `PMT extraite pour ${transport.numero} (confiance ${Math.round(confiance * 100)}%)`,
      },
    }),

  pmtValidee: (transport, utilisateur) =>
    log({
      action: "PMT_VALIDATED",
      origine: "HUMAIN",
      utilisateur,
      ressource: { type: "Transport", id: transport._id, reference: transport.numero },
      details: { message: `PMT validée pour ${transport.numero}` },
    }),

  // ─── IA ──────────────────────────────────────────────────────────────────

  iaDispatchSuggestion: (transport, suggestion, confiance) =>
    log({
      action: "IA_DISPATCH_SUGGESTION",
      origine: "IA",
      utilisateur: { email: "ia@blancbleu.fr", role: "ia" },
      ressource: { type: "Transport", id: transport._id, reference: transport.numero },
      details: {
        apres: { suggestion, confiance },
        message: `IA suggère ${suggestion?.vehicule} pour ${transport.numero}`,
      },
    }),

  iaRouteOptimization: (tourneeId, nbTransports, distanceTotale) =>
    log({
      action: "IA_ROUTE_OPTIMIZATION",
      origine: "IA",
      utilisateur: { email: "ia@blancbleu.fr", role: "ia" },
      ressource: { type: "Tournee", id: null, reference: tourneeId },
      details: {
        apres: { nbTransports, distanceTotale },
        message: `Optimisation tournée ${tourneeId} — ${nbTransports} transports, ${distanceTotale} km`,
      },
    }),

  // ─── Véhicule ─────────────────────────────────────────────────────────────

  vehiculeStatusChange: (vehicule, ancienStatut, nouveauStatut, utilisateur) =>
    log({
      action: "VEHICULE_STATUS_CHANGED",
      origine: "HUMAIN",
      utilisateur,
      ressource: {
        type: "Vehicule",
        id: vehicule._id,
        reference: vehicule.immatriculation,
      },
      details: {
        avant: { statut: ancienStatut },
        apres: { statut: nouveauStatut },
        message: `${vehicule.immatriculation} : ${ancienStatut} → ${nouveauStatut}`,
      },
    }),

  // ─── Authentification ─────────────────────────────────────────────────────

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
      details: {
        message: succes
          ? `Connexion réussie — ${utilisateur.email}`
          : `Tentative échouée — ${utilisateur.email}`,
      },
    }),

  deconnexion: (utilisateur) =>
    log({
      action: "LOGOUT",
      origine: "HUMAIN",
      utilisateur: {
        id: utilisateur._id,
        email: utilisateur.email,
        role: utilisateur.role,
      },
      details: { message: `Déconnexion — ${utilisateur.email}` },
    }),

  // ─── Facturation ──────────────────────────────────────────────────────────

  factureCreee: (facture, transport) =>
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
