import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FileText, Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { parseGoogleDriveLink } from '../../lib/driveLink';
import { isDemoProfile, supabase } from '../../lib/supabase';
import { SubmissionReviewItem } from '../../types/erp';

interface DriveReviewItem extends SubmissionReviewItem {
  drive_url: string;
  latest_version_id: string;
  versions: Array<{ id: string; version: number; submitted_at: string; drive_url: string }>;
}

const SAMPLE_SUBMISSIONS: DriveReviewItem[] = [
  {
    submission_id: 'sub-101',
    assignment_id: 'asg-1',
    assignment_title: 'Database Management Assignment 01',
    class_label: 'MCA | Section A',
    subject_name: 'DBMS',
    max_marks: 20,
    due_at: '2026-11-18T23:59:00Z',
    student_id: 'stu-101',
    student_name: 'Aarav Sharma',
    roll_no: '101',
    submitted_at: '18 Nov, 10:32 AM',
    is_late: false,
    status: 'submitted',
    version_no: 1,
    drive_file_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    drive_url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view',
    latest_version_id: 'v1',
    file_name: 'Aarav_Sharma_DBMS_ER_Model.pdf',
    marks_obtained: 18,
    feedback: 'Well-structured ER diagram and clean 3NF normalization.',
    evaluation_status: 'published',
    versions: [{ id: 'v1', version: 1, submitted_at: '18 Nov, 10:32 AM', drive_url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view' }],
  },
];

export const EvaluationWorkspace: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const assignmentFilter = searchParams.get('assignment') || '';
  const [items, setItems] = useState<DriveReviewItem[]>(demo ? SAMPLE_SUBMISSIONS : []);
  const [index, setIndex] = useState(0);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState('');
  const [iframeLoading, setIframeLoading] = useState(true);
  const [marks, setMarks] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const loadStudent = (nextIdx: number, sourceItems: DriveReviewItem[] = items, checkDirty = false, customToast = '') => {
    if (checkDirty && current) {
      const origMarks = current.marks_obtained !== null ? String(current.marks_obtained) : '';
      const marksChanged = marks.trim() !== origMarks.trim() && !(marks !== '' && origMarks !== '' && Number(marks) === Number(origMarks));
      if (marksChanged || feedback !== current.feedback) {
        if (!window.confirm('You have unsaved evaluation changes. Switch student anyway?')) return;
      }
    }
    const target = sourceItems[nextIdx];
    if (!target) return;
    setIndex(nextIdx);
    setSelectedVersion(target.version_no);
    setMarks(target.marks_obtained !== null ? String(target.marks_obtained) : '');
    setFeedback(target.feedback);
    setIframeLoading(true);
    setToast(customToast);
  };

  useEffect(() => {
    if (demo) {
      loadStudent(0, SAMPLE_SUBMISSIONS);
      return;
    }
    let query = supabase
      .from('submissions')
      .select(`
        id, status, student_id, assignment_id,
        profiles:student_id(full_name, student_profiles(roll_no)),
        assignments!inner(title, due_at, max_marks, teaching_assignments!inner(faculty_id, subjects(name), semesters(label), class_sections(name, section_code, programs(name, departments(name))))),
        submission_versions(id, version_no, submitted_at, is_late, drive_url, drive_file_id),
        evaluations(marks_obtained, feedback, status, evaluated_at)
      `)
      .eq('assignments.teaching_assignments.faculty_id', profile!.id)
      .order('assignment_id');

    if (assignmentFilter) {
      query = query.eq('assignment_id', assignmentFilter);
    }

    query.then(({ data, error }) => {
      if (error) { setToast(`Error loading submissions: ${error.message}`); return; }
      if (!data) return;
      const mapped: DriveReviewItem[] = data
        .filter((s: any) => Array.isArray(s.submission_versions) && s.submission_versions.length > 0)
        .map((s: any, idx: number) => {
          const vers = [...s.submission_versions].sort((a: any, b: any) => b.version_no - a.version_no);
          const latest = vers[0];
          const ev = Array.isArray(s.evaluations) ? s.evaluations[0] : s.evaluations;
          return {
            submission_id: s.id,
            assignment_id: s.assignment_id,
            assignment_title: s.assignments?.title || 'Assignment',
            department_name: s.assignments?.teaching_assignments?.class_sections?.programs?.departments?.name || 'Department',
            program_name: s.assignments?.teaching_assignments?.class_sections?.programs?.name || 'Program',
            semester_label: s.assignments?.teaching_assignments?.semesters?.label || 'Semester',
            class_label: s.assignments?.teaching_assignments?.class_sections
              ? `${s.assignments.teaching_assignments.class_sections.name} · Sec ${s.assignments.teaching_assignments.class_sections.section_code}`
              : 'Class',
            subject_name: s.assignments?.teaching_assignments?.subjects?.name || 'Subject',
            max_marks: Number(s.assignments?.max_marks ?? 0),
            due_at: s.assignments?.due_at || new Date().toISOString(),
            student_id: s.student_id,
            student_name: s.profiles?.full_name || 'Student',
            roll_no: (Array.isArray(s.profiles?.student_profiles) ? s.profiles.student_profiles[0]?.roll_no : s.profiles?.student_profiles?.roll_no) || String(idx + 1).padStart(3, '0'),
            submitted_at: new Date(latest.submitted_at).toLocaleString(),
            is_late: Boolean(latest.is_late),
            status: s.status,
            version_no: latest.version_no,
            drive_file_id: latest.drive_file_id || '',
            drive_url: latest.drive_url || '',
            latest_version_id: latest.id,
            file_name: `${s.profiles?.full_name || 'Student'}_v${latest.version_no}`,
            marks_obtained: ev?.marks_obtained ?? null,
            feedback: ev?.feedback || '',
            evaluation_status: ev?.status || 'not_evaluated',
            evaluated_at: ev?.evaluated_at || null,
            versions: vers.map((v: any) => ({
              id: v.id,
              version: v.version_no,
              submitted_at: new Date(v.submitted_at).toLocaleString(),
              drive_url: v.drive_url || '',
            })),
          };
        });
      setItems(mapped);
      const studentParam = searchParams.get('submission') || searchParams.get('student');
      const foundIdx = studentParam ? mapped.findIndex((i) => i.submission_id === studentParam) : 0;
      loadStudent(foundIdx !== -1 ? foundIdx : 0, mapped);
    });
  }, [demo, profile?.id, assignmentFilter]);

  const current = items[index];
  if (!current) {
    return (
      <div className="erp-content">
        <div className="page-header">
          <div><h1 className="page-title">Submission Evaluation</h1><p className="page-sub">Review student Google Drive submissions and publish marks.</p></div>
          <div style={{ display: 'flex', gap: 8 }}>
            {assignmentFilter && (
              <button className="btn" onClick={() => setSearchParams({})}>Show All Assignments</button>
            )}
            <button className="btn" onClick={() => navigate('/faculty/assignments')}><ArrowLeft size={15} /> Back to Assignments</button>
          </div>
        </div>
        <div className="card" style={{ color: 'var(--text-muted)' }}>No student submissions available to evaluate yet.</div>
      </div>
    );
  }

  const activeVersionObj = current.versions.find((v) => v.version === selectedVersion) || current.versions[0];
  const parsedDrive = parseGoogleDriveLink(activeVersionObj.drive_url);

  const handleSave = async (publish: boolean) => {
    const parsed = Number(marks);
    if (marks === '' || Number.isNaN(parsed) || parsed < 0 || parsed > current.max_marks) {
      setToast(`Marks must be between 0 and ${current.max_marks}.`);
      return;
    }
    if (publish && !window.confirm('Publish marks to student? Once published, the student can view their marks and feedback.')) {
      return;
    }
    setSaving(true);
    try {
      if (!demo) {
        const rpcName = publish ? 'publish_evaluation' : 'save_evaluation';
        const { error: evErr } = await supabase.rpc(rpcName, {
          p_submission_id: current.submission_id,
          p_graded_version_id: activeVersionObj.id,
          p_marks_obtained: parsed,
          p_feedback: feedback,
        });
        if (evErr) {
          setToast(`Error: ${evErr.message}`);
          return;
        }
      }
      const updated = [...items];
      updated[index] = { ...current, marks_obtained: parsed, feedback, evaluation_status: publish ? 'published' : 'draft', status: publish ? 'evaluated' : current.status };
      setItems(updated);

      if (publish && index < updated.length - 1) {
        const nextStudent = updated[index + 1];
        loadStudent(index + 1, updated, false, `Published marks for ${current.student_name}! Now reviewing ${nextStudent.student_name}.`);
      } else if (publish) {
        setToast(`Marks published for ${current.student_name}! All ${updated.length} submissions reviewed.`);
      } else {
        setToast('Evaluation draft saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResubmit = async () => {
    if (!window.confirm('Ask the student to resubmit this assignment?')) return;
    if (!demo) {
      const { error } = await supabase.rpc('request_resubmission', { p_submission_id: current.submission_id });
      if (error) {
        setToast(`Error: ${error.message}`);
        return;
      }
    }
    const updated = [...items];
    updated[index] = { ...current, status: 'resubmission_requested' };
    setItems(updated);
    setToast('Resubmission requested from student.');
  };

  return (
    <div className="f07-workspace">
      <div className="f07-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => navigate('/faculty/assignments')} style={{ padding: '6px 10px' }}>
            <ArrowLeft size={15} /> Back to Student List
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15.5 }}>{current.assignment_title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {current.class_label} · {current.subject_name} · Max Marks: <span className="mono">{current.max_marks}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {assignmentFilter && (
            <button className="btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setSearchParams({})}>Show All Assignments</button>
          )}
          <select
            aria-label="Jump to student"
            style={{ width: 'auto', padding: '5px 10px', fontSize: 12.5 }}
            value={index}
            onChange={(e) => loadStudent(Number(e.target.value), items, true)}
          >
            {items.map((item, idx) => (
              <option key={item.submission_id} value={idx}>
                {idx + 1}. {item.student_name} (#{item.roll_no}) {item.evaluation_status === 'published' ? '✓ Published' : ''}
              </option>
            ))}
          </select>
          {toast && <span className="badge badge-success">{toast}</span>}
          <span className="badge badge-primary">Student {index + 1} of {items.length}</span>
        </div>
      </div>

      <div className="f07-split" style={fullscreen ? { gridTemplateColumns: '1fr' } : undefined}>
        <section className="f07-left">
          <div className="f07-viewer-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color="var(--primary)" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{current.file_name}</span>
              <select
                style={{ width: 'auto', padding: '3px 8px', fontSize: 12 }}
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(Number(e.target.value))}
              >
                {current.versions.map((v) => (
                  <option key={v.version} value={v.version}>Version {v.version} ({v.submitted_at})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="btn" onClick={() => setFullscreen((f) => !f)} title="Toggle Fullscreen">
                {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <a className="btn" href={parsedDrive.openUrl || activeVersionObj.drive_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <ExternalLink size={15} /> Open in Google Drive
              </a>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {parsedDrive.previewUrl ? (
              <>{iframeLoading && <div style={{ padding: 10, fontSize: 12.5, color: 'var(--text-muted)' }}>Loading Google Drive preview...</div>}<iframe title={`Drive Preview - ${current.student_name}`} src={parsedDrive.previewUrl} onLoad={() => setIframeLoading(false)} style={{ width: '100%', height: '100%', border: 'none', background: '#ffffff' }} /></>
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No valid Google Drive preview URL available.</div>
            )}
          </div>
        </section>

        {!fullscreen && (
          <section className="f07-right">
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: 8 }}>STUDENT DETAILS</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{current.student_name} <span className="mono" style={{ fontWeight: 500, color: 'var(--text-muted)' }}>#{current.roll_no}</span></div>
                <Link to={`/students/${current.student_id}`} style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Student Dashboard →</Link>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{current.department_name || 'Department'} · {current.program_name || 'Program'} · {current.semester_label || 'Semester'} · {current.class_label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{activeVersionObj.submitted_at}</span>
                <span className={`badge ${current.is_late ? 'badge-warn' : 'badge-success'}`}>{current.is_late ? 'Late Submission' : 'On Time'}</span>
                <span className="badge">{current.evaluation_status}</span>
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: 6 }}>ASSIGNMENT DETAILS</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{current.assignment_title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Due {new Date(current.due_at).toLocaleDateString()} · Maximum Marks: <strong>{current.max_marks}</strong></div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--primary)' }}>EVALUATION</div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Marks Obtained (0 – {current.max_marks})</label>
                <input type="number" min={0} max={current.max_marks} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Faculty Feedback</label>
                <textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Write constructive feedback..." />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" disabled={saving || current.evaluation_status === 'published'} title={current.evaluation_status === 'published' ? 'Already published — use Publish Marks to update' : undefined} onClick={() => handleSave(false)}>Save Draft</button>
                <button className="btn btn-primary" disabled={saving} onClick={() => handleSave(true)}>
                  {saving ? 'Publishing...' : index < items.length - 1 ? 'Publish Marks & Next' : 'Publish Marks'}
                </button>
                <button className="btn btn-danger" disabled={saving} onClick={handleResubmit}>Request Resubmission</button>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="f07-footer">
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => navigate('/faculty/assignments')}>
            <ArrowLeft size={16} /> Back to List
          </button>
          <button className="btn" disabled={index === 0} onClick={() => loadStudent(index - 1, items, true)}>
            <ChevronLeft size={16} /> Previous Student
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Reviewing <strong>{current.student_name}</strong> ({index + 1} / {items.length})
        </div>
        <button className="btn btn-primary" disabled={index >= items.length - 1} onClick={() => loadStudent(index + 1, items, true)}>
          Next Student <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
