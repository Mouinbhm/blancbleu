require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('../models/User')

  const existe = await User.findOne({ email: 'patient@blancbleu.fr' })

  if (existe) {
    console.log('✅ Patient existe déjà')
    console.log('   Email    :', existe.email)
    console.log('   Role     :', existe.role)
    process.exit(0)
  }

  const hash = await bcrypt.hash('patient123', 10)

  const patient = await User.create({
    nom:       'Dubois',
    prenom:    'Marcel',
    email:     'patient@blancbleu.fr',
    password:  hash,
    role:      'patient',
    telephone: '0611223344',
    adresse:   '12 Rue de France, 06000 Nice',
    mobilite:  'FAUTEUIL_ROULANT',
    medecin:   'Dr. THIERY — Cardiologie',
    mutuelle:  'MGEN',
    actif:     true,
    contactUrgence: {
      nom:       'Dubois Marie',
      telephone: '0622334455',
    },
  })

  console.log('✅ Patient créé !')
  console.log('   Nom      :', patient.prenom, patient.nom)
  console.log('   Email    : patient@blancbleu.fr')
  console.log('   Password : patient123')
  process.exit(0)

}).catch(err => {
  console.error('❌ Erreur:', err.message)
  process.exit(1)
})
