# BlancBleu — Plateforme de Transport Sanitaire Non Urgent

Système de gestion intelligent pour le transport de patients vers les établissements de santé.

## Domaine métier

**Blanc Bleu** assure le transport sanitaire **non urgent** de :
- Patients dialysés (séances récurrentes)
- Patients en chimiothérapie / radiothérapie
- Personnes âgées et personnes à mobilité réduite
- Patients pour consultations, hospitalisations, retours à domicile

**Ce système n'est pas** un système de gestion d'urgences. Il n'y a pas de SAMU, de SMUR, de priorités P1/P2/P3, ni de logique d'escalade.

---

## Architecture

```
blancbleu/
├── server/           # Backend Node.js / Express / MongoDB
├── client/           # Frontend React 19
├── ai-service/       # Microservice IA Python / FastAPI (local, sans API externe)
└── docker-compose.yml
```

### Backend Node.js (port 5000)

```
server/
├── controllers/
│   ├── AuthController.js         # Authentification JWT
│   ├── transportController.js    # Cycle de vie complet du transport
│   ├── aiController.js           # Intégration microservice IA
│   ├── equipementController.js
│   ├── maintenanceController.js
│   ├── personnelController.js
│   └── factureController.js
├── models/
│   ├── Transport.js              # Entité principale (workflow 9 statuts)
│   ├── Vehicle.js                # VSL / TPMR / AMBULANCE
│   ├── Personnel.js              # Chauffeurs, ambulanciers
│   ├── Equipement.js
│   ├── Maintenance.js
│   ├── Facture.js
│   └── AuditLog.js               # Audit RGPD (TTL 90 jours)
├── routes/
│   ├── Auth.js, transports.js, vehicles.js
│   ├── ai.js                     # PMT, dispatch, optimisation
│   ├── planning.js, factures.js, analytics.js
│   └── geo.js, audit.js
├── services/
│   ├── transportStateMachine.js  # Machine d'état (9 statuts)
│   ├── transportLifecycle.js     # Orchestration des transitions
│   ├── smartDispatch.js          # Dispatch Node.js (scoring local)
│   ├── aiClient.js               # Client HTTP -> microservice Python
│   ├── socketService.js          # WebSocket temps réel
│   └── auditService.js           # Journalisation RGPD
└── utils/
    ├── geoUtils.js               # Haversine + OSRM (transport non urgent)
    └── logger.js
```

### Microservice IA Python (port 5002)

```
ai-service/
├── main.py                       # Point d'entree FastAPI
├── routes/
│   ├── pmt.py                    # POST /pmt/extract
│   ├── dispatch.py               # POST /dispatch/recommend
│   └── routing.py                # POST /routing/optimize
├── services/
│   ├── pmt_extractor.py          # OCR Tesseract + regex + spaCy
│   ├── dispatch_scorer.py        # Scoring metier (0-100 pts)
│   └── route_optimizer.py        # Google OR-Tools VRP
├── schemas/                      # Validation Pydantic
├── utils/
│   ├── ocr_utils.py              # Pipeline OCR (PDF -> texte)
│   └── regex_patterns.py         # Patterns PMT francaise
└── requirements.txt
```

---

## Workflow transport (machine d'etat)

```
REQUESTED
  -> CONFIRMED       (verification date, adresses, prescription)
  -> SCHEDULED       (date et heure planifiees)
  -> ASSIGNED        (vehicule + chauffeur affectes)
  -> EN_ROUTE_TO_PICKUP
  -> ARRIVED_AT_PICKUP
  -> PATIENT_ON_BOARD
  -> ARRIVED_AT_DESTINATION
  -> COMPLETED

Statuts alternatifs :
  CANCELLED         (annulation a tout moment avant depart)
  NO_SHOW           (patient absent a la prise en charge)
  RESCHEDULED       (reprogramme)
```

---

## Modules IA (locaux, sans API externe)

### Module 1 — Extraction PMT
Extrait automatiquement les donnees d'une Prescription Medicale de Transport (PDF ou image).

- **Technologie** : Tesseract OCR + regex + spaCy NER
- **Champs extraits** : patient, medecin, type de transport, mobilite, destination, aller-retour
- **Score de confiance** : 0.0 a 1.0 (< 0.75 -> validation humaine requise)
- **Endpoint** : `POST /api/ai/pmt/extract`

### Module 2 — Smart Dispatch
Recommande le meilleur vehicule pour un transport donne.

- **Technologie** : scoring par regles metier ponderees (0-100 pts)
- **Criteres** : compatibilite mobilite/vehicule, proximite GPS, disponibilite, fiabilite
- **Regles** : ASSIS->VSL, FAUTEUIL_ROULANT->TPMR, ALLONGE/CIVIERE->AMBULANCE
- **Endpoint** : `POST /api/ai/dispatch/:transportId`

### Module 3 — Optimisation de tournee
Optimise les tournees d'une journee pour plusieurs vehicules.

- **Technologie** : Google OR-Tools (Vehicle Routing Problem)
- **Objectif** : minimiser la distance totale, respecter les fenetres horaires
- **Endpoint** : `POST /api/ai/routing/optimize`

---

## API REST

| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion |
| GET | `/api/transports` | Liste des transports |
| POST | `/api/transports` | Creer un transport |
| PATCH | `/api/transports/:id/confirm` | Confirmer |
| PATCH | `/api/transports/:id/schedule` | Planifier |
| PATCH | `/api/transports/:id/assign` | Affecter vehicule |
| PATCH | `/api/transports/:id/en-route` | Depart vehicule |
| PATCH | `/api/transports/:id/arrived` | Arrivee chez patient |
| PATCH | `/api/transports/:id/on-board` | Patient a bord |
| PATCH | `/api/transports/:id/destination` | Arrivee destination |
| PATCH | `/api/transports/:id/complete` | Fin de transport |
| PATCH | `/api/transports/:id/cancel` | Annuler |
| PATCH | `/api/transports/:id/no-show` | Patient absent |
| POST | `/api/ai/pmt/extract` | Extraire PMT (OCR) |
| PATCH | `/api/ai/pmt/validate/:id` | Valider extraction |
| POST | `/api/ai/dispatch/:id` | Recommandation vehicule |
| POST | `/api/ai/routing/optimize` | Optimiser tournee |
| GET | `/api/ai/status` | Statut service IA |
| GET | `/api/vehicles` | Flotte de vehicules |
| GET | `/api/analytics/dashboard` | KPIs dashboard |
| GET | `/api/audit` | Journal d'audit |

---

## Evenements WebSocket (Socket.IO)

| Evenement | Direction | Description |
|-----------|-----------|-------------|
| `transport:created` | Serveur -> Client | Nouveau transport |
| `transport:statut` | Serveur -> Client | Changement de statut |
| `vehicule:assigne` | Serveur -> Client | Vehicule affecte |
| `vehicule:statut` | Serveur -> Client | Statut vehicule |
| `vehicule:position` | Serveur -> Client | Position GPS |
| `dispatch:completed` | Serveur -> Client | Auto-dispatch |
| `pmt:extraite` | Serveur -> Client | PMT extraite par IA |
| `stats:update` | Serveur -> Client | KPIs mis a jour |

---

## Installation et demarrage

### Prerequis
- Node.js 18+
- MongoDB (local ou Atlas)
- Python 3.11+
- Tesseract OCR (Windows : https://github.com/UB-Mannheim/tesseract/wiki)
- Poppler (Windows : https://github.com/oschwartz10612/poppler-windows/releases)

### Backend Node.js
```bash
cd server
npm install
cp ../.env.example .env
# Editer .env avec MONGO_URI, JWT_SECRET, etc.
npm run dev
```

### Microservice IA Python
```bash
cd ai-service
# Windows :
setup_et_lancer.bat

# Linux/Mac :
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m spacy download fr_core_news_sm
uvicorn main:app --port 5002 --reload
```

### Frontend React
```bash
cd client
npm install
npm start
```

### Docker (tout en un)
```bash
docker-compose up --build
```

---

## Variables d'environnement

```env
MONGO_URI=mongodb://localhost:27017/blancbleu
JWT_SECRET=<64-char-hex>
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
AI_API_URL=http://localhost:5002
OSRM_URL=https://router.project-osrm.org
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=<compte>
EMAIL_PASS=<mot-de-passe-app>
```

---

## Securite et RGPD

- JWT access tokens (15 min) + refresh tokens httpOnly (7 jours)
- Donnees patients chiffrees en transit (HTTPS en production)
- Numeros de securite sociale masques dans les logs
- Audit trail RGPD : 90 jours de conservation (TTL automatique)
- Soft delete sur les entites sensibles
- Rate limiting sur toutes les routes
- Sanitization NoSQL injection + XSS

---

## Roles utilisateur

| Role | Permissions |
|------|-------------|
| `dispatcher` | Creer/modifier transports, dispatcher, extraire PMT |
| `superviseur` | Tout dispatcher + analytics, audit, optimisation tournee |
| `admin` | Tout superviseur + gestion utilisateurs, configuration |

---

## Tests

```bash
cd server
npm test
npm run test:unit
npm run test:integration
npm run test:coverage
```

---

## Projet academique — PFE

Ce projet est developpe dans le cadre d'un Projet de Fin d'Etudes (PFE).
Technologies utilisees : Node.js, Express, MongoDB, React, Socket.IO, Python, FastAPI, Tesseract OCR, spaCy, Google OR-Tools.
