import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, ExternalLink, Search, UserCheck, Users } from 'lucide-react';
import { localISODate } from '../../lib/dates';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, supabase } from '../../lib/supabase';
import { UpcomingCalendarWidget } from '../../components/UpcomingCalendarWidget';

export const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [counts, setCounts] = useState(
    demo
      ? { students: 640, faculty: 42, pending: 12, sessionsToday: 18, departments: 4, classes: 12 }
      : { students: 0, faculty: 0, pending: 0, sessionsToday: 0, departments: 0, classes: 0 }
  );
  const [pending, setPending] = useState<Array<{ id: string; name: string; email: string; requested: string }>>([]);
  const [deptStats, setDeptStats] = useState<Array<{ id: string; code: string; name: string; faculty: number; students: number; subjects: number }>>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string; email: string; roll_no: string; dept: string; class_label: string }>>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [dashNotice, setDashNotice] = useState('');

  const loadDashboard = async () => {
    if (demo) return;
    const today = localISODate();
    const [st, fac, pend, sess, deptsRes, clsRes, pendListRes, allProfRes, subsRes, dirRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'approved'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['faculty', 'hod']).eq('status', 'approved'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('attendance_sessions').select('*', { count: 'exact', head: true }).eq('session_date', today),
      supabase.from('departments').select('id, code, name').order('code'),
      supabase.from('class_sections').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('id, full_name, email, role').eq('status', 'pending').order('created_at', { ascending: false }).limit(8),
      supabase.from('profiles').select('id, role, department_id').eq('status', 'approved'),
      supabase.from('subjects').select('id, department_id'),
      supabase.from('v_student_directory').select('id, full_name, email, roll_no, department_name, class_name, section_code, semester_label, status').eq('status', 'approved').order('full_name'),
    ]);

    setCounts({
      students: st.count || 0,
      faculty: fac.count || 0,
      pending: pend.count || 0,
      sessionsToday: sess.count || 0,
      departments: deptsRes.data?.length || 0,
      classes: clsRes.count || 0,
    });

    if (pendListRes.data) {
      setPending(pendListRes.data.map((u: any) => ({ id: u.id, name: u.full_name, email: u.email, requested: u.role })));
    }

    if (deptsRes.data) {
      const profs = allProfRes.data || [];
      const subs = subsRes.data || [];
      setDeptStats(
        deptsRes.data.map((d: any) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          faculty: profs.filter((p: any) => p.department_id === d.id && (p.role === 'faculty' || p.role === 'hod')).length,
          students: profs.filter((p: any) => p.department_id === d.id && p.role === 'student').length,
          subjects: subs.filter((s: any) => s.department_id === d.id).length,
        }))
      );
    }

    if (dirRes.data) {
      setStudents(
        dirRes.data.map((s: any) => ({
          id: s.id,
          name: s.full_name,
          email: s.email,
          roll_no: s.roll_no || '—',
          dept: s.department_name || 'Unassigned',
          class_label: s.class_name ? `${s.class_name} · Sec ${s.section_code}${s.semester_label ? ` (${s.semester_label})` : ''}` : 'Not enrolled',
        }))
      );
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [demo]);

  const handleQuickDecision = async (id: string, status: 'approved' | 'rejected', role: string) => {
    const { error } = await supabase.from('profiles').update({ status, role }).eq('id', id);
    setDashNotice(error ? `Error: ${error.message}` : `User ${status} as ${role}.`);
    if (!error) loadDashboard();
  };

  const filteredStudents = students.filter((s) => {
    const q = studentQuery.toLowerCase().trim();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.roll_no.toLowerCase().includes(q);
  });

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Institutional Dashboard</h1>
          <p className="page-sub">
            {demo
              ? 'Demo Mode · Sample institutional data shown for preview.'
              : 'Central Control · User Management, Approvals, Departments, Student Dashboards & Timetable.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/admin/users?action=add" className="btn btn-primary" style={{ textDecoration: 'none' }}><UserPlus size={15} /> Add New User</Link>
          <Link to="/admin/academic" className="btn" style={{ textDecoration: 'none' }}><BookOpen size={15} /> Academic Setup</Link>
          <Link to="/admin/reports" className="btn" style={{ textDecoration: 'none' }}><ShieldAlert size={15} /> Reports</Link>
          <Link to="/admin/oversight" className="btn" style={{ textDecoration: 'none' }}><Download size={15} /> Exports &amp; Audit</Link>
        </div>
      </div>

      {dashNotice && <div className="badge badge-primary" style={{ marginBottom: 14, padding: '6px 12px' }}>{dashNotice}</div>}

      <div className="grid-4" style={{ marginBottom: 22 }}>
        <Link to="/admin/users" style={{ textDecoration: 'none', color: 'inherit' }} className="kpi-card">
          <div><div className="kpi-val">{counts.students}</div><div className="kpi-lbl">Approved Students</div><div className="kpi-sub">{counts.classes} active classes</div></div>
          <div className="kpi-icon"><Users size={20} /></div>
        </Link>
        <Link to="/admin/users" style={{ textDecoration: 'none', color: 'inherit' }} className="kpi-card">
          <div><div className="kpi-val">{counts.faculty}</div><div className="kpi-lbl">Faculty &amp; HODs</div><div className="kpi-sub">{counts.departments} departments</div></div>
          <div className="kpi-icon"><UserCheck size={20} /></div>
        </Link>
        <Link to="/admin/users" style={{ textDecoration: 'none', color: 'inherit' }} className="kpi-card">
          <div><div className="kpi-val">{counts.pending}</div><div className="kpi-lbl">Pending Approvals</div><div className="kpi-sub" style={{ color: 'var(--warning)' }}>Review registrations</div></div>
          <div className="kpi-icon"><ShieldAlert size={20} /></div>
        </Link>
        <div className="kpi-card">
          <div><div className="kpi-val">{counts.sessionsToday}</div><div className="kpi-lbl">Attendance Sessions Today</div><div className="kpi-sub">Recorded today</div></div>
          <div className="kpi-icon"><CheckSquare size={20} /></div>
        </div>
      </div>

      {!demo && (
        <div className="grid-2" style={{ marginBottom: 22 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Pending Registrations ({pending.length})</strong>
              <Link to="/admin/users" style={{ fontSize: 12.5, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>All Users →</Link>
            </div>
            <div className="erp-table-wrap"><table className="erp-table">
              <thead><tr><th>Applicant</th><th>Role</th><th>Action</th></tr></thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr><td colSpan={3} style={{ color: 'var(--text-muted)' }}>No pending registrations right now.</td></tr>
                ) : (
                  pending.map((u) => (
                    <tr key={u.id}>
                      <td><div style={{ fontWeight: 600 }}>{u.name}</div><div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{u.email}</div></td>
                      <td>
                        <select style={{ width: 'auto', padding: '4px 8px' }} value={u.requested} onChange={(e) => setPending((p) => p.map((x) => (x.id === u.id ? { ...x, requested: e.target.value } : x)))}>
                          <option value="student">Student</option><option value="faculty">Faculty</option><option value="hod">HOD</option><option value="exam_controller">Exam Controller</option><option value="admin">Admin</option>
                        </select>
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary" style={{ padding: '4px 10px' }} onClick={() => handleQuickDecision(u.id, 'approved', u.requested)}>Approve</button>
                        <button className="btn btn-danger" style={{ padding: '4px 10px' }} onClick={() => handleQuickDecision(u.id, 'rejected', u.requested)}>Reject</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Departments Breakdown ({deptStats.length})</strong>
              <Link to="/admin/academic" style={{ fontSize: 12.5, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Manage Setup →</Link>
            </div>
            <div className="erp-table-wrap"><table className="erp-table">
              <thead><tr><th>Dept</th><th>Subjects</th><th>Faculty</th><th>Students</th></tr></thead>
              <tbody>
                {deptStats.length === 0 ? (
                  <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No departments configured yet.</td></tr>
                ) : (
                  deptStats.map((d) => (
                    <tr key={d.id}>
                      <td><span className="mono" style={{ fontWeight: 700 }}>{d.code}</span> — {d.name}</td>
                      <td className="mono">{d.subjects}</td>
                      <td className="mono">{d.faculty}</td>
                      <td className="mono">{d.students}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {!demo && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <strong>Student Directory &amp; Individual Dashboards ({filteredStudents.length})</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={15} color="var(--text-muted)" />
              <input style={{ width: 260 }} placeholder="Search by name, roll no, or email..." value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} />
            </div>
          </div>
          <div className="erp-table-wrap"><table className="erp-table">
            <thead><tr><th>Roll No</th><th>Student Name</th><th>Department</th><th>Class / Section</th><th>Dashboard</th></tr></thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>No approved students match your search.</td></tr>
              ) : (
                filteredStudents.slice(0, 12).map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.roll_no}</td>
                    <td><div style={{ fontWeight: 600 }}>{s.name}</div><div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.email}</div></td>
                    <td>{s.dept}</td>
                    <td style={{ fontSize: 12.5 }}>{s.class_label}</td>
                    <td>
                      <Link to={`/students/${s.id}`} className="btn btn-primary" style={{ textDecoration: 'none', padding: '4px 10px' }}>
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

      <UpcomingCalendarWidget title="College-Wide Events, Holidays & Deadlines" />
    </div>
  );
};

