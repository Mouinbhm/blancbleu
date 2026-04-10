/**
 * BlancBleu — Hook useMissionCompletion
 * Gère la détection semi-auto de fin de mission côté React
 *
 * Usage dans InterventionCard ou page détail :
 *   const { candidate, confirmer, evaluer } = useMissionCompletion(interventionId);
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { interventionService } from "../services/api";
import useSocket from "./useSocket";

export default function useMissionCompletion(interventionId) {
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { subscribe } = useSocket();

  // Écouter les événements Socket.IO
  useEffect(() => {
    if (!interventionId) return;

    const u1 = subscribe("mission_completion_suggested", (data) => {
      if (data.interventionId?.toString() === interventionId?.toString()) {
        setCandidate(true);
        setEvaluation(data);
      }
    });

    const u2 = subscribe("mission_completed", (data) => {
      if (data.interventionId?.toString() === interventionId?.toString()) {
        setConfirmed(true);
        setCandidate(false);
      }
    });

    return () => {
      u1();
      u2();
    };
  }, [interventionId, subscribe]);

  // Évaluer manuellement
  const evaluer = useCallback(async () => {
    if (!interventionId) return;
    setLoading(true);
    try {
      const { data } =
        await interventionService.evaluateCompletion(interventionId);
      setEvaluation(data);
      if (data.eligible && data.decision?.niveau >= 1) setCandidate(true);
      return data;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [interventionId]);

  // Confirmer manuellement
  const confirmer = useCallback(async () => {
    if (!interventionId) return;
    setLoading(true);
    try {
      await interventionService.confirmCompletion(interventionId);
      setConfirmed(true);
      setCandidate(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [interventionId]);

  // Marquer destination atteinte
  const marquerDestination = useCallback(
    async (coords = null) => {
      if (!interventionId) return;
      try {
        await interventionService.markDestinationReached(
          interventionId,
          coords,
        );
      } catch (e) {
        console.error(e);
      }
    },
    [interventionId],
  );

  return {
    candidate,
    evaluation,
    loading,
    confirmed,
    evaluer,
    confirmer,
    marquerDestination,
  };
}
