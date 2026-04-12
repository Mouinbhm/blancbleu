/**
 * BlancBleu — Tests State Machine des Interventions
 *
 * Couverture :
 *   - 16 transitions valides
 *   - 8 transitions invalides
 *   - Conditions métier pré-transition
 *   - Calcul progression %
 *   - Horodatages auto
 *   - Journal des transitions
 *   - Cas limites (états terminaux)
 */

const {
  InterventionStateMachine,
  STATUTS,
  TRANSITIONS,
  LABELS,
} = require("../../services/stateMachine");

// ─── Factory ──────────────────────────────────────────────────────────────────
// Inclut typeIncident, adresse et priorite — requis par CREATED → VALIDATED
const makeIntervention = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439011",
  statut: "CREATED",
  priorite: "P2",
  typeIncident: "Malaise",
  adresse: "59 Bd Madeleine, Nice",
  unitAssignee: null,
  patient: { etat: "conscient", nbVictimes: 1 },
  heureCreation: new Date(Date.now() - 5 * 60 * 1000),
  journal: [],
  ...overrides,
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — peutTransitionner
// ══════════════════════════════════════════════════════════════════════════════
describe("peutTransitionner", () => {
  const casValides = [
    ["CREATED", "VALIDATED"],
    ["CREATED", "CANCELLED"],
    ["VALIDATED", "ASSIGNED"],
    ["VALIDATED", "CANCELLED"],
    ["ASSIGNED", "EN_ROUTE"],
    ["ASSIGNED", "CANCELLED"],
    ["EN_ROUTE", "ON_SITE"],
    ["EN_ROUTE", "CANCELLED"],
    ["ON_SITE", "TRANSPORTING"],
    ["ON_SITE", "COMPLETED"],
    ["ON_SITE", "CANCELLED"],
    ["TRANSPORTING", "COMPLETED"],
    ["TRANSPORTING", "CANCELLED"],
  ];

  test.each(casValides)("autorise %s → %s", (de, vers) => {
    expect(InterventionStateMachine.peutTransitionner(de, vers)).toBe(true);
  });

  const casInvalides = [
    ["CREATED", "ASSIGNED"],
    ["CREATED", "EN_ROUTE"],
    ["VALIDATED", "TRANSPORTING"],
    ["EN_ROUTE", "CREATED"],
    ["COMPLETED", "CREATED"],
    ["COMPLETED", "CANCELLED"],
    ["CANCELLED", "CREATED"],
    ["CANCELLED", "VALIDATED"],
  ];

  test.each(casInvalides)("refuse %s → %s", (de, vers) => {
    expect(InterventionStateMachine.peutTransitionner(de, vers)).toBe(false);
  });

  test("retourne false pour un statut inconnu", () => {
    expect(
      InterventionStateMachine.peutTransitionner("INCONNU", "VALIDATED"),
    ).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — validerTransition (conditions métier)
// ══════════════════════════════════════════════════════════════════════════════
describe("validerTransition — conditions métier", () => {
  test("CREATED → VALIDATED requiert adresse", () => {
    const i = makeIntervention({ statut: "CREATED", adresse: "" });
    const erreurs = InterventionStateMachine.validerTransition(i, "VALIDATED");
    expect(erreurs).toContain("Adresse manquante");
  });

  test("CREATED → VALIDATED requiert typeIncident", () => {
    const i = makeIntervention({ statut: "CREATED", typeIncident: "" });
    const erreurs = InterventionStateMachine.validerTransition(i, "VALIDATED");
    expect(erreurs).toContain("Type d'incident manquant");
  });

  test("CREATED → VALIDATED passe si tous les champs sont présents", () => {
    const i = makeIntervention({ statut: "CREATED" });
    const erreurs = InterventionStateMachine.validerTransition(i, "VALIDATED");
    expect(erreurs).toHaveLength(0);
  });

  test("VALIDATED → ASSIGNED requiert unitAssignee", () => {
    const i = makeIntervention({ statut: "VALIDATED", unitAssignee: null });
    const erreurs = InterventionStateMachine.validerTransition(i, "ASSIGNED");
    expect(erreurs).toContain("Aucune unité assignée");
  });

  test("VALIDATED → ASSIGNED passe si unité présente", () => {
    const i = makeIntervention({
      statut: "VALIDATED",
      unitAssignee: { _id: "abc", nom: "VSAV-01" },
    });
    const erreurs = InterventionStateMachine.validerTransition(i, "ASSIGNED");
    expect(erreurs).toHaveLength(0);
  });

  test("ASSIGNED → EN_ROUTE requiert unitAssignee", () => {
    const i = makeIntervention({ statut: "ASSIGNED", unitAssignee: null });
    const erreurs = InterventionStateMachine.validerTransition(i, "EN_ROUTE");
    expect(erreurs).toContain("Aucune unité assignée");
  });

  test("ON_SITE → TRANSPORTING requiert état patient renseigné", () => {
    const i = makeIntervention({ statut: "ON_SITE", patient: { etat: null } });
    const erreurs = InterventionStateMachine.validerTransition(
      i,
      "TRANSPORTING",
    );
    expect(erreurs).toContain("État du patient non renseigné");
  });

  test("ON_SITE → TRANSPORTING passe si état patient renseigné", () => {
    const i = makeIntervention({
      statut: "ON_SITE",
      patient: { etat: "conscient" },
    });
    const erreurs = InterventionStateMachine.validerTransition(
      i,
      "TRANSPORTING",
    );
    expect(erreurs).toHaveLength(0);
  });

  test("→ CANCELLED est toujours autorisé sans conditions", () => {
    const i = makeIntervention({ statut: "EN_ROUTE", unitAssignee: null });
    const erreurs = InterventionStateMachine.validerTransition(i, "CANCELLED");
    expect(erreurs).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — effectuerTransition
// ══════════════════════════════════════════════════════════════════════════════
describe("effectuerTransition", () => {
  test("retourne update + entreeJournal pour une transition valide", () => {
    const i = makeIntervention({ statut: "CREATED" });
    const { update, entreeJournal } =
      InterventionStateMachine.effectuerTransition(i, "VALIDATED", {
        utilisateur: "dispatcher@test.fr",
      });
    expect(update.statut).toBe("VALIDATED");
    expect(update.heureValidation).toBeInstanceOf(Date);
    expect(entreeJournal.de).toBe("CREATED");
    expect(entreeJournal.vers).toBe("VALIDATED");
    expect(entreeJournal.utilisateur).toBe("dispatcher@test.fr");
  });

  test("lance une erreur pour une transition non autorisée", () => {
    const i = makeIntervention({ statut: "CREATED" });
    expect(() =>
      InterventionStateMachine.effectuerTransition(i, "COMPLETED"),
    ).toThrow("Transition invalide");
  });

  test("lance une erreur si conditions métier non remplies", () => {
    const i = makeIntervention({ statut: "VALIDATED", unitAssignee: null });
    expect(() =>
      InterventionStateMachine.effectuerTransition(i, "ASSIGNED"),
    ).toThrow("Conditions non remplies");
  });

  test("calcule dureeMinutes à la complétion", () => {
    const i = makeIntervention({
      statut: "TRANSPORTING",
      heureCreation: new Date(Date.now() - 45 * 60 * 1000),
    });
    const { update } = InterventionStateMachine.effectuerTransition(
      i,
      "COMPLETED",
    );
    expect(update.dureeMinutes).toBeGreaterThanOrEqual(44);
    expect(update.dureeMinutes).toBeLessThanOrEqual(46);
  });

  test("ajoute raisonAnnulation lors d'une annulation avec notes", () => {
    const i = makeIntervention({ statut: "CREATED" });
    const { update } = InterventionStateMachine.effectuerTransition(
      i,
      "CANCELLED",
      { notes: "Fausse alerte" },
    );
    expect(update.raisonAnnulation).toBe("Fausse alerte");
  });

  test("utilise la raison par défaut si notes absent", () => {
    const i = makeIntervention({ statut: "CREATED" });
    const { update } = InterventionStateMachine.effectuerTransition(
      i,
      "CANCELLED",
    );
    expect(update.raisonAnnulation).toBe("Annulé par opérateur");
  });

  test("utilise 'système' comme utilisateur par défaut", () => {
    const i = makeIntervention({ statut: "CREATED" });
    const { entreeJournal } = InterventionStateMachine.effectuerTransition(
      i,
      "VALIDATED",
    );
    expect(entreeJournal.utilisateur).toBe("système");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 4 — progression
// Valeurs réelles : 7 statuts (index 0 à 6), progression = idx/6 * 100
//   CREATED=0  VALIDATED=17  ASSIGNED=33  EN_ROUTE=50
//   ON_SITE=67  TRANSPORTING=83  COMPLETED=100  CANCELLED=null
// ══════════════════════════════════════════════════════════════════════════════
describe("progression", () => {
  const cas = [
    ["CREATED", 0],
    ["VALIDATED", 17],
    ["ASSIGNED", 33],
    ["EN_ROUTE", 50],
    ["ON_SITE", 67],
    ["TRANSPORTING", 83],
    ["COMPLETED", 100],
    ["CANCELLED", null],
  ];

  test.each(cas)("progression de %s = %s%%", (statut, attendu) => {
    const result = InterventionStateMachine.progression(statut);
    if (attendu === null) {
      expect(result).toBeNull();
    } else {
      // Tolérance ±2 pour les arrondis
      expect(result).toBeGreaterThanOrEqual(attendu - 2);
      expect(result).toBeLessThanOrEqual(attendu + 2);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 5 — transitionsPossibles
// ══════════════════════════════════════════════════════════════════════════════
describe("transitionsPossibles", () => {
  test("CREATED peut aller vers VALIDATED et CANCELLED", () => {
    const transitions =
      InterventionStateMachine.transitionsPossibles("CREATED");
    const statuts = transitions.map((t) => t.statut);
    expect(statuts).toContain("VALIDATED");
    expect(statuts).toContain("CANCELLED");
  });

  test("COMPLETED n'a aucune transition possible", () => {
    const transitions =
      InterventionStateMachine.transitionsPossibles("COMPLETED");
    expect(transitions).toHaveLength(0);
  });

  test("CANCELLED n'a aucune transition possible", () => {
    const transitions =
      InterventionStateMachine.transitionsPossibles("CANCELLED");
    expect(transitions).toHaveLength(0);
  });

  test("chaque transition contient statut et label", () => {
    const transitions =
      InterventionStateMachine.transitionsPossibles("CREATED");
    transitions.forEach((t) => {
      expect(t).toHaveProperty("statut");
      expect(t).toHaveProperty("label");
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 6 — LABELS et STATUTS
// ══════════════════════════════════════════════════════════════════════════════
describe("LABELS et STATUTS", () => {
  test("tous les statuts ont un label français", () => {
    Object.keys(STATUTS).forEach((statut) => {
      expect(LABELS[statut]).toBeDefined();
      expect(LABELS[statut].fr).toBeTruthy();
    });
  });

  test("TRANSITIONS couvre tous les statuts non terminaux", () => {
    const nonTerminaux = [
      "CREATED",
      "VALIDATED",
      "ASSIGNED",
      "EN_ROUTE",
      "ON_SITE",
      "TRANSPORTING",
    ];
    nonTerminaux.forEach((statut) => {
      expect(TRANSITIONS[statut]).toBeDefined();
      expect(TRANSITIONS[statut].length).toBeGreaterThan(0);
    });
  });
});
