"""
╔══════════════════════════════════════════════════════════════════╗
║   BlancBleu — Modèle IA de Triage Médical v3.0                  ║
║   Ambulances Blanc Bleu · Nice · PFE Ingénieur                  ║
╠══════════════════════════════════════════════════════════════════╣
║   Dataset  : Emergency Service Triage (Kaggle KTAS)             ║
║   Modèle   : Pipeline sklearn (Preprocessing + GBM)             ║
║   Labels   : P1 (Critique) · P2 (Urgent) · P3 (Standard)       ║
╚══════════════════════════════════════════════════════════════════╝
"""

# ─── Imports ──────────────────────────────────────────────────────────────────
import sys, os, json, warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.pipeline           import Pipeline
from sklearn.compose            import ColumnTransformer
from sklearn.preprocessing      import StandardScaler, LabelEncoder
from sklearn.impute             import SimpleImputer
from sklearn.model_selection    import (train_test_split,
                                        StratifiedKFold,
                                        cross_validate,
                                        RandomizedSearchCV)
from sklearn.linear_model       import LogisticRegression
from sklearn.ensemble           import (RandomForestClassifier,
                                        GradientBoostingClassifier)
from sklearn.metrics            import (accuracy_score,
                                        balanced_accuracy_score,
                                        f1_score,
                                        recall_score,
                                        classification_report,
                                        confusion_matrix)
from sklearn.utils.class_weight import compute_class_weight
import joblib

warnings.filterwarnings('ignore')

# ══════════════════════════════════════════════════════════════════════════════
# 1. CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════
RANDOM_STATE = 42
TEST_SIZE    = 0.20
CV_FOLDS     = 5
TARGET_COL   = 'priorite'
LABEL_ORDER  = ['P1', 'P2', 'P3']

# Features à utiliser — SANS ktas_rn/ktas_expert (data leakage)
FEATURES_NUM = [
    'age',
    'sex',
    'patients_number_per_hour',
    'arrival_mode',
    'injury',
    'mental',
    'pain',
    'nrs_pain',
]
FEATURES_CAT = [
    'chief_complain',
]

CHIEF_MAP = {
    'chest':'douleur_thoracique', 'cardiac':'arret_cardiaque',
    'heart':'arret_cardiaque',    'dyspnea':'detresse_resp',
    'breath':'detresse_resp',     'respiratory':'detresse_resp',
    'stroke':'avc',               'neuro':'avc',
    'seizure':'avc',              'trauma':'traumatisme',
    'injury':'traumatisme',       'accident':'accident_route',
    'fall':'chute',               'burn':'brulure',
    'poison':'intoxication',      'overdose':'intoxication',
    'obstetric':'accouchement',   'abdominal':'malaise',
    'fever':'malaise',            'syncope':'malaise',
    'pain':'douleur',             'dizz':'malaise',
}


# ══════════════════════════════════════════════════════════════════════════════
# 2. CHARGEMENT & VALIDATION DES DONNÉES
# ══════════════════════════════════════════════════════════════════════════════
def charger_et_valider(chemin: str) -> pd.DataFrame:
    """
    Charge le CSV avec détection automatique encodage/séparateur.
    Valide l'intégrité des données et affiche un rapport.
    """
    print("\n" + "═"*60)
    print("  ÉTAPE 1 — CHARGEMENT DES DONNÉES")
    print("═"*60)

    df = None
    for enc in ['utf-8', 'latin-1', 'cp1252']:
        for sep in [',', ';', '\t']:
            try:
                tmp = pd.read_csv(chemin, encoding=enc, sep=sep,
                                  on_bad_lines='skip')
                if len(tmp.columns) > 3:
                    df = tmp
                    print(f"  Fichier    : {chemin}")
                    print(f"  Encodage   : {enc} | Séparateur : '{sep}'")
                    break
            except Exception:
                continue
        if df is not None:
            break

    if df is None:
        raise ValueError(f"Impossible de charger {chemin}")

    # Standardiser les noms de colonnes
    df.columns = [c.strip().replace(' ', '_').lower() for c in df.columns]

    print(f"  Dimensions : {df.shape[0]} lignes × {df.shape[1]} colonnes")
    print(f"  Colonnes   : {list(df.columns)}")

    # Vérifier label
    if TARGET_COL not in df.columns:
        raise ValueError(f"Colonne '{TARGET_COL}' absente. "
                         "Lance d'abord le notebook de nettoyage.")

    print(f"\n  Distribution des labels :")
    counts = df[TARGET_COL].value_counts()
    for label in LABEL_ORDER:
        n = counts.get(label, 0)
        pct = n / len(df) * 100
        bar = '█' * int(pct / 2)
        print(f"    {label} : {bar:<25} {n:>4} ({pct:.1f}%)")

    # Détecter les colonnes problématiques (data leakage)
    leakage_cols = [c for c in df.columns
                    if any(k in c for k in ['ktas', 'disposition',
                                            'ktas_expert', 'ktas_rn'])]
    if leakage_cols:
        print(f"\n  ⚠ Colonnes exclues (data leakage) : {leakage_cols}")

    return df


# ══════════════════════════════════════════════════════════════════════════════
# 3. PREPROCESSING
# ══════════════════════════════════════════════════════════════════════════════
def normaliser_chief(val) -> str:
    """Normalise la plainte principale en catégorie standardisée."""
    if pd.isna(val):
        return 'autre'
    v = str(val).lower()
    for k, cat in CHIEF_MAP.items():
        if k in v:
            return cat
    return 'autre'


def preparer_features(df: pd.DataFrame):
    """
    Prépare X et y en évitant tout data leakage.
    Retourne X (DataFrame), y (Series), noms des features.
    """
    print("\n" + "═"*60)
    print("  ÉTAPE 2 — PRÉPARATION DES FEATURES")
    print("═"*60)

    # Vérifier quelles features sont disponibles
    feats_num_dispo = [f for f in FEATURES_NUM if f in df.columns]
    feats_cat_dispo = [f for f in FEATURES_CAT if f in df.columns]

    print(f"  Features numériques : {feats_num_dispo}")
    print(f"  Features catégorielles : {feats_cat_dispo}")

    # Copier et préparer
    data = df.copy()

    # Normaliser chief_complain
    if 'chief_complain' in data.columns:
        data['chief_complain'] = data['chief_complain'].apply(normaliser_chief)

    # Construire X
    all_features = feats_num_dispo + feats_cat_dispo
    X = data[all_features].copy()
    y = data[TARGET_COL].copy()

    # Valeurs manquantes dans X
    null_counts = X.isnull().sum()
    if null_counts.any():
        print(f"\n  Valeurs manquantes détectées :")
        print(null_counts[null_counts > 0])

    print(f"\n  Total features : {len(all_features)}")
    print(f"  Total exemples : {len(X)}")

    return X, y, feats_num_dispo, feats_cat_dispo


# ══════════════════════════════════════════════════════════════════════════════
# 4. CONSTRUCTION DES PIPELINES ML
# ══════════════════════════════════════════════════════════════════════════════
def construire_pipelines(feats_num, feats_cat, class_weights):
    """
    Construit 3 pipelines complets avec preprocessing intégré.
    Évite toute fuite de données (fit uniquement sur train).
    """

    # Preprocessing numérique : imputation + scaling
    num_pipe = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler',  StandardScaler()),
    ])

    # Preprocessing catégoriel : imputation + ordinal encoding
    from sklearn.preprocessing import OrdinalEncoder
    cat_pipe = Pipeline([
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('encoder', OrdinalEncoder(handle_unknown='use_encoded_value',
                                   unknown_value=-1)),
    ])

    # Combiner preprocessing
    preprocessor = ColumnTransformer([
        ('num', num_pipe, feats_num),
        ('cat', cat_pipe, feats_cat),
    ], remainder='drop')

    # Poids de classes (pour gérer le déséquilibre)
    cw = {k: v for k, v in zip(LABEL_ORDER, class_weights)}

    # 3 modèles
    modeles = {
        'Logistic Regression': Pipeline([
            ('prep', preprocessor),
            ('clf',  LogisticRegression(
                max_iter=500,
                class_weight=cw,
                random_state=RANDOM_STATE,
                C=1.0,
            )),
        ]),

        'Random Forest': Pipeline([
            ('prep', preprocessor),
            ('clf',  RandomForestClassifier(
                n_estimators=200,
                max_depth=8,
                class_weight=cw,
                random_state=RANDOM_STATE,
            )),
        ]),

        'Gradient Boosting': Pipeline([
            ('prep', preprocessor),
            ('clf',  GradientBoostingClassifier(
                n_estimators=200,
                max_depth=4,
                learning_rate=0.1,
                subsample=0.8,
                random_state=RANDOM_STATE,
            )),
        ]),
    }

    return modeles


# ══════════════════════════════════════════════════════════════════════════════
# 5. ENTRAÎNEMENT ET ÉVALUATION
# ══════════════════════════════════════════════════════════════════════════════
def evaluer_modele(nom, pipeline, X_tr, y_tr, X_te, y_te):
    """Entraîne et évalue un modèle. Retourne les métriques."""

    pipeline.fit(X_tr, y_tr)
    y_pred = pipeline.predict(X_te)

    acc      = accuracy_score(y_te, y_pred)
    bal_acc  = balanced_accuracy_score(y_te, y_pred)
    f1_macro = f1_score(y_te, y_pred, average='macro')
    recall_p1 = recall_score(y_te, y_pred, labels=['P1'],
                             average='macro', zero_division=0)

    # Cross-validation stratifiée
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True,
                         random_state=RANDOM_STATE)
    cv_res = cross_validate(pipeline, X_tr, y_tr, cv=cv,
                            scoring='balanced_accuracy',
                            return_train_score=True)
    cv_mean = cv_res['test_score'].mean()
    cv_std  = cv_res['test_score'].std()

    return {
        'nom':         nom,
        'pipeline':    pipeline,
        'y_pred':      y_pred,
        'accuracy':    acc,
        'bal_accuracy':bal_acc,
        'f1_macro':    f1_macro,
        'recall_p1':   recall_p1,
        'cv_mean':     cv_mean,
        'cv_std':      cv_std,
    }


def comparer_modeles(resultats):
    """Affiche le tableau de comparaison des modèles."""
    print("\n" + "═"*60)
    print("  ÉTAPE 4 — COMPARAISON DES MODÈLES")
    print("═"*60)

    headers = ['Modèle', 'Accuracy', 'Bal.Acc', 'F1-macro',
               'Recall P1', 'CV (mean±std)']
    row_fmt = "  {:<22} {:>8} {:>8} {:>8} {:>9} {:>14}"

    print(row_fmt.format(*headers))
    print("  " + "-"*58)

    best = None
    for r in resultats:
        cv_str = f"{r['cv_mean']*100:.1f}±{r['cv_std']*100:.1f}%"
        print(row_fmt.format(
            r['nom'],
            f"{r['accuracy']*100:.1f}%",
            f"{r['bal_accuracy']*100:.1f}%",
            f"{r['f1_macro']*100:.1f}%",
            f"{r['recall_p1']*100:.1f}%",
            cv_str,
        ))
        if best is None or r['bal_accuracy'] > best['bal_accuracy']:
            best = r

    print("  " + "-"*58)
    print(f"\n  ★ Meilleur modèle : {best['nom']}")
    print(f"    Balanced Accuracy : {best['bal_accuracy']*100:.1f}%")
    print(f"    Recall P1         : {best['recall_p1']*100:.1f}%")
    return best


# ══════════════════════════════════════════════════════════════════════════════
# 6. RAPPORT DÉTAILLÉ DU MEILLEUR MODÈLE
# ══════════════════════════════════════════════════════════════════════════════
def rapport_detaille(best, X_te, y_te):
    """Affiche le rapport complet du meilleur modèle."""
    print("\n" + "═"*60)
    print(f"  ÉTAPE 5 — RAPPORT : {best['nom']}")
    print("═"*60)

    print(classification_report(
        y_te, best['y_pred'],
        target_names=LABEL_ORDER,
        digits=3,
    ))

    cm = confusion_matrix(y_te, best['y_pred'], labels=LABEL_ORDER)
    print("  Matrice de confusion :")
    cm_df = pd.DataFrame(cm,
        index=[f'Réel {l}' for l in LABEL_ORDER],
        columns=[f'Préd {l}' for l in LABEL_ORDER])
    print(cm_df.to_string())

    # Analyse des erreurs P1
    print(f"\n  Analyse des erreurs P1 :")
    idx_p1  = y_te == 'P1'
    pred_p1 = best['y_pred'][idx_p1.values]
    n_p1    = idx_p1.sum()
    n_ok    = (pred_p1 == 'P1').sum()
    n_miss  = (pred_p1 == 'P2').sum()
    n_miss3 = (pred_p1 == 'P3').sum()
    print(f"    Total P1 réels  : {n_p1}")
    print(f"    Bien classés    : {n_ok}  ({n_ok/n_p1*100:.1f}%)")
    print(f"    Classés P2      : {n_miss}  ({n_miss/n_p1*100:.1f}%) ← sous-triage")
    print(f"    Classés P3      : {n_miss3}  ({n_miss3/n_p1*100:.1f}%) ← sous-triage grave")


# ══════════════════════════════════════════════════════════════════════════════
# 7. IMPORTANCE DES FEATURES
# ══════════════════════════════════════════════════════════════════════════════
def importance_features(best, feats_num, feats_cat):
    """Affiche l'importance des features pour les modèles basés arbres."""
    print("\n" + "═"*60)
    print("  ÉTAPE 6 — IMPORTANCE DES FEATURES")
    print("═"*60)

    clf = best['pipeline'].named_steps['clf']
    all_feats = feats_num + feats_cat

    if hasattr(clf, 'feature_importances_'):
        importances = clf.feature_importances_
        feat_imp = sorted(zip(all_feats, importances),
                          key=lambda x: x[1], reverse=True)
        print(f"\n  {'Feature':<30} {'Importance':>10}  Bar")
        print("  " + "-"*55)
        for feat, imp in feat_imp:
            bar = '█' * int(imp * 50)
            print(f"  {feat:<30} {imp:>10.3f}  {bar}")
    else:
        print("  (Logistic Regression — voir coefficients)")
        coefs = np.abs(clf.coef_).mean(axis=0)
        feat_imp = sorted(zip(all_feats, coefs),
                          key=lambda x: x[1], reverse=True)
        for feat, coef in feat_imp[:8]:
            bar = '█' * int(coef * 5)
            print(f"  {feat:<30} {coef:>10.3f}  {bar}")

    return feat_imp


# ══════════════════════════════════════════════════════════════════════════════
# 8. VISUALISATIONS
# ══════════════════════════════════════════════════════════════════════════════
def generer_graphiques(best, feat_imp, y_te):
    """Génère et sauvegarde les graphiques d'évaluation."""
    os.makedirs('model', exist_ok=True)

    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    fig.suptitle(f'BlancBleu — {best["nom"]}', fontsize=14, fontweight='bold')

    # 1. Matrice de confusion
    cm = confusion_matrix(y_te, best['y_pred'], labels=LABEL_ORDER)
    sns.heatmap(cm, annot=True, fmt='d', ax=axes[0],
                cmap='Blues', linewidths=0.5,
                xticklabels=LABEL_ORDER, yticklabels=LABEL_ORDER)
    axes[0].set_title('Matrice de confusion')
    axes[0].set_ylabel('Réel')
    axes[0].set_xlabel('Prédit')

    # 2. Importance des features
    if feat_imp:
        names = [f[0] for f in feat_imp[:8]]
        values = [f[1] for f in feat_imp[:8]]
        colors_bar = ['#ef4444' if v == max(values) else '#1D6EF5' for v in values]
        axes[1].barh(names[::-1], values[::-1], color=colors_bar[::-1])
        axes[1].set_title("Importance des features")
        axes[1].set_xlabel("Importance")

    # 3. Métriques par classe
    report = classification_report(y_te, best['y_pred'],
                                   target_names=LABEL_ORDER,
                                   output_dict=True)
    metrics = ['precision', 'recall', 'f1-score']
    x = np.arange(len(LABEL_ORDER))
    width = 0.25
    colors_m = ['#1D6EF5', '#f59e0b', '#10b981']
    for i, metric in enumerate(metrics):
        vals = [report[label][metric] for label in LABEL_ORDER]
        axes[2].bar(x + i*width, vals, width, label=metric,
                    color=colors_m[i], alpha=0.85)
    axes[2].set_xticks(x + width)
    axes[2].set_xticklabels(LABEL_ORDER)
    axes[2].set_title('Métriques par classe')
    axes[2].set_ylim(0, 1.1)
    axes[2].legend()
    axes[2].axhline(y=0.7, color='red', linestyle='--',
                    alpha=0.5, label='Seuil 70%')

    plt.tight_layout()
    path = 'model/evaluation.png'
    plt.savefig(path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"\n  Graphiques sauvegardés : {path}")


# ══════════════════════════════════════════════════════════════════════════════
# 9. SAUVEGARDE DU MODÈLE
# ══════════════════════════════════════════════════════════════════════════════
def sauvegarder(best, feat_imp, feats_num, feats_cat, resultats):
    """Sauvegarde le pipeline + métadonnées complètes."""
    os.makedirs('model', exist_ok=True)

    joblib.dump(best['pipeline'], 'model/triage_model.pkl')

    meta = {
        'modele':           best['nom'],
        'version':          '3.0.0',
        'accuracy':         round(best['accuracy'] * 100, 2),
        'balanced_accuracy':round(best['bal_accuracy'] * 100, 2),
        'f1_macro':         round(best['f1_macro'] * 100, 2),
        'recall_p1':        round(best['recall_p1'] * 100, 2),
        'cv_mean':          round(best['cv_mean'] * 100, 2),
        'cv_std':           round(best['cv_std'] * 100, 2),
        'features_num':     feats_num,
        'features_cat':     feats_cat,
        'classes':          LABEL_ORDER,
        'chief_map':        CHIEF_MAP,
        'comparaison': [
            {
                'nom':          r['nom'],
                'accuracy':     round(r['accuracy'] * 100, 2),
                'bal_accuracy': round(r['bal_accuracy'] * 100, 2),
                'f1_macro':     round(r['f1_macro'] * 100, 2),
                'recall_p1':    round(r['recall_p1'] * 100, 2),
            }
            for r in resultats
        ],
        'top_features': [
            {'name': f[0], 'importance': round(float(f[1]), 4)}
            for f in (feat_imp[:8] if feat_imp else [])
        ],
    }

    with open('model/metadata.json', 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"\n  Modèle    → model/triage_model.pkl")
    print(f"  Métadata  → model/metadata.json")
    print(f"  Graphique → model/evaluation.png")


# ══════════════════════════════════════════════════════════════════════════════
# 10. RECOMMANDATIONS
# ══════════════════════════════════════════════════════════════════════════════
def recommandations(best):
    recall_p1 = best['recall_p1'] * 100
    bal_acc   = best['bal_accuracy'] * 100

    print("\n" + "═"*60)
    print("  RECOMMANDATIONS")
    print("═"*60)

    if recall_p1 < 60:
        print("  ⚠ Recall P1 faible → risque de sous-triage critique")
        print("    → Envisager SMOTE ou threshold adjustment")
    else:
        print(f"  ✓ Recall P1 acceptable : {recall_p1:.1f}%")

    if bal_acc < 55:
        print("  ⚠ Balanced accuracy faible → dataset déséquilibré")
        print("    → Augmenter les données P1 ou utiliser SMOTE")
    else:
        print(f"  ✓ Balanced accuracy : {bal_acc:.1f}%")

    print(f"\n  Pour améliorer davantage :")
    print(f"    1. Augmenter le dataset (>5000 exemples)")
    print(f"    2. Ajouter signes vitaux (FC, SpO2, TA)")
    print(f"    3. SMOTE pour équilibrer les classes P1")
    print(f"    4. Threshold tuning pour maximiser recall P1")
    print(f"    5. Validation sur données Nice (domaine spécifique)")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main(chemin_csv: str):
    print("\n" + "╔" + "═"*58 + "╗")
    print("║  BlancBleu — Modèle IA Triage Médical v3.0              ║")
    print("║  PFE Ingénieur · Ambulances Blanc Bleu · Nice           ║")
    print("╚" + "═"*58 + "╝")

    # 1. Charger et valider
    df = charger_et_valider(chemin_csv)

    # 2. Préparer features
    X, y, feats_num, feats_cat = preparer_features(df)

    # 3. Split stratifié
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y,
    )
    print(f"\n  Split : Train={len(X_tr)} | Test={len(X_te)}")

    # 4. Calculer poids de classes
    classes = np.array(LABEL_ORDER)
    weights = compute_class_weight(
        class_weight='balanced',
        classes=classes,
        y=y_tr,
    )
    print(f"\n  Poids de classes (équilibrage) :")
    for c, w in zip(classes, weights):
        print(f"    {c} : {w:.3f}")

    # 5. Construire et entraîner les 3 modèles
    print("\n" + "═"*60)
    print("  ÉTAPE 3 — ENTRAÎNEMENT (3 modèles)")
    print("═"*60)

    pipelines  = construire_pipelines(feats_num, feats_cat, weights)
    resultats  = []

    for nom, pipe in pipelines.items():
        print(f"\n  [{nom}]...")
        r = evaluer_modele(nom, pipe, X_tr, y_tr, X_te, y_te)
        resultats.append(r)
        print(f"    Accuracy        : {r['accuracy']*100:.1f}%")
        print(f"    Balanced Acc    : {r['bal_accuracy']*100:.1f}%")
        print(f"    F1 macro        : {r['f1_macro']*100:.1f}%")
        print(f"    Recall P1       : {r['recall_p1']*100:.1f}%")
        print(f"    CV Bal.Acc      : {r['cv_mean']*100:.1f}% ± {r['cv_std']*100:.1f}%")

    # 6. Comparer et choisir le meilleur
    best = comparer_modeles(resultats)

    # 7. Rapport détaillé
    rapport_detaille(best, X_te, y_te)

    # 8. Importance des features
    feat_imp = importance_features(best, feats_num, feats_cat)

    # 9. Graphiques
    generer_graphiques(best, feat_imp, y_te)

    # 10. Sauvegarder
    print("\n" + "═"*60)
    print("  ÉTAPE 7 — SAUVEGARDE")
    print("═"*60)
    sauvegarder(best, feat_imp, feats_num, feats_cat, resultats)

    # 11. Recommandations
    recommandations(best)

    print("\n" + "╔" + "═"*58 + "╗")
    print("║  Terminé ! Lance maintenant : python app.py             ║")
    print("╚" + "═"*58 + "╝\n")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage : python train_model.py data_clean.csv")
        sys.exit(1)
    main(sys.argv[1])