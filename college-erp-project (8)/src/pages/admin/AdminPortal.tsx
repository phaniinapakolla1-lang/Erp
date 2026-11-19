import React, { useState } from 'react';
import { CheckSquare, Plus, RefreshCw, ShieldAlert, UserCheck, Users } from 'lucide-react';

export const AdminDashboard: React.FC = () => (
  <div className="erp-content">
    <div className="page-header">
      <div><h1 className="page-title">Admin Institutional Dashboard</h1><p className="page-sub">Admin creates subjects, assigns classes to faculty, manages the timetable, and controls the shared calendar.</p></div>
    </div>
    <div className="grid-4" style={{ marginBottom: 22 }}>
      <div className="kpi-card"><div><div className="kpi-val">640</div><div className="kpi-lbl">Enrolled Students</div><div className="kpi-sub">Across 4 departments</div></div><div className="kpi-icon"><Users size={20} /></div></div>
      <div className="kpi-card"><div><div className="kpi-val">42</div><div className="kpi-lbl">Active Faculty</div><div className="kpi-sub">Assigned by Admin</div></div><div className="kpi-icon"><UserCheck size={20} /></div></div>
      <div className="kpi-card"><div><div className="kpi-val">12</div><div className="kpi-lbl">Pending Approvals</div><div className="kpi-sub" style={{ color: 'var(--warning)' }}>Awaiting role review</div></div><div className="kpi-icon"><ShieldAlert size={20} /></div></div>
      <div className="kpi-card"><div><div className="kpi-val">94%</div><div className="kpi-lbl">Attendance Marked Today</div><div className="kpi-sub">32 / 34 scheduled slots</div></div><div className="kpi-icon"><CheckSquare size={20} /></div></div>
    </div>
  </div>
);

export const AdminUsersPage: React.FC = () => {
  const [pending, setPending] = useState([
    { id: 'u1', name: 'Riya Patel', email: 'riya.patel@college.edu', requested: 'Student' },
    { id: 'u2', name: 'Dr. Vikram Sen', email: 'vikram.sen@college.edu', requested: 'Faculty' },
  ]);
  return (
    <div className="erp-content">
      <div className="page-header"><div><h1 className="page-title">A02 · User Approvals &amp; Role Assignment</h1><p className="page-sub">Verify institutional identities before granting portal access.</p></div></div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="erp-table">
          <thead><tr><th>Applicant</th><th>College Email</th><th>Assign Role</th><th>Decision</th></tr></thead>
          <tbody>
            {pending.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td className="mono">{u.email}</td>
                <td><select style={{ width: 'auto' }} defaultValue={u.requested}><option>Student</option><option>Faculty</option><option>HOD</option><option>Admin</option></select></td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => setPending((p) => p.filter((x) => x.id !== u.id))}>Approve</button>
                  <button className="btn btn-danger" onClick={() => setPending((p) => p.filter((x) => x.id !== u.id))}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AdminAcademicSetupPage: React.FC = () => {
  const [tab, setTab] = useState<'subjects' | 'faculty_map' | 'timetable' | 'depts' | 'classes' | 'enrollments'>('subjects');

  const [subjects, setSubjects] = useState([
    { id: 's1', code: 'CS501', name: 'Database Management Systems', dept: 'Computer Science', credits: 4 },
    { id: 's2', code: 'CS304', name: 'Operating Systems', dept: 'Computer Science', credits: 4 },
    { id: 's3', code: 'CS502', name: 'Computer Networks', dept: 'Computer Science', credits: 3 },
  ]);
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');

  const [mappings, setMappings] = useState([
    { id: 'm1', faculty: 'Dr. Ananya Rao', cls: 'MCA Year 1 · Section A', subject: 'CS501 — Database Management Systems' },
    { id: 'm2', faculty: 'Prof. Kiran Das', cls: 'B.Tech CSE Year 2 · Section B', subject: 'CS304 — Operating Systems' },
  ]);
  const [faculty, setFaculty] = useState('Dr. Vikram Sen');
  const [cls, setCls] = useState('MCA Year 1 · Section A');
  const [selectedSubject, setSelectedSubject] = useState('CS501 — Database Management Systems');

  const [timetable, setTimetable] = useState([
    { id: 't1', day: 'Monday', period: 'Period 1 (09:30 – 10:30)', cls: 'MCA Year 1 · Section A', subject: 'CS501 — DBMS', faculty: 'Dr. Ananya Rao', room: 'Lab 302' },
    { id: 't2', day: 'Monday', period: 'Period 3 (11:30 – 12:30)', cls: 'B.Tech CSE Year 2 · Section B', subject: 'CS304 — OS', faculty: 'Prof. Kiran Das', room: 'LH 204' },
  ]);
  const [ttDay, setTtDay] = useState('Tuesday');
  const [ttPeriod, setTtPeriod] = useState('Period 1 (09:30 – 10:30)');
  const [ttRoom, setTtRoom] = useState('LH 105');

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCode.trim() || !subName.trim()) return;
    const next = { id: String(Date.now()), code: subCode.toUpperCase(), name: subName, dept: 'Computer Science', credits: 4 };
    setSubjects([next, ...subjects]);
    setSelectedSubject(`${next.code} — ${next.name}`);
    setSubCode('');
    setSubName('');
  };

  const handleAssignFaculty = (e: React.FormEvent) => {
    e.preventDefault();
    setMappings([{ id: String(Date.now()), faculty, cls, subject: selectedSubject }, ...mappings]);
  };

  const handleAddTimetable = (e: React.FormEvent) => {
    e.preventDefault();
    setTimetable([{ id: String(Date.now()), day: ttDay, period: ttPeriod, cls, subject: selectedSubject, faculty, room: ttRoom }, ...timetable]);
  };

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">A05–A11 · Academic Structure, Subjects &amp; Timetable (Admin Only)</h1>
          <p className="page-sub">Admin creates subjects, assigns them to faculty &amp; classes, and configures the weekly timetable.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'subjects' ? 'btn-primary' : ''}`} onClick={() => setTab('subjects')}>1. Create Subjects (A09)</button>
        <button className={`btn ${tab === 'faculty_map' ? 'btn-primary' : ''}`} onClick={() => setTab('faculty_map')}>2. Assign to Faculty (A10)</button>
        <button className={`btn ${tab === 'timetable' ? 'btn-primary' : ''}`} onClick={() => setTab('timetable')}>3. Timetable Slots</button>
        <button className={`btn ${tab === 'depts' ? 'btn-primary' : ''}`} onClick={() => setTab('depts')}>Departments</button>
        <button className={`btn ${tab === 'classes' ? 'btn-primary' : ''}`} onClick={() => setTab('classes')}>Classes &amp; Sections</button>
        <button className={`btn ${tab === 'enrollments' ? 'btn-primary' : ''}`} onClick={() => setTab('enrollments')}>Enrollments</button>
      </div>

      {tab === 'subjects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form onSubmit={handleAddSubject} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 12, alignItems: 'end' }}>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Subject Code</label><input value={subCode} onChange={(e) => setSubCode(e.target.value)} placeholder="e.g. CS605" required /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Subject Name</label><input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="e.g. Distributed Systems" required /></div>
            <button type="submit" className="btn btn-primary"><Plus size={15} /> Create Subject</button>
          </form>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="erp-table">
              <thead><tr><th>Code</th><th>Subject Name</th><th>Department</th><th>Credits</th></tr></thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}><td className="mono">{s.code}</td><td style={{ fontWeight: 600 }}>{s.name}</td><td>{s.dept}</td><td className="mono">{s.credits}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'faculty_map' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form onSubmit={handleAssignFaculty} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Faculty Member</label>
              <select value={faculty} onChange={(e) => setFaculty(e.target.value)}>
                <option>Dr. Ananya Rao</option><option>Prof. Kiran Das</option><option>Dr. Vikram Sen</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Class &amp; Section</label>
              <select value={cls} onChange={(e) => setCls(e.target.value)}>
                <option>MCA Year 1 · Section A</option><option>MCA Year 1 · Section B</option><option>B.Tech CSE Year 2 · Section B</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Subject</label>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
                {subjects.map((s) => <option key={s.id}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary"><Plus size={15} /> Assign Class</button>
          </form>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="erp-table">
              <thead><tr><th>Assigned Faculty</th><th>Class &amp; Section</th><th>Subject</th></tr></thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id}><td style={{ fontWeight: 600 }}>{m.faculty}</td><td>{m.cls}</td><td>{m.subject}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'timetable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form onSubmit={handleAddTimetable} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Day</label>
              <select value={ttDay} onChange={(e) => setTtDay(e.target.value)}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Period / Time</label>
              <select value={ttPeriod} onChange={(e) => setTtPeriod(e.target.value)}>
                <option>Period 1 (09:30 – 10:30)</option>
                <option>Period 2 (10:30 – 11:30)</option>
                <option>Period 3 (11:30 – 12:30)</option>
                <option>Period 4 (01:30 – 02:30)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Class &amp; Subject</label>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
                {subjects.map((s) => <option key={s.id}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Room</label>
              <input value={ttRoom} onChange={(e) => setTtRoom(e.target.value)} placeholder="Lab 302" />
            </div>
            <button type="submit" className="btn btn-primary"><Plus size={15} /> Add Slot</button>
          </form>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="erp-table">
              <thead><tr><th>Day</th><th>Period / Time</th><th>Class</th><th>Subject</th><th>Faculty</th><th>Room</th></tr></thead>
              <tbody>
                {timetable.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.day}</td>
                    <td className="mono">{t.period}</td>
                    <td>{t.cls}</td>
                    <td>{t.subject}</td>
                    <td>{t.faculty}</td>
                    <td><span className="badge">{t.room}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {['depts', 'classes', 'enrollments'].includes(tab) && (
        <div className="card"><p style={{ margin: 0, color: 'var(--text-muted)' }}>Managing <strong>{tab}</strong> inside the single centralized PostgreSQL schema.</p></div>
      )}
    </div>
  );
};

export const AdminOversightBackupPage: React.FC = () => {
  const [synced, setSynced] = useState('');
  return (
    <div className="erp-content">
      <div className="page-header"><div><h1 className="page-title">A12, A13 &amp; A15 · Oversight &amp; Google Sheets Backup</h1><p className="page-sub">One-way student directory export; Supabase remains the authoritative source.</p></div></div>
      <div className="card">
        <h2 style={{ fontSize: 16.5, margin: '0 0 8px' }}>Student Directory Backup (Supabase → Google Sheets)</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 0 }}>Exports Roll No, Student ID, Name, Email, Mobile, Department, Program, and Class to the college backup Sheet.</p>
        <button className="btn btn-primary" onClick={() => setSynced('Backup pushed to Google Sheets at ' + new Date().toLocaleTimeString())}><RefreshCw size={15} /> Run One-Way Sheets Backup</button>
        {synced && <span className="badge badge-success" style={{ marginLeft: 12 }}>{synced}</span>}
      </div>
    </div>
  );
};
