import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, CheckCircle2, Download, ExternalLink, Users } from 'lucide-react';
import { localISODate } from '../../lib/dates';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCsv, isDemoProfile, supabase } from '../../lib/supabase';
import { UpcomingCalendarWidget } from '../../components/UpcomingCalendarWidget';

export const HodDashboard: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [stats, setStats] = useState(
    demo ? { faculty: 14, classes: 6, students: 342, sessionsToday: 1, evals: 78 } : { faculty: 0, classes: 0, students: 0, sessionsToday: 0, evals: 0 }
  );

  useEffect(() => {
    if (demo) return;
    const today = localISODate();
    Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'faculty').eq('status', 'approved'),
      supabase.from('teaching_assignments').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'approved'),
      supabase.from('attendance_sessions').select('*', { count: 'exact', head: true }).eq('session_date', today),
      supabase.from('evaluations').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    ]).then(([fac, ta, stu, sess, ev]) => {
      setStats({
        faculty: fac.count || 0,
        classes: ta.count || 0,
        students: stu.count || 0,
        sessionsToday: sess.count || 0,
        evals: ev.count || 0,
      });
    });
  }, [demo]);

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">HOD Department Dashboard</h1>
          <p className="page-sub">{demo ? 'Demo Preview · Department of Computer Science' : 'Live Department Faculty, Attendance, and Grading Oversight.'}</p>
        </div>
      </div>
      <div className="grid-4">
        <div className="kpi-card"><div><div className="kpi-val">{stats.faculty}</div><div className="kpi-lbl">Dept Faculty</div><div className="kpi-sub">Approved staff</div></div><div className="kpi-icon"><Users size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{stats.classes}</div><div className="kpi-lbl">Assigned Classes</div><div className="kpi-sub">{stats.students} approved students</div></div><div className="kpi-icon"><BookOpen size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{stats.sessionsToday}</div><div className="kpi-lbl">Attendance Sessions Today</div><div className="kpi-sub">Recorded today</div></div><div className="kpi-icon"><AlertTriangle size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{demo ? `${stats.evals}%` : stats.evals}</div><div className="kpi-lbl">{demo ? 'Evaluations Completed' : 'Published Evaluations'}</div><div className="kpi-sub">Released to students</div></div><div className="kpi-icon"><CheckCircle2 size={20} /></div></div>
      </div>
      <UpcomingCalendarWidget title="Department Calendar & Deadlines" />
    </div>
  );
};

export const HodOversightPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [rows, setRows] = useState<Array<{ id: string; cls: string; subject: string; faculty: string; facultyId: string; status: string }>>(
    demo
      ? [
          { id: '1', cls: 'MCA · Sec A', subject: 'DBMS', faculty: 'Dr. Ananya Rao', facultyId: 'f1', status: 'Recorded' },
          { id: '2', cls: 'MCA · Sec B', subject: 'Operating Systems', faculty: 'Prof. Kiran Das', facultyId: 'f2', status: 'Missing Today' },
        ]
      : []
  );

  const [deptStudents, setDeptStudents] = useState<Array<{ id: string; name: string; roll_no: string; email: string }>>([]);
  const [shortages, setShortages] = useState<Array<{ student_id: string; name: string; roll_no: string; subject: string; conducted: number; pct: number }>>([]);
  const [workload, setWorkload] = useState<Array<{ faculty: string; classes: number; subjects: string }>>([]);
  const [corrections, setCorrections] = useState<Array<{ id: string; student: string; reason: string; requested_status: string; status: string }>>([]);
  const [corrNotice, setCorrNotice] = useState('');

  const loadCorrections = () => {
    if (demo) return;
    supabase
      .from('attendance_correction_requests')
      .select('id, requested_status, reason, status, profiles:student_id(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setCorrections(data.map((c: any) => ({ id: c.id, student: c.profiles?.full_name || 'Student', reason: c.reason, requested_status: c.requested_status, status: c.status })));
      });
  };

  useEffect(() => {
    if (demo) return;
    loadCorrections();
    Promise.all([
      supabase.from('teaching_assignments').select('id, faculty_id, subjects(name), class_sections(name, section_code), profiles:faculty_id(full_name)'),
      supabase.from('profiles').select('id, full_name, email, student_profiles(roll_no)').eq('role', 'student').eq('status', 'approved').order('full_name'),
      supabase.from('v_student_attendance_summary').select('student_id, subject_name, conducted_sessions, attendance_pct').lt('attendance_pct', 75),
    ]).then(([taRes, stuRes, shortRes]) => {
      if (taRes.data) {
        const mapped = taRes.data.map((d: any) => ({
          id: d.id,
          cls: d.class_sections ? `${d.class_sections.name} · ${d.class_sections.section_code}` : 'Class',
          subject: d.subjects?.name || 'Subject',
          faculty: d.profiles?.full_name || 'Faculty',
          facultyId: d.faculty_id,
          status: 'Active',
        }));
        setRows(mapped);

        const wlMap = new Map<string, { faculty: string; subjects: Set<string>; count: number }>();
        mapped.forEach((m) => {
          const cur = wlMap.get(m.facultyId) || { faculty: m.faculty, subjects: new Set<string>(), count: 0 };
          cur.count += 1;
          cur.subjects.add(m.subject);
          wlMap.set(m.facultyId, cur);
        });
        setWorkload([...wlMap.values()].map((w) => ({ faculty: w.faculty, classes: w.count, subjects: [...w.subjects].join(', ') })));
      }

      const stuMap = new Map<string, { name: string; roll_no: string }>();
      if (stuRes.data) {
        const mappedStus = stuRes.data.map((s: any) => {
          const roll = (Array.isArray(s.student_profiles) ? s.student_profiles[0]?.roll_no : s.student_profiles?.roll_no) || '—';
          stuMap.set(s.id, { name: s.full_name, roll_no: roll });
          return { id: s.id, name: s.full_name, email: s.email, roll_no: roll };
        });
        setDeptStudents(mappedStus);
      }

      if (shortRes.data) {
        setShortages(
          shortRes.data
            .filter((r: any) => Number(r.conducted_sessions) > 0)
            .map((r: any) => ({
              student_id: r.student_id,
              name: stuMap.get(r.student_id)?.name || 'Student',
              roll_no: stuMap.get(r.student_id)?.roll_no || '—',
              subject: r.subject_name,
              conducted: Number(r.conducted_sessions),
              pct: Number(r.attendance_pct),
            }))
        );
      }
    });
  }, [demo]);

  const exportDeptDefaulters = () => {
    if (shortages.length > 0) {
      exportToCsv(
        'attendance-shortage-below-75.csv',
        ['Roll No', 'Student', 'Subject', 'Conducted', 'Attendance %'],
        shortages.map((s) => [s.roll_no, s.name, s.subject, s.conducted, `${s.pct}%`])
      );
      return;
    }
    exportToCsv(
      'dept-oversight-export.csv',
      ['Class', 'Subject', 'Faculty', 'Status'],
      rows.map((r) => [r.cls, r.subject, r.faculty, r.status])
    );
  };

  return (
    <div className="erp-content">
      <div className="page-header">
        <div><h1 className="page-title">Department Oversight</h1><p className="page-sub">Monitor teaching workload, attendance shortages (&lt;75%), student dashboards, and correction requests.</p></div>
        <button className="btn btn-primary" onClick={exportDeptDefaulters}><Download size={15} /> Export {shortages.length > 0 ? 'Shortage (<75%) CSV' : 'Oversight CSV'}</button>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Teaching Assignments ({rows.length})</div>
          <div className="erp-table-wrap"><table className="erp-table">
            <thead><tr><th>Class</th><th>Subject</th><th>Faculty</th><th>Status</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No teaching assignments found yet.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.cls}</td>
                    <td>{r.subject}</td>
                    <td>{r.faculty}</td>
                    <td><span className={`badge ${r.status === 'Missing Today' ? 'badge-danger' : 'badge-success'}`}>{r.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Faculty Workload Summary ({workload.length})</div>
          <div className="erp-table-wrap"><table className="erp-table">
            <thead><tr><th>Faculty</th><th>Classes</th><th>Assigned Subjects</th></tr></thead>
            <tbody>
              {workload.length === 0 ? (
                <tr><td colSpan={3} style={{ color: 'var(--text-muted)' }}>No workload data yet.</td></tr>
              ) : (
                workload.map((w) => (
                  <tr key={w.faculty}>
                    <td style={{ fontWeight: 600 }}>{w.faculty}</td>
                    <td className="mono">{w.classes}</td>
                    <td style={{ fontSize: 13 }}>{w.subjects}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      </div>

      {!demo && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: shortages.length > 0 ? 'var(--danger)' : undefined }}>
            Attendance Shortage Alerts (&lt; 75%) — {shortages.length}
          </div>
          <div className="erp-table-wrap"><table className="erp-table">
            <thead><tr><th>Roll No</th><th>Student</th><th>Subject</th><th>Conducted</th><th>Attendance</th><th>Dashboard</th></tr></thead>
            <tbody>
              {shortages.length === 0 ? (
                <tr><td colSpan={6} style={{ color: 'var(--text-muted)' }}>No students currently below 75% attendance.</td></tr>
              ) : (
                shortages.map((s, idx) => (
                  <tr key={`${s.student_id}-${s.subject}-${idx}`}>
                    <td className="mono">{s.roll_no}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.subject}</td>
                    <td className="mono">{s.conducted}</td>
                    <td><span className="badge badge-danger">{s.pct}%</span></td>
                    <td>
                      <Link to={`/students/${s.student_id}`} className="btn" style={{ textDecoration: 'none', padding: '4px 10px' }}>
                        <ExternalLink size={13} /> View Dashboard
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {!demo && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Department Students ({deptStudents.length})</div>
          <div className="erp-table-wrap"><table className="erp-table">
            <thead><tr><th>Roll No</th><th>Student Name</th><th>Email</th><th>Dashboard</th></tr></thead>
            <tbody>
              {deptStudents.length === 0 ? (
                <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No approved students in your department yet.</td></tr>
              ) : (
                deptStudents.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.roll_no}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td className="mono">{s.email}</td>
                    <td>
                      <Link to={`/students/${s.id}`} className="btn" style={{ textDecoration: 'none', padding: '4px 10px' }}>
                        <ExternalLink size={13} /> View Dashboard
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {!demo && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Pending Attendance Correction Requests ({corrections.length})</div>
          {corrNotice && <div className="badge badge-primary" style={{ margin: 12 }}>{corrNotice}</div>}
          <div className="erp-table-wrap"><table className="erp-table">
            <thead><tr><th>Student</th><th>Requested</th><th>Reason</th><th>Decision</th></tr></thead>
            <tbody>
              {corrections.length === 0 ? (
                <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No pending correction requests.</td></tr>
              ) : (
                corrections.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.student}</td>
                    <td><span className="badge badge-primary">{c.requested_status}</span></td>
                    <td>{c.reason}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={async () => {
                        const { error } = await supabase.rpc('review_attendance_correction', { p_request_id: c.id, p_decision: 'approved' });
                        setCorrNotice(error ? `Error: ${error.message}` : 'Correction approved.');
                        if (!error) loadCorrections();
                      }}>Approve</button>
                      <button className="btn btn-danger" onClick={async () => {
                        const { error } = await supabase.rpc('review_attendance_correction', { p_request_id: c.id, p_decision: 'rejected' });
                        setCorrNotice(error ? `Error: ${error.message}` : 'Correction rejected.');
                        if (!error) loadCorrections();
                      }}>Reject</button>
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
