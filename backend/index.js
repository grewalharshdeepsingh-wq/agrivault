const { app, server } = require('./dist/index.js');

module.exports = app;
module.exports.default = app;
module.exports.app = app;
module.exports.server = server;
