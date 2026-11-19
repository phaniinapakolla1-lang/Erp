import React, { useState } from 'react';
import { BookOpen, CheckCircle2, Eye, EyeOff, GraduationCap, Lock, Shield, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

export const LoginPage: React.FC = () => {
  const { profile, signIn, signUp, signOut, switchDemoRole } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');

  if (profile && profile.status !== 'approved') {
    return (
      <div className="login-panel" style={{ minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: 440, width: '100%' }}>
          <span className="badge badge-warn" style={{ marginBottom: 10 }}>ACCOUNT {profile.status.toUpperCase()}</span>
          <h2 style={{ margin: '0 0 8px' }}>Awaiting Institutional Approval</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {profile.status === 'pending'
              ? 'Your registration is queued for Admin review and role assignment. You will gain portal access once approved.'
              : 'Your account is currently disabled or rejected. Please contact the College ERP Administrator.'}
          </p>
          <button className="btn" onClick={signOut}>Back to Sign In</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'login') await signIn(email, password);
      else await signUp(email, password, fullName);
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    }
  };

  return (
    <div className="login-split">
      <section className="login-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="erp-logo-mark" style={{ background: 'rgba(255,255,255,0.18)' }}>
            <GraduationCap size={21} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>St. Xavier Institute ERP</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Academic Operations &amp; LMS Portal</div>
          </div>
        </div>

        <div style={{ maxWidth: 470 }}>
          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
            Academic Year 2026–27 · Semester 1
          </span>
          <h1 style={{ fontSize: 36, lineHeight: 1.15, margin: '0 0 16px', letterSpacing: '-0.025em' }}>
            One unified academic workspace for faculty, students, HODs &amp; admin.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, margin: '0 0 28px' }}>
            Streamlined daily attendance, central assignments, Google Drive link submissions, and split-frame grading—all backed by one PostgreSQL core.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            {[
              'Mandatory session attendance with 24-hour edit window & audit history',
              'F07 split-frame Drive preview & grading with instant student stepping',
              'Admin-only database, backup, timetable, and calendar controls',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.92)' }}>
                <CheckCircle2 size={17} color="#5eead4" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={14} /> Protected by Supabase PostgreSQL RLS
        </div>
      </section>

      <section className="login-panel">
        <div className="card" style={{ maxWidth: 440, width: '100%', padding: 28, boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className={`badge ${isSupabaseConfigured ? 'badge-success' : 'badge-warn'}`}>
              {isSupabaseConfigured ? 'Supabase Connected' : 'Local Preview Mode'}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Lock size={12} /> DB managed by Admin
            </span>
          </div>

          <h2 style={{ fontSize: 22, margin: '0 0 4px' }}>
            {mode === 'login' ? 'Sign in to College ERP' : 'Request Institutional Access'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, margin: '0 0 20px' }}>
            {mode === 'login' ? 'Use your college email and password to access your portal.' : 'Registrations require Admin approval and role assignment.'}
          </p>

          {error && <div className="badge badge-danger" style={{ display: 'block', padding: 10, borderRadius: 8, marginBottom: 14 }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Full Name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Aarav Sharma" />
              </div>
            )}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>College Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@college.edu" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  style={{ paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 14px', marginTop: 4 }}>
              {mode === 'login' ? 'Sign In to Portal' : 'Submit Registration'}
            </button>
          </form>

          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <button
              className="btn"
              style={{ border: 'none', background: 'none', color: 'var(--primary)', fontSize: 13 }}
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'New student or faculty? Register here' : 'Already approved? Sign in'}
            </button>
          </div>

          {!isSupabaseConfigured && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: 10 }}>
                INSTANT PORTAL PREVIEW (DEMO MODE)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button className="role-preview-btn" onClick={() => switchDemoRole('faculty')}>
                  <BookOpen size={17} color="var(--primary)" />
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>Faculty</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Attendance &amp; F07</div></div>
                </button>
                <button className="role-preview-btn" onClick={() => switchDemoRole('student')}>
                  <Users size={17} color="var(--success)" />
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>Student</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Drive Links &amp; Marks</div></div>
                </button>
                <button className="role-preview-btn" onClick={() => switchDemoRole('admin')}>
                  <ShieldCheck size={17} color="var(--warning)" />
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>Admin</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Setup &amp; Backups</div></div>
                </button>
                <button className="role-preview-btn" onClick={() => switchDemoRole('hod')}>
                  <UserCheck size={17} color="var(--primary)" />
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>HOD</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dept Oversight</div></div>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
