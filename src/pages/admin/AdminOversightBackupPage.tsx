import React, { useEffect, useState } from 'react';
import { Download, History, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCsv, isDemoProfile, supabase } from '../../lib/supabase';

export const AdminOversightBackupPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [integrity, setIntegrity] = useState<{ missingRoll: number; unenrolled: number; unassignedDept: number }>({ missingRoll: 0, unenrolled: 0, unassignedDept: 0 });
  const [logs, setLogs] = useState<Array<{ id: string; time: string; text: string }>>(
    demo ? [{ id: 'l1', time: '19 Nov, 10:15 AM', text: 'Demo audit log entry.' }] : []
  );

  useEffect(() => {
    if (demo) return;
    supabase.from('v_student_directory').select('roll_no, department_name, class_name').eq('status', 'approved').then(({ data }) => {
      if (data) {
        setIntegrity({
          missingRoll: data.filter((r: any) => !r.roll_no).length,
          unenrolled: data.filter((r: any) => !r.class_name).length,
          unassignedDept: data.filter((r: any) => !r.department_name).length,
        });
      }
    });
    supabase.from('audit_logs').select('id, action, table_name, reason, created_at').order('created_at', { ascending: false }).limit(10).then(({ data }) => {
      if (data) setLogs(data.map((d: any) => ({ id: d.id, time: new Date(d.created_at).toLocaleString(), text: `${d.action} on ${d.table_name}${d.reason ? ` (${d.reason})` : ''}` })));
    });
  }, [demo]);

  const handleExportStudents = async () => {
    if (demo) {
      exportToCsv('demo-students-export.csv', ['Name', 'Email', 'Role'], [['Aarav Sharma', 'aarav@college.edu', 'student']]);
      return;
    }
    const { data } = await supabase.from('v_student_directory').select('roll_no, full_name, email, department_name, class_name, section_code, semester_label, status').eq('status', 'approved').order('roll_no');
    exportToCsv('college-students-export.csv', ['Roll No', 'Name', 'Email', 'Department', 'Class', 'Section', 'Semester'], (data || []).map((s: any) => [s.roll_no || '', s.full_name, s.email, s.department_name || '', s.class_name || '', s.section_code || '', s.semester_label || '']));
  };

  return (
    <div className="erp-content">
      <div className="page-header"><div><h1 className="page-title">Oversight, Audit History & Exports</h1><p className="page-sub">Review activity logs, data health checks, and download student rosters.</p></div></div>
      <div className="grid-2">
        <div className="card">
          <h2 style={{ fontSize: 16.5, margin: '0 0 8px' }}>Student Directory CSV Export</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 0 }}>Download the approved student directory as a spreadsheet (CSV).</p>
          <button className="btn btn-primary" onClick={handleExportStudents}><Download size={15} /> Download Student CSV</button>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 16.5, margin: '0 0 10px' }}>Data Integrity Monitor</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
            <div>Approved students missing Roll No: <span className={`badge ${integrity.missingRoll > 0 ? 'badge-warn' : 'badge-success'}`}>{integrity.missingRoll}</span></div>
            <div>Approved students not enrolled in a Class/Section: <span className={`badge ${integrity.unenrolled > 0 ? 'badge-warn' : 'badge-success'}`}>{integrity.unenrolled}</span></div>
            <div>Approved students without Department: <span className={`badge ${integrity.unassignedDept > 0 ? 'badge-warn' : 'badge-success'}`}>{integrity.unassignedDept}</span></div>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 16.5, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}><History size={17} /> Recent Audit History</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logs.length === 0 ? <div>No audit history recorded yet.</div> : logs.map((l) => <div key={l.id}><strong>{l.time}</strong> — {l.text}</div>)}
          </div>
        </div>
    </div>
  );
};
