// AgriVault Universal Serverless Entrypoint & Diagnostics
const diagnosticInfo = {
  timestamp: new Date().toISOString(),
  nodeVersion: process.version,
  modules: {}
};

let app = null;

try {
  const express = require('express');
  diagnosticInfo.modules.express = 'OK';
} catch (e) {
  diagnosticInfo.modules.express = 'FAILED: ' + (e ? e.message : String(e));
}

try {
  const sql = require('sql.js');
  diagnosticInfo.modules.sqlJs = 'OK';
} catch (e) {
  diagnosticInfo.modules.sqlJs = 'FAILED: ' + (e ? e.message : String(e));
}

try {
  const dist = require('./dist/index.js');
  app = dist.app || dist.default || dist;
  diagnosticInfo.modules.distIndex = 'OK';
} catch (e) {
  diagnosticInfo.modules.distIndex = 'FAILED: ' + (e ? (e.stack || e.message) : String(e));
}

const serverlessHandler = (req, res) => {
  // If request is explicitly asking for module diagnostics
  if (req.url && req.url.includes('/api/diagnostics')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'DIAGNOSTICS',
      hasApp: Boolean(app),
      diagnosticInfo
    }, null, 2));
    return;
  }

  // If app is fully operational, forward request to Express
  if (app && typeof app === 'function') {
    return app(req, res);
  }

  // Fallback diagnostic response if app failed to load
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    error: 'AgriVault Backend Cold Start Diagnostic Failure',
    hasApp: false,
    diagnosticInfo
  }, null, 2));
};

if (app && typeof app === 'object') {
  Object.assign(serverlessHandler, app);
}

module.exports = serverlessHandler;
module.exports.default = serverlessHandler;
