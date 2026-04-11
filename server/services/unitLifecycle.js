/**
 * BlancBleu — Hook cycle de vie unité
 *
 * IMPORTANT : Ce fichier n'instancie plus axios directement.
 * Toutes les requêtes passent par le client centralisé api.js
 * qui gère l'injection JWT, le refresh automatique et les 401.
 */
import { unitLifecycleService } from "../services/api";

export default function useUnitLifecycle() {
  const assigner = (unitId, interventionId) =>
    unitLifecycleService.assigner(unitId, interventionId);

  const enRoute = (unitId, interventionId) =>
    unitLifecycleService.enRoute(unitId, interventionId);

  const surPlace = (unitId, interventionId, position) =>
    unitLifecycleService.surPlace(unitId, interventionId, position);

  const transport = (unitId, interventionId, hopital) =>
    unitLifecycleService.transport(unitId, interventionId, hopital);

  const terminer = (unitId, interventionId) =>
    unitLifecycleService.terminer(unitId, interventionId);

  const updateLocation = (unitId, gps) =>
    unitLifecycleService.updateLocation(unitId, gps);

  const updateStatut = (unitId, statut) =>
    unitLifecycleService.updateStatut(unitId, statut);

  return {
    assigner,
    enRoute,
    surPlace,
    transport,
    terminer,
    updateLocation,
    updateStatut,
  };
}
