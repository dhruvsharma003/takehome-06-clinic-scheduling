import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';
import { format } from 'date-fns';

interface Appointment {
  id: string;
  patient_name: string;
  patient_email: string;
  status: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  provider_name: string;
  provider_id: string;
}

interface AppointmentListResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  appointments: Appointment[];
}

interface Provider {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  checked_in: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  no_show: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

export default function AppointmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<AppointmentListResponse | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAppt, setNewAppt] = useState({ patient_name: '', patient_email: '', patient_phone: '', slot_id: '' });
  const [showBook, setShowBook] = useState(false);
  const [bookError, setBookError] = useState('');

  const page = parseInt(searchParams.get('page') || '1');
  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const provider_id = searchParams.get('provider_id') || '';
  const date_from = searchParams.get('date_from') || '';
  const date_to = searchParams.get('date_to') || '';
  const sort = searchParams.get('sort') || 'date_asc';

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), sort };
    if (q) params.q = q;
    if (status) params.status = status;
    if (provider_id) params.provider_id = provider_id;
    if (date_from) params.date_from = date_from;
    if (date_to) params.date_to = date_to;
    api.get('/appointments', { params }).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [page, q, status, provider_id, date_from, date_to, sort]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (user?.role === 'front_desk') {
      api.get('/users/providers').then(r => setProviders(r.data));
    }
  }, [user]);

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    p.set('page', '1');
    setSearchParams(p);
  };

  const bookAppointment = async () => {
    setBookError('');
    try {
      await api.post('/appointments', newAppt);
      setShowBook(false);
      setNewAppt({ patient_name: '', patient_email: '', patient_phone: '', slot_id: '' });
      load();
    } catch (e: any) {
      setBookError(e.response?.data?.error || 'Failed to book');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Appointments</h1>
        <button onClick={() => setShowBook(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Book Appointment
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <input value={q} onChange={e => setParam('q', e.target.value)} placeholder="Search patient…"
          className="border border-gray-200 rounded px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <select value={status} onChange={e => setParam('status', e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Statuses</option>
          {['requested','confirmed','checked_in','completed','no_show','cancelled'].map(s => (
            <option key={s} value={s}>{s.replace('_',' ')}</option>
          ))}
        </select>
        {user?.role === 'front_desk' && (
          <select value={provider_id} onChange={e => setParam('provider_id', e.target.value)}
            className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">All Providers</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <input type="date" value={date_from} onChange={e => setParam('date_from', e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <input type="date" value={date_to} onChange={e => setParam('date_to', e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <select value={sort} onChange={e => setParam('sort', e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="date_asc">Date ↑</option>
          <option value="date_desc">Date ↓</option>
          <option value="status_asc">Status A-Z</option>
          <option value="provider_asc">Provider A-Z</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Patient</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Provider</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Date & Time</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.appointments.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/appointments/${a.id}`)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{a.patient_name}</div>
                        {a.patient_email && <div className="text-xs text-gray-400">{a.patient_email}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.provider_name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{format(new Date(a.date + 'T00:00:00'), 'MMM d, yyyy')}</div>
                        <div className="text-xs text-gray-400">{a.start_time} ({a.duration_minutes}min)</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[a.status]}`}>
                          {a.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/appointments/${a.id}`} className="text-blue-500 hover:underline text-xs" onClick={e => e.stopPropagation()}>View →</Link>
                      </td>
                    </tr>
                  ))}
                  {!data?.appointments.length && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No appointments found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {data && data.pages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                <span>{data.total} appointments</span>
                <div className="flex gap-2">
                  {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => { const ps = new URLSearchParams(searchParams); ps.set('page', String(p)); setSearchParams(ps); }}
                      className={`px-3 py-1 rounded ${page === p ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>{p}</button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Book Modal */}
      {showBook && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Book Appointment</h2>
            {bookError && <div className="text-red-600 text-sm mb-3 bg-red-50 p-2 rounded">{bookError}</div>}
            <div className="space-y-3">
              <input placeholder="Slot ID" value={newAppt.slot_id} onChange={e => setNewAppt(p => ({ ...p, slot_id: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" />
              <input placeholder="Patient Name *" value={newAppt.patient_name} onChange={e => setNewAppt(p => ({ ...p, patient_name: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" />
              <input placeholder="Email" value={newAppt.patient_email} onChange={e => setNewAppt(p => ({ ...p, patient_email: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" />
              <input placeholder="Phone" value={newAppt.patient_phone} onChange={e => setNewAppt(p => ({ ...p, patient_phone: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={bookAppointment} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium">Book</button>
              <button onClick={() => setShowBook(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-2 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
