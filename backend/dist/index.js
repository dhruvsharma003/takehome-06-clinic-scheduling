"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
require("./db/database"); // initialize DB
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const slots_1 = __importDefault(require("./routes/slots"));
const appointments_1 = __importDefault(require("./routes/appointments"));
const visitNotes_1 = __importDefault(require("./routes/visitNotes"));
const alerts_1 = __importDefault(require("./routes/alerts"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json());
app.use('/api/auth', auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/slots', slots_1.default);
app.use('/api/appointments', appointments_1.default);
app.use('/api/visit-notes', visitNotes_1.default);
app.use('/api/alerts', alerts_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
// Root catch-all — tells browsers / curl they hit the wrong path
app.use((_req, res) => res.status(404).json({ error: 'Not found. API is at /api/*' }));
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Clinic scheduling API running on port ${PORT}`);
});
exports.default = app;
