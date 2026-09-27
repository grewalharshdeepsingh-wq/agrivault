// AgriVault Serverless & Standalone Universal Entrypoint
let app;
let bootError = null;

try {
  const mod = require('./dist/index.js');
  app = mod.app || mod.default || mod;
} catch (err) {
  bootError = err;
  console.error('[AgriVault Boot Error]', err);
  try {
    const express = require('express');
    app = express();
    app.all('*', (req, res) => {
      res.status(500).json({
        error: 'AgriVault Backend Module Boot Error',
        message: bootError ? bootError.message : 'Unknown boot failure',
        stack: bootError ? bootError.stack : null,
        name: bootError ? bootError.name : null,
        nodeVersion: process.version,
        env: {
          VERCEL: process.env.VERCEL,
          VERCEL_ENV: process.env.VERCEL_ENV,
          VERCEL_REGION: process.env.VERCEL_REGION
        }
      });
    });
  } catch (expressErr) {
    // Ultimate fallback handler if even express fails to load
    app = (req, res) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Fatal Boot Failure',
        bootError: bootError ? bootError.message : null,
        expressError: expressErr.message
      }));
    };
  }
}

module.exports = app;
module.exports.default = app;
