"""
BlancBleu — Route FastAPI : PMT (Prescription Médicale de Transport)

POST /pmt/extract
  Reçoit un fichier PMT (PDF ou image) et retourne les données extraites.
  Utilise Tesseract OCR + regex + spaCy.
"""

import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from typing import Optional

from services.pmt_extractor import extraire_pmt
from schemas.pmt_schemas import PMTExtractionResponse

router = APIRouter()
logger = logging.getLogger("blancbleu.ai.pmt.route")

TYPES_ACCEPTES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/tiff",
}
MAX_TAILLE_OCTETS = 10 * 1024 * 1024  # 10 Mo


@router.post(
    "/extract",
    response_model=PMTExtractionResponse,
    summary="Extraire les données d'une PMT par OCR",
    description="""
    Analyse un fichier PDF ou image de Prescription Médicale de Transport
    et extrait automatiquement les données structurées.

    Formats acceptés : PDF, JPEG, PNG, TIFF (max 10 Mo)

    La réponse contient :
    - `extraction` : les données extraites (patient, médecin, mobilité, etc.)
    - `confiance` : score entre 0 et 1 (< 0.75 → validation humaine requise)
    - `validationRequise` : true si des champs critiques manquent
    - `champsManquants` : liste des champs obligatoires non détectés
    """,
)
async def extract_pmt(
    request: Request,
    pmt: UploadFile = File(..., description="Fichier PMT (PDF ou image)"),
    transportId: Optional[str] = Form(None, description="ID du transport associé (optionnel)"),
):
    """
    Extraction OCR d'une Prescription Médicale de Transport.

    Exemple curl :
    ```
    curl -X POST http://localhost:5002/pmt/extract \\
      -F "pmt=@/path/to/prescription.pdf" \\
      -F "transportId=6789abc"
    ```
    """
    # ── Validation du fichier ─────────────────────────────────────────────────
    if pmt.content_type not in TYPES_ACCEPTES:
        raise HTTPException(
            status_code=422,
            detail=f"Type de fichier non supporté : {pmt.content_type}. "
                   f"Utilisez : {', '.join(TYPES_ACCEPTES)}",
        )

    contenu = await pmt.read()

    if len(contenu) == 0:
        raise HTTPException(status_code=422, detail="Fichier vide")

    if len(contenu) > MAX_TAILLE_OCTETS:
        raise HTTPException(
            status_code=422,
            detail=f"Fichier trop volumineux ({len(contenu) // 1024} Ko). Maximum : 10 Mo",
        )

    logger.info(
        f"PMT reçue — fichier: {pmt.filename}, "
        f"type: {pmt.content_type}, "
        f"taille: {len(contenu) // 1024} Ko"
    )

    # ── Extraction ────────────────────────────────────────────────────────────
    try:
        nlp = getattr(request.app.state, "nlp", None)
        result = extraire_pmt(contenu, pmt.content_type, nlp=nlp)
        return result
    except RuntimeError as e:
        # Tesseract indisponible
        raise HTTPException(
            status_code=503,
            detail=f"Service OCR indisponible : {str(e)}. "
                   "Assurez-vous que Tesseract est installé.",
        )
    except ValueError as e:
        # Fichier corrompu ou non lisible
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur extraction PMT : {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur interne : {str(e)}")
