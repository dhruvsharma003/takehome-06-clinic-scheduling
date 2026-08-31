import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';

interface Provider { id: string; name: string; }

export default function NewSlotPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isFD = user?.role === 'front_desk';

  const [providers, setProviders] = useState<Provider[]>([]);
  const [form, setForm] = useState({
    provider_id: user?.role === 'provider' ? user.id : '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    duration_minutes: '30',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isFD) api.get('/users/providers').then(r => setProviders(r.data));
  }, [isFD]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/slots', {
        ...form,
        duration_minutes: parseInt(form.duration_minutes),
        provider_id: form.provider_id || user?.id,
      });
      setSuccess(`Slot created for ${form.date} at ${form.start_time}`);
      setTimeout(() => navigate('/slots'), 1200);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create slot');
    }
  };

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/slots')} className="text-gray-400 hover:text-gray-600">← Back</button>
        <h1 className="text-2xl font-bold text-gray-800">New Slot</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {error && <div className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded">{error}</div>}
        {success && <div className="text-green-600 text-sm mb-4 bg-green-50 p-3 rounded">{success}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isFD && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select value={form.provider_id} onChange={e => setForm(p => ({ ...p, provider_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required>
                <option value="">Select provider…</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
            <select value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {[15, 20, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors">
            Create Slot
          </button>
        </form>
      </div>
    </div>
  );
}
