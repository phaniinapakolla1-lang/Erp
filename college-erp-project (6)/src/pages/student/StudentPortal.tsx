import React, { useState } from 'react';
import { Award, CheckCircle2, ClipboardList, Clock, ExternalLink, Eye, GraduationCap, Link2 } from 'lucide-react';
import { parseGoogleDriveLink } from '../../lib/driveLink';

export const StudentDashboard: React.FC = () => (
  <div className="erp-content">
    <div className="page-header">
      <div><h1 className="page-title">Student Academic Portal</h1><p className="page-sub">Aarav Sharma · MCA Year 1 · Section A · Roll No. 101</p></div>
    </div>
    <div className="grid-4" style={{ marginBottom: 22 }}>
      <div className="kpi-card"><div><div className="kpi-val">88.5%</div><div className="kpi-lbl">Overall Attendance</div><div className="kpi-sub">Above 75% threshold</div></div><div className="kpi-icon"><CheckCircle2 size={20} /></div></div>
      <div className="kpi-card"><div><div className="kpi-val">2</div><div className="kpi-lbl">Pending Assignments</div><div className="kpi-sub" style={{ color: 'var(--warning)' }}>Next due 22 Nov</div></div><div className="kpi-icon"><ClipboardList size={20} /></div></div>
      <div className="kpi-card"><div><div className="kpi-val">18 / 20</div><div className="kpi-lbl">Latest Published Mark</div><div className="kpi-sub">DBMS Assignment 01</div></div><div className="kpi-icon"><Award size={20} /></div></div>
      <div className="kpi-card"><div><div className="kpi-val">5</div><div className="kpi-lbl">Enrolled Subjects</div><div className="kpi-sub">Semester 1 · 2026–27</div></div><div className="kpi-icon"><GraduationCap size={20} /></div></div>
    </div>

    <div className="grid-2">
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}><h2 style={{ fontSize: 16, margin: 0 }}>Today's Timetable</h2></div>
        <table className="erp-table">
          <thead><tr><th>Time</th><th>Subject</th><th>Faculty</th><th>Room</th></tr></thead>
          <tbody>
            <tr><td className="mono">09:30 AM</td><td><strong>DBMS (CS501)</strong></td><td>Dr. Ananya Rao</td><td>Lab 302</td></tr>
            <tr><td className="mono">11:30 AM</td><td><strong>Operating Systems</strong></td><td>Prof. Kiran Das</td><td>LH 204</td></tr>
            <tr><td className="mono">02:00 PM</td><td><strong>Computer Networks</strong></td><td>Dr. S. Iyer</td><td>LH 108</td></tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Upcoming Deadlines</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><strong>OS Process Scheduling Lab</strong><div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Operating Systems · Max 25 Marks</div></div>
            <span className="badge badge-warn"><Clock size={12} /> Due 22 Nov</span>
          </div>
          <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><strong>TCP/IP Packet Analysis</strong><div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Computer Networks · Max 15 Marks</div></div>
            <span className="badge badge-primary">Due 26 Nov</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const StudentAttendancePage: React.FC = () => (
  <div className="erp-content">
    <div className="page-header"><div><h1 className="page-title">S03 · My Attendance</h1><p className="page-sub">Subject-wise attendance percentages for Semester 1.</p></div></div>
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="erp-table">
        <thead><tr><th>Subject</th><th>Conducted</th><th>Attended</th><th>Progress</th><th>Percentage</th></tr></thead>
        <tbody>
          <tr><td style={{ fontWeight: 600 }}>Database Management Systems</td><td className="mono">24</td><td className="mono">22</td><td style={{ minWidth: 160 }}><div className="progress-track"><div className="progress-fill" style={{ width: '91.7%' }} /></div></td><td><span className="badge badge-success">91.7%</span></td></tr>
          <tr><td style={{ fontWeight: 600 }}>Operating Systems</td><td className="mono">20</td><td className="mono">17</td><td style={{ minWidth: 160 }}><div className="progress-track"><div className="progress-fill" style={{ width: '85%', background: 'var(--warning)' }} /></div></td><td><span className="badge badge-warn">85.0%</span></td></tr>
          <tr><td style={{ fontWeight: 600 }}>Computer Networks</td><td className="mono">18</td><td className="mono">16</td><td style={{ minWidth: 160 }}><div className="progress-track"><div className="progress-fill" style={{ width: '88.9%' }} /></div></td><td><span className="badge badge-success">88.9%</span></td></tr>
        </tbody>
      </table>
    </div>
  </div>
);

export const StudentAssignmentsPage: React.FC = () => {
  const [driveUrl, setDriveUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [submittedLink, setSubmittedLink] = useState<string | null>(null);

  const parsed = parseGoogleDriveLink(driveUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.valid) return;
    setSubmittedLink(parsed.openUrl);
    setShowPreview(true);
  };

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">S04 &amp; S05 · Assignments &amp; Google Drive Link Submission</h1>
          <p className="page-sub">Upload your PDF to your own Google Drive, paste the link below to preview it, and submit to Supabase.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div>
              <strong style={{ fontSize: 16 }}>OS Process Scheduling Lab</strong>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                Due: 22 Nov, 11:59 PM · Max Marks: 25 · Share your Drive file as <em>"Anyone with link can view"</em> or with faculty
              </div>
            </div>
            <span className={`badge ${submittedLink ? 'badge-success' : 'badge-warn'}`}>
              {submittedLink ? 'Submitted (v1)' : 'Not Submitted'}
            </span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
              <input
                type="url"
                value={driveUrl}
                onChange={(e) => { setDriveUrl(e.target.value); setShowPreview(false); }}
                placeholder="https://drive.google.com/file/d/1A2B3C.../view?usp=sharing"
                required
              />
            </div>
            <button type="button" className="btn" disabled={!parsed.valid} onClick={() => setShowPreview((p) => !p)}>
              <Eye size={15} /> {showPreview ? 'Hide Preview' : 'Preview Link'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={!parsed.valid}>
              <Link2 size={15} /> Submit Drive Link
            </button>
          </form>

          {driveUrl && !parsed.valid && (
            <div className="badge badge-danger" style={{ marginTop: 10 }}>
              Please paste a valid Google Drive file link (e.g., https://drive.google.com/file/d/.../view).
            </div>
          )}

          {submittedLink && (
            <div className="badge badge-success" style={{ marginTop: 12, padding: '6px 12px' }}>
              Drive link saved to Supabase (<code>drive_file_id: {parsed.fileId}</code>). Faculty can now review it in F07.
            </div>
          )}

          {showPreview && parsed.previewUrl && (
            <div style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                <strong>Google Drive Live Preview</strong>
                <a href={parsed.openUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)' }}>
                  Open in Drive <ExternalLink size={13} />
                </a>
              </div>
              <iframe title="Drive Submission Preview" src={parsed.previewUrl} style={{ width: '100%', height: 420, border: 'none', background: '#fff' }} />
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><strong>Database Management Assignment 01</strong><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Submitted 18 Nov, 10:32 AM · Version 1</div></div>
            <span className="badge badge-success">Evaluated · 18 / 20</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const StudentMarksPage: React.FC = () => (
  <div className="erp-content">
    <div className="page-header"><div><h1 className="page-title">S06 · Published Marks &amp; Feedback</h1><p className="page-sub">Evaluations released by faculty for Semester 1.</p></div></div>
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="erp-table">
        <thead><tr><th>Assignment</th><th>Subject</th><th>Marks</th><th>Faculty Feedback</th></tr></thead>
        <tbody>
          <tr><td style={{ fontWeight: 600 }}>DBMS Assignment 01</td><td>DBMS</td><td><span className="badge badge-success">18 / 20</span></td><td>Well-structured ER diagram and clean 3NF normalization.</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Network Topologies Quiz</td><td>Computer Networks</td><td><span className="badge badge-success">14 / 15</span></td><td>Accurate subnetting calculations.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
);
