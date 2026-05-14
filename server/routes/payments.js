/**
 * BlancBleu — Routes Paiement Stripe v3.0
 *
 * IMPORTANT : La route webhook utilise express.raw() et doit être enregistrée
 * AVANT express.json() dans server.js pour que la vérification de signature Stripe
 * fonctionne correctement.
 */
const express = require("express");
const router  = express.Router();
const { protect } = require("../middleware/auth");
const ctrl = require("../controllers/paymentController");

// ── Créer un PaymentIntent (client web ou mobile) ─────────────────────────────
// Body : { invoiceId }
router.post("/stripe/create-payment-intent", protect, ctrl.createPaymentIntent);

// ── Confirmer paiement après succès Stripe côté client ───────────────────────
// Body : { paymentIntentId, factureId }
// Fallback si le webhook n'a pas encore été traité.
router.post("/stripe/confirm", protect, ctrl.confirmPayment);

// NOTE : La route POST /stripe/webhook est enregistrée directement dans server.js
// avec express.raw() AVANT express.json() pour conserver le body Buffer brut.
// Ne pas l'ajouter ici.

module.exports = router;
