import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';
import { format } from 'date-fns';

interface Slot {
  id: string;
  provider_id: string;
  provider_name: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  archived: number;
  appointment_id: string | null;
  patient_name: string | null;
  status: string | null;
}

interface Provider { id: string; name: string; }

export default function SlotsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isFD = user?.role === 'front_desk';

  const [slots, setSlots] = useState<Slot[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterProvider, setFilterProvider] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [editData, setEditData] = useState({ date: '', start_time: '', duration_minutes: '' });
  const [editError, setEditError] = useState('');

  const load = useCallback(() => {
    const params: Record<string, string> = {};
    if (filterDate) params.date = filterDate;
    if (filterProvider) params.provider_id = filterProvider;
    if (includeArchived) params.include_archived = 'true';
    api.get('/slots', { params }).then(r => setSlots(r.data));
  }, [filterDate, filterProvider, includeArchived]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (isFD) api.get('/users/providers').then(r => setProviders(r.data));
  }, [isFD]);

  const archive = async (id: string) => {
    await api.post(`/slots/${id}/archive`);
    load();
  };

  const restore = async (id: string) => {
    await api.post(`/slots/${id}/restore`);
    load();
  };

  const saveEdit = async () => {
    if (!editingSlot) return;
    setEditError('');
    try {
      await api.put(`/slots/${editingSlot.id}`, {
        date: editData.date || undefined,
        start_time: editData.start_time || undefined,
        duration_minutes: editData.duration_minutes ? parseInt(editData.duration_minutes) : undefined,
      });
      setEditingSlot(null);
      load();
    } catch (e: any) {
      setEditError(e.response?.data?.error || 'Failed to update slot');
    }
  };

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (filterDate) params.set('date', filterDate);
    if (filterProvider) params.set('provider_id', filterProvider);
    const token = localStorage.getItem('token');
    fetch(`/api/appointments/export/day-csv?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `schedule-${filterDate}.csv`;
        a.click(); URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Appointment Slots</h1>
        <div className="flex gap-2">
          {isFD && (
            <button onClick={exportCsv} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
              Export CSV
            </button>
          )}
          <Link to="/slots/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + New Slot
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        {isFD && (
          <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)}
            className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">All Providers</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} className="rounded" />
          Show archived
        </label>
      </div>

      {/* Slot cards */}
      {slots.length === 0 && <div className="text-gray-400 p-8 text-center bg-white rounded-xl border">No slots for selected filters</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {slots.map(slot => (
          <div key={slot.id} className={`bg-white rounded-xl border p-4 ${slot.archived ? 'opacity-60 border-dashed' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium text-gray-800">{format(new Date(slot.date + 'T00:00:00'), 'EEE, MMM d')}</div>
                <div className="text-sm text-gray-500">{slot.start_time} · {slot.duration_minutes}min</div>
                {isFD && <div className="text-xs text-gray-400 mt-0.5">{slot.provider_name}</div>}
              </div>
              {slot.archived && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Archived</span>}
              {!slot.archived && !slot.appointment_id && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Open</span>}
            </div>
            {slot.appointment_id && (
              <div className="text-sm mb-2">
                <span className="text-gray-600">{slot.patient_name}</span>
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{slot.status}</span>
                <button onClick={() => navigate(`/appointments/${slot.appointment_id}`)}
                  className="ml-2 text-xs text-blue-500 hover:underline">View →</button>
              </div>
            )}
            <div className="text-xs text-gray-300 mb-2 truncate">{slot.id}</div>
            <div className="flex gap-2 flex-wrap">
              {!slot.appointment_id && !slot.archived && (
                <button onClick={() => { setEditingSlot(slot); setEditData({ date: slot.date, start_time: slot.start_time, duration_minutes: String(slot.duration_minutes) }); }}
                  className="text-xs text-blue-600 hover:underline">Edit</button>
              )}
              {!slot.archived ? (
                <button onClick={() => archive(slot.id)} className="text-xs text-gray-400 hover:text-red-500">Archive</button>
              ) : (
                <button onClick={() => restore(slot.id)} className="text-xs text-gray-400 hover:text-green-600">Restore</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-4">Edit Slot</h2>
            {editError && <div className="text-red-600 text-sm mb-3 bg-red-50 p-2 rounded">{editError}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Date</label>
                <input type="date" value={editData.date} onChange={e => setEditData(p => ({ ...p, date: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Start Time</label>
                <input type="time" value={editData.start_time} onChange={e => setEditData(p => ({ ...p, start_time: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Duration (minutes)</label>
                <input type="number" value={editData.duration_minutes} onChange={e => setEditData(p => ({ ...p, duration_minutes: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveEdit} className="flex-1 bg-blue-600 text-white py-2 rounded text-sm">Save</button>
              <button onClick={() => setEditingSlot(null)} className="flex-1 bg-gray-100 py-2 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
