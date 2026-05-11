const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");

const TWO_FACTOR_ROLES = ["admin", "dispatcher", "superviseur"];

const safeMsg = (err) =>
  process.env.NODE_ENV === "production" ? "Erreur interne du serveur" : err.message;

// ── Shared token helpers (mirror authController — extracted here to avoid circular dep) ──
const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" });

const issueRefreshToken = async (userId, res, req) => {
  const raw = crypto.randomBytes(40).toString("hex");
  const hash = RefreshToken.hashToken(raw);
  await RefreshToken.create({
    userId,
    tokenHash: hash,
    userAgent: req.get("user-agent") || "",
    ip: req.ip,
  });
  res.cookie("bb_refresh", raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
};

const buildUserPayload = (user) => ({
  id: user._id,
  nom: user.nom,
  prenom: user.prenom,
  email: user.email,
  role: user.role,
  mustChangePassword: user.mustChangePassword ?? false,
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Générer un secret TOTP + QR code (étape 1 de la configuration)
// @route   POST /api/auth/2fa/setup
// @access  Privé — admin, dispatcher, superviseur
// ─────────────────────────────────────────────────────────────────────────────
const setup2FA = async (req, res) => {
  try {
    if (!TWO_FACTOR_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "2FA disponible uniquement pour admin, dispatcher et superviseur",
      });
    }

    const secret = speakeasy.generateSecret({
      name: `BlancBleu (${req.user.email})`,
      issuer: "Ambulances Blanc Bleu",
      length: 32,
    });

    // Persist secret (not yet active — pending confirmation)
    await User.findByIdAndUpdate(req.user._id, {
      twoFactorSecret: secret.base32,
      twoFactorEnabled: false,
    });

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrDataUrl,
      message:
        "Scannez le QR code avec Google Authenticator ou Authy, puis confirmez avec votre code à 6 chiffres.",
    });
  } catch (err) {
    res.status(500).json({ message: safeMsg(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Confirmer le code TOTP et activer le 2FA (étape 2)
// @route   POST /api/auth/2fa/confirm
// @access  Privé
// ─────────────────────────────────────────────────────────────────────────────
const confirm2FA = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: "Code TOTP à 6 chiffres requis" });
    }

    const user = await User.findById(req.user._id).select("+twoFactorSecret");
    if (!user?.twoFactorSecret) {
      return res.status(400).json({
        message: "Configurez d'abord le 2FA via POST /api/auth/2fa/setup",
      });
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: String(code),
      window: 1, // ±30 s pour compenser les décalages horaires
    });

    if (!valid) {
      return res.status(401).json({ message: "Code TOTP incorrect ou expiré" });
    }

    await User.findByIdAndUpdate(user._id, { twoFactorEnabled: true });

    res.json({ message: "Double authentification activée avec succès" });
  } catch (err) {
    res.status(500).json({ message: safeMsg(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Vérifier le TOTP après la saisie du mot de passe (2e facteur login)
// @route   POST /api/auth/2fa/verify
// @access  Public — nécessite un tempToken émis par /auth/login
// ─────────────────────────────────────────────────────────────────────────────
const verify2FA = async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ message: "tempToken et code TOTP requis" });
    }

    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res
        .status(401)
        .json({ message: "Session expirée — recommencez la connexion" });
    }

    if (!payload.requires2FA) {
      return res
        .status(400)
        .json({ message: "Token invalide pour la vérification 2FA" });
    }

    const user = await User.findById(payload.id).select("+twoFactorSecret");
    if (!user || !user.actif) {
      return res.status(401).json({ message: "Compte introuvable ou désactivé" });
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: String(code),
      window: 1,
    });

    if (!valid) {
      return res.status(401).json({ message: "Code TOTP incorrect ou expiré" });
    }

    const accessToken = generateAccessToken(user._id);
    await issueRefreshToken(user._id, res, req);
    res.cookie("bb_access", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
      path: "/api",
    });

    res.json({ message: "Connexion réussie", user: buildUserPayload(user) });
  } catch (err) {
    res.status(500).json({ message: safeMsg(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Désactiver le 2FA (confirmation par mot de passe requise)
// @route   DELETE /api/auth/2fa
// @access  Privé
// ─────────────────────────────────────────────────────────────────────────────
const disable2FA = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res
        .status(400)
        .json({ message: "Mot de passe requis pour désactiver le 2FA" });
    }

    const user = await User.findById(req.user._id).select("+password");
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: "Mot de passe incorrect" });
    }

    await User.findByIdAndUpdate(user._id, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });

    res.json({ message: "Double authentification désactivée" });
  } catch (err) {
    res.status(500).json({ message: safeMsg(err) });
  }
};

module.exports = { setup2FA, confirm2FA, verify2FA, disable2FA };
