import React, { useEffect, useState } from 'react';
import { Calendar as CalIcon, ChevronLeft, ChevronRight, Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoProfile, isSupabaseConfigured, supabase } from '../../lib/supabase';
import { DEFAULT_AVATAR_ICONS } from '../../lib/avatarIcons';
import { compressImageFileToDataUrl, loadGlassVisibility, loadLocalWallpaper, loadWallpaperBlur, loadWallpaperToneMode, saveGlassVisibility, saveLocalWallpaper, saveWallpaperBlur, saveWallpaperToneMode, ThemeMode, WallpaperToneMode } from '../../lib/localPrefs';
import { localISODate, localToUtcIso } from '../../lib/dates';

interface CalendarEventItem {
  id: string;
  date: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  title: string;
  description?: string;
  type: 'holiday' | 'college_event' | 'department_event' | 'class_note';
  createdBy: string;
  ownerLabel: string;
  time?: string;
}

const OWNER_LABEL: Record<string, string> = { holiday: 'Admin', college_event: 'Admin', department_event: 'HOD', class_note: 'Faculty' };
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const mapRow = (d: any): CalendarEventItem => ({
  id: d.id,
  date: localISODate(new Date(d.start_at)),
  endDate: localISODate(new Date(d.end_at || d.start_at)),
  title: d.title,
  description: d.description || '',
  type: d.event_type,
  createdBy: d.created_by,
  ownerLabel: OWNER_LABEL[d.event_type] || 'Admin',
  time: `${fmtTime(d.start_at)} – ${fmtTime(d.end_at)}`,
});
const EVENT_COLUMNS = 'id, title, description, event_type, start_at, end_at, created_by';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarPage: React.FC = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isHod = profile?.role === 'hod';
  const isFaculty = profile?.role === 'faculty';
  const canCreate = isAdmin || isHod || isFaculty;
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [calNotice, setCalNotice] = useState('');

  const demoMode = isDemoProfile(profile);
  const now = new Date();
  const [viewYear, setViewYear] = useState(demoMode ? 2026 : now.getFullYear());
  const [viewMonth, setViewMonth] = useState(demoMode ? 10 : now.getMonth());
  const [selectedDate, setSelectedDate] = useState(demoMode ? '2026-11-20' : localISODate(now));
  const [endDate, setEndDate] = useState(demoMode ? '2026-11-20' : localISODate(now));

  const [events, setEvents] = useState<CalendarEventItem[]>(
    demoMode
      ? [
          { id: 'e1', date: '2026-11-18', endDate: '2026-11-18', title: 'DBMS Assignment 01 Deadline', description: 'Submit Drive link before 11:59 PM', type: 'class_note', createdBy: 'demo-faculty', ownerLabel: 'Faculty' },
          { id: 'e2', date: '2026-11-22', endDate: '2026-11-22', title: 'OS Project Review', description: 'Lab 302 · MCA Sec A', type: 'class_note', createdBy: 'demo-faculty', ownerLabel: 'Faculty' },
          { id: 'e3', date: '2026-11-25', endDate: '2026-11-28', title: 'Annual Tech Symposium', description: 'College-wide auditorium event', type: 'college_event', createdBy: 'demo-admin', ownerLabel: 'Admin' },
        ]
      : []
  );

  const [mySections, setMySections] = useState<Array<{ id: string; label: string }>>([]);
  const [sectionId, setSectionId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<'college_event' | 'holiday' | 'department_event' | 'class_note'>(isAdmin ? 'college_event' : isHod ? 'department_event' : 'class_note');

  useEffect(() => {
    if (!isSupabaseConfigured || !profile || profile.id.startsWith('demo-')) return;
    supabase
      .from('calendar_events')
      .select(EVENT_COLUMNS)
      .order('start_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) { setCalNotice(`Error loading events: ${error.message}`); return; }
        if (data) setEvents(data.map(mapRow));
      });
    if (profile.role === 'faculty') {
      supabase
        .from('teaching_assignments')
        .select('class_section_id, class_sections(name, section_code)')
        .eq('faculty_id', profile.id)
        .then(({ data }) => {
          const seen = new Map<string, string>();
          (data || []).forEach((d: any) => {
            if (d.class_sections) seen.set(d.class_section_id, `${d.class_sections.name} · Sec ${d.class_sections.section_code}`);
          });
          const list = [...seen.entries()].map(([id, label]) => ({ id, label }));
          setMySections(list);
          if (list.length > 0) setSectionId((cur) => cur || list[0].id);
        });
    }
  }, [profile?.id]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate || !title.trim() || !profile) return;
    const effectiveEnd = endDate && endDate >= selectedDate ? endDate : selectedDate;
    if (effectiveEnd === selectedDate && endTime < startTime) {
      setCalNotice('End time must be after or equal to start time.');
      return;
    }
    const finalType = isAdmin ? eventType : isHod ? 'department_event' : 'class_note';
    const ownerLabel = isAdmin ? 'Admin' : isHod ? 'HOD' : 'Faculty';
    if (isFaculty && !demoMode && !sectionId) {
      setCalNotice('Select one of your classes for this note.');
      return;
    }
    if (!demoMode) {
      const { error } = await supabase.from('calendar_events').insert({
        title: title.trim(),
        description: description.trim(),
        event_type: finalType,
        start_at: localToUtcIso(selectedDate, startTime),
        end_at: localToUtcIso(effectiveEnd, endTime),
        department_id: isHod ? profile.department_id : null,
        class_section_id: isFaculty ? sectionId : null,
        created_by: profile.id,
      });
      if (error) {
        setCalNotice(`Error: ${error.message}`);
        return;
      }
      const { data } = await supabase.from('calendar_events').select(EVENT_COLUMNS).order('start_at', { ascending: true });
      if (data) setEvents(data.map(mapRow));
      setCalNotice('Event saved!');
    } else {
      setEvents((prev) => [...prev, { id: String(Date.now()), date: selectedDate, endDate: effectiveEnd, title, description, type: finalType, createdBy: profile.id, ownerLabel }]);
    }
    setTitle('');
    setDescription('');
  };

  const canDelete = (ev: CalendarEventItem) =>
    isAdmin ||
    (isHod && ev.createdBy === profile?.id && ev.type === 'department_event') ||
    (isFaculty && ev.createdBy === profile?.id && ev.type === 'class_note');

  const handleDelete = async (id: string) => {
    const before = events;
    setEvents((prev) => prev.filter((x) => x.id !== id));
    if (isSupabaseConfigured && !profile?.id.startsWith('demo-')) {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) {
        setEvents(before);
        setCalNotice(`Error deleting event: ${error.message}`);
      }
    }
  };

  const spansDate = (ev: CalendarEventItem, iso: string) => iso >= ev.date && iso <= (ev.endDate || ev.date);
  const selectedEvents = events.filter((ev) => spansDate(ev, selectedDate));

  return (
    <div className="erp-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Interactive Academic Calendar</h1>
          <p className="page-sub">
            {isAdmin
              ? 'Click any date to add or remove college events, holidays, or deadlines.'
              : isFaculty
              ? 'Click any date to add or delete your own class deadlines and schedules.'
              : 'Click any date to inspect scheduled classes, deadlines, and college holidays.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['month', 'week', 'agenda'] as const).map((vm) => (
            <button key={vm} className={`btn ${viewMode === vm ? 'btn-primary' : ''}`} onClick={() => setViewMode(vm)}>
              {vm.charAt(0).toUpperCase() + vm.slice(1)}
            </button>
          ))}
          {!canCreate && <span className="badge"><Lock size={13} /> Read-Only View</span>}
        </div>
      </div>
      {calNotice && <div className="badge badge-primary" style={{ marginBottom: 12, padding: '6px 12px' }}>{calNotice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: 3D-Elevated Monthly Grid */}
        <div className="card" style={{ boxShadow: '0 10px 28px rgba(15, 23, 42, 0.09)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 18 }}>
              <CalIcon size={19} color="var(--primary)" />
              <span>{MONTH_NAMES[viewMonth]} {viewYear}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" onClick={prevMonth}><ChevronLeft size={16} /></button>
              <button className="btn" onClick={nextMonth}><ChevronRight size={16} /></button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
            {WEEKDAYS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {viewMode === 'agenda' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>No events scheduled.</div> : events.map((ev) => (
                <button key={ev.id} type="button" onClick={() => setSelectedDate(ev.date)} style={{ textAlign: 'left', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{ev.title}</strong> — <span style={{ color: 'var(--text-muted)' }}>{ev.description || ev.type}</span></span>
                  <span className="badge badge-primary">{ev.date}</span>
                </button>
              ))}
            </div>
          ) : viewMode === 'week' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 7 }).map((_, i) => {
                const base = new Date(`${selectedDate}T00:00:00Z`);
                const d = new Date(base.getTime() + (i - base.getUTCDay()) * 86400000);
                const iso = d.toISOString().slice(0, 10);
                const dayEvs = events.filter((e) => e.date === iso);
                return (
                  <div key={iso} onClick={() => { setSelectedDate(iso); setEndDate(iso); }} style={{ padding: 10, borderRadius: 8, border: iso === selectedDate ? '2px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{WEEKDAYS[i]} · {iso}</strong>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {dayEvs.length === 0 ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No events</span> : dayEvs.map((ev) => <span key={ev.id} className="badge badge-primary">{ev.title}</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} style={{ minHeight: 74 }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const iso = `${monthPrefix}-${String(day).padStart(2, '0')}`;
              const dayEvents = events.filter((e) => spansDate(e, iso));
              const isSelected = iso === selectedDate;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => { setSelectedDate(iso); setEndDate(iso); }}
                  style={{
                    minHeight: 74,
                    padding: 7,
                    borderRadius: 9,
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--primary-soft)' : 'var(--surface)',
                    boxShadow: isSelected ? '0 4px 12px rgba(29, 78, 216, 0.16)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    color: 'var(--text)',
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{day}</span>
                  {dayEvents.slice(0, 2).map((ev) => (
                    <span
                      key={ev.id}
                      style={{
                        fontSize: 10.5,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: ev.type === 'holiday' ? 'var(--danger-soft)' : ev.type === 'class_note' ? 'var(--warning-soft)' : 'var(--primary-soft)',
                        color: ev.type === 'holiday' ? 'var(--danger)' : ev.type === 'class_note' ? 'var(--warning)' : 'var(--primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: 600,
                      }}
                    >
                      {ev.title}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
          )}
        </div>

        {/* Right: Selected Date Details & Add Event Form */}
        <div className="card" style={{ boxShadow: '0 10px 28px rgba(15, 23, 42, 0.09)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <span className="badge badge-primary">Selected Date</span>
            <h2 style={{ fontSize: 18, margin: '6px 0 0' }}>{selectedDate}</h2>
          </div>

          {canCreate && (
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isAdmin ? 'Event or holiday title...' : 'Assignment / project deadline or class note...'} required />
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details (e.g. Room, Class, Time)" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label style={{ fontSize: 11.5, fontWeight: 600 }}>From Date</label><input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} required /></div>
                <div><label style={{ fontSize: 11.5, fontWeight: 600 }}>To Date (Timeline)</label><input type="date" min={selectedDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label style={{ fontSize: 11.5, fontWeight: 600 }}>Start Time</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></div>
                <div><label style={{ fontSize: 11.5, fontWeight: 600 }}>End Time</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></div>
              </div>
              {isFaculty && !demoMode && (
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
                  {mySections.length === 0 ? <option value="">No assigned classes</option> : mySections.map((sec) => <option key={sec.id} value={sec.id}>{sec.label}</option>)}
                </select>
              )}
              {isAdmin && (
                <select value={eventType} onChange={(e) => setEventType(e.target.value as 'college_event' | 'holiday' | 'class_note')}>
                  <option value="college_event">College Event / Exam Timeline</option>
                  <option value="holiday">Holiday / Long Vacation</option>
                  <option value="class_note">Academic Deadline / Note</option>
                </select>
              )}
              <button type="submit" className="btn btn-primary"><Plus size={15} /> Add on {selectedDate}</button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedEvents.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No events scheduled on {selectedDate}.</div>
            ) : (
              selectedEvents.map((ev) => (
                <div key={ev.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{ev.title}</div>
                    {ev.endDate && ev.endDate > ev.date && <div className="badge badge-primary mono" style={{ fontSize: 11, marginTop: 4 }}>{ev.date} → {ev.endDate}</div>}
                    {ev.time && <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{ev.time}</div>}
                    {ev.description && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{ev.description}</div>}
                    <span className="badge" style={{ marginTop: 6 }}>{ev.ownerLabel} · {ev.type.replace('_', ' ')}</span>
                  </div>
                  {canDelete(ev) && (
                    <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => handleDelete(ev.id)} title="Delete event">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const NotificationsPage: React.FC = () => {
  const { profile } = useAuth();
  const demoMode = isDemoProfile(profile);
  const [items, setItems] = useState<Array<{ id: string; title: string; body: string; is_read: boolean }>>(
    demoMode
      ? [
          { id: 'n1', title: 'Attendance Pending', body: 'MCA Section A Slot 1 requires marking today.', is_read: false },
          { id: 'n2', title: 'Drive Link Submitted', body: 'Aarav Sharma submitted DBMS Assignment 01 via Google Drive.', is_read: false },
        ]
      : []
  );
  const [notifError, setNotifError] = useState('');

  useEffect(() => {
    if (isDemoProfile(profile)) return;
    supabase.from('notifications').select('id, title, body, is_read').eq('user_id', profile!.id).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setNotifError(`Failed to load notifications: ${error.message}`);
      else if (data) setItems(data);
    });
  }, [profile?.id]);

  const markAllRead = async () => {
    setNotifError('');
    if (profile && isSupabaseConfigured && !profile.id.startsWith('demo-')) {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
      if (error) {
        setNotifError(`Could not mark notifications as read: ${error.message}`);
        return;
      }
    }
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    window.dispatchEvent(new Event('erp-notifications-updated'));
  };

  const markOneRead = async (id: string) => {
    setNotifError('');
    if (profile && isSupabaseConfigured && !profile.id.startsWith('demo-')) {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', profile.id);
      if (error) {
        setNotifError(`Could not update notification: ${error.message}`);
        return;
      }
    }
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    window.dispatchEvent(new Event('erp-notifications-updated'));
  };

  return (
    <div className="erp-content">
      <div className="page-header">
        <div><h1 className="page-title">Notifications &amp; Task Alerts</h1><p className="page-sub">Live academic reminders and alerts.</p></div>
        <button className="btn" onClick={markAllRead}>Mark All Read</button>
      </div>
      {notifError && <div className="badge badge-danger" style={{ marginBottom: 12, padding: '6px 12px' }}>{notifError}</div>}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No notifications yet.</div> : items.map((n) => (
          <div key={n.id} style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div><strong>{n.title}</strong> — {n.body}</div>
            {!n.is_read && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="badge badge-warn">Unread</span>
                <button className="btn" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => markOneRead(n.id)}>Mark Read</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const { theme, setThemeMode, profile, refreshProfile } = useAuth();
  const [wallpaper, setWallpaper] = useState(() => loadLocalWallpaper());
  const [wallpaperUrlInput, setWallpaperUrlInput] = useState(() => (loadLocalWallpaper().startsWith('http') ? loadLocalWallpaper() : ''));
  const [wallMsg, setWallMsg] = useState('');
  const [glassVis, setGlassVis] = useState(() => loadGlassVisibility());
  const [wpBlur, setWpBlur] = useState(() => loadWallpaperBlur());
  const [wpTone, setWpTone] = useState<WallpaperToneMode>(() => loadWallpaperToneMode());
  const [mailLimit, setMailLimit] = useState<number>(150);
  const [mailLimitMsg, setMailLimitMsg] = useState('');
  useEffect(() => {
    if (isDemoProfile(profile) || profile?.role !== 'admin') return;
    supabase.from('erp_settings').select('mail_hourly_limit').eq('id', 1).maybeSingle()
      .then(({ data }) => { if (data?.mail_hourly_limit) setMailLimit(Number(data.mail_hourly_limit)); });
  }, [profile?.id, profile?.role]);
  const demo = isDemoProfile(profile);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [mobile, setMobile] = useState(profile?.mobile || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [dob, setDob] = useState(profile?.dob || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarIcon, setAvatarIcon] = useState(profile?.avatar_icon || '🎓');
  const [guardianName, setGuardianName] = useState(profile?.guardian_name || '');
  const [guardianPhone, setGuardianPhone] = useState(profile?.guardian_phone || '');
  const [bloodGroup, setBloodGroup] = useState(profile?.blood_group || '');
  const [photoDriveUrl, setPhotoDriveUrl] = useState(profile?.photo_drive_url || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || '');
    setMobile(profile.mobile || '');
    setGender(profile.gender || '');
    setDob(profile.dob || '');
    setAddress(profile.address || '');
    setBio(profile.bio || '');
    setAvatarIcon(profile.avatar_icon || '🎓');
    setGuardianName(profile.guardian_name || '');
    setGuardianPhone(profile.guardian_phone || '');
    setBloodGroup(profile.blood_group || '');
    setPhotoDriveUrl(profile.photo_drive_url || '');
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (demo) {
      setSaveMsg('Profile updates are saved in live mode.');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      const { error } = await supabase.rpc('update_own_profile', {
        p_full_name: fullName,
        p_mobile: mobile || null,
        p_gender: gender || null,
        p_dob: dob || null,
        p_address: address || null,
        p_bio: bio || null,
        p_avatar_icon: avatarIcon,
        p_guardian_name: guardianName || null,
        p_guardian_phone: guardianPhone || null,
        p_blood_group: bloodGroup || null,
        p_photo_drive_url: photoDriveUrl.trim() || null,
      });
      if (error) throw error;
      await refreshProfile();
      setSaveMsg('Profile saved!');
    } catch (err: any) {
      setSaveMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="erp-content">
      <div className="page-header"><div><h1 className="page-title">My Profile &amp; System Settings</h1><p className="page-sub">Update your personal details, choose an avatar icon, and manage theme preferences.</p></div></div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <form onSubmit={handleSaveProfile} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar" style={{ width: 46, height: 46, fontSize: 22 }}>{avatarIcon}</div>
            <div>
              <h2 style={{ fontSize: 16, margin: 0 }}>Personal Profile Details</h2>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{profile?.email} · {profile?.role.toUpperCase()}</div>
            </div>
          </div>

          {saveMsg && <div className="badge badge-primary" style={{ padding: '6px 10px' }}>{saveMsg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Full Name</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Mobile Number</label><input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 98*** ***10" /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Date of Birth</label><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
          </div>

          <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Address</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="City, State" /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Guardian / Parent Name</label><input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Parent / Guardian name" /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Guardian Contact</label><input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="+91 98*** ***00" /></div>
            <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Blood Group</label><select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}><option value="">Select</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="O+">O+</option><option value="O-">O-</option><option value="AB+">AB+</option><option value="AB-">AB-</option></select></div>
          <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--primary)', background: 'var(--primary-soft)' }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>Official College Record &amp; Hall Ticket Photo (Google Drive Link)</label>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.45 }}>
              <strong>Important:</strong> This photo will be used for all official college records and Hall Tickets. Upload a clear passport-size photo in <strong>proper college uniform</strong> to Google Drive with sharing set to <strong>Anyone with the link – Commenter or Editor</strong>, then paste the Drive link below.
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="url"
                style={{ flex: 1, minWidth: 220 }}
                value={photoDriveUrl}
                onChange={(e) => setPhotoDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/.../view"
              />
              {(() => {
                const m = photoDriveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || photoDriveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                const thumb = m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w300` : '';
                return thumb ? (
                  <img
                    src={thumb}
                    alt="Official uniform preview"
                    style={{ width: 56, height: 68, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', background: '#fff' }}
                  />
                ) : null;
              })()}
            </div>
          </div>

          <div><label style={{ fontSize: 12.5, fontWeight: 600 }}>Bio / About</label><textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio or academic interests..." /></div>

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 6 }}>Choose Default Icon (50 Options)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(38px, 1fr))', gap: 6 }}>
              {DEFAULT_AVATAR_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setAvatarIcon(ic)}
                  style={{
                    padding: '6px 0',
                    fontSize: 18,
                    borderRadius: 8,
                    border: avatarIcon === ic ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: avatarIcon === ic ? 'var(--primary-soft)' : 'var(--surface-alt)',
                    cursor: 'pointer',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Appearance &amp; Themes</h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 0 }}>Choose a theme (saved on your device).</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {([
                ['light', 'Light'],
                ['dark', 'Dark'],
                ['glass-dark', 'Glass Dark'],
              ] as Array<[ThemeMode, string]>).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`btn ${theme === mode ? 'btn-primary' : ''}`}
                  onClick={() => setThemeMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
            {theme === 'glass-dark' && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                  <span>Glass Visibility Control</span>
                  <span className="mono">{glassVis > 0 ? `+${glassVis}%` : `${glassVis}%`}</span>
                </div>
                <input
                  type="range"
                  min={-150}
                  max={150}
                  step={5}
                  value={glassVis}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setGlassVis(v);
                    saveGlassVisibility(v);
                  }}
                  style={{ padding: 0 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>-150% (More Clear)</span>
                  <span>0%</span>
                  <span>+150% (More Frosted)</span>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Custom Wallpaper (Device Only)</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
              Paste an image URL or upload a photo. Stored only on your device—never uploaded to the server. Wallpaper appears across all screens including the navigation sidebar and top ribbon. Looks best with Glass Dark theme.
            </p>
            {wallMsg && <div className="badge badge-primary" style={{ marginBottom: 10 }}>{wallMsg}</div>}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                type="url"
                value={wallpaperUrlInput}
                onChange={(e) => setWallpaperUrlInput(e.target.value)}
                placeholder="https://example.com/wallpaper.jpg"
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const u = wallpaperUrlInput.trim();
                  if (!u) return;
                  saveLocalWallpaper(u);
                  setWallpaper(u);
                  setWallMsg('Wallpaper applied locally!');
                }}
              >
                Apply
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="btn" style={{ cursor: 'pointer' }}>
                Upload Image
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await compressImageFileToDataUrl(file);
                      saveLocalWallpaper(dataUrl);
                      setWallpaper(dataUrl);
                      setWallpaperUrlInput('');
                      setWallMsg('Local image wallpaper saved on your device!');
                    } catch (err: any) {
                      setWallMsg(err.message || 'Could not load image.');
                    }
                  }}
                />
              </label>
              {wallpaper && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    saveLocalWallpaper('');
                    setWallpaper('');
                    setWallpaperUrlInput('');
                    setWallMsg('Wallpaper cleared.');
                  }}
                >
                  Remove Wallpaper
                </button>
              )}
            </div>
            {wallpaper && (
              <>
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    <span>Wallpaper Clarity / Blur</span>
                    <span className="mono">{wpBlur}px {wpBlur <= 2 ? '(Crystal Clear)' : ''}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={16}
                    step={1}
                    value={wpBlur}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setWpBlur(v);
                      saveWallpaperBlur(v);
                    }}
                    style={{ padding: 0 }}
                  />
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Text Color for Wallpaper</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {([['auto', 'Auto'], ['light', 'Dark Text'], ['dark', 'Light Text']] as Array<[WallpaperToneMode, string]>).map(([m, lbl]) => (
                      <button
                        key={m}
                        type="button"
                        className={`btn ${wpTone === m ? 'btn-primary' : ''}`}
                        style={{ padding: '5px 8px', fontSize: 12 }}
                        onClick={() => { setWpTone(m); saveWallpaperToneMode(m); }}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', height: 90, backgroundImage: `url("${wallpaper}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              </>
            )}
          </div>
          {profile?.role === 'admin' && (
            <div className="card">
              <h2 style={{ fontSize: 16, marginTop: 0 }}>Registration / SMTP Mail Limit (Per Hour)</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
                Limit how many registration &amp; password-reset emails can be sent per hour (default 150/h). Users see a countdown timer when the limit is reached.
              </p>
              {mailLimitMsg && <div className="badge badge-primary" style={{ marginBottom: 8 }}>{mailLimitMsg}</div>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={mailLimit}
                  onChange={(e) => setMailLimit(Number(e.target.value))}
                  style={{ width: 120 }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>emails / hour</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    if (demo) { setMailLimitMsg(`Limit updated to ${mailLimit}/hr (Demo).`); return; }
                    const { error } = await supabase.rpc('admin_set_mail_hourly_limit', { p_limit: mailLimit });
                    setMailLimitMsg(error ? `Error: ${error.message}` : `Saved limit: ${mailLimit} emails/hour.`);
                  }}
                >
                  Save Limit
                </button>
              </div>
            </div>
          )}
          {profile?.role === 'admin' && (
            <div className="card">
              <h2 style={{ fontSize: 16, marginTop: 0 }}>System Status</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ShieldCheck size={16} color={isSupabaseConfigured ? 'var(--success)' : 'var(--warning)'} />
                <span className={`badge ${isSupabaseConfigured ? 'badge-success' : 'badge-warn'}`}>{isSupabaseConfigured ? 'System Connected' : 'Setup Pending'}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Environment configuration is managed securely via server settings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
