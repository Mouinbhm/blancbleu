@echo off
echo ============================================
echo  BlancBleu - Installation et lancement IA
echo ============================================

echo.
echo [1/4] Installation des dependances Python...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERREUR installation. Verifie que Python est installe.
    pause
    exit /b 1
)

echo.
echo [2/4] Entrainement du modele avec data.csv...
python train_model.py data.csv
if %errorlevel% neq 0 (
    echo ERREUR entrainement. Verifie que data.csv est dans ce dossier.
    pause
    exit /b 1
)

echo.
echo [3/4] Test de l'API (optionnel)...
echo       Le test sera fait apres lancement.

echo.
echo [4/4] Lancement de l'API Flask sur http://localhost:5001
echo       Garde cette fenetre ouverte !
echo.
python app.py

pause