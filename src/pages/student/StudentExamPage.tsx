import React, { useEffect, useState } from 'react';
import { Award, ExternalLink, Printer, Ticket } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, supabase } from '../../lib/supabase';
import { CollegeBranding, HallTicketPrintData, HallTicketSheet } from '../../components/HallTicketSheet';

interface StudentResultRow {
  id: string;
  cycle_title: string;
  semester_label: string;
  external_url: string | null;
  subject_code: string;
  subject_name: string;
  marks_obtained: number | null;
  max_marks: number;
  pass_marks: number;
  status: 'pass' | 'fail' | 'absent';
}

export const StudentExamPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [tab, setTab] = useState<'hall_tickets' | 'results'>('hall_tickets');
  const [branding, setBranding] = useState<CollegeBranding>({
    college_name: 'St. Xavier Institute',
    college_subtitle: 'Autonomous College · Self-Center Examinations',
    college_address: '',
    college_logo_data: '',
    principal_sign_data: '',
    college_stamp_data: '',
    default_exam_instructions: '',
    hall_ticket_template: null,
  });
  const [tickets, setTickets] = useState<HallTicketPrintData[]>([]);
  const [selectedTicketIdx, setSelectedTicketIdx] = useState(0);
  const [results, setResults] = useState<StudentResultRow[]>([]);

  useEffect(() => {
    if (demo) {
      setTickets([
        {
          hall_ticket_no: 'HT-24MCA101',
          exam_title: 'Semester 1 End-Semester Examinations',
          semester_label: 'Semester 1',
          exam_type: 'regular',
          student_name: profile?.full_name || 'Aarav Sharma',
          roll_no: '24MCA101',
          department: 'Computer Science',
          specialization: 'AI & ML',
          class_name: 'MCA Year 1',
          section_code: 'A',
          photo_drive_url: profile?.photo_drive_url || '',
          regular_subjects: [
            { code: 'CS501', name: 'Database Management Systems', type: 'theory', exam_date: '2026-12-05' },
            { code: 'CS503L', name: 'DBMS & SQL Lab', type: 'practical', exam_date: '2026-12-08' },
          ],
          supplementary_subjects: [],
          instructions: '1. Carry Hall Ticket and College ID card.\n2. Report 15 minutes before exam start time.',
        },
      ]);
      return;
    }

    (async () => {
      const [setRes, spRes, enrRes, deptRes, specRes, htRes, resRows] = await Promise.all([
        supabase.from('erp_settings').select('college_name, college_subtitle, college_address, college_logo_data, principal_sign_data, college_stamp_data, default_exam_instructions, hall_ticket_template').eq('id', 1).maybeSingle(),
        supabase.from('student_profiles').select('roll_no').eq('user_id', profile!.id).maybeSingle(),
        supabase.from('enrollments').select('class_sections(name, section_code, semesters(label))').eq('student_id', profile!.id).eq('is_active', true).limit(1),
        profile?.department_id ? supabase.from('departments').select('name').eq('id', profile.department_id).maybeSingle() : Promise.resolve({ data: null }),
        profile?.specialization_id ? supabase.from('specializations').select('name').eq('id', profile.specialization_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('exam_hall_tickets').select('id, hall_ticket_no, regular_subjects, supplementary_subjects, exam_cycles(title, semester_label, exam_type, instructions)').eq('student_id', profile!.id).eq('is_approved', true).order('created_at', { ascending: false }),
        supabase.from('exam_results').select('id, marks_obtained, max_marks, pass_marks, status, subjects(code, name), exam_cycles(title, semester_label, results_external_url)').eq('student_id', profile!.id).eq('is_published', true).order('updated_at', { ascending: false }),
      ]);

      if (setRes.data) {
        setBranding({
          college_name: setRes.data.college_name || 'College ERP',
          college_subtitle: setRes.data.college_subtitle || '',
          college_address: setRes.data.college_address || '',
          college_logo_data: setRes.data.college_logo_data || '',
          principal_sign_data: setRes.data.principal_sign_data || '',
          college_stamp_data: setRes.data.college_stamp_data || '',
          default_exam_instructions: setRes.data.default_exam_instructions || '',
          hall_ticket_template: setRes.data.hall_ticket_template || null,
        });
      }

      const cs: any = enrRes.data?.[0]?.class_sections;
      const rollNo = spRes.data?.roll_no || '—';
      const deptName = (deptRes as any)?.data?.name || 'Department';
      const specName = (specRes as any)?.data?.name || 'General';

      if (htRes.data) {
        setTickets(
          htRes.data.map((t: any) => ({
            hall_ticket_no: t.hall_ticket_no,
            exam_title: t.exam_cycles?.title || 'Examination',
            semester_label: t.exam_cycles?.semester_label || cs?.semesters?.label || 'Semester',
            exam_type: t.exam_cycles?.exam_type || 'regular',
            student_name: profile!.full_name,
            roll_no: rollNo,
            department: deptName,
            specialization: specName,
            class_name: cs?.name || 'Class',
            section_code: cs?.section_code || 'A',
            photo_drive_url: profile?.photo_drive_url || '',
            regular_subjects: Array.isArray(t.regular_subjects) ? t.regular_subjects : [],
            supplementary_subjects: Array.isArray(t.supplementary_subjects) ? t.supplementary_subjects : [],
            instructions: t.exam_cycles?.instructions || setRes.data?.default_exam_instructions || '',
          }))
        );
      }

      if (resRows.data) {
        setResults(
          resRows.data.map((r: any) => ({
            id: r.id,
            cycle_title: r.exam_cycles?.title || 'Exam',
            semester_label: r.exam_cycles?.semester_label || '',
            external_url: r.exam_cycles?.results_external_url || null,
            subject_code: r.subjects?.code || 'SUB',
            subject_name: r.subjects?.name || 'Subject',
            marks_obtained: r.marks_obtained !== null ? Number(r.marks_obtained) : null,
            max_marks: Number(r.max_marks),
            pass_marks: Number(r.pass_marks),
            status: r.status,
          }))
        );
      }
    })();
  }, [demo, profile?.id, profile?.photo_drive_url]);

  const activeTicket = tickets[selectedTicketIdx];
  const externalLinks = Array.from(new Map(results.filter((r) => r.external_url).map((r) => [r.cycle_title, r.external_url!])).entries());
  const passedCount = results.filter((r) => r.status === 'pass').length;
  const backlogCount = results.filter((r) => r.status === 'fail' || r.status === 'absent').length;
  const passPct = results.length > 0 ? Math.round((passedCount / results.length) * 100) : null;

  return (
    <div className="erp-content">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Exam Centre &amp; Results</h1>
          <p className="page-sub">Print your approved Self-Center Hall Tickets and view published examination results.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={`btn ${tab === 'hall_tickets' ? 'btn-primary' : ''}`} onClick={() => setTab('hall_tickets')}>
            <Ticket size={15} /> Hall Tickets ({tickets.length})
          </button>
          <button className={`btn ${tab === 'results' ? 'btn-primary' : ''}`} onClick={() => setTab('results')}>
            <Award size={15} /> Published Results ({results.length})
          </button>
        </div>
      </div>

      <div className="kpi-grid no-print" style={{ marginBottom: 18 }}>
        <div className="kpi-card">
          <div className="kpi-label">Approved Hall Tickets</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>{tickets.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ready for A4 printing</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Subjects Passed</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{passedCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Out of {results.length} published</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Supplementary / Backlogs</div>
          <div className="kpi-value" style={{ color: backlogCount > 0 ? 'var(--danger)' : 'var(--text)' }}>{backlogCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{backlogCount > 0 ? 'Check Hall Tickets tab' : 'All clear'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pass Percentage</div>
          <div className="kpi-value">{passPct !== null ? `${passPct}%` : '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Published exam cycles</div>
        </div>
      </div>

      {tab === 'hall_tickets' && (
        <div>
          {tickets.length === 0 ? (
            <div className="card" style={{ color: 'var(--text-muted)' }}>
              No Hall Ticket has been approved for you yet. Once the Controller of Examinations or Admin verifies your checklist and approves your Hall Ticket, it will appear here ready to print.
            </div>
          ) : (
            <>
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {tickets.map((tk, idx) => (
                    <button
                      key={`${tk.hall_ticket_no}-${idx}`}
                      className={`btn ${selectedTicketIdx === idx ? 'btn-primary' : ''}`}
                      onClick={() => setSelectedTicketIdx(idx)}
                    >
                      {tk.exam_title} ({tk.exam_type.toUpperCase()})
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={() => window.print()}>
                  <Printer size={15} /> Print Official A4 Hall Ticket
                </button>
              </div>
              {activeTicket && <HallTicketSheet data={activeTicket} branding={branding} />}
            </>
          )}
        </div>
      )}

      {tab === 'results' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {externalLinks.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <strong>Official Results Portal Link Published</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Open the official results link announced by the Examination Cell.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {externalLinks.map(([title, url]) => (
                  <a key={title} href={url} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                    <ExternalLink size={14} /> {title}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <strong>Published Subject Results ({results.length})</strong>
              {results.length > 0 && (
                <button type="button" className="btn no-print" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => window.print()}>
                  <Printer size={14} /> Print Results
                </button>
              )}
            </div>
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead><tr><th>Exam</th><th>Subject</th><th>Marks Obtained</th><th>Pass Criteria</th><th>Status</th></tr></thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>No examination results published yet.</td></tr>
                  ) : (
                    results.map((r) => (
                      <tr key={r.id}>
                        <td><div style={{ fontWeight: 600 }}>{r.cycle_title}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.semester_label}</div></td>
                        <td><span className="mono">{r.subject_code}</span> — {r.subject_name}</td>
                        <td className="mono">{r.status === 'absent' ? 'AB' : `${r.marks_obtained ?? 0} / ${r.max_marks}`}</td>
                        <td className="mono">Min {r.pass_marks}</td>
                        <td>
                          <span className={`badge ${r.status === 'pass' ? 'badge-success' : 'badge-danger'}`}>
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
