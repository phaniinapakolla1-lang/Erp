import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, BookOpen, CheckCircle2, ClipboardList, ExternalLink, Mail, MapPin, Phone, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, supabase } from '../../lib/supabase';

interface StudentAttendanceRow {
  subject: string;
  conducted: number;
  cancelled: number;
  present: number;
  late: number;
  absent: number;
  pct: number;
}

interface StudentSubmissionRow {
  assignmentId: string;
  title: string;
  subject: string;
  due: string;
  maxMarks: number;
  submitted: boolean;
  late: boolean;
  driveUrl: string;
  marksObtained: number | null;
  evalStatus: string;
  feedback: string;
}

export const StudentDetailPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const demo = isDemoProfile(profile);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [student, setStudent] = useState<{
    id: string;
    full_name: string;
    email: string;
    mobile: string;
    status: string;
    gender: string;
    dob: string;
    address: string;
    bio: string;
    avatar_icon: string;
    photo_drive_url?: string;
    roll_no: string;
    department: string;
    specialization: string;
    admission_year: string;
    guardian_name: string;
    guardian_phone: string;
    blood_group: string;
    class_label: string;
  } | null>(null);

  const [attendanceRows, setAttendanceRows] = useState<StudentAttendanceRow[]>([]);
  const [submissionRows, setSubmissionRows] = useState<StudentSubmissionRow[]>([]);

  useEffect(() => {
    if (!studentId) return;
    if (demo) {
      setStudent({
        id: studentId,
        full_name: 'Aarav Sharma',
        email: 'aarav@college.edu',
        mobile: '+91 98765 43210',
        status: 'approved',
        gender: 'Male',
        dob: '2003-05-14',
        address: 'Hyderabad, Telangana',
        bio: 'Final-year MCA student interested in distributed systems and databases.',
        avatar_icon: '🎓',
        roll_no: '101',
        department: 'CS — Computer Science',
        specialization: 'AI-ML — Artificial Intelligence',
        admission_year: '2026',
        guardian_name: 'Rajesh Sharma',
        guardian_phone: '+91 98765 00000',
        blood_group: 'O+',
        class_label: 'MCA Year 1 · Sec A (Semester 1)',
      });
      setAttendanceRows([
        { subject: 'Database Management Systems', conducted: 24, cancelled: 1, present: 21, late: 1, absent: 2, pct: 91.7 },
        { subject: 'Operating Systems', conducted: 20, cancelled: 0, present: 16, late: 1, absent: 3, pct: 85.0 },
      ]);
      setSubmissionRows([
        {
          assignmentId: 'asg-1',
          title: 'DBMS ER Model & Normalization',
          subject: 'Database Management Systems',
          due: '2026-11-18',
          maxMarks: 20,
          submitted: true,
          late: false,
          driveUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view',
          marksObtained: 18,
          evalStatus: 'published',
          feedback: 'Well-structured ER diagram and clean 3NF normalization.',
        },
      ]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const [profRes, spRes, enrRes, attRes, asgRes, subRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email, mobile, role, status, department_id, specialization_id, guardian_name, guardian_phone, blood_group, gender, dob, address, bio, avatar_icon, photo_drive_url').eq('id', studentId).maybeSingle(),
          supabase.from('student_profiles').select('roll_no, admission_year').eq('user_id', studentId).maybeSingle(),
          supabase.from('enrollments').select('class_section_id, class_sections(name, section_code, semesters(label))').eq('student_id', studentId).eq('is_active', true).limit(1),
          supabase.from('v_student_attendance_summary').select('*').eq('student_id', studentId),
          supabase.from('assignments').select('id, title, due_at, max_marks, teaching_assignments(class_section_id, subjects(name))').in('state', ['published', 'closed']).order('due_at', { ascending: false }),
          supabase.from('submissions').select('id, assignment_id, submission_versions(version_no, drive_url, is_late), evaluations(marks_obtained, feedback, status)').eq('student_id', studentId),
        ]);

        if (cancelled) return;
        if (profRes.error || !profRes.data) {
          setErrorMsg(profRes.error?.message || 'Student profile not found or access restricted.');
          setLoading(false);
          return;
        }

        const p: any = profRes.data;
        let deptLabel = 'Unassigned';
        if (p.department_id) {
          const { data: d } = await supabase.from('departments').select('code, name').eq('id', p.department_id).maybeSingle();
          if (d) deptLabel = `${d.code} — ${d.name}`;
        }
        let specLabel = 'General';
        if (p.specialization_id) {
          const { data: sp } = await supabase.from('specializations').select('code, name').eq('id', p.specialization_id).maybeSingle();
          if (sp) specLabel = `${sp.code} — ${sp.name}`;
        }

        const enrRow: any = enrRes.data?.[0];
        const cs: any = enrRow?.class_sections;
        const classLabel = cs ? `${cs.name} · Sec ${cs.section_code}${cs.semesters?.label ? ` (${cs.semesters.label})` : ''}` : 'Not enrolled';

        setStudent({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          mobile: p.mobile || '—',
          status: p.status,
          gender: p.gender || '—',
          dob: p.dob || '—',
          address: p.address || '—',
          bio: p.bio || '',
          avatar_icon: p.avatar_icon || '🎓',
          photo_drive_url: p.photo_drive_url || '',
          roll_no: spRes.data?.roll_no || '—',
          department: deptLabel,
          specialization: specLabel,
          admission_year: spRes.data?.admission_year ? String(spRes.data.admission_year) : '—',
          guardian_name: p.guardian_name || '—',
          guardian_phone: p.guardian_phone || '—',
          blood_group: p.blood_group || '—',
          class_label: classLabel,
        });

        setAttendanceRows(
          (attRes.data || []).map((r: any) => ({
            subject: r.subject_name,
            conducted: Number(r.conducted_sessions),
            cancelled: Number(r.cancelled_sessions),
            present: Number(r.present_count),
            late: Number(r.late_count),
            absent: Number(r.absent_count),
            pct: Number(r.attendance_pct),
          }))
        );

        const subMap = new Map<string, any>();
        (subRes.data || []).forEach((s: any) => subMap.set(s.assignment_id, s));

        const activeSectionId = enrRow?.class_section_id;
        const relevantAsgs = (asgRes.data || []).filter((a: any) => !activeSectionId || a.teaching_assignments?.class_section_id === activeSectionId || subMap.has(a.id));

        setSubmissionRows(
          relevantAsgs.map((a: any) => {
            const s = subMap.get(a.id);
            const vers = s && Array.isArray(s.submission_versions) ? [...s.submission_versions].sort((x: any, y: any) => y.version_no - x.version_no) : [];
            const latest = vers[0];
            const ev = s ? (Array.isArray(s.evaluations) ? s.evaluations[0] : s.evaluations) : null;
            return {
              assignmentId: a.id,
              title: a.title,
              subject: a.teaching_assignments?.subjects?.name || 'Subject',
              due: new Date(a.due_at).toLocaleDateString(),
              maxMarks: Number(a.max_marks),
              submitted: Boolean(latest),
              late: Boolean(latest?.is_late),
              driveUrl: latest?.drive_url || '',
              marksObtained: ev?.marks_obtained ?? null,
              evalStatus: ev?.status || (latest ? 'not_evaluated' : 'pending'),
              feedback: ev?.feedback || '',
            };
          })
        );
      } catch (err: any) {
        if (!cancelled) setErrorMsg(err.message || 'Failed to load student dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [studentId, demo]);

  // Students can only view their own dedicated student dashboard page
  if (profile?.role === 'student' && studentId !== profile.id) {
    return <Navigate to="/student" replace />;
  }

  if (loading) {
    return <div className="erp-content"><div className="card">Loading student dashboard...</div></div>;
  }

  if (errorMsg || !student) {
    return (
      <div className="erp-content">
        <div className="page-header">
          <button className="btn" onClick={() => navigate(-1)}><ArrowLeft size={15} /> Back</button>
        </div>
        <div className="card" style={{ color: 'var(--danger)' }}>{errorMsg || 'Student not found.'}</div>
      </div>
    );
  }

  const totalConducted = attendanceRows.reduce((n, r) => n + r.conducted, 0);
  const weightedAtt = attendanceRows.reduce((n, r) => n + r.pct * r.conducted, 0);
  const overallPct = totalConducted > 0 ? `${Math.round((weightedAtt / totalConducted) * 10) / 10}%` : '—';
  const submittedCount = submissionRows.filter((r) => r.submitted).length;
  const publishedRows = submissionRows.filter((r) => r.evalStatus === 'published' && r.marksObtained !== null);
  const avgMarks = publishedRows.length > 0
    ? `${Math.round((publishedRows.reduce((n, r) => n + Number(r.marksObtained), 0) / publishedRows.reduce((n, r) => n + r.maxMarks, 0)) * 100)}%`
    : '—';

  return (
    <div className="erp-content">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={() => navigate(-1)}><ArrowLeft size={15} /> Back</button>
          {(() => {
              const m = (student.photo_drive_url || '').match(/\/d\/([a-zA-Z0-9_-]+)/) || (student.photo_drive_url || '').match(/[?&]id=([a-zA-Z0-9_-]+)/);
              const thumb = m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w300` : '';
              return thumb ? (
                <img src={thumb} alt={student.full_name} style={{ width: 54, height: 64, objectFit: 'cover', borderRadius: 10, border: '1.5px solid var(--primary)', background: '#fff' }} />
              ) : (
                <div className="avatar" style={{ width: 52, height: 52, fontSize: 26, borderRadius: 12 }}>{student.avatar_icon}</div>
              );
            })()}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ margin: 0 }}>{student.full_name}</h1>
              <span className="badge badge-primary mono">Roll #{student.roll_no}</span>
              <span className={`badge ${student.status === 'approved' ? 'badge-success' : 'badge-warn'}`}>{student.status.toUpperCase()}</span>
            </div>
            <p className="page-sub" style={{ marginTop: 4 }}>{student.department} · {student.specialization} · Batch {student.admission_year} · {student.class_label}</p>
          </div>
        </div>
        {profile?.role === 'admin' && (
          <Link to="/admin/users" className="btn" style={{ textDecoration: 'none' }}>Manage in Users &amp; Approvals</Link>
        )}
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="kpi-card"><div><div className="kpi-val">{overallPct}</div><div className="kpi-lbl">Overall Attendance</div><div className="kpi-sub">75% minimum required</div></div><div className="kpi-icon"><CheckCircle2 size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{attendanceRows.length}</div><div className="kpi-lbl">Tracked Subjects</div><div className="kpi-sub">Active curriculum</div></div><div className="kpi-icon"><BookOpen size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{submittedCount} / {submissionRows.length}</div><div className="kpi-lbl">Assignments Submitted</div><div className="kpi-sub">Google Drive links</div></div><div className="kpi-icon"><ClipboardList size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{avgMarks}</div><div className="kpi-lbl">Published Score Avg</div><div className="kpi-sub">{publishedRows.length} evaluated</div></div><div className="kpi-icon"><Award size={20} /></div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15.5, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}><User size={16} /> Student Profile &amp; Contact Details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, fontSize: 13.5 }}>
          <div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Email</div><div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={13} /> {student.email}</div></div>
          <div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Mobile</div><div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={13} /> {student.mobile}</div></div>
          <div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Gender</div><div>{student.gender}</div></div>
          <div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Date of Birth</div><div className="mono">{student.dob}</div></div>
          <div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Address</div><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={13} /> {student.address}</div></div>
          <div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Guardian</div><div>{student.guardian_name} ({student.guardian_phone})</div></div>
          <div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Blood Group</div><div className="mono">{student.blood_group}</div></div>
        </div>
        {student.bio && <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{student.bio}</p>}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Subject-Wise Attendance</div>
        <div className="erp-table-wrap"><table className="erp-table">
          <thead><tr><th>Subject</th><th>Conducted</th><th>Cancelled</th><th>Present / Late / Absent</th><th>Progress</th><th>Percentage</th></tr></thead>
          <tbody>
            {attendanceRows.length === 0 ? (
              <tr><td colSpan={6} style={{ color: 'var(--text-muted)' }}>No attendance sessions recorded for this student yet.</td></tr>
            ) : (
              attendanceRows.map((r) => (
                <tr key={r.subject}>
                  <td style={{ fontWeight: 600 }}>{r.subject}</td>
                  <td className="mono">{r.conducted}</td>
                  <td className="mono">{r.cancelled}</td>
                  <td className="mono">{r.present} / {r.late} / {r.absent}</td>
                  <td style={{ minWidth: 140 }}><div className="progress-track"><div className="progress-fill" style={{ width: `${r.pct}%` }} /></div></td>
                  <td><span className={`badge ${r.pct >= 75 ? 'badge-success' : 'badge-danger'}`}>{r.pct}%</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table></div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Assignments, Submissions &amp; Marks</div>
        <div className="erp-table-wrap"><table className="erp-table">
          <thead><tr><th>Assignment</th><th>Subject</th><th>Due</th><th>Submission</th><th>Marks</th><th>Feedback</th></tr></thead>
          <tbody>
            {submissionRows.length === 0 ? (
              <tr><td colSpan={6} style={{ color: 'var(--text-muted)' }}>No assignments found for this student's class yet.</td></tr>
            ) : (
              submissionRows.map((s) => (
                <tr key={s.assignmentId}>
                  <td style={{ fontWeight: 600 }}>{s.title}</td>
                  <td>{s.subject}</td>
                  <td className="mono">{s.due}</td>
                  <td>
                    {s.submitted ? (
                      <a href={s.driveUrl} target="_blank" rel="noreferrer" className="badge badge-success" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {s.late ? 'Submitted (Late)' : 'Submitted'} <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="badge badge-danger">Not Submitted</span>
                    )}
                  </td>
                  <td>
                    {s.marksObtained !== null ? (
                      <span className="badge badge-primary">{s.marksObtained} / {s.maxMarks} ({s.evalStatus})</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{s.feedback || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
};
