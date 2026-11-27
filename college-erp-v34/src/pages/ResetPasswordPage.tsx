import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const ResetPasswordPage: React.FC = () => {
  const { updatePassword } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (pw !== pw2) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await updatePassword(pw);
    } catch (err: any) {
      setError(err?.message || 'Could not update password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form onSubmit={submit} className="card" style={{ width: 380, display: 'grid', gap: 12 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Set a new password</h1>
        <label style={{ fontSize: 13, fontWeight: 600 }} htmlFor="np1">New password</label>
        <input id="np1" type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required />
        <label style={{ fontSize: 13, fontWeight: 600 }} htmlFor="np2">Confirm new password</label>
        <input id="np2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={6} required />
        {error && <div className="badge badge-danger" style={{ display: 'block', padding: 10, borderRadius: 8 }}>{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </div>
  );
};
