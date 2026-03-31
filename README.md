# 🚑 BlancBleu — Plateforme de Gestion des Interventions Ambulancières

![BlancBleu](https://img.shields.io/badge/BlancBleu-v1.0.0-1D6EF5?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.0-06B6D4?style=for-the-badge&logo=tailwindcss)

---

## 📋 Description

**BlancBleu** est une application web intelligente dédiée à la gestion des interventions d'ambulances.
Elle intègre un module d'intelligence artificielle d'aide à la décision permettant :

- La **priorisation automatique** des interventions (P1 Critique / P2 Urgent / P3 Standard)
- L'**optimisation de l'affectation** des ressources ambulancières
- Le **suivi en temps réel** des unités sur carte interactive
- La **génération de rapports** opérationnels

---

## 🖥️ Aperçu des écrans

| Écran | Description |
|-------|-------------|
| 📊 Dashboard | Vue opérationnelle en temps réel |
| 🚨 Interventions | Liste et gestion des interventions actives |
| 🗺️ Carte en direct | Localisation des unités et incidents |
| 🤖 Aide IA | Module de priorisation intelligente |
| 🚑 Flotte | Gestion de la flotte ambulancière |
| 📈 Rapports | Analytique et statistiques opérationnelles |

---

## 🛠️ Technologies utilisées

### Frontend
- **React.js** — Interface utilisateur
- **React Router DOM** — Navigation
- **Tailwind CSS** — Design system
- **Axios** — Requêtes HTTP
- **Sora / DM Sans / JetBrains Mono** — Typographie

### Backend
- **Node.js** — Environnement d'exécution
- **Express.js** — Framework API REST
- **MongoDB** — Base de données
- **Mongoose** — ODM MongoDB
- **Socket.IO** — Temps réel
- **JWT** — Authentification
- **bcryptjs** — Sécurité

---

## 📁 Structure du projet
```
blancbleu/
├── client/                  # Frontend React
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── layout/      # Sidebar + Topbar
│       │   ├── ui/          # Composants réutilisables
│       │   ├── interventions/
│       │   └── units/
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── Interventions.jsx
│       │   ├── Carte.jsx
│       │   ├── Flotte.jsx
│       │   ├── AideIA.jsx
│       │   └── Rapports.jsx
│       └── services/
├── server/                  # Backend Node.js
│   ├── models/
│   │   ├── Intervention.js
│   │   └── Unit.js
│   ├── routes/
│   │   ├── interventions.js
│   │   ├── units.js
│   │   ├── ai.js
│   │   └── auth.js
│   ├── middleware/
│   └── server.js
└── README.md
```

---

## 🚀 Installation et lancement

### Prérequis
- Node.js v18+
- MongoDB (local ou Atlas)
- Git

### 1. Cloner le projet
```bash
git clone https://github.com/Mouinbhm/blancbleu.git
cd blancbleu
```

### 2. Installer les dépendances
```bash
# Frontend
cd client
npm install

# Backend
cd ../server
npm install
```

### 3. Configurer les variables d'environnement

Crée un fichier `.env` dans `server/` :
```env
MONGO_URI=mongodb://localhost:27017/blancbleu
PORT=5000
JWT_SECRET=blancbleu_secret_2025
```

### 4. Lancer le projet

Terminal 1 — Backend :
```bash
cd server
npm run dev
```

Terminal 2 — Frontend :
```bash
cd client
npm start
```

### 5. Accéder à l'application
```
Frontend : http://localhost:3000
API      : http://localhost:5000/api
```

---

## 🤖 Module IA — Algorithme de priorisation

Le module IA analyse plusieurs critères pour calculer un **score de priorité** :

| Critère | Impact sur le score |
|---------|-------------------|
| Type d'incident | +15 à +40 points |
| État du patient | +5 à +30 points |
| Symptômes critiques | +10 points chacun |
| Nombre de victimes | +5 points/victime |

**Seuils de priorité :**
- 🔴 **P1 CRITIQUE** — Score ≥ 80
- 🟡 **P2 URGENT** — Score entre 55 et 79
- 🔵 **P3 STANDARD** — Score < 55

---

## 📡 API Endpoints

### Interventions
```
GET    /api/interventions          → Liste toutes les interventions
GET    /api/interventions?status=active → Interventions actives
POST   /api/interventions          → Créer une intervention
PATCH  /api/interventions/:id/status → Mettre à jour le statut
DELETE /api/interventions/:id      → Supprimer
```

### Unités
```
GET    /api/units                  → Liste toutes les unités
GET    /api/units?status=disponible → Unités disponibles
PATCH  /api/units/:id/status       → Mettre à jour le statut
```

### IA
```
POST   /api/ai/analyze             → Analyser et prioriser un incident
```

### Auth
```
POST   /api/auth/login             → Connexion dispatcher
POST   /api/auth/register          → Créer un compte
```

---

## 👥 Équipe

| Nom | Rôle |
|-----|------|
| Mouin BHM | Développeur Full Stack |

---

## 📄 Licence

Ce projet est développé dans le cadre d'un **Projet de Fin d'Études (PFE)**.

---

<div align="center">
  <strong>BlancBleu — La clarté au service de l'urgence 🚑</strong>
</div>
```

---

## Ensuite dans GitHub Desktop

1. Tu verras `README.md` apparaître dans les **Changes**
2. Dans **Summary** en bas à gauche tape :
```
docs: add README
