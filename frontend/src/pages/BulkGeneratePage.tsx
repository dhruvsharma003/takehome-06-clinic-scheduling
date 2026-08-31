import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

interface Provider { id: string; name: string; }

interface BulkResult {
  created: number;
  skipped: number;
  created_dates: string[];
  skipped_dates: string[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BulkGeneratePage() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [form, setForm] = useState({
    provider_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); })(),
    days_of_week: [1, 2, 3, 4, 5] as number[], // Mon-Fri
    start_time: '09:00',
    duration_minutes: 30,
  });
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/users/providers').then(r => setProviders(r.data));
  }, []);

  const toggleDay = (d: number) => {
    setForm(p => ({
      ...p,
      days_of_week: p.days_of_week.includes(d)
        ? p.days_of_week.filter(x => x !== d)
        : [...p.days_of_week, d].sort(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await api.post('/slots/bulk-generate', form);
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to generate slots');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/slots')} className="text-gray-400 hover:text-gray-600">← Back</button>
        <h1 className="text-2xl font-bold text-gray-800">Bulk Generate Availability</h1>
      </div>
      <p className="text-sm text-gray-500">Generate repeating availability slots for a provider across a date range.</p>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {error && <div className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select value={form.provider_id} onChange={e => setForm(p => ({ ...p, provider_id: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required>
              <option value="">Select provider…</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
            <div className="flex gap-2">
              {DAY_NAMES.map((name, i) => (
                <button type="button" key={i} onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.days_of_week.includes(i) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
              <select value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {[15, 20, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} minutes</option>)}
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Generating…' : 'Generate Slots'}
          </button>
        </form>
      </div>

      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h2 className="font-semibold text-gray-700">Results</h2>
          <div className="flex gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex-1 text-center">
              <div className="text-2xl font-bold text-green-700">{result.created}</div>
              <div className="text-sm text-green-600">Slots created</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex-1 text-center">
              <div className="text-2xl font-bold text-yellow-700">{result.skipped}</div>
              <div className="text-sm text-yellow-600">Slots skipped (collision)</div>
            </div>
          </div>
          {result.skipped_dates.length > 0 && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Skipped dates (already have active bookings):</p>
              <div className="text-xs text-gray-600 flex flex-wrap gap-1">
                {result.skipped_dates.map(d => <span key={d} className="bg-yellow-100 px-2 py-0.5 rounded">{d}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
