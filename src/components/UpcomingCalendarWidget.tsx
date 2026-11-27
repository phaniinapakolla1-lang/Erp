import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalIcon, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isDemoProfile, supabase } from '../lib/supabase';
import { localISODate } from '../lib/dates';

interface WidgetEvent {
  id: string;
  title: string;
  description: string;
  event_type: string;
  start_at: string;
}

export const UpcomingCalendarWidget: React.FC<{ title?: string }> = ({ title = 'Upcoming Calendar & Events' }) => {
  const { profile } = useAuth();
  const demo = isDemoProfile(profile);
  const [events, setEvents] = useState<WidgetEvent[]>(
    demo
      ? [
          { id: 'w1', title: 'DBMS Assignment 01 Deadline', description: 'Submit Drive link before 11:59 PM', event_type: 'class_note', start_at: '2026-11-22T09:00:00Z' },
          { id: 'w2', title: 'Annual Tech Symposium', description: 'College Auditorium', event_type: 'college_event', start_at: '2026-11-25T10:00:00Z' },
        ]
      : []
  );
  const [selected, setSelected] = useState<WidgetEvent | null>(null);

  useEffect(() => {
    if (demo) return;
    // Include events that already started but have not ended yet.
    const startOfToday = new Date(`${localISODate()}T00:00:00`).toISOString();
    supabase
      .from('calendar_events')
      .select('id, title, description, event_type, start_at')
      .gte('end_at', startOfToday)
      .order('start_at', { ascending: true })
      .limit(5)
      .then(({ data }) => {
        if (data) setEvents(data as WidgetEvent[]);
      });
  }, [demo]);

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalIcon size={17} color="var(--primary)" /> {title}
        </h2>
        <Link to="/calendar" style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
          View Calendar →
        </Link>
      </div>
      {events.length === 0 ? (
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>No upcoming events scheduled.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => setSelected(selected?.id === ev.id ? null : ev)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface-alt)',
                cursor: 'pointer',
                color: 'var(--text)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{ev.title}</div>
                {selected?.id === ev.id && ev.description && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{ev.description}</div>
                )}
              </div>
              <span className="badge badge-primary" style={{ whiteSpace: 'nowrap' }}>
                <Clock size={11} /> {localISODate(new Date(ev.start_at))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
