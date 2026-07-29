const { summary, send } = require('./_core');
module.exports = (req, res) => send(res, 200, summary());
