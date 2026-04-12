/**
 * BlancBleu — Tests GeoUtils
 *
 * Couverture :
 *   - haversine (distances connues)
 *   - calculerETA par priorité
 *   - facteurs heure de pointe
 *   - calculerConsommation
 *   - distanceMissionComplete
 *   - trierParProximite
 */

const {
  haversine,
  calculerETA,
  calculerConsommation,
  distanceMissionComplete,
  trierParProximite,
  estDansZoneNice,
} = require("../../utils/geoUtils");

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — haversine
// ══════════════════════════════════════════════════════════════════════════════
describe("haversine", () => {
  test("distance Paris → Lyon ≈ 392 km (±10 km)", () => {
    const dist = haversine(48.8566, 2.3522, 45.764, 4.8357);
    expect(dist).toBeGreaterThan(382);
    expect(dist).toBeLessThan(402);
  });

  test("distance entre deux points identiques = 0", () => {
    const dist = haversine(43.71, 7.26, 43.71, 7.26);
    expect(dist).toBe(0);
  });

  test("distance Pasteur → Masséna Nice ≈ 1-2 km", () => {
    // Hôpital Pasteur → Place Masséna
    const dist = haversine(43.72, 7.245, 43.703, 7.278);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(5);
  });

  test("retourne une valeur arrondie à 2 décimales", () => {
    const dist = haversine(43.71, 7.26, 43.72, 7.27);
    expect(dist).toBe(Math.round(dist * 100) / 100);
  });

  test("est symétrique (A→B = B→A)", () => {
    const d1 = haversine(43.71, 7.26, 43.8, 7.3);
    const d2 = haversine(43.8, 7.3, 43.71, 7.26);
    expect(d1).toBeCloseTo(d2, 1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — calculerETA
// ══════════════════════════════════════════════════════════════════════════════
describe("calculerETA", () => {
  test("P1 est plus rapide que P2 pour la même distance", () => {
    const etaP1 = calculerETA(5, "P1");
    const etaP2 = calculerETA(5, "P2");
    expect(etaP1.minutes).toBeLessThan(etaP2.minutes);
  });

  test("P2 est plus rapide que P3 pour la même distance", () => {
    const etaP2 = calculerETA(5, "P2");
    const etaP3 = calculerETA(5, "P3");
    expect(etaP2.minutes).toBeLessThan(etaP3.minutes);
  });

  test("retourne minutes, formate, fourchette, distanceKm", () => {
    const eta = calculerETA(3, "P2");
    expect(eta).toHaveProperty("minutes");
    expect(eta).toHaveProperty("formate");
    expect(eta).toHaveProperty("fourchette");
    expect(eta).toHaveProperty("distanceKm", 3);
  });

  test("minutes est un entier positif", () => {
    const eta = calculerETA(2, "P1");
    expect(eta.minutes).toBeGreaterThan(0);
    expect(Number.isInteger(eta.minutes)).toBe(true);
  });

  test("formate en heures si > 60 min", () => {
    const eta = calculerETA(100, "P3");
    expect(eta.formate).toMatch(/h/);
  });

  test("formate en minutes si < 60 min", () => {
    const eta = calculerETA(1, "P1");
    expect(eta.formate).toMatch(/min/);
  });

  test("utilise P2 par défaut si priorité inconnue", () => {
    const etaInconnu = calculerETA(5, "INCONNU");
    const etaP2 = calculerETA(5, "P2");
    expect(etaInconnu.minutes).toBe(etaP2.minutes);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — calculerConsommation
// ══════════════════════════════════════════════════════════════════════════════
describe("calculerConsommation", () => {
  test("consommation > 0 pour distance > 0", () => {
    const conso = calculerConsommation(10, {
      consommationL100: 12,
      capaciteReservoir: 80,
    });
    expect(conso).toBeGreaterThan(0);
  });

  test("consommation = 0 pour distance = 0", () => {
    const conso = calculerConsommation(0, {
      consommationL100: 12,
      capaciteReservoir: 80,
    });
    expect(conso).toBe(0);
  });

  test("utilise valeurs par défaut si specs absentes", () => {
    const conso = calculerConsommation(10);
    expect(conso).toBeGreaterThan(0);
  });

  test("consommation proportionnelle à la distance", () => {
    const specs = { consommationL100: 12, capaciteReservoir: 80 };
    const conso10 = calculerConsommation(10, specs);
    const conso20 = calculerConsommation(20, specs);
    expect(conso20).toBeCloseTo(conso10 * 2, 1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 4 — distanceMissionComplete
// ══════════════════════════════════════════════════════════════════════════════
describe("distanceMissionComplete", () => {
  const base = { lat: 43.7102, lng: 7.262 };
  const incident = { lat: 43.72, lng: 7.27 };
  const hopital = { lat: 43.7, lng: 7.28 };

  test("retourne baseVersIncident, incidentVersHopital, hopitalVersBase, total", () => {
    const result = distanceMissionComplete(base, incident, hopital);
    expect(result).toHaveProperty("baseVersIncident");
    expect(result).toHaveProperty("incidentVersHopital");
    expect(result).toHaveProperty("hopitalVersBase");
    expect(result).toHaveProperty("total");
  });

  test("total = somme des 3 segments", () => {
    const result = distanceMissionComplete(base, incident, hopital);
    const sommeParts =
      result.baseVersIncident +
      result.incidentVersHopital +
      result.hopitalVersBase;
    expect(result.total).toBeCloseTo(sommeParts, 1);
  });

  test("fonctionne sans hôpital (retour direct base)", () => {
    const result = distanceMissionComplete(base, incident, null);
    expect(result.incidentVersHopital).toBe(0);
    expect(result.total).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 5 — trierParProximite
// ══════════════════════════════════════════════════════════════════════════════
describe("trierParProximite", () => {
  const unites = [
    {
      _id: "1",
      nom: "VSAV-Loin",
      position: { lat: 43.8, lng: 7.35 },
      toObject: function () {
        return this;
      },
    },
    {
      _id: "2",
      nom: "VSAV-Pres",
      position: { lat: 43.715, lng: 7.265 },
      toObject: function () {
        return this;
      },
    },
    {
      _id: "3",
      nom: "VSAV-Moyen",
      position: { lat: 43.75, lng: 7.29 },
      toObject: function () {
        return this;
      },
    },
  ];

  test("trie par distance croissante", () => {
    const result = trierParProximite(unites, 43.71, 7.26, "P2");
    expect(result[0].nom).toBe("VSAV-Pres");
    expect(result[result.length - 1].nom).toBe("VSAV-Loin");
  });

  test("ajoute geo.distanceKm et geo.etaMinutes à chaque unité", () => {
    const result = trierParProximite(unites, 43.71, 7.26, "P2");
    result.forEach((u) => {
      expect(u.geo).toHaveProperty("distanceKm");
      expect(u.geo).toHaveProperty("etaMinutes");
      expect(u.geo).toHaveProperty("etaFormate");
    });
  });

  test("ignore les unités sans position GPS", () => {
    const avecSansPosition = [
      ...unites,
      {
        _id: "4",
        nom: "VSAV-NoGPS",
        position: null,
        toObject: function () {
          return this;
        },
      },
    ];
    const result = trierParProximite(avecSansPosition, 43.71, 7.26, "P2");
    const noms = result.map((u) => u.nom);
    expect(noms).not.toContain("VSAV-NoGPS");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 6 — estDansZoneNice
// ══════════════════════════════════════════════════════════════════════════════
describe("estDansZoneNice", () => {
  test("centre de Nice est dans la zone", () => {
    expect(estDansZoneNice(43.71, 7.26)).toBe(true);
  });

  test("Paris est hors zone", () => {
    expect(estDansZoneNice(48.85, 2.35)).toBe(false);
  });

  test("bord de zone est géré correctement", () => {
    expect(estDansZoneNice(43.6, 7.15)).toBe(true);
    expect(estDansZoneNice(43.59, 7.14)).toBe(false);
  });
});
