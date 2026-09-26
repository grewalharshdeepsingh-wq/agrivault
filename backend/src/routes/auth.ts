import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { User } from '../models/types.js';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'agrivault-secure-jwt-key-928374';

// POST /api/auth/login
router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = db.get<any>('SELECT * FROM users WHERE email = ?', email.toLowerCase().trim());
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, orgId: user.organization_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const { password_hash, ...safeUser } = user;
  res.json({
    token,
    user: safeUser
  });
});

// POST /api/auth/register
router.post('/register', (req: Request, res: Response): void => {
  const { name, email, password, organizationName } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  const existing = db.get('SELECT id FROM users WHERE email = ?', email.toLowerCase().trim());
  if (existing) {
    res.status(409).json({ error: 'Account with this email already exists' });
    return;
  }

  const now = new Date().toISOString();
  let orgId = 'org-agrivault-01';

  if (organizationName) {
    orgId = `org-${uuidv4().slice(0, 8)}`;
    db.run('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)', orgId, organizationName, now);
  }

  const userId = `usr-${uuidv4().slice(0, 8)}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  const role = 'Owner'; // First registered user is facility Owner

  db.run(
    'INSERT INTO users (id, organization_id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    userId, orgId, name, email.toLowerCase().trim(), passwordHash, role, now, now
  );

  const token = jwt.sign(
    { id: userId, email: email.toLowerCase().trim(), role, orgId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    token,
    user: { id: userId, organization_id: orgId, name, email, role, created_at: now }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const org = db.get('SELECT * FROM organizations WHERE id = ?', req.user.organization_id);
  res.json({
    user: req.user,
    organization: org
  });
});

export default router;
