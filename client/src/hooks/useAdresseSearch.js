/**
 * useAdresseSearch — Hook d'autocomplétion d'adresses françaises
 *
 * Interroge l'API Adresse du gouvernement français (BAN — Base Adresse Nationale).
 * Aucune clé API requise. Données de référence IGN/La Poste.
 * https://api-adresse.data.gouv.fr
 *
 * Fonctionnalités :
 *   - Debounce 300 ms (évite les appels réseau à chaque frappe)
 *   - Annulation automatique des requêtes obsolètes (AbortController)
 *   - Cache mémoire par session (Map, max 100 entrées)
 *   - Fallback silencieux si le service est indisponible
 */

import { useState, useRef, useCallback, useEffect } from "react";

const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";
const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;
const MAX_CACHE_SIZE = 100;

// Cache module-level : partagé entre toutes les instances du hook sur la page,
// persistant pour toute la session utilisateur.
const _cache = new Map();

function _cacheSet(key, value) {
  if (_cache.size >= MAX_CACHE_SIZE) {
    // Éviction LRU simple : supprimer la première entrée insérée
    _cache.delete(_cache.keys().next().value);
  }
  _cache.set(key, value);
}

/**
 * Transforme une feature GeoJSON retournée par l'API BAN en objet adresse.
 * @param {Object} feature - Feature GeoJSON de l'API BAN
 * @returns {{ label, rue, ville, codePostal, lat, lng, score }}
 */
function featureVersAdresse(feature) {
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  return {
    label: p.label, // Ex : "12 Rue de la Paix 06000 Nice"
    rue: p.name, // Ex : "12 Rue de la Paix"
    ville: p.city, // Ex : "Nice"
    codePostal: p.postcode, // Ex : "06000"
    lat,
    lng,
    score: p.score, // 0–1 : confiance de l'API dans ce résultat
  };
}

/**
 * Hook d'autocomplétion d'adresses françaises.
 *
 * @returns {{
 *   suggestions: Array<{ label, rue, ville, codePostal, lat, lng, score }>,
 *   loading: boolean,
 *   error: string | null,
 *   search: (query: string) => void,
 *   reset: () => void
 * }}
 *
 * @example
 * const { suggestions, loading, search, reset } = useAdresseSearch();
 * // Dans un onChange :
 * search(inputValue);
 * // Sur sélection :
 * reset();
 */
export function useAdresseSearch() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  // Nettoyer debounce et abort au démontage du composant
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  /**
   * Lance une recherche d'adresse avec debounce.
   * Si la query est trop courte, vide les suggestions sans appel réseau.
   */
  const search = useCallback((query) => {
    clearTimeout(debounceRef.current);

    if (!query || query.trim().length < MIN_CHARS) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      const trimmed = query.trim();

      // Réponse immédiate si présente dans le cache
      if (_cache.has(trimmed)) {
        setSuggestions(_cache.get(trimmed));
        setLoading(false);
        return;
      }

      // Annuler la requête précédente encore en vol
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const url =
          `${BAN_SEARCH_URL}?q=${encodeURIComponent(trimmed)}&limit=5`;

        const res = await fetch(url, {
          signal: abortRef.current.signal,
          // Pas d'en-tête Authorization requis — API publique
        });

        if (!res.ok) throw new Error(`BAN HTTP ${res.status}`);

        const data = await res.json();
        const results = (data.features || []).map(featureVersAdresse);

        _cacheSet(trimmed, results);
        setSuggestions(results);
        setError(null);
      } catch (err) {
        // AbortError = requête annulée volontairement → silencieux
        if (err.name === "AbortError") return;
        // Toute autre erreur réseau = service indisponible
        setError("Service d'autocomplétion indisponible");
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  /**
   * Remet le hook dans son état initial.
   * À appeler après sélection d'une suggestion ou effacement du champ.
   */
  const reset = useCallback(() => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    setSuggestions([]);
    setLoading(false);
    setError(null);
  }, []);

  return { suggestions, loading, error, search, reset };
}
