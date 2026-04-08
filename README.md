# 🚑 BlancBleu

**BlancBleu** est une plateforme intelligente de gestion des interventions ambulancières.  
Le projet combine :

- **Frontend** : React
- **Backend** : Node.js / Express
- **Base de données** : MongoDB
- **Module IA** : Python / Flask

L’objectif est d’aider à la gestion des urgences médicales avec une logique de priorisation, de gestion des unités, de suivi des interventions et d’aide à la décision.

---

# 📌 Sommaire

- [Présentation](#-présentation)
- [Fonctionnalités](#-fonctionnalités)
- [Architecture du projet](#-architecture-du-projet)
- [Structure du projet](#-structure-du-projet)
- [Technologies utilisées](#-technologies-utilisées)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Lancement du projet](#-lancement-du-projet)
- [API Backend](#-api-backend)
- [Module IA](#-module-ia)
- [Workflow de la plateforme](#-workflow-de-la-plateforme)
- [Améliorations futures](#-améliorations-futures)
- [Auteurs](#-auteurs)
- [Licence](#-licence)

---

# 📖 Présentation

BlancBleu est une application conçue pour améliorer la coordination des interventions ambulancières.

Elle permet de :

- gérer les appels et interventions
- classifier les urgences selon leur gravité
- suivre les unités disponibles
- affecter une unité à une intervention
- exploiter un module IA pour assister la priorisation
- centraliser les données opérationnelles

Le projet vise à proposer une base réaliste d’une plateforme métier de dispatch médical.

---

# ✅ Fonctionnalités

## Gestion des interventions
- Création d’une intervention
- Consultation de la liste des interventions
- Détail d’une intervention
- Mise à jour du statut d’une intervention
- Affectation / désaffectation d’une unité
- Historique des interventions

## Gestion des unités
- Création et gestion des unités ambulancières
- Suivi de disponibilité
- Mise à jour du statut
- Gestion de la position / localisation
- Gestion des équipages

## Authentification
- Connexion utilisateur
- Gestion des rôles
- Protection des routes backend
- Contrôle d’accès selon le profil

## Aide à la décision par IA
- Analyse des données d’une intervention
- Prédiction du niveau de priorité
- Recommandation d’un type d’unité
- Justification de la décision
- Fallback métier si le service IA est indisponible

## Temps réel
- Communication temps réel via Socket.IO
- Mise à jour dynamique des événements critiques

## Gestion métier complémentaire
- Personnel
- Équipements
- Maintenances
- Factures

---

# 🏗 Architecture du projet

Le projet est organisé en trois parties principales :

## 1. Frontend
Interface utilisateur développée avec React.

Rôle :
- affichage des tableaux de bord
- gestion des formulaires
- visualisation des interventions
- interaction avec l’API backend

## 2. Backend
API REST développée avec Node.js / Express.

Rôle :
- gestion de la logique métier
- sécurisation des accès
- communication avec MongoDB
- orchestration entre le frontend et le module IA

## 3. Module IA
Microservice Python avec Flask.

Rôle :
- analyser les données d’intervention
- prédire une priorité
- recommander une unité adaptée
- retourner un score et une justification

---

# 📂 Structure du projet

```bash
Blancbleu/
│
├── client/                  # Frontend React
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── README.md
│
├── server/                  # Backend Node.js / Express
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── Server.js
│   ├── seed.js
│   └── package.json
│
├── ai-Model/                # Service IA Python / Flask
│   ├── app.py
│   ├── train_model.py
│   ├── test_api.py
│   ├── requirements.txt
│   └── model/
│
├── .gitignore
└── README.md
