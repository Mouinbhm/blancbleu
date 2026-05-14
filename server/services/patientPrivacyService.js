/**
 * BlancBleu — Service de confidentialité patient
 *
 * Masque les données selon le rôle de l'utilisateur demandeur.
 * Principe du moindre privilège : chaque rôle ne voit que ce dont il a besoin.
 */

const MASK = "*** confidentiel ***";

/**
 * Retourne un objet patient filtré selon le rôle.
 *
 * @param {Object} patient  — document Mongoose (toJSON ou lean)
 * @param {String} role     — "admin" | "superviseur" | "dispatcher" | "chauffeur" | "comptable" | "patient"
 * @param {String} purpose  — "consultation" | "transport" | "facturation" | "export"
 * @returns {Object} patient filtré
 */
function sanitizePatientForRole(patient, role, purpose = "consultation") {
  if (!patient) return null;

  const p = typeof patient.toJSON === "function" ? patient.toJSON() : { ...patient };

  switch (role) {
    case "admin":
    case "superviseur":
      // Accès complet
      return p;

    case "dispatcher":
      // Peut voir les infos nécessaires à la planification, pas les données ultra-sensibles
      return _dispatcherView(p);

    case "chauffeur":
      // Uniquement ce qui est nécessaire à la mission
      return _chauffeurView(p);

    case "comptable":
      // Données administratives et facturation — pas de données médicales
      return _comptableView(p);

    case "patient":
      // Le patient voit ses propres données complètes (hors données internes)
      return _patientSelfView(p);

    default:
      // Rôle inconnu : accès minimal
      return _minimalView(p);
  }
}

// ── Vues par rôle ─────────────────────────────────────────────────────────────

function _dispatcherView(p) {
  return {
    _id:           p._id,
    numeroPatient: p.numeroPatient,
    nom:           p.nom,
    prenom:        p.prenom,
    telephone:     p.telephone,
    email:         p.email,
    adresse:       p.adresse,
    mobilite:      p.mobilite,
    oxygene:       p.oxygene,
    brancardage:   p.brancardage,
    accompagnateur: p.accompagnateur,
    contactUrgence: p.contactUrgence,
    caisse:        p.caisse,
    exoneration:   p.exoneration,
    actif:         p.actif,
    // Données sensibles masquées
    numeroSecu:    MASK,
    antecedents:   MASK,
    allergies:     p.allergies,  // utile pour le transport
    notes:         p.notes,
    // RGPD : accès partiel
    gdpr: p.gdpr ? { consentGiven: p.gdpr.consentGiven, anonymized: p.gdpr.anonymized } : {},
  };
}

function _chauffeurView(p) {
  return {
    _id:           p._id,
    nom:           p.nom,
    prenom:        p.prenom,
    telephone:     p.telephone,
    mobilite:      p.mobilite,
    oxygene:       p.oxygene,
    brancardage:   p.brancardage,
    accompagnateur: p.accompagnateur,
    allergies:     p.allergies,   // sécurité médicale en mission
    notes:         p.notes,
    contactUrgence: p.contactUrgence,
    // Masqués
    email:         MASK,
    numeroSecu:    MASK,
    adresse:       MASK,
    antecedents:   MASK,
    caisse:        undefined,
    exoneration:   undefined,
    mutuelle:      undefined,
    gdpr:          undefined,
    consentHistory: undefined,
    accessHistory: undefined,
  };
}

function _comptableView(p) {
  return {
    _id:           p._id,
    numeroPatient: p.numeroPatient,
    nom:           p.nom,
    prenom:        p.prenom,
    caisse:        p.caisse,
    exoneration:   p.exoneration,
    mutuelle:      p.mutuelle,
    // Données médicales masquées
    telephone:     MASK,
    email:         MASK,
    adresse:       MASK,
    numeroSecu:    MASK,
    antecedents:   MASK,
    allergies:     MASK,
    notes:         MASK,
    mobilite:      p.mobilite,  // utile pour la facturation du type transport
    actif:         p.actif,
    gdpr:          undefined,
    consentHistory: undefined,
    accessHistory: undefined,
  };
}

function _patientSelfView(p) {
  // Le patient voit toutes ses données sauf les métadonnées internes
  const { accessHistory, ...rest } = p;
  return {
    ...rest,
    accessHistory: undefined, // ne pas exposer qui a consulté son dossier
  };
}

function _minimalView(p) {
  return {
    _id:           p._id,
    numeroPatient: p.numeroPatient,
    nom:           p.nom ? p.nom[0] + "***" : MASK,
    prenom:        MASK,
    mobilite:      p.mobilite,
    actif:         p.actif,
  };
}

/**
 * Vérifie si un utilisateur a le droit d'accéder à un dossier patient.
 * Retourne true si accès autorisé, false sinon.
 */
function canAccessPatient(user, patientId) {
  if (!user) return false;
  if (["admin", "superviseur", "dispatcher"].includes(user.role)) return true;
  if (user.role === "comptable") return true;
  if (user.role === "chauffeur") return true;
  // Le patient ne peut accéder qu'à son propre dossier
  if (user.role === "patient") return String(user.patientId) === String(patientId);
  return false;
}

/**
 * Masque les champs sensibles d'un champ "patient" embarqué dans un transport.
 */
function sanitizeEmbeddedPatient(embeddedPatient, role) {
  if (!embeddedPatient) return embeddedPatient;
  if (["admin", "superviseur", "dispatcher"].includes(role)) return embeddedPatient;

  return {
    nom:    embeddedPatient.nom,
    prenom: embeddedPatient.prenom,
    telephone: role === "chauffeur" ? embeddedPatient.telephone : MASK,
    email:  MASK,
  };
}

module.exports = {
  sanitizePatientForRole,
  sanitizeEmbeddedPatient,
  canAccessPatient,
  MASK,
};
