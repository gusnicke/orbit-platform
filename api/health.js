const { catalog, offers, send } = require('./_core');
module.exports = (req, res) => send(res, 200, { ok:true, service:'student-benefit-navigator', records:offers.length, catalog_generated_on:catalog.metadata?.generated_on || null, timestamp:new Date().toISOString() });
