# ══════════════════════════════════════════════════════════════════════════════
# BlancBleu — Module IA Flask
# Lance via Gunicorn (production) — jamais app.run() en prod
# ══════════════════════════════════════════════════════════════════════════════
FROM python:3.11-slim

WORKDIR /app

# Dépendances système minimales
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Utilisateur non-root
RUN groupadd -r blancbleu && useradd -r -g blancbleu blancbleu

# Installer les dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code applicatif
COPY app.py .

# Le modèle est monté en volume (./ai-Model/model:/app/model)
# pour éviter de le rebaker dans l'image à chaque réentraînement
RUN mkdir -p model && chown -R blancbleu:blancbleu /app

USER blancbleu

EXPOSE 5001

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD curl -f http://localhost:5001/health || exit 1

# 2 workers Gunicorn — suffisant pour le trafic de dispatch
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5001", "--timeout", "60", "--access-logfile", "-", "app:app"]