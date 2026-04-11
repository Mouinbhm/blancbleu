const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");

const noSqlSanitize = mongoSanitize({
  replaceWith: "_",
  onSanitize: ({ req, key }) => {
    console.warn(
      `[SANITIZE] Tentative injection NoSQL détectée — clé: ${key} — IP: ${req.ip}`,
    );
  },
});

const xssSanitize = xss();

module.exports = { noSqlSanitize, xssSanitize };
s;
