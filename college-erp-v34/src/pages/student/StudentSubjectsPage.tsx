import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Mail, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, supabase } from '../../lib/supabase';

interface StudentSubjectItem {
  id: string;
  code: string;
  name: string;
  subject_type: string;
  credits: number;
  class_label: string;
  faculty_name: string;
  faculty_email: string;
}

export const StudentSubjectsPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [subjects, setSubjects] = useState<StudentSubjectItem[]>(
    demo
      ? [
          {
            id: 'ta-1',
            code: 'CS501',
            name: 'Database Management Systems',
            subject_type: 'theory',
            credits: 4,
            class_label: 'MCA Year 1 · Sec A',
            faculty_name: 'Dr. Ananya Rao',
            faculty_email: 'faculty1****@***.com',
          },
          {
            id: 'ta-2',
            code: 'CS503L',
            name: 'DBMS & SQL Lab',
            subject_type: 'practical',
            credits: 2,
            class_label: 'MCA Year 1 · Sec A',
            faculty_name: 'Dr. Ananya Rao',
            faculty_email: 'faculty1****@***.com',
          },
        ]
      : []
  );
  const [loading, setLoading] = useState(!demo);

  useEffect(() => {
    if (demo) return;
    setLoading(true);
    supabase
      .from('teaching_assignments')
      .select('id, subjects(code, name, credits, subject_type), class_sections(name, section_code), profiles:faculty_id(full_name, email)')
      .then(({ data }) => {
        if (data) {
          setSubjects(
            data.map((d: any) => ({
              id: d.id,
              code: d.subjects?.code || 'SUB',
              name: d.subjects?.name || 'Subject',
              subject_type: d.subjects?.subject_type || 'theory',
              credits: Number(d.subjects?.credits ?? 0),
              class_label: d.class_sections ? `${d.class_sections.name} · Sec ${d.class_sections.section_code}` : 'Class',
              faculty_name: d.profiles?.full_name || 'Faculty',
              faculty_email: d.profiles?.email || '',
            }))
          );
        }
        setLoading(false);
      });
  }, [demo, profile?.id]);

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Subjects &amp; Faculty</h1>
          <p className="page-sub">Your enrolled subjects, assigned faculty members, and their internal College Mail IDs.</p>
        </div>
        <Link to="/syllabus" className="btn" style={{ textDecoration: 'none' }}>
          <BookOpen size={15} /> View Syllabus
        </Link>
      </div>

      {loading ? (
        <div className="card">Loading your subjects...</div>
      ) : subjects.length === 0 ? (
        <div className="card" style={{ color: 'var(--text-muted)' }}>
          No subjects assigned to your class yet. Ask your Administrator to verify your class enrollment.
        </div>
      ) : (
        <div className="grid-2">
          {subjects.map((s) => (
            <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-primary mono">{s.code}</span>
                    <span className="badge">{s.subject_type.toUpperCase()}</span>
                    <span className="badge">{s.credits} Credits</span>
                  </div>
                  <h2 style={{ fontSize: 16.5, margin: '8px 0 2px' }}>{s.name}</h2>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{s.class_label}</div>
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 8, background: 'var(--surface-alt)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                  <User size={14} color="var(--primary)" /> {s.faculty_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {s.faculty_email || 'No internal mail ID'}
                  </span>
                  {s.faculty_email && (
                    <Link
                      to={`/mail?to=${encodeURIComponent(s.faculty_email)}`}
                      className="btn btn-primary"
                      style={{ textDecoration: 'none', padding: '4px 10px', fontSize: 12.5 }}
                    >
                      <Mail size={13} /> Send Mail
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
