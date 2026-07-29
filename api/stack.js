const { bodyObject, buildStack, send } = require('./_core');
module.exports = (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error:'method_not_allowed' });
  const body = bodyObject(req);
  return send(res, 200, buildStack(body.profile || {}, body.use_case || 'web-development', Math.min(25, Math.max(1, Number(body.limit || 10)))));
};
