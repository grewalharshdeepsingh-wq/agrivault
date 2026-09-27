// Main Serverless Gateway for AgriVault Express Backend
const app = require('../backend/index.js');

module.exports = (req, res) => {
  if (typeof app === 'function') {
    return app(req, res);
  }
  if (app && typeof app.handle === 'function') {
    return app.handle(req, res);
  }
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Failed to initialize app', appType: typeof app }));
};
