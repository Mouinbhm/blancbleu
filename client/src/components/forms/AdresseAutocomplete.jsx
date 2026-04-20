/**
 * AdresseAutocomplete — Champ d'adresse avec autocomplétion BAN
 *
 * Intègre useAdresseSearch pour proposer des suggestions depuis l'API
 * gouvernementale data.gouv.fr. Accessible au clavier (ARIA combobox pattern).
 *
 * Props :
 *   label         {string}   — Intitulé du champ (affiché au-dessus)
 *   required      {boolean}  — Affiche un astérisque rouge
 *   error         {string}   — Message d'erreur à afficher sous le champ
 *   value         {Object}   — { rue, ville, codePostal, lat, lng }
 *   onChange      {Function} — Appelée avec le même objet à chaque changement
 *   placeholder   {string}   — Placeholder du champ texte
 *   id            {string}   — id HTML (pour aria-controls)
 *
 * Comportement :
 *   - Frappe → debounce 300ms → suggestions BAN
 *   - Clic ou ↵ sur suggestion → remplit rue / ville / CP / GPS
 *   - Indicateur vert "GPS détecté" quand lat/lng sont connus
 *   - Saisie manuelle toujours possible (hors ligne, adresse inconnue de BAN)
 *   - Escape / blur → ferme le dropdown
 *   - ↑ ↓ → navigation clavier dans la liste
 */

import { useState, useRef, useId, useCallback, useEffect } from "react";
import { useAdresseSearch } from "../../hooks/useAdresseSearch";

// Styles partagés avec NouveauTransport pour la cohérence visuelle
const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-white transition-colors";

export default function AdresseAutocomplete({
  label,
  required = false,
  error,
  value = {},
  onChange,
  placeholder = "Saisir une adresse…",
  id: idProp,
}) {
  const uid = useId();
  const inputId = idProp || `adresse-${uid}`;
  const listboxId = `${inputId}-listbox`;

  // Texte affiché dans le champ de saisie
  const [inputValue, setInputValue] = useState(value.rue || "");
  // Index de la suggestion active pour la navigation clavier (−1 = aucune)
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const ignoreBlurRef = useRef(false); // évite la fermeture prématurée au clic

  const { suggestions, loading, error: searchError, search, reset } =
    useAdresseSearch();

  const hasGps = Boolean(value.lat && value.lng);
  const showDropdown = open && (suggestions.length > 0 || loading || searchError);

  // Synchroniser le champ texte si la valeur externe change (ex: reset form)
  useEffect(() => {
    setInputValue(value.rue || "");
  }, [value.rue]);

  // ── Gestion de la saisie ─────────────────────────────────────────────────────
  const handleChange = useCallback(
    (e) => {
      const q = e.target.value;
      setInputValue(q);
      setActiveIndex(-1);
      setOpen(true);

      // Recherche BAN
      search(q);

      // Effacer les coordonnées GPS si l'utilisateur retape manuellement
      onChange?.({
        ...value,
        rue: q,
        lat: null,
        lng: null,
      });
    },
    [search, onChange, value],
  );

  // ── Sélection d'une suggestion ───────────────────────────────────────────────
  const selectSuggestion = useCallback(
    (suggestion) => {
      setInputValue(suggestion.rue);
      setOpen(false);
      setActiveIndex(-1);
      reset();

      onChange?.({
        rue: suggestion.rue,
        ville: suggestion.ville,
        codePostal: suggestion.codePostal,
        lat: suggestion.lat,
        lng: suggestion.lng,
      });
    },
    [reset, onChange],
  );

  // ── Navigation clavier ───────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (!showDropdown) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
          break;

        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;

        case "Enter":
          if (activeIndex >= 0 && suggestions[activeIndex]) {
            e.preventDefault();
            selectSuggestion(suggestions[activeIndex]);
          }
          break;

        case "Escape":
          setOpen(false);
          setActiveIndex(-1);
          inputRef.current?.focus();
          break;

        default:
          break;
      }
    },
    [showDropdown, suggestions, activeIndex, selectSuggestion],
  );

  // Scroll automatique vers l'option active
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const option = listRef.current.children[activeIndex];
    option?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // ── Blur (fermeture différée pour laisser le clic se traiter) ───────────────
  const handleBlur = () => {
    if (ignoreBlurRef.current) return;
    setTimeout(() => setOpen(false), 150);
  };

  const handleFocus = () => {
    if (inputValue.length >= 3 && suggestions.length > 0) {
      setOpen(true);
    }
  };

  return (
    <div className="relative">
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Wrapper input + icônes */}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-label={label || placeholder}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          role="combobox"
          className={`${inputCls} pr-16 ${error ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
        />

        {/* Icônes à droite du champ */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {/* Spinner pendant la recherche */}
          {loading && (
            <div
              aria-hidden="true"
              style={{
                width: 13,
                height: 13,
                border: "2px solid #e2e8f0",
                borderTop: "2px solid #1D6EF5",
                borderRadius: "50%",
                animation: "spin .7s linear infinite",
                flexShrink: 0,
              }}
            />
          )}

          {/* Badge GPS détecté */}
          {hasGps && !loading && (
            <span
              aria-label="Coordonnées GPS détectées"
              title="Coordonnées GPS détectées"
              className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full leading-none"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 10 }}
              >
                my_location
              </span>
              GPS
            </span>
          )}

          {/* Icône loupe (inactive) */}
          {!hasGps && !loading && (
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-slate-300"
              style={{ fontSize: 16 }}
            >
              search
            </span>
          )}
        </div>
      </div>

      {/* Message d'erreur de validation */}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {/* Dropdown des suggestions */}
      {showDropdown && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={`Suggestions pour ${label || "l'adresse"}`}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
          onMouseDown={() => {
            // Empêcher le blur de fermer le dropdown avant le clic
            ignoreBlurRef.current = true;
            setTimeout(() => {
              ignoreBlurRef.current = false;
            }, 200);
          }}
        >
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-slate-400 flex items-center gap-2">
              <div
                style={{
                  width: 12,
                  height: 12,
                  border: "2px solid #e2e8f0",
                  borderTop: "2px solid #1D6EF5",
                  borderRadius: "50%",
                  animation: "spin .7s linear infinite",
                  flexShrink: 0,
                }}
              />
              Recherche en cours…
            </li>
          )}

          {searchError && (
            <li className="px-3 py-2.5 text-sm text-slate-400 flex items-center gap-2">
              <span
                className="material-symbols-outlined text-slate-300"
                style={{ fontSize: 14 }}
              >
                wifi_off
              </span>
              {searchError} — saisie manuelle possible
            </li>
          )}

          {suggestions.map((s, i) => {
            const isActive = i === activeIndex;
            return (
              <li
                key={`${s.lat}-${s.lng}`}
                id={`${listboxId}-option-${i}`}
                role="option"
                aria-selected={isActive}
                onClick={() => selectSuggestion(s)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`px-3 py-2.5 cursor-pointer flex items-start gap-2 transition-colors ${
                  isActive ? "bg-primary/5" : "hover:bg-slate-50"
                }`}
              >
                {/* Icône pin */}
                <span
                  aria-hidden="true"
                  className={`material-symbols-outlined mt-0.5 flex-shrink-0 ${
                    isActive ? "text-primary" : "text-slate-300"
                  }`}
                  style={{ fontSize: 15 }}
                >
                  location_on
                </span>

                {/* Texte de la suggestion */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy truncate">
                    {s.rue}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {s.codePostal} {s.ville}
                  </p>
                </div>

                {/* Score de confiance (debug désactivé en prod) */}
                {process.env.NODE_ENV === "development" && (
                  <span className="ml-auto text-[10px] text-slate-300 font-mono flex-shrink-0">
                    {Math.round(s.score * 100)}%
                  </span>
                )}
              </li>
            );
          })}

          {/* Mention légale BAN (optionnelle mais recommandée) */}
          {suggestions.length > 0 && (
            <li
              aria-hidden="true"
              className="px-3 py-1.5 border-t border-slate-100 flex items-center gap-1 text-[10px] text-slate-300"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 10 }}
              >
                public
              </span>
              Données : Base Adresse Nationale — data.gouv.fr
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
