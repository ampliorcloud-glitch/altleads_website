/**
 * Client Portal — MEETING DETAIL PAGE (NET-NEW; ALT-234 / ALT-237).
 *
 * Requires the portal schema applied to the DB AND added to Supabase API exposed
 * schemas; inert until then. (Until `portal` is applied + exposed, the fetchers in
 * ../data/portal resolve to an error/empty and this page degrades to its error state.)
 *
 * DATA ISOLATION (non-negotiable): this page reads ONLY through the portal data layer
 * (../data/portal), which queries the `portal` schema's SECURITY-INVOKER snapshot views.
 * It NEVER imports or reuses any CRM page or CRM data module (LeadsPage / LeadDetailPage /
 * data/realLeads / data/leadWorkspace / data/companies, etc.) — those read the LIVE shared
 * tables and would leak one client's work to another on a shared company. Every field shown
 * here is the per-meeting snapshot, scoped to the caller's tenant by the portal RLS policies.
 *
 * Feedback gate (load-bearing): the feedback form is ENABLED only once the meeting has
 * STARTED (snapshot started_at <= now()), using the SAME rule (isMeetingStarted) that
 * submitFeedback re-checks server-side. Before then the section shows
 * "Feedback opens once the meeting starts." and submit is blocked.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  fetchPortalMeetingById,
  submitFeedback,
  isMeetingStarted,
  type PortalMeetingDetail,
  type PortalPreSalesQA,
} from '../data/portal';
import { Skeleton, SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

// ───────────────────────────── small presentational helpers ─────────────────────────────

const PAGE: React.CSSProperties = {
  maxWidth: 880,
  margin: '0 auto',
  padding: '24px 20px 64px',
};

const CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '20px 22px',
  marginBottom: 20,
};

const SECTION_TITLE: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 15,
  fontWeight: 700,
  color: '#111827',
};

const LABEL: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: '#6b7280',
  marginBottom: 2,
};

const VALUE: React.CSSProperties = {
  fontSize: 14,
  color: '#111827',
  wordBreak: 'break-word',
};

const EMPTY = '—';

/** A single read-only label/value pair. Falls back to an em-dash when empty. */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const text = value != null && value.trim() !== '' ? value : EMPTY;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={LABEL}>{label}</div>
      <div style={VALUE}>{text}</div>
    </div>
  );
}

/** A responsive 2-column grid of read-only fields. */
function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px 24px',
      }}
    >
      {children}
    </div>
  );
}

/** A read-only card section with a heading. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={CARD}>
      <h2 style={SECTION_TITLE}>{title}</h2>
      {children}
    </section>
  );
}

/** Status pill — neutral styling (no live-data coupling, just a label). */
function StatusPill({ status }: { status: string | null }) {
  const label = status && status.trim() !== '' ? status : 'Unknown';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        fontSize: 12,
        fontWeight: 600,
        color: '#1f2937',
        background: '#f3f4f6',
        border: '1px solid #e5e7eb',
        borderRadius: 999,
      }}
    >
      {label}
    </span>
  );
}

/** Compose the meeting date + time into one readable line. */
function meetingWhen(m: PortalMeetingDetail): string {
  const parts = [m.meeting_date, m.meeting_time].filter(
    (p): p is string => p != null && p.trim() !== '',
  );
  return parts.length ? parts.join(' · ') : EMPTY;
}

// ───────────────────────────── feedback section ─────────────────────────────

function FeedbackSection({
  meetingId,
  startedAt,
}: {
  meetingId: number;
  startedAt: string | null;
}) {
  const toast = useToast();
  const started = isMeetingStarted(startedAt);

  const [remark, setRemark] = useState('');
  const [outcome, setOutcome] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;

      // Mirror the data layer's gate so the UI never even attempts a blocked write.
      if (!isMeetingStarted(startedAt)) {
        toast.error('Feedback becomes available once the meeting starts.');
        return;
      }
      const trimmed = remark.trim();
      if (!trimmed) {
        toast.error('Please enter your feedback before submitting.');
        return;
      }

      setSubmitting(true);
      const result = await submitFeedback({
        meeting_id: meetingId,
        remark: trimmed,
        outcome: outcome.trim() === '' ? null : outcome.trim(),
      });
      setSubmitting(false);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Feedback submitted. Thank you.');
      setRemark('');
      setOutcome('');
    },
    [submitting, startedAt, remark, outcome, meetingId, toast],
  );

  if (!started) {
    return (
      <Section title="Feedback">
        <div
          role="status"
          style={{
            padding: '14px 16px',
            fontSize: 14,
            color: '#6b7280',
            background: '#f9fafb',
            border: '1px dashed #e5e7eb',
            borderRadius: 8,
          }}
        >
          Feedback opens once the meeting starts.
        </div>
      </Section>
    );
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    outline: 'none',
  };

  return (
    <Section title="Feedback">
      <form onSubmit={handleSubmit}>
        <label
          htmlFor="portal-feedback-outcome"
          style={{ display: 'block', ...LABEL, marginBottom: 6 }}
        >
          Outcome (optional)
        </label>
        <select
          id="portal-feedback-outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          disabled={submitting}
          style={{ ...fieldStyle, marginBottom: 16 }}
        >
          <option value="">Select an outcome…</option>
          <option value="interested">Interested</option>
          <option value="follow_up">Needs follow-up</option>
          <option value="not_interested">Not interested</option>
        </select>

        <label
          htmlFor="portal-feedback-remark"
          style={{ display: 'block', ...LABEL, marginBottom: 6 }}
        >
          Your feedback
        </label>
        <textarea
          id="portal-feedback-remark"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          disabled={submitting}
          rows={5}
          placeholder="What happened in the meeting?"
          style={{ ...fieldStyle, marginBottom: 16, resize: 'vertical', minHeight: 96 }}
        />

        <button
          type="submit"
          disabled={submitting || remark.trim() === ''}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background: '#1A7EE8',
            border: 'none',
            borderRadius: 8,
            cursor: submitting || remark.trim() === '' ? 'not-allowed' : 'pointer',
            opacity: submitting || remark.trim() === '' ? 0.6 : 1,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit feedback'}
        </button>
      </form>
    </Section>
  );
}

// ───────────────────────────── pre-sales Q&A ─────────────────────────────

function PreSalesQA({ items }: { items: PortalPreSalesQA[] | null }) {
  const list = (items ?? []).filter(
    (qa) =>
      (qa.question != null && qa.question.trim() !== '') ||
      (qa.short_question != null && qa.short_question.trim() !== '') ||
      (qa.answer != null && qa.answer.trim() !== ''),
  );
  if (list.length === 0) return null;

  return (
    <Section title="Pre-sales Q&A">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {list.map((qa, i) => {
          const q =
            (qa.short_question != null && qa.short_question.trim() !== ''
              ? qa.short_question
              : qa.question) ?? EMPTY;
          const a = qa.answer != null && qa.answer.trim() !== '' ? qa.answer : EMPTY;
          return (
            <div key={i}>
              <div style={{ ...LABEL, marginBottom: 4 }}>{q}</div>
              <div style={VALUE}>{a}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ───────────────────────────── loading / error / empty states ─────────────────────────────

function LoadingState() {
  return (
    <div style={PAGE} role="status" aria-busy="true" aria-label="Loading meeting">
      <Skeleton height={18} width={140} radius={4} style={{ marginBottom: 20 }} />
      <div style={CARD}>
        <Skeleton height={20} width="55%" radius={4} style={{ marginBottom: 12 }} />
        <SkeletonText lines={2} />
      </div>
      <div style={CARD}>
        <Skeleton height={16} width="35%" radius={4} style={{ marginBottom: 14 }} />
        <SkeletonText lines={4} />
      </div>
      <div style={CARD}>
        <Skeleton height={16} width="35%" radius={4} style={{ marginBottom: 14 }} />
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}

function NoticeCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div style={PAGE}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/portal/meetings" style={{ fontSize: 13, color: '#1A7EE8', textDecoration: 'none' }}>
          ← Back to meetings
        </Link>
      </div>
      <div
        role="alert"
        style={{
          ...CARD,
          marginBottom: 0,
          textAlign: 'center',
          color: '#6b7280',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 14 }}>{message}</div>
      </div>
    </div>
  );
}

// ───────────────────────────── page ─────────────────────────────

export function PortalMeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const meetingId = id != null ? Number(id) : NaN;
  const validId = Number.isInteger(meetingId) && meetingId > 0;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meeting, setMeeting] = useState<PortalMeetingDetail | null>(null);

  useEffect(() => {
    if (!validId) {
      setLoading(false);
      setError(null);
      setMeeting(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const result = await fetchPortalMeetingById(meetingId);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setMeeting(null);
      } else {
        setMeeting(result.data);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [meetingId, validId]);

  if (!validId) {
    return (
      <NoticeCard
        title="Meeting not found"
        message="That meeting link doesn't look right. Please go back and pick a meeting from the list."
      />
    );
  }

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <NoticeCard
        title="Couldn't load this meeting"
        message={error}
      />
    );
  }

  if (!meeting) {
    return (
      <NoticeCard
        title="Meeting not available"
        message="This meeting isn't available to you, or it no longer exists."
      />
    );
  }

  const m = meeting;
  const heading =
    (m.meeting_name != null && m.meeting_name.trim() !== ''
      ? m.meeting_name
      : m.company_name) ?? 'Meeting';

  return (
    <div style={PAGE}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/portal/meetings" style={{ fontSize: 13, color: '#1A7EE8', textDecoration: 'none' }}>
          ← Back to meetings
        </Link>
      </div>

      {/* Header card */}
      <section style={CARD}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#111827', wordBreak: 'break-word' }}>
              {heading}
            </h1>
            <div style={{ fontSize: 14, color: '#6b7280' }}>{meetingWhen(m)}</div>
          </div>
          <StatusPill status={m.meeting_status} />
        </div>
        <div style={{ height: 16 }} />
        <FieldGrid>
          <Field label="Mode" value={m.meeting_mode} />
          <Field label="Duration" value={m.meeting_duration} />
          <Field label="Assigned rep" value={m.assigned_rep_name} />
          <Field label="Scheduled by" value={m.scheduled_by_name} />
        </FieldGrid>
        {(m.meeting_description != null && m.meeting_description.trim() !== '') ||
        (m.agenda_discussion != null && m.agenda_discussion.trim() !== '') ? (
          <div style={{ marginTop: 16 }}>
            <FieldGrid>
              <Field label="Agenda / description" value={m.meeting_description} />
              <Field label="Discussion" value={m.agenda_discussion} />
            </FieldGrid>
          </div>
        ) : null}
      </section>

      {/* Company */}
      <Section title="Company">
        <FieldGrid>
          <Field label="Company" value={m.company_name} />
          <Field label="Industry" value={m.company_industry} />
          <Field label="Sector" value={m.company_sector} />
          <Field label="Headquarters" value={m.company_city} />
          <Field label="Turnover" value={m.company_turnover} />
          <Field label="Employees" value={m.company_size} />
          <Field label="Website" value={m.company_web_url} />
          <Field label="LinkedIn" value={m.company_linkedin_url} />
        </FieldGrid>
      </Section>

      {/* Address */}
      <Section title="Address">
        <FieldGrid>
          <Field label="Address line 1" value={m.address_line_one} />
          <Field label="Address line 2" value={m.address_line_two} />
          <Field label="City" value={m.address_city} />
          <Field label="State" value={m.address_state} />
          <Field label="Country" value={m.address_country} />
        </FieldGrid>
      </Section>

      {/* Lead / contact */}
      <Section title="Lead / contact">
        <FieldGrid>
          <Field label="Name" value={m.lead_name} />
          <Field label="Designation" value={m.lead_designation} />
          <Field label="Email" value={m.lead_email} />
          <Field label="Mobile" value={m.lead_mobile_no} />
          <Field label="Alt. mobile" value={m.lead_alt_mobile_no} />
          <Field label="LinkedIn" value={m.lead_linkedin_url} />
          <Field label="Role & responsibilities" value={m.lead_role_and_resp} />
          <Field label="Area of interest" value={m.lead_area_of_interest} />
        </FieldGrid>
      </Section>

      {/* Opportunity */}
      <Section title="Opportunity">
        <FieldGrid>
          <Field label="Title" value={m.opportunity_title} />
          <Field label="Value" value={m.opportunity_value} />
          <Field label="Description" value={m.opportunity_description} />
          <Field label="Sales intelligence" value={m.sales_intelligence} />
        </FieldGrid>
      </Section>

      {/* Pre-sales Q&A (only when present) */}
      <PreSalesQA items={m.pre_sales_qa} />

      {/* Feedback — gated on started_at <= now() */}
      <FeedbackSection meetingId={m.meeting_id} startedAt={m.started_at} />
    </div>
  );
}
