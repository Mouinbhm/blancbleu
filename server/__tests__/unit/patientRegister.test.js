/**
 * BlancBleu — Tests unitaires : inscription patient (unicité email par rôle)
 *
 * Cas couverts :
 *   1. Email neuf → inscription réussie (201)
 *   2. Email déjà dispatcher → inscription AUTORISÉE (201)
 *   3. Email déjà patient → inscription bloquée (409)
 *   4. Email déjà patient → login dispatcher BLOQUÉ (401)
 */

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bcrypt = require("bcryptjs");

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = "test-secret-jest";
  process.env.NODE_ENV = "test";
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.ENCRYPTION_KEY = require("crypto").randomBytes(32).toString("base64");

  await mongoose.connect(uri);

  app = require("../../Server");
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
}, 30000);

afterEach(async () => {
  // Nettoyer les collections entre les tests
  const User = mongoose.model("User");
  const Patient = mongoose.model("Patient");
  await User.deleteMany({});
  await Patient.deleteMany({});
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const SHARED_EMAIL = "shared@example.com";

async function createDispatcher(email = SHARED_EMAIL) {
  const User = mongoose.model("User");
  const hash = await bcrypt.hash("Password123!", 10);
  return User.create({
    prenom: "Disp",
    nom: "TEST",
    email,
    password: hash,
    role: "dispatcher",
    actif: true,
  });
}

async function registerPatient(email = SHARED_EMAIL) {
  return request(app)
    .post("/api/patient/register")
    .send({
      prenom: "Jean",
      nom: "Dupont",
      email,
      password: "Password123!",
      telephone: "0612345678",
    });
}

async function loginPatient(email = SHARED_EMAIL) {
  return request(app)
    .post("/api/patient/login")
    .send({ email, password: "Password123!" });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/patient/register — unicité email par rôle", () => {
  test("1. Email neuf → inscription réussie (201)", async () => {
    const res = await registerPatient("nouveau@example.com");

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.patient.role).toBe("patient");
  });

  test("2. Email déjà utilisé comme dispatcher → inscription patient autorisée (201)", async () => {
    await createDispatcher(SHARED_EMAIL);

    const res = await registerPatient(SHARED_EMAIL);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.patient.email).toBe(SHARED_EMAIL);
    expect(res.body.patient.role).toBe("patient");
  });

  test("3. Email déjà utilisé comme patient → inscription bloquée (409)", async () => {
    // Créer un premier compte patient
    await registerPatient(SHARED_EMAIL);

    // Tenter d'en créer un second avec le même email
    const res = await registerPatient(SHARED_EMAIL);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/compte patient existe déjà/i);
  });

  test("4. Email commun dispatcher+patient → seul le patient peut se connecter via /patient/login", async () => {
    await createDispatcher(SHARED_EMAIL);
    await registerPatient(SHARED_EMAIL);

    const res = await loginPatient(SHARED_EMAIL);

    // Doit retourner le compte patient, pas le dispatcher
    expect(res.status).toBe(200);
    expect(res.body.patient.role).toBe("patient");
  });
});

describe("POST /api/patient/login — isolation de rôle", () => {
  test("Dispatcher seul → login patient retourne 401 (pas de compte patient)", async () => {
    await createDispatcher(SHARED_EMAIL);

    const res = await loginPatient(SHARED_EMAIL);

    // Aucun User avec role=patient et cet email → 401
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/identifiants incorrects/i);
  });
});
