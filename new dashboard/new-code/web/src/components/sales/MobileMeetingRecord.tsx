import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Building2,
  User,
  ClipboardList,
  Lightbulb,
  Target,
  FileText,
  Copy,
  Check,
  Mail,
  Phone,
  Video,
  MapPin,
  PhoneCall,
} from 'lucide-react';
import { formatDate, formatTime, type MeetingDetail } from '../../data/meetings';

/**
 * MobileMeetingRecord — the "mobile-ditto" meeting record screen (ALT-275).
 *
 * An exact-layout copy of the legacy mobile app's
 * src/screens/meetings/MeetingDetails.jsx, rendered for Sales-Portal and
 * client-portal users instead of the internal CRM record screens. One
 * scrollable column of cards in the mobile-authoritative order:
 *   1. Meeting summary
 *   2. Pre-Sales Questions
 *   3. Company details (accordion)
 *   4. Lead / Contact details (accordion)
 *   5. Agenda & Notes (accordion)
 *   6. Opportunity Details (accordion)
 *   7. Sales Intelligence (accordion)
 *
 * Most records are sparse (~79% of leads have NULL company_id) — every field
 * falls back to a muted "N/A" / "—", exactly as the mobile app does.
 */

/* ------------------------------------------------------------------ */
/* Status → label + colour (mirrors the mobile colorCode / label remap) */
/* ------------------------------------------------------------------ */

/** Remap the raw meeting status to the label the mobile app shows. */
function statusLabel(status: string): string {
  const s = status.trim();
  if (/^confirmed$/i.test(s)) return 'Scheduled';
  if (/^cancelled$/i.test(s)) return 'Dropped';
  return s || '—';
}

/** Colour for a status badge (mobile colorCode map). */
function statusColor(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === 'confirmed' || s === 'scheduled') return '#3B82F6'; // blue
  if (s === 'completed') return '#08CB00'; // green
  if (s === 'missed') return '#FCC02A'; // yellow
  if (s === 'cancelled' || s === 'dropped') return '#B72025'; // red
  if (s === 'rescheduled') return '#F57C1F'; // orange
  return '#6B7280'; // gray fallback
}

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */

const MUTED = '#9CA3AF';

/** Render a value, or a muted "N/A" when it is empty. */
function val(v: string | null | undefined): React.ReactNode {
  const t = (v ?? '').trim();
  if (!t) return <span style={{ color: MUTED }}>N/A</span>;
  return t;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PARTICIPANT_TINTS = [
  { bg: '#F9BBD2', fg: '#891951' },
  { bg: '#BEDEF5', fg: '#15499F' },
];

function ParticipantAvatar({ name, index }: { name: string; index: number }) {
  const tint = PARTICIPANT_TINTS[index % PARTICIPANT_TINTS.length];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: tint.bg,
        color: tint.fg,
        fontWeight: 600,
        fontSize: 11,
        marginLeft: index === 0 ? 0 : -6,
        border: '1.5px solid #fff',
        flexShrink: 0,
      }}
      title={name}
    >
      {(name.trim()[0] || '?').toUpperCase()}
    </span>
  );
}

/** A copy-to-clipboard inline icon button. */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value.trim()) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard may be unavailable — silently ignore */
        }
      }}
      title="Copy"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
        padding: 2,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: copied ? '#08CB00' : 'var(--color-brand)',
        verticalAlign: 'middle',
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

/** A labelled field (small uppercase label + value). */
function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, gridColumn: full ? '1 / -1' : undefined }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-gray-500)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-gray-900)', wordBreak: 'break-word' }}>{children}</span>
    </div>
  );
}

/** Accordion card with a coloured icon header and expand/collapse chevron. */
function AccordionCard({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '13px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <span style={{ color: 'var(--color-brand)', display: 'inline-flex' }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-gray-900)' }}>{title}</span>
        </span>
        <span style={{ color: 'var(--color-brand)', display: 'inline-flex' }}>
          {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 16px 18px', borderTop: '1px solid var(--color-gray-50)' }}>{children}</div>
      )}
    </div>
  );
}

/** Two-column responsive field grid. */
function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '14px 18px',
        marginTop: 8,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Action buttons (Lead card) — mailto / tel / mode-specific           */
/* ------------------------------------------------------------------ */

function ActionButton({
  icon,
  label,
  onClick,
  href,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    minWidth: 96,
    padding: '9px 12px',
    borderRadius: 8,
    background: disabled ? '#E5E7EB' : 'var(--color-brand)',
    color: disabled ? '#9CA3AF' : '#fff',
    fontSize: 12.5,
    fontWeight: 600,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    textDecoration: 'none',
  };
  if (href && !disabled) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={style}>
        {icon}
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} style={style}>
      {icon}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function MobileMeetingRecord({
  meeting: m,
  canSeeRecordings = false,
}: {
  meeting: MeetingDetail;
  /** Gate the Call Recording / View Image links to Sales Heads (+ internal staff),
   *  mirroring the mobile app's SALES_HEAD-only restriction. A Sales Person — or a
   *  client once the portal reuses this — must NOT see recordings. */
  canSeeRecordings?: boolean;
}) {
  const label = statusLabel(m.status);
  const color = statusColor(m.status);
  const isMissed = /^missed$/i.test(m.status.trim());
  const isCancelled = /^cancelled$/i.test(m.status.trim());

  // Salesperson display (strip the (SP)/(SH) suffix the internal list adds).
  const spName = m.salesperson.replace(/\s*\((SP|SH)\)\s*$/i, '').trim();

  // Pre-sales: split out the "Discussion" item (goes into Agenda & Notes).
  const discussion = m.preSales.find((p) => /^discussion$/i.test(p.question.trim()));
  const preSalesQuestions = m.preSales.filter((p) => !/^discussion$/i.test(p.question.trim()));

  // Date/time/duration display.
  const dateStr = m.meetingDate
    ? formatDateWithWeekday(m.meetingDate)
    : '';
  const timeStr = m.meetingTime ? formatTime(m.meetingTime) : '';

  // Lead action buttons by mode.
  const mode = m.mode.trim();
  const isOnline = /online/i.test(mode);
  const isOffline = /offline/i.test(mode);
  const isTelephonic = /tele/i.test(mode);

  const mapsHref = (() => {
    const full = [m.addressLine1, m.addressLine2, m.city].filter(Boolean).join(', ');
    return full ? `https://maps.google.com/?q=${encodeURIComponent(full)}` : '';
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
      {/* ───────────── 1. Meeting summary ───────────── */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: `1px solid ${color}`,
          borderRadius: 10,
          padding: 16,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* status badge (top-right) */}
        <span
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: color,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 12px',
            borderBottomLeftRadius: 10,
          }}
        >
          {label}
        </span>

        <div style={{ paddingRight: 80 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#282B30', wordBreak: 'break-word' }}>
            {m.company || m.leadName || m.name || '—'}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              borderBottom: '1px solid var(--color-gray-50)',
              paddingBottom: 6,
              marginTop: 2,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#4B5563', wordBreak: 'break-word' }}>
              {m.name || '—'}
            </span>
            {m.participants.length > 0 && (
              <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                {m.participants.slice(0, 4).map((p, i) => (
                  <ParticipantAvatar key={p.id} name={p.participant} index={i} />
                ))}
              </span>
            )}
          </div>
        </div>

        {/* SP + missed/cancelled note */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginTop: 10,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: '#3B82F6' }}>
            SP- {spName || 'N/A'}
          </span>
          {isMissed && (
            <span style={{ fontSize: 12, fontWeight: 500, color: '#F59E0B' }}>Feedback Is Pending</span>
          )}
          {isCancelled && (
            <span style={{ fontSize: 12, fontWeight: 500, color: '#B72025' }}>
              {m.reason || 'Meeting dropped by SH'}
            </span>
          )}
        </div>

        {/* date / time / mode */}
        <div style={{ marginTop: 8, color: '#282B30' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{dateStr || <span style={{ color: MUTED }}>N/A</span>}</div>
          <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            {timeStr || <span style={{ color: MUTED }}>N/A</span>}
            {m.duration && <span>({formatDuration(m.duration)})</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
            {mode ? `${mode} mode.` : <span style={{ color: MUTED }}>N/A</span>}
          </div>
        </div>
      </div>

      {/* ───────────── 2. Pre-Sales Questions ───────────── */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <span style={{ color: 'var(--color-brand)', display: 'inline-flex' }}>
            <ClipboardList size={18} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-gray-900)' }}>Pre-Sales Questions</span>
        </div>
        {preSalesQuestions.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>N/A</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {preSalesQuestions.map((q, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#4B5563' }}>
                  {i + 1}. {q.question || '—'}
                </span>
                <span style={{ fontSize: 13, color: '#282B30', wordBreak: 'break-word' }}>{val(q.answer)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ───────────── 3. Company details ───────────── */}
      <AccordionCard title="Company details" icon={<Building2 size={18} />} defaultOpen>
        <FieldGrid>
          <Field label="Name">{val(m.company)}</Field>
          <Field label="Turnover">{m.companyTurnover ? `Rs ${m.companyTurnover} Cr` : <span style={{ color: MUTED }}>N/A</span>}</Field>
          <Field label="Headquarters">{val(m.city)}</Field>
          <Field label="Industry">{val(m.industry)}</Field>
          <Field label="Employee">{val(m.companySize)}</Field>
          <Field label="Sector">{val(m.companySector)}</Field>
          <Field label="Website">{val(m.companyWebsite)}</Field>
          <Field label="LinkedIn">
            {m.companyLinkedin ? (
              <>
                {m.companyLinkedin}
                <CopyButton value={m.companyLinkedin} />
              </>
            ) : (
              <span style={{ color: MUTED }}>N/A</span>
            )}
          </Field>
          <Field label="Address" full>
            {m.addressLine1 || m.addressLine2
              ? [m.addressLine1, m.addressLine2].filter(Boolean).join(', ')
              : <span style={{ color: MUTED }}>N/A</span>}
          </Field>
        </FieldGrid>
        <div
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#4B5563',
            fontWeight: 500,
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid var(--color-gray-50)',
          }}
        >
          Meeting scheduled by, <span style={{ fontWeight: 700 }}>{m.scheduledByName || 'N/A'}</span>
        </div>
      </AccordionCard>

      {/* ───────────── 4. Lead / Contact details ───────────── */}
      <AccordionCard title="Lead Details" icon={<User size={18} />} defaultOpen>
        <FieldGrid>
          <Field label="Lead Name">{val(m.leadName)}</Field>
          <Field label="Mobile Number">
            {m.leadMobile ? (
              <>
                {m.leadMobile}
                <CopyButton value={m.leadMobile} />
              </>
            ) : (
              <span style={{ color: MUTED }}>N/A</span>
            )}
          </Field>
          <Field label="Alternate Mo. No.">
            {m.leadAltMobile ? (
              <>
                {m.leadAltMobile}
                <CopyButton value={m.leadAltMobile} />
              </>
            ) : (
              <span style={{ color: MUTED }}>N/A</span>
            )}
          </Field>
          <Field label="Designation">{val(m.leadDesignation)}</Field>
          <Field label="LinkedIn">
            {m.leadLinkedin ? (
              <>
                {m.leadLinkedin}
                <CopyButton value={m.leadLinkedin} />
              </>
            ) : (
              <span style={{ color: MUTED }}>N/A</span>
            )}
          </Field>
          <Field label="Email">{val(m.leadEmail)}</Field>
          <Field label="Roles & Responsibilities" full>
            {val(m.leadRoleAndResp)}
          </Field>
          <Field label="Area Of Interest" full>
            {val(m.leadAreaOfInterest)}
          </Field>
        </FieldGrid>

        {/* action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <ActionButton
            icon={<Mail size={14} />}
            label="E-mail"
            href={m.leadEmail ? `mailto:${m.leadEmail}` : undefined}
            disabled={!m.leadEmail}
          />
          <ActionButton
            icon={<Phone size={14} />}
            label="Call"
            href={m.leadMobile ? `tel:${m.leadMobile}` : undefined}
            disabled={!m.leadMobile}
          />
          {isOnline ? (
            <ActionButton
              icon={<Video size={14} />}
              label="Join"
              href={m.meetingUrl || undefined}
              disabled={!m.meetingUrl}
            />
          ) : isOffline ? (
            <ActionButton
              icon={<MapPin size={14} />}
              label="Location"
              href={mapsHref || undefined}
              disabled={!mapsHref}
            />
          ) : isTelephonic ? (
            <ActionButton
              icon={<PhoneCall size={14} />}
              label="Telephonic"
              href={m.meetingUrl ? maybeTel(m.meetingUrl) : (m.leadMobile ? `tel:${m.leadMobile}` : undefined)}
              disabled={!m.meetingUrl && !m.leadMobile}
            />
          ) : null}
        </div>
      </AccordionCard>

      {/* ───────────── 5. Agenda & Notes ───────────── */}
      <AccordionCard title="Agenda & Notes" icon={<FileText size={18} />}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#282B30', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
          {val(m.description)}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4B5563', marginTop: 10 }}>Discussion -</div>
        <div style={{ fontSize: 12.5, color: '#282B30', whiteSpace: 'pre-line', wordBreak: 'break-word', marginTop: 2 }}>
          {val(discussion?.answer)}
        </div>

        {canSeeRecordings && (m.callRecording || m.sharePointUrl) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {m.callRecording && (
              <a
                href={m.callRecording}
                target="_blank"
                rel="noopener noreferrer"
                style={linkBtnStyle('outline')}
              >
                Call Recording
              </a>
            )}
            {m.sharePointUrl && (
              <a
                href={m.sharePointUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={linkBtnStyle('solid')}
              >
                View Image
              </a>
            )}
          </div>
        )}
      </AccordionCard>

      {/* ───────────── 6. Opportunity Details ───────────── */}
      <AccordionCard title="Opportunity Details" icon={<Lightbulb size={18} />}>
        <FieldGrid>
          <Field label="Title">{val(m.oppTitle)}</Field>
          <Field label="Value">{m.oppValue ? `Rs. ${m.oppValue}` : <span style={{ color: MUTED }}>N/A</span>}</Field>
          <Field label="Description" full>
            <span style={{ whiteSpace: 'pre-line' }}>{val(m.oppDescription)}</span>
          </Field>
        </FieldGrid>
      </AccordionCard>

      {/* ───────────── 7. Sales Intelligence ───────────── */}
      <AccordionCard title="Sales Intelligence" icon={<Target size={18} />}>
        {m.salesIntelligence.trim() ? (
          m.salesIntelligence.includes('\n') ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#282B30', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {m.salesIntelligence
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <li key={i} style={{ wordBreak: 'break-word' }}>{line}</li>
                ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: '#282B30', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
              {m.salesIntelligence}
            </p>
          )
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>N/A</p>
        )}
      </AccordionCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Local helpers                                                       */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2025-06-21' -> 'Wed, 21 Jun, 2025'. Falls back to formatDate on failure. */
function formatDateWithWeekday(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return formatDate(d);
  // Construct as UTC to avoid TZ drift on the weekday.
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const wd = WEEKDAYS[dt.getUTCDay()] ?? '';
  const mon = MONTHS_SHORT[Number(m[2]) - 1] ?? m[2];
  // Mobile-authoritative format: "Wed, 21 Jun, 2025".
  return `${wd ? wd + ', ' : ''}${m[3]} ${mon}, ${m[1]}`;
}

/** Format a duration string like '00:30' -> '30 min', '01:30' -> '1:30 hr'. */
function formatDuration(duration: string): string {
  const d = duration.trim();
  if (d.includes(':')) {
    const [h, mm] = d.split(':').map((x) => Number(x));
    if (!Number.isNaN(h) && !Number.isNaN(mm)) {
      if (h === 0) return `${mm} min`;
      return `${h}:${String(mm).padStart(2, '0')} hr`;
    }
    return `${d} hr`;
  }
  const mins = Number(d);
  if (!Number.isNaN(mins)) return mins >= 60 ? `${mins} hr` : `${mins} min`;
  return d;
}

/** If the meetingUrl is a bare phone number, make it a tel: link; else use as-is. */
function maybeTel(url: string): string {
  const cleaned = url.replace(/[+\s]/g, '');
  if (/^\d+$/.test(cleaned)) return `tel:${url}`;
  return url;
}

function linkBtnStyle(kind: 'solid' | 'outline'): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    textDecoration: 'none',
    background: kind === 'solid' ? 'var(--color-brand)' : '#fff',
    color: kind === 'solid' ? '#fff' : 'var(--color-brand)',
    border: kind === 'solid' ? 'none' : '1px solid var(--color-brand)',
  };
}

export default MobileMeetingRecord;
