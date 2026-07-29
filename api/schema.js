const { catalog, useCases, send } = require('./_core');
module.exports = (req, res) => send(res, 200, {
  entity:'student_offer',
  version:'1.0',
  fields:Object.keys(catalog.offers?.[0] || {}).map((name) => ({ name, type:['agent_priority'].includes(name)?'number':'string' })),
  use_cases:Object.entries(useCases).map(([id,value]) => ({ id, label:value.label })),
  statuses:['active','general_free','institution_access','marketplace_snapshot','needs_live_verification','expiring_soon','paused'],
  verification_rule:'Reopen the official source before quoting exact price, deadline, region support, or commercial-use rights.'
});
