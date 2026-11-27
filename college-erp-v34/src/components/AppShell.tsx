import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Award, Bell, BookOpen, Calendar, CheckSquare, ChevronDown, ChevronRight, ClipboardList, CreditCard, ExternalLink, FileCheck, FolderOpen, Mail,
  Accessibility, BookMarked, Flag, GraduationCap, LayoutDashboard, ListChecks, LogOut, Megaphone, Menu, Moon, Settings, ShieldCheck, Sparkles, Sun, Users, Volume2, VolumeX, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { UserRole } from '../types/erp';
import { ToastMessage, ToastPopup } from './ToastPopup';
import { AccessibilityPrefs, loadAccessibilityPrefs, saveAccessibilityPrefs } from '../lib/localPrefs';

interface NavGroup {
  group: string;
  items: Array<{ to: string; label: string; icon: React.ReactNode }>;
}

const ROLE_GROUPS: Record<UserRole, NavGroup[]> = {
  admin: [
    {
      group: 'Overview',
      items: [{ to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={17} /> }],
    },
    {
      group: 'People & Academic',
      items: [
        { to: '/admin/users', label: 'Users & Approvals', icon: <Users size={17} /> },
        { to: '/admin/academic', label: 'Academic Setup', icon: <BookOpen size={17} /> },
        { to: '/admin/exams', label: 'Exams & Hall Tickets', icon: <Award size={17} /> },
        { to: '/syllabus', label: 'Syllabus Coverage', icon: <ListChecks size={17} /> },
      ],
    },
    {
      group: 'Communication',
      items: [
        { to: '/resources', label: 'Learning Resources', icon: <FolderOpen size={17} /> },
        { to: '/mail', label: 'College Mail', icon: <Mail size={17} /> },
        { to: '/announcements', label: 'Announcements', icon: <Megaphone size={17} /> },
        { to: '/calendar', label: 'Academic Calendar', icon: <Calendar size={17} /> },
      ],
    },
    {
      group: 'Governance & System',
      items: [
        { to: '/admin/fees', label: 'Fees Link', icon: <CreditCard size={17} /> },
        { to: '/admin/reports', label: 'Problem Reports', icon: <Flag size={17} /> },
        { to: '/admin/oversight', label: 'Oversight & Integrity', icon: <ShieldCheck size={17} /> },
        { to: '/settings', label: 'Settings', icon: <Settings size={17} /> },
      ],
    },
  ],
  faculty: [
    {
      group: 'Overview',
      items: [{ to: '/faculty', label: 'Dashboard', icon: <LayoutDashboard size={17} /> }],
    },
    {
      group: 'Teaching & Attendance',
      items: [
        { to: '/faculty/classes', label: 'My Classes', icon: <BookOpen size={17} /> },
        { to: '/faculty/attendance', label: 'Take Attendance', icon: <CheckSquare size={17} /> },
        { to: '/syllabus', label: 'Syllabus Tracker', icon: <ListChecks size={17} /> },
      ],
    },
    {
      group: 'Assignments & Grading',
      items: [
        { to: '/faculty/assignments', label: 'Assignments & Tracker', icon: <ClipboardList size={17} /> },
        { to: '/faculty/evaluate', label: 'Evaluate Submissions', icon: <FileCheck size={17} /> },
      ],
    },
    {
      group: 'Communication & Settings',
      items: [
        { to: '/resources', label: 'Resources', icon: <FolderOpen size={17} /> },
        { to: '/mail', label: 'College Mail', icon: <Mail size={17} /> },
        { to: '/announcements', label: 'Announcements', icon: <Megaphone size={17} /> },
        { to: '/calendar', label: 'Calendar', icon: <Calendar size={17} /> },
        { to: '/settings', label: 'Settings', icon: <Settings size={17} /> },
      ],
    },
  ],
  student: [
    {
      group: 'Overview',
      items: [{ to: '/student', label: 'Dashboard', icon: <LayoutDashboard size={17} /> }],
    },
    {
      group: 'Academics',
      items: [
        { to: '/student/subjects', label: 'My Subjects', icon: <BookMarked size={17} /> },
        { to: '/student/attendance', label: 'My Attendance', icon: <CheckSquare size={17} /> },
        { to: '/student/assignments', label: 'Assignments', icon: <ClipboardList size={17} /> },
        { to: '/student/marks', label: 'Marks & Feedback', icon: <FileCheck size={17} /> },
        { to: '/student/exams', label: 'Hall Tickets & Results', icon: <Award size={17} /> },
        { to: '/syllabus', label: 'Syllabus', icon: <ListChecks size={17} /> },
      ],
    },
    {
      group: 'Resources & Schedule',
      items: [
        { to: '/resources', label: 'Resources', icon: <FolderOpen size={17} /> },
        { to: '/mail', label: 'College Mail', icon: <Mail size={17} /> },
        { to: '/announcements', label: 'Announcements', icon: <Megaphone size={17} /> },
        { to: '/calendar', label: 'Calendar', icon: <Calendar size={17} /> },
        { to: '/settings', label: 'Settings', icon: <Settings size={17} /> },
      ],
    },
  ],
  hod: [
    {
      group: 'Overview',
      items: [{ to: '/hod', label: 'Dept Dashboard', icon: <LayoutDashboard size={17} /> }],
    },
    {
      group: 'Department Oversight',
      items: [
        { to: '/hod/oversight', label: 'Dept Oversight', icon: <ShieldCheck size={17} /> },
        { to: '/syllabus', label: 'Syllabus Coverage', icon: <ListChecks size={17} /> },
      ],
    },
    {
      group: 'Communication & Settings',
      items: [
        { to: '/resources', label: 'Resources', icon: <FolderOpen size={17} /> },
        { to: '/mail', label: 'College Mail', icon: <Mail size={17} /> },
        { to: '/announcements', label: 'Announcements', icon: <Megaphone size={17} /> },
        { to: '/calendar', label: 'Dept Calendar', icon: <Calendar size={17} /> },
        { to: '/settings', label: 'Settings', icon: <Settings size={17} /> },
      ],
    },
  ],
  exam_controller: [
    {
      group: 'Examination Cell',
      items: [{ to: '/exam_controller', label: 'Exams, Hall Tickets & Results', icon: <Award size={17} /> }],
    },
    {
      group: 'Communication & Settings',
      items: [
        { to: '/mail', label: 'College Mail', icon: <Mail size={17} /> },
        { to: '/announcements', label: 'Notices & Results', icon: <Megaphone size={17} /> },
        { to: '/calendar', label: 'Academic Calendar', icon: <Calendar size={17} /> },
        { to: '/settings', label: 'Profile & Settings', icon: <Settings size={17} /> },
      ],
    },
  ],
};

function getInitials(name: string) {
  return name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
}

export const AppShell: React.FC = () => {
  const { profile, theme, toggleTheme, signOut } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [collegeName, setCollegeName] = useState('College ERP');
  const [collegeLogo, setCollegeLogo] = useState('');
  const [feePortalUrl, setFeePortalUrl] = useState('');
  const [termLabel, setTermLabel] = useState('');
  const [deptName, setDeptName] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [nowClock, setNowClock] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNowClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const currentHour = nowClock.getHours();
  const greeting =
    currentHour >= 5 && currentHour < 12
      ? { emoji: '☀️', text: 'Good Morning' }
      : currentHour >= 12 && currentHour < 17
      ? { emoji: '🌤️', text: 'Good Afternoon' }
      : currentHour >= 17 && currentHour < 21
      ? { emoji: '🌆', text: 'Good Evening' }
      : { emoji: '🌙', text: 'Good Night' };

  const clock12h = nowClock.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const [showReportModal, setShowReportModal] = useState(false);
  const [repCategory, setRepCategory] = useState<'bug' | 'ui' | 'access' | 'academic' | 'other'>('bug');
  const [repSubject, setRepSubject] = useState('');
  const [repDesc, setRepDesc] = useState('');
  const [repBusy, setRepBusy] = useState(false);
  const [shellToast, setShellToast] = useState<ToastMessage | null>(null);
  const [showA11y, setShowA11y] = useState(false);
  const [a11y, setA11y] = useState<AccessibilityPrefs>(() => loadAccessibilityPrefs());
  const [speaking, setSpeaking] = useState(false);
  const updateA11y = (patch: Partial<AccessibilityPrefs>) => {
    const next = { ...a11y, ...patch };
    setA11y(next);
    saveAccessibilityPrefs(next);
  };
  const toggleReadAloud = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setShellToast({ type: 'error', text: 'Screen reader speech is not supported in this browser.' });
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const mainEl = document.querySelector('.erp-content');
    const text = (mainEl?.textContent || document.body.innerText || '').trim().slice(0, 4000);
    if (!text) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utt);
  };

  useEffect(() => {
    if (!profile || !isSupabaseConfigured || profile.id.startsWith('demo-')) return;
    const refreshUnread = () => {
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)
        .then(({ count }) => {
          if (typeof count === 'number') setUnreadCount(count);
        });
    };
    refreshUnread();
    window.addEventListener('erp-notifications-updated', refreshUnread);
    const loadErpSettings = () => {
      supabase.from('erp_settings').select('college_name, college_logo_data, fee_portal_url').eq('id', 1).maybeSingle()
        .then(({ data }) => {
          if (data?.college_name) setCollegeName(data.college_name);
          setCollegeLogo(data?.college_logo_data || '');
          setFeePortalUrl(data?.fee_portal_url || '');
        });
    };
    loadErpSettings();
    window.addEventListener('erp-fee-link-updated', loadErpSettings);
    window.addEventListener('erp-branding-updated', loadErpSettings);
    supabase.from('semesters').select('label').eq('is_active', true).order('number').limit(1).maybeSingle()
      .then(({ data }) => { if (data?.label) setTermLabel(data.label); });
    if (profile.department_id) {
      supabase.from('departments').select('name').eq('id', profile.department_id).maybeSingle()
        .then(({ data }) => { if (data?.name) setDeptName(data.name); });
    }
    return () => {
      window.removeEventListener('erp-notifications-updated', refreshUnread);
      window.removeEventListener('erp-fee-link-updated', loadErpSettings);
      window.removeEventListener('erp-branding-updated', loadErpSettings);
    };
  }, [profile?.id]);

  const isDemoUser = !!profile?.id.startsWith('demo-');

  if (!profile) return null;
  const groups = ROLE_GROUPS[profile.role];

  const toggleGroup = (name: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));

  return (
    <div className="erp-shell">
      {mobileNavOpen && <div className="erp-mobile-backdrop" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`erp-sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="erp-brand">
          <div className="erp-logo-mark" style={{ overflow: 'hidden' }}>{collegeLogo ? <img src={collegeLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff', padding: 2, borderRadius: 6 }} /> : <GraduationCap size={19} />}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{isDemoUser ? 'St. Xavier ERP' : collegeName}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Academic Portal · v3.4</div>
          </div>
          <button type="button" className="btn erp-mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={16} /></button>
        </div>

        <div className="nav-section-label">{profile.role.replace('_', ' ').toUpperCase()} WORKSPACE</div>
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {groups.map((grp) => {
            const isCollapsed = Boolean(collapsedGroups[grp.group]);
            return (
              <div key={grp.group} style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => toggleGroup(grp.group)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', padding: '5px 8px', cursor: 'pointer',
                    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase',
                  }}
                >
                  <span>{grp.group}</span>
                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>
                {!isCollapsed && grp.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to.split('/').length === 2}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) => `erp-nav-link ${isActive ? 'active' : ''}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
          {profile.role === 'student' && feePortalUrl && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <a
                href={feePortalUrl}
                target="_blank"
                rel="noreferrer"
                className="erp-nav-link"
                style={{ color: 'var(--primary)', fontWeight: 600 }}
              >
                <CreditCard size={17} />
                <span style={{ flex: 1 }}>Fees</span>
                <ExternalLink size={13} />
              </a>
            </div>
          )}
        </nav>

        <div className="erp-user-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
            <div className="avatar" style={{ fontSize: profile.avatar_icon ? 18 : undefined }}>{profile.avatar_icon || getInitials(profile.full_name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile.full_name}
              </div>
              <span className="badge badge-primary" style={{ fontSize: 10.5, padding: '1px 7px' }}>
                {profile.role.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
          <button className="btn" onClick={signOut} style={{ width: '100%' }}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      <div className="erp-main">
        <header className="erp-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="btn erp-mobile-toggle" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span>{greeting.emoji}</span>
                <span>{greeting.text}, {profile.full_name}</span>
              </span>
              <span className="badge badge-primary mono" style={{ fontSize: 12, padding: '3px 9px' }}>
                🕒 {clock12h}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className={`btn ${a11y.readerMode || a11y.highContrast ? 'btn-primary' : ''}`} onClick={() => setShowA11y((v) => !v)} title="Reader & Viewer Accessibility">
              <Accessibility size={16} /> <span>Reader</span>
            </button>
            <button className="btn" onClick={() => setShowReportModal(true)} title="Report a problem to Admin">
              <Flag size={15} /> <span>Report Problem</span>
            </button>
            <button className="btn" onClick={toggleTheme} title={`Theme: ${theme} (click to cycle)`}>
              {theme === 'light' ? <Sun size={16} /> : theme === 'dark' ? <Moon size={16} /> : <Sparkles size={16} />}
            </button>
            <NavLink to="/notifications" className="btn" style={{ textDecoration: 'none' }}>
              <Bell size={16} />
              <span>Alerts</span>
              {unreadCount > 0 && <span className="badge badge-warn" style={{ padding: '1px 6px' }}>{unreadCount}</span>}
            </NavLink>
          </div>
        </header>
        <Outlet />
      </div>

      <ToastPopup toast={shellToast} onClose={() => setShellToast(null)} />

      {showA11y && (
        <div
          className="card"
          style={{ position: 'fixed', top: 70, right: 20, zIndex: 95, width: 310, boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><Accessibility size={16} /> Reader &amp; Viewer Accessibility</strong>
            <button type="button" className="btn" style={{ padding: '2px 6px' }} onClick={() => setShowA11y(false)}><X size={14} /></button>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Text Size ({a11y.fontScale}%)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[90, 100, 115, 130].map((sz) => (
                <button key={sz} type="button" className={`btn ${a11y.fontScale === sz ? 'btn-primary' : ''}`} style={{ padding: '4px 6px', fontSize: 12 }} onClick={() => updateA11y({ fontScale: sz })}>
                  {sz}%
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" className={`btn ${a11y.readerMode ? 'btn-primary' : ''}`} onClick={() => updateA11y({ readerMode: !a11y.readerMode })}>
              Reader Mode: {a11y.readerMode ? 'ON' : 'OFF'}
            </button>
            <button type="button" className={`btn ${a11y.highContrast ? 'btn-primary' : ''}`} onClick={() => updateA11y({ highContrast: !a11y.highContrast })}>
              High Contrast Viewer: {a11y.highContrast ? 'ON' : 'OFF'}
            </button>
            <button type="button" className={`btn ${speaking ? 'btn-danger' : ''}`} onClick={toggleReadAloud}>
              {speaking ? <><VolumeX size={15} /> Stop Reading Aloud</> : <><Volume2 size={15} /> Read Page Aloud</>}
            </button>
          </div>
        </div>
      )}

      {showReportModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 90, display: 'grid', placeItems: 'center', padding: 16 }}
          onClick={() => setShowReportModal(false)}
        >
          <div className="card" style={{ maxWidth: 460, width: '100%', boxShadow: 'var(--shadow-md)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 17, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Flag size={17} color="var(--danger)" /> Report a Problem to Admin</h2>
              <button type="button" className="btn" style={{ padding: '4px 7px' }} onClick={() => setShowReportModal(false)}><X size={15} /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!repSubject.trim() || !repDesc.trim()) return;
                if (isDemoUser) {
                  setShellToast({ type: 'success', text: 'Problem report submitted to Admin (Demo).' });
                  setShowReportModal(false);
                  setRepSubject(''); setRepDesc('');
                  return;
                }
                setRepBusy(true);
                try {
                  const { error } = await supabase.rpc('submit_problem_report', {
                    p_category: repCategory,
                    p_page_path: location.pathname,
                    p_subject: repSubject.trim(),
                    p_description: repDesc.trim(),
                  });
                  if (error) throw error;
                  setShellToast({ type: 'success', text: 'Report sent directly to Admin!' });
                  setShowReportModal(false);
                  setRepSubject('');
                  setRepDesc('');
                } catch (err: any) {
                  setShellToast({ type: 'error', text: `Could not send report: ${err.message}` });
                } finally {
                  setRepBusy(false);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600 }}>Category</label>
                <select value={repCategory} onChange={(e) => setRepCategory(e.target.value as any)}>
                  <option value="bug">Bug / Technical Error</option>
                  <option value="ui">UI / Layout Issue</option>
                  <option value="access">Login / Access Issue</option>
                  <option value="academic">Attendance / Assignment / Marks</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600 }}>Subject *</label>
                <input value={repSubject} onChange={(e) => setRepSubject(e.target.value)} placeholder="Short summary of the problem..." required />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600 }}>Details *</label>
                <textarea rows={4} value={repDesc} onChange={(e) => setRepDesc(e.target.value)} placeholder="Describe what happened..." required />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowReportModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={repBusy}>{repBusy ? 'Sending...' : 'Send to Admin'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
