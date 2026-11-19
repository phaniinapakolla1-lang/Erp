import React, { useState } from 'react';
import { Database, Lock, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getBackupConfig, isSupabaseConfigured } from '../../lib/supabase';
import { SupabaseSetupModal } from '../../components/SupabaseSetupModal';

export const CalendarPage: React.FC = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [events, setEvents] = useState([
    { id: 'e1', date: '2026-11-18', title: 'DBMS Assignment 01 Deadline', type: 'Deadline (Auto)', scope: 'MCA · Sec A' },
    { id: 'e2', date: '2026-11-22', title: 'OS Process Scheduling Lab Deadline', type: 'Deadline (Auto)', scope: 'B.Tech CSE · Sec B' },
    { id: 'e3', date: '2026-11-25', title: 'Annual Tech Symposium', type: 'College Event', scope: 'All Departments' },
  ]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('2026-11-28');
  const [type, setType] = useState('College Event');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !title.trim()) return;
    setEvents([...events, { id: String(Date.now()), date, title, type, scope: 'All Departments' }]);
    setTitle('');
  };

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shared Academic Calendar</h1>
          <p className="page-sub">
            {isAdmin
              ? 'Admin control: create or remove institutional events and holidays across all portals.'
              : 'Shared institutional calendar (Read-only — only Admin can modify calendar events).'}
          </p>
        </div>
        {!isAdmin && <span className="badge"><Lock size={13} /> Read-Only View</span>}
      </div>

      {isAdmin && (
        <form onSubmit={handleAdd} className="card" style={{ marginBottom: 18, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Event / Holiday Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Winter Break / Internal Exam" required /></div>
          <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Type</label><select value={type} onChange={(e) => setType(e.target.value)}><option>College Event</option><option>Holiday</option></select></div>
          <button type="submit" className="btn btn-primary"><Plus size={15} /> Add Event</button>
        </form>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="erp-table">
          <thead><tr><th>Date</th><th>Event</th><th>Type</th><th>Scope</th>{isAdmin && <th>Action</th>}</tr></thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td className="mono">{ev.date}</td>
                <td style={{ fontWeight: 600 }}>{ev.title}</td>
                <td><span className={`badge ${ev.type.includes('Deadline') ? 'badge-warn' : 'badge-primary'}`}>{ev.type}</span></td>
                <td>{ev.scope}</td>
                {isAdmin && (
                  <td>
                    {!ev.type.includes('Auto') && (
                      <button className="btn btn-danger" style={{ padding: '4px 10px' }} onClick={() => setEvents(events.filter((x) => x.id !== ev.id))}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const NotificationsPage: React.FC = () => (
  <div className="erp-content">
    <div className="page-header"><div><h1 className="page-title">Notifications &amp; Task Alerts</h1><p className="page-sub">Actionable academic reminders.</p></div></div>
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}><strong>Attendance Pending</strong> — MCA Section A Slot 1 requires marking today.</div>
      <div style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}><strong>Drive Link Submitted</strong> — Aarav Sharma submitted DBMS Assignment 01 via Google Drive.</div>
      <div><strong>Backup Completed</strong> — Nightly student directory snapshot synced to Google Sheets.</div>
    </div>
  </div>
);

export const SettingsPage: React.FC = () => {
  const { theme, toggleTheme, profile } = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  const isAdmin = profile?.role === 'admin';
  const backupCfg = getBackupConfig();

  return (
    <div className="erp-content">
      {showSetup && isAdmin && <SupabaseSetupModal onClose={() => setShowSetup(false)} />}
      <div className="page-header">
        <div>
          <h1 className="page-title">Account &amp; System Settings</h1>
          <p className="page-sub">Appearance preferences and Admin-only database &amp; backup connections.</p>
        </div>
      </div>
      <div className="grid-2" style={{ maxWidth: 880 }}>
        <div className="card">
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Appearance</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Signed in as <strong>{profile?.full_name}</strong> ({profile?.email})</p>
          <button className="btn btn-primary" onClick={toggleTheme}>Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode</button>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Supabase &amp; Backup Connections</h2>
          {isAdmin ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span className={`badge ${isSupabaseConfigured ? 'badge-success' : 'badge-warn'}`}>
                  Primary DB: {isSupabaseConfigured ? 'Connected' : 'Not Connected'}
                </span>
                <span className={`badge ${backupCfg.backupUrl || backupCfg.sheetId ? 'badge-success' : ''}`}>
                  Backup Target: {backupCfg.backupUrl || backupCfg.sheetId ? 'Configured' : 'Not Set'}
                </span>
              </div>
              <button className="btn btn-primary" onClick={() => setShowSetup(true)}>
                <Database size={15} /> Manage Primary &amp; Backup Connections
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13.5 }}>
              <Lock size={15} /> Database &amp; backup connections are restricted to Admin only.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
