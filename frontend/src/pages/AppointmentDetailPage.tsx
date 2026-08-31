import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';
import { format } from 'date-fns';

interface AppointmentDetail {
  id: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  status: string;
  cancellation_reason: string | null;
  date: string;
  start_time: string;
  duration_minutes: number;
  provider_id: string;
  provider_name: string;
  care_team: Array<{ provider_id: string; provider_name: string; added_at: string }>;
  visit_notes: Array<{ id: string; content: string; author_name: string; created_at: string; updated_at: string; provider_id: string }>;
  timeline: Array<{ id: string; event_type: string; actor_name: string; old_value: string | null; new_value: string | null; metadata: string | null; created_at: string }>;
}

interface Provider { id: string; name: string; }

const STATUS_BADGE: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  checked_in: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  no_show: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const VALID_NEXT: Record<string, string[]> = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'no_show', 'cancelled'],
  checked_in: ['completed'],
  completed: [],
  no_show: [],
  cancelled: [],
};

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isFD = user?.role === 'front_desk';

  const [appt, setAppt] = useState<AppointmentDetail | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState('');

  // Status change
  const [newStatus, setNewStatus] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [statusError, setStatusError] = useState('');

  // Visit note
  const [noteContent, setNoteContent] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [noteError, setNoteError] = useState('');

  // Care team
  const [addingProvider, setAddingProvider] = useState('');
  const [careTeamError, setCareTeamError] = useState('');

  // Reassign
  const [reassignProvider, setReassignProvider] = useState('');
  const [reassignError, setReassignError] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    api.get(`/appointments/${id}`)
      .then(r => setAppt(r.data))
      .catch(() => setError('Appointment not found'));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/users/providers').then(r => setProviders(r.data));
  }, []);

  const changeStatus = async () => {
    if (!newStatus) return;
    setStatusError('');
    try {
      await api.patch(`/appointments/${id}/status`, {
        status: newStatus,
        cancellation_reason: cancelReason || undefined,
      });
      setNewStatus(''); setCancelReason('');
      load();
    } catch (e: any) {
      setStatusError(e.response?.data?.error || 'Failed to update status');
    }
  };

  const addNote = async () => {
    if (!noteContent.trim()) return;
    setNoteError('');
    try {
      await api.post(`/visit-notes/${id}`, { content: noteContent });
      setNoteContent('');
      load();
    } catch (e: any) {
      setNoteError(e.response?.data?.error || 'Failed to add note');
    }
  };

  const saveEdit = async (noteId: string) => {
    try {
      await api.patch(`/visit-notes/${id}/${noteId}`, { content: editContent });
      setEditingNote(null);
      load();
    } catch (e: any) {
      setNoteError(e.response?.data?.error || 'Failed to update note');
    }
  };

  const addCareTeamProvider = async () => {
    if (!addingProvider) return;
    setCareTeamError('');
    try {
      await api.post(`/appointments/${id}/care-team`, { provider_id: addingProvider });
      setAddingProvider('');
      load();
    } catch (e: any) {
      setCareTeamError(e.response?.data?.error || 'Failed to add provider');
    }
  };

  const removeCareTeamProvider = async (providerId: string) => {
    try {
      await api.delete(`/appointments/${id}/care-team/${providerId}`);
      load();
    } catch (e: any) {
      setCareTeamError(e.response?.data?.error || 'Failed to remove provider');
    }
  };

  const reassign = async () => {
    if (!reassignProvider) return;
    setReassignError('');
    try {
      await api.patch(`/appointments/${id}/reassign`, { new_provider_id: reassignProvider });
      setReassignProvider('');
      load();
    } catch (e: any) {
      setReassignError(e.response?.data?.error || 'Failed to reassign');
    }
  };

  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!appt) return <div className="text-gray-400 p-4">Loading…</div>;

  const nextStates = VALID_NEXT[appt.status] || [];
  const isProvider = user?.role === 'provider';
  const isOnCareTeam = appt.care_team.some(ct => ct.provider_id === user?.id);
  const canAddNote = isProvider && (appt.provider_id === user?.id || isOnCareTeam);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">← Back</button>
        <h1 className="text-2xl font-bold text-gray-800">Appointment</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BADGE[appt.status]}`}>
          {appt.status.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-700 mb-3">Appointment Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="Patient" value={appt.patient_name} />
              <InfoRow label="Email" value={appt.patient_email || '—'} />
              <InfoRow label="Phone" value={appt.patient_phone || '—'} />
              <InfoRow label="Provider" value={appt.provider_name} />
              <InfoRow label="Date" value={format(new Date(appt.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')} />
              <InfoRow label="Time" value={`${appt.start_time} (${appt.duration_minutes} min)`} />
              {appt.cancellation_reason && <InfoRow label="Cancellation Reason" value={appt.cancellation_reason} />}
            </div>
          </div>

          {/* Status change */}
          {nextStates.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Update Status</h2>
              {statusError && <div className="text-red-600 text-sm mb-2 bg-red-50 p-2 rounded">{statusError}</div>}
              <div className="flex flex-wrap gap-2 mb-2">
                {nextStates.map(s => (
                  <button key={s} onClick={() => setNewStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${newStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:border-blue-300 hover:text-blue-600'}`}>
                    → {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
              {newStatus === 'cancelled' && (
                <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Cancellation reason (required)"
                  className="w-full border rounded px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              )}
              {newStatus && (
                <button onClick={changeStatus} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium">
                  Confirm: Set to "{newStatus.replace('_', ' ')}"
                </button>
              )}
            </div>
          )}

          {/* Visit Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-700 mb-3">Visit Notes</h2>
            {noteError && <div className="text-red-600 text-sm mb-2 bg-red-50 p-2 rounded">{noteError}</div>}
            {appt.visit_notes.length === 0 && <p className="text-gray-400 text-sm">No notes yet.</p>}
            {appt.visit_notes.map(note => (
              <div key={note.id} className="border-l-2 border-blue-200 pl-3 mb-3">
                {editingNote === note.id ? (
                  <div>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => saveEdit(note.id)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded">Save</button>
                      <button onClick={() => setEditingNote(null)} className="text-sm text-gray-500 px-3 py-1">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                      <span>{note.author_name}</span>
                      <span>·</span>
                      <span>{format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}</span>
                      {note.provider_id === user?.id && (
                        <button onClick={() => { setEditingNote(note.id); setEditContent(note.content); }}
                          className="text-blue-500 hover:underline">Edit</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {canAddNote && (
              <div className="mt-3">
                <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)}
                  placeholder="Add a visit note…" rows={3}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button onClick={addNote} className="mt-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm">
                  Add Note
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Care Team */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-700 mb-3">Care Team</h2>
            {careTeamError && <div className="text-red-600 text-sm mb-2">{careTeamError}</div>}
            {appt.care_team.length === 0 && <p className="text-gray-400 text-sm">No supporting providers</p>}
            {appt.care_team.map(ct => (
              <div key={ct.provider_id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-gray-700">{ct.provider_name}</span>
                {(isFD || appt.provider_id === user?.id) && (
                  <button onClick={() => removeCareTeamProvider(ct.provider_id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                )}
              </div>
            ))}
            {(isFD || appt.provider_id === user?.id) && (
              <div className="mt-2 flex gap-2">
                <select value={addingProvider} onChange={e => setAddingProvider(e.target.value)}
                  className="flex-1 border rounded px-2 py-1.5 text-sm focus:outline-none">
                  <option value="">Add provider…</option>
                  {providers.filter(p => p.id !== appt.provider_id && !appt.care_team.some(ct => ct.provider_id === p.id)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button onClick={addCareTeamProvider} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Add</button>
              </div>
            )}
          </div>

          {/* Reassign — front-desk only */}
          {isFD && !['completed', 'cancelled', 'no_show'].includes(appt.status) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Reassign Provider</h2>
              {reassignError && <div className="text-red-600 text-sm mb-2">{reassignError}</div>}
              <div className="flex gap-2">
                <select value={reassignProvider} onChange={e => setReassignProvider(e.target.value)}
                  className="flex-1 border rounded px-2 py-1.5 text-sm focus:outline-none">
                  <option value="">Select provider…</option>
                  {providers.filter(p => p.id !== appt.provider_id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button onClick={reassign} className="bg-orange-500 text-white px-3 py-1.5 rounded text-sm">Reassign</button>
              </div>
            </div>
          )}

          {/* Audit Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-700 mb-3">History</h2>
            <div className="space-y-2">
              {appt.timeline.map(event => (
                <div key={event.id} className="text-xs border-l-2 border-gray-200 pl-3 py-1">
                  <div className="font-medium text-gray-700">
                    {formatEventType(event.event_type, event.old_value, event.new_value)}
                  </div>
                  <div className="text-gray-400">{event.actor_name} · {format(new Date(event.created_at), 'MMM d, h:mm a')}</div>
                  {event.metadata && (() => {
                    try {
                      const meta = JSON.parse(event.metadata);
                      if (meta.reason) return <div className="text-gray-500 italic">"{meta.reason}"</div>;
                    } catch {}
                    return null;
                  })()}
                </div>
              ))}
              {appt.timeline.length === 0 && <p className="text-gray-400 text-sm">No history</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-400 text-xs">{label}</div>
      <div className="text-gray-800 font-medium">{value}</div>
    </div>
  );
}

function formatEventType(type: string, oldVal: string | null, newVal: string | null): string {
  switch (type) {
    case 'status_change':
      if (!oldVal) return `Appointment requested`;
      return `Status: ${oldVal.replace('_', ' ')} → ${(newVal || '').replace('_', ' ')}`;
    case 'care_team_added':
      return `Supporting provider added`;
    case 'care_team_removed':
      return `Supporting provider removed`;
    case 'reassigned':
      return `Reassigned to different provider`;
    case 'visit_note_added':
      return `Visit note added`;
    case 'visit_note_edited':
      return `Visit note edited`;
    default:
      return type.replace('_', ' ');
  }
}
