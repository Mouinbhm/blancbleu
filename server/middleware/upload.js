/**
 * BlancBleu — Middleware Upload (multer)
 *
 * Configurations par type :
 *  - uploadPmt       : PDF / images PMT → /uploads/pmt
 *  - uploadSignature : image signature  → /uploads/signatures
 */

const multer = require("multer");
const path   = require("path");
const fs     = require("fs");

const UPLOADS_ROOT = path.join(__dirname, "../uploads");

function _ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Stockage PMT ──────────────────────────────────────────────────────────────
const pmtStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOADS_ROOT, "pmt");
    _ensureDir(dir);
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `pmt_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const PMT_MIME = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

const uploadPmt = multer({
  storage: pmtStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
  fileFilter(req, file, cb) {
    if (PMT_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé. Formats acceptés : PDF, JPG, PNG."));
    }
  },
}).single("file");

// ── Stockage Signature ────────────────────────────────────────────────────────
const signatureStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOADS_ROOT, "signatures");
    _ensureDir(dir);
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase() || ".png";
    const name = `sig_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const SIG_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

const uploadSignature = multer({
  storage: signatureStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo
  fileFilter(req, file, cb) {
    if (SIG_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé pour la signature. Formats acceptés : PNG, JPG."));
    }
  },
}).single("signature");

// ── Stockage Avatar ───────────────────────────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOADS_ROOT, "avatars");
    _ensureDir(dir);
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase() || ".jpg";
    const name = `avatar_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
  fileFilter(req, file, cb) {
    if (["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formats acceptés : JPG, PNG, WEBP."));
    }
  },
}).single("avatar");

// ── Stockage Document ─────────────────────────────────────────────────────────
const documentStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOADS_ROOT, "documents");
    _ensureDir(dir);
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase() || ".jpg";
    const type = (req.body.type || "doc").replace(/[^a-z0-9]/gi, "_");
    const name = `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
  fileFilter(req, file, cb) {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formats acceptés : JPG, PNG, PDF."));
    }
  },
}).single("document");

// ── Helper : résoudre l'URL publique d'un fichier uploadé ────────────────────
function fileUrl(req, relPath) {
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/uploads/${relPath.replace(/\\/g, "/")}`;
}

module.exports = { uploadPmt, uploadSignature, uploadAvatar, uploadDocument, fileUrl };
