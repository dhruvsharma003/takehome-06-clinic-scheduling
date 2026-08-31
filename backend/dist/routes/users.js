"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../db/database"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/users/providers — list all providers (both roles can call this)
router.get('/providers', auth_1.authenticate, (req, res) => {
    const providers = database_1.default.prepare("SELECT id, name, email FROM users WHERE role = 'provider' ORDER BY name").all();
    res.json(providers);
});
// GET /api/users — front-desk only: list all users
router.get('/', auth_1.authenticate, (0, auth_1.requireRole)('front_desk'), (req, res) => {
    const users = database_1.default.prepare("SELECT id, name, email, role FROM users ORDER BY name").all();
    res.json(users);
});
exports.default = router;
