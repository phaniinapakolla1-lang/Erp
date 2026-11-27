import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, supabase } from '../../lib/supabase';

interface TopicRow {
  id: string;
  teaching_assignment_id: string;
  class_label: string;
  unit_title: string;
  topic_title: string;
  planned_periods: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'revised';
  completed_date: string | null;
  notes: string;
}

export const SyllabusPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const canEdit = profile?.role === 'faculty' || profile?.role === 'admin';

  const [classes, setClasses] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedTa, setSelectedTa] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');

  const [topics, setTopics] = useState<TopicRow[]>(
    demo
      ? [
          {
            id: 't1',
            teaching_assignment_id: 'c1',
            class_label: 'MCA · Sec A — CS501 DBMS',
            unit_title: 'Unit 1: ER Modeling',
            topic_title: 'Entity Types, Relationships & Cardinality',
            planned_periods: 3,
            status: 'completed',
            completed_date: '2026-11-18',
            notes: 'Covered with lab examples',
          },
          {
            id: 't2',
            teaching_assignment_id: 'c1',
            class_label: 'MCA · Sec A — CS501 DBMS',
            unit_title: 'Unit 2: Normalization',
            topic_title: '1NF, 2NF, 3NF and BCNF',
            planned_periods: 4,
            status: 'in_progress',
            completed_date: null,
            notes: '',
          },
        ]
      : []
  );
  const [unitTitle, setUnitTitle] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [plannedPeriods, setPlannedPeriods] = useState(2);
  const [notice, setNotice] = useState('');

  const loadSyllabus = async () => {
    if (demo) return;
    const [taRes, topRes] = await Promise.all([
      supabase
        .from('teaching_assignments')
        .select('id, faculty_id, subjects(code, name), class_sections(name, section_code)'),
      supabase
        .from('syllabus_topics')
        .select('id, teaching_assignment_id, unit_title, topic_title, planned_periods, status, completed_date, notes, teaching_assignments(subjects(code, name), class_sections(name, section_code))')
        .order('created_at', { ascending: true }),
    ]);

    if (taRes.data) {
      const relevant = profile?.role === 'faculty'
        ? taRes.data.filter((t: any) => t.faculty_id === profile.id)
        : taRes.data;
      const mapped = relevant.map((t: any) => ({
        id: t.id,
        label: `${t.class_sections?.name || 'Class'} · ${t.class_sections?.section_code || ''} — ${t.subjects?.code || ''} ${t.subjects?.name || ''}`,
      }));
      setClasses(mapped);
      if (mapped.length > 0 && !selectedTa) setSelectedTa(mapped[0].id);
    }

    if (topRes.data) {
      setTopics(
        topRes.data.map((r: any) => ({
          id: r.id,
          teaching_assignment_id: r.teaching_assignment_id,
          class_label: r.teaching_assignments?.subjects
            ? `${r.teaching_assignments.class_sections?.name || ''} · ${r.teaching_assignments.class_sections?.section_code || ''} — ${r.teaching_assignments.subjects.code} ${r.teaching_assignments.subjects.name}`
            : 'Subject',
          unit_title: r.unit_title,
          topic_title: r.topic_title,
          planned_periods: Number(r.planned_periods),
          status: r.status,
          completed_date: r.completed_date,
          notes: r.notes || '',
        }))
      );
    }
  };

  useEffect(() => {
    loadSyllabus();
  }, [demo, profile?.id]);

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitTitle.trim() || !topicTitle.trim()) return;
    if (demo) {
      setTopics([...topics, { id: String(Date.now()), teaching_assignment_id: 'c1', class_label: 'MCA · Sec A — CS501 DBMS', unit_title: unitTitle, topic_title: topicTitle, planned_periods: plannedPeriods, status: 'not_started', completed_date: null, notes: '' }]);
      setUnitTitle(''); setTopicTitle('');
      return;
    }
    if (!selectedTa) { setNotice('Select a class/subject first.'); return; }
    const { error } = await supabase.from('syllabus_topics').insert({
      teaching_assignment_id: selectedTa,
      unit_title: unitTitle.trim(),
      topic_title: topicTitle.trim(),
      planned_periods: plannedPeriods,
      updated_by: profile!.id,
    });
    setNotice(error ? `Error: ${error.message}` : 'Syllabus topic added!');
    if (!error) {
      setUnitTitle(''); setTopicTitle('');
      await loadSyllabus();
    }
  };

  const handleStatusChange = async (id: string, status: TopicRow['status']) => {
    const completedDate = status === 'completed' || status === 'revised' ? new Date().toISOString().slice(0, 10) : null;
    if (demo) {
      setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, status, completed_date: completedDate } : t)));
      return;
    }
    const { error } = await supabase
      .from('syllabus_topics')
      .update({ status, completed_date: completedDate, updated_by: profile!.id, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) setNotice(`Error: ${error.message}`);
    else await loadSyllabus();
  };

  const handleDelete = async (id: string) => {
    if (demo) { setTopics((p) => p.filter((t) => t.id !== id)); return; }
    const { error } = await supabase.from('syllabus_topics').delete().eq('id', id);
    if (error) setNotice(`Error: ${error.message}`);
    else await loadSyllabus();
  };

  // Cascading Subject -> Unit/Module -> Topics filter
  const subjectOptions = Array.from(new Set(topics.map((t) => t.class_label)));
  const subjectFiltered = filterSubject === 'all' ? topics : topics.filter((t) => t.class_label === filterSubject);
  const unitOptions = Array.from(new Set(subjectFiltered.map((t) => t.unit_title)));
  const visibleTopics = filterUnit === 'all' ? subjectFiltered : subjectFiltered.filter((t) => t.unit_title === filterUnit);

  const totalTopics = visibleTopics.length;
  const completedCount = visibleTopics.filter((t) => t.status === 'completed' || t.status === 'revised').length;
  const coveragePct = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Syllabus &amp; Coverage Tracker</h1>
          <p className="page-sub">Browse by Subject → Unit / Module → Topics and track syllabus completion.</p>
        </div>
        <div className="badge badge-primary" style={{ padding: '8px 14px', fontSize: 13 }}>
          <CheckCircle2 size={15} /> Coverage: {coveragePct}% ({completedCount}/{totalTopics} topics)
        </div>
      </div>

      {notice && <div className="badge badge-primary" style={{ marginBottom: 14, padding: '6px 12px' }}>{notice}</div>}

      {/* Cascading Dropdown Filter: Subject -> Unit/Module -> Topics */}
      <div className="card" style={{ marginBottom: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>1. Select Subject</label>
          <select
            value={filterSubject}
            onChange={(e) => {
              setFilterSubject(e.target.value);
              setFilterUnit('all');
            }}
          >
            <option value="all">All Subjects ({subjectOptions.length})</option>
            {subjectOptions.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>2. Select Unit / Module</label>
          <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
            <option value="all">All Units / Modules ({unitOptions.length})</option>
            {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>3. Topics Progress ({coveragePct}%)</div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${coveragePct}%` }} /></div>
        </div>
      </div>

      {canEdit && (
        <form onSubmit={handleAddTopic} className="card" style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Class &amp; Subject *</label>
            <select value={selectedTa} onChange={(e) => setSelectedTa(e.target.value)} required>
              {classes.length === 0 ? <option value="">No assigned classes</option> : classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600 }}>Unit / Module *</label><input value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)} placeholder="e.g. Unit 1 / Module 1" required /></div>
          <div><label style={{ fontSize: 12, fontWeight: 600 }}>Topic *</label><input value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)} placeholder="e.g. SQL Joins & Subqueries" required /></div>
          <div><label style={{ fontSize: 12, fontWeight: 600 }}>Periods</label><input type="number" min={1} max={30} value={plannedPeriods} onChange={(e) => setPlannedPeriods(Number(e.target.value))} required /></div>
          <button type="submit" className="btn btn-primary" disabled={classes.length === 0 && !demo}><Plus size={15} /> Add Topic</button>
        </form>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="erp-table-wrap"><table className="erp-table">
          <thead><tr><th>Subject</th><th>Unit / Module</th><th>Topic</th><th>Periods</th><th>Status</th><th>Completed</th>{canEdit && <th>Action</th>}</tr></thead>
          <tbody>
            {visibleTopics.length === 0 ? (
              <tr><td colSpan={canEdit ? 7 : 6} style={{ color: 'var(--text-muted)' }}>No syllabus topics match the selected Subject / Unit.</td></tr>
            ) : (
              visibleTopics.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontSize: 12.5 }}>{t.class_label}</td>
                  <td style={{ fontWeight: 600 }}><BookOpen size={13} style={{ marginRight: 5 }} />{t.unit_title}</td>
                  <td>{t.topic_title}</td>
                  <td className="mono">{t.planned_periods}</td>
                  <td>
                    {canEdit ? (
                      <select style={{ width: 'auto', padding: '4px 8px' }} value={t.status} onChange={(e) => handleStatusChange(t.id, e.target.value as any)}>
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="revised">Revised</option>
                      </select>
                    ) : (
                      <span className={`badge ${t.status === 'completed' || t.status === 'revised' ? 'badge-success' : t.status === 'in_progress' ? 'badge-warn' : ''}`}>
                        {t.status.replace('_', ' ').toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{t.completed_date || '—'}</td>
                  {canEdit && (
                    <td><button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => handleDelete(t.id)}><Trash2 size={13} /></button></td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
};
