import { useEffect, useState } from 'react';
import api from '../api';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

interface DashboardData {
  appointments_today: number;
  checked_in_now: number;
  no_shows_this_week: number;
  confirmed_upcoming: number;
  by_provider: Array<{ provider_id: string; provider_name: string; total: number; confirmed: number; completed: number; no_show: number; cancelled: number; requested: number }>;
  by_status: Array<{ status: string; count: number }>;
  no_show_trend: Array<{ week_start: string; total: number; no_show: number; rate: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  requested: '#f59e0b',
  confirmed: '#3b82f6',
  checked_in: '#8b5cf6',
  completed: '#10b981',
  no_show: '#ef4444',
  cancelled: '#6b7280',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load dashboard data'));
  }, []);

  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!data) return <div className="text-gray-400 p-4">Loading dashboard…</div>;

  const statusData = data.by_status.map(s => ({
    name: s.status.replace('_', ' '),
    count: s.count,
    fill: STATUS_COLORS[s.status] || '#999',
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Appointments Today" value={data.appointments_today} color="blue" />
        <StatCard label="Checked In Now" value={data.checked_in_now} color="purple" />
        <StatCard label="No-Shows This Week" value={data.no_shows_this_week} color="red" />
        <StatCard label="Confirmed Upcoming" value={data.confirmed_upcoming} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Appointments by Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* No-show trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">No-Show Rate (last 8 weeks)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.no_show_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week_start" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" />
              <Tooltip formatter={(v: any) => `${v}%`} />
              <Legend />
              <Line type="monotone" dataKey="rate" stroke="#ef4444" name="No-show %" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* By Provider */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Appointments by Provider</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-4 text-gray-500 font-medium">Provider</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Total</th>
                <th className="text-right py-2 px-3 text-yellow-600 font-medium">Requested</th>
                <th className="text-right py-2 px-3 text-blue-600 font-medium">Confirmed</th>
                <th className="text-right py-2 px-3 text-purple-600 font-medium">Checked In</th>
                <th className="text-right py-2 px-3 text-green-600 font-medium">Completed</th>
                <th className="text-right py-2 px-3 text-red-600 font-medium">No-Show</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {data.by_provider.map(p => (
                <tr key={p.provider_id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{p.provider_name}</td>
                  <td className="text-right py-2 px-3">{p.total || 0}</td>
                  <td className="text-right py-2 px-3 text-yellow-600">{p.requested || 0}</td>
                  <td className="text-right py-2 px-3 text-blue-600">{p.confirmed || 0}</td>
                  <td className="text-right py-2 px-3 text-purple-600">{(p as any).checked_in || 0}</td>
                  <td className="text-right py-2 px-3 text-green-600">{p.completed || 0}</td>
                  <td className="text-right py-2 px-3 text-red-600">{p.no_show || 0}</td>
                  <td className="text-right py-2 px-3 text-gray-500">{p.cancelled || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
    red: 'bg-red-50 border-red-100 text-red-700',
    green: 'bg-green-50 border-green-100 text-green-700',
  };
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1 opacity-70">{label}</div>
    </div>
  );
}
