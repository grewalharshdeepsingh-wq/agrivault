module.exports = (req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: 'ONLINE',
    app: 'AgriVault Standalone Serverless API',
    timestamp: new Date().toISOString()
  }));
};
