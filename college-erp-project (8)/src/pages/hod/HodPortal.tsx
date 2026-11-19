import React from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Users } from 'lucide-react';

export const HodDashboard: React.FC = () => (
  <div className="erp-content">
    <div className="page-header"><div><h1 className="page-title">HOD Department Dashboard</h1><p className="page-sub">Department of Computer Science · Faculty, attendance, and grading oversight.</p></div></div>
    <div className="grid-4" style={{ marginBottom: 22 }}>
      <div className="kpi-card"><div><div className="kpi-val">14</div><div className="kpi-lbl">Dept Faculty</div><div className="kpi-sub">All active</div></div><div className="kpi-icon"><Users size={20} /></div></div>
      <div className="kpi-card"><div><div className="kpi-val">6</div><div className="kpi-lbl">Active Classes</div><div className="kpi-sub">342 students</div></div><div className="kpi-icon"><BookOpen size={20} /></div></div>
      <div className="kpi-card"><div><div className="kpi-val">1</div><div className="kpi-lbl">Missing Attendance Today</div><div className="kpi-sub" style={{ color: 'var(--danger)' }}>MCA · Sec B</div></div><div className="kpi-icon"><AlertTriangle size={20} /></div></div>
      <div className="kpi-card"><div><div className="kpi-val">78%</div><div className="kpi-lbl">Evaluations Completed</div><div className="kpi-sub">Across 9 assignments</div></div><div className="kpi-icon"><CheckCircle2 size={20} /></div></div>
    </div>
  </div>
);

export const HodOversightPage: React.FC = () => (
  <div className="erp-content">
    <div className="page-header"><div><h1 className="page-title">H03 &amp; H04 · Department Oversight</h1><p className="page-sub">Monitor daily attendance completion and assignment evaluation progress.</p></div></div>
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="erp-table">
        <thead><tr><th>Class</th><th>Subject</th><th>Faculty</th><th>Attendance Today</th><th>Assignment Grading</th></tr></thead>
        <tbody>
          <tr><td style={{ fontWeight: 600 }}>MCA · Sec A</td><td>DBMS</td><td>Dr. Ananya Rao</td><td><span className="badge badge-success">Recorded</span></td><td>14 / 48 graded</td></tr>
          <tr><td style={{ fontWeight: 600 }}>MCA · Sec B</td><td>Operating Systems</td><td>Prof. Kiran Das</td><td><span className="badge badge-danger">Missing Today</span></td><td>32 / 50 graded</td></tr>
        </tbody>
      </table>
    </div>
  </div>
);
