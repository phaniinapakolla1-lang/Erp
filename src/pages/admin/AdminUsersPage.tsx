import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Edit3, ExternalLink, Plus, Search, Trash2, UserCheck, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, supabase, supabaseSignUpOnly } from '../../lib/supabase';
import { AccountStatus, UserRole } from '../../types/erp';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
  status: AccountStatus;
  department_id: string | null;
  class_section_id: string | null;
  enrolledClass?: string;
  specialization_id: string | null;
  custom_role_id: string | null;
  gender: string;
  dob: string;
  address: string;
  avatar_icon: string;
}

export const AdminUsersPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pending, setPending] = useState<Array<{ id: string; name: string; email: string; requested: string }>>(
    demo
      ? [
          { id: 'u1', name: 'Riya Patel', email: 'riya.patel@college.edu', requested: 'student' },
          { id: 'u2', name: 'Dr. Vikram Sen', email: 'vikram.sen@college.edu', requested: 'faculty' },
        ]
      : []
  );
  const [allUsers, setAllUsers] = useState<AdminUserRow[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [specializations, setSpecializations] = useState<Array<{ id: string; department_id: string; code: string; name: string }>>([]);
  const [newSpecId, setNewSpecId] = useState('');
  const [newAdmYear, setNewAdmYear] = useState(String(new Date().getFullYear()));
  const [editSpecId, setEditSpecId] = useState('');
  const [editAdmYear, setEditAdmYear] = useState(String(new Date().getFullYear()));
  const [admYearMap, setAdmYearMap] = useState<Record<string, number>>({});
  const [sections, setSections] = useState<Array<{ id: string; label: string }>>([]);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollSectionId, setEnrollSectionId] = useState('');
  const [csvNotice, setCsvNotice] = useState('');
  const [rollMap, setRollMap] = useState<Record<string, string>>({});
  const [deptDraft, setDeptDraft] = useState<Record<string, string>>({});
  const [rollDraft, setRollDraft] = useState<Record<string, string>>({});
  const [roleDraft, setRoleDraft] = useState<Record<string, UserRole>>({});
  const [customRoleDraft, setCustomRoleDraft] = useState<Record<string, string>>({});
  const [customRoles, setCustomRoles] = useState<Array<{ id: string; name: string; base_portal: UserRole; description: string }>>([]);
  const [showRolesPanel, setShowRolesPanel] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleBase, setNewRoleBase] = useState<UserRole>('faculty');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Directory Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');

  // Add User Modal state
  const [showAddModal, setShowAddModal] = useState(searchParams.get('action') === 'add');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<Array<{ row: number; full_name: string; email: string; password: string; roll_no: string; mobile: string; error: string }>>([]);
  const [addBusy, setAddBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('student');
  const [newStatus, setNewStatus] = useState<AccountStatus>('approved');
  const [newDeptId, setNewDeptId] = useState('');
  const [newRollNo, setNewRollNo] = useState('');
  const [newSectionId, setNewSectionId] = useState('');
  const [newGender, setNewGender] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newEmpId, setNewEmpId] = useState('');
  const [newDesig, setNewDesig] = useState('Assistant Professor');

  // Edit User Modal state
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('student');
  const [editStatus, setEditStatus] = useState<AccountStatus>('approved');
  const [editDeptId, setEditDeptId] = useState('');
  const [editRollNo, setEditRollNo] = useState('');
  const [editSectionId, setEditSectionId] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editEmpId, setEditEmpId] = useState('');
  const [editDesig, setEditDesig] = useState('Assistant Professor');
  const [facMap, setFacMap] = useState<Record<string, { employee_id: string; designation: string }>>({});

  const loadUsers = async () => {
    if (demo) return;
    const [{ data: pend }, { data: users }, { data: depts }, { data: secs }, { data: enrs }, { data: rolls }, { data: specRows }, { data: facRows }, { data: crRows }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email, mobile, role, status, department_id, specialization_id, custom_role_id, gender, dob, address, avatar_icon').neq('status', 'pending').order('full_name'),
      supabase.from('departments').select('id, code, name').order('code'),
      supabase.from('class_sections').select('id, name, section_code, semesters(label)').order('name'),
      supabase.from('enrollments').select('student_id, class_section_id, class_sections(name, section_code, semesters(label))').eq('is_active', true),
      supabase.from('student_profiles').select('user_id, roll_no, admission_year'),
      supabase.from('specializations').select('id, department_id, code, name').order('name'),
      supabase.from('faculty_profiles').select('user_id, employee_id, designation'),
      supabase.from('custom_roles').select('id, name, base_portal, description').order('name'),
    ]);

    const rm = Object.fromEntries((rolls || []).map((r: any) => [r.user_id, r.roll_no]));
    setAdmYearMap(Object.fromEntries((rolls || []).map((r: any) => [r.user_id, Number(r.admission_year || new Date().getFullYear())])));
    if (specRows) setSpecializations(specRows as any[]);
    if (crRows) setCustomRoles(crRows as any[]);
    setFacMap(Object.fromEntries((facRows || []).map((f: any) => [f.user_id, { employee_id: f.employee_id, designation: f.designation }])));
    setRollMap(rm);
    setRollDraft(rm);
    if (pend) setPending(pend.map((u: any) => ({ id: u.id, name: u.full_name, email: u.email, requested: u.role })));

    const enrMap: Record<string, { label: string; sectionId: string }> = {};
    (enrs || []).forEach((e: any) => {
      if (e.class_sections) {
        enrMap[e.student_id] = {
          sectionId: e.class_section_id,
          label: `${e.class_sections.name} · Sec ${e.class_sections.section_code}${e.class_sections.semesters?.label ? ` (${e.class_sections.semesters.label})` : ''}`,
        };
      }
    });

    if (users) {
      const mapped: AdminUserRow[] = users.map((u: any) => ({
        id: u.id,
        name: u.full_name,
        email: u.email,
        mobile: u.mobile || '',
        role: u.role,
        status: u.status,
        department_id: u.department_id,
        specialization_id: u.specialization_id || null,
        custom_role_id: u.custom_role_id || null,
        class_section_id: enrMap[u.id]?.sectionId || null,
        enrolledClass: enrMap[u.id]?.label,
        gender: u.gender || '',
        dob: u.dob || '',
        address: u.address || '',
        avatar_icon: u.avatar_icon || '🎓',
      }));
      setAllUsers(mapped);
      setDeptDraft(Object.fromEntries(mapped.map((u) => [u.id, u.department_id || ''])));
      setRoleDraft(Object.fromEntries(mapped.map((u) => [u.id, u.role])));
      setCustomRoleDraft(Object.fromEntries(mapped.map((u) => [u.id, u.custom_role_id || ''])));
      const firstStu = mapped.find((u) => u.role === 'student' && u.status === 'approved');
      if (firstStu && !enrollStudentId) setEnrollStudentId(firstStu.id);
    }
    if (depts) setDepartments(depts);
    if (secs) {
      const mappedSecs = secs.map((s: any) => ({ id: s.id, label: `${s.name} · Sec ${s.section_code}${s.semesters?.label ? ` (${s.semesters.label})` : ''}` }));
      setSections(mappedSecs);
      if (mappedSecs.length > 0 && !enrollSectionId) setEnrollSectionId(mappedSecs[0].id);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [demo]);

  useEffect(() => {
    if (searchParams.get('action') === 'add') setShowAddModal(true);
  }, [searchParams]);

  const handleDecision = async (id: string, status: 'approved' | 'rejected', role: string) => {
    setPending((p) => p.filter((x) => x.id !== id));
    if (!demo) {
      const { error } = await supabase.from('profiles').update({ status, role }).eq('id', id);
      if (error) {
        setCsvNotice(`Error: ${error.message}`);
        loadUsers();
      } else {
        setCsvNotice(`User ${status} as ${role}.`);
        loadUsers();
      }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (demo) { setCsvNotice('User creation is available in live mode.'); return; }
    if (!newName.trim() || !newEmail.trim() || newPassword.length < 6) {
      setCsvNotice('Full Name, Email, and a Password (min 6 characters) are required.');
      return;
    }
    setAddBusy(true);
    try {
      const { data: signUpData, error: signUpErr } = await supabaseSignUpOnly.auth.signUp({
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        options: { data: { full_name: newName.trim() } },
      });
      if (signUpErr) throw signUpErr;
      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error('Could not create user account. Check if the email already exists.');

      const { error: rpcErr } = await supabase.rpc('admin_finalize_created_user', {
        p_user_id: newUserId,
        p_full_name: newName.trim(),
        p_mobile: newMobile.trim() || null,
        p_role: newRole,
        p_status: newStatus,
        p_department_id: newDeptId || null,
        p_roll_no: newRole === 'student' ? (newRollNo.trim() || null) : null,
        p_class_section_id: newRole === 'student' ? (newSectionId || null) : null,
        p_gender: newGender || null,
        p_dob: newDob || null,
        p_address: newAddress.trim() || null,
      });
      if (rpcErr) throw rpcErr;
      if (newRole === 'student') {
        await supabase.rpc('admin_set_student_academic_meta', { p_user_id: newUserId, p_specialization_id: newSpecId || null, p_admission_year: Number(newAdmYear) || new Date().getFullYear() });
      }
      if ((newRole === 'faculty' || newRole === 'hod') && newEmpId.trim()) {
        await supabase.rpc('admin_upsert_faculty_profile', { p_user_id: newUserId, p_employee_id: newEmpId.trim(), p_designation: newDesig.trim() || 'Assistant Professor' });
      }

      setCsvNotice(`Created user ${newName.trim()} (${newRole.toUpperCase()}) successfully!`);
      setShowAddModal(false);
      setSearchParams({});
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewMobile(''); setNewRollNo(''); setNewGender(''); setNewDob(''); setNewAddress('');
      await loadUsers();
    } catch (err: any) {
      setCsvNotice(`Error creating user: ${err.message}`);
    } finally {
      setAddBusy(false);
    }
  };

  const openEditModal = (u: AdminUserRow) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditMobile(u.mobile);
    setEditRole(u.role);
    setEditStatus(u.status);
    setEditDeptId(u.department_id || '');
    setEditSpecId(u.specialization_id || '');
    setEditAdmYear(String(admYearMap[u.id] || new Date().getFullYear()));
    setEditRollNo(rollMap[u.id] || '');
    setEditSectionId(u.class_section_id || '');
    setEditGender(u.gender);
    setEditDob(u.dob);
    setEditAddress(u.address);
    setEditEmpId(facMap[u.id]?.employee_id || '');
    setEditDesig(facMap[u.id]?.designation || 'Assistant Professor');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || demo) return;
    setEditBusy(true);
    try {
      const { error } = await supabase.rpc('admin_update_user', {
        p_user_id: editingUser.id,
        p_full_name: editName.trim(),
        p_mobile: editMobile.trim() || null,
        p_role: editRole,
        p_status: editStatus,
        p_department_id: editDeptId || null,
        p_roll_no: editRole === 'student' ? (editRollNo.trim() || null) : null,
        p_class_section_id: editRole === 'student' ? (editSectionId || null) : null,
        p_gender: editGender || null,
        p_dob: editDob || null,
        p_address: editAddress.trim() || null,
      });
      if (error) throw error;
      if (editRole === 'student') {
        await supabase.rpc('admin_set_student_academic_meta', { p_user_id: editingUser.id, p_specialization_id: editSpecId || null, p_admission_year: Number(editAdmYear) || null });
      }
      if ((editRole === 'faculty' || editRole === 'hod') && editEmpId.trim()) {
        await supabase.rpc('admin_upsert_faculty_profile', { p_user_id: editingUser.id, p_employee_id: editEmpId.trim(), p_designation: editDesig.trim() || 'Assistant Professor' });
      }
      setCsvNotice(`Updated ${editName.trim()} successfully.`);
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      setCsvNotice(`Error updating user: ${err.message}`);
    } finally {
      setEditBusy(false);
    }
  };

  const handleDeleteUser = async (u: AdminUserRow) => {
    if (demo) return;
    if (!window.confirm(`Permanently DELETE ${u.name} (${u.email})? This removes their login and profile.`)) return;
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: u.id });
    if (error) {
      setCsvNotice(`Delete failed: ${error.message}`);
    } else {
      setCsvNotice(`Deleted user ${u.name}.`);
      await loadUsers();
    }
  };

  const filteredUsers = allUsers.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (rollMap[u.id] || '').toLowerCase().includes(q);
  });

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users & Approvals</h1>
          <p className="page-sub">Add new users, edit full profiles &amp; roles, delete accounts, approve registrations, and assign departments/roll numbers.</p>
        </div>
        {!demo && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setShowRolesPanel((v) => !v)}>Manage Roles ({customRoles.length + 4})</button>
            <button className="btn" onClick={() => setShowBulkModal((v) => !v)}>Bulk Student CSV Import</button>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <UserPlus size={15} /> Add New User
            </button>
          </div>
        )}
      </div>

      {csvNotice && <div className="badge badge-primary" style={{ marginBottom: 14, padding: '6px 12px' }}>{csvNotice}</div>}

                  {showRolesPanel && !demo && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Manage User Roles (Built-in + Custom Roles)</h2>
            <button className="btn" style={{ padding: '4px 8px' }} onClick={() => setShowRolesPanel(false)}><X size={15} /></button>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 0 }}>
            Core portals: <strong>Admin</strong>, <strong>HOD</strong>, <strong>Faculty</strong>, and <strong>Student</strong>. Add custom college roles below (e.g. Exam Controller, Lab Coordinator, Class Advisor) mapped to a base portal.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newRoleName.trim()) return;
              const { error } = await supabase.from('custom_roles').insert({
                name: newRoleName.trim(),
                base_portal: newRoleBase,
                description: newRoleDesc.trim() || null,
                created_by: profile!.id,
              });
              setCsvNotice(error ? `Error adding role: ${error.message}` : `Added role "${newRoleName.trim()}".`);
              if (!error) {
                setNewRoleName('');
                setNewRoleDesc('');
                await loadUsers();
              }
            }}
            style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 1.5fr auto', gap: 10, alignItems: 'end', marginBottom: 14 }}
          >
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Role Name *</label><input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Exam Controller" required /></div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Base Portal *</label>
              <select value={newRoleBase} onChange={(e) => setNewRoleBase(e.target.value as UserRole)}>
                <option value="faculty">Faculty Portal</option>
                <option value="hod">HOD Portal</option>
                <option value="admin">Admin Portal</option>
                <option value="student">Student Portal</option>
                <option value="exam_controller">Exam Controller Portal</option>
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Description</label><input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Short description of responsibilities..." /></div>
            <button type="submit" className="btn btn-primary"><Plus size={15} /> Add Role</button>
          </form>
          {customRoles.length > 0 && (
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead><tr><th>Custom Role</th><th>Base Portal</th><th>Description</th><th>Action</th></tr></thead>
                <tbody>
                  {customRoles.map((cr) => (
                    <tr key={cr.id}>
                      <td style={{ fontWeight: 600 }}>{cr.name}</td>
                      <td><span className="badge badge-primary">{cr.base_portal.toUpperCase()}</span></td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{cr.description || '—'}</td>
                      <td>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 8px' }}
                          onClick={async () => {
                            if (!window.confirm(`Delete custom role "${cr.name}"?`)) return;
                            const { error } = await supabase.from('custom_roles').delete().eq('id', cr.id);
                            setCsvNotice(error ? `Error: ${error.message}` : `Deleted role "${cr.name}".`);
                            if (!error) loadUsers();
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showBulkModal && !demo && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Bulk Student CSV Import (Preview &amp; Validate)</h2>
            <button className="btn" style={{ padding: '4px 8px' }} onClick={() => setShowBulkModal(false)}><X size={15} /></button>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 0 }}>
            Paste CSV lines with columns: <span className="mono">full_name,email,password,roll_no,mobile</span> (header optional). Invalid rows are flagged and never silently imported.
          </p>
          <textarea
            rows={4}
            value={bulkCsvText}
            onChange={(e) => {
              const val = e.target.value;
              setBulkCsvText(val);
              const existingEmails = new Set(allUsers.map((u) => u.email.toLowerCase()));
              const seen = new Set<string>();
              const lines = val.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
              const parsed = lines
                .filter((l, idx) => !(idx === 0 && l.toLowerCase().startsWith('full_name')))
                .map((line, idx) => {
                  const [fn = '', em = '', pw = '', rn = '', mob = ''] = line.split(',').map((c) => c.trim());
                  const emailLow = em.toLowerCase();
                  let err = '';
                  if (!fn) err = 'Missing name';
                  else if (!emailLow.includes('@')) err = 'Invalid email';
                  else if (existingEmails.has(emailLow) || seen.has(emailLow)) err = 'Duplicate email';
                  else if (pw.length < 6) err = 'Password < 6 chars';
                  seen.add(emailLow);
                  return { row: idx + 1, full_name: fn, email: emailLow, password: pw, roll_no: rn, mobile: mob, error: err };
                });
              setBulkPreview(parsed);
            }}
            placeholder="Student One,user1****@***.com,Pass****,24MCA***,98*** ***10"
          />
          {bulkPreview.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="erp-table-wrap"><table className="erp-table" style={{ marginBottom: 12 }}>
                <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Roll No</th><th>Validation</th></tr></thead>
                <tbody>
                  {bulkPreview.map((r) => (
                    <tr key={r.row}>
                      <td className="mono">{r.row}</td>
                      <td>{r.full_name || '—'}</td>
                      <td className="mono">{r.email || '—'}</td>
                      <td className="mono">{r.roll_no || '—'}</td>
                      <td>{r.error ? <span className="badge badge-danger">{r.error}</span> : <span className="badge badge-success">Valid</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={bulkBusy || bulkPreview.filter((r) => !r.error).length === 0}
                onClick={async () => {
                  setBulkBusy(true);
                  let ok = 0;
                  let fail = 0;
                  for (const r of bulkPreview.filter((x) => !x.error)) {
                    try {
                      const { data: su, error: suErr } = await supabaseSignUpOnly.auth.signUp({
                        email: r.email,
                        password: r.password,
                        options: { data: { full_name: r.full_name } },
                      });
                      if (suErr || !su.user?.id) { fail++; continue; }
                      const { error: rpcErr } = await supabase.rpc('admin_finalize_created_user', {
                        p_user_id: su.user.id,
                        p_full_name: r.full_name,
                        p_mobile: r.mobile || null,
                        p_role: 'student',
                        p_status: 'approved',
                        p_roll_no: r.roll_no || null,
                      });
                      if (rpcErr) fail++;
                      else ok++;
                    } catch { fail++; }
                  }
                  setBulkBusy(false);
                  setCsvNotice(`Bulk import complete: ${ok} student(s) imported, ${fail} failed.`);
                  setShowBulkModal(false);
                  setBulkCsvText('');
                  setBulkPreview([]);
                  await loadUsers();
                }}
              >
                {bulkBusy ? 'Importing...' : `Import ${bulkPreview.filter((r) => !r.error).length} Valid Students`}
              </button>
            </div>
          )}
        </div>
      )}

      {showAddModal && !demo && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Create New User Account</h2>
            <button className="btn" style={{ padding: '4px 8px' }} onClick={() => { setShowAddModal(false); setSearchParams({}); }}><X size={15} /></button>
          </div>
          <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Full Name *</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Full Name" required /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Email *</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user1****@***.com" required /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Password (min 6) *</label><input type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters (e.g. Pass****)" required /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Mobile Number</label><input value={newMobile} onChange={(e) => setNewMobile(e.target.value)} placeholder="+91 98*** ***10" /></div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Role *</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
                <option value="student">Student</option><option value="faculty">Faculty</option><option value="hod">HOD</option><option value="exam_controller">Exam Controller</option><option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Status *</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as AccountStatus)}>
                <option value="approved">Approved</option><option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Department</label>
              <select value={newDeptId} onChange={(e) => setNewDeptId(e.target.value)}>
                <option value="">Unassigned</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
            {(newRole === 'faculty' || newRole === 'hod') && (
              <>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Employee ID</label><input value={newEmpId} onChange={(e) => setNewEmpId(e.target.value)} placeholder="e.g. FAC-***" /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Designation</label><input value={newDesig} onChange={(e) => setNewDesig(e.target.value)} placeholder="Assistant Professor" /></div>
              </>
            )}
            {newRole === 'student' && (
              <>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Roll Number</label><input value={newRollNo} onChange={(e) => setNewRollNo(e.target.value)} placeholder="e.g. 24MCA***" /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Specialization</label><select value={newSpecId} onChange={(e) => setNewSpecId(e.target.value)}><option value="">None / General</option>{specializations.filter((sp) => !newDeptId || sp.department_id === newDeptId).map((sp) => <option key={sp.id} value={sp.id}>{sp.code} — {sp.name}</option>)}</select></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Admission Year</label><input type="number" min={2000} max={2100} value={newAdmYear} onChange={(e) => setNewAdmYear(e.target.value)} /></div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Class &amp; Section</label>
                  <select value={newSectionId} onChange={(e) => setNewSectionId(e.target.value)}>
                    <option value="">Not enrolled yet</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Gender</label>
              <select value={newGender} onChange={(e) => setNewGender(e.target.value)}>
                <option value="">Select</option><option value="Female">Female</option><option value="Male">Male</option><option value="Non-binary">Non-binary</option><option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Date of Birth</label><input type="date" value={newDob} onChange={(e) => setNewDob(e.target.value)} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Address</label><input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="City / Hostel" /></div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={addBusy}>{addBusy ? 'Creating...' : 'Create User'}</button>
              <button type="button" className="btn" onClick={() => { setShowAddModal(false); setSearchParams({}); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {editingUser && !demo && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Edit User: {editingUser.name} ({editingUser.email})</h2>
            <button className="btn" style={{ padding: '4px 8px' }} onClick={() => setEditingUser(null)}><X size={15} /></button>
          </div>
          <form onSubmit={handleUpdateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Full Name *</label><input value={editName} onChange={(e) => setEditName(e.target.value)} required /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Mobile Number</label><input value={editMobile} onChange={(e) => setEditMobile(e.target.value)} /></div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Role</label>
              <select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)}>
                <option value="student">Student</option><option value="faculty">Faculty</option><option value="hod">HOD</option><option value="exam_controller">Exam Controller</option><option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as AccountStatus)}>
                <option value="approved">Approved</option><option value="pending">Pending</option><option value="disabled">Disabled</option><option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Department</label>
              <select value={editDeptId} onChange={(e) => setEditDeptId(e.target.value)}>
                <option value="">Unassigned</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
            {(editRole === 'faculty' || editRole === 'hod') && (
              <>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Employee ID</label><input value={editEmpId} onChange={(e) => setEditEmpId(e.target.value)} placeholder="e.g. FAC-***" /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Designation</label><input value={editDesig} onChange={(e) => setEditDesig(e.target.value)} placeholder="Assistant Professor" /></div>
              </>
            )}
            {editRole === 'student' && (
              <>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Roll Number</label><input value={editRollNo} onChange={(e) => setEditRollNo(e.target.value)} placeholder="e.g. 24MCA***" /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Specialization</label><select value={editSpecId} onChange={(e) => setEditSpecId(e.target.value)}><option value="">None / General</option>{specializations.filter((sp) => !editDeptId || sp.department_id === editDeptId).map((sp) => <option key={sp.id} value={sp.id}>{sp.code} — {sp.name}</option>)}</select></div>
                <div><label style={{ fontSize: 12, fontWeight: 600 }}>Admission Year</label><input type="number" min={2000} max={2100} value={editAdmYear} onChange={(e) => setEditAdmYear(e.target.value)} /></div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Class &amp; Section</label>
                  <select value={editSectionId} onChange={(e) => setEditSectionId(e.target.value)}>
                    <option value="">Unchanged / None</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Gender</label>
              <select value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                <option value="">Select</option><option value="Female">Female</option><option value="Male">Male</option><option value="Non-binary">Non-binary</option><option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Date of Birth</label><input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Address</label><input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} /></div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={editBusy}>{editBusy ? 'Saving...' : 'Save Changes'}</button>
              <button type="button" className="btn" onClick={() => setEditingUser(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Pending Registrations ({pending.length})</div>
        <div className="erp-table-wrap"><table className="erp-table">
          <thead><tr><th>Applicant</th><th>College Email</th><th>Assign Role</th><th>Decision</th></tr></thead>
          <tbody>
            {pending.length === 0 ? (
              <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No pending registrations right now.</td></tr>
            ) : (
              pending.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td className="mono">{u.email}</td>
                  <td>
                    <select style={{ width: 'auto' }} value={u.requested} onChange={(e) => setPending((p) => p.map((x) => (x.id === u.id ? { ...x, requested: e.target.value } : x)))}>
                      <option value="student">Student</option><option value="faculty">Faculty</option><option value="hod">HOD</option><option value="exam_controller">Exam Controller</option><option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={() => handleDecision(u.id, 'approved', u.requested)}>Approve</button>
                    <button className="btn btn-danger" onClick={() => handleDecision(u.id, 'rejected', u.requested)}>Reject</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table></div>
      </div>

      {!demo && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15.5, margin: '0 0 10px' }}>Enroll Approved Student in Class &amp; Section</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!enrollStudentId || !enrollSectionId) return;
                const { error } = await supabase.from('enrollments').upsert(
                  { student_id: enrollStudentId, class_section_id: enrollSectionId, is_active: true },
                  { onConflict: 'student_id,class_section_id' }
                );
                setCsvNotice(error ? `Error: ${error.message}` : 'Student enrolled in class section!');
                if (!error) loadUsers();
              }}
              style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr auto', gap: 12, alignItems: 'end' }}
            >
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600 }}>Approved Student</label>
                <select value={enrollStudentId} onChange={(e) => setEnrollStudentId(e.target.value)} required>
                  {allUsers.filter((u) => u.role === 'student' && u.status === 'approved').map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600 }}>Class &amp; Section</label>
                <select value={enrollSectionId} onChange={(e) => setEnrollSectionId(e.target.value)} required>
                  {sections.length === 0 ? <option value="">Create a class in Academic Setup first</option> : sections.map((sec) => <option key={sec.id} value={sec.id}>{sec.label}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={!enrollStudentId || !enrollSectionId}>Enroll Student</button>
            </form>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <strong>User Directory ({filteredUsers.length} of {allUsers.length})</strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input style={{ width: 220 }} placeholder="Search name, email, roll..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <select style={{ width: 'auto' }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
                  <option value="all">All Roles</option><option value="student">Student</option><option value="faculty">Faculty</option><option value="hod">HOD</option><option value="exam_controller">Exam Controller</option><option value="admin">Admin</option>
                </select>
                <select style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                  <option value="all">All Statuses</option><option value="approved">Approved</option><option value="disabled">Disabled</option><option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
            <div className="erp-table-wrap"><table className="erp-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role / Status</th><th>Class / Section / Sem</th><th>Department</th><th>Roll No</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{u.avatar_icon}</span>
                        {u.role === 'student' ? (
                          <Link to={`/students/${u.id}`} style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>{u.name}</Link>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{u.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{u.email}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <select
                          style={{ width: 'auto', padding: '4px 8px', fontSize: 12.5 }}
                          disabled={u.id === profile?.id}
                          value={roleDraft[u.id] ?? u.role}
                          onChange={(e) => setRoleDraft((prev) => ({ ...prev, [u.id]: e.target.value as UserRole }))}
                        >
                          <option value="student">Student</option>
                          <option value="faculty">Faculty</option>
                          <option value="hod">HOD</option>
                          <option value="exam_controller">Exam Controller</option>
                          <option value="admin">Admin</option>
                        </select>
                        {customRoles.length > 0 && (
                          <select
                            style={{ width: 'auto', padding: '3px 6px', fontSize: 11.5 }}
                            disabled={u.id === profile?.id}
                            value={customRoleDraft[u.id] ?? (u.custom_role_id || '')}
                            onChange={(e) => {
                              const cid = e.target.value;
                              setCustomRoleDraft((prev) => ({ ...prev, [u.id]: cid }));
                              const found = customRoles.find((c) => c.id === cid);
                              if (found) setRoleDraft((prev) => ({ ...prev, [u.id]: found.base_portal }));
                            }}
                          >
                            <option value="">No custom role</option>
                            {customRoles.map((cr) => <option key={cr.id} value={cr.id}>{cr.name}</option>)}
                          </select>
                        )}
                        {u.status !== 'approved' && <span className="badge badge-danger">{u.status.toUpperCase()}</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: 12.5 }}>{u.role === 'student' ? (u.enrolledClass || <span style={{ color: 'var(--text-muted)' }}>Not enrolled</span>) : '—'}</td>
                    <td>
                      <select
                        style={{ width: 'auto' }}
                        value={deptDraft[u.id] ?? (u.department_id || '')}
                        onChange={(e) => setDeptDraft((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      >
                        <option value="">Unassigned</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                      </select>
                    </td>
                    <td>
                      {(roleDraft[u.id] ?? u.role) === 'student' && (
                        <input
                          value={rollDraft[u.id] ?? ''}
                          onChange={(e) => setRollDraft((prev) => ({ ...prev, [u.id]: e.target.value }))}
                          placeholder="e.g. 24MCA***"
                          style={{ width: 90 }}
                        />
                      )}
                    </td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {u.role === 'student' && (
                        <Link to={`/students/${u.id}`} className="btn" style={{ textDecoration: 'none', padding: '4px 9px' }} title="Open Student Dashboard">
                          <ExternalLink size={13} /> Dashboard
                        </Link>
                      )}
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 10px' }}
                        onClick={async () => {
                          const nextRole = roleDraft[u.id] ?? u.role;
                          const nextCustomRoleId = (customRoleDraft[u.id] ?? u.custom_role_id ?? '') || null;
                          const deptId = (deptDraft[u.id] ?? u.department_id ?? '') || null;
                          const rollVal = (rollDraft[u.id] ?? '').trim() || null;
                          if (u.id !== profile?.id && (nextRole !== u.role || nextCustomRoleId !== (u.custom_role_id || null))) {
                            const { error: rErr } = await supabase.rpc('admin_change_user_role', {
                              p_user_id: u.id,
                              p_role: nextRole,
                              p_custom_role_id: nextCustomRoleId,
                            });
                            if (rErr) { setCsvNotice(`Error updating role: ${rErr.message}`); return; }
                          }
                          const { error } = await supabase.rpc('admin_update_user_academic', {
                            p_user_id: u.id,
                            p_department_id: deptId,
                            p_roll_no: nextRole === 'student' ? rollVal : null,
                          });
                          setCsvNotice(error ? `Error saving: ${error.message}` : `Saved role (${nextRole.toUpperCase()}) & academic details for ${u.name}.`);
                          if (!error) loadUsers();
                        }}
                      >
                        Save
                      </button>
                      <button className="btn" style={{ padding: '4px 9px' }} onClick={() => openEditModal(u)} title="Edit full user profile">
                        <Edit3 size={13} /> Edit
                      </button>
                      {u.id !== profile?.id && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 9px' }}
                          onClick={() => handleDeleteUser(u)}
                          title="Delete user permanently"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </div>
  );
};

