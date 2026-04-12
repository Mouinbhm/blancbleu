/**
 * BlancBleu — Middleware de pagination
 *
 * Ajoute à req : { page, limit, skip }
 * Le contrôleur utilise ces valeurs pour Mongoose .skip().limit()
 * Et appelle res.paginate(data, total) pour formater la réponse.
 *
 * Usage dans une route :
 *   router.get("/", protect, paginate(), getInterventions)
 *
 * Usage dans un contrôleur :
 *   const { skip, limit } = req.pagination;
 *   const [items, total] = await Promise.all([
 *     Model.find(filter).skip(skip).limit(limit),
 *     Model.countDocuments(filter),
 *   ]);
 *   return res.paginate(items, total);
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function paginate(opts = {}) {
  const defaultLimit = opts.defaultLimit || DEFAULT_LIMIT;

  return (req, res, next) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit) || defaultLimit),
    );
    const skip = (page - 1) * limit;

    // Injecter dans req pour le contrôleur
    req.pagination = { page, limit, skip };

    // Helper de réponse paginée
    res.paginate = (data, total) => {
      const pages = Math.ceil(total / limit);
      return res.json({
        data,
        pagination: {
          total,
          page,
          limit,
          pages,
          hasNextPage: page < pages,
          hasPrevPage: page > 1,
        },
      });
    };

    next();
  };
}

module.exports = paginate;
