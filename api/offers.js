const { byId, filterOffers, serializeOffer, send } = require('./_core');
module.exports = (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error:'method_not_allowed' });
  if (req.query.id) {
    const offer = byId.get(String(req.query.id));
    return offer ? send(res, 200, serializeOffer(offer)) : send(res, 404, { error:'offer_not_found' });
  }
  const all = filterOffers(req.query || {});
  const offset = Math.max(0, Number(req.query.offset || 0));
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 50)));
  return send(res, 200, { total:all.length, offset, limit, offers:all.slice(offset, offset + limit).map((offer) => serializeOffer(offer)) });
};
