import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FileText, Maximize2, Minimize2 } from 'lucide-react';
import { parseGoogleDriveLink } from '../../lib/driveLink';
import { SubmissionReviewItem } from '../../types/erp';

interface DriveReviewItem extends SubmissionReviewItem {
  drive_url: string;
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
    file_name: 'Aarav_Sharma_DBMS_ER_Model.pdf',
    marks_obtained: 18,
    feedback: 'Well-structured ER diagram and clean 3NF normalization.',
    evaluation_status: 'published',
  },
  {
    submission_id: 'sub-102',
    assignment_id: 'asg-1',
    assignment_title: 'Database Management Assignment 01',
    class_label: 'MCA | Section A',
    subject_name: 'DBMS',
    max_marks: 20,
    due_at: '2026-11-18T23:59:00Z',
    student_id: 'stu-102',
    student_name: 'Diya Kulkarni',
    roll_no: '102',
    submitted_at: '19 Nov, 08:14 AM',
    is_late: true,
    status: 'late',
    version_no: 2,
    drive_file_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    drive_url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view',
    file_name: 'Diya_Kulkarni_DBMS_v2.pdf',
    marks_obtained: null,
    feedback: '',
    evaluation_status: 'not_evaluated',
  },
  {
    submission_id: 'sub-104',
    assignment_id: 'asg-1',
    assignment_title: 'Database Management Assignment 01',
    class_label: 'MCA | Section A',
    subject_name: 'DBMS',
    max_marks: 20,
    due_at: '2026-11-18T23:59:00Z',
    student_id: 'stu-104',
    student_name: 'Sneha Reddy',
    roll_no: '104',
    submitted_at: '18 Nov, 04:15 PM',
    is_late: false,
    status: 'evaluated',
    version_no: 1,
    drive_file_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    drive_url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view',
    file_name: 'Sneha_Reddy_DBMS.pdf',
    marks_obtained: 19,
    feedback: 'Excellent normalization proof.',
    evaluation_status: 'published',
  },
  {
    submission_id: 'sub-106',
    assignment_id: 'asg-1',
    assignment_title: 'Database Management Assignment 01',
    class_label: 'MCA | Section A',
    subject_name: 'DBMS',
    max_marks: 20,
    due_at: '2026-11-18T23:59:00Z',
    student_id: 'stu-106',
    student_name: 'Ananya Verma',
    roll_no: '106',
    submitted_at: '18 Nov, 09:05 PM',
    is_late: false,
    status: 'submitted',
    version_no: 1,
    drive_file_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    drive_url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view',
    file_name: 'Ananya_Verma_DBMS.pdf',
    marks_obtained: null,
    feedback: '',
    evaluation_status: 'not_evaluated',
  },
];

export const EvaluationWorkspace: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<DriveReviewItem[]>(SAMPLE_SUBMISSIONS);
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState('');

  const current = items[index];
  const parsedDrive = parseGoogleDriveLink(current.drive_url);
  const [marks, setMarks] = useState<string>(current.marks_obtained !== null ? String(current.marks_obtained) : '');
  const [feedback, setFeedback] = useState<string>(current.feedback);

  const loadStudent = (nextIdx: number) => {
    const target = items[nextIdx];
    setIndex(nextIdx);
    setMarks(target.marks_obtained !== null ? String(target.marks_obtained) : '');
    setFeedback(target.feedback);
    setToast('');
  };

  useEffect(() => {
    const studentParam = searchParams.get('student');
    if (studentParam) {
      const foundIdx = items.findIndex((i) => i.submission_id === studentParam);
      if (foundIdx !== -1 && foundIdx !== index) {
        loadStudent(foundIdx);
      }
    }
  }, [searchParams]);

  const handleSave = (publish: boolean) => {
    const parsed = Number(marks);
    if (marks === '' || Number.isNaN(parsed) || parsed < 0 || parsed > current.max_marks) {
      setToast(`Marks must be between 0 and ${current.max_marks}.`);
      return;
    }
    const updated = [...items];
    updated[index] = { ...current, marks_obtained: parsed, feedback, evaluation_status: publish ? 'published' : 'draft', status: 'evaluated' };
    setItems(updated);
    setToast(publish ? 'Marks published to student.' : 'Evaluation draft saved.');
  };

  const handleResubmit = () => {
    const updated = [...items];
    updated[index] = { ...current, status: 'resubmission_requested' };
    setItems(updated);
    setToast('Resubmission requested from student.');
  };

  return (
    <div className="f07-workspace">
      <div className="f07-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/faculty/assignments" className="btn" style={{ textDecoration: 'none', padding: '6px 10px' }}>
            <ArrowLeft size={15} /> Student List
          </Link>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15.5 }}>{current.assignment_title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {current.class_label} · {current.subject_name} · Max Marks: <span className="mono">{current.max_marks}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              <span className="badge">v{current.version_no}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="btn" onClick={() => setFullscreen((f) => !f)} title="Toggle Fullscreen">
                {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <a className="btn" href={parsedDrive.openUrl || current.drive_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <ExternalLink size={15} /> Open in Google Drive
              </a>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {parsedDrive.previewUrl ? (
              <iframe
                title={`Drive Preview - ${current.student_name}`}
                src={parsedDrive.previewUrl}
                style={{ width: '100%', height: '100%', border: 'none', background: '#ffffff' }}
              />
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                No valid Google Drive preview URL available.
              </div>
            )}
          </div>
        </section>

        {!fullscreen && (
          <section className="f07-right">
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: 8 }}>STUDENT DETAILS</div>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>{current.student_name} <span className="mono" style={{ fontWeight: 500, color: 'var(--text-muted)' }}>#{current.roll_no}</span></div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{current.submitted_at}</span>
                <span className={`badge ${current.is_late ? 'badge-warn' : 'badge-success'}`}>
                  {current.is_late ? 'Late Submission' : 'On Time'}
                </span>
                <span className="badge">{current.evaluation_status}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, wordBreak: 'break-all' }}>
                Drive Link: <a href={current.drive_url} target="_blank" rel="noreferrer">{current.drive_url}</a>
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: 6 }}>ASSIGNMENT DETAILS</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{current.assignment_title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Due {new Date(current.due_at).toLocaleDateString()} · Maximum Marks: <strong>{current.max_marks}</strong>
              </div>
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
                <button className="btn" onClick={() => handleSave(false)}>Save Draft</button>
                <button className="btn btn-primary" onClick={() => handleSave(true)}>Publish Marks</button>
                <button className="btn btn-danger" onClick={handleResubmit}>Request Resubmission</button>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="f07-footer">
        <button className="btn" disabled={index === 0} onClick={() => loadStudent(index - 1)}><ChevronLeft size={16} /> Previous Student</button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Reviewing <strong>{current.student_name}</strong> (Roll {current.roll_no})</span>
        <button className="btn btn-primary" disabled={index === items.length - 1} onClick={() => loadStudent(index + 1)}>Next Student <ChevronRight size={16} /></button>
      </div>
    </div>
  );
};
