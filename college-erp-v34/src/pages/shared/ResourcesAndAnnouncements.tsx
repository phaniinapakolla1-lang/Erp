import React, { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, Megaphone, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, supabase } from '../../lib/supabase';

interface ResourceRow {
  id: string;
  title: string;
  description: string;
  resource_url: string;
  resource_type: string;
  subject_label: string;
  author_name: string;
  created_by: string;
  created_at: string;
}

export const LearningResourcesPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const canPublish = profile?.role === 'admin' || profile?.role === 'hod' || profile?.role === 'faculty';

  const [resources, setResources] = useState<ResourceRow[]>(
    demo
      ? [
          {
            id: 'r1',
            title: 'DBMS Unit 1 — ER Modeling & Normalization Notes',
            description: 'Lecture slides and solved normalization examples.',
            resource_url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view',
            resource_type: 'notes',
            subject_label: 'CS501 — DBMS',
            author_name: 'Dr. Ananya Rao',
            created_by: 'demo-faculty',
            created_at: '2026-11-20',
          },
        ]
      : []
  );
  const [classes, setClasses] = useState<Array<{ id: string; label: string }>>([]);
  const [taId, setTaId] = useState('');
  const [title, setTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState<'notes' | 'pdf' | 'slides' | 'video' | 'link'>('notes');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = async () => {
    if (demo) return;
    const [resQ, taQ] = await Promise.all([
      supabase
        .from('learning_resources')
        .select('id, title, description, resource_url, resource_type, created_by, created_at, profiles:created_by(full_name), teaching_assignments(subjects(code, name), class_sections(name, section_code))')
        .order('created_at', { ascending: false }),
      canPublish
        ? supabase
            .from('teaching_assignments')
            .select('id, faculty_id, subjects(code, name), class_sections(name, section_code)')
        : Promise.resolve({ data: [] as any[] }),
    ]);

    if (resQ.data) {
      setResources(
        resQ.data.map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description || '',
          resource_url: r.resource_url,
          resource_type: r.resource_type,
          subject_label: r.teaching_assignments?.subjects
            ? `${r.teaching_assignments.subjects.code} — ${r.teaching_assignments.subjects.name}${r.teaching_assignments.class_sections ? ` (${r.teaching_assignments.class_sections.name} · ${r.teaching_assignments.class_sections.section_code})` : ''}`
            : 'General / All Classes',
          author_name: r.profiles?.full_name || 'Faculty',
          created_by: r.created_by,
          created_at: new Date(r.created_at).toLocaleDateString(),
        }))
      );
    }

    if (taQ.data) {
      const relevant = profile?.role === 'faculty'
        ? taQ.data.filter((t: any) => t.faculty_id === profile.id)
        : taQ.data;
      const mapped = relevant.map((t: any) => ({
        id: t.id,
        label: `${t.class_sections?.name || 'Class'} · ${t.class_sections?.section_code || ''} — ${t.subjects?.code || ''} ${t.subjects?.name || ''}`,
      }));
      setClasses(mapped);
      if (mapped.length > 0 && !taId) setTaId(mapped[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, [demo, profile?.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !resourceUrl.trim()) return;
    if (demo) {
      setResources([{ id: String(Date.now()), title, description, resource_url: resourceUrl, resource_type: resourceType, subject_label: 'CS501 — DBMS', author_name: profile?.full_name || 'Faculty', created_by: profile?.id || 'demo', created_at: new Date().toLocaleDateString() }, ...resources]);
      setTitle(''); setResourceUrl(''); setDescription('');
      return;
    }
    const { error } = await supabase.from('learning_resources').insert({
      teaching_assignment_id: taId || null,
      title: title.trim(),
      description: description.trim() || null,
      resource_url: resourceUrl.trim(),
      resource_type: resourceType,
      created_by: profile!.id,
    });
    setNotice(error ? `Error: ${error.message}` : 'Learning resource published!');
    if (!error) {
      setTitle(''); setResourceUrl(''); setDescription('');
      await loadData();
    }
  };

  const handleDelete = async (id: string) => {
    if (demo) { setResources((r) => r.filter((x) => x.id !== id)); return; }
    const { error } = await supabase.from('learning_resources').delete().eq('id', id);
    if (error) setNotice(`Error: ${error.message}`);
    else await loadData();
  };

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Learning Resources &amp; Study Material</h1>
          <p className="page-sub">Subject-wise Google Drive notes, slides, and reference links shared by faculty.</p>
        </div>
      </div>

      {notice && <div className="badge badge-primary" style={{ marginBottom: 14, padding: '6px 12px' }}>{notice}</div>}

      {canPublish && (
        <form onSubmit={handleAdd} className="card" style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div><label style={{ fontSize: 12, fontWeight: 600 }}>Resource Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit 2 Lecture Notes" required /></div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Class &amp; Subject</label>
            <select value={taId} onChange={(e) => setTaId(e.target.value)}>
              <option value="">General / All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Type</label>
            <select value={resourceType} onChange={(e) => setResourceType(e.target.value as any)}>
              <option value="notes">Lecture Notes</option><option value="pdf">PDF Document</option><option value="slides">Slides</option><option value="video">Video</option><option value="link">Reference Link</option>
            </select>
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600 }}>Google Drive / Resource URL *</label><input type="url" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://drive.google.com/..." required /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 12, fontWeight: 600 }}>Description / Topics Covered</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes for students..." /></div>
          <div><button type="submit" className="btn btn-primary"><Plus size={15} /> Share Resource</button></div>
        </form>
      )}

      <div className="grid-2">
        {resources.length === 0 ? (
          <div className="card" style={{ color: 'var(--text-muted)' }}>No learning resources shared yet.</div>
        ) : (
          resources.map((r) => (
            <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpen size={16} color="var(--primary)" />
                    <strong style={{ fontSize: 15.5 }}>{r.title}</strong>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{r.subject_label} · Shared by {r.author_name} · {r.created_at}</div>
                </div>
                <span className="badge badge-primary">{r.resource_type.toUpperCase()}</span>
              </div>
              {r.description && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>{r.description}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <a href={r.resource_url} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ textDecoration: 'none', padding: '5px 12px' }}>
                  <ExternalLink size={14} /> Open Resource
                </a>
                {(profile?.role === 'admin' || r.created_by === profile?.id) && (
                  <button className="btn btn-danger" style={{ padding: '5px 10px' }} onClick={() => handleDelete(r.id)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  target_role: string;
  dept_name: string;
  author_name: string;
  created_by: string;
  created_at: string;
}

export const AnnouncementsPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const canPost = profile?.role === 'admin' || profile?.role === 'hod' || profile?.role === 'faculty' || profile?.role === 'exam_controller';

  const [items, setItems] = useState<AnnouncementRow[]>(
    demo
      ? [
          {
            id: 'a1',
            title: 'Mid-Semester Assignment Deadlines',
            body: 'All students must submit their Google Drive assignment links with "Anyone with the link – Viewer" access before Friday 11:59 PM.',
            target_role: 'student',
            dept_name: 'All Departments',
            author_name: 'Academic Office',
            created_by: 'demo-admin',
            created_at: '2026-11-21',
          },
        ]
      : []
  );
  const [departments, setDepartments] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<'all' | 'student' | 'faculty' | 'hod'>('all');
  const [deptId, setDeptId] = useState('');
  const [notice, setNotice] = useState('');

  const loadAnnouncements = async () => {
    if (demo) return;
    const [annRes, deptRes] = await Promise.all([
      supabase
        .from('announcements')
        .select('id, title, body, target_role, created_by, created_at, departments(code, name), profiles:created_by(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('departments').select('id, code, name').order('code'),
    ]);
    if (annRes.data) {
      setItems(
        annRes.data.map((a: any) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          target_role: a.target_role,
          dept_name: a.departments ? `${a.departments.code} — ${a.departments.name}` : 'All Departments',
          author_name: a.profiles?.full_name || 'Staff',
          created_by: a.created_by,
          created_at: new Date(a.created_at).toLocaleString(),
        }))
      );
    }
    if (deptRes.data) setDepartments(deptRes.data);
  };

  useEffect(() => {
    loadAnnouncements();
  }, [demo, profile?.id]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (demo) {
      setItems([{ id: String(Date.now()), title, body, target_role: targetRole, dept_name: 'All Departments', author_name: profile?.full_name || 'Admin', created_by: profile?.id || 'demo', created_at: new Date().toLocaleString() }, ...items]);
      setTitle(''); setBody('');
      return;
    }
    const { error } = await supabase.from('announcements').insert({
      title: title.trim(),
      body: body.trim(),
      target_role: targetRole,
      department_id: deptId || null,
      created_by: profile!.id,
    });
    setNotice(error ? `Error: ${error.message}` : 'Announcement posted!');
    if (!error) {
      setTitle(''); setBody('');
      await loadAnnouncements();
    }
  };

  const handleDelete = async (id: string) => {
    if (demo) { setItems((p) => p.filter((x) => x.id !== id)); return; }
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) setNotice(`Error: ${error.message}`);
    else await loadAnnouncements();
  };

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Institutional &amp; Department Announcements</h1>
          <p className="page-sub">Official notices, exam updates, and class announcements.</p>
        </div>
      </div>

      {notice && <div className="badge badge-primary" style={{ marginBottom: 14, padding: '6px 12px' }}>{notice}</div>}

      {canPost && (
        <form onSubmit={handlePost} className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Announcement Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Internal Exam Schedule Released" required /></div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Audience</label>
              <select value={targetRole} onChange={(e) => setTargetRole(e.target.value as any)}>
                <option value="all">Everyone</option><option value="student">Students Only</option><option value="faculty">Faculty Only</option><option value="hod">HODs Only</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Department Scope</label>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600 }}>Message *</label><textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your announcement..." required /></div>
          <div><button type="submit" className="btn btn-primary"><Megaphone size={15} /> Post Announcement</button></div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.length === 0 ? (
          <div className="card" style={{ color: 'var(--text-muted)' }}>No announcements posted yet.</div>
        ) : (
          items.map((a) => (
            <div key={a.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <strong style={{ fontSize: 16 }}>{a.title}</strong>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    Posted by {a.author_name} · {a.created_at} · {a.dept_name}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="badge badge-primary">{a.target_role.toUpperCase()}</span>
                  {(profile?.role === 'admin' || a.created_by === profile?.id) && (
                    <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => handleDelete(a.id)}><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5 }}>{a.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
