const express   = require('express')
const router    = express.Router()
const jwt       = require('jsonwebtoken')
const bcrypt    = require('bcryptjs')
const User      = require('../models/User')
const Transport = require('../models/Transport')
const Facture   = require('../models/Facture')

// ── Helpers ───────────────────────────────────────────────────────────────────

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' })
}

function patientPayload(u) {
  return {
    id:             u._id,
    nom:            u.nom,
    prenom:         u.prenom,
    email:          u.email,
    telephone:      u.telephone,
    adresse:        u.adresse,
    mobilite:       u.mobilite,
    role:           u.role,
    medecin:        u.medecin,
    mutuelle:       u.mutuelle,
    contactUrgence: u.contactUrgence,
  }
}

// Détermine le type de véhicule adapté à la mobilité du patient
function autoTypeTransport(mobilite) {
  if (mobilite === 'FAUTEUIL_ROULANT') return 'TPMR'
  if (['ALLONGE', 'CIVIERE'].includes(mobilite)) return 'AMBULANCE'
  return 'VSL'
}

// Normalise les motifs envoyés depuis l'app Flutter
const MOTIF_MAP = {
  'Consultation spécialiste': 'Consultation',
  'Chimiotherapie':           'Chimiothérapie',
  'Reeducation':              'Rééducation',
  'Reéducation':              'Rééducation',
}
function normalizeMotif(m) {
  return MOTIF_MAP[m] || m || 'Consultation'
}

// Haversine distance (km)
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Middleware authPatient ────────────────────────────────────────────────────

const authPatient = async (req, res, next) => {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token manquant' })
    }
    const token   = header.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user    = await User.findById(decoded.id).select('-password')
    if (!user || !user.actif) {
      return res.status(401).json({ message: 'Compte inactif' })
    }
    req.user = user
    next()
  } catch {
    res.status(401).json({ message: 'Token invalide ou expiré' })
  }
}

// ── ROUTE 1 : POST /api/patient/register ─────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    const { prenom, nom, email, password, telephone } = req.body

    if (!prenom || !nom || !email || !password) {
      return res.status(400).json({ message: 'Champs obligatoires manquants' })
    }

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return res.status(409).json({ message: 'Email déjà utilisé' })
    }

    const hash    = await bcrypt.hash(password, 10)
    const patient = await User.create({
      prenom,
      nom,
      email:     email.toLowerCase(),
      password:  hash,
      telephone: telephone || '',
      role:      'patient',
      actif:     true,
    })

    const accessToken = signToken(patient._id)
    res.status(201).json({ accessToken, patient: patientPayload(patient) })
  } catch (err) {
    console.error('[patient/register]', err)
    res.status(500).json({ message: 'Erreur serveur', detail: err.message })
  }
})

// ── ROUTE 2 : POST /api/patient/login ────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' })
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
    if (!user) {
      return res.status(401).json({ message: 'Identifiants incorrects' })
    }
    if (!user.actif) {
      return res.status(401).json({ message: 'Compte désactivé' })
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return res.status(401).json({ message: 'Identifiants incorrects' })
    }

    const accessToken = signToken(user._id)
    res.json({ accessToken, patient: patientPayload(user) })
  } catch (err) {
    console.error('[patient/login]', err)
    res.status(500).json({ message: 'Erreur serveur', detail: err.message })
  }
})

// ── ROUTE 3 : GET /api/patient/me ────────────────────────────────────────────

router.get('/me', authPatient, async (req, res) => {
  try {
    res.json({ patient: patientPayload(req.user) })
  } catch (err) {
    console.error('[patient/me]', err)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// ── ROUTE 4 : PUT /api/patient/profil ────────────────────────────────────────

router.put('/profil', authPatient, async (req, res) => {
  try {
    const { telephone, adresse, mobilite, medecin, mutuelle, contactUrgence } = req.body

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { telephone, adresse, mobilite, medecin, mutuelle, contactUrgence } },
      { new: true, runValidators: true },
    ).select('-password')

    res.json({ message: 'Profil mis à jour', patient: patientPayload(updated) })
  } catch (err) {
    console.error('[patient/profil]', err)
    res.status(500).json({ message: 'Erreur serveur', detail: err.message })
  }
})

// ── ROUTE 5 : GET /api/patient/transports ────────────────────────────────────

router.get('/transports', authPatient, async (req, res) => {
  try {
    const filter = {
      deletedAt: null,
      $or: [
        { 'patient.email':     req.user.email },
        { 'patient.telephone': req.user.telephone },
        { 'patient.nom': req.user.nom, 'patient.prenom': req.user.prenom },
      ],
    }

    if (req.query.statut) filter.statut = req.query.statut

    const transports = await Transport.find(filter)
      .sort({ dateTransport: -1 })
      .limit(50)
      .populate('vehicule',   'nom type immatriculation position')
      .populate('chauffeur',  'prenom nom telephone')

    res.json({ transports })
  } catch (err) {
    console.error('[patient/transports GET]', err)
    res.status(500).json({ message: 'Erreur serveur', detail: err.message })
  }
})

// ── ROUTE 6 : POST /api/patient/transports ───────────────────────────────────

router.post('/transports', authPatient, async (req, res) => {
  try {
    const {
      heureDepart,
      adresseDepart,
      adresseArrivee,
      motif,
      typeTransport,
      allerRetour,
      notes,
    } = req.body

    if (!heureDepart || !adresseDepart || !adresseArrivee) {
      return res.status(400).json({
        message: 'heureDepart, adresseDepart et adresseArrivee sont obligatoires',
      })
    }

    const departDate = new Date(heureDepart)
    const heure = `${String(departDate.getHours()).padStart(2, '0')}:${String(departDate.getMinutes()).padStart(2, '0')}`

    const mobilite     = req.user.mobilite || 'ASSIS'
    const resolvedType = typeTransport || autoTypeTransport(mobilite)
    const resolvedMotif = normalizeMotif(motif)

    const transport = await Transport.create({
      patient: {
        nom:       req.user.nom,
        prenom:    req.user.prenom,
        email:     req.user.email,
        telephone: req.user.telephone,
        mobilite,
      },
      typeTransport:      resolvedType,
      motif:              resolvedMotif,
      dateTransport:      departDate,
      heureRDV:           heure,
      heureDepart:        heure,
      adresseDepart:      { nom: adresseDepart },
      adresseDestination: { nom: adresseArrivee },
      allerRetour:        allerRetour || false,
      notes:              notes || '',
      statut:             'REQUESTED',
      origine:            'PATIENT_APP',
      createdBy:          req.user._id,
    })

    try {
      const io = req.app.get('io')
      if (io) io.emit('nouvelle_demande_patient', { transportId: transport._id, numero: transport.numero })
    } catch (socketErr) {
      console.error('[patient/transports POST] socket.io emit échoué', socketErr.message)
    }

    res.status(201).json({ transport })
  } catch (err) {
    console.error('[patient/transports POST]', err)
    res.status(500).json({ message: 'Erreur serveur', detail: err.message })
  }
})

// ── ROUTE 7 : GET /api/patient/transports/:id ────────────────────────────────

router.get('/transports/:id', authPatient, async (req, res) => {
  try {
    const transport = await Transport.findById(req.params.id)
      .populate('vehicule',  'nom type position immatriculation')
      .populate('chauffeur', 'prenom nom telephone')

    if (!transport) {
      return res.status(404).json({ message: 'Transport introuvable' })
    }

    res.json({ transport })
  } catch (err) {
    console.error('[patient/transports/:id]', err)
    res.status(500).json({ message: 'Erreur serveur', detail: err.message })
  }
})

// ── ROUTE 8 : GET /api/patient/transports/:id/tracking ───────────────────────

router.get('/transports/:id/tracking', authPatient, async (req, res) => {
  try {
    const transport = await Transport.findById(req.params.id)
      .populate('vehicule',  'nom type immatriculation position')
      .populate('chauffeur', 'prenom nom telephone')

    if (!transport) {
      return res.status(404).json({ message: 'Transport introuvable' })
    }

    // Calcul ETA par Haversine
    let etaMinutes = null
    try {
      const vPos = transport.vehicule?.position
      const dCoord = transport.adresseDepart?.coordonnees
      if (vPos?.lat && vPos?.lng && dCoord?.lat && dCoord?.lng) {
        const distKm = haversine(vPos.lat, vPos.lng, dCoord.lat, dCoord.lng)
        etaMinutes = Math.round(distKm / 0.5) // 30 km/h en minutes
      }
    } catch (etaErr) {
      console.error('[tracking] calcul ETA échoué', etaErr.message)
    }

    res.json({
      statut:             transport.statut,
      vehicule:           transport.vehicule
        ? {
            nom:            transport.vehicule.nom,
            type:           transport.vehicule.type,
            immatriculation: transport.vehicule.immatriculation,
            position:       transport.vehicule.position,
          }
        : null,
      chauffeur:          transport.chauffeur
        ? {
            prenom:    transport.chauffeur.prenom,
            nom:       transport.chauffeur.nom,
            telephone: transport.chauffeur.telephone,
          }
        : null,
      etaMinutes,
      historiqueStatuts:  transport.journal || [],
      heureDepart:        transport.heureDepart,
      adresseDepart:      transport.adresseDepart,
      adresseArrivee:     transport.adresseDestination,
    })
  } catch (err) {
    console.error('[patient/transports/:id/tracking]', err)
    res.status(500).json({ message: 'Erreur serveur', detail: err.message })
  }
})

// ── ROUTE 9 : GET /api/patient/factures ──────────────────────────────────────

router.get('/factures', authPatient, async (req, res) => {
  try {
    const factures = await Facture.find({
      $or: [
        { patientNom: req.user.nom, patientPrenom: req.user.prenom },
      ],
    }).sort({ dateEmission: -1 })

    res.json({ factures })
  } catch (err) {
    console.error('[patient/factures]', err)
    res.status(500).json({ message: 'Erreur serveur', detail: err.message })
  }
})

// ── ROUTE 10 : GET /api/patient/stats ────────────────────────────────────────

router.get('/stats', authPatient, async (req, res) => {
  try {
    const baseFilter = {
      deletedAt: null,
      $or: [
        { 'patient.email':     req.user.email },
        { 'patient.telephone': req.user.telephone },
        { 'patient.nom': req.user.nom, 'patient.prenom': req.user.prenom },
      ],
    }

    const factureFilter = {
      $or: [
        { patientNom: req.user.nom, patientPrenom: req.user.prenom },
      ],
    }

    const now = new Date()

    const [totalTransports, transportsTermines, transportsAVenir, totalFactures] =
      await Promise.all([
        Transport.countDocuments(baseFilter),
        Transport.countDocuments({ ...baseFilter, statut: { $in: ['COMPLETED', 'BILLED'] } }),
        Transport.countDocuments({
          ...baseFilter,
          dateTransport: { $gt: now },
          statut: { $nin: ['CANCELLED', 'NO_SHOW'] },
        }),
        Facture.countDocuments(factureFilter),
      ])

    res.json({ totalTransports, transportsTermines, transportsAVenir, totalFactures })
  } catch (err) {
    console.error('[patient/stats]', err)
    res.status(500).json({ message: 'Erreur serveur', detail: err.message })
  }
})

module.exports = router
