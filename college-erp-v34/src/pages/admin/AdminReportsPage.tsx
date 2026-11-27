import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, supabase } from '../../lib/supabase';
import { ToastMessage, ToastPopup } from '../../components/ToastPopup';

interface ProblemReportRow {
  id: string;
  reporter_email: string;
  reporter_role: string;
  category: string;
  page_path: string | null;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  admin_response: string | null;
  created_at: string;
}

export const AdminReportsPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [reports, setReports] = useState<ProblemReportRow[]>(
    demo
      ? [
          {
            id: 'rep-1',
            reporter_email: 'student1****@***.com',
            reporter_role: 'student',
            category: 'ui',
            page_path: '/student/assignments',
            subject: 'Drive preview takes time on mobile',
            description: 'Preview iframe loads slowly on mobile data.',
            status: 'open',
            admin_response: null,
            created_at: new Date().toISOString(),
          },
        ]
      : []
  );
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadReports = async () => {
    if (demo) return;
    const { data, error } = await supabase
      .from('problem_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setToast({ type: 'error', text: `Failed to load reports: ${error.message}` });
      return;
    }
    if (data) {
      const rows = data as ProblemReportRow[];
      setReports(rows);
      setResponseDraft(Object.fromEntries(rows.map((r) => [r.id, r.admin_response || ''])));
    }
  };

  useEffect(() => {
    loadReports();
  }, [demo]);

  const handleUpdateStatus = async (id: string, status: 'in_progress' | 'resolved') => {
    const resp = (responseDraft[id] || '').trim() || null;
    if (demo) {
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status, admin_response: resp } : r)));
      setToast({ type: 'success', text: `Report marked as ${status.replace('_', ' ')}.` });
      return;
    }
    const { error } = await supabase
      .from('problem_reports')
      .update({
        status,
        admin_response: resp,
        resolved_by: status === 'resolved' ? profile!.id : null,
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      })
      .eq('id', id);
    if (error) {
      setToast({ type: 'error', text: `Error updating report: ${error.message}` });
    } else {
      setToast({ type: 'success', text: `Report updated to ${status.replace('_', ' ').toUpperCase()}.` });
      await loadReports();
    }
  };

  const openCount = reports.filter((r) => r.status === 'open').length;
  const inProgCount = reports.filter((r) => r.status === 'in_progress').length;
  const resolvedCount = reports.filter((r) => r.status === 'resolved').length;
  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter);

  return (
    <div className="erp-content">
      <ToastPopup toast={toast} onClose={() => setToast(null)} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Problem Reports &amp; Support Inbox</h1>
          <p className="page-sub">Issues reported directly by Students, Faculty, and HODs across the portal.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['all', 'open', 'in_progress', 'resolved'] as const).map((st) => (
            <button key={st} className={`btn ${filter === st ? 'btn-primary' : ''}`} onClick={() => setFilter(st)}>
              {st === 'all' ? `All (${reports.length})` : st === 'in_progress' ? `In Progress (${inProgCount})` : st === 'open' ? `Open (${openCount})` : `Resolved (${resolvedCount})`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="kpi-card"><div><div className="kpi-val">{openCount}</div><div className="kpi-lbl">Open Reports</div><div className="kpi-sub" style={{ color: 'var(--danger)' }}>Needs review</div></div><div className="kpi-icon"><AlertTriangle size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{inProgCount}</div><div className="kpi-lbl">In Progress</div><div className="kpi-sub" style={{ color: 'var(--warning)' }}>Being investigated</div></div><div className="kpi-icon"><Clock size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{resolvedCount}</div><div className="kpi-lbl">Resolved</div><div className="kpi-sub">Completed</div></div><div className="kpi-icon"><CheckCircle2 size={20} /></div></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.length === 0 ? (
          <div className="card" style={{ color: 'var(--text-muted)' }}>No problem reports match this filter.</div>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 16 }}>{r.subject}</strong>
                    <span className="badge badge-primary">{r.category.toUpperCase()}</span>
                    <span className={`badge ${r.status === 'resolved' ? 'badge-success' : r.status === 'in_progress' ? 'badge-warn' : 'badge-danger'}`}>
                      {r.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    Reported by <span className="mono">{r.reporter_email}</span> ({r.reporter_role.toUpperCase()})
                    {r.page_path ? ` · Page: ${r.page_path}` : ''} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <p style={{ margin: '10px 0 12px', fontSize: 14, lineHeight: 1.5 }}>{r.description}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <MessageSquare size={15} color="var(--text-muted)" />
                <input
                  style={{ flex: 1, minWidth: 240 }}
                  value={responseDraft[r.id] ?? ''}
                  onChange={(e) => setResponseDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Write admin resolution note..."
                />
                <button className="btn" onClick={() => handleUpdateStatus(r.id, 'in_progress')}>Mark In Progress</button>
                <button className="btn btn-primary" onClick={() => handleUpdateStatus(r.id, 'resolved')}>Mark Resolved</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
