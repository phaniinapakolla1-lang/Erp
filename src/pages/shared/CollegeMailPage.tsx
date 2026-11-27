import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Eye, EyeOff, Inbox, Mail, Search, Send, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, supabase } from '../../lib/supabase';

interface MailRow {
  id: string;
  sender_id: string;
  sender_email: string;
  recipient_email: string;
  recipient_id: string | null;
  mail_scope: 'internal' | 'external';
  subject: string;
  body: string;
  is_read: boolean;
  delivery_status: string;
  created_at: string;
}

interface MailLogRow {
  id: string;
  sender_email: string;
  recipient_email: string;
  mail_scope: string;
  subject: string;
  action: string;
  created_at: string;
}

interface DirectoryItem {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  roll_no: string | null;
  mail_visibility: 'public' | 'private';
}

export const CollegeMailPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const demo = isDemoProfile(profile);
  const [searchParams] = useSearchParams();
  const initialTo = searchParams.get('to') || '';
  const [tab, setTab] = useState<'inbox' | 'sent' | 'compose' | 'directory' | 'logs'>(initialTo ? 'compose' : 'inbox');
  const [mails, setMails] = useState<MailRow[]>([]);
  const [logs, setLogs] = useState<MailLogRow[]>([]);
  const [directory, setDirectory] = useState<DirectoryItem[]>([]);
  const [dirQuery, setDirQuery] = useState('');
  const [mailVisibility, setMailVisibility] = useState<'public' | 'private'>(profile?.mail_visibility || 'public');
  const [selectedMail, setSelectedMail] = useState<MailRow | null>(null);

  const [recipientEmail, setRecipientEmail] = useState(initialTo);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [lastExternalMailto, setLastExternalMailto] = useState('');

  const loadDirectory = async (q = dirQuery) => {
    if (demo) {
      setDirectory([
        { user_id: 'demo-admin', full_name: 'College Admin', email: 'admin****@***.com', role: 'admin', roll_no: null, mail_visibility: 'public' },
        { user_id: 'demo-student', full_name: 'Aarav Sharma', email: 'student1****@***.com', role: 'student', roll_no: '24MCA101', mail_visibility: 'public' },
      ]);
      return;
    }
    const { data } = await supabase.rpc('search_mail_directory', { p_query: q });
    if (data) setDirectory(data as DirectoryItem[]);
  };

  const loadMailData = async () => {
    if (demo) {
      setMails([
        {
          id: 'm1',
          sender_id: 'demo-admin',
          sender_email: 'admin****@***.com',
          recipient_email: profile?.email || 'user1****@***.com',
          recipient_id: profile?.id || 'demo',
          mail_scope: 'internal',
          subject: 'Welcome to College Mail System',
          body: 'Use College Mail to message faculty, admin, and classmates internally, or send logged external mails.',
          is_read: false,
          delivery_status: 'delivered',
          created_at: new Date().toLocaleString(),
        },
      ]);
      await loadDirectory('');
      return;
    }
    const [mailRes, logRes] = await Promise.all([
      supabase.from('college_mails').select('*').order('created_at', { ascending: false }),
      supabase.from('college_mail_logs').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    if (mailRes.data) setMails(mailRes.data as MailRow[]);
    if (logRes.data) setLogs(logRes.data as MailLogRow[]);
    await loadDirectory(dirQuery);
  };

  useEffect(() => {
    setMailVisibility(profile?.mail_visibility || 'public');
  }, [profile?.mail_visibility]);

  useEffect(() => {
    loadMailData();
  }, [demo, profile?.id]);

  const handleToggleVisibility = async (next: 'public' | 'private') => {
    setMailVisibility(next);
    if (demo) { setNotice(`Mail visibility set to ${next.toUpperCase()}.`); return; }
    const { error } = await supabase.rpc('set_mail_visibility', { p_visibility: next });
    if (error) {
      setNotice(`Error updating visibility: ${error.message}`);
    } else {
      setNotice(`Your mail ID is now ${next.toUpperCase()}${next === 'private' ? ' (hidden from students; Admin & Staff can still view it)' : ' (searchable by college members)'}.`);
      await refreshProfile();
      await loadDirectory(dirQuery);
    }
  };

  const inbox = mails.filter((m) => m.recipient_id === profile?.id);
  const sent = mails.filter((m) => m.sender_id === profile?.id);
  const unreadCount = inbox.filter((m) => !m.is_read).length;

  const openMail = async (m: MailRow) => {
    setSelectedMail(m);
    if (!demo && m.recipient_id === profile?.id && !m.is_read) {
      const { error } = await supabase.from('college_mails').update({ is_read: true }).eq('id', m.id);
      if (!error) setMails((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_read: true } : x)));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    setLastExternalMailto('');
    if (!recipientEmail.trim() || !subject.trim() || !body.trim()) return;

    if (demo) {
      setNotice('Mail logged in demo preview.');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.rpc('send_college_mail', {
        p_recipient_email: recipientEmail.trim(),
        p_subject: subject.trim(),
        p_body: body.trim(),
      });
      if (error) throw error;
      const saved = data as MailRow;
      setNotice(`Internal college mail delivered to ${saved.recipient_email} and logged.`);
      setRecipientEmail('');
      setSubject('');
      setBody('');
      await loadMailData();
    } catch (err: any) {
      setNotice(`Error sending mail: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">College Mail System</h1>
          <p className="page-sub">Internal college mail only — view your mail ID, search college users by name/email/roll no, and send logged internal messages.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={`btn ${tab === 'inbox' ? 'btn-primary' : ''}`} onClick={() => { setTab('inbox'); setSelectedMail(null); }}>
            <Inbox size={15} /> Inbox {unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
          <button className={`btn ${tab === 'sent' ? 'btn-primary' : ''}`} onClick={() => { setTab('sent'); setSelectedMail(null); }}>
            <Send size={15} /> Sent ({sent.length})
          </button>
          <button className={`btn ${tab === 'compose' ? 'btn-primary' : ''}`} onClick={() => { setTab('compose'); setSelectedMail(null); }}>
            <Mail size={15} /> Compose
          </button>
          <button className={`btn ${tab === 'directory' ? 'btn-primary' : ''}`} onClick={() => { setTab('directory'); setSelectedMail(null); loadDirectory(dirQuery); }}>
            <Users size={15} /> Search Mail IDs
          </button>
          <button className={`btn ${tab === 'logs' ? 'btn-primary' : ''}`} onClick={() => { setTab('logs'); setSelectedMail(null); }}>
            <ShieldCheck size={15} /> Safety Logs ({logs.length})
          </button>
        </div>
      </div>

      {/* My Mail ID & Privacy Bar */}
      <div className="card" style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>MY COLLEGE MAIL ID</div>
          <div className="mono" style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{profile?.email}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Directory Visibility:</span>
          <button
            type="button"
            className={`btn ${mailVisibility === 'public' ? 'btn-primary' : ''}`}
            style={{ padding: '5px 11px', fontSize: 12.5 }}
            onClick={() => handleToggleVisibility('public')}
          >
            <Eye size={14} /> Public
          </button>
          <button
            type="button"
            className={`btn ${mailVisibility === 'private' ? 'btn-primary' : ''}`}
            style={{ padding: '5px 11px', fontSize: 12.5 }}
            onClick={() => handleToggleVisibility('private')}
          >
            <EyeOff size={14} /> Private
          </button>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            (Admin &amp; Staff can always view)
          </span>
        </div>
      </div>

      {notice && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{notice}</span>
          {lastExternalMailto && (
            <a href={lastExternalMailto} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <ExternalLink size={14} /> Open in Email App
            </a>
          )}
        </div>
      )}

      {tab === 'directory' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <strong>College Mail Directory ({directory.length})</strong>
            <form
              onSubmit={(e) => { e.preventDefault(); loadDirectory(dirQuery); }}
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <Search size={15} color="var(--text-muted)" />
              <input
                style={{ width: 280 }}
                value={dirQuery}
                onChange={(e) => { setDirQuery(e.target.value); void loadDirectory(e.target.value); }}
                placeholder="Search by name, mail ID, or roll no..."
              />
            </form>
          </div>
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead><tr><th>Name</th><th>Roll No</th><th>Role</th><th>Mail ID</th><th>Visibility</th><th>Action</th></tr></thead>
              <tbody>
                {directory.length === 0 ? (
                  <tr><td colSpan={6} style={{ color: 'var(--text-muted)' }}>No matching users found.</td></tr>
                ) : (
                  directory.map((d) => (
                    <tr key={d.user_id}>
                      <td style={{ fontWeight: 600 }}>{d.full_name}</td>
                      <td className="mono">{d.roll_no || '—'}</td>
                      <td><span className="badge badge-primary">{d.role.toUpperCase()}</span></td>
                      <td className="mono" style={{ fontSize: 12.5 }}>{d.email}</td>
                      <td><span className={`badge ${d.mail_visibility === 'public' ? 'badge-success' : 'badge-warn'}`}>{d.mail_visibility.toUpperCase()}</span></td>
                      <td>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 10px' }}
                          onClick={() => {
                            setRecipientEmail(d.email);
                            setTab('compose');
                          }}
                        >
                          <Mail size={13} /> Compose
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'compose' && (
        <form onSubmit={handleSend} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Quick Select (Within College)</label>
              <select value="" onChange={(e) => { if (e.target.value) setRecipientEmail(e.target.value); }}>
                <option value="">Choose college user (optional)...</option>
                {directory.filter((d) => d.user_id !== profile?.id).map((d) => (
                  <option key={d.user_id} value={d.email}>
                    {d.full_name}{d.roll_no ? ` (#${d.roll_no})` : ''} ({d.role.toUpperCase()}) — {d.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Recipient College Mail ID (Internal Only) *</label>
              <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="user1****@***.com" required />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Subject *</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter subject..." required />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Message *</label>
            <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your internal college message... All messages are saved in safety logs." required />
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              <Send size={15} /> {sending ? 'Sending & Logging...' : 'Send Mail'}
            </button>
          </div>
        </form>
      )}

      {(tab === 'inbox' || tab === 'sent') && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
              {tab === 'inbox' ? `Inbox (${inbox.length})` : `Sent Mails (${sent.length})`}
            </div>
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead><tr><th>{tab === 'inbox' ? 'From' : 'To'}</th><th>Subject</th><th>Scope</th><th>Date</th></tr></thead>
                <tbody>
                  {(tab === 'inbox' ? inbox : sent).length === 0 ? (
                    <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No messages yet.</td></tr>
                  ) : (
                    (tab === 'inbox' ? inbox : sent).map((m) => (
                      <tr key={m.id} onClick={() => openMail(m)} style={{ cursor: 'pointer', fontWeight: tab === 'inbox' && !m.is_read ? 700 : 400 }}>
                        <td className="mono" style={{ fontSize: 12 }}>{tab === 'inbox' ? m.sender_email : m.recipient_email}</td>
                        <td>{m.subject}</td>
                        <td><span className={`badge ${m.mail_scope === 'internal' ? 'badge-primary' : 'badge-warn'}`}>{m.mail_scope.toUpperCase()}</span></td>
                        <td className="mono" style={{ fontSize: 11.5 }}>{new Date(m.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            {selectedMail ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className={`badge ${selectedMail.mail_scope === 'internal' ? 'badge-primary' : 'badge-warn'}`}>{selectedMail.mail_scope.toUpperCase()} MAIL</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(selectedMail.created_at).toLocaleString()}</span>
                </div>
                <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>{selectedMail.subject}</h2>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
                  <div>From: <span className="mono">{selectedMail.sender_email}</span></div>
                  <div>To: <span className="mono">{selectedMail.recipient_email}</span></div>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.55, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  {selectedMail.body}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Select a message from the list to read its full content.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
            {profile?.role === 'admin' ? 'College-Wide Mail Safety & Audit Logs' : 'My Sent Mail Safety Logs'} ({logs.length})
          </div>
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead><tr><th>Time</th><th>Sender</th><th>Recipient</th><th>Scope</th><th>Subject</th><th>Action</th></tr></thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={6} style={{ color: 'var(--text-muted)' }}>No mail logs recorded yet.</td></tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id}>
                      <td className="mono" style={{ fontSize: 12 }}>{new Date(l.created_at).toLocaleString()}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{l.sender_email}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{l.recipient_email}</td>
                      <td><span className={`badge ${l.mail_scope === 'internal' ? 'badge-primary' : 'badge-warn'}`}>{l.mail_scope.toUpperCase()}</span></td>
                      <td>{l.subject}</td>
                      <td><span className="badge badge-success">{l.action}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
