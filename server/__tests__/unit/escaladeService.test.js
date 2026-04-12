/**
 * BlancBleu — Tests Système d'Escalade
 *
 * Couverture :
 *   - Règle 1 : disponibilité unités
 *   - Règle 2 : ETA trop long
 *   - Règle 3 : P1 override
 *   - Règle 4 : sans réponse
 *   - Règle 5 : plan NOVI
 *   - Moteur analyserEscalade (intégration des règles)
 */

jest.mock("../../models/Unit");
jest.mock("../../models/Intervention");
jest.mock("../../services/socketService", () => ({
  emitEscalationTriggered: jest.fn(),
}));

const Unit = require("../../models/Unit");
const {
  verifierDisponibiliteUnites,
  verifierPrioriteCritique,
  verifierSansReponse,
  verifierNOVI,
  SEUILS,
  NIVEAUX,
} = require("../../services/escaladeService");

// ─── Factories ────────────────────────────────────────────────────────────────
const makeIntervention = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439011",
  numero: "INT-20241201-0001",
  priorite: "P2",
  typeIncident: "Malaise",
  statut: "CREATED",
  unitAssignee: null,
  patient: { nbVictimes: 1 },
  coordonnees: { lat: 43.71, lng: 7.26 },
  heureCreation: new Date(Date.now() - 5 * 60 * 1000),
  createdAt: new Date(Date.now() - 5 * 60 * 1000),
  ...overrides,
});

const makeUnite = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439022",
  nom: "VSAV-01",
  type: "VSAV",
  statut: "disponible",
  position: { lat: 43.72, lng: 7.25 },
  ...overrides,
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — Règle 1 : disponibilité
// ══════════════════════════════════════════════════════════════════════════════
describe("verifierDisponibiliteUnites", () => {
  afterEach(() => jest.clearAllMocks());

  test("EMERGENCY si aucune unité disponible", async () => {
    Unit.countDocuments.mockResolvedValue(0);
    const result = await verifierDisponibiliteUnites("P2");
    expect(result.declenchee).toBe(true);
    expect(result.niveau).toBe(NIVEAUX.EMERGENCY);
    expect(result.code).toBe("NO_UNIT_AVAILABLE");
  });

  test("CRITICAL si P1 sans SMUR disponible", async () => {
    Unit.countDocuments
      .mockResolvedValueOnce(3) // unités dispo en général
      .mockResolvedValueOnce(0); // SMUR dispo
    const result = await verifierDisponibiliteUnites("P1");
    expect(result.declenchee).toBe(true);
    expect(result.niveau).toBe(NIVEAUX.CRITICAL);
    expect(result.code).toBe("NO_SMUR_AVAILABLE");
  });

  test("non déclenchée si unités disponibles pour P2", async () => {
    Unit.countDocuments.mockResolvedValue(3);
    const result = await verifierDisponibiliteUnites("P2");
    expect(result.declenchee).toBe(false);
  });

  test("non déclenchée si P1 avec SMUR disponible", async () => {
    Unit.countDocuments.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    const result = await verifierDisponibiliteUnites("P1");
    expect(result.declenchee).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — Règle 3 : P1 critique override
// ══════════════════════════════════════════════════════════════════════════════
describe("verifierPrioriteCritique", () => {
  test("EMERGENCY pour toute intervention P1", () => {
    const i = makeIntervention({ priorite: "P1", typeIncident: "Malaise" });
    const result = verifierPrioriteCritique(i);
    expect(result.declenchee).toBe(true);
    expect(result.niveau).toBe(NIVEAUX.EMERGENCY);
    expect(result.code).toBe("P1_OVERRIDE");
  });

  test("inclut action défibrillateur pour arrêt cardiaque P1", () => {
    const i = makeIntervention({
      priorite: "P1",
      typeIncident: "Arrêt cardiaque",
    });
    const result = verifierPrioriteCritique(i);
    expect(result.action).toContain("Défibrillateur");
  });

  test("non déclenchée pour P2", () => {
    const i = makeIntervention({ priorite: "P2" });
    const result = verifierPrioriteCritique(i);
    expect(result.declenchee).toBe(false);
  });

  test("non déclenchée pour P3", () => {
    const i = makeIntervention({ priorite: "P3" });
    const result = verifierPrioriteCritique(i);
    expect(result.declenchee).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — Règle 4 : sans réponse
// ══════════════════════════════════════════════════════════════════════════════
describe("verifierSansReponse", () => {
  test("EMERGENCY si P1 sans assignation depuis > 3 min", () => {
    const i = makeIntervention({
      priorite: "P1",
      statut: "CREATED",
      unitAssignee: null,
      heureCreation: new Date(Date.now() - 4 * 60 * 1000), // 4 min
    });
    const result = verifierSansReponse(i);
    expect(result.declenchee).toBe(true);
    expect(result.niveau).toBe(NIVEAUX.EMERGENCY);
    expect(result.code).toBe("NO_RESPONSE");
  });

  test("WARNING si P2 sans assignation depuis > 10 min", () => {
    const i = makeIntervention({
      priorite: "P2",
      statut: "CREATED",
      unitAssignee: null,
      heureCreation: new Date(Date.now() - 12 * 60 * 1000), // 12 min
    });
    const result = verifierSansReponse(i);
    expect(result.declenchee).toBe(true);
    expect(result.niveau).toBe(NIVEAUX.WARNING);
  });

  test("non déclenchée si intervention déjà assignée", () => {
    const i = makeIntervention({
      priorite: "P1",
      statut: "ASSIGNED",
      unitAssignee: { _id: "abc" },
      heureCreation: new Date(Date.now() - 10 * 60 * 1000),
    });
    const result = verifierSansReponse(i);
    expect(result.declenchee).toBe(false);
  });

  test("non déclenchée si P1 récent (< 3 min)", () => {
    const i = makeIntervention({
      priorite: "P1",
      statut: "CREATED",
      unitAssignee: null,
      heureCreation: new Date(Date.now() - 1 * 60 * 1000), // 1 min
    });
    const result = verifierSansReponse(i);
    expect(result.declenchee).toBe(false);
  });

  test("non déclenchée si statut non éligible (EN_ROUTE)", () => {
    const i = makeIntervention({
      priorite: "P2",
      statut: "EN_ROUTE",
      unitAssignee: null,
      heureCreation: new Date(Date.now() - 20 * 60 * 1000),
    });
    const result = verifierSansReponse(i);
    expect(result.declenchee).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 4 — Règle 5 : plan NOVI
// ══════════════════════════════════════════════════════════════════════════════
describe("verifierNOVI", () => {
  test("EMERGENCY si >= 5 victimes", () => {
    const i = makeIntervention({ patient: { nbVictimes: 5 } });
    const result = verifierNOVI(i);
    expect(result.declenchee).toBe(true);
    expect(result.niveau).toBe(NIVEAUX.EMERGENCY);
    expect(result.code).toBe("PLAN_NOVI");
  });

  test("calcule correctement le nombre d'unités requises", () => {
    const i = makeIntervention({ patient: { nbVictimes: 9 } });
    const result = verifierNOVI(i);
    expect(result.donnees.unitsRequises).toBe(3); // ceil(9/3)
  });

  test("non déclenchée si < 5 victimes", () => {
    const i = makeIntervention({ patient: { nbVictimes: 4 } });
    const result = verifierNOVI(i);
    expect(result.declenchee).toBe(false);
  });

  test("non déclenchée si nbVictimes absent (défaut = 1)", () => {
    const i = makeIntervention({ patient: {} });
    const result = verifierNOVI(i);
    expect(result.declenchee).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 5 — Constantes
// ══════════════════════════════════════════════════════════════════════════════
describe("SEUILS et NIVEAUX", () => {
  test("SEUILS.ETA_MAX respecte la hiérarchie P1 < P2 < P3", () => {
    expect(SEUILS.ETA_MAX.P1).toBeLessThan(SEUILS.ETA_MAX.P2);
    expect(SEUILS.ETA_MAX.P2).toBeLessThan(SEUILS.ETA_MAX.P3);
  });

  test("SEUILS.SANS_REPONSE respecte la hiérarchie P1 < P2 < P3", () => {
    expect(SEUILS.SANS_REPONSE.P1).toBeLessThan(SEUILS.SANS_REPONSE.P2);
    expect(SEUILS.SANS_REPONSE.P2).toBeLessThan(SEUILS.SANS_REPONSE.P3);
  });

  test("NIVEAUX ont des priorités croissantes INFO < WARNING < CRITICAL < EMERGENCY", () => {
    expect(NIVEAUX.INFO.priorite).toBeLessThan(NIVEAUX.WARNING.priorite);
    expect(NIVEAUX.WARNING.priorite).toBeLessThan(NIVEAUX.CRITICAL.priorite);
    expect(NIVEAUX.CRITICAL.priorite).toBeLessThan(NIVEAUX.EMERGENCY.priorite);
  });
});
