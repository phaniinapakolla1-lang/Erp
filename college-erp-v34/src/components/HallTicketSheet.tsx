import React from 'react';
import { parseGoogleDriveLink } from '../lib/driveLink';

export type HallTicketSectionKey =
  | 'header'
  | 'student_info'
  | 'regular_subjects'
  | 'supplementary_subjects'
  | 'instructions'
  | 'signatures';

export interface HallTicketTemplateConfig {
  preset: 'classic' | 'modern' | 'compact' | 'custom';
  accentColor: string;
  borderStyle: 'double' | 'solid' | 'minimal';
  fontSize: number;
  showWatermark: boolean;
  watermarkOpacity: number;
  sections: Array<{ key: HallTicketSectionKey; label: string; enabled: boolean }>;
}

export const DEFAULT_HALL_TICKET_TEMPLATE: HallTicketTemplateConfig = {
  preset: 'classic',
  accentColor: '#1e3a8a',
  borderStyle: 'double',
  fontSize: 12.5,
  showWatermark: true,
  watermarkOpacity: 0.08,
  sections: [
    { key: 'header', label: 'College Header & Logo', enabled: true },
    { key: 'student_info', label: 'Student Identity & Uniform Photo', enabled: true },
    { key: 'regular_subjects', label: 'Current / Regular Subjects', enabled: true },
    { key: 'supplementary_subjects', label: 'Supplementary / Backlog Subjects', enabled: true },
    { key: 'instructions', label: 'Examination Instructions', enabled: true },
    { key: 'signatures', label: 'Signatures (Student, Controller, Principal & Stamp)', enabled: true },
  ],
};

export interface CollegeBranding {
  college_name: string;
  college_subtitle: string;
  college_address: string;
  college_logo_data: string;
  principal_sign_data: string;
  college_stamp_data: string;
  default_exam_instructions: string;
  hall_ticket_template?: HallTicketTemplateConfig | null;
}

export interface HallTicketSubjectItem {
  code: string;
  name: string;
  type?: string;
  exam_date?: string;
}

export interface HallTicketPrintData {
  hall_ticket_no: string;
  exam_title: string;
  semester_label: string;
  exam_type: string;
  student_name: string;
  roll_no: string;
  department: string;
  specialization: string;
  class_name: string;
  section_code: string;
  photo_drive_url: string;
  regular_subjects: HallTicketSubjectItem[];
  supplementary_subjects: HallTicketSubjectItem[];
  instructions: string;
}

export function drivePhotoToImgSrc(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) return trimmed;
  const parsed = parseGoogleDriveLink(trimmed);
  if (parsed.valid && parsed.fileId) {
    return `https://drive.google.com/thumbnail?id=${parsed.fileId}&sz=w400`;
  }
  return trimmed;
}

export const HallTicketSheet: React.FC<{
  data: HallTicketPrintData;
  branding: CollegeBranding;
  template?: HallTicketTemplateConfig | null;
}> = ({ data, branding, template }) => {
  const cfg: HallTicketTemplateConfig = {
    ...DEFAULT_HALL_TICKET_TEMPLATE,
    ...(template || branding.hall_ticket_template || {}),
  };

  const accent = cfg.accentColor || '#1e3a8a';
  const borderCss =
    cfg.borderStyle === 'double'
      ? `4px double ${accent}`
      : cfg.borderStyle === 'solid'
      ? `2px solid ${accent}`
      : '1px solid #cbd5e1';

  const photoSrc = drivePhotoToImgSrc(data.photo_drive_url);
  const instructionsList = (data.instructions || branding.default_exam_instructions || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const renderSection = (key: HallTicketSectionKey) => {
    if (key === 'header') {
      const modernHeader = cfg.preset === 'modern';
      return (
        <div
          key={key}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: modernHeader ? '14px 18px' : '0 0 12px',
            marginBottom: 14,
            borderBottom: modernHeader ? 'none' : `2px solid ${accent}`,
            background: modernHeader ? accent : 'transparent',
            color: modernHeader ? '#ffffff' : '#0f172a',
            borderRadius: modernHeader ? 8 : 0,
          }}
        >
          <div style={{ width: 66, height: 66, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            {branding.college_logo_data ? (
              <img src={branding.college_logo_data} alt="College Logo" style={{ maxWidth: 64, maxHeight: 64, objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 58, height: 58, borderRadius: '50%', border: `2px solid ${modernHeader ? '#fff' : accent}`, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 11 }}>
                LOGO
              </div>
            )}
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              {branding.college_name || 'College ERP'}
            </div>
            {branding.college_subtitle && (
              <div style={{ fontSize: 11.5, opacity: modernHeader ? 0.9 : 0.78, marginTop: 2 }}>{branding.college_subtitle}</div>
            )}
            {branding.college_address && (
              <div style={{ fontSize: 11, opacity: modernHeader ? 0.85 : 0.7 }}>{branding.college_address}</div>
            )}
            <div
              style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '3px 12px',
                borderRadius: 4,
                background: modernHeader ? 'rgba(255,255,255,0.2)' : accent,
                color: '#ffffff',
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              HALL TICKET — {data.exam_title} (SELF CENTER)
            </div>
          </div>
          <div style={{ width: 66, textAlign: 'right', fontSize: 10.5, fontFamily: 'monospace' }}>
            <div>HT NO:</div>
            <strong>{data.hall_ticket_no}</strong>
          </div>
        </div>
      );
    }

    if (key === 'student_info') {
      return (
        <div
          key={key}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 118px',
            gap: 14,
            marginBottom: 14,
            padding: cfg.preset === 'compact' ? '8px 10px' : '10px 14px',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            background: 'rgba(248, 250, 252, 0.75)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: cfg.fontSize }}>
            <div><strong>Student Name:</strong> {data.student_name}</div>
            <div><strong>Roll Number:</strong> <span className="mono">{data.roll_no}</span></div>
            <div><strong>Department:</strong> {data.department}</div>
            <div><strong>Specialization:</strong> {data.specialization || 'General'}</div>
            <div><strong>Class / Year:</strong> {data.class_name}</div>
            <div><strong>Section / Sem:</strong> Sec {data.section_code} · {data.semester_label}</div>
            <div><strong>Exam Center:</strong> Self Center (Home Campus)</div>
            <div><strong>Exam Type:</strong> {data.exam_type.toUpperCase()}</div>
          </div>
          <div
            style={{
              width: 112,
              height: 132,
              border: `1.5px solid ${accent}`,
              borderRadius: 4,
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              background: '#ffffff',
              textAlign: 'center',
              fontSize: 10,
              color: '#64748b',
            }}
          >
            {photoSrc ? (
              <img src={photoSrc} alt={data.student_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ padding: 6 }}>Student Uniform Photo</div>
            )}
          </div>
        </div>
      );
    }

    if (key === 'regular_subjects') {
      if (!data.regular_subjects || data.regular_subjects.length === 0) return null;
      return (
        <div key={key} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: 'uppercase', marginBottom: 5 }}>
            Current / Regular Subjects
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: cfg.fontSize - 0.5 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ border: '1px solid #94a3b8', padding: '5px 8px', textAlign: 'left', width: '16%' }}>Code</th>
                <th style={{ border: '1px solid #94a3b8', padding: '5px 8px', textAlign: 'left' }}>Subject Name</th>
                <th style={{ border: '1px solid #94a3b8', padding: '5px 8px', textAlign: 'left', width: '14%' }}>Type</th>
                <th style={{ border: '1px solid #94a3b8', padding: '5px 8px', textAlign: 'left', width: '18%' }}>Exam Date</th>
                <th style={{ border: '1px solid #94a3b8', padding: '5px 8px', textAlign: 'left', width: '18%' }}>Invigilator Sign</th>
              </tr>
            </thead>
            <tbody>
              {data.regular_subjects.map((sub, i) => (
                <tr key={`${sub.code}-${i}`}>
                  <td style={{ border: '1px solid #94a3b8', padding: '5px 8px', fontFamily: 'monospace' }}>{sub.code}</td>
                  <td style={{ border: '1px solid #94a3b8', padding: '5px 8px', fontWeight: 600 }}>{sub.name}</td>
                  <td style={{ border: '1px solid #94a3b8', padding: '5px 8px' }}>{(sub.type || 'Theory').toUpperCase()}</td>
                  <td style={{ border: '1px solid #94a3b8', padding: '5px 8px', fontFamily: 'monospace' }}>{sub.exam_date || 'As per schedule'}</td>
                  <td style={{ border: '1px solid #94a3b8', padding: '5px 8px' }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (key === 'supplementary_subjects') {
      if (!data.supplementary_subjects || data.supplementary_subjects.length === 0) return null;
      return (
        <div key={key} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', marginBottom: 5 }}>
            Supplementary / Backlog Subjects
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: cfg.fontSize - 0.5 }}>
            <thead>
              <tr style={{ background: '#fef2f2' }}>
                <th style={{ border: '1px solid #94a3b8', padding: '5px 8px', textAlign: 'left', width: '16%' }}>Code</th>
                <th style={{ border: '1px solid #94a3b8', padding: '5px 8px', textAlign: 'left' }}>Subject Name</th>
                <th style={{ border: '1px solid #94a3b8', padding: '5px 8px', textAlign: 'left', width: '14%' }}>Type</th>
                <th style={{ border: '1px solid #94a3b8', padding: '5px 8px', textAlign: 'left', width: '18%' }}>Exam Date</th>
                <th style={{ border: '1px solid #94a3b8', padding: '5px 8px', textAlign: 'left', width: '18%' }}>Invigilator Sign</th>
              </tr>
            </thead>
            <tbody>
              {data.supplementary_subjects.map((sub, i) => (
                <tr key={`supp-${sub.code}-${i}`}>
                  <td style={{ border: '1px solid #94a3b8', padding: '5px 8px', fontFamily: 'monospace' }}>{sub.code}</td>
                  <td style={{ border: '1px solid #94a3b8', padding: '5px 8px', fontWeight: 600 }}>{sub.name}</td>
                  <td style={{ border: '1px solid #94a3b8', padding: '5px 8px' }}>{(sub.type || 'Supplementary').toUpperCase()}</td>
                  <td style={{ border: '1px solid #94a3b8', padding: '5px 8px', fontFamily: 'monospace' }}>{sub.exam_date || 'As per schedule'}</td>
                  <td style={{ border: '1px solid #94a3b8', padding: '5px 8px' }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (key === 'instructions') {
      return (
        <div key={key} style={{ marginBottom: 18, padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'rgba(248, 250, 252, 0.7)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: accent, textTransform: 'uppercase', marginBottom: 4 }}>
            Important Examination Instructions
          </div>
          <div style={{ fontSize: 11.2, lineHeight: 1.5, color: '#1e293b' }}>
            {instructionsList.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      );
    }

    if (key === 'signatures') {
      return (
        <div
          key={key}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            alignItems: 'end',
            marginTop: 22,
            paddingTop: 12,
            borderTop: '1px dashed #94a3b8',
            textAlign: 'center',
            fontSize: 11.5,
          }}
        >
          <div>
            <div style={{ height: 52 }} />
            <div style={{ borderTop: '1px solid #334155', paddingTop: 4, fontWeight: 600 }}>Signature of Student</div>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ height: 52, display: 'grid', placeItems: 'center' }}>
              {branding.college_stamp_data && (
                <img
                  src={branding.college_stamp_data}
                  alt="College Stamp"
                  style={{ maxHeight: 54, maxWidth: 110, objectFit: 'contain', mixBlendMode: 'multiply' }}
                />
              )}
            </div>
            <div style={{ borderTop: '1px solid #334155', paddingTop: 4, fontWeight: 600 }}>Controller of Examinations &amp; Stamp</div>
          </div>
          <div>
            <div style={{ height: 52, display: 'grid', placeItems: 'center' }}>
              {branding.principal_sign_data && (
                <img
                  src={branding.principal_sign_data}
                  alt="Principal Signature"
                  style={{ maxHeight: 48, maxWidth: 130, objectFit: 'contain', mixBlendMode: 'multiply' }}
                />
              )}
            </div>
            <div style={{ borderTop: '1px solid #334155', paddingTop: 4, fontWeight: 600 }}>Principal</div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className="hall-ticket-a4"
      style={{
        position: 'relative',
        background: '#ffffff',
        color: '#0f172a',
        border: borderCss,
        borderRadius: 6,
        padding: '20px 24px',
        maxWidth: 794,
        margin: '0 auto',
        overflow: 'hidden',
        boxShadow: '0 6px 24px rgba(15, 23, 42, 0.12)',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Faint Centered College Logo Watermark */}
      {cfg.showWatermark && branding.college_logo_data && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <img
            src={branding.college_logo_data}
            alt=""
            style={{ width: 320, maxWidth: '65%', opacity: cfg.watermarkOpacity ?? 0.08, objectFit: 'contain' }}
          />
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        {cfg.sections.filter((s) => s.enabled).length === 0 ? (
          <div style={{ minHeight: 420, display: 'grid', placeItems: 'center', border: '2px dashed #cbd5e1', borderRadius: 8, color: '#64748b', textAlign: 'center', padding: 24 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Blank Hall Ticket Page</div>
              <div style={{ fontSize: 13 }}>Select elements from the Requirements sidebar on the left to add them onto this A4 sheet, then reorder them in any layout you want.</div>
            </div>
          </div>
        ) : (
          cfg.sections.filter((s) => s.enabled).map((s) => renderSection(s.key))
        )}
      </div>
    </div>
  );
};
