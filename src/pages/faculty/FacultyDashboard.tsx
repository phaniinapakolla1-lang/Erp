import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, CheckSquare, Clock, Download, FileCheck, Lock, Plus, Search, Unlock, Users } from 'lucide-react';
import { localISODate, localToUtcIso } from '../../lib/dates';
import { DEFAULT_PERIODS, fetchPeriods, Period } from '../../lib/periods';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCsv, isDemoProfile, supabase } from '../../lib/supabase';
import { UpcomingCalendarWidget } from '../../components/UpcomingCalendarWidget';

const DEMO_CLASSES = [
  { id: 'c1', name: 'MCA Year 1 · Section A', subject: 'Database Management Systems (CS501)', room: 'Lab 302' },
  { id: 'c2', name: 'B.Tech CSE Year 2 · Section B', subject: 'Operating Systems (CS304)', room: 'LH 204' },
];



function rollOf(prof: any, idx: number): string {
  const sp = Array.isArray(prof?.student_profiles) ? prof.student_profiles[0] : prof?.student_profiles;
  return sp?.roll_no || String(idx + 1).padStart(3, '0');
}

type AttStatus = 'present' | 'absent' | 'late';
interface RosterStudent { id: string; roll: string; name: string; status: AttStatus; }

const DEMO_ROSTER: RosterStudent[] = [
  { id: '1', roll: '101', name: 'Aarav Sharma', status: 'present' },
  { id: '2', roll: '102', name: 'Diya Kulkarni', status: 'present' },
  { id: '3', roll: '103', name: 'Rohan Mehta', status: 'absent' },
];

const DEMO_SUBMISSIONS = [
  { subId: 'sub-101', studentId: 'stu-101', roll: '101', name: 'Aarav Sharma', submitted: true, late: false, submittedAt: '18 Nov, 10:32 AM', graded: true, marks: '18 / 20' },
  { subId: 'sub-102', studentId: 'stu-102', roll: '102', name: 'Diya Kulkarni', submitted: true, late: true, submittedAt: '19 Nov, 08:14 AM', graded: false, marks: null },
];

export const FacultyDashboard: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [stats, setStats] = useState(
    demo ? { classes: 2, assignments: 2, submissions: 2, sessionsToday: 1 } : { classes: 0, assignments: 0, submissions: 0, sessionsToday: 0 }
  );
  const [slots, setSlots] = useState<Array<{ id: string; time: string; cls: string; subject: string; room: string }>>(
    demo ? [{ id: 's1', time: '09:30 AM', cls: 'MCA · Sec A', subject: 'DBMS (CS501)', room: 'Lab 302' }] : []
  );

  useEffect(() => {
    if (demo) return;
    const today = localISODate();
    Promise.all([
      supabase.from('teaching_assignments').select('id', { count: 'exact' }).eq('faculty_id', profile!.id),
      supabase.from('assignments').select('id', { count: 'exact' }).eq('created_by', profile!.id).eq('state', 'published'),
      supabase.from('submissions').select('id', { count: 'exact' }),
      supabase.from('attendance_sessions').select('id', { count: 'exact' }).eq('session_date', today).eq('recorded_by', profile!.id),
      supabase.from('weekly_schedule_slots').select('id, start_time, room, teaching_assignments!inner(faculty_id, subjects(code, name), class_sections(name, section_code))').eq('teaching_assignments.faculty_id', profile!.id),
    ]).then(([ta, asg, sub, sess, sl]) => {
      setStats({
        classes: ta.count || 0,
        assignments: asg.count || 0,
        submissions: sub.count || 0,
        sessionsToday: sess.count || 0,
      });
      if (sl.data) {
        setSlots(
          sl.data.map((s: any) => ({
            id: s.id,
            time: String(s.start_time).slice(0, 5),
            cls: s.teaching_assignments?.class_sections ? `${s.teaching_assignments.class_sections.name} · Sec ${s.teaching_assignments.class_sections.section_code}` : 'Class',
            subject: s.teaching_assignments?.subjects ? `${s.teaching_assignments.subjects.name} (${s.teaching_assignments.subjects.code})` : 'Subject',
            room: s.room || 'TBA',
          }))
        );
      }
    });
  }, [demo, profile?.id]);

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Faculty Academic Dashboard</h1>
          <p className="page-sub">{demo ? 'Demo Preview · Sample schedule & metrics' : `Welcome, ${profile?.full_name} · Academic Workspace`}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/faculty/assignments" className="btn" style={{ textDecoration: 'none' }}><Plus size={16} /> Assignments &amp; Tracker</Link>
          <Link to="/faculty/attendance" className="btn btn-primary" style={{ textDecoration: 'none' }}><CheckSquare size={16} /> Take Attendance</Link>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 22 }}>
        <div className="kpi-card"><div><div className="kpi-val">{stats.sessionsToday}</div><div className="kpi-lbl">Sessions Marked Today</div><div className="kpi-sub">Attendance recorded</div></div><div className="kpi-icon"><Clock size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{stats.submissions}</div><div className="kpi-lbl">Submissions Received</div><div className="kpi-sub">Ready for grading</div></div><div className="kpi-icon"><FileCheck size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{stats.classes}</div><div className="kpi-lbl">Assigned Classes</div><div className="kpi-sub">Assigned by Admin</div></div><div className="kpi-icon"><BookOpen size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{stats.assignments}</div><div className="kpi-lbl">Published Assignments</div><div className="kpi-sub">Active</div></div><div className="kpi-icon"><CheckCircle2 size={20} /></div></div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>My Timetable Slots</h2>
            <Link to="/calendar" style={{ fontSize: 12.5, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Full Calendar →</Link>
          </div>
          <div className="erp-table-wrap"><table className="erp-table">
            <thead><tr><th>Time</th><th>Class &amp; Subject</th><th>Room</th><th>Action</th></tr></thead>
            <tbody>
              {slots.length === 0 ? (
                <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No timetable slots assigned to you yet.</td></tr>
              ) : (
                slots.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.time}</td>
                    <td><strong>{s.cls}</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.subject}</div></td>
                    <td>{s.room}</td>
                    <td><Link to="/faculty/attendance" className="btn btn-primary" style={{ textDecoration: 'none', padding: '5px 11px' }}>Mark</Link></td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Quick Actions</h2>
            <span className="badge badge-primary">Active</span>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>Create assignments, track student submissions, and publish marks.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/faculty/evaluate" className="btn btn-primary" style={{ textDecoration: 'none' }}><FileCheck size={15} /> Grade Submissions</Link>
            <Link to="/faculty/assignments" className="btn" style={{ textDecoration: 'none' }}>Manage Assignments</Link>
          </div>
        </div>
      </div>
      <UpcomingCalendarWidget title="Upcoming Class Events & Deadlines" />
    </div>
  );
};

export const FacultyClassesPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [classes, setClasses] = useState(demo ? DEMO_CLASSES : []);

  useEffect(() => {
    if (demo) return;
    supabase
      .from('teaching_assignments')
      .select('id, subjects(code, name), class_sections(name, section_code)')
      .eq('faculty_id', profile!.id)
      .then(({ data }) => {
        if (data) {
          setClasses(
            data.map((d: any) => ({
              id: d.id,
              name: d.class_sections ? `${d.class_sections.name} · Sec ${d.class_sections.section_code}` : 'Class',
              subject: d.subjects ? `${d.subjects.name} (${d.subjects.code})` : 'Subject',
              room: 'Assigned',
            }))
          );
        }
      });
  }, [demo, profile?.id]);

  return (
    <div className="erp-content">
      <div className="page-header"><div><h1 className="page-title">My Assigned Classes</h1><p className="page-sub">Classes assigned to you by Admin. Manage attendance and assignments per class.</p></div></div>
      {classes.length === 0 ? (
        <div className="card" style={{ color: 'var(--text-muted)' }}>No classes assigned to your account yet. Ask Admin to assign you a subject &amp; class under Academic Setup.</div>
      ) : (
        <div className="grid-3">
          {classes.map((c) => (
            <div key={c.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div><div style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div><div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{c.subject}</div></div>
                <span className="badge badge-primary">{c.room}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Link to="/faculty/attendance" className="btn btn-primary" style={{ textDecoration: 'none', flex: 1 }}>Attendance</Link>
                <Link to="/faculty/assignments" className="btn" style={{ textDecoration: 'none', flex: 1 }}>Assignments</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const FacultyAttendancePage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [classes, setClasses] = useState(demo ? DEMO_CLASSES : []);
  const [selectedClass, setSelectedClass] = useState(demo ? DEMO_CLASSES[0].id : '');
  const [sessionDate, setSessionDate] = useState(localISODate());
  const [periods, setPeriods] = useState<Period[]>(DEFAULT_PERIODS);
  const [selectedPeriod, setSelectedPeriod] = useState(DEFAULT_PERIODS[0].id);
  useEffect(() => { if (!demo) fetchPeriods().then(setPeriods); }, [demo]);
  const [sessionStatus, setSessionStatus] = useState<'conducted' | 'cancelled'>('conducted');
  const [roster, setRoster] = useState<RosterStudent[]>(demo ? DEMO_ROSTER : []);
  const [savedMsg, setSavedMsg] = useState('');
  const [query, setQuery] = useState('');

  const [taSectionMap, setTaSectionMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (demo) return;
    supabase
      .from('teaching_assignments')
      .select('id, class_section_id, subjects(code, name), class_sections(name, section_code)')
      .eq('faculty_id', profile!.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const secMap: Record<string, string> = {};
          const mapped = data.map((d: any) => {
            secMap[d.id] = d.class_section_id;
            return {
              id: d.id,
              name: d.class_sections ? `${d.class_sections.name} · Sec ${d.class_sections.section_code}` : 'Class',
              subject: d.subjects ? `${d.subjects.name} (${d.subjects.code})` : 'Subject',
              room: 'Assigned',
            };
          });
          setTaSectionMap(secMap);
          setClasses(mapped);
          setSelectedClass(mapped[0].id);
        }
      });
  }, [demo, profile?.id]);

  useEffect(() => {
    if (demo || !selectedClass) return;
    const secId = taSectionMap[selectedClass];
    if (!secId) { setRoster([]); return; }
    let cancelled = false;
    (async () => {
      const [enrRes, sessRes] = await Promise.all([
        supabase
          .from('enrollments')
          .select('student_id, profiles:student_id(id, full_name, student_profiles(roll_no))')
          .eq('class_section_id', secId)
          .eq('is_active', true),
        supabase
          .from('attendance_sessions')
          .select('id, status')
          .eq('teaching_assignment_id', selectedClass)
          .eq('session_date', sessionDate)
          .eq('slot_number', Number(selectedPeriod))
          .maybeSingle(),
      ]);
      if (enrRes.error) { if (!cancelled) setSavedMsg(`Error loading roster: ${enrRes.error.message}`); return; }
      // Load what was already recorded so re-opening a session never resets everyone to "present".
      const existing: Record<string, AttStatus> = {};
      if (sessRes.data) {
        const recRes = await supabase.from('attendance_records').select('student_id, status').eq('session_id', sessRes.data.id);
        (recRes.data || []).forEach((r: any) => { existing[r.student_id] = r.status; });
      }
      if (cancelled) return;
      const sorted = [...(enrRes.data || [])].sort((x: any, y: any) =>
        String(x.profiles?.full_name || '').localeCompare(String(y.profiles?.full_name || '')));
      setRoster(
        sorted.map((e: any, idx: number) => ({
          id: e.student_id,
          roll: rollOf(e.profiles, idx),
          name: e.profiles?.full_name || 'Student',
          status: existing[e.student_id] || 'present',
        }))
      );
      setSessionStatus(sessRes.data?.status === 'cancelled' ? 'cancelled' : 'conducted');
      setSavedMsg(sessRes.data ? 'Loaded previously saved session.' : '');
    })();
    return () => { cancelled = true; };
  }, [demo, selectedClass, taSectionMap, sessionDate, selectedPeriod]);

  const filtered = roster.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.roll.includes(query));
  const presentCount = roster.filter((s) => s.status === 'present').length;
  const absentCount = roster.filter((s) => s.status === 'absent').length;
  const lateCount = roster.filter((s) => s.status === 'late').length;

  const markAllPresent = () => setRoster((prev) => prev.map((s) => ({ ...s, status: 'present' })));
  const setStatus = (id: string, status: AttStatus) => setRoster((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));

  const saveSession = async () => {
    if (demo) {
      setSavedMsg(`Saved at ${new Date().toLocaleTimeString()}`);
      return;
    }
    if (!selectedClass) {
      setSavedMsg('No assigned class selected.');
      return;
    }
    if (sessionDate > localISODate()) {
      setSavedMsg('Cannot record attendance for a future date.');
      return;
    }
    try {
      const { data: session, error: sErr } = await supabase
        .from('attendance_sessions')
        .upsert(
          { teaching_assignment_id: selectedClass, session_date: sessionDate, slot_number: Number(selectedPeriod), status: sessionStatus, recorded_by: profile!.id },
          { onConflict: 'teaching_assignment_id,session_date,slot_number' }
        )
        .select('id')
        .single();
      if (sErr) throw sErr;

      if (sessionStatus === 'conducted' && roster.length > 0) {
        const records = roster.map((r) => ({ session_id: session.id, student_id: r.id, status: r.status }));
        const { error: rErr } = await supabase.from('attendance_records').upsert(records, { onConflict: 'session_id,student_id' });
        if (rErr) throw rErr;
      }
      setSavedMsg(`Attendance saved at ${new Date().toLocaleTimeString()}`);
    } catch (err: any) {
      setSavedMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Take Attendance</h1>
          <p className="page-sub">Select Class, Date, and Period before marking attendance.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => exportToCsv(`attendance-${sessionDate}.csv`, ['Roll', 'Name', 'Status'], roster.map((r) => [r.roll, r.name, r.status]))}><Download size={15} /> Export CSV</button>
          <button className="btn" onClick={markAllPresent}>Mark All Present</button>
          <button className="btn btn-primary" onClick={saveSession}>Save Attendance Session</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.2fr 0.8fr', gap: 14, alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>1. Class &amp; Subject</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            {classes.length === 0 ? <option value="">No classes assigned yet</option> : classes.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>2. Session Date</label>
          <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>3. Period / Time Slot</label>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.start} – {p.end}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5 }}>4. Session Status</label>
          <select value={sessionStatus} onChange={(e) => setSessionStatus(e.target.value as 'conducted' | 'cancelled')}>
            <option value="conducted">Conducted</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="badge badge-success">Present: {presentCount}</span>
        <span className="badge badge-danger">Absent: {absentCount}</span>
        <span className="badge badge-warn">Late: {lateCount}</span>
        {savedMsg && <span className="badge badge-primary">{savedMsg}</span>}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={16} color="var(--text-muted)" />
          <input style={{ maxWidth: 340 }} placeholder="Search student by name..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="erp-table-wrap"><table className="erp-table">
          <thead><tr><th>#</th><th>Student Name</th><th>Mark Status</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={3} style={{ color: 'var(--text-muted)' }}>No students enrolled in this class section yet. Enroll students under Admin → Users & Approvals.</td></tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.roll}</td>
                  <td style={{ fontWeight: 600 }}><Link to={`/students/${s.id}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{s.name}</Link></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['present', 'absent', 'late'] as const).map((st) => (
                        <button key={st} className={`btn ${s.status === st ? 'btn-primary' : ''}`} style={{ padding: '5px 13px' }} onClick={() => setStatus(s.id, st)}>
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
};

export const FacultyAssignmentsPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [showCreate, setShowCreate] = useState(false);
  const [classes, setClasses] = useState(demo ? DEMO_CLASSES : []);
  const [assignments, setAssignments] = useState<Array<{ id: string; title: string; cls: string; due: string; maxMarks: number; accepting: boolean; sectionId?: string }>>(
    demo ? [{ id: 'a1', title: 'Database Management Assignment 01', cls: 'MCA · Sec A', due: '2026-11-28', maxMarks: 20, accepting: true }] : []
  );
  const [activeId, setActiveId] = useState(demo ? 'a1' : '');
  const [trackerRows, setTrackerRows] = useState(demo ? DEMO_SUBMISSIONS : []);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'not_submitted' | 'graded' | 'not_graded'>('all');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [taId, setTaId] = useState(demo ? 'c1' : '');
  const [dueDate, setDueDate] = useState('2026-11-30');
  const [maxMarks, setMaxMarks] = useState(20);
  const [allowLate, setAllowLate] = useState(false);
  const [asgDesc, setAsgDesc] = useState('');
  const [asgRefUrl, setAsgRefUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [extendDateVal, setExtendDateVal] = useState('');
  const [resubReqs, setResubReqs] = useState<Array<{ id: string; student: string; assignment: string; reason: string; created_at: string }>>([]);

  const loadResubReqs = async () => {
    if (demo) return;
    const { data } = await supabase
      .from('resubmission_requests')
      .select('id, reason, created_at, profiles:student_id(full_name), assignments(title)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (data) {
      setResubReqs(data.map((r: any) => ({
        id: r.id,
        student: r.profiles?.full_name || 'Student',
        assignment: r.assignments?.title || 'Assignment',
        reason: r.reason,
        created_at: new Date(r.created_at).toLocaleString(),
      })));
    }
  };

  const loadAssignments = async () => {
    if (demo) return;
    const [taRes, asgRes] = await Promise.all([
      supabase.from('teaching_assignments').select('id, subjects(code, name), class_sections(name, section_code)').eq('faculty_id', profile!.id),
      supabase
        .from('assignments')
        .select('id, title, due_at, max_marks, state, teaching_assignments!inner(faculty_id, class_section_id, subjects(code, name), class_sections(name, section_code))')
        .eq('teaching_assignments.faculty_id', profile!.id)
        .order('created_at', { ascending: false }),
    ]);

    if (taRes.data) {
      const mappedTa = taRes.data.map((d: any) => ({
        id: d.id,
        name: d.class_sections ? `${d.class_sections.name} · Sec ${d.class_sections.section_code}` : 'Class',
        subject: d.subjects ? `${d.subjects.name} (${d.subjects.code})` : 'Subject',
        room: 'Assigned',
      }));
      setClasses(mappedTa);
      if (mappedTa.length > 0 && !taId) setTaId(mappedTa[0].id);
    }

    if (asgRes.data) {
      const mappedAsg = asgRes.data.map((a: any) => ({
        id: a.id,
        title: a.title,
        cls: a.teaching_assignments?.class_sections
          ? `${a.teaching_assignments.class_sections.name} · Sec ${a.teaching_assignments.class_sections.section_code} (${a.teaching_assignments.subjects?.code || ''})`
          : 'Class',
        due: localISODate(new Date(a.due_at)),
        maxMarks: Number(a.max_marks),
        accepting: a.state === 'published',
        sectionId: a.teaching_assignments?.class_section_id,
      }));
      setAssignments(mappedAsg);
      if (mappedAsg.length > 0 && (!activeId || !mappedAsg.some((x) => x.id === activeId))) {
        setActiveId(mappedAsg[0].id);
      }
    }
  };

  useEffect(() => {
    loadAssignments();
    loadResubReqs();
  }, [demo, profile?.id]);

  useEffect(() => {
    if (demo || !activeId) return;
    let cancelled = false;
    (async () => {
      const act = assignments.find((a) => a.id === activeId);
      const [subRes, enrRes] = await Promise.all([
        supabase
          .from('submissions')
          .select('id, status, student_id, profiles:student_id(full_name, student_profiles(roll_no)), submission_versions(version_no, submitted_at, is_late), evaluations(marks_obtained, status)')
          .eq('assignment_id', activeId),
        act?.sectionId
          ? supabase.from('enrollments').select('student_id, profiles:student_id(full_name, student_profiles(roll_no))').eq('class_section_id', act.sectionId).eq('is_active', true)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      if (cancelled) return;
      if (subRes.error) { setNotice(`Error loading submissions: ${subRes.error.message}`); return; }
      const byStudent = new Map<string, any>();
      (subRes.data || []).forEach((s: any) => byStudent.set(s.student_id, s));
      // Everyone enrolled appears in the tracker, including students who have not submitted.
      const ids = new Set<string>([...byStudent.keys(), ...((enrRes.data || []) as any[]).map((e: any) => e.student_id)]);
      const names = new Map<string, string>();
      const rolls = new Map<string, string>();
      const noteRoll = (id: string, prof: any) => { const r = Array.isArray(prof?.student_profiles) ? prof.student_profiles[0]?.roll_no : prof?.student_profiles?.roll_no; if (r) rolls.set(id, r); };
      ((enrRes.data || []) as any[]).forEach((e: any) => noteRoll(e.student_id, e.profiles));
      byStudent.forEach((s, id) => noteRoll(id, s.profiles));
      ((enrRes.data || []) as any[]).forEach((e: any) => names.set(e.student_id, e.profiles?.full_name || 'Student'));
      byStudent.forEach((s, id) => names.set(id, s.profiles?.full_name || names.get(id) || 'Student'));
      const rows = [...ids]
        .sort((x, y) => String(names.get(x)).localeCompare(String(names.get(y))))
        .map((studentId, idx) => {
          const s = byStudent.get(studentId);
          const vers = s && Array.isArray(s.submission_versions) ? [...s.submission_versions].sort((a: any, b: any) => b.version_no - a.version_no) : [];
          const latestVer = vers[0] || null;
          const ev = s ? (Array.isArray(s.evaluations) ? s.evaluations[0] : s.evaluations) : null;
          const graded = ev && ev.marks_obtained !== null && ev.marks_obtained !== undefined;
          return {
            subId: s ? s.id : `ns-${studentId}`,
            studentId,
            roll: rolls.get(studentId) || String(idx + 1).padStart(3, '0'),
            name: names.get(studentId) || 'Student',
            submitted: Boolean(s && vers.length > 0),
            late: Boolean(latestVer?.is_late),
            submittedAt: latestVer?.submitted_at ? new Date(latestVer.submitted_at).toLocaleString() : '—',
            graded: Boolean(graded),
            marks: graded ? `${ev.marks_obtained} / ${act?.maxMarks ?? '?'}` : null,
          };
        });
      setTrackerRows(rows);
    })();
    return () => { cancelled = true; };
  }, [activeId, demo, assignments]);

  const toggleAccepting = async (id: string, currentAccepting: boolean) => {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, accepting: !currentAccepting } : a)));
    if (!demo) {
      const { error } = await supabase.from('assignments').update({ state: currentAccepting ? 'closed' : 'published' }).eq('id', id);
      if (error) {
        setNotice(`Error: ${error.message}`);
        setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, accepting: currentAccepting } : a)));
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (demo) {
      setAssignments([{ id: String(Date.now()), title, cls: 'MCA · Sec A', due: dueDate, maxMarks, accepting: true }, ...assignments]);
      setTitle('');
      setAsgDesc('');
      setAsgRefUrl('');
      setShowCreate(false);
      return;
    }
    if (!taId) {
      setNotice('Ask Admin to assign you a class/subject in Academic Setup first.');
      return;
    }
    if (!Number.isFinite(maxMarks) || maxMarks <= 0 || maxMarks > 9999) {
      setNotice('Max marks must be between 1 and 9999.');
      return;
    }
    const { error } = await supabase.from('assignments').insert({
      teaching_assignment_id: taId,
      title: title.trim(),
      due_at: localToUtcIso(dueDate, '23:59'),
      max_marks: maxMarks,
      allow_late_submission: allowLate,
      description: asgDesc.trim() || null,
      reference_url: asgRefUrl.trim() || null,
      state: 'published',
      created_by: profile!.id,
    });
    if (error) {
      setNotice(`Error creating assignment: ${error.message}`);
    } else {
      setNotice('Assignment published and published!');
      setTitle('');
      setAsgDesc('');
      setAsgRefUrl('');
      setShowCreate(false);
      await loadAssignments();
    }
  };

  const activeAssignment = assignments.find((a) => a.id === activeId) || assignments[0];

  const filteredStudents = trackerRows.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.roll.includes(search);
    if (!matchesSearch) return false;
    if (filter === 'submitted') return s.submitted;
    if (filter === 'not_submitted') return !s.submitted;
    if (filter === 'graded') return s.graded;
    if (filter === 'not_graded') return s.submitted && !s.graded;
    return true;
  });

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Assignments & Student Tracker</h1>
          <p className="page-sub">Create assignments, control submission windows, and grade student work.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => exportToCsv(`marksheet-${activeAssignment?.id || 'all'}.csv`, ['#', 'Student', 'Status', 'Submitted At', 'Marks'], trackerRows.map((s) => [s.roll, s.name, s.submitted ? 'Submitted' : 'Pending', s.submittedAt, s.marks || 'Not Graded']))}><Download size={15} /> Export CSV</button>
          <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}><Plus size={16} /> Create Assignment</button>
        </div>
      </div>

      {notice && <div className="badge badge-primary" style={{ marginBottom: 14, padding: '6px 12px' }}>{notice}</div>}

      {showCreate && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Assignment Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SQL Indexing & Query Plans" required /></div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Class &amp; Subject</label>
            <select value={taId} onChange={(e) => setTaId(e.target.value)} required>
              {classes.length === 0 ? <option value="">No assigned classes</option> : classes.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>)}
            </select>
          </div>
          <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Due Date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
          <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Max Marks</label><input type="number" min={1} value={maxMarks} onChange={(e) => setMaxMarks(Number(e.target.value))} required /></div>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 8 }}><input type="checkbox" style={{ width: 'auto' }} checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} /> Allow late</label>
          <div style={{ gridColumn: "1 / -1" }}><label style={{ fontSize: 12.5, fontWeight: 600 }}>Instructions / Description</label><input value={asgDesc} onChange={(e) => setAsgDesc(e.target.value)} placeholder="Optional assignment guidelines for students..." /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={{ fontSize: 12.5, fontWeight: 600 }}>Reference Material Link (Optional)</label><input type="url" value={asgRefUrl} onChange={(e) => setAsgRefUrl(e.target.value)} placeholder="https://drive.google.com/..." /></div>
          <button type="submit" className="btn btn-primary" disabled={classes.length === 0}>Publish</button>
        </form>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 22 }}>
        <div className="erp-table-wrap"><table className="erp-table">
          <thead><tr><th>Assignment</th><th>Class</th><th>Deadline</th><th>Submission Window</th><th>Action</th></tr></thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>No assignments published yet. Click "Create Assignment" above to publish one.</td></tr>
            ) : (
              assignments.map((a) => (
                <tr key={a.id} style={a.id === activeId ? { background: 'var(--primary-soft)' } : undefined}>
                  <td style={{ fontWeight: 600 }}>
                    <button onClick={() => setActiveId(a.id)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', textAlign: 'left' }}>
                      {a.title}
                    </button>
                  </td>
                  <td>{a.cls}</td>
                  <td className="mono">{a.due}</td>
                  <td><span className={`badge ${a.accepting ? 'badge-success' : 'badge-danger'}`}>{a.accepting ? 'Accepting Submissions' : 'Stopped Accepting'}</span></td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {a.accepting ? (
                      <button className="btn btn-danger" onClick={() => toggleAccepting(a.id, true)}><Lock size={14} /> Stop Accepting</button>
                    ) : (
                      <button className="btn btn-primary" onClick={() => toggleAccepting(a.id, false)}><Unlock size={14} /> Accept Assignments</button>
                    )}
                    <button
                      className="btn"
                      onClick={() => {
                        setExtendingId(extendingId === a.id ? null : a.id);
                        setExtendDateVal(a.due);
                      }}
                    >
                      Extend Date
                    </button>
                    {extendingId === a.id && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="date" style={{ width: 'auto', padding: '4px 8px' }} value={extendDateVal} onChange={(e) => setExtendDateVal(e.target.value)} />
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 10px' }}
                          onClick={async () => {
                            if (!extendDateVal) return;
                            const { error } = await supabase.rpc('faculty_extend_assignment_due', {
                              p_assignment_id: a.id,
                              p_new_due_at: localToUtcIso(extendDateVal, '23:59'),
                            });
                            setNotice(error ? `Error extending date: ${error.message}` : `Due date extended to ${extendDateVal}!`);
                            if (!error) {
                              setExtendingId(null);
                              await loadAssignments();
                            }
                          }}
                        >
                          Save
                        </button>
                      </div>
                    )}
                    <button className="btn" onClick={() => setActiveId(a.id)}>View Student List</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table></div>
      </div>

      {!demo && resubReqs.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 22, borderColor: 'var(--warning)' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
            Pending Student Resubmission Requests ({resubReqs.length})
          </div>
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead><tr><th>Student</th><th>Assignment</th><th>Reason</th><th>Requested</th><th>Decision</th></tr></thead>
              <tbody>
                {resubReqs.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.student}</td>
                    <td>{r.assignment}</td>
                    <td style={{ fontSize: 13 }}>{r.reason}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{r.created_at}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 10px' }}
                        onClick={async () => {
                          const { error } = await supabase.rpc('review_resubmission_request', { p_request_id: r.id, p_decision: 'approved' });
                          setNotice(error ? `Error: ${error.message}` : `Approved resubmission for ${r.student}.`);
                          if (!error) { await loadResubReqs(); await loadAssignments(); }
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '4px 10px' }}
                        onClick={async () => {
                          const { error } = await supabase.rpc('review_resubmission_request', { p_request_id: r.id, p_decision: 'rejected' });
                          setNotice(error ? `Error: ${error.message}` : `Rejected resubmission for ${r.student}.`);
                          if (!error) await loadResubReqs();
                        }}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeAssignment && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div><h2 style={{ fontSize: 16, margin: 0 }}>Student Tracker: {activeAssignment.title}</h2></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([['all', 'All'], ['submitted', 'Submitted'], ['not_submitted', 'Not Submitted'], ['graded', 'Graded'], ['not_graded', 'Not Graded']] as const).map(([key, label]) => (
                <button key={key} className={`btn ${filter === key ? 'btn-primary' : ''}`} style={{ padding: '5px 11px', fontSize: 12.5 }} onClick={() => setFilter(key)}>{label}</button>
              ))}
            </div>
          </div>

          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Search size={16} color="var(--text-muted)" />
            <input style={{ maxWidth: 320 }} placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="erp-table-wrap"><table className="erp-table">
            <thead><tr><th>#</th><th>Student Name</th><th>Submission Status</th><th>Submitted At</th><th>Grading Status</th><th>Navigate</th></tr></thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr><td colSpan={6} style={{ color: 'var(--text-muted)' }}>No student submissions for this assignment yet.</td></tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.subId}>
                    <td className="mono">{s.roll}</td>
                    <td style={{ fontWeight: 600 }}><Link to={`/students/${s.studentId}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{s.name}</Link></td>
                    <td>{s.submitted ? <span className={`badge ${s.late ? 'badge-warn' : 'badge-success'}`}>{s.late ? 'Submitted (Late)' : 'Submitted'}</span> : <span className="badge badge-danger">Not Submitted</span>}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{s.submittedAt}</td>
                    <td>{s.graded ? <span className="badge badge-primary">Graded · {s.marks}</span> : <span className="badge">Not Graded</span>}</td>
                    <td>
                      {s.submitted ? (
                        <Link to={`/faculty/evaluate?assignment=${activeAssignment.id}&submission=${s.subId}`} className="btn btn-primary" style={{ textDecoration: 'none', padding: '5px 12px' }}>
                          <FileCheck size={14} /> {s.graded ? 'Review Marks' : 'Grade Submissions'}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Awaiting Drive link</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
};
