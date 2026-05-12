const jwt       = require("jsonwebtoken");
const Personnel = require("../models/Personnel");

const requirePersonnel = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token)
    return res.status(401).json({ message: "Non autorisé — token manquant" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "personnel")
      return res.status(403).json({ message: "Token non valide pour cette ressource" });

    const personnel = await Personnel.findById(decoded.id);
    if (!personnel || !personnel.actif)
      return res.status(401).json({ message: "Compte inactif ou introuvable" });

    req.personnel = personnel;
    next();
  } catch {
    return res.status(401).json({ message: "Token invalide ou expiré" });
  }
};

module.exports = requirePersonnel;
