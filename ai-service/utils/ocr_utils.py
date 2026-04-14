"""
BlancBleu — Utilitaires OCR
Conversion PDF/image → texte via Tesseract
"""

import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger("blancbleu.ai.ocr")


def pdf_vers_images(pdf_bytes: bytes) -> list:
    """
    Convertit un PDF en liste d'images PIL pour OCR.
    Nécessite poppler installé sur le système.

    Installation :
      Windows : télécharger poppler et ajouter au PATH
      Linux   : apt install poppler-utils
    """
    from pdf2image import convert_from_bytes
    try:
        images = convert_from_bytes(pdf_bytes, dpi=300, fmt="PNG")
        logger.info(f"PDF converti : {len(images)} page(s)")
        return images
    except Exception as e:
        logger.error(f"Erreur conversion PDF : {e}")
        raise ValueError(f"Impossible de convertir le PDF : {e}")


def image_bytes_vers_pil(image_bytes: bytes, mimetype: str):
    """Convertit des bytes image en objet PIL Image."""
    from PIL import Image
    import io
    try:
        img = Image.open(io.BytesIO(image_bytes))
        # Convertir en RGB si nécessaire (ex: RGBA, P)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        return img
    except Exception as e:
        raise ValueError(f"Image invalide : {e}")


def preparer_image_ocr(image):
    """
    Préprocessing image pour améliorer la qualité OCR sur documents médicaux.
    - Conversion niveaux de gris
    - Augmentation contraste
    - Seuillage adaptatif
    """
    from PIL import Image, ImageFilter, ImageEnhance
    import io

    # Niveaux de gris
    if image.mode != "L":
        image = image.convert("L")

    # Améliorer contraste
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)

    # Légère netteté
    image = image.filter(ImageFilter.SHARPEN)

    return image


def ocr_image(image, lang: str = "fra") -> str:
    """
    Applique Tesseract OCR sur une image PIL.

    Args:
        image : PIL Image
        lang  : langue Tesseract ("fra" pour français)

    Returns:
        str : texte extrait
    """
    import pytesseract

    # Configuration Tesseract optimisée pour documents médicaux
    # --psm 6 : bloc de texte uniforme (formulaire)
    # --oem 3 : moteur LSTM + legacy combinés
    config = "--psm 6 --oem 3"

    try:
        texte = pytesseract.image_to_string(image, lang=lang, config=config)
        return texte.strip()
    except pytesseract.TesseractError as e:
        logger.error(f"Erreur Tesseract : {e}")
        raise RuntimeError(f"Tesseract OCR indisponible : {e}")


def extraire_texte_complet(fichier_bytes: bytes, mimetype: str) -> str:
    """
    Pipeline complet d'extraction de texte depuis un fichier PMT.

    1. Conversion PDF → images si nécessaire
    2. Préprocessing image
    3. OCR Tesseract (français)
    4. Concaténation des pages

    Args:
        fichier_bytes : contenu brut du fichier
        mimetype      : type MIME du fichier

    Returns:
        str : texte OCR complet
    """
    textes = []

    if mimetype == "application/pdf":
        images = pdf_vers_images(fichier_bytes)
        for i, img in enumerate(images):
            img_prepared = preparer_image_ocr(img)
            texte = ocr_image(img_prepared)
            if texte:
                textes.append(texte)
                logger.debug(f"Page {i+1} : {len(texte)} caractères extraits")
    else:
        # Image directe (JPEG, PNG, TIFF)
        image = image_bytes_vers_pil(fichier_bytes, mimetype)
        image_prepared = preparer_image_ocr(image)
        texte = ocr_image(image_prepared)
        textes.append(texte)

    resultat = "\n\n".join(textes)
    logger.info(f"OCR terminé : {len(resultat)} caractères au total")
    return resultat
