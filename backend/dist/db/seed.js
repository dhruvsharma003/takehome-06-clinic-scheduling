"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("./database"));
console.log('Seeding database...');
// Clear existing data
database_1.default.exec(`
  DELETE FROM audit_log;
  DELETE FROM alerts;
  DELETE FROM visit_notes;
  DELETE FROM care_team;
  DELETE FROM appointments;
  DELETE FROM slots;
  DELETE FROM users;
`);
// Users
const frontDeskId = (0, uuid_1.v4)();
const fd2Id = (0, uuid_1.v4)();
const provider1Id = (0, uuid_1.v4)();
const provider2Id = (0, uuid_1.v4)();
const provider3Id = (0, uuid_1.v4)();
const hash = (pw) => bcryptjs_1.default.hashSync(pw, 10);
database_1.default.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(frontDeskId, 'frontdesk@clinic.com', hash('frontdesk123'), 'Alex Johnson', 'front_desk');
database_1.default.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(fd2Id, 'frontdesk2@clinic.com', hash('frontdesk123'), 'Sam Rivera', 'front_desk');
database_1.default.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(provider1Id, 'dr.chen@clinic.com', hash('provider123'), 'Dr. Lisa Chen', 'provider');
database_1.default.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(provider2Id, 'dr.patel@clinic.com', hash('provider123'), 'Dr. Raj Patel', 'provider');
database_1.default.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(provider3Id, 'dr.morgan@clinic.com', hash('provider123'), 'Dr. Taylor Morgan', 'provider');
// Helper to get date offset from today
function dateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}
// Create slots across multiple days
const slotData = [
    // Today
    { providerId: provider1Id, date: dateOffset(0), time: '09:00', duration: 30 },
    { providerId: provider1Id, date: dateOffset(0), time: '09:30', duration: 30 },
    { providerId: provider1Id, date: dateOffset(0), time: '10:00', duration: 45 },
    { providerId: provider1Id, date: dateOffset(0), time: '11:00', duration: 30 },
    { providerId: provider1Id, date: dateOffset(0), time: '14:00', duration: 60 },
    { providerId: provider2Id, date: dateOffset(0), time: '08:30', duration: 30 },
    { providerId: provider2Id, date: dateOffset(0), time: '09:00', duration: 30 },
    { providerId: provider2Id, date: dateOffset(0), time: '10:00', duration: 45 },
    { providerId: provider2Id, date: dateOffset(0), time: '13:00', duration: 30 },
    { providerId: provider3Id, date: dateOffset(0), time: '09:00', duration: 30 },
    { providerId: provider3Id, date: dateOffset(0), time: '11:00', duration: 60 },
    // Tomorrow
    { providerId: provider1Id, date: dateOffset(1), time: '09:00', duration: 30 },
    { providerId: provider1Id, date: dateOffset(1), time: '10:00', duration: 30 },
    { providerId: provider1Id, date: dateOffset(1), time: '11:00', duration: 45 },
    { providerId: provider2Id, date: dateOffset(1), time: '09:00', duration: 30 },
    { providerId: provider2Id, date: dateOffset(1), time: '14:00', duration: 30 },
    { providerId: provider3Id, date: dateOffset(1), time: '10:00', duration: 45 },
    // Day after tomorrow
    { providerId: provider1Id, date: dateOffset(2), time: '09:00', duration: 30 },
    { providerId: provider2Id, date: dateOffset(2), time: '10:00', duration: 30 },
    // Next week
    { providerId: provider1Id, date: dateOffset(7), time: '09:00', duration: 30 },
    { providerId: provider1Id, date: dateOffset(7), time: '10:00', duration: 30 },
    { providerId: provider2Id, date: dateOffset(7), time: '09:00', duration: 45 },
    // Past dates for history
    { providerId: provider1Id, date: dateOffset(-7), time: '09:00', duration: 30 },
    { providerId: provider1Id, date: dateOffset(-7), time: '10:00', duration: 30 },
    { providerId: provider1Id, date: dateOffset(-7), time: '11:00', duration: 45 },
    { providerId: provider2Id, date: dateOffset(-7), time: '09:00', duration: 30 },
    { providerId: provider2Id, date: dateOffset(-7), time: '10:00', duration: 30 },
    { providerId: provider3Id, date: dateOffset(-7), time: '09:00', duration: 30 },
    { providerId: provider3Id, date: dateOffset(-7), time: '14:00', duration: 60 },
    { providerId: provider1Id, date: dateOffset(-14), time: '09:00', duration: 30 },
    { providerId: provider1Id, date: dateOffset(-14), time: '10:00', duration: 30 },
    { providerId: provider2Id, date: dateOffset(-14), time: '09:00', duration: 30 },
    { providerId: provider2Id, date: dateOffset(-14), time: '11:00', duration: 45 },
    { providerId: provider3Id, date: dateOffset(-14), time: '10:00', duration: 30 },
    { providerId: provider1Id, date: dateOffset(-21), time: '09:00', duration: 30 },
    { providerId: provider2Id, date: dateOffset(-21), time: '09:00', duration: 30 },
    { providerId: provider3Id, date: dateOffset(-21), time: '10:00', duration: 30 },
];
const slotIds = [];
for (const s of slotData) {
    const id = (0, uuid_1.v4)();
    slotIds.push(id);
    database_1.default.prepare('INSERT INTO slots (id, provider_id, date, start_time, duration_minutes, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(id, s.providerId, s.date, s.time, s.duration, frontDeskId);
}
// Helper to create appointment with full audit trail
function createAppointment(slotId, patientName, email, phone, finalStatus, cancellationReason) {
    const id = (0, uuid_1.v4)();
    database_1.default.prepare('INSERT INTO appointments (id, slot_id, patient_name, patient_email, patient_phone, status) VALUES (?, ?, ?, ?, ?, ?)').run(id, slotId, patientName, email, phone, 'requested');
    database_1.default.prepare('INSERT INTO audit_log (id, appointment_id, event_type, actor_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)').run((0, uuid_1.v4)(), id, 'status_change', frontDeskId, null, 'requested');
    if (finalStatus === 'requested')
        return id;
    // Progress through states
    if (['confirmed', 'checked_in', 'completed', 'no_show', 'cancelled'].includes(finalStatus)) {
        database_1.default.prepare("UPDATE appointments SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?").run(id);
        database_1.default.prepare('INSERT INTO audit_log (id, appointment_id, event_type, actor_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)').run((0, uuid_1.v4)(), id, 'status_change', frontDeskId, 'requested', 'confirmed');
    }
    if (finalStatus === 'cancelled') {
        database_1.default.prepare("UPDATE appointments SET status = 'cancelled', cancellation_reason = ?, updated_at = datetime('now') WHERE id = ?").run(cancellationReason || 'Patient request', id);
        database_1.default.prepare('INSERT INTO audit_log (id, appointment_id, event_type, actor_id, old_value, new_value, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)').run((0, uuid_1.v4)(), id, 'status_change', frontDeskId, 'confirmed', 'cancelled', JSON.stringify({ reason: cancellationReason || 'Patient request' }));
        return id;
    }
    if (['checked_in', 'completed', 'no_show'].includes(finalStatus)) {
        database_1.default.prepare("UPDATE appointments SET status = 'checked_in', updated_at = datetime('now') WHERE id = ?").run(id);
        database_1.default.prepare('INSERT INTO audit_log (id, appointment_id, event_type, actor_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)').run((0, uuid_1.v4)(), id, 'status_change', frontDeskId, 'confirmed', 'checked_in');
    }
    if (finalStatus === 'no_show') {
        database_1.default.prepare("UPDATE appointments SET status = 'no_show', updated_at = datetime('now') WHERE id = ?").run(id);
        database_1.default.prepare('INSERT INTO audit_log (id, appointment_id, event_type, actor_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)').run((0, uuid_1.v4)(), id, 'status_change', frontDeskId, 'checked_in', 'no_show');
    }
    if (finalStatus === 'completed') {
        database_1.default.prepare("UPDATE appointments SET status = 'completed', updated_at = datetime('now') WHERE id = ?").run(id);
        database_1.default.prepare('INSERT INTO audit_log (id, appointment_id, event_type, actor_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)').run((0, uuid_1.v4)(), id, 'status_change', frontDeskId, 'checked_in', 'completed');
    }
    return id;
}
// --- Today's appointments ---
// Slot indices 0-10 are today
const todayAppointments = [
    { slot: slotIds[0], name: 'Emma Wilson', email: 'emma.w@email.com', phone: '555-0101', status: 'completed' },
    { slot: slotIds[1], name: 'James Martinez', email: 'james.m@email.com', phone: '555-0102', status: 'checked_in' },
    { slot: slotIds[2], name: 'Sarah Thompson', email: 'sarah.t@email.com', phone: '555-0103', status: 'confirmed' },
    { slot: slotIds[3], name: 'Michael Brown', email: 'michael.b@email.com', phone: '555-0104', status: 'requested' },
    { slot: slotIds[5], name: 'Linda Davis', email: 'linda.d@email.com', phone: '555-0106', status: 'checked_in' },
    { slot: slotIds[6], name: 'Robert Garcia', email: 'robert.g@email.com', phone: '555-0107', status: 'confirmed' },
    { slot: slotIds[7], name: 'Patricia Lee', email: 'patricia.l@email.com', phone: '555-0108', status: 'requested' },
    { slot: slotIds[9], name: 'David Wilson', email: 'david.w@email.com', phone: '555-0110', status: 'confirmed' },
];
const todayApptIds = [];
for (const a of todayAppointments) {
    const apptId = createAppointment(a.slot, a.name, a.email, a.phone, a.status);
    todayApptIds.push(apptId);
}
// Add visit notes to completed appointment
database_1.default.prepare('INSERT INTO visit_notes (id, appointment_id, provider_id, content) VALUES (?, ?, ?, ?)').run((0, uuid_1.v4)(), todayApptIds[0], provider1Id, 'Patient presented with right shoulder pain. ROM limited to 120 degrees abduction. Prescribed stretching exercises and heat therapy. Follow-up in 2 weeks.');
database_1.default.prepare('INSERT INTO audit_log (id, appointment_id, event_type, actor_id, new_value) VALUES (?, ?, ?, ?, ?)').run((0, uuid_1.v4)(), todayApptIds[0], 'visit_note_added', provider1Id, 'Patient presented with right shoulder pain...');
// Add care team member to one of today's appointments
database_1.default.prepare('INSERT INTO care_team (appointment_id, provider_id, added_by) VALUES (?, ?, ?)').run(todayApptIds[2], provider2Id, frontDeskId);
database_1.default.prepare('INSERT INTO audit_log (id, appointment_id, event_type, actor_id, new_value) VALUES (?, ?, ?, ?, ?)').run((0, uuid_1.v4)(), todayApptIds[2], 'care_team_added', frontDeskId, provider2Id);
// --- Tomorrow's appointments ---
const tomorrowApptIds = [];
const tomorrowAppointments = [
    { slot: slotIds[11], name: 'Jennifer Anderson', email: 'jennifer.a@email.com', phone: '555-0201', status: 'confirmed' },
    { slot: slotIds[12], name: 'Charles Jackson', email: 'charles.j@email.com', phone: '555-0202', status: 'requested' },
    { slot: slotIds[13], name: 'Susan White', email: 'susan.w@email.com', phone: '555-0203', status: 'confirmed' },
    { slot: slotIds[14], name: 'Joseph Harris', email: 'joseph.h@email.com', phone: '555-0204', status: 'requested' },
    { slot: slotIds[15], name: 'Thomas Clark', email: 'thomas.c@email.com', phone: '555-0205', status: 'confirmed' },
];
for (const a of tomorrowAppointments) {
    tomorrowApptIds.push(createAppointment(a.slot, a.name, a.email, a.phone, a.status));
}
// --- Past week historical data (for no-show trend) ---
const pastWeekAppts = [
    { slot: slotIds[22], name: 'Nancy Lewis', status: 'completed' },
    { slot: slotIds[23], name: 'Paul Walker', status: 'no_show' },
    { slot: slotIds[24], name: 'Karen Hall', status: 'completed' },
    { slot: slotIds[25], name: 'Daniel Young', status: 'completed' },
    { slot: slotIds[26], name: 'Betty Allen', status: 'no_show' },
    { slot: slotIds[27], name: 'Gary King', status: 'completed' },
    { slot: slotIds[28], name: 'Helen Wright', status: 'cancelled' },
];
for (const a of pastWeekAppts) {
    createAppointment(a.slot, a.name, `${a.name.toLowerCase().replace(' ', '.')}@email.com`, '555-0300', a.status, 'Schedule conflict');
}
// --- 2 weeks ago ---
const twoWeeksAppts = [
    { slot: slotIds[29], name: 'Frank Scott', status: 'completed' },
    { slot: slotIds[30], name: 'Dorothy Green', status: 'no_show' },
    { slot: slotIds[31], name: 'Raymond Baker', status: 'completed' },
    { slot: slotIds[32], name: 'Ruth Adams', status: 'completed' },
    { slot: slotIds[33], name: 'Carl Nelson', status: 'cancelled' },
];
for (const a of twoWeeksAppts) {
    createAppointment(a.slot, a.name, `${a.name.toLowerCase().replace(' ', '.')}@email.com`, '555-0400', a.status);
}
// --- 3 weeks ago ---
const threeWeeksAppts = [
    { slot: slotIds[34], name: 'Evelyn Carter', status: 'completed' },
    { slot: slotIds[35], name: 'Roy Mitchell', status: 'no_show' },
    { slot: slotIds[36], name: 'Irene Perez', status: 'completed' },
];
for (const a of threeWeeksAppts) {
    createAppointment(a.slot, a.name, `${a.name.toLowerCase().replace(' ', '.')}@email.com`, '555-0500', a.status);
}
// Alert setup: add alerts for 'requested' appointments that are within 24h
// The API will dynamically calculate these, but let's ensure they get their alert records
console.log('✅ Database seeded successfully!');
console.log('');
console.log('Demo credentials:');
console.log('  Front-desk: frontdesk@clinic.com / frontdesk123');
console.log('  Front-desk: frontdesk2@clinic.com / frontdesk123');
console.log('  Provider:   dr.chen@clinic.com / provider123');
console.log('  Provider:   dr.patel@clinic.com / provider123');
console.log('  Provider:   dr.morgan@clinic.com / provider123');
