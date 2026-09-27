// Main Serverless Gateway for AgriVault Express Backend
let app = null;
let loadError = null;

try {
  app = require('../backend/index.js');
  if (app && app.default) {
    app = app.default;
  }
} catch (err) {
  loadError = err;
}

module.exports = (req, res) => {
  if (loadError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'API Gateway Module Load Error',
      message: loadError.message,
      stack: loadError.stack,
      cwd: process.cwd(),
      dirname: __dirname,
      nodeVersion: process.version
    }, null, 2));
    return;
  }

  if (typeof app === 'function') {
    return app(req, res);
  }

  if (app && typeof app.handle === 'function') {
    return app.handle(req, res);
  }

  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    error: 'App Handler Invalid',
    appType: typeof app,
    appKeys: app ? Object.keys(app) : null
  }, null, 2));
};
