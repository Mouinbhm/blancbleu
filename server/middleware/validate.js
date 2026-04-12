const Joi = require("joi");

/**
 * Middleware de validation générique.
 * Usage : router.post("/", protect, validate(schema), controller)
 *
 * @param {Joi.Schema} schema — schéma Joi à appliquer sur req.body
 * @param {string} source — "body" | "query" | "params" (défaut: "body")
 */
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false, // retourner toutes les erreurs d'un coup
      stripUnknown: true, // supprimer les champs non déclarés dans le schéma
      convert: true, // convertir les types (ex: string → number)
    });

    if (error) {
      const messages = error.details.map((d) => d.message.replace(/"/g, "'"));
      return res.status(400).json({
        message: "Données invalides",
        erreurs: messages,
      });
    }

    // Remplacer req[source] par la valeur sanitisée
    req[source] = value;
    next();
  };
};

module.exports = validate;
