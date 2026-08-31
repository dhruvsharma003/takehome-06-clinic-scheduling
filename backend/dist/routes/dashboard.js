"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../db/database"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/dashboard — summary stats
router.get('/', auth_1.authenticate, (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    // Appointments today
    const appointmentsToday = database_1.default.prepare(`
    SELECT COUNT(*) as cnt FROM appointments a JOIN slots s ON a.slot_id = s.id
    WHERE s.date = ? AND a.status NOT IN ('cancelled')
  `).get(today).cnt;
    // Currently checked in
    const checkedInNow = database_1.default.prepare(`
    SELECT COUNT(*) as cnt FROM appointments WHERE status = 'checked_in'
  `).get().cnt;
    // No-shows this week (Mon–Sun)
    const weekStart = getWeekStart(new Date());
    const noShowsThisWeek = database_1.default.prepare(`
    SELECT COUNT(*) as cnt FROM appointments a JOIN slots s ON a.slot_id = s.id
    WHERE a.status = 'no_show' AND s.date >= ? AND s.date <= ?
  `).get(weekStart, today).cnt;
    // Confirmed upcoming
    const confirmedUpcoming = database_1.default.prepare(`
    SELECT COUNT(*) as cnt FROM appointments a JOIN slots s ON a.slot_id = s.id
    WHERE a.status = 'confirmed' AND s.date >= ?
  `).get(today).cnt;
    // By provider
    const byProvider = database_1.default.prepare(`
    SELECT u.name as provider_name, u.id as provider_id,
           COUNT(a.id) as total,
           SUM(CASE WHEN a.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
           SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) as no_show,
           SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
           SUM(CASE WHEN a.status = 'requested' THEN 1 ELSE 0 END) as requested
    FROM users u
    LEFT JOIN slots s ON s.provider_id = u.id
    LEFT JOIN appointments a ON a.slot_id = s.id
    WHERE u.role = 'provider'
    GROUP BY u.id, u.name
    ORDER BY u.name
  `).all();
    // By status
    const byStatus = database_1.default.prepare(`
    SELECT status, COUNT(*) as count FROM appointments GROUP BY status
  `).all();
    // No-show rate per week for last 8 weeks
    const weeksData = [];
    for (let i = 7; i >= 0; i--) {
        const ws = getWeekStart(new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000));
        const we = getWeekEnd(ws);
        const row = database_1.default.prepare(`
      SELECT
        COUNT(CASE WHEN a.status IN ('completed', 'no_show') THEN 1 END) as total,
        COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) as no_show
      FROM appointments a JOIN slots s ON a.slot_id = s.id
      WHERE s.date >= ? AND s.date <= ?
    `).get(ws, we);
        weeksData.push({
            week_start: ws,
            total: row.total,
            no_show: row.no_show,
            rate: row.total > 0 ? Math.round((row.no_show / row.total) * 100) : 0,
        });
    }
    res.json({
        appointments_today: appointmentsToday,
        checked_in_now: checkedInNow,
        no_shows_this_week: noShowsThisWeek,
        confirmed_upcoming: confirmedUpcoming,
        by_provider: byProvider,
        by_status: byStatus,
        no_show_trend: weeksData,
    });
});
function getWeekStart(d) {
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d);
    mon.setUTCDate(diff);
    return mon.toISOString().slice(0, 10);
}
function getWeekEnd(weekStart) {
    const d = new Date(weekStart + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
}
exports.default = router;
