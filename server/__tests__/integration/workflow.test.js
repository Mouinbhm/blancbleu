/**
 * BlancBleu — Tests Intégration Workflow (State Machine via API)
 */

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bcrypt = require("bcryptjs");

let mongod;

// ─── Setup global ─────────────────────────────────────────────────────────────
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = "test-secret-blancbleu-jest";
  process.env.NODE_ENV = "test";
  process.env.AI_API_URL = "http://localhost:5001";

  // Connexion directe — les modèles Mongoose sont immédiatement disponibles
  await mongoose.connect(uri);

  // Créer un dispatcher de test réutilisé dans toutes les suites
  const User = require("../../models/User");
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash("pass1234", salt);
  await User.create({
    nom: "Test",
    prenom: "Dispatcher",
    email: "disp@test.fr",
    password: hashed,
    role: "dispatcher",
    actif: true,
  });

  // Récupérer le token une seule fois
  const app = require("../../Server");
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "disp@test.fr", password: "pass1234" });

  global.__token__ = res.body.token;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
}, 30000);

beforeEach(async () => {
  const Intervention = require("../../models/Intervention");
  const Unit = require("../../models/Unit");
  await Intervention.deleteMany({});
  await Unit.deleteMany({});
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getApp() {
  return require("../../Server");
}

async function creerIntervention(overrides = {}) {
  const Intervention = require("../../models/Intervention");
  return Intervention.create({
    typeIncident: "Malaise",
    adresse: "59 Bd Madeleine, Nice",
    priorite: "P2",
    statut: "CREATED",
    coordonnees: { lat: 43.71, lng: 7.26 },
    patient: { etat: "conscient", nbVictimes: 1 },
    ...overrides,
  });
}

async function creerUnite(overrides = {}) {
  const Unit = require("../../models/Unit");
  return Unit.create({
    nom: "VSAV-01",
    type: "VSAV",
    immatriculation: "AA-000-AA",
    statut: "disponible",
    position: { lat: 43.72, lng: 7.25 },
    carburant: 80,
    kilometrage: 10000,
    ...overrides,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — GET status
// ══════════════════════════════════════════════════════════════════════════════
describe("GET /api/workflow/:id/status", () => {
  test("retourne statut complet avec transitions possibles", async () => {
    const app = getApp();
    const i = await creerIntervention();

    const res = await request(app)
      .get(`/api/workflow/${i._id}/status`)
      .set("Authorization", `Bearer ${global.__token__}`);

    expect(res.status).toBe(200);
    expect(res.body.statut).toBe("CREATED");
    expect(res.body.transitions).toBeInstanceOf(Array);
    expect(res.body.transitions.length).toBeGreaterThan(0);
    expect(res.body.progression).toBeDefined();
  });

  test("404 pour ID inexistant", async () => {
    const app = getApp();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .get(`/api/workflow/${fakeId}/status`)
      .set("Authorization", `Bearer ${global.__token__}`);

    expect(res.status).toBe(404);
  });

  test("401 sans token", async () => {
    const app = getApp();
    const i = await creerIntervention();

    const res = await request(app).get(`/api/workflow/${i._id}/status`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — Transitions valides
// ══════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/workflow/:id/transition — transitions valides", () => {
  test("CREATED → VALIDATED", async () => {
    const app = getApp();
    const i = await creerIntervention({ statut: "CREATED" });

    const res = await request(app)
      .patch(`/api/workflow/${i._id}/transition`)
      .set("Authorization", `Bearer ${global.__token__}`)
      .send({ statut: "VALIDATED" });

    expect(res.status).toBe(200);
    expect(res.body.intervention.statut).toBe("VALIDATED");
  });

  test("VALIDATED → ASSIGNED avec unité assignée", async () => {
    const app = getApp();
    const unit = await creerUnite();
    const i = await creerIntervention({
      statut: "VALIDATED",
      unitAssignee: unit._id,
    });

    const res = await request(app)
      .patch(`/api/workflow/${i._id}/transition`)
      .set("Authorization", `Bearer ${global.__token__}`)
      .send({ statut: "ASSIGNED" });

    expect(res.status).toBe(200);
    expect(res.body.intervention.statut).toBe("ASSIGNED");
  });

  test("CREATED → CANCELLED avec raison", async () => {
    const app = getApp();
    const i = await creerIntervention({ statut: "CREATED" });

    const res = await request(app)
      .patch(`/api/workflow/${i._id}/transition`)
      .set("Authorization", `Bearer ${global.__token__}`)
      .send({ statut: "CANCELLED", notes: "Fausse alerte confirmée" });

    expect(res.status).toBe(200);
    expect(res.body.intervention.statut).toBe("CANCELLED");
  });

  test("journal enregistre la transition avec utilisateur", async () => {
    const app = getApp();
    const Intervention = require("../../models/Intervention");
    const i = await creerIntervention({ statut: "CREATED" });

    await request(app)
      .patch(`/api/workflow/${i._id}/transition`)
      .set("Authorization", `Bearer ${global.__token__}`)
      .send({ statut: "VALIDATED" });

    const updated = await Intervention.findById(i._id);
    const derniere = updated.journal[updated.journal.length - 1];

    expect(derniere.de).toBe("CREATED");
    expect(derniere.vers).toBe("VALIDATED");
    expect(derniere.utilisateur).toBe("disp@test.fr");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — Transitions invalides
// ══════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/workflow/:id/transition — transitions invalides", () => {
  test("422 pour transition non autorisée (CREATED → COMPLETED)", async () => {
    const app = getApp();
    const i = await creerIntervention({ statut: "CREATED" });

    const res = await request(app)
      .patch(`/api/workflow/${i._id}/transition`)
      .set("Authorization", `Bearer ${global.__token__}`)
      .send({ statut: "COMPLETED" });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Transition invalide/i);
  });

  test("422 si conditions non remplies (VALIDATED → ASSIGNED sans unité)", async () => {
    const app = getApp();
    const i = await creerIntervention({
      statut: "VALIDATED",
      unitAssignee: null,
    });

    const res = await request(app)
      .patch(`/api/workflow/${i._id}/transition`)
      .set("Authorization", `Bearer ${global.__token__}`)
      .send({ statut: "ASSIGNED" });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Conditions non remplies/i);
  });

  test("400 si statut manquant dans le body", async () => {
    const app = getApp();
    const i = await creerIntervention({ statut: "CREATED" });

    const res = await request(app)
      .patch(`/api/workflow/${i._id}/transition`)
      .set("Authorization", `Bearer ${global.__token__}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test("422 pour état terminal COMPLETED → VALIDATED", async () => {
    const app = getApp();
    const i = await creerIntervention({ statut: "COMPLETED" });

    const res = await request(app)
      .patch(`/api/workflow/${i._id}/transition`)
      .set("Authorization", `Bearer ${global.__token__}`)
      .send({ statut: "VALIDATED" });

    expect(res.status).toBe(422);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 4 — Documentation
// ══════════════════════════════════════════════════════════════════════════════
describe("GET /api/workflow/transitions", () => {
  test("retourne la carte complète des transitions", async () => {
    const app = getApp();

    const res = await request(app)
      .get("/api/workflow/transitions")
      .set("Authorization", `Bearer ${global.__token__}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);

    const created = res.body.find((t) => t.de === "CREATED");
    expect(created).toBeDefined();
    expect(created.vers).toBeInstanceOf(Array);
  });
});
