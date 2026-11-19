import React, { useState } from 'react';
import { CheckCircle2, Database, Download, Lock, RefreshCw, ShieldCheck, X, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  clearSupabaseConfig,
  downloadAdminBackupSnapshot,
  getBackupConfig,
  getSupabaseCredentials,
  REQUIRED_TABLES,
  saveBackupConfig,
  saveSupabaseConfig,
  verifyDatabaseTables,
} from '../lib/supabase';

export const SupabaseSetupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const existing = getSupabaseCredentials();
  const existingBackup = getBackupConfig();

  const [tab, setTab] = useState<'primary' | 'backup'>('primary');
  const [url, setUrl] = useState(existing.url);
  const [anonKey, setAnonKey] = useState(existing.anonKey);
  const [backupUrl, setBackupUrl] = useState(existingBackup.backupUrl);
  const [backupKey, setBackupKey] = useState(existingBackup.backupKey);
  const [sheetId, setSheetId] = useState(existingBackup.sheetId);
  const [testing, setTesting] = useState(false);
  const [tableStatus, setTableStatus] = useState<Record<string, boolean> | null>(null);
  const [savedNotice, setSavedNotice] = useState('');
  const [error, setError] = useState('');

  if (!isAdmin) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 100 }}>
        <div className="card" style={{ maxWidth: 420, width: '100%', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Lock size={18} color="var(--danger)" />
            <h2 style={{ margin: 0, fontSize: 17 }}>Admin Access Required</h2>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Only an authenticated Admin can view or modify Supabase primary and backup connections.</p>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const handleVerify = async (targetUrl: string, targetKey: string) => {
    if (!targetUrl.trim() || !targetKey.trim()) {
      setError('Enter both Project URL and Anon Public Key.');
      return;
    }
    setError('');
    setTesting(true);
    try {
      const res = await verifyDatabaseTables(targetUrl, targetKey);
      setTableStatus(res);
    } catch (e: any) {
      setError(e.message || 'Could not reach Supabase project.');
    } finally {
      setTesting(false);
    }
  };

  const handleSavePrimary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) return;
    saveSupabaseConfig(url, anonKey);
  };

  const handleSaveBackup = (e: React.FormEvent) => {
    e.preventDefault();
    saveBackupConfig(backupUrl, backupKey, sheetId);
    setSavedNotice('Backup connection saved for Admin recovery.');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 100 }}>
      <div className="card" style={{ maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={20} color="var(--primary)" />
            <h2 style={{ margin: 0, fontSize: 18 }}>Admin · Supabase &amp; Backup Connections</h2>
          </div>
          <button className="btn" onClick={onClose} style={{ padding: '4px 8px' }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className={`btn ${tab === 'primary' ? 'btn-primary' : ''}`} onClick={() => setTab('primary')}>Primary Supabase DB</button>
          <button className={`btn ${tab === 'backup' ? 'btn-primary' : ''}`} onClick={() => setTab('backup')}>Backup Connection &amp; Export</button>
        </div>

        {error && <div className="badge badge-danger" style={{ display: 'block', padding: 8, marginBottom: 12 }}>{error}</div>}
        {savedNotice && <div className="badge badge-success" style={{ display: 'block', padding: 8, marginBottom: 12 }}>{savedNotice}</div>}

        {tab === 'primary' ? (
          <>
            <form onSubmit={handleSavePrimary} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Primary Supabase Project URL</label>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-project-ref.supabase.co" required />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Primary Supabase Anon Public Key</label>
                <input type="text" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." required />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <button type="button" className="btn" onClick={() => handleVerify(url, anonKey)} disabled={testing}>
                  <RefreshCw size={15} /> {testing ? 'Checking Tables...' : 'Test & Verify Tables'}
                </button>
                <button type="submit" className="btn btn-primary">Save Primary Connection</button>
                {existing.url && (
                  <button type="button" className="btn btn-danger" onClick={clearSupabaseConfig}>Disconnect</button>
                )}
              </div>
            </form>

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <strong style={{ fontSize: 13.5, display: 'block', marginBottom: 6 }}>Required Tables (Run migrations 001, 002, 003 in SQL Editor)</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12.5 }}>
                {REQUIRED_TABLES.map((t) => {
                  const ok = tableStatus ? tableStatus[t] : null;
                  return (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'var(--surface-alt)', borderRadius: 6 }}>
                      {ok === true && <CheckCircle2 size={14} color="var(--success)" />}
                      {ok === false && <XCircle size={14} color="var(--danger)" />}
                      <span className="mono">{t}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <form onSubmit={handleSaveBackup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="badge badge-primary" style={{ alignSelf: 'flex-start' }}>
              <ShieldCheck size={13} /> Admin-Only Failover &amp; Backup Target
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Backup Supabase Project URL (Secondary DB)</label>
              <input type="url" value={backupUrl} onChange={(e) => setBackupUrl(e.target.value)} placeholder="https://backup-project-ref.supabase.co" />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Backup Supabase Anon Key</label>
              <input type="text" value={backupKey} onChange={(e) => setBackupKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Google Sheets Student Backup Sheet ID</label>
              <input type="text" value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              <button type="submit" className="btn btn-primary">Save Backup Connection</button>
              <button type="button" className="btn" onClick={() => handleVerify(backupUrl, backupKey)} disabled={testing || !backupUrl}>
                <RefreshCw size={15} /> Test Backup DB
              </button>
              <button type="button" className="btn" onClick={downloadAdminBackupSnapshot}>
                <Download size={15} /> Export JSON Snapshot
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
