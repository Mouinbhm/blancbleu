// server/seed.js
// ─── Données de démonstration pour BlancBleu ──────────────────────────────────
// Lancer avec : node seed.js

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Unit = require("./models/Unit");
const Intervention = require("./models/Intervention");

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connecté");

    // Nettoyer les collections
    await Promise.all([
      User.deleteMany(),
      Unit.deleteMany(),
      Intervention.deleteMany(),
    ]);
    console.log("🗑️  Collections nettoyées");

    // ─── Utilisateurs ─────────────────────────────────────────────
    const users = await User.create([
      {
        nom: "Dupont",
        prenom: "Marie",
        email: "admin@blancbleu.fr",
        password: "admin123",
        role: "admin",
      },
      {
        nom: "Martin",
        prenom: "Lucas",
        email: "dispatcher@blancbleu.fr",
        password: "dispatcher123",
        role: "dispatcher",
      },
      {
        nom: "Bernard",
        prenom: "Sophie",
        email: "superviseur@blancbleu.fr",
        password: "superviseur123",
        role: "superviseur",
      },
    ]);
    console.log(`👤 ${users.length} utilisateurs créés`);

    // ─── Unités ambulancières ─────────────────────────────────────
    const units = await Unit.create([
      {
        immatriculation: "AB-123-CD",
        nom: "VSAV-01",
        type: "VSAV",
        statut: "disponible",
        position: {
          lat: 48.8566,
          lng: 2.3522,
          adresse: "Base Nord - Paris 18e",
        },
        equipage: [
          { nom: "Durand Paul", role: "Ambulancier" },
          { nom: "Leroy Claire", role: "Secouriste" },
        ],
        carburant: 95,
      },
      {
        immatriculation: "EF-456-GH",
        nom: "SMUR-01",
        type: "SMUR",
        statut: "disponible",
        position: { lat: 48.87, lng: 2.33, adresse: "Hôpital Lariboisière" },
        equipage: [
          { nom: "Moreau Dr Jean", role: "Médecin" },
          { nom: "Petit Infirmier", role: "Infirmier" },
          { nom: "Roux Marc", role: "Ambulancier" },
        ],
        carburant: 88,
      },
      {
        immatriculation: "IJ-789-KL",
        nom: "VSAV-02",
        type: "VSAV",
        statut: "en_mission",
        position: { lat: 48.84, lng: 2.38, adresse: "Paris 12e" },
        equipage: [
          { nom: "Simon Antoine", role: "Ambulancier" },
          { nom: "Laurent Eva", role: "Secouriste" },
        ],
        carburant: 62,
      },
      {
        immatriculation: "MN-012-OP",
        nom: "VSL-01",
        type: "VSL",
        statut: "maintenance",
        position: { lat: 48.86, lng: 2.34, adresse: "Garage central" },
        equipage: [{ nom: "Blanc Thomas", role: "Ambulancier" }],
        carburant: 40,
      },
    ]);
    console.log(`🚑 ${units.length} unités créées`);

    // ─── Interventions ─────────────────────────────────────────────
    const dispatcher = users.find((u) => u.role === "dispatcher");

    const interventions = await Intervention.create([
      {
        typeIncident: "Arrêt cardiaque",
        priorite: "P1",
        scoreIA: 85,
        statut: "en_cours",
        patient: {
          nom: "Lefebvre Michel",
          age: 67,
          etat: "inconscient",
          symptomes: ["arrêt cardiaque", "cyanose"],
          nbVictimes: 1,
        },
        adresse: "12 Rue de Rivoli, Paris 4e",
        coordonnees: { lat: 48.8553, lng: 2.3514 },
        unitAssignee: units[1]._id,
        dispatcher: dispatcher._id,
        heureAppel: new Date(Date.now() - 15 * 60 * 1000),
        heureDepart: new Date(Date.now() - 12 * 60 * 1000),
        notes: "Patient effondré dans la rue, témoin ayant pratiqué MCE",
      },
      {
        typeIncident: "Accident de la route",
        priorite: "P2",
        scoreIA: 65,
        statut: "en_attente",
        patient: {
          nom: "Inconnu",
          etat: "conscient",
          symptomes: ["douleur thoracique intense", "fracture membre"],
          nbVictimes: 2,
        },
        adresse: "Boulevard Périphérique, Porte de Vincennes",
        coordonnees: { lat: 48.8472, lng: 2.4028 },
        dispatcher: dispatcher._id,
        notes: "Collision 2 véhicules, 2 blessés dont 1 coincé",
      },
      {
        typeIncident: "Malaise",
        priorite: "P3",
        scoreIA: 35,
        statut: "terminee",
        patient: {
          nom: "Girard Anne",
          age: 45,
          etat: "stable",
          symptomes: ["vertiges", "nausées"],
          nbVictimes: 1,
        },
        adresse: "8 Avenue de l'Opéra, Paris 1er",
        coordonnees: { lat: 48.8699, lng: 2.3341 },
        unitAssignee: units[0]._id,
        dispatcher: dispatcher._id,
        heureAppel: new Date(Date.now() - 2 * 60 * 60 * 1000),
        heureDepart: new Date(Date.now() - 1.8 * 60 * 60 * 1000),
        heureArrivee: new Date(Date.now() - 1.6 * 60 * 60 * 1000),
        heureTerminee: new Date(Date.now() - 1 * 60 * 60 * 1000),
        notes: "Patient stabilisé sur place, transport aux urgences refusé",
      },
    ]);
    console.log(`🚨 ${interventions.length} interventions créées`);

    console.log("\n═══════════════════════════════════════════");
    console.log("✅ Seed terminé avec succès !");
    console.log("═══════════════════════════════════════════");
    console.log("\n📋 Comptes de connexion :");
    console.log("  Admin       → admin@blancbleu.fr       / admin123");
    console.log("  Dispatcher  → dispatcher@blancbleu.fr  / dispatcher123");
    console.log("  Superviseur → superviseur@blancbleu.fr / superviseur123");
    console.log("═══════════════════════════════════════════\n");
  } catch (err) {
    console.error("❌ Erreur seed:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seed();
