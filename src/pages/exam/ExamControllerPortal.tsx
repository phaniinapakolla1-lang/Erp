import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Award, Building2, CheckCircle2, Eye, Palette, Plus, Printer, Save, Search, Ticket, Trash2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { compressImageFileToDataUrl } from '../../lib/localPrefs';
import { isDemoProfile, supabase } from '../../lib/supabase';
import { ToastMessage, ToastPopup } from '../../components/ToastPopup';
import {
  CollegeBranding,
  DEFAULT_HALL_TICKET_TEMPLATE,
  drivePhotoToImgSrc,
  HallTicketPrintData,
  HallTicketSheet,
  HallTicketSubjectItem,
  HallTicketTemplateConfig,
} from '../../components/HallTicketSheet';

interface ExamCycleRow {
  id: string;
  title: string;
  semester_label: string;
  exam_type: 'regular' | 'supplementary';
  max_marks: number;
  min_pass_marks: number;
  instructions: string;
  results_published: boolean;
  results_external_url: string | null;
}

interface StudentChecklistRow {
  student_id: string;
  full_name: string;
  email: string;
  roll_no: string;
  department: string;
  specialization: string;
  class_name: string;
  section_code: string;
  class_section_id: string | null;
  photo_drive_url: string;
  bio_complete: boolean;
  attendance_pct: number | null;
  ticket_id?: string;
  hall_ticket_no: string;
  chk_biodata: boolean;
  chk_photo: boolean;
  chk_attendance: boolean;
  chk_fee: boolean;
  chk_subjects: boolean;
  is_approved: boolean;
  regular_subjects: HallTicketSubjectItem[];
  supplementary_subjects: HallTicketSubjectItem[];
}

export const ExamControllerPortal: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [tab, setTab] = useState<'checklist' | 'results' | 'cycles' | 'branding' | 'designer'>('checklist');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Exam Cycles
  const [cycles, setCycles] = useState<ExamCycleRow[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [newCycleTitle, setNewCycleTitle] = useState('');
  const [newCycleSem, setNewCycleSem] = useState('Semester 1');
  const [newCycleType, setNewCycleType] = useState<'regular' | 'supplementary'>('regular');
  const [newCycleMax, setNewCycleMax] = useState(100);
  const [newCyclePass, setNewCyclePass] = useState(40);
  const [newCycleInstr, setNewCycleInstr] = useState('');

  // Students + Hall Tickets + Subjects
  const [students, setStudents] = useState<StudentChecklistRow[]>([]);
  const [allSubjects, setAllSubjects] = useState<Array<{ id: string; code: string; name: string; subject_type: string }>>([]);
  const [sectionSubjectsMap, setSectionSubjectsMap] = useState<Record<string, HallTicketSubjectItem[]>>({});
  const [previewTicket, setPreviewTicket] = useState<HallTicketPrintData | null>(null);
  const [suppModalStudentId, setSuppModalStudentId] = useState<string | null>(null);
  const [suppSubjectId, setSuppSubjectId] = useState('');
  const [suppDate, setSuppDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');

  // Results Entry
  const [resStudentId, setResStudentId] = useState('');
  const [resSubjectId, setResSubjectId] = useState('');
  const [resMarks, setResMarks] = useState('');
  const [resAbsent, setResAbsent] = useState(false);
  const [resExternalUrl, setResExternalUrl] = useState('');
  const [cycleResults, setCycleResults] = useState<Array<{ id: string; student_name: string; roll_no: string; subject: string; marks_obtained: number | null; max_marks: number; pass_marks: number; status: string; is_published: boolean }>>([]);

  // Branding (DB stored)
  const [branding, setBranding] = useState<CollegeBranding>({
    college_name: 'St. Xavier Institute',
    college_subtitle: 'Autonomous College · Self-Center Examinations',
    college_address: '',
    college_logo_data: '',
    principal_sign_data: '',
    college_stamp_data: '',
    default_exam_instructions: DEFAULT_HALL_TICKET_TEMPLATE ? '1. Carry this Hall Ticket and College ID.\n2. Report 15 minutes early.\n3. Electronic gadgets are prohibited.' : '',
    hall_ticket_template: DEFAULT_HALL_TICKET_TEMPLATE,
  });
  const [template, setTemplate] = useState<HallTicketTemplateConfig>(DEFAULT_HALL_TICKET_TEMPLATE);

  const loadAll = async () => {
    if (demo) return;
    const [setRes, cycRes, subRes, taRes, profRes, spRes, enrRes, deptRes, specRes, attRes] = await Promise.all([
      supabase.from('erp_settings').select('college_name, college_subtitle, college_address, college_logo_data, principal_sign_data, college_stamp_data, default_exam_instructions, hall_ticket_template').eq('id', 1).maybeSingle(),
      supabase.from('exam_cycles').select('*').order('created_at', { ascending: false }),
      supabase.from('subjects').select('id, code, name, subject_type').order('code'),
      supabase.from('teaching_assignments').select('class_section_id, subjects(code, name, subject_type)'),
      supabase.from('profiles').select('id, full_name, email, mobile, gender, dob, address, guardian_name, department_id, specialization_id, photo_drive_url').eq('role', 'student').eq('status', 'approved').order('full_name'),
      supabase.from('student_profiles').select('user_id, roll_no'),
      supabase.from('enrollments').select('student_id, class_section_id, class_sections(name, section_code)').eq('is_active', true),
      supabase.from('departments').select('id, name'),
      supabase.from('specializations').select('id, name'),
      supabase.from('v_student_attendance_summary').select('student_id, conducted_sessions, attendance_pct'),
    ]);

    if (setRes.data) {
      const b: CollegeBranding = {
        college_name: setRes.data.college_name || 'College ERP',
        college_subtitle: setRes.data.college_subtitle || '',
        college_address: setRes.data.college_address || '',
        college_logo_data: setRes.data.college_logo_data || '',
        principal_sign_data: setRes.data.principal_sign_data || '',
        college_stamp_data: setRes.data.college_stamp_data || '',
        default_exam_instructions: setRes.data.default_exam_instructions || '',
        hall_ticket_template: setRes.data.hall_ticket_template || DEFAULT_HALL_TICKET_TEMPLATE,
      };
      setBranding(b);
      if (setRes.data.hall_ticket_template) {
        setTemplate({ ...DEFAULT_HALL_TICKET_TEMPLATE, ...setRes.data.hall_ticket_template });
      }
      if (!newCycleInstr && b.default_exam_instructions) setNewCycleInstr(b.default_exam_instructions);
    }

    const cycList = (cycRes.data || []) as ExamCycleRow[];
    setCycles(cycList);
    const activeCycle = selectedCycleId && cycList.some((c) => c.id === selectedCycleId) ? selectedCycleId : (cycList[0]?.id || '');
    if (activeCycle && activeCycle !== selectedCycleId) setSelectedCycleId(activeCycle);

    const subs = (subRes.data || []) as Array<{ id: string; code: string; name: string; subject_type: string }>;
    setAllSubjects(subs);
    if (subs.length > 0 && !resSubjectId) setResSubjectId(subs[0].id);
    if (subs.length > 0 && !suppSubjectId) setSuppSubjectId(subs[0].id);

    const secSubMap: Record<string, HallTicketSubjectItem[]> = {};
    (taRes.data || []).forEach((ta: any) => {
      if (!ta.class_section_id || !ta.subjects) return;
      secSubMap[ta.class_section_id] = secSubMap[ta.class_section_id] || [];
      if (!secSubMap[ta.class_section_id].some((x) => x.code === ta.subjects.code)) {
        secSubMap[ta.class_section_id].push({
          code: ta.subjects.code,
          name: ta.subjects.name,
          type: ta.subjects.subject_type || 'theory',
          exam_date: 'As per schedule',
        });
      }
    });
    setSectionSubjectsMap(secSubMap);

    const rollMap = Object.fromEntries((spRes.data || []).map((r: any) => [r.user_id, r.roll_no]));
    const deptMap = Object.fromEntries((deptRes.data || []).map((d: any) => [d.id, d.name]));
    const specMap = Object.fromEntries((specRes.data || []).map((sp: any) => [sp.id, sp.name]));
    const enrMap: Record<string, { secId: string; name: string; code: string }> = {};
    (enrRes.data || []).forEach((e: any) => {
      if (e.class_sections) enrMap[e.student_id] = { secId: e.class_section_id, name: e.class_sections.name, code: e.class_sections.section_code };
    });

    const attMap: Record<string, { conducted: number; weighted: number }> = {};
    (attRes.data || []).forEach((a: any) => {
      const cur = attMap[a.student_id] || { conducted: 0, weighted: 0 };
      cur.conducted += Number(a.conducted_sessions);
      cur.weighted += Number(a.attendance_pct) * Number(a.conducted_sessions);
      attMap[a.student_id] = cur;
    });

    let htMap: Record<string, any> = {};
    if (activeCycle) {
      const [htRes, resQ] = await Promise.all([
        supabase.from('exam_hall_tickets').select('*').eq('exam_cycle_id', activeCycle),
        supabase.from('exam_results').select('id, student_id, marks_obtained, max_marks, pass_marks, status, is_published, subjects(code, name)').eq('exam_cycle_id', activeCycle).order('updated_at', { ascending: false }),
      ]);
      (htRes.data || []).forEach((h: any) => { htMap[h.student_id] = h; });

      const profNameMap = Object.fromEntries((profRes.data || []).map((p: any) => [p.id, p.full_name]));
      if (resQ.data) {
        setCycleResults(
          resQ.data.map((r: any) => ({
            id: r.id,
            student_name: profNameMap[r.student_id] || 'Student',
            roll_no: rollMap[r.student_id] || '—',
            subject: r.subjects ? `${r.subjects.code} — ${r.subjects.name}` : 'Subject',
            marks_obtained: r.marks_obtained !== null ? Number(r.marks_obtained) : null,
            max_marks: Number(r.max_marks),
            pass_marks: Number(r.pass_marks),
            status: r.status,
            is_published: Boolean(r.is_published),
          }))
        );
      }
    }

    const mappedStudents: StudentChecklistRow[] = (profRes.data || []).map((p: any) => {
      const roll = rollMap[p.id] || '—';
      const enr = enrMap[p.id];
      const att = attMap[p.id];
      const attPct = att && att.conducted > 0 ? Math.round((att.weighted / att.conducted) * 10) / 10 : null;
      const ht = htMap[p.id];
      const bioOk = Boolean(p.mobile && p.gender && p.dob && p.address);
      const defaultRegs = enr?.secId ? (secSubMap[enr.secId] || []) : [];
      return {
        student_id: p.id,
        full_name: p.full_name,
        email: p.email,
        roll_no: roll,
        department: deptMap[p.department_id] || 'Unassigned',
        specialization: specMap[p.specialization_id] || 'General',
        class_name: enr?.name || 'Not Enrolled',
        section_code: enr?.code || '—',
        class_section_id: enr?.secId || null,
        photo_drive_url: p.photo_drive_url || '',
        bio_complete: bioOk,
        attendance_pct: attPct,
        ticket_id: ht?.id,
        hall_ticket_no: ht?.hall_ticket_no || `HT-${String(roll).replace(/\s+/g, '') || p.id.slice(0, 6).toUpperCase()}`,
        chk_biodata: ht ? Boolean(ht.chk_biodata) : bioOk,
        chk_photo: ht ? Boolean(ht.chk_photo) : Boolean(p.photo_drive_url),
        chk_attendance: ht ? Boolean(ht.chk_attendance) : (attPct !== null && attPct >= 75),
        chk_fee: ht ? Boolean(ht.chk_fee) : false,
        chk_subjects: ht ? Boolean(ht.chk_subjects) : defaultRegs.length > 0,
        is_approved: Boolean(ht?.is_approved),
        regular_subjects: Array.isArray(ht?.regular_subjects) && ht.regular_subjects.length > 0 ? ht.regular_subjects : defaultRegs,
        supplementary_subjects: Array.isArray(ht?.supplementary_subjects) ? ht.supplementary_subjects : [],
      };
    });

    setStudents(mappedStudents);
    if (mappedStudents.length > 0 && !resStudentId) setResStudentId(mappedStudents[0].student_id);
  };

  useEffect(() => {
    loadAll();
  }, [demo, selectedCycleId]);

  const activeCycleObj = cycles.find((c) => c.id === selectedCycleId);
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    const matchQ = !q || s.full_name.toLowerCase().includes(q) || s.roll_no.toLowerCase().includes(q) || s.class_name.toLowerCase().includes(q) || s.department.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || (statusFilter === 'approved' ? s.is_approved : !s.is_approved);
    return matchQ && matchStatus;
  });
  const readyCount = students.filter((s) => s.chk_biodata && s.chk_photo && s.chk_attendance && s.chk_fee && s.chk_subjects).length;
  const approvedCount = students.filter((s) => s.is_approved).length;
  const publishedCount = cycleResults.filter((r) => r.is_published).length;

  const upsertTicket = async (stu: StudentChecklistRow, patch: Partial<StudentChecklistRow>, successText?: string) => {
    if (!selectedCycleId) {
      setToast({ type: 'error', text: 'Create an Exam Cycle first.' });
      return;
    }
    const merged = { ...stu, ...patch };
    const { error } = await supabase.from('exam_hall_tickets').upsert(
      {
        exam_cycle_id: selectedCycleId,
        student_id: stu.student_id,
        hall_ticket_no: merged.hall_ticket_no,
        chk_biodata: merged.chk_biodata,
        chk_photo: merged.chk_photo,
        chk_attendance: merged.chk_attendance,
        chk_fee: merged.chk_fee,
        chk_subjects: merged.chk_subjects,
        is_approved: merged.is_approved,
        approved_by: merged.is_approved ? profile!.id : null,
        approved_at: merged.is_approved ? new Date().toISOString() : null,
        regular_subjects: merged.regular_subjects,
        supplementary_subjects: merged.supplementary_subjects,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'exam_cycle_id,student_id' }
    );
    if (error) {
      setToast({ type: 'error', text: `Error saving Hall Ticket: ${error.message}` });
    } else {
      if (successText) setToast({ type: 'success', text: successText });
      await loadAll();
    }
  };

  const buildPrintData = (stu: StudentChecklistRow): HallTicketPrintData => ({
    hall_ticket_no: stu.hall_ticket_no,
    exam_title: activeCycleObj?.title || 'End-Semester Examinations',
    semester_label: activeCycleObj?.semester_label || 'Semester 1',
    exam_type: activeCycleObj?.exam_type || 'regular',
    student_name: stu.full_name,
    roll_no: stu.roll_no,
    department: stu.department,
    specialization: stu.specialization,
    class_name: stu.class_name,
    section_code: stu.section_code,
    photo_drive_url: stu.photo_drive_url,
    regular_subjects: stu.regular_subjects,
    supplementary_subjects: stu.supplementary_subjects,
    instructions: activeCycleObj?.instructions || branding.default_exam_instructions,
  });

  const samplePreviewData: HallTicketPrintData = students[0]
    ? buildPrintData(students[0])
    : {
        hall_ticket_no: 'HT-24MCA101',
        exam_title: activeCycleObj?.title || 'Semester 1 End-Sem Examinations',
        semester_label: 'Semester 1',
        exam_type: 'regular',
        student_name: 'Student Name',
        roll_no: '24MCA101',
        department: 'Computer Science',
        specialization: 'AI & ML',
        class_name: 'MCA Year 1',
        section_code: 'A',
        photo_drive_url: '',
        regular_subjects: [
          { code: 'CS501', name: 'Database Management Systems', type: 'theory', exam_date: '2026-12-05' },
          { code: 'CS503L', name: 'DBMS & SQL Lab', type: 'practical', exam_date: '2026-12-08' },
        ],
        supplementary_subjects: [{ code: 'CS402', name: 'Discrete Mathematics', type: 'supplementary', exam_date: '2026-12-12' }],
        instructions: branding.default_exam_instructions,
      };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= template.sections.length) return;
    const copy = [...template.sections];
    const [item] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, item);
    setTemplate({ ...template, preset: 'custom', sections: copy });
  };

  return (
    <div className="erp-content">
      <ToastPopup toast={toast} onClose={() => setToast(null)} />

      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Examination Control Centre</h1>
          <p className="page-sub">Verify student checklists (✅), approve printable Hall Tickets, publish results with auto-supplementary generation, and customize college branding.</p>
        </div>
        {cycles.length > 0 && (
          <select style={{ width: 'auto', minWidth: 240 }} value={selectedCycleId} onChange={(e) => setSelectedCycleId(e.target.value)}>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.title} ({c.exam_type.toUpperCase()})</option>
            ))}
          </select>
        )}
      </div>

      <div className="kpi-grid no-print" style={{ marginBottom: 18 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Students</div>
          <div className="kpi-value">{students.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Active approved students</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Checklist 5/5 Ready</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>{readyCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>All 5 checks marked ✅</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Hall Tickets Approved</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{approvedCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeCycleObj ? activeCycleObj.title : 'Select exam cycle'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Results Published</div>
          <div className="kpi-value">{publishedCount} / {cycleResults.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cycles.length} exam cycle(s)</div>
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'checklist' ? 'btn-primary' : ''}`} onClick={() => setTab('checklist')}><Ticket size={15} /> 1. Student Verification &amp; Hall Tickets</button>
        <button className={`btn ${tab === 'results' ? 'btn-primary' : ''}`} onClick={() => setTab('results')}><Award size={15} /> 2. Results &amp; Auto-Supplementary</button>
        <button className={`btn ${tab === 'cycles' ? 'btn-primary' : ''}`} onClick={() => setTab('cycles')}><Plus size={15} /> 3. Exam Cycles</button>
        <button className={`btn ${tab === 'branding' ? 'btn-primary' : ''}`} onClick={() => setTab('branding')}><Building2 size={15} /> 4. College Branding (DB)</button>
        <button className={`btn ${tab === 'designer' ? 'btn-primary' : ''}`} onClick={() => setTab('designer')}><Palette size={15} /> 5. Hall Ticket Designer</button>
      </div>

      {/* Live Print Preview Modal */}
      {previewTicket && (
        <div style={{ marginBottom: 22 }}>
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong>Hall Ticket A4 Preview — {previewTicket.student_name} ({previewTicket.roll_no})</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Print Official A4</button>
              <button className="btn" onClick={() => setPreviewTicket(null)}>Close Preview</button>
            </div>
          </div>
          <HallTicketSheet data={previewTicket} branding={branding} template={template} />
        </div>
      )}

      {/* TAB 1: STUDENT CHECKLIST & HALL TICKET APPROVALS */}
      {tab === 'checklist' && !previewTicket && (
        <div className="no-print">
          {cycles.length === 0 ? (
            <div className="card">
              <strong>No Exam Cycle created yet.</strong> Go to <strong>3. Exam Cycles</strong> first to create an exam cycle (e.g., Semester 1 End-Sem Exam).
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <strong>Student Eligibility Verification Checklist ({filteredStudents.length} / {students.length}) — Click badges to toggle ✅ (no strikethrough)</strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      style={{ paddingLeft: 28, width: 200, fontSize: 12.5 }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, roll, class..."
                    />
                  </div>
                  <select style={{ width: 'auto', fontSize: 12.5 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                    <option value="all">All Status</option>
                    <option value="pending">Pending Approval</option>
                    <option value="approved">Approved Only</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '6px 10px' }}
                    onClick={async () => {
                      const eligible = students.filter((s) => !s.is_approved && s.chk_biodata && s.chk_photo && s.chk_attendance && s.chk_fee && s.chk_subjects);
                      if (eligible.length === 0) {
                        setToast({ type: 'error', text: 'No unapproved students have all 5 checklist items marked ✅ yet.' });
                        return;
                      }
                      if (!window.confirm(`Approve Hall Tickets for all ${eligible.length} verified (5/5 ✅) student(s)?`)) return;
                      const rows = eligible.map((s) => ({
                        exam_cycle_id: selectedCycleId,
                        student_id: s.student_id,
                        hall_ticket_no: s.hall_ticket_no,
                        chk_biodata: true,
                        chk_photo: true,
                        chk_attendance: true,
                        chk_fee: true,
                        chk_subjects: true,
                        is_approved: true,
                        approved_by: profile!.id,
                        approved_at: new Date().toISOString(),
                        regular_subjects: s.regular_subjects,
                        supplementary_subjects: s.supplementary_subjects,
                        updated_at: new Date().toISOString(),
                      }));
                      const { error } = await supabase.from('exam_hall_tickets').upsert(rows, { onConflict: 'exam_cycle_id,student_id' });
                      if (error) setToast({ type: 'error', text: error.message });
                      else {
                        setToast({ type: 'success', text: `Approved ${eligible.length} Hall Ticket(s)!` });
                        await loadAll();
                      }
                    }}
                  >
                    <CheckCircle2 size={14} /> Approve All 5/5 Ready
                  </button>
                </div>
              </div>
              <div className="erp-table-wrap">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Student &amp; Photo</th>
                      <th>Roll / Class</th>
                      <th>Attendance</th>
                      <th>Verification Checklist (✅)</th>
                      <th>Supplementary</th>
                      <th>Hall Ticket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((stu) => {
                      const thumb = drivePhotoToImgSrc(stu.photo_drive_url);
                      return (
                        <tr key={stu.student_id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 38, height: 44, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-alt)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 10 }}>
                                {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'No Pic'}
                              </div>
                              <div>
                                <Link to={`/students/${stu.student_id}`} style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }} title="Open full student bio-data & attendance dashboard">{stu.full_name}</Link>
                                <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{stu.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="mono" style={{ fontWeight: 600 }}>{stu.roll_no}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stu.class_name} · {stu.section_code}</div>
                          </td>
                          <td>
                            <span className={`badge ${stu.attendance_pct !== null && stu.attendance_pct >= 75 ? 'badge-success' : 'badge-warn'}`}>
                              {stu.attendance_pct !== null ? `${stu.attendance_pct}%` : '—'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {([
                                ['chk_biodata', 'Bio-Data'],
                                ['chk_photo', 'Photo'],
                                ['chk_attendance', 'Attendance'],
                                ['chk_fee', 'Fee Paid'],
                                ['chk_subjects', 'Subjects'],
                              ] as const).map(([field, label]) => {
                                const checked = stu[field];
                                return (
                                  <button
                                    key={field}
                                    type="button"
                                    className="btn"
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: 11.5,
                                      borderColor: checked ? 'var(--success)' : 'var(--border)',
                                      background: checked ? 'var(--success-soft)' : 'transparent',
                                      color: checked ? 'var(--success)' : 'var(--text-muted)',
                                      textDecoration: 'none',
                                    }}
                                    onClick={() => upsertTicket(stu, { [field]: !checked })}
                                  >
                                    {checked ? '✅ ' : '⬜ '}{label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: 12 }}>
                              {stu.supplementary_subjects.length === 0 ? (
                                <span style={{ color: 'var(--text-muted)' }}>None</span>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {stu.supplementary_subjects.map((sb) => (
                                    <span key={sb.code} className="badge badge-danger mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                      {sb.code}
                                      <button
                                        type="button"
                                        title={`Remove ${sb.code}`}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex' }}
                                        onClick={() => {
                                          const nextSupps = stu.supplementary_subjects.filter((x) => x.code !== sb.code);
                                          void upsertTicket(stu, { supplementary_subjects: nextSupps }, `Removed supplementary ${sb.code}.`);
                                        }}
                                      >
                                        <X size={11} />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: '2px 7px', fontSize: 11, marginTop: 4 }}
                                onClick={() => setSuppModalStudentId(suppModalStudentId === stu.student_id ? null : stu.student_id)}
                              >
                                + Add Supp
                              </button>
                              {suppModalStudentId === stu.student_id && (
                                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                  <select style={{ width: 130, padding: 3, fontSize: 11 }} value={suppSubjectId} onChange={(e) => setSuppSubjectId(e.target.value)}>
                                    {allSubjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                                  </select>
                                  <input type="date" style={{ width: 115, padding: 3, fontSize: 11 }} value={suppDate} onChange={(e) => setSuppDate(e.target.value)} />
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ padding: '3px 7px', fontSize: 11 }}
                                    onClick={() => {
                                      const sub = allSubjects.find((x) => x.id === suppSubjectId);
                                      if (!sub) return;
                                      const nextSupps = [...stu.supplementary_subjects.filter((x) => x.code !== sub.code), { code: sub.code, name: sub.name, type: 'supplementary', exam_date: suppDate || 'TBA' }];
                                      void upsertTicket(stu, { supplementary_subjects: nextSupps }, `Added supplementary ${sub.code} for ${stu.full_name}.`);
                                      setSuppModalStudentId(null);
                                    }}
                                  >
                                    Save
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className={`btn ${stu.is_approved ? '' : 'btn-primary'}`}
                                style={{ padding: '4px 10px', fontSize: 12 }}
                                onClick={() => upsertTicket(stu, { is_approved: !stu.is_approved }, !stu.is_approved ? `Hall Ticket approved for ${stu.full_name}!` : `Hall Ticket held for ${stu.full_name}.`)}
                              >
                                {stu.is_approved ? '✅ Approved' : 'Approve Ticket'}
                              </button>
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: '4px 9px', fontSize: 12 }}
                                onClick={() => setPreviewTicket(buildPrintData(stu))}
                              >
                                <Eye size={13} /> Print A4
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MARKS ENTRY, PASS/FAIL CRITERIA & AUTO-SUPPLEMENTARY */}
      {tab === 'results' && !previewTicket && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {!activeCycleObj ? (
            <div className="card">Create an Exam Cycle in Tab 3 first.</div>
          ) : (
            <>
              <div className="card">
                <h2 style={{ fontSize: 16, marginTop: 0 }}>
                  Enter Marks — {activeCycleObj.title} (Max: {activeCycleObj.max_marks} · Pass Criteria: ≥ {activeCycleObj.min_pass_marks})
                </h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const parsedMarks = resAbsent ? null : Number(resMarks);
                    if (!resAbsent && (resMarks === '' || Number.isNaN(parsedMarks) || parsedMarks! < 0 || parsedMarks! > activeCycleObj.max_marks)) {
                      setToast({ type: 'error', text: `Enter marks between 0 and ${activeCycleObj.max_marks}.` });
                      return;
                    }
                    const status: 'pass' | 'fail' | 'absent' = resAbsent
                      ? 'absent'
                      : parsedMarks! >= activeCycleObj.min_pass_marks
                      ? 'pass'
                      : 'fail';
                    const { error } = await supabase.from('exam_results').upsert(
                      {
                        exam_cycle_id: activeCycleObj.id,
                        student_id: resStudentId,
                        subject_id: resSubjectId,
                        marks_obtained: parsedMarks,
                        max_marks: activeCycleObj.max_marks,
                        pass_marks: activeCycleObj.min_pass_marks,
                        status,
                        entered_by: profile!.id,
                        updated_at: new Date().toISOString(),
                      },
                      { onConflict: 'exam_cycle_id,student_id,subject_id' }
                    );
                    if (error) setToast({ type: 'error', text: error.message });
                    else {
                      setToast({ type: 'success', text: `Saved result (${status.toUpperCase()}).` });
                      setResMarks('');
                      setResAbsent(false);
                      await loadAll();
                    }
                  }}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}
                >
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Student *</label>
                    <select value={resStudentId} onChange={(e) => setResStudentId(e.target.value)} required>
                      {students.map((s) => <option key={s.student_id} value={s.student_id}>{s.full_name} ({s.roll_no})</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Subject *</label>
                    <select value={resSubjectId} onChange={(e) => setResSubjectId(e.target.value)} required>
                      {allSubjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Marks (0–{activeCycleObj.max_marks})</label>
                    <input type="number" min={0} max={activeCycleObj.max_marks} step={0.5} disabled={resAbsent} value={resMarks} onChange={(e) => setResMarks(e.target.value)} placeholder="e.g. 72" />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, paddingBottom: 8 }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={resAbsent} onChange={(e) => setResAbsent(e.target.checked)} /> Absent
                  </label>
                  <button type="submit" className="btn btn-primary">Save Mark</button>
                </form>
              </div>

              <div className="card" style={{ borderColor: 'var(--primary)' }}>
                <h2 style={{ fontSize: 16, marginTop: 0 }}>Publish Results &amp; Auto-Generate Supplementary Hall Tickets 🎟️</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
                  Publishing releases marks to students, posts an official Results Announcement, and <strong>automatically generates approved Supplementary Hall Tickets</strong> for every student marked <strong>FAIL</strong> or <strong>ABSENT</strong>.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    style={{ flex: 1, minWidth: 260 }}
                    type="url"
                    value={resExternalUrl}
                    onChange={(e) => setResExternalUrl(e.target.value)}
                    placeholder="Optional external results notice URL (https://results.****.edu)"
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      if (!window.confirm(`Publish results for "${activeCycleObj.title}" and auto-generate Supplementary Hall Tickets for failed/absent students?`)) return;
                      const { data, error } = await supabase.rpc('publish_exam_results_and_auto_supp', {
                        p_exam_cycle_id: activeCycleObj.id,
                        p_external_url: resExternalUrl.trim() || null,
                        p_auto_generate_supp: true,
                      });
                      if (error) setToast({ type: 'error', text: error.message });
                      else {
                        setToast({
                          type: 'success',
                          text: data?.already_published
                            ? `Newly entered marks synced without duplicate notices! Supplementary tickets updated: ${data?.supplementary_hall_tickets_generated || 0}.`
                            : `Results published! Auto-generated ${data?.supplementary_hall_tickets_generated || 0} Supplementary Hall Ticket(s).`,
                        });
                        await loadAll();
                      }
                    }}
                  >
                    <CheckCircle2 size={15} /> Publish Results &amp; Auto-Generate Supp Tickets
                  </button>
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
                  Entered Results ({cycleResults.length})
                </div>
                <div className="erp-table-wrap">
                  <table className="erp-table">
                    <thead><tr><th>Roll No</th><th>Student</th><th>Subject</th><th>Marks</th><th>Criteria</th><th>Result</th><th>Published</th></tr></thead>
                    <tbody>
                      {cycleResults.length === 0 ? (
                        <tr><td colSpan={7} style={{ color: 'var(--text-muted)' }}>No exam marks entered for this cycle yet.</td></tr>
                      ) : (
                        cycleResults.map((r) => (
                          <tr key={r.id}>
                            <td className="mono">{r.roll_no}</td>
                            <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                            <td>{r.subject}</td>
                            <td className="mono">{r.status === 'absent' ? 'AB' : `${r.marks_obtained} / ${r.max_marks}`}</td>
                            <td className="mono">≥ {r.pass_marks}</td>
                            <td><span className={`badge ${r.status === 'pass' ? 'badge-success' : 'badge-danger'}`}>{r.status.toUpperCase()}</span></td>
                            <td><span className={`badge ${r.is_published ? 'badge-primary' : ''}`}>{r.is_published ? 'Published' : 'Draft'}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: EXAM CYCLES */}
      {tab === 'cycles' && !previewTicket && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newCycleTitle.trim()) return;
              const { error } = await supabase.from('exam_cycles').insert({
                title: newCycleTitle.trim(),
                semester_label: newCycleSem.trim() || 'Semester 1',
                exam_type: newCycleType,
                max_marks: newCycleMax,
                min_pass_marks: newCyclePass,
                instructions: newCycleInstr.trim() || branding.default_exam_instructions,
                created_by: profile!.id,
              });
              if (error) setToast({ type: 'error', text: error.message });
              else {
                setToast({ type: 'success', text: `Created exam cycle "${newCycleTitle.trim()}".` });
                setNewCycleTitle('');
                await loadAll();
              }
            }}
            className="card"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}
          >
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Exam Title *</label><input value={newCycleTitle} onChange={(e) => setNewCycleTitle(e.target.value)} placeholder="e.g. End-Semester Exam Dec 2026" required /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Semester</label><input value={newCycleSem} onChange={(e) => setNewCycleSem(e.target.value)} required /></div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Type</label>
              <select value={newCycleType} onChange={(e) => setNewCycleType(e.target.value as any)}>
                <option value="regular">Regular</option>
                <option value="supplementary">Supplementary</option>
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Max Marks</label><input type="number" min={1} value={newCycleMax} onChange={(e) => setNewCycleMax(Number(e.target.value))} required /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Pass Marks Criteria</label><input type="number" min={0} value={newCyclePass} onChange={(e) => setNewCyclePass(Number(e.target.value))} required /></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Exam Instructions (Printed on Hall Ticket)</label>
              <textarea rows={3} value={newCycleInstr} onChange={(e) => setNewCycleInstr(e.target.value)} />
            </div>
            <div><button type="submit" className="btn btn-primary"><Plus size={15} /> Create Exam Cycle</button></div>
          </form>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead><tr><th>Exam Title</th><th>Semester</th><th>Type</th><th>Pass / Max</th><th>Results</th><th>Action</th></tr></thead>
                <tbody>
                  {cycles.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.title}</td>
                      <td>{c.semester_label}</td>
                      <td><span className="badge badge-primary">{c.exam_type.toUpperCase()}</span></td>
                      <td className="mono">{c.min_pass_marks} / {c.max_marks}</td>
                      <td><span className={`badge ${c.results_published ? 'badge-success' : 'badge-warn'}`}>{c.results_published ? 'Published' : 'Pending'}</span></td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', fontSize: 11.5 }}
                          onClick={async () => {
                            if (!window.confirm(`Delete exam cycle "${c.title}" and its hall tickets/results?`)) return;
                            const { error } = await supabase.from('exam_cycles').delete().eq('id', c.id);
                            if (error) setToast({ type: 'error', text: error.message });
                            else {
                              setToast({ type: 'success', text: `Deleted exam cycle "${c.title}".` });
                              await loadAll();
                            }
                          }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COLLEGE BRANDING (STORED DIRECTLY IN DATABASE) */}
      {tab === 'branding' && !previewTicket && (
        <form
          className="card no-print"
          style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase.rpc('admin_save_college_branding', {
              p_college_name: branding.college_name,
              p_college_subtitle: branding.college_subtitle,
              p_college_address: branding.college_address,
              p_college_logo_data: branding.college_logo_data,
              p_principal_sign_data: branding.principal_sign_data,
              p_college_stamp_data: branding.college_stamp_data,
              p_default_exam_instructions: branding.default_exam_instructions,
            });
            if (error) setToast({ type: 'error', text: error.message });
            else {
              window.dispatchEvent(new Event('erp-fee-link-updated'));
              window.dispatchEvent(new Event('erp-branding-updated'));
              setToast({ type: 'success', text: 'College Name, Logo, Principal Sign & Stamp saved directly to database!' });
            }
          }}
        >
          <h2 style={{ fontSize: 16.5, margin: 0 }}>College Name, Logo, Principal Sign &amp; Stamp (Stored Directly in Database)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>College Name *</label><input value={branding.college_name} onChange={(e) => setBranding({ ...branding, college_name: e.target.value })} required /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Subtitle / Affiliation</label><input value={branding.college_subtitle} onChange={(e) => setBranding({ ...branding, college_subtitle: e.target.value })} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Campus Address</label><input value={branding.college_address} onChange={(e) => setBranding({ ...branding, college_address: e.target.value })} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {([
              ['college_logo_data', 'College Logo (Header + Watermark)', 400],
              ['principal_sign_data', 'Scanned Principal Signature', 450],
              ['college_stamp_data', 'Scanned College Stamp', 400],
            ] as const).map(([key, label, maxW]) => (
              <div key={key} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{label}</div>
                <div style={{ height: 72, borderRadius: 6, background: '#ffffff', border: '1px dashed var(--border-strong)', display: 'grid', placeItems: 'center', marginBottom: 8, overflow: 'hidden' }}>
                  {branding[key] ? (
                    <img src={branding[key]} alt={label} style={{ maxHeight: 68, maxWidth: '92%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 11.5, color: '#64748b' }}>No image uploaded</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <label className="btn" style={{ cursor: 'pointer', flex: 1, fontSize: 12, padding: '5px 8px' }}>
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const dataUrl = await compressImageFileToDataUrl(f, maxW);
                          setBranding((prev) => ({ ...prev, [key]: dataUrl }));
                        } catch (err: any) {
                          setToast({ type: 'error', text: err.message });
                        }
                      }}
                    />
                  </label>
                  {branding[key] && (
                    <button type="button" className="btn btn-danger" style={{ fontSize: 12, padding: '5px 8px' }} onClick={() => setBranding((prev) => ({ ...prev, [key]: '' }))}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Default Examination Instructions</label>
            <textarea rows={4} value={branding.default_exam_instructions} onChange={(e) => setBranding({ ...branding, default_exam_instructions: e.target.value })} />
          </div>
          <div><button type="submit" className="btn btn-primary"><Save size={15} /> Save Branding to Database</button></div>
        </form>
      )}

      {/* TAB 5: HALL TICKET TEMPLATE DESIGNER (3 PRESETS + CUSTOM BLANK PAGE) */}
      {tab === 'designer' && !previewTicket && (
        <div className="designer-grid">
          <div className="card no-print" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: 15.5, margin: 0 }}>Hall Ticket Designer</h2>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>1. Choose Preset or Blank Custom</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {([
                  ['classic', 'Classic Formal'],
                  ['modern', 'Modern Clean'],
                  ['compact', 'Compact Official'],
                  ['custom', 'Custom Blank'],
                ] as const).map(([p, lbl]) => (
                  <button
                    key={p}
                    type="button"
                    className={`btn ${template.preset === p ? 'btn-primary' : ''}`}
                    style={{ fontSize: 12, padding: '6px 8px' }}
                    onClick={() => {
                      if (p === 'classic') setTemplate({ ...DEFAULT_HALL_TICKET_TEMPLATE, preset: 'classic', borderStyle: 'double', accentColor: '#1e3a8a' });
                      else if (p === 'modern') setTemplate({ ...DEFAULT_HALL_TICKET_TEMPLATE, preset: 'modern', borderStyle: 'solid', accentColor: '#0f766e' });
                      else if (p === 'compact') setTemplate({ ...DEFAULT_HALL_TICKET_TEMPLATE, preset: 'compact', borderStyle: 'minimal', fontSize: 11.5 });
                      else setTemplate({ ...template, preset: 'custom', sections: template.sections.map((s) => ({ ...s, enabled: false })) });
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Accent Color</label>
                <input type="color" value={template.accentColor} onChange={(e) => setTemplate({ ...template, preset: 'custom', accentColor: e.target.value })} style={{ height: 36, padding: 2 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Border Style</label>
                <select value={template.borderStyle} onChange={(e) => setTemplate({ ...template, preset: 'custom', borderStyle: e.target.value as any })}>
                  <option value="double">Double Formal</option>
                  <option value="solid">Solid Clean</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
                <span>Logo Watermark Opacity</span>
                <span className="mono">{Math.round(template.watermarkOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.25}
                step={0.01}
                value={template.watermarkOpacity}
                onChange={(e) => setTemplate({ ...template, watermarkOpacity: Number(e.target.value), showWatermark: Number(e.target.value) > 0 })}
                style={{ padding: 0 }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>2. Hall Ticket Requirements (Add / Reorder)</span>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: '2px 7px', fontSize: 11 }}
                  onClick={() => setTemplate({ ...template, sections: template.sections.map((s) => ({ ...s, enabled: true })) })}
                >
                  Add All
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {template.sections.map((sec, idx) => (
                  <div key={sec.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      style={{ width: 'auto' }}
                      checked={sec.enabled}
                      onChange={(e) => {
                        const next = template.sections.map((x) => (x.key === sec.key ? { ...x, enabled: e.target.checked } : x));
                        setTemplate({ ...template, preset: 'custom', sections: next });
                      }}
                    />
                    <span style={{ flex: 1 }}>{sec.label}</span>
                    <button type="button" className="btn" style={{ padding: '2px 4px' }} disabled={idx === 0} onClick={() => moveSection(idx, -1)}><ArrowUp size={12} /></button>
                    <button type="button" className="btn" style={{ padding: '2px 4px' }} disabled={idx === template.sections.length - 1} onClick={() => moveSection(idx, 1)}><ArrowDown size={12} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={async () => {
                  const { error } = await supabase.rpc('admin_save_college_branding', {
                    p_college_name: branding.college_name,
                    p_hall_ticket_template: template,
                  });
                  if (error) setToast({ type: 'error', text: error.message });
                  else setToast({ type: 'success', text: 'Custom Hall Ticket template saved for all students!' });
                }}
              >
                <Save size={14} /> Save Layout
              </button>
              <button type="button" className="btn" onClick={() => window.print()}><Printer size={14} /> Print</button>
            </div>
          </div>

          <div>
            <HallTicketSheet data={samplePreviewData} branding={branding} template={template} />
          </div>
        </div>
      )}
    </div>
  );
};
