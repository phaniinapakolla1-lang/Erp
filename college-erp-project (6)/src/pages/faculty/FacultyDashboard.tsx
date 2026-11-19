import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, CheckSquare, Clock, FileCheck, Lock, Plus, Search, Unlock, Users } from 'lucide-react';

const CLASSES = [
  { id: 'c1', name: 'MCA Year 1 · Section A', subject: 'Database Management Systems (CS501)', students: 60, attendancePct: 92, room: 'Lab 302' },
  { id: 'c2', name: 'B.Tech CSE Year 2 · Section B', subject: 'Operating Systems (CS304)', students: 64, attendancePct: 89, room: 'LH 204' },
  { id: 'c3', name: 'MCA Year 2 · Section A', subject: 'Cloud Architecture (CS602)', students: 52, attendancePct: 94, room: 'LH 105' },
];

const PERIODS = [
  { id: 'p1', label: 'Period 1 · 09:30 AM – 10:30 AM' },
  { id: 'p2', label: 'Period 2 · 10:30 AM – 11:30 AM' },
  { id: 'p3', label: 'Period 3 · 11:30 AM – 12:30 PM' },
  { id: 'p4', label: 'Period 4 · 01:30 PM – 02:30 PM' },
  { id: 'p5', label: 'Period 5 · 02:30 PM – 03:30 PM' },
  { id: 'p6', label: 'Period 6 · 03:30 PM – 04:30 PM' },
];

type AttStatus = 'present' | 'absent' | 'late';
interface RosterStudent { id: string; roll: string; name: string; status: AttStatus; }

const CLASS_ROSTERS: Record<string, RosterStudent[]> = {
  c1: [
    { id: '1', roll: '101', name: 'Aarav Sharma', status: 'present' },
    { id: '2', roll: '102', name: 'Diya Kulkarni', status: 'present' },
    { id: '3', roll: '103', name: 'Rohan Mehta', status: 'absent' },
    { id: '4', roll: '104', name: 'Sneha Reddy', status: 'late' },
    { id: '5', roll: '105', name: 'Karthik Nair', status: 'present' },
    { id: '6', roll: '106', name: 'Ananya Verma', status: 'present' },
  ],
  c2: [
    { id: '21', roll: '201', name: 'Siddharth Joshi', status: 'present' },
    { id: '22', roll: '202', name: 'Meera Iyer', status: 'present' },
    { id: '23', roll: '203', name: 'Aditya Rao', status: 'present' },
    { id: '24', roll: '204', name: 'Neha Gupta', status: 'absent' },
  ],
  c3: [
    { id: '31', roll: '301', name: 'Vikram Menon', status: 'present' },
    { id: '32', roll: '302', name: 'Pooja Desai', status: 'present' },
    { id: '33', roll: '303', name: 'Rahul Kapoor', status: 'present' },
  ],
};

const STUDENT_SUBMISSION_LIST = [
  { subId: 'sub-101', roll: '101', name: 'Aarav Sharma', submitted: true, late: false, submittedAt: '18 Nov, 10:32 AM', graded: true, marks: '18 / 20' },
  { subId: 'sub-102', roll: '102', name: 'Diya Kulkarni', submitted: true, late: true, submittedAt: '19 Nov, 08:14 AM', graded: false, marks: null },
  { subId: 'sub-103', roll: '103', name: 'Rohan Mehta', submitted: false, late: false, submittedAt: '—', graded: false, marks: null },
  { subId: 'sub-104', roll: '104', name: 'Sneha Reddy', submitted: true, late: false, submittedAt: '18 Nov, 04:15 PM', graded: true, marks: '19 / 20' },
  { subId: 'sub-105', roll: '105', name: 'Karthik Nair', submitted: false, late: false, submittedAt: '—', graded: false, marks: null },
  { subId: 'sub-106', roll: '106', name: 'Ananya Verma', submitted: true, late: false, submittedAt: '18 Nov, 09:05 PM', graded: false, marks: null },
];

export const FacultyDashboard: React.FC = () => (
  <div className="erp-content">
    <div className="page-header">
      <div>
        <h1 className="page-title">Faculty Academic Dashboard</h1>
        <p className="page-sub">Thursday, 19 Nov 2026 · 3 scheduled classes · 2 pending actions</p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Link to="/faculty/assignments" className="btn" style={{ textDecoration: 'none' }}><Plus size={16} /> Assignments &amp; Tracker</Link>
        <Link to="/faculty/attendance" className="btn btn-primary" style={{ textDecoration: 'none' }}><CheckSquare size={16} /> Take Attendance</Link>
      </div>
    </div>

    <div className="grid-4" style={{ marginBottom: 22 }}>
      <div className="kpi-card">
        <div><div className="kpi-val">2</div><div className="kpi-lbl">Attendance Pending Today</div><div className="kpi-sub" style={{ color: 'var(--warning)' }}>Due before 5:00 PM</div></div>
        <div className="kpi-icon"><Clock size={20} /></div>
      </div>
      <div className="kpi-card">
        <div><div className="kpi-val">48 / 60</div><div className="kpi-lbl">Submissions Received</div><div className="kpi-sub">14 evaluated in F07</div></div>
        <div className="kpi-icon"><FileCheck size={20} /></div>
      </div>
      <div className="kpi-card">
        <div><div className="kpi-val">3</div><div className="kpi-lbl">Active Classes</div><div className="kpi-sub">176 total students</div></div>
        <div className="kpi-icon"><BookOpen size={20} /></div>
      </div>
      <div className="kpi-card">
        <div><div className="kpi-val">91.6%</div><div className="kpi-lbl">Avg Class Attendance</div><div className="kpi-sub">+1.8% vs last week</div></div>
        <div className="kpi-icon"><CheckCircle2 size={20} /></div>
      </div>
    </div>

    <div className="grid-2">
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Today's Class Schedule</h2>
          <Link to="/calendar" style={{ fontSize: 12.5, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Full Calendar →</Link>
        </div>
        <table className="erp-table">
          <thead><tr><th>Slot</th><th>Class &amp; Subject</th><th>Room</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            <tr>
              <td className="mono">09:30 AM</td>
              <td><strong>MCA · Sec A</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>DBMS (CS501)</div></td>
              <td>Lab 302</td>
              <td><span className="badge badge-warn">Pending</span></td>
              <td><Link to="/faculty/attendance" className="btn btn-primary" style={{ textDecoration: 'none', padding: '5px 11px' }}>Mark</Link></td>
            </tr>
            <tr>
              <td className="mono">11:30 AM</td>
              <td><strong>B.Tech CSE · Sec B</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Operating Systems</div></td>
              <td>LH 204</td>
              <td><span className="badge badge-success">Recorded</span></td>
              <td><Link to="/faculty/attendance" className="btn" style={{ textDecoration: 'none', padding: '5px 11px' }}>Review</Link></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Evaluation &amp; Submission Queue</h2>
          <span className="badge badge-primary">Active</span>
        </div>
        <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            <span>Database Management Assignment 01</span>
            <span className="mono">48 / 60</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>MCA · Sec A · 34 awaiting F07 review</div>
          <div className="progress-track"><div className="progress-fill" style={{ width: '80%' }} /></div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Link to="/faculty/evaluate" className="btn btn-primary" style={{ textDecoration: 'none' }}><FileCheck size={15} /> Grade in F07</Link>
            <Link to="/faculty/assignments" className="btn" style={{ textDecoration: 'none' }}>Student List</Link>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const FacultyClassesPage: React.FC = () => (
  <div className="erp-content">
    <div className="page-header">
      <div><h1 className="page-title">F03 · My Assigned Classes</h1><p className="page-sub">Classes assigned to you by Admin. Manage attendance and assignments per class.</p></div>
    </div>
    <div className="grid-3">
      {CLASSES.map((c) => (
        <div key={c.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{c.subject}</div>
            </div>
            <span className="badge badge-primary">{c.room}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            <span><Users size={14} style={{ verticalAlign: -2 }} /> {c.students} Students</span>
            <span><CheckCircle2 size={14} style={{ verticalAlign: -2 }} /> {c.attendancePct}% Avg</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${c.attendancePct}%` }} /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Link to="/faculty/attendance" className="btn btn-primary" style={{ textDecoration: 'none', flex: 1 }}>Attendance</Link>
            <Link to="/faculty/assignments" className="btn" style={{ textDecoration: 'none', flex: 1 }}>Assignments</Link>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const FacultyAttendancePage: React.FC = () => {
  const [selectedClass, setSelectedClass] = useState(CLASSES[0].id);
  const [sessionDate, setSessionDate] = useState('2026-11-19');
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[0].id);
  const [sessions, setSessions] = useState<Record<string, { roster: RosterStudent[]; savedAt: string | null }>>({});
  const [query, setQuery] = useState('');

  const sessionKey = `${selectedClass}_${sessionDate}_${selectedPeriod}`;
  const currentSession = sessions[sessionKey] || {
    roster: CLASS_ROSTERS[selectedClass] || CLASS_ROSTERS.c1,
    savedAt: null,
  };
  const students = currentSession.roster;

  const updateRoster = (nextRoster: RosterStudent[], savedAt: string | null = null) => {
    setSessions((prev) => ({
      ...prev,
      [sessionKey]: { roster: nextRoster, savedAt },
    }));
  };

  const filtered = students.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.roll.includes(query));
  const presentCount = students.filter((s) => s.status === 'present').length;
  const absentCount = students.filter((s) => s.status === 'absent').length;
  const lateCount = students.filter((s) => s.status === 'late').length;

  const markAllPresent = () => updateRoster(students.map((s) => ({ ...s, status: 'present' })), null);
  const setStatus = (id: string, status: AttStatus) =>
    updateRoster(students.map((s) => (s.id === id ? { ...s, status } : s)), null);
  const saveSession = () => updateRoster(students, new Date().toLocaleTimeString());

  const activeClassObj = CLASSES.find((c) => c.id === selectedClass) || CLASSES[0];
  const activePeriodObj = PERIODS.find((p) => p.id === selectedPeriod) || PERIODS[0];

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">F04 · Record Class Attendance</h1>
          <p className="page-sub">Select Class, Date, and Period/Time Slot before marking attendance.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={markAllPresent}>Mark All Present</button>
          <button className="btn btn-primary" onClick={saveSession}>Save Attendance Session</button>
        </div>
      </div>

      {/* Class, Date & Period/Time Selector */}
      <div className="card" style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.3fr', gap: 14, alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>1. Class &amp; Subject</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            {CLASSES.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>2. Session Date</label>
          <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>3. Period / Time Slot</label>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
          Active Session: <strong style={{ color: 'var(--text)' }}>{activeClassObj.name}</strong> · {sessionDate} · {activePeriodObj.label}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge badge-success">Present: {presentCount}</span>
          <span className="badge badge-danger">Absent: {absentCount}</span>
          <span className="badge badge-warn">Late: {lateCount}</span>
          {currentSession.savedAt && (
            <span className="badge badge-primary">Saved at {currentSession.savedAt}</span>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={16} color="var(--text-muted)" />
          <input style={{ maxWidth: 340 }} placeholder="Search student by name or roll number..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <table className="erp-table">
          <thead><tr><th>Roll No</th><th>Student Name</th><th>Mark Status</th></tr></thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.roll}</td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['present', 'absent', 'late'] as const).map((st) => (
                      <button
                        key={st}
                        className={`btn ${s.status === st ? 'btn-primary' : ''}`}
                        style={{ padding: '5px 13px' }}
                        onClick={() => setStatus(s.id, st)}
                      >
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const FacultyAssignmentsPage: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [assignments, setAssignments] = useState([
    { id: 'a1', title: 'Database Management Assignment 01', cls: 'MCA · Sec A', due: '18 Nov, 11:59 PM', accepting: true },
    { id: 'a2', title: 'OS Process Scheduling Lab', cls: 'B.Tech CSE · Sec B', due: '22 Nov, 11:59 PM', accepting: true },
  ]);
  const [activeId, setActiveId] = useState('a1');
  const [filter, setFilter] = useState<'all' | 'submitted' | 'not_submitted' | 'graded' | 'not_graded'>('all');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');

  const toggleAccepting = (id: string) => {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, accepting: !a.accepting } : a)));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setAssignments([{ id: String(Date.now()), title, cls: 'MCA · Sec A', due: '28 Nov, 11:59 PM', accepting: true }, ...assignments]);
    setTitle('');
    setShowCreate(false);
  };

  const activeAssignment = assignments.find((a) => a.id === activeId) || assignments[0];

  const filteredStudents = STUDENT_SUBMISSION_LIST.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.roll.includes(search);
    if (!matchesSearch) return false;
    if (filter === 'submitted') return s.submitted;
    if (filter === 'not_submitted') return !s.submitted;
    if (filter === 'graded') return s.graded;
    if (filter === 'not_graded') return s.submitted && !s.graded;
    return true;
  });

  const submittedTotal = STUDENT_SUBMISSION_LIST.filter((s) => s.submitted).length;
  const notSubmittedTotal = STUDENT_SUBMISSION_LIST.length - submittedTotal;
  const gradedTotal = STUDENT_SUBMISSION_LIST.filter((s) => s.graded).length;

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">F05 &amp; F06 · Assignments, Acceptance Control &amp; Student Tracker</h1>
          <p className="page-sub">Toggle whether an assignment is accepting submissions, filter student status, and jump directly into F07 grading.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}><Plus size={16} /> Create Assignment</button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 18, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Assignment Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SQL Indexing & Query Plans" required /></div>
          <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Class</label><select><option>MCA · Sec A</option><option>B.Tech CSE · Sec B</option></select></div>
          <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Max Marks</label><input type="number" defaultValue={20} /></div>
          <button type="submit" className="btn btn-primary">Publish</button>
        </form>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 22 }}>
        <table className="erp-table">
          <thead><tr><th>Assignment</th><th>Class</th><th>Deadline</th><th>Submission Window</th><th>Action</th></tr></thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} style={a.id === activeId ? { background: 'var(--primary-soft)' } : undefined}>
                <td style={{ fontWeight: 600 }}>
                  <button
                    onClick={() => setActiveId(a.id)}
                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', textAlign: 'left' }}
                  >
                    {a.title}
                  </button>
                </td>
                <td>{a.cls}</td>
                <td className="mono">{a.due}</td>
                <td>
                  <span className={`badge ${a.accepting ? 'badge-success' : 'badge-danger'}`}>
                    {a.accepting ? 'Accepting Submissions' : 'Stopped Accepting'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {a.accepting ? (
                    <button className="btn btn-danger" onClick={() => toggleAccepting(a.id)}>
                      <Lock size={14} /> Stop Accepting
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => toggleAccepting(a.id)}>
                      <Unlock size={14} /> Accept Assignments
                    </button>
                  )}
                  <button className="btn" onClick={() => setActiveId(a.id)}>View Student List</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, margin: 0 }}>Student Tracker: {activeAssignment.title}</h2>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
              {submittedTotal} Submitted · {notSubmittedTotal} Not Submitted · {gradedTotal} Graded
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              ['all', 'All'],
              ['submitted', 'Submitted'],
              ['not_submitted', 'Not Submitted'],
              ['graded', 'Graded'],
              ['not_graded', 'Not Graded'],
            ] as const).map(([key, label]) => (
              <button key={key} className={`btn ${filter === key ? 'btn-primary' : ''}`} style={{ padding: '5px 11px', fontSize: 12.5 }} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={16} color="var(--text-muted)" />
          <input style={{ maxWidth: 320 }} placeholder="Search student by name or roll no..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <table className="erp-table">
          <thead>
            <tr><th>Roll No</th><th>Student Name</th><th>Submission Status</th><th>Submitted At</th><th>Grading Status</th><th>Navigate</th></tr>
          </thead>
          <tbody>
            {filteredStudents.map((s) => (
              <tr key={s.subId}>
                <td className="mono">{s.roll}</td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>
                  {s.submitted ? (
                    <span className={`badge ${s.late ? 'badge-warn' : 'badge-success'}`}>
                      {s.late ? 'Submitted (Late)' : 'Submitted'}
                    </span>
                  ) : (
                    <span className="badge badge-danger">Not Submitted</span>
                  )}
                </td>
                <td className="mono" style={{ fontSize: 12.5 }}>{s.submittedAt}</td>
                <td>
                  {s.graded ? (
                    <span className="badge badge-primary">Graded · {s.marks}</span>
                  ) : (
                    <span className="badge">Not Graded</span>
                  )}
                </td>
                <td>
                  {s.submitted ? (
                    <Link to={`/faculty/evaluate?student=${s.subId}`} className="btn btn-primary" style={{ textDecoration: 'none', padding: '5px 12px' }}>
                      <FileCheck size={14} /> {s.graded ? 'Review in F07' : 'Grade in F07'}
                    </Link>
                  ) : (
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Awaiting Drive link</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
