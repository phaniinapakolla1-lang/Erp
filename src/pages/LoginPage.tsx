import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Eye, EyeOff, GraduationCap, KeyRound, Lock, Shield, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { deleteCookie, getCookie, setCookie } from '../lib/localPrefs';
import { isDevMode, isSupabaseConfigured, supabase } from '../lib/supabase';
import { UserRole } from '../types/erp';

function formatCountdown(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export const LoginPage: React.FC = () => {
  const { profile, signIn, signUp, signOut, switchDemoRole, requestPasswordReset, verifyRecoveryOtpAndReset } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [identifier, setIdentifier] = useState(() => getCookie('erp_remember_email') || '');
  const [rememberMe, setRememberMe] = useState(() => Boolean(getCookie('erp_remember_email')));
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // OTP Password Reset states
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Hourly SMTP email limit state
  const [limitHit, setLimitHit] = useState<{ limit: number; retrySeconds: number } | null>(null);

  useEffect(() => {
    if (!limitHit || limitHit.retrySeconds <= 0) return;
    const timer = setInterval(() => {
      setLimitHit((prev) => {
        if (!prev || prev.retrySeconds <= 1) return null;
        return { ...prev, retrySeconds: prev.retrySeconds - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [Boolean(limitHit)]);

  if (profile && profile.status !== 'approved') {
    return (
      <div className="login-panel" style={{ minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: 440, width: '100%' }}>
          <span className="badge badge-warn" style={{ marginBottom: 10 }}>ACCOUNT {profile.status.toUpperCase()}</span>
          <h2 style={{ margin: '0 0 8px' }}>Awaiting Institutional Approval</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {profile.status === 'pending'
              ? 'Your application is queued for review by the College Administrator. You will gain portal access once approved.'
              : 'Your account is currently disabled or rejected. Please contact the College Administrator.'}
          </p>
          <button className="btn" onClick={signOut}>Back to Sign In</button>
        </div>
      </div>
    );
  }

  const checkHourlyLimit = async (eventType: 'signup' | 'password_reset', targetEmail: string): Promise<boolean> => {
    if (!isSupabaseConfigured) return true;
    const { data, error: rpcErr } = await supabase.rpc('check_and_log_smtp_limit', {
      p_event_type: eventType,
      p_email: targetEmail,
    });
    if (rpcErr) return true;
    if (data && data.allowed === false) {
      setLimitHit({ limit: Number(data.limit || 150), retrySeconds: Number(data.retry_after_seconds || 3600) });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        if (rememberMe) setCookie('erp_remember_email', identifier.trim(), 30);
        else deleteCookie('erp_remember_email');
        await signIn(identifier, password);
      } else if (mode === 'register') {
        const ok = await checkHourlyLimit('signup', regEmail.trim());
        if (!ok) return;
        await signUp(regEmail.trim(), password, fullName.trim());
        setInfo('Application submitted! Check your email for verification, then wait for Administrator approval.');
        setFullName('');
        setRegEmail('');
        setPassword('');
      } else if (mode === 'reset') {
        if (!resetOtpSent) {
          if (!identifier.trim()) { setError('Enter your registered email or roll number first.'); return; }
          const ok = await checkHourlyLimit('password_reset', identifier.trim());
          if (!ok) return;
          await requestPasswordReset(identifier);
          setResetOtpSent(true);
          setInfo('A 6-digit OTP code has been sent to your email. Enter the code and your new password below.');
        } else {
          if (resetOtpCode.trim().length < 6) { setError('Enter the 6-digit OTP code from your email.'); return; }
          if (newPassword.length < 6) { setError('New password must be at least 6 characters.'); return; }
          if (newPassword !== confirmNewPassword) { setError('Passwords do not match.'); return; }
          await verifyRecoveryOtpAndReset(identifier, resetOtpCode, newPassword);
          setMode('login');
          setResetOtpSent(false);
          setResetOtpCode('');
          setNewPassword('');
          setConfirmNewPassword('');
          setPassword('');
          setInfo('Password reset successfully! You can now sign in with your new password.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setSubmitting(false);
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
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>College Academic Portal</div>
          </div>
        </div>

        <div style={{ maxWidth: 470 }}>
          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
            Attendance · Assignments · Internal Mail · Evaluation
          </span>
          <h1 style={{ fontSize: 36, lineHeight: 1.15, margin: '0 0 16px', letterSpacing: '-0.025em' }}>
            One unified portal for Students, Faculty, HODs, and Administrators.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, margin: '0 0 28px' }}>
            Sign in with your registered email or student roll number, submit a new application, or reset your password with a 6-digit OTP.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            {[
              'Sign in with Email or Student Roll Number',
              '6-digit OTP password reset (no magic links needed)',
              'Internal College Mail with searchable directory & safety logs',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.92)' }}>
                <CheckCircle2 size={17} color="#5eead4" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={14} /> Protected Role-Based Academic Portal
        </div>
      </section>

      <section className="login-panel">
        <div className="card" style={{ maxWidth: 450, width: '100%', padding: 30, boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="erp-logo-mark" style={{ width: 32, height: 32 }}><GraduationCap size={17} /></div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>College ERP</span>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Lock size={12} /> SECURE PORTAL
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 18, background: 'var(--surface-alt)', padding: 4, borderRadius: 10 }}>
            <button
              type="button"
              className={`btn ${mode === 'login' ? 'btn-primary' : ''}`}
              style={{ border: 'none', padding: '8px 10px' }}
              onClick={() => { setMode('login'); setResetOtpSent(false); setError(''); setInfo(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`btn ${mode === 'register' ? 'btn-primary' : ''}`}
              style={{ border: 'none', padding: '8px 10px' }}
              onClick={() => { setMode('register'); setResetOtpSent(false); setError(''); setInfo(''); }}
            >
              <UserPlus size={15} /> Application Form
            </button>
          </div>

          <h2 style={{ fontSize: 21, margin: '0 0 4px' }}>
            {mode === 'login' ? 'Sign In to Your Account' : mode === 'register' ? 'New Registration Application' : 'Reset Password (OTP)'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, margin: '0 0 18px' }}>
            {mode === 'login'
              ? 'Use your registered email or student roll number to sign in.'
              : mode === 'register'
              ? 'Submit your details to verify your email and request Admin approval.'
              : resetOtpSent
              ? 'Enter the 6-digit OTP sent to your email and choose a new password.'
              : 'Enter your email or roll number to receive a 6-digit OTP code.'}
          </p>

          {limitHit && (
            <div className="card" style={{ marginBottom: 14, padding: 14, borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--warning)', marginBottom: 6 }}>
                <Clock size={16} /> Hourly Email Limit Reached ({limitHit.limit}/hr)
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.45 }}>
                Too many emails were sent in the last hour. Please <strong>sign in with an existing account</strong> or try again in{' '}
                <strong className="mono">{formatCountdown(limitHit.retrySeconds)}</strong>.
              </p>
              {mode !== 'login' && (
                <button type="button" className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={() => setMode('login')}>
                  Switch to Sign In
                </button>
              )}
            </div>
          )}

          {info && <div className="badge badge-success" style={{ display: 'block', padding: 10, borderRadius: 8, marginBottom: 14, whiteSpace: 'normal', lineHeight: 1.4 }}>{info}</div>}
          {error && <div className="badge badge-danger" style={{ display: 'block', padding: 10, borderRadius: 8, marginBottom: 14, whiteSpace: 'normal', lineHeight: 1.4 }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {mode === 'register' && (
              <>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Full Name *</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Full Name" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Registration Email *</label>
                  <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required placeholder="user1****@***.com" />
                </div>
              </>
            )}

            {(mode === 'login' || mode === 'reset') && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Registration Email or Roll Number</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={mode === 'reset' && resetOtpSent}
                  required
                  placeholder="user1****@***.com or 24MCA***"
                />
              </div>
            )}

            {mode === 'reset' && resetOtpSent && (
              <>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>6-Digit OTP Code *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={resetOtpCode}
                    onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    required
                    placeholder="Enter 6-digit OTP"
                    style={{ letterSpacing: '0.2em', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>New Password *</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Min 6 characters"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Confirm New Password *</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Re-enter new password"
                  />
                </div>
              </>
            )}

            {(mode === 'login' || mode === 'register') && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me on this device</span>
              </label>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || ((mode === 'register' || (mode === 'reset' && !resetOtpSent)) && Boolean(limitHit))}
              style={{ padding: '10px 14px', marginTop: 4 }}
            >
              {submitting
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Submit Application'
                : resetOtpSent
                ? 'Verify OTP & Reset Password'
                : 'Send 6-Digit OTP'}
            </button>
          </form>

          {mode === 'login' && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button
                type="button"
                className="btn"
                style={{ border: 'none', background: 'none', color: 'var(--primary)', fontSize: 13 }}
                onClick={() => { setMode('reset'); setResetOtpSent(false); setError(''); setInfo(''); }}
              >
                <KeyRound size={14} /> Forgot password? (Reset via OTP)
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 12 }}>
              {resetOtpSent && (
                <button
                  type="button"
                  className="btn"
                  style={{ border: 'none', background: 'none', color: 'var(--primary)', fontSize: 13 }}
                  onClick={() => { setResetOtpSent(false); setResetOtpCode(''); setError(''); setInfo(''); }}
                >
                  Resend OTP
                </button>
              )}
              <button
                type="button"
                className="btn"
                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: 13 }}
                onClick={() => { setMode('login'); setResetOtpSent(false); setError(''); setInfo(''); }}
              >
                Back to Sign In
              </button>
            </div>
          )}

          {isDevMode && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: 8 }}>
                QUICK PREVIEW (DEV ONLY)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {(['admin', 'hod', 'faculty', 'exam_controller', 'student'] as UserRole[]).map((r) => (
                  <button key={r} type="button" className="btn" onClick={() => switchDemoRole(r)}>
                    Preview {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
