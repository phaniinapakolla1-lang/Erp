import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Bell, BookOpen, Calendar, CheckSquare, ClipboardList, FileCheck,
  GraduationCap, LayoutDashboard, LogOut, Moon, Settings, ShieldCheck, Sun, Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/erp';

const ROLE_MENUS: Record<UserRole, Array<{ to: string; label: string; icon: React.ReactNode }>> = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { to: '/admin/users', label: 'Users & Approvals', icon: <Users size={17} /> },
    { to: '/admin/academic', label: 'Academic Setup', icon: <BookOpen size={17} /> },
    { to: '/admin/oversight', label: 'Oversight & Backup', icon: <ShieldCheck size={17} /> },
    { to: '/calendar', label: 'Academic Calendar', icon: <Calendar size={17} /> },
    { to: '/settings', label: 'Settings', icon: <Settings size={17} /> },
  ],
  faculty: [
    { to: '/faculty', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { to: '/faculty/classes', label: 'My Classes', icon: <BookOpen size={17} /> },
    { to: '/faculty/attendance', label: 'Take Attendance', icon: <CheckSquare size={17} /> },
    { to: '/faculty/assignments', label: 'Assignments & Tracker', icon: <ClipboardList size={17} /> },
    { to: '/faculty/evaluate', label: 'F07 Evaluation', icon: <FileCheck size={17} /> },
    { to: '/calendar', label: 'Calendar', icon: <Calendar size={17} /> },
    { to: '/settings', label: 'Settings', icon: <Settings size={17} /> },
  ],
  student: [
    { to: '/student', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { to: '/student/attendance', label: 'My Attendance', icon: <CheckSquare size={17} /> },
    { to: '/student/assignments', label: 'Assignments', icon: <ClipboardList size={17} /> },
    { to: '/student/marks', label: 'Marks & Feedback', icon: <FileCheck size={17} /> },
    { to: '/calendar', label: 'Calendar', icon: <Calendar size={17} /> },
    { to: '/settings', label: 'Settings', icon: <Settings size={17} /> },
  ],
  hod: [
    { to: '/hod', label: 'Dept Dashboard', icon: <LayoutDashboard size={17} /> },
    { to: '/hod/oversight', label: 'Dept Oversight', icon: <ShieldCheck size={17} /> },
    { to: '/calendar', label: 'Dept Calendar', icon: <Calendar size={17} /> },
    { to: '/settings', label: 'Settings', icon: <Settings size={17} /> },
  ],
};

function getInitials(name: string) {
  return name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
}

export const AppShell: React.FC = () => {
  const { profile, theme, toggleTheme, signOut } = useAuth();
  if (!profile) return null;

  const menu = ROLE_MENUS[profile.role];

  return (
    <div className="erp-shell">
      <aside className="erp-sidebar">
        <div className="erp-brand">
          <div className="erp-logo-mark"><GraduationCap size={19} /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>St. Xavier ERP</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Academic Portal</div>
          </div>
        </div>

        <div className="nav-section-label">{profile.role.toUpperCase()} WORKSPACE</div>
        <nav style={{ flex: 1 }}>
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split('/').length === 2}
              className={({ isActive }) => `erp-nav-link ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="erp-user-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
            <div className="avatar">{getInitials(profile.full_name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile.full_name}
              </div>
              <span className="badge badge-primary" style={{ fontSize: 10.5, padding: '1px 7px' }}>
                {profile.role.toUpperCase()}
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
            <span className="badge badge-primary">2026–27 · Semester 1</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Department of Computer Science</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn" onClick={toggleTheme} title="Toggle light/dark theme">
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <NavLink to="/notifications" className="btn" style={{ textDecoration: 'none' }}>
              <Bell size={16} />
              <span>Alerts</span>
              <span className="badge badge-warn" style={{ padding: '1px 6px' }}>3</span>
            </NavLink>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
};
