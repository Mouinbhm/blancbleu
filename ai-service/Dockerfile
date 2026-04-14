FROM python:3.11-slim

LABEL maintainer="BlancBleu Transport Sanitaire"
LABEL description="Microservice IA local — PMT, Dispatch, Routage"

# ── Dépendances système ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-fra \
    tesseract-ocr-eng \
    poppler-utils \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ── Répertoire de travail ─────────────────────────────────────────────────────
WORKDIR /app

# ── Dépendances Python ────────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Modèle spaCy français
RUN python -m spacy download fr_core_news_sm

# ── Code source ───────────────────────────────────────────────────────────────
COPY . .

# ── Port d'exposition ─────────────────────────────────────────────────────────
EXPOSE 5002

# ── Démarrage ─────────────────────────────────────────────────────────────────
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5002", "--workers", "2"]
