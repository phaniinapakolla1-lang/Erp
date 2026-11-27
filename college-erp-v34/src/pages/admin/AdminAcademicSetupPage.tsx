import React, { useEffect, useState } from 'react';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { DEFAULT_PERIODS, fetchPeriods, Period, savePeriods } from '../../lib/periods';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, supabase } from '../../lib/supabase';

/** "2026-27" -> { start: 2026-07-01, end: 2027-06-30 } (falls back to the current year if unparsable). */
function academicYearDates(label: string): { start: string; end: string } {
  const m = label.match(/(\d{4})/);
  const y = m ? Number(m[1]) : new Date().getFullYear();
  return { start: `${y}-07-01`, end: `${y + 1}-06-30` };
}

export const AdminAcademicSetupPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [tab, setTab] = useState<'departments' | 'specializations' | 'subjects' | 'faculty_map' | 'timetable' | 'semesters'>('departments');
  const [specs, setSpecs] = useState<Array<{ id: string; department_id: string; code: string; name: string; dept_name?: string }>>([]);
  const [specDeptId, setSpecDeptId] = useState('');
  const [specCode, setSpecCode] = useState('');
  const [specName, setSpecName] = useState('');
  const [subSpecId, setSubSpecId] = useState('');
  const [notice, setNotice] = useState('');

  const [departments, setDepartments] = useState<Array<{ id: string; code: string; name: string }>>(
    demo ? [{ id: 'd1', code: 'CS', name: 'Computer Science & Applications' }] : []
  );
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');

  const [subjects, setSubjects] = useState<Array<{ id: string; code: string; name: string; credits: number; subject_type?: string; department_id?: string }>>(
    demo ? [{ id: 's1', code: 'CS501', name: 'Database Management Systems', credits: 4 }] : []
  );
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subCredits, setSubCredits] = useState<number>(4);
  const [creditDraft, setCreditDraft] = useState<Record<string, string>>({});
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [subType, setSubType] = useState<'theory' | 'practical'>('theory');
  const [promoSourceSec, setPromoSourceSec] = useState('');
  const [promoTargetSec, setPromoTargetSec] = useState('');
  const [promoSections, setPromoSections] = useState<Array<{ id: string; label: string }>>([]);

  const [facultyList, setFacultyList] = useState<Array<{ id: string; full_name: string; email: string; role: string }>>(
    demo ? [{ id: 'f1', full_name: 'Dr. Ananya Rao', email: 'ananya@college.edu', role: 'faculty' }] : []
  );
  const [mappings, setMappings] = useState<Array<{ id: string; faculty: string; cls: string; subject: string }>>(
    demo ? [{ id: 'm1', faculty: 'Dr. Ananya Rao', cls: 'MCA Year 1 · Section A', subject: 'CS501 — Database Management Systems' }] : []
  );
  const [selectedFacultyId, setSelectedFacultyId] = useState(demo ? 'f1' : '');
  const [clsName, setClsName] = useState('MCA Year 1');
  const [clsSection, setClsSection] = useState('A');
  const [selectedSubjectId, setSelectedSubjectId] = useState(demo ? 's1' : '');

  const [periods, setPeriods] = useState<Period[]>(DEFAULT_PERIODS);
  const [newPeriodLabel, setNewPeriodLabel] = useState('Period 7');
  const [newPeriodStart, setNewPeriodStart] = useState('16:30');
  const [newPeriodEnd, setNewPeriodEnd] = useState('17:30');

  const [timetable, setTimetable] = useState<Array<{ id: string; day: string; period: string; cls: string; subject: string; faculty: string; room: string }>>(
    demo ? [{ id: 't1', day: 'Monday', period: '09:30 – 10:30', cls: 'MCA Year 1 · A', subject: 'CS501 — DBMS', faculty: 'Dr. Ananya Rao', room: 'Lab 302' }] : []
  );
  const [ttMappingId, setTtMappingId] = useState(demo ? 'm1' : '');
  const [ttDay, setTtDay] = useState('1');
  const [ttPeriodIdx, setTtPeriodIdx] = useState(0);
  const [ttRoom, setTtRoom] = useState('LH 105');

  const [semesters, setSemesters] = useState<Array<{ id: string; number: number; label: string; is_active: boolean }>>(
    demo ? [{ id: 'sem1', number: 1, label: '2026–27 · Semester 1', is_active: true }] : []
  );
  const [newSemYear, setNewSemYear] = useState('2026-27');
  const [newSemNum, setNewSemNum] = useState(1);
  const [newSemLabel, setNewSemLabel] = useState('Semester 1');

  const DAY_NAMES: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };

  const loadAllLive = async () => {
    if (demo) return;
    const [deptsRes, specsRes, subsRes, facRes, semRes, taRes, slotsRes] = await Promise.all([
      supabase.from('departments').select('id, code, name').order('name'),
      supabase.from('specializations').select('id, department_id, code, name, departments(code, name)').order('name'),
      supabase.from('subjects').select('id, code, name, credits, subject_type, department_id').order('code'),
      supabase.from('profiles').select('id, full_name, email, role').in('role', ['faculty', 'hod']).eq('status', 'approved').order('full_name'),
      supabase.from('semesters').select('id, number, label, is_active').order('number'),
      supabase.from('teaching_assignments').select('id, profiles:faculty_id(full_name), subjects(code, name), class_sections(name, section_code)'),
      supabase.from('weekly_schedule_slots').select('id, day_of_week, start_time, end_time, room, teaching_assignments(profiles:faculty_id(full_name), subjects(code, name), class_sections(name, section_code))').order('day_of_week'),
    ]);

    if (deptsRes.data) {
      setDepartments(deptsRes.data);
      if (deptsRes.data.length > 0 && !selectedDeptId) setSelectedDeptId(deptsRes.data[0].id);
      if (deptsRes.data.length > 0 && !specDeptId) setSpecDeptId(deptsRes.data[0].id);
    }
    if (specsRes.data) {
      setSpecs(specsRes.data.map((sp: any) => ({ id: sp.id, department_id: sp.department_id, code: sp.code, name: sp.name, dept_name: sp.departments ? `${sp.departments.code} — ${sp.departments.name}` : '' })));
    }
    if (subsRes.data) {
      setSubjects(subsRes.data);
      setCreditDraft(Object.fromEntries(subsRes.data.map((sb: any) => [sb.id, String(sb.credits ?? 4)])));
      if (subsRes.data.length > 0 && !selectedSubjectId) setSelectedSubjectId(subsRes.data[0].id);
    }
    if (facRes.data) {
      setFacultyList(facRes.data);
      if (facRes.data.length > 0 && !selectedFacultyId) setSelectedFacultyId(facRes.data[0].id);
    }
    if (semRes.data) setSemesters(semRes.data);
    const { data: csRows } = await supabase.from('class_sections').select('id, name, section_code, semesters(label)').order('name');
    if (csRows) {
      const mappedCs = csRows.map((c: any) => ({ id: c.id, label: `${c.name} · Sec ${c.section_code}${c.semesters?.label ? ` (${c.semesters.label})` : ''}` }));
      setPromoSections(mappedCs);
      if (mappedCs.length > 0 && !promoSourceSec) setPromoSourceSec(mappedCs[0].id);
      if (mappedCs.length > 1 && !promoTargetSec) setPromoTargetSec(mappedCs[1].id);
    }
    if (taRes.data) {
      const mapped = taRes.data.map((m: any) => ({
        id: m.id,
        faculty: m.profiles?.full_name || 'Faculty',
        cls: m.class_sections ? `${m.class_sections.name} · Sec ${m.class_sections.section_code}` : 'Class',
        subject: m.subjects ? `${m.subjects.code} — ${m.subjects.name}` : 'Subject',
      }));
      setMappings(mapped);
      if (mapped.length > 0 && !ttMappingId) setTtMappingId(mapped[0].id);
    }
    if (slotsRes.data) {
      setTimetable(
        slotsRes.data.map((s: any) => ({
          id: s.id,
          day: DAY_NAMES[s.day_of_week] || `Day ${s.day_of_week}`,
          period: `${String(s.start_time).slice(0, 5)} – ${String(s.end_time).slice(0, 5)}`,
          cls: s.teaching_assignments?.class_sections ? `${s.teaching_assignments.class_sections.name} · Sec ${s.teaching_assignments.class_sections.section_code}` : 'Class',
          subject: s.teaching_assignments?.subjects ? `${s.teaching_assignments.subjects.code} — ${s.teaching_assignments.subjects.name}` : 'Subject',
          faculty: s.teaching_assignments?.profiles?.full_name || 'Faculty',
          room: s.room || 'TBA',
        }))
      );
    }
  };

  useEffect(() => {
    loadAllLive();
  }, [demo]);

  const ensureActiveSemesterAndProgram = async (deptId: string) => {
    let { data: ay } = await supabase.from('academic_years').select('id').eq('is_current', true).limit(1).maybeSingle();
    if (!ay) {
      const { data: createdAy, error: ayErr } = await supabase
        .from('academic_years')
        .insert({ label: newSemYear || '2026-27', start_date: academicYearDates(newSemYear || '2026-27').start, end_date: academicYearDates(newSemYear || '2026-27').end, is_current: true })
        .select('id')
        .single();
      if (ayErr) throw ayErr;
      ay = createdAy;
    }

    let { data: sem } = await supabase.from('semesters').select('id').eq('is_active', true).limit(1).maybeSingle();
    if (!sem) {
      const { data: createdSem, error: semErr } = await supabase
        .from('semesters')
        .insert({ academic_year_id: ay.id, number: 1, label: 'Semester 1', is_active: true })
        .select('id')
        .single();
      if (semErr) throw semErr;
      sem = createdSem;
    }

    let { data: prog } = await supabase.from('programs').select('id').eq('department_id', deptId).limit(1).maybeSingle();
    if (!prog) {
      const dept = departments.find((d) => d.id === deptId);
      const code = `${dept?.code || 'GEN'}-PROG`;
      const { data: createdProg, error: progErr } = await supabase
        .from('programs')
        .insert({ department_id: deptId, code, name: `${dept?.name || 'General'} Program`, duration_years: 3 })
        .select('id')
        .single();
      if (progErr) throw progErr;
      prog = createdProg;
    }

    return { academicYearId: ay.id, semesterId: sem.id, programId: prog.id };
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptCode.trim() || !deptName.trim()) return;
    const code = deptCode.toUpperCase();
    if (demo) {
      setDepartments([{ id: String(Date.now()), code, name: deptName }, ...departments]);
    } else {
      const { error } = await supabase.from('departments').insert({ code, name: deptName });
      setNotice(error ? error.message : `Department ${code} saved.`);
      if (!error) await loadAllLive();
    }
    setDeptCode('');
    setDeptName('');
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCode.trim() || !subName.trim()) return;
    const code = subCode.toUpperCase();
    const targetDeptId = selectedDeptId || departments[0]?.id || '';
    if (demo) {
      setSubjects([{ id: String(Date.now()), code, name: subName, credits: Number(subCredits) || 0, subject_type: subType }, ...subjects]);
    } else {
      if (!targetDeptId) {
        setNotice('Please add a Department in Step 1 first.');
        return;
      }
      const { error } = await supabase.from('subjects').insert({ department_id: targetDeptId, specialization_id: subSpecId || null, code, name: subName, credits: Number(subCredits) || 0, subject_type: subType });
      setNotice(error ? error.message : `Subject ${code} saved.`);
      if (!error) await loadAllLive();
    }
    setSubCode('');
    setSubName('');
  };

  const handleAssignFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacultyId || !selectedSubjectId) return;
    if (demo) {
      const fac = facultyList.find((f) => f.id === selectedFacultyId)?.full_name || 'Faculty';
      const sub = subjects.find((s) => s.id === selectedSubjectId);
      setMappings([{ id: String(Date.now()), faculty: fac, cls: `${clsName} · Sec ${clsSection}`, subject: sub ? `${sub.code} — ${sub.name}` : 'Subject' }, ...mappings]);
      return;
    }
    try {
      // The class belongs to the SUBJECT's department (drives HOD scoping), not to whatever the Subjects tab last selected.
      const deptId = subjects.find((x) => x.id === selectedSubjectId)?.department_id || selectedDeptId || departments[0]?.id;
      if (!deptId) {
        setNotice('Create a Department in Step 1 first.');
        return;
      }
      const { semesterId, programId } = await ensureActiveSemesterAndProgram(deptId);
      let { data: sec } = await supabase
        .from('class_sections')
        .select('id')
        .eq('program_id', programId)
        .eq('semester_id', semesterId)
        .eq('name', clsName.trim())
        .eq('section_code', clsSection.trim().toUpperCase())
        .maybeSingle();
      if (!sec) {
        const { data: createdSec, error: secErr } = await supabase
          .from('class_sections')
          .insert({ program_id: programId, semester_id: semesterId, name: clsName.trim(), section_code: clsSection.trim().toUpperCase() })
          .select('id')
          .single();
        if (secErr) throw secErr;
        sec = createdSec;
      }
      const { error: taErr } = await supabase.from('teaching_assignments').insert({
        faculty_id: selectedFacultyId,
        subject_id: selectedSubjectId,
        class_section_id: sec.id,
        semester_id: semesterId,
      });
      if (taErr) throw taErr;
      setNotice('Faculty assigned successfully!');
      await loadAllLive();
    } catch (err: any) {
      setNotice(`Error: ${err.message}`);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    setMappings((prev) => prev.filter((x) => x.id !== id));
    if (!demo) {
      const { error } = await supabase.from('teaching_assignments').delete().eq('id', id);
      if (error) {
        setNotice(`Cannot remove this assignment (it probably has attendance or assignments attached): ${error.message}`);
        await loadAllLive(); // restore the row that was optimistically removed
      }
    }
  };

  useEffect(() => { if (!demo) fetchPeriods().then(setPeriods); }, [demo]);

  const persistPeriods = async (next: Period[]) => {
    const prev = periods;
    setPeriods(next.map((p, i) => ({ ...p, id: String(i + 1) })));
    if (demo) return;
    const err = await savePeriods(next);
    if (err) {
      setPeriods(prev);
      setNotice(`Error saving periods: ${err}`);
    } else {
      setNotice('Periods saved. Faculty attendance now uses these periods.');
    }
  };

  const handleAddPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodLabel.trim() || newPeriodEnd <= newPeriodStart) {
      setNotice('Enter a period name and an end time after the start time.');
      return;
    }
    void persistPeriods([...periods, { id: String(periods.length + 1), label: newPeriodLabel.trim(), start: newPeriodStart, end: newPeriodEnd }]);
    setNewPeriodLabel(`Period ${periods.length + 2}`);
  };

  const handleRemovePeriod = (idx: number) => {
    if (periods.length <= 1) return;
    if (!window.confirm('Remove this period? Existing attendance sessions keep their period number, so only remove the LAST period unless you know what you are doing.')) return;
    void persistPeriods(periods.filter((_, i) => i !== idx));
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = periods[ttPeriodIdx] || periods[0];
    if (demo) {
      setTimetable([{ id: String(Date.now()), day: DAY_NAMES[Number(ttDay)], period: `${p.start} – ${p.end}`, cls: clsName, subject: 'Subject', faculty: 'Faculty', room: ttRoom }, ...timetable]);
      return;
    }
    if (!ttMappingId) {
      setNotice('Assign a Faculty & Subject in Step 3 first.');
      return;
    }
    const { error } = await supabase.from('weekly_schedule_slots').insert({
      teaching_assignment_id: ttMappingId,
      day_of_week: Number(ttDay),
      start_time: p.start,
      end_time: p.end,
      room: ttRoom,
    });
    setNotice(error ? `Error: ${error.message}` : 'Timetable slot added!');
    if (!error) await loadAllLive();
  };

  const handleDeleteSlot = async (id: string) => {
    setTimetable((prev) => prev.filter((x) => x.id !== id));
    if (!demo) {
      const { error } = await supabase.from('weekly_schedule_slots').delete().eq('id', id);
      if (error) {
        setNotice(`Error: ${error.message}`);
        await loadAllLive();
      }
    }
  };

  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSemLabel.trim()) return;
    if (demo) {
      setSemesters([{ id: String(Date.now()), number: newSemNum, label: newSemLabel, is_active: false }, ...semesters]);
      return;
    }
    try {
      const deptId = departments[0]?.id;
      let ayId: string;
      let { data: ay } = await supabase.from('academic_years').select('id').eq('label', newSemYear).maybeSingle();
      if (!ay) {
        await supabase.from('academic_years').update({ is_current: false }).eq('is_current', true);
        const { data: createdAy, error: ayErr } = await supabase
          .from('academic_years')
          .insert({ label: newSemYear, start_date: academicYearDates(newSemYear).start, end_date: academicYearDates(newSemYear).end, is_current: true })
          .select('id')
          .single();
        if (ayErr) throw ayErr;
        ayId = createdAy.id;
      } else {
        ayId = ay.id;
      }
      const { error } = await supabase.from('semesters').insert({
        academic_year_id: ayId,
        number: newSemNum,
        label: newSemLabel,
        is_active: false,
      });
      if (error) throw error;
      setNotice(`Created ${newSemLabel}.`);
      if (deptId) await loadAllLive();
      else await loadAllLive();
    } catch (err: any) {
      setNotice(`Error: ${err.message}`);
    }
  };

  const handleToggleSemester = async (id: string, currentActive: boolean) => {
    if (demo) {
      setSemesters((prev) => prev.map((x) => (x.id === id ? { ...x, is_active: !currentActive } : x)));
      return;
    }
    const { error } = await supabase.from('semesters').update({ is_active: !currentActive }).eq('id', id);
    if (error) setNotice(`Error: ${error.message}`);
    else await loadAllLive();
  };

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Academic Setup</h1>
          <p className="page-sub">Step 1: Departments → Step 2: Subjects → Step 3: Assign to Faculty → Step 4: Periods &amp; Timetable → Step 5: Semesters.</p>
        </div>
      </div>

      {notice && <div className="badge badge-primary" style={{ marginBottom: 14, padding: '6px 12px' }}>{notice}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'departments' ? 'btn-primary' : ''}`} onClick={() => setTab('departments')}>1. Departments</button>
        <button className={`btn ${tab === 'specializations' ? 'btn-primary' : ''}`} onClick={() => setTab('specializations')}>2. Specializations</button>
        <button className={`btn ${tab === 'subjects' ? 'btn-primary' : ''}`} onClick={() => setTab('subjects')}>3. Subjects</button>
        <button className={`btn ${tab === 'faculty_map' ? 'btn-primary' : ''}`} onClick={() => setTab('faculty_map')}>3. Assign to Faculty</button>
        <button className={`btn ${tab === 'timetable' ? 'btn-primary' : ''}`} onClick={() => setTab('timetable')}>4. Periods &amp; Timetable</button>
        <button className={`btn ${tab === 'semesters' ? 'btn-primary' : ''}`} onClick={() => setTab('semesters')}>5. Semesters &amp; Rollover</button>
      </div>

      {tab === 'departments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form onSubmit={handleAddDepartment} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 12, alignItems: 'end' }}>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Dept Code</label><input value={deptCode} onChange={(e) => setDeptCode(e.target.value)} placeholder="e.g. CS" required /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Department Name</label><input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Computer Science" required /></div>
            <button type="submit" className="btn btn-primary"><Plus size={15} /> Add Department</button>
          </form>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="erp-table-wrap"><table className="erp-table">
              <thead><tr><th>Code</th><th>Department Name</th><th>Action</th></tr></thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr><td colSpan={3} style={{ color: 'var(--text-muted)' }}>No departments added yet. Add your first department above.</td></tr>
                ) : (
                  departments.map((d) => (
                    <tr key={d.id}>
                      <td className="mono">{d.code}</td>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 9px' }}
                          title="Delete Department"
                          onClick={async () => {
                            if (!window.confirm(`Delete department ${d.code} (${d.name})?`)) return;
                            if (demo) { setDepartments((prev) => prev.filter((x) => x.id !== d.id)); return; }
                            const { error } = await supabase.rpc('admin_delete_department', { p_dept_id: d.id });
                            setNotice(error ? `Error: ${error.message}` : `Deleted department ${d.code}.`);
                            if (!error) await loadAllLive();
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {tab === 'specializations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!specDeptId || !specCode.trim() || !specName.trim()) return;
              const { error } = await supabase.from('specializations').insert({
                department_id: specDeptId,
                code: specCode.trim().toUpperCase(),
                name: specName.trim(),
              });
              setNotice(error ? error.message : `Saved specialization ${specCode.trim().toUpperCase()}.`);
              if (!error) { setSpecCode(''); setSpecName(''); await loadAllLive(); }
            }}
            className="card"
            style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1.6fr auto', gap: 12, alignItems: 'end' }}
          >
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Department</label>
              <select value={specDeptId} onChange={(e) => setSpecDeptId(e.target.value)} required>
                {departments.length === 0 ? <option value="">Add Dept first</option> : departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Code</label><input value={specCode} onChange={(e) => setSpecCode(e.target.value)} placeholder="e.g. AI-ML" required /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Specialization Name</label><input value={specName} onChange={(e) => setSpecName(e.target.value)} placeholder="e.g. Artificial Intelligence & ML" required /></div>
            <button type="submit" className="btn btn-primary" disabled={departments.length === 0}><Plus size={15} /> Add Specialization</button>
          </form>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="erp-table-wrap"><table className="erp-table">
              <thead><tr><th>Code</th><th>Specialization</th><th>Department</th><th>Action</th></tr></thead>
              <tbody>
                {specs.length === 0 ? (
                  <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No specializations added yet.</td></tr>
                ) : (
                  specs.map((sp) => (
                    <tr key={sp.id}>
                      <td className="mono">{sp.code}</td>
                      <td style={{ fontWeight: 600 }}>{sp.name}</td>
                      <td>{sp.dept_name}</td>
                      <td>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 9px' }}
                          title="Delete Specialization"
                          onClick={async () => {
                            if (!window.confirm(`Delete specialization ${sp.code}?`)) return;
                            if (demo) { setSpecs((prev) => prev.filter((x) => x.id !== sp.id)); return; }
                            const { error } = await supabase.from('specializations').delete().eq('id', sp.id);
                            setNotice(error ? `Error: ${error.message}` : `Deleted specialization ${sp.code}.`);
                            if (!error) await loadAllLive();
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {tab === 'subjects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form onSubmit={handleAddSubject} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Department</label>
              <select value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)} required>
                {departments.length === 0 ? <option value="">Add Dept first</option> : departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Subject Code</label><input value={subCode} onChange={(e) => setSubCode(e.target.value)} placeholder="e.g. CS501" required /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Subject Name</label><input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="e.g. Database Management Systems" required /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Specialization</label><select value={subSpecId} onChange={(e) => setSubSpecId(e.target.value)}><option value="">Core / General</option>{specs.filter((sp) => !selectedDeptId || sp.department_id === selectedDeptId).map((sp) => <option key={sp.id} value={sp.id}>{sp.code} — {sp.name}</option>)}</select></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Type</label><select value={subType} onChange={(e) => setSubType(e.target.value as any)}><option value="theory">Theory</option><option value="practical">Practical</option></select></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Credits</label><input type="number" min={0} max={30} step={0.5} value={subCredits} onChange={(e) => setSubCredits(Number(e.target.value))} required /></div>
            <button type="submit" className="btn btn-primary" disabled={departments.length === 0}><Plus size={15} /> Create Subject</button>
          </form>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="erp-table-wrap"><table className="erp-table">
              <thead><tr><th>Code</th><th>Subject Name</th><th>Type</th><th>Credits</th><th>Action</th></tr></thead>
              <tbody>
                {subjects.length === 0 ? (
                  <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>No subjects added yet.</td></tr>
                ) : (
                  subjects.map((s) => (
                    <tr key={s.id}>
                      <td className="mono">{s.code}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span className="badge">{(s.subject_type || 'theory').toUpperCase()}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number"
                            min={0}
                            max={30}
                            step={0.5}
                            style={{ width: 72, padding: '4px 8px' }}
                            value={creditDraft[s.id] ?? String(s.credits)}
                            onChange={(e) => setCreditDraft((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          />
                          <button
                            className="btn"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={async () => {
                              const val = Number(creditDraft[s.id] ?? s.credits);
                              if (demo) { setSubjects((prev) => prev.map((x) => (x.id === s.id ? { ...x, credits: val } : x))); return; }
                              const { error } = await supabase.rpc('admin_update_subject_credits', { p_subject_id: s.id, p_credits: val });
                              setNotice(error ? `Error: ${error.message}` : `Updated credits for ${s.code} to ${val}.`);
                              if (!error) await loadAllLive();
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 9px' }}
                          title="Delete Subject"
                          onClick={async () => {
                            if (!window.confirm(`Delete subject ${s.code} (${s.name})?`)) return;
                            if (demo) { setSubjects((prev) => prev.filter((x) => x.id !== s.id)); return; }
                            const { error } = await supabase.rpc('admin_delete_subject', { p_subject_id: s.id });
                            setNotice(error ? `Error: ${error.message}` : `Deleted subject ${s.code}.`);
                            if (!error) await loadAllLive();
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {tab === 'faculty_map' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {facultyList.length === 0 && (
            <div className="badge badge-warn" style={{ padding: '8px 12px' }}>
              No approved Faculty or HOD accounts found yet. Approve a staff member in User Approvals first.
            </div>
          )}
          <form onSubmit={handleAssignFaculty} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.6fr 1.2fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Faculty</label>
              <select value={selectedFacultyId} onChange={(e) => setSelectedFacultyId(e.target.value)} required>
                {facultyList.length === 0 ? <option value="">No approved faculty</option> : facultyList.map((f) => <option key={f.id} value={f.id}>{f.full_name} ({f.role.toUpperCase()})</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Class</label><input value={clsName} onChange={(e) => setClsName(e.target.value)} placeholder="e.g. MCA Year 1" required /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Section</label><input value={clsSection} onChange={(e) => setClsSection(e.target.value)} placeholder="A" required /></div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Subject</label>
              <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)} required>
                {subjects.length === 0 ? <option value="">Create Subject first</option> : subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={facultyList.length === 0 || subjects.length === 0}><Plus size={15} /> Assign Class</button>
          </form>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="erp-table-wrap"><table className="erp-table">
              <thead><tr><th>Assigned Faculty</th><th>Class &amp; Section</th><th>Subject</th><th>Action</th></tr></thead>
              <tbody>
                {mappings.length === 0 ? (
                  <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No faculty assignments yet. Assign a subject to a faculty member above.</td></tr>
                ) : (
                  mappings.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.faculty}</td>
                      <td>{m.cls}</td>
                      <td>{m.subject}</td>
                      <td><button className="btn btn-danger" style={{ padding: '4px 9px' }} onClick={() => handleDeleteMapping(m.id)}><Trash2 size={14} /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {tab === 'timetable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h2 style={{ fontSize: 15.5, margin: '0 0 10px' }}>Configure College Periods &amp; Timings (Admin)</h2>
            <form onSubmit={handleAddPeriod} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, fontWeight: 600 }}>Period Name</label><input value={newPeriodLabel} onChange={(e) => setNewPeriodLabel(e.target.value)} placeholder="Period 7" required /></div>
              <div><label style={{ fontSize: 12, fontWeight: 600 }}>Start Time</label><input type="time" value={newPeriodStart} onChange={(e) => setNewPeriodStart(e.target.value)} required /></div>
              <div><label style={{ fontSize: 12, fontWeight: 600 }}>End Time</label><input type="time" value={newPeriodEnd} onChange={(e) => setNewPeriodEnd(e.target.value)} required /></div>
              <button type="submit" className="btn"><Plus size={15} /> Add Period</button>
            </form>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {periods.map((p) => (
                <span key={p.id} className="badge badge-primary" style={{ padding: '4px 10px' }}>{p.label} ({p.start}–{p.end}) <button type="button" onClick={() => handleRemovePeriod(periods.indexOf(p))} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit', marginLeft: 4 }} aria-label={`Remove ${p.label}`}>×</button></span>
              ))}
            </div>
          </div>

          <form onSubmit={handleAddSlot} className="card" style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.2fr 1.8fr 0.8fr auto', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Day (Mon–Sat)</label>
              <select value={ttDay} onChange={(e) => setTtDay(e.target.value)}>
                {Object.entries(DAY_NAMES).map(([num, name]) => <option key={num} value={num}>{name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Period / Time</label>
              <select value={ttPeriodIdx} onChange={(e) => setTtPeriodIdx(Number(e.target.value))}>
                {periods.map((p, idx) => <option key={p.id} value={idx}>{p.label} ({p.start} – {p.end})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Faculty · Class · Subject</label>
              <select value={ttMappingId} onChange={(e) => setTtMappingId(e.target.value)} required>
                {mappings.length === 0 ? <option value="">Assign Faculty in Step 3 first</option> : mappings.map((m) => <option key={m.id} value={m.id}>{m.faculty} · {m.cls} · {m.subject}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Room</label><input value={ttRoom} onChange={(e) => setTtRoom(e.target.value)} /></div>
            <button type="submit" className="btn btn-primary" disabled={mappings.length === 0}><Plus size={15} /> Add Slot</button>
          </form>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="erp-table-wrap"><table className="erp-table">
              <thead><tr><th>Day</th><th>Time</th><th>Class</th><th>Subject</th><th>Faculty</th><th>Room</th><th>Action</th></tr></thead>
              <tbody>
                {timetable.length === 0 ? (
                  <tr><td colSpan={7} style={{ color: 'var(--text-muted)' }}>No timetable slots created yet.</td></tr>
                ) : (
                  timetable.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.day}</td>
                      <td className="mono">{t.period}</td>
                      <td>{t.cls}</td>
                      <td>{t.subject}</td>
                      <td>{t.faculty}</td>
                      <td><span className="badge">{t.room}</span></td>
                      <td><button className="btn btn-danger" style={{ padding: '4px 9px' }} onClick={() => handleDeleteSlot(t.id)}><Trash2 size={14} /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {tab === 'semesters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form onSubmit={handleCreateSemester} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 0.7fr 1.6fr auto', gap: 12, alignItems: 'end' }}>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Academic Year</label><input value={newSemYear} onChange={(e) => setNewSemYear(e.target.value)} placeholder="2026-27" required /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Sem #</label><input type="number" min={1} max={12} value={newSemNum} onChange={(e) => setNewSemNum(Number(e.target.value))} required /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Semester Label</label><input value={newSemLabel} onChange={(e) => setNewSemLabel(e.target.value)} placeholder="Semester 2" required /></div>
            <button type="submit" className="btn btn-primary"><Plus size={15} /> Create Semester</button>
          </form>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="erp-table-wrap"><table className="erp-table">
              <thead><tr><th>Academic Term</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {semesters.length === 0 ? (
                  <tr><td colSpan={3} style={{ color: 'var(--text-muted)' }}>No semesters created yet.</td></tr>
                ) : (
                  semesters.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.label}</td>
                      <td><span className={`badge ${s.is_active ? 'badge-success' : ''}`}>{s.is_active ? 'Active' : 'Archived (Read-Only)'}</span></td>
                      <td><button className="btn" onClick={() => handleToggleSemester(s.id, s.is_active)}>{s.is_active ? 'Archive Semester' : 'Activate'}</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
          {!demo && promoSections.length >= 2 && (
            <div className="card">
              <h2 style={{ fontSize: 15.5, margin: '0 0 8px' }}>Cohort Semester Promotion (Preserve History)</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>Promote all active students from a previous class/semester into the next class/section while keeping old enrollment records intact.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr auto', gap: 12, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Source Class / Section</label>
                  <select value={promoSourceSec} onChange={(e) => setPromoSourceSec(e.target.value)}>
                    {promoSections.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Target Class / Section</label>
                  <select value={promoTargetSec} onChange={(e) => setPromoTargetSec(e.target.value)}>
                    {promoSections.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    if (!promoSourceSec || !promoTargetSec || promoSourceSec === promoTargetSec) {
                      setNotice('Select two different class sections to promote.');
                      return;
                    }
                    const { data: activeEnrs, error: qErr } = await supabase
                      .from('enrollments')
                      .select('student_id')
                      .eq('class_section_id', promoSourceSec)
                      .eq('is_active', true);
                    if (qErr) { setNotice(`Error: ${qErr.message}`); return; }
                    if (!activeEnrs || activeEnrs.length === 0) { setNotice('No active students found in the source class.'); return; }
                    if (!window.confirm(`Promote ${activeEnrs.length} student(s) to the target class/section?`)) return;
                    await supabase.from('enrollments').update({ is_active: false }).eq('class_section_id', promoSourceSec).eq('is_active', true);
                    const { error: insErr } = await supabase.from('enrollments').upsert(
                      activeEnrs.map((e: any) => ({ student_id: e.student_id, class_section_id: promoTargetSec, is_active: true })),
                      { onConflict: 'student_id,class_section_id' }
                    );
                    setNotice(insErr ? `Error: ${insErr.message}` : `Promoted ${activeEnrs.length} student(s) cleanly!`);
                  }}
                >
                  Promote Cohort
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

