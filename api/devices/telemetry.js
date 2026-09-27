// Direct Native Serverless Function for ESP Telemetry Ingest
let app = null;
let loadError = null;

try {
  const mod = require('../../backend/index.js');
  app = mod.app || mod.default || mod;
} catch (err) {
  loadError = err;
  console.error('[Telemetry Gateway Error]', err);
}

module.exports = (req, res) => {
  if (loadError || !app) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Backend Module Load Error',
      message: loadError ? loadError.message : 'App not initialized',
      stack: loadError ? loadError.stack : null
    }));
    return;
  }

  // Forward to Express application
  app(req, res);
};
