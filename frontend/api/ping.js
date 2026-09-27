module.exports = (req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: 'ONLINE',
    location: 'frontend/api/ping.js',
    timestamp: new Date().toISOString()
  }));
};
