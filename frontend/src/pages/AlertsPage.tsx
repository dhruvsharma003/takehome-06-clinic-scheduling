import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { format } from 'date-fns';

interface Alert {
  id: string;
  patient_name: string;
  date: string;
  start_time: string;
  provider_name: string;
  status: string;
  slot_datetime: string;
  within_one_hour: boolean;
}

interface AlertsResponse {
  count: number;
  alerts: Alert[];
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/alerts').then(r => setData(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const dismiss = async (appointmentId: string) => {
    await api.post(`/alerts/${appointmentId}/dismiss`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Unconfirmed Alerts</h1>
        {data && (
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${data.count > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {data.count}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500">
        Appointments still in <strong>Requested</strong> status within 24 hours of their scheduled time.
        Dismissed alerts reappear if the appointment is still unconfirmed within 1 hour.
      </p>

      {loading && <div className="text-gray-400 p-4">Loading…</div>}

      {data?.alerts.length === 0 && !loading && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-6 rounded-xl text-center">
          ✓ No unconfirmed alerts right now
        </div>
      )}

      <div className="space-y-3">
        {data?.alerts.map(alert => (
          <div key={alert.id}
            className={`bg-white rounded-xl border p-4 flex items-start justify-between gap-4 ${alert.within_one_hour ? 'border-red-300 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-800">{alert.patient_name}</span>
                {alert.within_one_hour && (
                  <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-medium">⚠ Within 1 hour!</span>
                )}
              </div>
              <div className="text-sm text-gray-600">
                {format(new Date(alert.date + 'T00:00:00'), 'EEEE, MMMM d')} at {alert.start_time}
              </div>
              <div className="text-sm text-gray-500">Provider: {alert.provider_name}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate(`/appointments/${alert.id}`)}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">View</button>
              {!alert.within_one_hour && (
                <button onClick={() => dismiss(alert.id)}
                  className="text-sm bg-gray-100 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-200">Dismiss</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
