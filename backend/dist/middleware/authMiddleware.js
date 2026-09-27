"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorizeRole = authorizeRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = require("../database/db.js");
const JWT_SECRET = process.env.JWT_SECRET || 'agrivault-secure-jwt-key-928374';
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication token required' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = db_js_1.db.get('SELECT id, organization_id, name, email, role, created_at, updated_at FROM users WHERE id = ?', decoded.id);
        if (!user) {
            res.status(401).json({ error: 'User account not found' });
            return;
        }
        req.user = user;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
}
function authorizeRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                error: `Insufficient permissions. Required one of: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`
            });
            return;
        }
        next();
    };
}
