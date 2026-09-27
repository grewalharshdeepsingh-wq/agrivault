export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: 'ONLINE',
    location: 'frontend/api/ping.js (ESM)',
    timestamp: new Date().toISOString()
  }));
}
