import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Award, CheckCircle2, ClipboardList, Clock, ExternalLink, Eye, GraduationCap, Link2, Printer } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { parseGoogleDriveLink } from '../../lib/driveLink';
import { localISODate } from '../../lib/dates';
import { isDemoProfile, supabase } from '../../lib/supabase';
import { UpcomingCalendarWidget } from '../../components/UpcomingCalendarWidget';
import { ToastMessage, ToastPopup } from '../../components/ToastPopup';

const DAY_NAMES: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

export const StudentDashboard: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [stats, setStats] = useState(
    demo
      ? { attendancePct: '88.5%', pendingCount: 2, latestMark: '18 / 20', subjectsCount: 5 }
      : { attendancePct: '—', pendingCount: 0, latestMark: '—', subjectsCount: 0 }
  );
  const [timetable, setTimetable] = useState<Array<{ id: string; time: string; subject: string; faculty: string; room: string }>>(
    demo ? [{ id: 't1', time: 'Mon 09:30', subject: 'DBMS (CS501)', faculty: 'Dr. Ananya Rao', room: 'Lab 302' }] : []
  );
  const [enrolledLabel, setEnrolledLabel] = useState<string>('');
  const [studentMeta, setStudentMeta] = useState<{ rollNo: string; dept: string; spec: string; year: string }>({ rollNo: '', dept: '', spec: '', year: '' });
  const [upcoming, setUpcoming] = useState<Array<{ id: string; title: string; subject: string; maxMarks: number; due: string }>>(
    demo ? [{ id: 'u1', title: 'OS Process Scheduling Lab', subject: 'Operating Systems', maxMarks: 25, due: '2026-11-22' }] : []
  );

  useEffect(() => {
    if (demo) return;
    Promise.all([
      supabase.from('v_student_attendance_summary').select('conducted_sessions, attendance_pct').eq('student_id', profile!.id),
      supabase.from('assignments').select('id, title, description, reference_url, due_at, max_marks, state, teaching_assignments(subjects(name))').eq('state', 'published').order('due_at', { ascending: true }),
      supabase.from('submissions').select('assignment_id').eq('student_id', profile!.id),
      supabase.from('evaluations').select('marks_obtained, submissions!inner(student_id, assignments(max_marks))').eq('submissions.student_id', profile!.id).not('published_at', 'is', null).order('published_at', { ascending: false }).limit(1),
      supabase.from('weekly_schedule_slots').select('id, day_of_week, start_time, room, teaching_assignments(subjects(code, name), profiles:faculty_id(full_name))').order('day_of_week'),
      supabase.from('teaching_assignments').select('id', { count: 'exact', head: true }),
      supabase.from('enrollments').select('class_sections(name, section_code, semesters(label))').eq('student_id', profile!.id).eq('is_active', true).limit(1),
      supabase.from('student_profiles').select('roll_no, admission_year').eq('user_id', profile!.id).maybeSingle(),
      profile?.department_id ? supabase.from('departments').select('name').eq('id', profile.department_id).maybeSingle() : Promise.resolve({ data: null }),
      profile?.specialization_id ? supabase.from('specializations').select('name').eq('id', profile.specialization_id).maybeSingle() : Promise.resolve({ data: null }),
    ]).then(([att, asg, sub, ev, sl, subjCount, enr, spRow, deptRow, specRow]: any) => {
      setStudentMeta({ rollNo: spRow?.data?.roll_no || '', dept: deptRow?.data?.name || '', spec: specRow?.data?.name || '', year: spRow?.data?.admission_year ? String(spRow.data.admission_year) : '' });
      const enrRow: any = enr.data?.[0]?.class_sections;
      if (enrRow) setEnrolledLabel(`${enrRow.name} · Sec ${enrRow.section_code}${enrRow.semesters?.label ? ` · ${enrRow.semesters.label}` : ''}`);
      // Overall % = conducted-weighted average of the per-subject percentages from the authoritative view
      // (respects cancelled sessions and the late_counts_as_present setting).
      const totalConducted = (att.data || []).reduce((n: number, r: any) => n + Number(r.conducted_sessions), 0);
      const weighted = (att.data || []).reduce((n: number, r: any) => n + Number(r.attendance_pct) * Number(r.conducted_sessions), 0);
      const pct = totalConducted > 0 ? `${Math.round((weighted / totalConducted) * 10) / 10}%` : '—';

      const submittedIds = new Set((sub.data || []).map((s: any) => s.assignment_id));
      const pendingAsg = (asg.data || []).filter((a: any) => !submittedIds.has(a.id));
      // (Overdue assignments stay in the list on purpose; the deadline itself is enforced in submit_assignment.)

      const latestEv: any = ev.data?.[0];
      const latestMark = latestEv ? `${latestEv.marks_obtained} / ${latestEv.submissions?.assignments?.max_marks ?? '?'}` : '—';

      setStats({
        attendancePct: pct,
        pendingCount: pendingAsg.length,
        latestMark,
        subjectsCount: subjCount.count || 0,
      });

      setUpcoming(
        pendingAsg.slice(0, 4).map((a: any) => ({
          id: a.id,
          title: a.title,
          subject: a.teaching_assignments?.subjects?.name || 'Subject',
          maxMarks: Number(a.max_marks),
          due: localISODate(new Date(a.due_at)),
        }))
      );

      if (sl.data) {
        setTimetable(
          sl.data.filter((s: any) => s.teaching_assignments).map((s: any) => ({
            id: s.id,
            time: `${DAY_NAMES[s.day_of_week] || ''} ${String(s.start_time).slice(0, 5)}`,
            subject: s.teaching_assignments?.subjects ? `${s.teaching_assignments.subjects.name} (${s.teaching_assignments.subjects.code})` : 'Subject',
            faculty: s.teaching_assignments?.profiles?.full_name || 'Faculty',
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
          <h1 className="page-title">Student Academic Portal</h1>
          <p className="page-sub">{demo ? 'Demo Preview · Aarav Sharma' : `${profile?.full_name}${studentMeta.rollNo ? ` · Roll #${studentMeta.rollNo}` : ''}${studentMeta.dept ? ` · ${studentMeta.dept}` : ''}${studentMeta.spec ? ` (${studentMeta.spec})` : ''}${studentMeta.year ? ` · Batch ${studentMeta.year}` : ''} · ${enrolledLabel || 'Not enrolled in a class yet'}`}</p>
        </div>
      </div>
      {!demo && (!profile?.mobile || !profile?.gender || !profile?.dob || !profile?.address || !profile?.guardian_name) && (
        <div className="card" style={{ marginBottom: 18, borderColor: 'var(--warning)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={18} color="var(--warning)" />
            <div>
              <strong>Complete Your Student Bio-Data</strong>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Please fill in your personal details (mobile, gender, DOB, address, guardian contact, and blood group). Academic fields are managed by Admin.</div>
            </div>
          </div>
          <Link to="/settings" className="btn btn-primary" style={{ textDecoration: 'none' }}>Fill Bio-Data Now</Link>
        </div>
      )}
      <div className="grid-4" style={{ marginBottom: 22 }}>
        <div className="kpi-card"><div><div className="kpi-val">{stats.attendancePct}</div><div className="kpi-lbl">Overall Attendance</div><div className="kpi-sub">75% minimum required</div></div><div className="kpi-icon"><CheckCircle2 size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{stats.pendingCount}</div><div className="kpi-lbl">Pending Assignments</div><div className="kpi-sub" style={{ color: 'var(--warning)' }}>Published &amp; awaiting link</div></div><div className="kpi-icon"><ClipboardList size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{stats.latestMark}</div><div className="kpi-lbl">Latest Published Mark</div><div className="kpi-sub">Evaluated by faculty</div></div><div className="kpi-icon"><Award size={20} /></div></div>
        <div className="kpi-card"><div><div className="kpi-val">{stats.subjectsCount}</div><div className="kpi-lbl">Total Subjects</div><div className="kpi-sub">Active curriculum</div></div><div className="kpi-icon"><GraduationCap size={20} /></div></div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}><h2 style={{ fontSize: 16, margin: 0 }}>Class Timetable</h2></div>
          <div className="erp-table-wrap"><table className="erp-table">
            <thead><tr><th>Day &amp; Time</th><th>Subject</th><th>Faculty</th><th>Room</th></tr></thead>
            <tbody>
              {timetable.length === 0 ? (
                <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No timetable slots published yet.</td></tr>
              ) : (
                timetable.map((t) => (
                  <tr key={t.id}><td className="mono">{t.time}</td><td><strong>{t.subject}</strong></td><td>{t.faculty}</td><td>{t.room}</td></tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Upcoming Deadlines</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {upcoming.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>No pending assignments right now.</div>
            ) : (
              upcoming.map((u) => (
                <div key={u.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><strong>{u.title}</strong><div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{u.subject} · Max {u.maxMarks} Marks</div></div>
                  <span className="badge badge-warn"><Clock size={12} /> Due {u.due}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <UpcomingCalendarWidget title="Holidays, College Events & Class Schedule" />
    </div>
  );
};

export const StudentAttendancePage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [attTab, setAttTab] = useState<'summary' | 'absent' | 'month'>('summary');
  const [rows, setRows] = useState<Array<{ subject: string; subjectType: string; conducted: number; cancelled: number; present: number; late: number; absent: number; pct: number }>>(
    demo ? [{ subject: 'Database Management Systems', subjectType: 'theory', conducted: 24, cancelled: 1, present: 21, late: 1, absent: 2, pct: 91.7 }] : []
  );
  const [allRecords, setAllRecords] = useState<Array<{ session_id: string; date: string; slot: number; subject: string; status: string }>>(
    demo ? [{ session_id: 's1', date: localISODate(), slot: 1, subject: 'DBMS', status: 'present' }] : []
  );
  const [disputable, setDisputable] = useState<Array<{ session_id: string; label: string; status: string }>>([]);
  const [reqSessionId, setReqSessionId] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqNotice, setReqNotice] = useState('');
  const [calMonth, setCalMonth] = useState(() => localISODate().slice(0, 7));

  useEffect(() => {
    if (demo) return;
    Promise.all([
      supabase.from('v_student_attendance_summary').select('*').eq('student_id', profile!.id),
      supabase.from('subjects').select('name, subject_type'),
      supabase.from('attendance_records').select('session_id, status, attendance_sessions(session_date, slot_number, teaching_assignments(subjects(name)))').eq('student_id', profile!.id).order('session_id'),
    ]).then(([sumRes, subRes, recRes]) => {
      const typeMap = new Map<string, string>();
      (subRes.data || []).forEach((sb: any) => typeMap.set(sb.name, sb.subject_type || 'theory'));
      if (sumRes.data) {
        setRows(
          sumRes.data.map((r: any) => ({
            subject: r.subject_name,
            subjectType: typeMap.get(r.subject_name) || 'theory',
            conducted: Number(r.conducted_sessions),
            cancelled: Number(r.cancelled_sessions),
            present: Number(r.present_count),
            late: Number(r.late_count),
            absent: Number(r.absent_count),
            pct: Number(r.attendance_pct),
          }))
        );
      }
      if (recRes.data) {
        const all = recRes.data
          .filter((d: any) => d.attendance_sessions?.session_date)
          .map((d: any) => ({
            session_id: d.session_id,
            date: d.attendance_sessions.session_date,
            slot: Number(d.attendance_sessions.slot_number || 1),
            subject: d.attendance_sessions?.teaching_assignments?.subjects?.name || 'Class',
            status: d.status,
          }))
          .sort((a: any, b: any) => b.date.localeCompare(a.date));
        setAllRecords(all);

        const disp = all
          .filter((d: any) => d.status === 'absent' || d.status === 'late')
          .map((d: any) => ({
            session_id: d.session_id,
            status: d.status,
            label: `${d.subject} · ${d.date} (Slot ${d.slot}) — Marked ${d.status}`,
          }));
        setDisputable(disp);
        if (disp.length > 0) setReqSessionId(disp[0].session_id);
      }
    });
  }, [demo, profile?.id]);

  const handleRequestCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (demo || !reqSessionId || !reqReason.trim()) return;
    const { error } = await supabase.from('attendance_correction_requests').insert({
      session_id: reqSessionId,
      student_id: profile!.id,
      requested_status: 'present',
      reason: reqReason.trim(),
      requested_by: profile!.id,
    });
    setReqNotice(error ? `Error: ${error.message}` : 'Correction request submitted for HOD/Admin review.');
    if (!error) setReqReason('');
  };

  const absentDays = allRecords.filter((r) => r.status === 'absent' || r.status === 'late');
  const [yrStr, moStr] = calMonth.split('-');
  const yr = Number(yrStr);
  const mo = Number(moStr) - 1;
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const firstDow = new Date(yr, mo, 1).getDay();

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Attendance</h1>
          <p className="page-sub">Authoritative subject-wise attendance (excluding cancelled sessions) with Absent Days &amp; Month View.</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={`btn ${attTab === 'summary' ? 'btn-primary' : ''}`} onClick={() => setAttTab('summary')}>Summary</button>
          <button className={`btn ${attTab === 'absent' ? 'btn-primary' : ''}`} onClick={() => setAttTab('absent')}>Absent Days ({absentDays.length})</button>
          <button className={`btn ${attTab === 'month' ? 'btn-primary' : ''}`} onClick={() => setAttTab('month')}>Month View</button>
          <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Print Attendance</button>
        </div>
      </div>

      <div className="print-only" style={{ marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid #0f172a' }}>
        <h2 style={{ margin: 0 }}>Official Student Attendance Report</h2>
        <div style={{ fontSize: 13, marginTop: 4 }}>Student: <strong>{profile?.full_name}</strong> ({profile?.email}) · Printed on {new Date().toLocaleDateString()}</div>
      </div>

      {attTab === 'summary' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div className="erp-table-wrap"><table className="erp-table">
            <thead><tr><th>Subject</th><th>Type</th><th>Conducted</th><th>Cancelled</th><th>Present / Late / Absent</th><th>Progress</th><th>Percentage</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ color: 'var(--text-muted)' }}>No attendance sessions recorded for you yet.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.subject}>
                    <td style={{ fontWeight: 600 }}>{r.subject}</td>
                    <td><span className="badge">{r.subjectType.toUpperCase()}</span></td>
                    <td className="mono">{r.conducted}</td>
                    <td className="mono">{r.cancelled}</td>
                    <td className="mono">{r.present} / {r.late} / {r.absent}</td>
                    <td style={{ minWidth: 150 }}><div className="progress-track"><div className="progress-fill" style={{ width: `${r.pct}%` }} /></div></td>
                    <td><span className={`badge ${r.pct >= 75 ? 'badge-success' : 'badge-danger'}`}>{r.pct}%</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {attTab === 'absent' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Absent &amp; Late Sessions ({absentDays.length})</div>
          <div className="erp-table-wrap"><table className="erp-table">
            <thead><tr><th>Date</th><th>Slot</th><th>Subject</th><th>Status</th></tr></thead>
            <tbody>
              {absentDays.length === 0 ? (
                <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>Zero absent or late days recorded.</td></tr>
              ) : (
                absentDays.map((d, idx) => (
                  <tr key={`${d.session_id}-${idx}`}>
                    <td className="mono">{d.date}</td>
                    <td className="mono">Slot {d.slot}</td>
                    <td style={{ fontWeight: 600 }}>{d.subject}</td>
                    <td><span className={`badge ${d.status === 'absent' ? 'badge-danger' : 'badge-warn'}`}>{d.status.toUpperCase()}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {attTab === 'month' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <strong>Monthly Attendance Calendar</strong>
            <input type="month" style={{ width: 'auto' }} value={calMonth} onChange={(e) => setCalMonth(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>{d}</div>
            ))}
            {Array.from({ length: firstDow }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const iso = `${calMonth}-${String(dayNum).padStart(2, '0')}`;
              const dayRecs = allRecords.filter((r) => r.date === iso);
              return (
                <div key={iso} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6, minHeight: 62, fontSize: 11.5 }}>
                  <div className="mono" style={{ fontWeight: 700, marginBottom: 4 }}>{dayNum}</div>
                  {dayRecs.map((dr, j) => (
                    <div key={j} className={`badge ${dr.status === 'present' ? 'badge-success' : dr.status === 'late' ? 'badge-warn' : 'badge-danger'}`} style={{ fontSize: 10, padding: '1px 5px', marginBottom: 2, display: 'block' }}>
                      {dr.status.slice(0, 1).toUpperCase()} · {dr.subject.slice(0, 8)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!demo && disputable.length > 0 && (
        <div className="card no-print">
          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>Request Attendance Correction</h2>
          {reqNotice && <div className="badge badge-primary" style={{ marginBottom: 10 }}>{reqNotice}</div>}
          <form onSubmit={handleRequestCorrection} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Session</label>
              <select value={reqSessionId} onChange={(e) => setReqSessionId(e.target.value)}>
                {disputable.map((d) => <option key={d.session_id} value={d.session_id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Reason</label>
              <input value={reqReason} onChange={(e) => setReqReason(e.target.value)} placeholder="e.g. Marked absent during lab roll call" required />
            </div>
            <button type="submit" className="btn btn-primary">Submit Request</button>
          </form>
        </div>
      )}
    </div>
  );
};

interface StudentAssignmentItem {
  id: string;
  title: string;
  subject: string;
  due: string;
  maxMarks: number;
  state: string;
  description?: string;
  referenceUrl?: string;
  submissionId?: string;
  submissionStatus?: string;
  marksPublished?: boolean;
  resubReqStatus?: 'pending' | 'approved' | 'rejected' | null;
  versions: Array<{ version: number; url: string; submittedAt: string }>;
}

export const StudentAssignmentsPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [assignments, setAssignments] = useState<StudentAssignmentItem[]>(
    demo ? [{ id: 'demo-a1', title: 'OS Process Scheduling Lab', subject: 'Operating Systems', due: '2026-11-22', maxMarks: 25, state: 'published', versions: [] }] : []
  );
  const [driveUrls, setDriveUrls] = useState<Record<string, string>>({});
  const [confirmedMap, setConfirmedMap] = useState<Record<string, boolean>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<{ title: string; version: number; timestamp: string; status: string } | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [resubReasons, setResubReasons] = useState<Record<string, string>>({});
  const [showResubBox, setShowResubBox] = useState<Record<string, boolean>>({});
  const [expandedSubmitted, setExpandedSubmitted] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadAssignments = async () => {
    if (demo) return;
    const [asgRes, subRes, reqRes] = await Promise.all([
      supabase
        .from('assignments')
        .select('id, title, description, reference_url, due_at, max_marks, state, teaching_assignments(subjects(name))')
        .in('state', ['published', 'closed'])
        .order('due_at', { ascending: true }),
      supabase
        .from('submissions')
        .select('id, assignment_id, status, submission_versions(version_no, drive_url, submitted_at), evaluations(status)')
        .eq('student_id', profile!.id),
      supabase
        .from('resubmission_requests')
        .select('submission_id, status')
        .eq('student_id', profile!.id)
        .order('created_at', { ascending: false }),
    ]);

    if (asgRes.data) {
      const reqMap: Record<string, 'pending' | 'approved' | 'rejected'> = {};
      (reqRes.data || []).forEach((r: any) => {
        if (!reqMap[r.submission_id]) reqMap[r.submission_id] = r.status;
      });
      const subMap: Record<string, { id: string; status: string; marksPublished: boolean; versions: Array<{ version: number; url: string; submittedAt: string }> }> = {};
      (subRes.data || []).forEach((s: any) => {
        const vers = (s.submission_versions || [])
          .sort((a: any, b: any) => b.version_no - a.version_no)
          .map((v: any) => ({ version: v.version_no, url: v.drive_url, submittedAt: new Date(v.submitted_at).toLocaleString() }));
        const ev = Array.isArray(s.evaluations) ? s.evaluations[0] : s.evaluations;
        subMap[s.assignment_id] = {
          id: s.id,
          status: s.status,
          marksPublished: ev?.status === 'published',
          versions: vers,
        };
      });
      setAssignments(
        asgRes.data.map((a: any) => {
          const sm = subMap[a.id];
          return {
            id: a.id,
            title: a.title,
            subject: a.teaching_assignments?.subjects?.name || 'Subject',
            due: localISODate(new Date(a.due_at)),
            maxMarks: Number(a.max_marks),
            state: a.state,
            description: a.description || '',
            referenceUrl: a.reference_url || '',
            submissionId: sm?.id,
            submissionStatus: sm?.status,
            marksPublished: sm?.marksPublished || false,
            resubReqStatus: sm?.id ? (reqMap[sm.id] || null) : null,
            versions: sm?.versions || [],
          };
        })
      );
    }
  };

  useEffect(() => {
    loadAssignments();
  }, [demo, profile?.id]);

  const handleSubmit = async (e: React.FormEvent, asg: StudentAssignmentItem) => {
    e.preventDefault();
    const rawUrl = driveUrls[asg.id] || '';
    const parsed = parseGoogleDriveLink(rawUrl);
    if (!parsed.valid) return;

    if (demo) {
      setAssignments((prev) =>
        prev.map((item) =>
          item.id === asg.id
            ? { ...item, versions: [{ version: item.versions.length + 1, url: parsed.openUrl, submittedAt: new Date().toLocaleString() }, ...item.versions] }
            : item
        )
      );
      setPreviewId(asg.id);
      return;
    }

    if (!confirmedMap[asg.id] || submittingId === asg.id) {
      if (!confirmedMap[asg.id]) setNotice('Please review the preview and check the confirmation box before submitting.');
      return;
    }

    setSubmittingId(asg.id);
    try {
      const { data, error } = await supabase.rpc('submit_assignment', {
        p_assignment_id: asg.id,
        p_drive_url: parsed.openUrl,
        p_drive_file_id: parsed.fileId || '',
      });
      if (error) throw error;

      const verNo = data?.version_no || asg.versions.length + 1;
      const isLate = Boolean(data?.is_late);
      setReceipt({
        title: asg.title,
        version: verNo,
        timestamp: new Date().toLocaleString(),
        status: isLate ? 'Submitted (Late)' : 'Submitted (On Time)',
      });
      setNotice(`Submitted v${verNo} for "${asg.title}" successfully!`);
      setToast({ type: 'success', text: `Submission successful! "${asg.title}" (v${verNo}) saved.` });
      setConfirmedMap((prev) => ({ ...prev, [asg.id]: false }));
      await loadAssignments();
    } catch (err: any) {
      setNotice(`Error submitting: ${err.message}`);
      setToast({ type: 'error', text: `Submission failed: ${err.message}` });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="erp-content">
      <ToastPopup toast={toast} onClose={() => setToast(null)} />
      <div className="page-header">
        <div>
          <h1 className="page-title">My Assignments</h1>
          <p className="page-sub">Upload your PDF (under 25 MB) to Google Drive with "Anyone with the link – Commenter or Editor" access, paste the link below, preview, and submit.</p>
        </div>
      </div>

      {notice && <div className="badge badge-primary" style={{ marginBottom: 14, padding: '6px 12px' }}>{notice}</div>}
      {receipt && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--success)' }}>
          <strong>Submission Receipt:</strong> {receipt.title} · <span className="badge badge-success">v{receipt.version}</span> · {receipt.status} · <span className="mono">{receipt.timestamp}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {assignments.length === 0 ? (
          <div className="card" style={{ color: 'var(--text-muted)' }}>No assignments published by faculty yet.</div>
        ) : (
          assignments.map((asg) => {
            const rawUrl = driveUrls[asg.id] || '';
            const parsed = parseGoogleDriveLink(rawUrl);
            const showPrev = previewId === asg.id && parsed.previewUrl;
            const isClosed = asg.state !== 'published';
            const canSubmitForm = !isClosed && (asg.versions.length === 0 || asg.submissionStatus === 'resubmission_requested');
            const isLockedSubmitted = asg.versions.length > 0 && asg.submissionStatus !== 'resubmission_requested';
            const isCompactSubmitted = isLockedSubmitted && !expandedSubmitted[asg.id];
            if (isCompactSubmitted) {
              return (
                <div key={asg.id} className="card assignment-card assignment-card-submitted" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span className="badge badge-success">✅ Submitted (v{asg.versions[0].version})</span>
                      <strong style={{ fontSize: 14.5 }}>{asg.title}</strong>
                      <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                        {asg.subject} · Due: {asg.due} · {asg.maxMarks} marks
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {asg.versions[0]?.url && (
                        <a href={asg.versions[0].url} target="_blank" rel="noreferrer" className="btn" style={{ padding: '4px 10px', fontSize: 12 }}>
                          View File <ExternalLink size={12} />
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => setExpandedSubmitted((prev) => ({ ...prev, [asg.id]: true }))}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={asg.id} className={`card assignment-card ${isLockedSubmitted ? 'assignment-card-submitted' : 'assignment-card-pending'}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <div>
                    <strong style={{ fontSize: 16 }}>{asg.title}</strong>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                      {asg.subject} · Due: {asg.due} · Max Marks: {asg.maxMarks}
                    </div>
                    {asg.description && <div style={{ fontSize: 13, marginTop: 6 }}>{asg.description}</div>}
                    {asg.referenceUrl && <a href={asg.referenceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, color: "var(--primary)" }}>Reference Material <ExternalLink size={12} /></a>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isClosed && <span className="badge badge-danger">Closed by Faculty</span>}
                    <span className={`badge ${asg.versions.length ? 'badge-success' : 'badge-warn'}`}>
                      {asg.versions.length ? `✅ Submitted (v${asg.versions[0].version})` : 'Not Submitted'}
                    </span>
                    {isLockedSubmitted && (
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '3px 9px', fontSize: 12 }}
                        onClick={() => setExpandedSubmitted((prev) => ({ ...prev, [asg.id]: false }))}
                      >
                        Minimize
                      </button>
                    )}
                  </div>
                </div>

                {isLockedSubmitted && asg.submissionId && (
                  <div style={{ padding: 12, borderRadius: 8, background: 'var(--surface-alt)', border: '1px solid var(--border)', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ fontSize: 13 }}>
                        <strong>{asg.marksPublished ? 'Marks Published — Submission Locked' : 'Submission Locked'}</strong>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Submitted work cannot be undone. Request faculty approval if you need to resubmit.</div>
                      </div>
                      {asg.resubReqStatus === 'pending' ? (
                        <span className="badge badge-warn">Resubmission Request Pending</span>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setShowResubBox((prev) => ({ ...prev, [asg.id]: !prev[asg.id] }))}
                        >
                          Ask Resubmission Request
                        </button>
                      )}
                    </div>
                    {showResubBox[asg.id] && asg.resubReqStatus !== 'pending' && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const reason = (resubReasons[asg.id] || '').trim();
                          if (!reason || !asg.submissionId) return;
                          const { error } = await supabase.rpc('student_request_resubmission', {
                            p_submission_id: asg.submissionId,
                            p_reason: reason,
                          });
                          setNotice(error ? `Error: ${error.message}` : `Resubmission request sent to faculty for "${asg.title}".`);
                          setToast(error ? { type: 'error', text: `Request failed: ${error.message}` } : { type: 'success', text: `Resubmission request sent for "${asg.title}".` });
                          if (!error) {
                            setResubReasons((prev) => ({ ...prev, [asg.id]: '' }));
                            setShowResubBox((prev) => ({ ...prev, [asg.id]: false }));
                            await loadAssignments();
                          }
                        }}
                        style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}
                      >
                        <input
                          style={{ flex: 1, minWidth: 220 }}
                          value={resubReasons[asg.id] || ''}
                          onChange={(e) => setResubReasons((prev) => ({ ...prev, [asg.id]: e.target.value }))}
                          placeholder="Reason for requesting resubmission..."
                          required
                        />
                        <button type="submit" className="btn btn-primary">Send Request</button>
                      </form>
                    )}
                  </div>
                )}

                {canSubmitForm && (
                  <form onSubmit={(e) => handleSubmit(e, asg)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      <strong>Upload Requirements:</strong> File must be a <strong>PDF under 25 MB</strong> with Google Drive sharing set to <strong>Anyone with the link – Commenter or Editor</strong> (so the live preview loads properly). Share <strong>individual assignment files only</strong>—never share an entire Drive folder.
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <input
                          type="url"
                          value={rawUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDriveUrls((prev) => ({ ...prev, [asg.id]: val }));
                            setConfirmedMap((prev) => ({ ...prev, [asg.id]: false }));
                            const p = parseGoogleDriveLink(val);
                            if (p.valid) { setPreviewId(asg.id); setIframeLoading(true); }
                          }}
                          placeholder="https://drive.google.com/file/d/****/view"
                          required
                        />
                      </div>
                      <button type="button" className="btn" disabled={!parsed.valid} onClick={() => { setPreviewId(previewId === asg.id ? null : asg.id); setIframeLoading(true); }}>
                        <Eye size={15} /> {previewId === asg.id ? 'Hide Preview' : 'Preview Link'}
                      </button>
                    </div>
                    {rawUrl.trim() && !parsed.valid && (
                      <div className="badge badge-danger" style={{ alignSelf: 'flex-start' }}>
                        Invalid Google Drive link. Use an https://drive.google.com/file/d/... or https://docs.google.com/... URL.
                      </div>
                    )}
                    {parsed.valid && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          style={{ width: 'auto' }}
                          checked={Boolean(confirmedMap[asg.id])}
                          onChange={(e) => setConfirmedMap((prev) => ({ ...prev, [asg.id]: e.target.checked }))}
                        />
                        <span>I have reviewed the preview and this is my final assignment.</span>
                      </label>
                    )}
                    <div>
                      <button type="submit" className="btn btn-primary" disabled={!parsed.valid || !confirmedMap[asg.id] || submittingId === asg.id}>
                        <Link2 size={15} /> {asg.versions.length ? 'Resubmit Assignment' : 'Submit Assignment'}
                      </button>
                    </div>
                  </form>
                )}

                {asg.versions.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>SUBMISSION VERSION HISTORY</div>
                    {asg.versions.map((v) => (
                      <div key={v.version} style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                        <span className="badge badge-primary">v{v.version}</span>
                        <span className="mono">{v.submittedAt}</span>
                        <a href={v.url} target="_blank" rel="noreferrer">Open Drive Link</a>
                      </div>
                    ))}
                  </div>
                )}

                {showPrev && (
                  <div style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', background: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                      <strong>Google Drive Live Preview {iframeLoading ? '(Loading...)' : ''}</strong>
                      <a href={parsed.openUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)' }}>
                        Open in Google Drive <ExternalLink size={13} />
                      </a>
                    </div>
                    <iframe title={`Drive Preview ${asg.id}`} src={parsed.previewUrl || undefined} onLoad={() => setIframeLoading(false)} style={{ width: '100%', height: 420, border: 'none', background: '#fff' }} />
                    <div style={{ padding: '6px 14px', fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-alt)' }}>
                      If preview shows Download or Access Denied, ensure your file is a PDF under 25 MB and set Google Drive sharing to "Anyone with the link – Commenter or Editor", or click "Open in Google Drive" to verify.
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const StudentMarksPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [marks, setMarks] = useState<Array<{ id: string; title: string; subject: string; obtained: number; max: number; feedback: string }>>(
    demo ? [{ id: 'm1', title: 'DBMS Assignment 01', subject: 'DBMS', obtained: 18, max: 20, feedback: 'Well-structured ER diagram.' }] : []
  );

  useEffect(() => {
    if (demo) return;
    supabase
      .from('evaluations')
      .select('id, marks_obtained, feedback, submissions!inner(student_id, assignments(title, max_marks, teaching_assignments(subjects(name))))')
      .eq('submissions.student_id', profile!.id)
      .not('published_at', 'is', null)
      .then(({ data }) => {
        if (data) {
          setMarks(
            data.map((e: any) => ({
              id: e.id,
              title: e.submissions?.assignments?.title || 'Assignment',
              subject: e.submissions?.assignments?.teaching_assignments?.subjects?.name || 'Subject',
              obtained: Number(e.marks_obtained || 0),
              max: Number(e.submissions?.assignments?.max_marks ?? 0),
              feedback: e.feedback || '',
            }))
          );
        }
      });
  }, [demo, profile?.id]);

  return (
    <div className="erp-content">
      <div className="page-header"><div><h1 className="page-title">Marks & Feedback</h1><p className="page-sub">Evaluations released by faculty.</p></div></div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="erp-table-wrap"><table className="erp-table">
          <thead><tr><th>Assignment</th><th>Subject</th><th>Marks</th><th>Faculty Feedback</th></tr></thead>
          <tbody>
            {marks.length === 0 ? (
              <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No marks published by faculty yet.</td></tr>
            ) : (
              marks.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.title}</td>
                  <td>{m.subject}</td>
                  <td><span className="badge badge-success">{m.obtained} / {m.max}</span></td>
                  <td>{m.feedback || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
};
