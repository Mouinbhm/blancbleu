@echo off
REM ════════════════════════════════════════════════════════════════
REM  BlancBleu AI Service — Script de démarrage Windows
REM  Transport sanitaire NON urgent
REM ════════════════════════════════════════════════════════════════

echo.
echo  BlancBleu — Microservice IA Python
echo  Transport sanitaire non urgent
echo  ====================================
echo.

REM Vérifier Python
python --version 2>nul
if errorlevel 1 (
    echo [ERREUR] Python non trouvé. Installez Python 3.11+
    pause
    exit /b 1
)

REM Créer environnement virtuel si absent
if not exist "venv\" (
    echo [INFO] Création de l'environnement virtuel...
    python -m venv venv
)

REM Activer l'environnement
call venv\Scripts\activate.bat

REM Installer les dépendances
echo [INFO] Installation des dépendances...
pip install -r requirements.txt --quiet

REM Télécharger le modèle spaCy français si absent
python -c "import spacy; spacy.load('fr_core_news_sm')" 2>nul
if errorlevel 1 (
    echo [INFO] Téléchargement du modèle spaCy français...
    python -m spacy download fr_core_news_sm
)

REM Vérifier Tesseract
where tesseract 2>nul
if errorlevel 1 (
    echo.
    echo [ATTENTION] Tesseract OCR non trouvé dans le PATH.
    echo Téléchargez-le depuis : https://github.com/UB-Mannheim/tesseract/wiki
    echo Ajoutez le dossier d'installation au PATH Windows.
    echo L'extraction PMT sera désactivée jusqu'à l'installation.
    echo.
)

echo.
echo [INFO] Démarrage du service IA sur http://localhost:5002
echo [INFO] Documentation : http://localhost:5002/docs
echo [INFO] Ctrl+C pour arrêter
echo.

uvicorn main:app --host 0.0.0.0 --port 5002 --reload
