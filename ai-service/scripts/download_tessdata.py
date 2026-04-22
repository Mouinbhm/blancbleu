"""
BlancBleu — Téléchargement automatique des fichiers de langue Tesseract

Usage :
    python scripts/download_tessdata.py

Télécharge fra.traineddata et eng.traineddata dans le dossier tessdata
de Tesseract installé sur ce poste Windows.
"""

import os
import sys
import subprocess
from pathlib import Path
from urllib.request import urlretrieve, Request, urlopen
from urllib.error import URLError, HTTPError

# ── Fichiers à télécharger ─────────────────────────────────────────────────────

TESSDATA_BASE_URL = "https://github.com/tesseract-ocr/tessdata/raw/main"

LANGUES = [
    {
        "code": "fra",
        "fichier": "fra.traineddata",
        "description": "Français (obligatoire pour PMT)",
        "obligatoire": True,
    },
    {
        "code": "eng",
        "fichier": "eng.traineddata",
        "description": "Anglais (optionnel, améliore la robustesse)",
        "obligatoire": False,
    },
]

# ── Chemins Tesseract connus sur Windows ──────────────────────────────────────

CHEMINS_TESSERACT_WINDOWS = [
    Path(r"C:\Program Files\Tesseract-OCR"),
    Path(r"C:\Program Files (x86)\Tesseract-OCR"),
    Path(r"C:\Tesseract-OCR"),
]


def trouver_tesseract() -> Path | None:
    """Localise le dossier d'installation de Tesseract."""
    # 1. Chemins connus
    for chemin in CHEMINS_TESSERACT_WINDOWS:
        if (chemin / "tesseract.exe").exists():
            return chemin

    # 2. Résultat de "where tesseract" (si tesseract est dans le PATH)
    try:
        result = subprocess.run(
            ["where", "tesseract"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            exe = Path(result.stdout.strip().splitlines()[0])
            return exe.parent
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # 3. Variable d'environnement TESSDATA_PREFIX → remonter d'un niveau
    tessdata_prefix = os.environ.get("TESSDATA_PREFIX")
    if tessdata_prefix:
        p = Path(tessdata_prefix)
        parent = p.parent if p.name == "tessdata" else p
        if (parent / "tesseract.exe").exists():
            return parent

    return None


def trouver_dossier_tessdata(racine: Path) -> Path | None:
    """Trouve le dossier tessdata à partir du répertoire Tesseract."""
    tessdata = racine / "tessdata"
    if tessdata.is_dir():
        return tessdata
    # Fallback : variable d'environnement
    prefix = os.environ.get("TESSDATA_PREFIX")
    if prefix and Path(prefix).is_dir():
        return Path(prefix)
    return None


class ProgressAfficheur:
    """Affiche la progression d'un téléchargement urllib."""

    def __init__(self, nom: str):
        self.nom = nom
        self.dernier_pct = -1

    def __call__(self, blocs_telecharges: int, taille_bloc: int, taille_totale: int):
        if taille_totale <= 0:
            print(f"  {self.nom} : {blocs_telecharges * taille_bloc // 1024} Ko…", end="\r")
            return
        recu = blocs_telecharges * taille_bloc
        pct = min(100, int(recu * 100 / taille_totale))
        if pct != self.dernier_pct and pct % 5 == 0:
            barre = "█" * (pct // 5) + "░" * (20 - pct // 5)
            mo_recu = recu / 1_048_576
            mo_total = taille_totale / 1_048_576
            print(f"  [{barre}] {pct:3d}%  {mo_recu:.1f}/{mo_total:.1f} Mo", end="\r")
            self.dernier_pct = pct
        if pct == 100:
            print()


def telecharger_fichier(url: str, destination: Path, nom_affiche: str) -> bool:
    """
    Télécharge un fichier depuis une URL vers destination.
    Retourne True si succès, False sinon.
    """
    print(f"\n📥 Téléchargement de {nom_affiche}…")
    print(f"   Source      : {url}")
    print(f"   Destination : {destination}")

    try:
        # Vérifier que l'URL est accessible (HEAD request)
        req = Request(url, method="HEAD")
        urlopen(req, timeout=10)
    except HTTPError as e:
        print(f"❌ Erreur HTTP {e.code} — fichier introuvable sur GitHub")
        return False
    except URLError as e:
        print(f"❌ Impossible d'accéder à GitHub : {e.reason}")
        print("   Vérifiez votre connexion internet ou téléchargez manuellement.")
        return False

    try:
        progression = ProgressAfficheur(nom_affiche)
        destination.parent.mkdir(parents=True, exist_ok=True)
        urlretrieve(url, destination, reporthook=progression)
        return True
    except Exception as e:
        print(f"\n❌ Erreur lors du téléchargement : {e}")
        if destination.exists():
            destination.unlink()  # Supprimer le fichier partiel
        return False


def main():
    print("=" * 60)
    print("  BlancBleu — Téléchargement des données de langue Tesseract")
    print("=" * 60)

    # ── Trouver Tesseract ──────────────────────────────────────────────────────
    print("\n🔍 Recherche de Tesseract OCR…")
    racine = trouver_tesseract()

    if not racine:
        print("❌ Tesseract OCR non trouvé sur ce poste.")
        print()
        print("   Installez Tesseract depuis :")
        print("   https://github.com/UB-Mannheim/tesseract/wiki")
        print("   → Choisir : tesseract-ocr-w64-setup-5.x.x.exe")
        sys.exit(1)

    print(f"✅ Tesseract trouvé : {racine}")

    # ── Trouver le dossier tessdata ────────────────────────────────────────────
    tessdata = trouver_dossier_tessdata(racine)

    if not tessdata:
        print(f"❌ Dossier tessdata introuvable dans {racine}")
        sys.exit(1)

    print(f"✅ Dossier tessdata : {tessdata}")

    # ── Traiter chaque langue ──────────────────────────────────────────────────
    print()
    resultats = []

    for langue in LANGUES:
        fichier = langue["fichier"]
        destination = tessdata / fichier
        url = f"{TESSDATA_BASE_URL}/{fichier}"
        obligatoire = langue["obligatoire"]
        description = langue["description"]

        if destination.exists():
            taille_mo = destination.stat().st_size / 1_048_576
            print(f"✅ {fichier} déjà présent ({taille_mo:.1f} Mo) — {description}")
            resultats.append((fichier, True, taille_mo))
            continue

        print(f"⬇️  {fichier} absent — {description}")
        ok = telecharger_fichier(url, destination, fichier)

        if ok and destination.exists():
            taille_mo = destination.stat().st_size / 1_048_576
            print(f"✅ {fichier} téléchargé ({taille_mo:.1f} Mo)")
            resultats.append((fichier, True, taille_mo))
        else:
            print(f"❌ {fichier} — téléchargement échoué")
            resultats.append((fichier, False, 0))
            if obligatoire:
                print()
                print("   Ce fichier est OBLIGATOIRE pour l'OCR français.")
                print("   Téléchargez-le manuellement depuis :")
                print(f"   {url}")
                print(f"   Et copiez-le dans : {tessdata}")

    # ── Résumé final ───────────────────────────────────────────────────────────
    print()
    print("=" * 60)
    print("  Résumé")
    print("=" * 60)

    fra_ok = False
    for fichier, succes, taille_mo in resultats:
        if succes:
            print(f"✅ {fichier} disponible ({taille_mo:.1f} Mo)")
            if fichier == "fra.traineddata":
                fra_ok = True
        else:
            print(f"❌ {fichier} manquant")

    print()
    if fra_ok:
        print("✅ Tesseract prêt pour l'OCR français (PMT)")
        print()
        print("   Redémarrez le microservice IA pour appliquer les changements :")
        print("   uvicorn main:app --host 0.0.0.0 --port 5002 --reload")
    else:
        print("⚠️  fra.traineddata manquant — l'OCR PMT ne fonctionnera pas.")
        print()
        print("   Solution manuelle :")
        print(f"   1. Télécharger : {TESSDATA_BASE_URL}/fra.traineddata")
        print(f"   2. Copier dans : {tessdata}")
        sys.exit(1)

    print("=" * 60)


if __name__ == "__main__":
    main()
