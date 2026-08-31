"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../db/database"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
    }
    const user = database_1.default.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }
    const valid = bcryptjs_1.default.compareSync(password, user.password_hash);
    if (!valid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }
    const token = (0, auth_1.signToken)({ id: user.id, email: user.email, role: user.role, name: user.name });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});
router.post('/register', (req, res) => {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name || !role) {
        res.status(400).json({ error: 'email, password, name, role are required' });
        return;
    }
    if (!['front_desk', 'provider'].includes(role)) {
        res.status(400).json({ error: 'Role must be front_desk or provider' });
        return;
    }
    const existing = database_1.default.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
        res.status(409).json({ error: 'Email already in use' });
        return;
    }
    const id = (0, uuid_1.v4)();
    const hash = bcryptjs_1.default.hashSync(password, 10);
    database_1.default.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(id, email, hash, name, role);
    const token = (0, auth_1.signToken)({ id, email, role: role, name });
    res.status(201).json({ token, user: { id, email, role, name } });
});
exports.default = router;
