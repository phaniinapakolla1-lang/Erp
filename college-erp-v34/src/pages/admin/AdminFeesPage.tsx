import React, { useEffect, useState } from 'react';
import { CreditCard, ExternalLink, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, supabase } from '../../lib/supabase';
import { ToastMessage, ToastPopup } from '../../components/ToastPopup';

export const AdminFeesPage: React.FC = () => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [feeUrl, setFeeUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (demo) return;
    supabase
      .from('erp_settings')
      .select('fee_portal_url')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        const u = data?.fee_portal_url || '';
        setFeeUrl(u);
        setSavedUrl(u);
      });
  }, [demo]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = feeUrl.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      setToast({ type: 'error', text: 'Please enter a valid URL starting with https:// or http://' });
      return;
    }
    if (demo) {
      setSavedUrl(trimmed);
      setToast({ type: 'success', text: trimmed ? 'Fee portal link saved (Demo).' : 'Fee portal link cleared (Demo).' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_set_fee_portal_url', { p_url: trimmed || null });
      if (error) throw error;
      setSavedUrl(trimmed);
      window.dispatchEvent(new Event('erp-fee-link-updated'));
      setToast({
        type: 'success',
        text: trimmed
          ? 'Fee Portal link saved! Students can now see the Fees button.'
          : 'Fee Portal link cleared. The Fees button is now hidden from students.',
      });
    } catch (err: any) {
      setToast({ type: 'error', text: `Error saving link: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setFeeUrl('');
    if (demo) {
      setSavedUrl('');
      setToast({ type: 'success', text: 'Fee link removed.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_set_fee_portal_url', { p_url: null });
      if (error) throw error;
      setSavedUrl('');
      window.dispatchEvent(new Event('erp-fee-link-updated'));
      setToast({ type: 'success', text: 'Fee link cleared. Students can no longer see the Fees option.' });
    } catch (err: any) {
      setToast({ type: 'error', text: `Error clearing link: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="erp-content">
      <ToastPopup toast={toast} onClose={() => setToast(null)} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Fees Portal Link</h1>
          <p className="page-sub">
            Paste your college&apos;s external fee payment URL below. Until a link is saved, students will not see the Fees option.
          </p>
        </div>
        <span className={`badge ${savedUrl ? 'badge-success' : 'badge-warn'}`}>
          {savedUrl ? 'Visible to Students' : 'Hidden from Students'}
        </span>
      </div>

      <div className="card" style={{ maxWidth: 680 }}>
        <h2 style={{ fontSize: 16, marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard size={17} color="var(--primary)" /> Student Fee Redirect URL
        </h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              External Fee Payment Link
            </label>
            <input
              type="url"
              value={feeUrl}
              onChange={(e) => setFeeUrl(e.target.value)}
              placeholder="https://fees.****.edu/pay"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={15} /> {saving ? 'Saving...' : 'Save Fee Link'}
            </button>
            {savedUrl && (
              <>
                <a href={savedUrl} target="_blank" rel="noreferrer" className="btn" style={{ textDecoration: 'none' }}>
                  <ExternalLink size={15} /> Test Link
                </a>
                <button type="button" className="btn btn-danger" disabled={saving} onClick={handleClear}>
                  <Trash2 size={15} /> Clear &amp; Hide from Students
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
