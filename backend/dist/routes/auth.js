"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const db_js_1 = require("../database/db.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'agrivault-secure-jwt-key-928374';
// POST /api/auth/login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
    }
    const user = db_js_1.db.get('SELECT * FROM users WHERE email = ?', email.toLowerCase().trim());
    if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
    }
    const isMatch = bcryptjs_1.default.compareSync(password, user.password_hash);
    if (!isMatch) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, orgId: user.organization_id }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({
        token,
        user: safeUser
    });
});
// POST /api/auth/register
router.post('/register', (req, res) => {
    const { name, email, password, organizationName } = req.body;
    if (!name || !email || !password) {
        res.status(400).json({ error: 'Name, email, and password are required' });
        return;
    }
    const existing = db_js_1.db.get('SELECT id FROM users WHERE email = ?', email.toLowerCase().trim());
    if (existing) {
        res.status(409).json({ error: 'Account with this email already exists' });
        return;
    }
    const now = new Date().toISOString();
    let orgId = 'org-agrivault-01';
    if (organizationName) {
        orgId = `org-${(0, uuid_1.v4)().slice(0, 8)}`;
        db_js_1.db.run('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)', orgId, organizationName, now);
    }
    const userId = `usr-${(0, uuid_1.v4)().slice(0, 8)}`;
    const passwordHash = bcryptjs_1.default.hashSync(password, 10);
    const role = 'Owner'; // First registered user is facility Owner
    db_js_1.db.run('INSERT INTO users (id, organization_id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', userId, orgId, name, email.toLowerCase().trim(), passwordHash, role, now, now);
    const token = jsonwebtoken_1.default.sign({ id: userId, email: email.toLowerCase().trim(), role, orgId }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
        token,
        user: { id: userId, organization_id: orgId, name, email, role, created_at: now }
    });
});
// GET /api/auth/me
router.get('/me', authMiddleware_js_1.authenticate, (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    const org = db_js_1.db.get('SELECT * FROM organizations WHERE id = ?', req.user.organization_id);
    res.json({
        user: req.user,
        organization: org
    });
});
exports.default = router;
