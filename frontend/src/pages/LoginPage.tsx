import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (e: string, p: string) => {
    setEmail(e); setPassword(p);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">🏥 Clinic Scheduler</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to your account</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@clinic.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 border-t pt-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">Demo accounts (click to prefill):</p>
          <div className="space-y-1.5">
            <button onClick={() => quickLogin('frontdesk@clinic.com', 'frontdesk123')}
              className="w-full text-left text-xs bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded border border-gray-200">
              <span className="font-medium text-blue-700">Front Desk</span> — frontdesk@clinic.com / frontdesk123
            </button>
            <button onClick={() => quickLogin('dr.chen@clinic.com', 'provider123')}
              className="w-full text-left text-xs bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded border border-gray-200">
              <span className="font-medium text-green-700">Provider</span> — dr.chen@clinic.com / provider123
            </button>
            <button onClick={() => quickLogin('dr.patel@clinic.com', 'provider123')}
              className="w-full text-left text-xs bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded border border-gray-200">
              <span className="font-medium text-green-700">Provider</span> — dr.patel@clinic.com / provider123
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
