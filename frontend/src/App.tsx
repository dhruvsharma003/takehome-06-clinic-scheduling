import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SlotsPage from './pages/SlotsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import AppointmentDetailPage from './pages/AppointmentDetailPage';
import AlertsPage from './pages/AlertsPage';
import NewSlotPage from './pages/NewSlotPage';
import BulkGeneratePage from './pages/BulkGeneratePage';

function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isFD = user?.role === 'front_desk';

  return (
    <header className="bg-blue-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">🏥 Clinic Scheduler</span>
        </div>
        <nav className="flex items-center gap-1">
          <NavLink to="/dashboard" className={({ isActive }) => `px-3 py-1.5 rounded text-sm font-medium transition-colors ${isActive ? 'bg-blue-900' : 'hover:bg-blue-600'}`}>Dashboard</NavLink>
          <NavLink to="/appointments" className={({ isActive }) => `px-3 py-1.5 rounded text-sm font-medium transition-colors ${isActive ? 'bg-blue-900' : 'hover:bg-blue-600'}`}>Appointments</NavLink>
          <NavLink to="/slots" className={({ isActive }) => `px-3 py-1.5 rounded text-sm font-medium transition-colors ${isActive ? 'bg-blue-900' : 'hover:bg-blue-600'}`}>Slots</NavLink>
          {isFD && <NavLink to="/alerts" className={({ isActive }) => `px-3 py-1.5 rounded text-sm font-medium transition-colors ${isActive ? 'bg-blue-900' : 'hover:bg-blue-600'}`}>⚠ Alerts</NavLink>}
          {isFD && <NavLink to="/bulk-generate" className={({ isActive }) => `px-3 py-1.5 rounded text-sm font-medium transition-colors ${isActive ? 'bg-blue-900' : 'hover:bg-blue-600'}`}>Bulk Generate</NavLink>}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="opacity-80">{user?.name} ({user?.role === 'front_desk' ? 'Front Desk' : 'Provider'})</span>
          <button onClick={() => { logout(); navigate('/login'); }} className="bg-blue-900 hover:bg-blue-800 px-3 py-1 rounded">Logout</button>
        </div>
      </div>
    </header>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedLayout><DashboardPage /></ProtectedLayout>} />
          <Route path="/appointments" element={<ProtectedLayout><AppointmentsPage /></ProtectedLayout>} />
          <Route path="/appointments/:id" element={<ProtectedLayout><AppointmentDetailPage /></ProtectedLayout>} />
          <Route path="/slots" element={<ProtectedLayout><SlotsPage /></ProtectedLayout>} />
          <Route path="/slots/new" element={<ProtectedLayout><NewSlotPage /></ProtectedLayout>} />
          <Route path="/alerts" element={<ProtectedLayout><AlertsPage /></ProtectedLayout>} />
          <Route path="/bulk-generate" element={<ProtectedLayout><BulkGeneratePage /></ProtectedLayout>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
