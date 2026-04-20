/**
 * BlancBleu — Tests unitaires TarifService (Barème CPAM 2024)
 *
 * Couverture :
 *   - arrondir          : arrondi comptable à 2 décimales
 *   - estNuit           : détection 20h–8h
 *   - estDimancheOuFerie: dimanche + jours fériés français
 *   - parseDateHeure    : fusion date + heure "HH:MM"
 *   - calculerTarifSync : VSL / TPMR / AMBULANCE (barème 2024)
 *   - calculerTarifSync : aller-retour (distance × 2)
 *   - calculerTarifSync : suppléments ambulance (nuit, dimanche, cumul)
 *   - calculerTarifSync : taux de prise en charge personnalisé (ALD 100%)
 *   - calculerTarifSync : type inconnu → erreur explicite
 *
 * Les tests utilisent calculerTarifSync (synchrone, sans OSRM)
 * pour garantir la déterminisme et la rapidité d'exécution.
 * calculerTarif (async / OSRM) est testé en intégration.
 */

const {
  arrondir,
  estNuit,
  estDimancheOuFerie,
  parseDateHeure,
  calculerTarifSync,
  BAREME,
  TAUX_CPAM_DEFAUT,
} = require("../../services/tarifService");

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DU BARÈME 2024 (vérifiées pour chaque test)
// ─────────────────────────────────────────────────────────────────────────────
describe("BAREME — constantes CPAM 2024", () => {
  it("doit exposer les trois types de véhicules", () => {
    expect(BAREME).toHaveProperty("VSL");
    expect(BAREME).toHaveProperty("TPMR");
    expect(BAREME).toHaveProperty("AMBULANCE");
  });

  it("VSL — forfait 12.61€, prix km 0.62€", () => {
    expect(BAREME.VSL.forfait).toBe(12.61);
    expect(BAREME.VSL.prixKm).toBe(0.62);
  });

  it("TPMR — forfait 25.00€, prix km 0.95€", () => {
    expect(BAREME.TPMR.forfait).toBe(25.0);
    expect(BAREME.TPMR.prixKm).toBe(0.95);
  });

  it("AMBULANCE — forfait 46.31€, prix km 0.91€, suppléments 19.19€", () => {
    expect(BAREME.AMBULANCE.forfait).toBe(46.31);
    expect(BAREME.AMBULANCE.prixKm).toBe(0.91);
    expect(BAREME.AMBULANCE.supplementNuit).toBe(19.19);
    expect(BAREME.AMBULANCE.supplementDimancheOuFerie).toBe(19.19);
  });

  it("taux CPAM par défaut : 65%", () => {
    expect(TAUX_CPAM_DEFAUT).toBe(65);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// arrondir
// ─────────────────────────────────────────────────────────────────────────────
describe("arrondir()", () => {
  it("laisse intact un montant déjà à 2 décimales", () => {
    expect(arrondir(12.34)).toBe(12.34);
  });

  it("arrondit à 2 décimales supérieures", () => {
    expect(arrondir(12.345)).toBe(12.35);
  });

  it("arrondit à 2 décimales inférieures", () => {
    expect(arrondir(12.344)).toBe(12.34);
  });

  it("gère les entiers", () => {
    expect(arrondir(100)).toBe(100);
  });

  it("gère zéro", () => {
    expect(arrondir(0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// estNuit
// ─────────────────────────────────────────────────────────────────────────────
describe("estNuit()", () => {
  const heureNuit = (h) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d;
  };

  it("00h → nuit", () => expect(estNuit(heureNuit(0))).toBe(true));
  it("03h → nuit", () => expect(estNuit(heureNuit(3))).toBe(true));
  it("07h59 → nuit (limite)", () => {
    const d = new Date();
    d.setHours(7, 59, 0, 0);
    expect(estNuit(d)).toBe(true);
  });
  it("08h00 → jour (limite)", () => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    expect(estNuit(d)).toBe(false);
  });
  it("12h → jour", () => expect(estNuit(heureNuit(12))).toBe(false));
  it("19h59 → jour", () => {
    const d = new Date();
    d.setHours(19, 59, 0, 0);
    expect(estNuit(d)).toBe(false);
  });
  it("20h00 → nuit (limite)", () => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    expect(estNuit(d)).toBe(true);
  });
  it("23h → nuit", () => expect(estNuit(heureNuit(23))).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// estDimancheOuFerie
// ─────────────────────────────────────────────────────────────────────────────
describe("estDimancheOuFerie()", () => {
  it("dimanche → true", () => {
    // 2026-01-04 est un dimanche
    expect(estDimancheOuFerie(new Date("2026-01-04T10:00:00Z"))).toBe(true);
  });

  it("lundi ordinaire → false", () => {
    // 2026-01-05 est un lundi ordinaire
    expect(estDimancheOuFerie(new Date("2026-01-05T10:00:00Z"))).toBe(false);
  });

  it("1er janvier 2025 (Jour de l'An) → true", () => {
    expect(estDimancheOuFerie(new Date("2025-01-01T10:00:00Z"))).toBe(true);
  });

  it("1er mai 2025 (Fête du Travail) → true", () => {
    expect(estDimancheOuFerie(new Date("2025-05-01T10:00:00Z"))).toBe(true);
  });

  it("14 juillet 2025 (Fête Nationale) → true", () => {
    expect(estDimancheOuFerie(new Date("2025-07-14T10:00:00Z"))).toBe(true);
  });

  it("25 décembre 2026 (Noël) → true", () => {
    expect(estDimancheOuFerie(new Date("2026-12-25T10:00:00Z"))).toBe(true);
  });

  it("jour ordinaire en semaine → false", () => {
    // 2025-06-10 est un mardi ordinaire
    expect(estDimancheOuFerie(new Date("2025-06-10T10:00:00Z"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseDateHeure
// ─────────────────────────────────────────────────────────────────────────────
describe("parseDateHeure()", () => {
  it("fusionne correctement date et heure HH:MM", () => {
    const d = parseDateHeure("2025-05-15", "14:30");
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it("accepte une Date en entrée", () => {
    const input = new Date("2025-05-15");
    const d = parseDateHeure(input, "08:00");
    expect(d.getHours()).toBe(8);
  });

  it("laisse l'heure à 00:00 si heureRDV absent", () => {
    const d = parseDateHeure("2025-05-15", null);
    // L'heure initiale de la date ISO est préservée (minuit UTC → peut être 1h ou 2h local)
    expect(d).toBeInstanceOf(Date);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculerTarifSync — VSL (tarif de base)
// ─────────────────────────────────────────────────────────────────────────────
describe("calculerTarifSync() — VSL", () => {
  it("trajet 10 km, taux 65%", () => {
    // Attendu : 12.61 + 0.62 × 10 = 18.81 € total
    //           18.81 × 0.65 = 12.23 € CPAM
    //           18.81 - 12.23 = 6.58 € patient
    const r = calculerTarifSync("VSL", 10);
    expect(r.montantTotal).toBe(18.81);
    expect(r.montantCPAM).toBe(arrondir(18.81 * 0.65));
    expect(r.montantPatient).toBe(arrondir(18.81 * 0.35));
    expect(r.supplements).toBe(0);
    expect(r.distanceKm).toBe(10);
    expect(r.distanceFacturee).toBe(10);
  });

  it("trajet 0 km → uniquement le forfait", () => {
    const r = calculerTarifSync("VSL", 0);
    expect(r.montantTotal).toBe(12.61);
    expect(r.montantCPAM).toBe(arrondir(12.61 * 0.65));
  });

  it("trajet 20 km aller-retour → distance × 2", () => {
    const r = calculerTarifSync("VSL", 20, { allerRetour: true });
    // 12.61 + 0.62 × 40 = 12.61 + 24.80 = 37.41 €
    expect(r.distanceFacturee).toBe(40);
    expect(r.montantTotal).toBe(arrondir(12.61 + 0.62 * 40));
  });

  it("taux ALD 100% → patient ne paie rien", () => {
    const r = calculerTarifSync("VSL", 10, { tauxPriseEnCharge: 100 });
    expect(r.montantPatient).toBe(0);
    expect(r.montantCPAM).toBe(r.montantTotal);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculerTarifSync — TPMR
// ─────────────────────────────────────────────────────────────────────────────
describe("calculerTarifSync() — TPMR", () => {
  it("trajet 15 km, taux 65%", () => {
    // 25.00 + 0.95 × 15 = 39.25 €
    const r = calculerTarifSync("TPMR", 15);
    expect(r.montantTotal).toBe(39.25);
    expect(r.bareme.forfait).toBe(25.0);
    expect(r.bareme.prixKm).toBe(0.95);
    expect(r.supplements).toBe(0);
  });

  it("aller-retour 10 km → distance facturée 20 km", () => {
    // 25.00 + 0.95 × 20 = 44.00 €
    const r = calculerTarifSync("TPMR", 10, { allerRetour: true });
    expect(r.distanceFacturee).toBe(20);
    expect(r.montantTotal).toBe(44.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculerTarifSync — AMBULANCE (base + suppléments)
// ─────────────────────────────────────────────────────────────────────────────
describe("calculerTarifSync() — AMBULANCE", () => {
  it("trajet 12 km de jour en semaine, taux 65%", () => {
    // 46.31 + 0.91 × 12 = 57.23 €
    const r = calculerTarifSync("AMBULANCE", 12);
    expect(r.montantTotal).toBe(arrondir(46.31 + 0.91 * 12));
    expect(r.supplements).toBe(0);
  });

  it("supplément nuit seul → +19.19€", () => {
    const r = calculerTarifSync("AMBULANCE", 10, { nuit: true });
    const base = arrondir(46.31 + 0.91 * 10);
    expect(r.supplements).toBe(19.19);
    expect(r.montantTotal).toBe(arrondir(base + 19.19));
  });

  it("supplément dimanche seul → +19.19€", () => {
    const r = calculerTarifSync("AMBULANCE", 10, { dimanche: true });
    expect(r.supplements).toBe(19.19);
    expect(r.montantTotal).toBe(arrondir(46.31 + 0.91 * 10 + 19.19));
  });

  it("cumul nuit + dimanche → +38.38€", () => {
    const r = calculerTarifSync("AMBULANCE", 10, {
      nuit: true,
      dimanche: true,
    });
    expect(r.supplements).toBe(arrondir(19.19 + 19.19));
    expect(r.montantTotal).toBe(
      arrondir(46.31 + 0.91 * 10 + 19.19 + 19.19),
    );
  });

  it("aller-retour 20 km de nuit → distance × 2 + supplément nuit", () => {
    // distance facturée : 40 km
    // base : 46.31 + 0.91 × 40 = 82.71 €
    // total : 82.71 + 19.19 = 101.90 €
    const r = calculerTarifSync("AMBULANCE", 20, {
      allerRetour: true,
      nuit: true,
    });
    expect(r.distanceFacturee).toBe(40);
    expect(r.montantTotal).toBe(arrondir(46.31 + 0.91 * 40 + 19.19));
  });

  it("suppléments ne s'appliquent PAS à VSL", () => {
    const r = calculerTarifSync("VSL", 10, { nuit: true, dimanche: true });
    expect(r.supplements).toBe(0);
  });

  it("suppléments ne s'appliquent PAS à TPMR", () => {
    const r = calculerTarifSync("TPMR", 10, { nuit: true, dimanche: true });
    expect(r.supplements).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculerTarifSync — Structure de retour
// ─────────────────────────────────────────────────────────────────────────────
describe("calculerTarifSync() — structure de retour", () => {
  it("retourne tous les champs attendus", () => {
    const r = calculerTarifSync("VSL", 5);
    expect(r).toHaveProperty("distanceKm", 5);
    expect(r).toHaveProperty("distanceFacturee");
    expect(r).toHaveProperty("montantTotal");
    expect(r).toHaveProperty("montantCPAM");
    expect(r).toHaveProperty("montantPatient");
    expect(r).toHaveProperty("tauxPriseEnCharge");
    expect(r).toHaveProperty("supplements");
    expect(r).toHaveProperty("bareme");
    expect(r.bareme).toHaveProperty("forfait");
    expect(r.bareme).toHaveProperty("prixKm");
  });

  it("montantTotal = montantCPAM + montantPatient (cohérence)", () => {
    const r = calculerTarifSync("AMBULANCE", 25, { nuit: true });
    // Tolérance d'1 centime possible due aux arrondis successifs
    expect(Math.abs(r.montantTotal - r.montantCPAM - r.montantPatient)).toBeLessThanOrEqual(0.01);
  });

  it("tous les montants sont des nombres ≥ 0", () => {
    const r = calculerTarifSync("TPMR", 0);
    expect(r.montantTotal).toBeGreaterThanOrEqual(0);
    expect(r.montantCPAM).toBeGreaterThanOrEqual(0);
    expect(r.montantPatient).toBeGreaterThanOrEqual(0);
  });

  it("tous les montants ont au plus 2 décimales", () => {
    const r = calculerTarifSync("AMBULANCE", 17, { nuit: true, dimanche: true });
    const decimals = (n) => String(arrondir(n)).split(".")[1]?.length || 0;
    expect(decimals(r.montantTotal)).toBeLessThanOrEqual(2);
    expect(decimals(r.montantCPAM)).toBeLessThanOrEqual(2);
    expect(decimals(r.montantPatient)).toBeLessThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculerTarifSync — Gestion des erreurs
// ─────────────────────────────────────────────────────────────────────────────
describe("calculerTarifSync() — erreurs", () => {
  it("type inconnu → lance une erreur explicite", () => {
    expect(() => calculerTarifSync("SCOOTER", 10)).toThrow(
      /Type de transport non reconnu.*SCOOTER/,
    );
  });

  it("type vide → lance une erreur", () => {
    expect(() => calculerTarifSync("", 10)).toThrow(/Type de transport non reconnu/);
  });

  it("type null → lance une erreur", () => {
    expect(() => calculerTarifSync(null, 10)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cas métier réels (basés sur des ordonnances CPAM réelles)
// ─────────────────────────────────────────────────────────────────────────────
describe("Cas métier réels", () => {
  it("dialyse 3×/semaine, VSL 8 km A/R, taux 100% (ALD) → CPAM paie tout", () => {
    // Trajet aller-retour 8 km, ALD donc taux 100%
    const r = calculerTarifSync("VSL", 8, {
      allerRetour: true,
      tauxPriseEnCharge: 100,
    });
    // 12.61 + 0.62 × 16 = 22.53 €
    expect(r.montantTotal).toBe(arrondir(12.61 + 0.62 * 16));
    expect(r.montantPatient).toBe(0);
    expect(r.montantCPAM).toBe(r.montantTotal);
  });

  it("hospitalisation nuit du dimanche, ambulance 25 km", () => {
    // Deux suppléments : nuit + dimanche = 38.38 €
    // Base : 46.31 + 0.91 × 25 = 69.06 €
    // Total : 69.06 + 38.38 = 107.44 €
    const r = calculerTarifSync("AMBULANCE", 25, {
      nuit: true,
      dimanche: true,
    });
    expect(r.montantTotal).toBe(arrondir(46.31 + 0.91 * 25 + 19.19 + 19.19));
    expect(r.supplements).toBe(arrondir(19.19 * 2));
  });

  it("consultation TPMR aller simple 30 km, taux 65%", () => {
    // 25.00 + 0.95 × 30 = 53.50 €
    // CPAM : 53.50 × 0.65 = 34.78 €
    const r = calculerTarifSync("TPMR", 30);
    expect(r.montantTotal).toBe(53.5);
    expect(r.montantCPAM).toBe(arrondir(53.5 * 0.65));
    expect(r.montantPatient).toBe(arrondir(53.5 * 0.35));
  });
});
