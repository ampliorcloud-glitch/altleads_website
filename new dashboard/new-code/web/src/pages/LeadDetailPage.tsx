import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  ChevronRight,
  AlertCircle,
  Building2,
  MapPin,
  Award,
  CheckCircle2,
  PhoneCall,
  PhoneOutgoing,
  CalendarPlus,
  ListPlus,
  UserCheck,
  Mail,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '../lib/zenAnimations';
import { AppShell } from '../components/layout/AppShell';
import { StageBadge } from '../components/ui/Badge';
import { CopyButton } from '../components/ui/CopyButton';
import { CreateTaskModal, type TaskAssociation } from '../components/tasks/CreateTaskModal';
import { LogDispositionModal } from '../components/calls/LogDispositionModal';
import { ComposeEmailModal } from '../components/email/ComposeEmailModal';
import { EmailActivityPanel } from '../components/email/EmailActivityPanel';
import { CallLogPreview } from '../components/calls/CallLogPreview';
import { RecordActivityHub } from '../components/tasks/RecordActivityHub';
import type { TaskType } from '../data/tasks';
import {
  fetchLeadDetail,
  fetchLookups,
  updateLeadStage,
  type LeadDetail,
  type LookupOption,
} from '../lib/leadsApi';
import { isConflict, CONFLICT_MESSAGE } from '../lib/concurrency';
import {
  fetchCompanyInfo,
  clinchLead,
  initials,
  type CompanyInfo,
} from '../data/leadWorkspace';
import { ReassignModal } from '../components/common/ReassignModal';
import { reassignLead, fetchAssignableUsers } from '../data/assignment';
import { humanizeWriteError } from '../lib/writeError';
import type { UserOption } from '../data/wishlist';
import { LeadInfoPanel } from '../components/lead/LeadInfoPanel';
import { ActivityTab } from '../components/lead/ActivityTab';
import { ReportTab } from '../components/lead/ReportTab';
import { MeetingTab } from '../components/lead/MeetingTab';
import { useAuth } from '../contexts/AuthContext';
import { useIsSalesShell } from '../contexts/SalesShellContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { pushRecent } from '../lib/useRecentlyViewed';
// roleGating: STRICT_ROLE_GATING guards the agent edit-scope rule (ALT-458).
// When true, the stage selector + report tab writes are additionally scoped to
// stage_id >= 4 for AGENT role. RLS (apply-access-control-rls.cjs) enforces this
// server-side; the UI just surfaces a cleaner experience when the flag is on.
// The canReassign flag already excludes QC (Part 9 / ALT-459).
import { gated, agentCanEditLeadReport } from '../lib/roleGating';
import { isForeignRecord, maskContact } from '../lib/safeView';
import { COLLAB_ASSOC } from '../lib/collabAssoc';
import { CollaboratorsCard } from '../components/collab/CollaboratorsCard';
import { AssociationsPanel } from '../components/collab/AssociationsPanel';
import { LEAD_STATE_V2 } from '../lib/leadStateFlag';
import { QualificationCard } from '../components/leadstate/QualificationCard';
import { STREAM_V1 } from '../lib/streamFlag';
import { StreamPanel } from '../components/stream/StreamPanel';
import { RESCHEDULE_INSIGHT } from '../lib/rescheduleFlag';
import { RescheduleInsight } from '../components/leadstate/RescheduleInsight';
import { FRESHNESS_INSIGHT } from '../lib/freshnessFlag';
import { LeadFreshnessInsight } from '../components/leadstate/LeadFreshnessInsight';
import type { SearchSelectOption } from '../components/ui/SearchSelect';
import type { RecordType } from '../lib/collabAssoc';
import { fetchAllContacts, fetchCompanyOptions } from '../data/contacts';

/* ── Progress stepper: Pre-Sales → Meeting → Closing ─────────────────────── */

const PRESALES_STAGES = new Set(['Warm', 'Hot Prospect', 'New Meeting']);
const CLOSED_STAGES = new Set(['Meeting Successful']);

function phaseFor(stage: string, isClosed: boolean): 0 | 1 | 2 {
  if (isClosed || CLOSED_STAGES.has(stage)) return 2;
  if (!stage || PRESALES_STAGES.has(stage)) return 0;
  return 1; // any "Meeting *" stage
}

/**
 * Three-step progress stepper matching Figma frames 012 / 003:
 * full-width steps, check-circle markers, hairline connector lines, and a
 * brand-blue underline beneath every completed/active step.
 */
function ProgressStepper({ stage, isClosed }: { stage: string; isClosed: boolean }) {
  const phase = phaseFor(stage, isClosed);
  const steps = ['Pre-Sales', 'Meeting', 'Closing'];
  return (
    <div className="flex items-stretch w-full">
      {steps.map((label, i) => {
        const active = i <= phase;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center" style={{ flex: '0 0 auto' }}>
              <div className="flex items-center justify-center gap-2" style={{ height: 28 }}>
                <CheckCircle2
                  size={17}
                  strokeWidth={2}
                  color={active ? 'var(--color-brand)' : '#9CA3AF'}
                  fill={active ? 'rgba(196,149,106,0.10)' : 'transparent'}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--color-gray-900)' : '#9CA3AF',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              </div>
              <span
                style={{
                  marginTop: 8,
                  width: '100%',
                  height: 3,
                  borderRadius: 2,
                  background: active ? 'var(--color-brand)' : 'transparent',
                }}
              />
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                style={{
                  flex: 1,
                  alignSelf: 'center',
                  marginTop: -11,
                  height: 1,
                  background: 'var(--border-color)',
                  minWidth: 24,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Header stage selector ───────────────────────────────────────────────── */

function StageSelect({
  currentStageId,
  stages,
  disabled,
  saving,
  onChange,
}: {
  currentStageId: number | null;
  stages: LookupOption[];
  disabled: boolean;
  saving: boolean;
  onChange: (id: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={currentStageId ?? ''}
        onChange={(e) => e.target.value && onChange(Number(e.target.value))}
        disabled={disabled || saving}
        style={{
          fontSize: 12,
          padding: '4px 8px',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-btn)',
          background: 'var(--color-surface)',
          color: 'var(--color-gray-900)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          height: 30,
        }}
      >
        <option value="">Select stage</option>
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      {saving && <Loader2 size={13} className="animate-spin text-stone-400" />}
    </div>
  );
}

/* ── Tabs ────────────────────────────────────────────────────────────────── */

type TabKey = 'activity' | 'report' | 'meeting';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'activity', label: 'Activity' },
  { key: 'report', label: 'Lead Report' },
  { key: 'meeting', label: 'Meeting' },
];

/* ── One-click task actions (schedule a follow-up tied to this lead) ──────── */

/**
 * QuickTaskActions — one-click buttons that open the shared CreateTaskModal
 * (Call back / Schedule meeting / Add task — SCHEDULING) plus a "Log call" button
 * that opens LogDispositionModal (RECORD a call that already happened — ALT-269).
 * Writes to the live `interaction` table via DispositionForm / logDisposition().
 * LogCallModal / logCall() was removed: call_log table was never migrated to prod.
 */
function QuickTaskActions({
  association,
  leadId,
  ownerUserId,
  actorId,
  recordName,
  onCallLogged,
  email,
  projectId,
  onEmailSent,
}: {
  association: TaskAssociation;
  /** Lead id used as the record_id for the interaction row. */
  leadId: number;
  ownerUserId: number | null;
  actorId: string | null;
  recordName: string;
  onCallLogged?: () => void;
  /** Lead's email — enables the "Send email" quick action (ALT-503). */
  email?: string | null;
  projectId?: number | null;
  onEmailSent?: () => void;
}) {
  const [modal, setModal] = useState<{ type: TaskType; subject: string } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const name = recordName || 'this record';
  const variants: {
    key: string;
    label: string;
    icon: React.ReactNode;
    type: TaskType;
    subject: string;
  }[] = [
    { key: 'call', label: 'Call back', icon: <PhoneCall size={13} />, type: 'CALL', subject: `Call back — ${name}` },
    { key: 'meeting', label: 'Schedule meeting', icon: <CalendarPlus size={13} />, type: 'MEETING', subject: `Meeting — ${name}` },
    { key: 'task', label: 'Add task', icon: <ListPlus size={13} />, type: 'TODO', subject: '' },
  ];

  const btnStyle: React.CSSProperties = {
    fontSize: 12,
    padding: '5px 11px',
    height: 30,
    borderRadius: 'var(--radius-btn)',
    border: '1px solid var(--border-color)',
    background: 'var(--color-surface)',
    color: 'var(--color-gray-900)',
    cursor: 'pointer',
  };
  const onEnter = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)';
    (e.currentTarget as HTMLElement).style.color = 'var(--color-brand)';
  };
  const onLeave = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
    (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-900)';
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {variants.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setModal({ type: v.type, subject: v.subject })}
            className="inline-flex items-center gap-1.5 font-medium transition-colors"
            style={btnStyle}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            title={`${v.label} (creates a task tied to ${name})`}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="inline-flex items-center gap-1.5 font-medium transition-colors"
          style={btnStyle}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          title={`Log a call that already happened with ${name}`}
        >
          <PhoneOutgoing size={13} />
          Log call
        </button>
        {email ? (
          <button
            type="button"
            onClick={() => setEmailOpen(true)}
            className="inline-flex items-center gap-1.5 font-medium transition-colors"
            style={btnStyle}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            title={`Send an email to ${name} as yourself (logged on the record)`}
          >
            <Mail size={13} />
            Send email
          </button>
        ) : null}
      </div>

      <CreateTaskModal
        open={modal !== null}
        onClose={() => setModal(null)}
        association={association}
        initialType={modal?.type}
        initialSubject={modal?.subject}
      />

      <LogDispositionModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        recordType="lead"
        recordId={leadId}
        projectId={null}
        ownerUserId={ownerUserId}
        actorId={actorId}
        onLogged={onCallLogged}
      />

      <ComposeEmailModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        to={email ?? ''}
        projectId={projectId ?? null}
        leadId={leadId}
        recordName={recordName}
        onSent={onEmailSent}
      />
    </>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, canReassign, isAgent, isQC, isAdmin, isTeamLead, isSalesUser } = useAuth();
  // When reused inside the Sales Portal, keep "back to Leads" within /sales/*.
  const isSalesShell = useIsSalesShell();
  const confirm = useConfirm();
  const toast = useToast();
  const leadsBase = isSalesShell ? '/sales' : '/leads';
  const leadId = Number(id);

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [stages, setStages] = useState<LookupOption[]>([]);

  const [loadingLead, setLoadingLead] = useState(true);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [leadError, setLeadError] = useState('');

  const [tab, setTab] = useState<TabKey>(() => {
    // ALT-UX-10: persist active tab across reloads. Key is per-record so navigating
    // between leads restores each one's last-viewed tab independently.
    try {
      const stored = localStorage.getItem(`altleads:tab:lead:${id}`);
      const VALID: TabKey[] = ['activity', 'report', 'meeting'];
      if (stored && (VALID as string[]).includes(stored)) return stored as TabKey;
    } catch { /* localStorage unavailable */ }
    return 'activity';
  });
  const [stageSaving, setStageSaving] = useState(false);
  const [clinching, setClinching] = useState(false);
  // Bumped after a call is logged so the call-history card re-fetches (ALT-269).
  const [callsRefresh, setCallsRefresh] = useState(0);
  const [emailsRefresh, setEmailsRefresh] = useState(0);

  // COLLAB_ASSOC: user + target-record options for the collab/association cards.
  const [collabUserOptions, setCollabUserOptions] = useState<SearchSelectOption[]>([]);
  const [collabTargetOptions, setCollabTargetOptions] = useState<Record<RecordType, SearchSelectOption[]>>({
    lead: [], contact: [], company: [], meeting: [],
  });

  // Reassign / change-salesperson (ALT-288).
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignOwners, setReassignOwners] = useState<UserOption[]>([]);

  // lead_master.created_by / lead_report audit fields MUST be the numeric user_id
  // (ownership / RLS keys on created_by = user_id). NEVER fall back to full_name or
  // email — a name can't resolve to a user and corrupts ownership (see lead_id=1).
  // When the profile isn't loaded yet, actor is '' and write actions are blocked.
  const actor = profile?.user_id != null ? String(profile.user_id) : '';
  const hasActor = actor !== '';

  const loadLead = useCallback(async () => {
    if (!leadId) {
      setLeadError('Lead not found.');
      setLoadingLead(false);
      setLoadingCompany(false);
      return;
    }
    setLoadingLead(true);
    setLeadError('');
    try {
      const [leadData, lookupData] = await Promise.all([fetchLeadDetail(leadId), fetchLookups()]);
      if (!leadData) {
        setLeadError('Lead not found.');
        setLoadingLead(false);
        return;
      }
      setLead(leadData);
      setStages(lookupData.stages);
      setLoadingLead(false);

      // company (drives the domain for pre-sales questions too)
      setLoadingCompany(true);
      const co = await fetchCompanyInfo(leadData.client_assoc_id);
      setCompany(co);
      setLoadingCompany(false);
    } catch {
      setLeadError('Could not load this lead. Please retry.');
      setLoadingLead(false);
      setLoadingCompany(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadLead();
  }, [loadLead, location.key]);

  // Record this lead in "recently viewed" once it loads.
  useEffect(() => {
    if (!lead) return;
    const label = (company?.client_name || lead.company_name || lead.lead_name || '').trim();
    if (!label) return;
    pushRecent(
      { type: 'lead', id: String(lead.lead_id), label, route: `/leads/${lead.lead_id}` },
      profile?.user_id,
    );
  }, [lead, company, profile?.user_id]);

  // Lightweight refresh of just the lead row (header/stage) after a tab action.
  const refreshLead = useCallback(async () => {
    const leadData = await fetchLeadDetail(leadId);
    if (leadData) setLead(leadData);
  }, [leadId]);

  const handleStageChange = async (stageId: number) => {
    if (!lead?.report_id || !hasActor) return;
    setStageSaving(true);
    // Pass the lead_report's updated_date as the optimistic-concurrency guard
    // (ALT-430). The lead detail page fetches lead_master; the report's updated_date
    // isn't surfaced separately here — we use the lead's own updated_date as a proxy.
    // When CONCURRENCY_GUARD is false this arg is ignored, so there is no behaviour change.
    const res = await updateLeadStage(lead.report_id, stageId, actor, lead.updated_date ?? undefined);
    setStageSaving(false);
    if (isConflict(res)) {
      toast.error(CONFLICT_MESSAGE);
      // Refresh the detail to show the latest data.
      refreshLead();
    } else if (!res?.error) {
      const found = stages.find((s) => s.id === stageId);
      setLead((prev) => (prev ? { ...prev, stage_id: stageId, stage_name: found?.label ?? prev.stage_name } : prev));
    } else {
      // Don't swallow the failure — the dropdown would silently snap back with no
      // explanation (the trust-killer this whole pass is about). Surface it.
      toast.error(humanizeWriteError(res.error) || 'Could not update the stage. Please try again.');
    }
  };

  const handleClinch = async () => {
    if (!lead || !hasActor) return;
    const ok = await confirm({
      title: 'Clinch this lead?',
      message: 'This marks the meeting successful and closes the lead. You can still view it, but its stage will be locked.',
      confirmLabel: 'Clinch & close',
    });
    if (!ok) return;
    setClinching(true);
    const res = await clinchLead(lead.lead_id, actor);
    setClinching(false);
    if (!res?.error) {
      setLead((prev) => (prev ? { ...prev, is_closed: true } : prev));
      toast.success('Lead clinched — meeting marked successful');
    } else {
      toast.error(humanizeWriteError(res?.error) || 'Could not clinch the lead. Please try again.');
    }
  };

  const openReassign = async () => {
    setReassignError(null);
    setReassignOwners([]);
    setShowReassign(true);
    const owners = await fetchAssignableUsers(lead?.salesperson_user_id ?? null);
    setReassignOwners(owners);
  };

  const handleReassign = async (newUserId: number) => {
    if (!lead || !hasActor) return;
    setReassignSaving(true);
    setReassignError(null);
    const res = await reassignLead({
      leadId: lead.lead_id,
      newUserId,
      actor,
      leadName: company?.client_name || lead.company_name || lead.lead_name,
      company: company?.client_name || lead.company_name || undefined,
      isReassign: lead.salesperson_user_id != null,
    });
    setReassignSaving(false);
    if (res?.error) {
      setReassignError(humanizeWriteError(res.error));
      return;
    }
    setShowReassign(false);
    toast.success('Lead reassigned — the new salesperson has been notified');
    await refreshLead();
  };

  // COLLAB_ASSOC: load user options + target options once the flag is enabled.
  useEffect(() => {
    if (!COLLAB_ASSOC) return;
    let cancelled = false;
    (async () => {
      const [users, contacts, companies] = await Promise.all([
        fetchAssignableUsers(null),
        fetchAllContacts(),
        fetchCompanyOptions(),
      ]);
      if (cancelled) return;
      setCollabUserOptions(users.map((u) => ({ id: u.id, label: u.label })));
      setCollabTargetOptions({
        lead: [],
        contact: contacts.contacts.map((c) => ({ id: c.contact_id, label: c.full_name })),
        company: companies.map((c) => ({ id: c.company_id, label: c.company_name })),
        meeting: [],
      });
    })();
    return () => { cancelled = true; };
  }, []);

  if (loadingLead) {
    return (
      <AppShell title="Lead Detail">
        <div className="flex items-center justify-center h-64 gap-2 text-stone-400">
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 14 }}>Loading lead...</span>
        </div>
      </AppShell>
    );
  }

  if (leadError || !lead) {
    return (
      <AppShell title="Lead Detail">
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-stone-400">
          <AlertCircle size={24} />
          <p style={{ fontSize: 14 }}>{leadError || 'Lead not found.'}</p>
          <button
            onClick={() => navigate(leadsBase)}
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            style={{ fontSize: 13 }}
          >
            Back to Leads
          </button>
        </div>
      </AppShell>
    );
  }

  const canClinch = lead.stage_name === 'Meeting Successful' && !lead.is_closed && hasActor;
  const companyLocation = company?.location || lead.city_name;

  return (
    <AppShell title="Lead Detail">
      <motion.div
        className="space-y-4 max-w-[1400px]"
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransitionConfig}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-stone-400" style={{ fontSize: 12 }}>
          <button
            onClick={() => navigate(leadsBase)}
            className="flex items-center gap-1 hover:text-stone-700 transition-colors"
          >
            <ArrowLeft size={13} />
            Leads
          </button>
          <ChevronRight size={11} />
          <span className="text-stone-600">{lead.lead_name}</span>
        </div>

        {/* Header */}
        <div className="bg-[var(--color-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] rounded-[var(--radius-card)] px-5 py-4">
          {/* Lead ID — top-right, matches Figma "Lead ID : XXXXXX" */}
          {lead.lead_number && (
            <div
              className="flex items-center justify-end gap-1 font-mono text-stone-400"
              style={{ fontSize: 11, marginBottom: 4 }}
            >
              Lead ID&nbsp;:&nbsp;{lead.lead_number}
              <CopyButton value={lead.lead_number} label="Lead ID" size={12} />
            </div>
          )}

          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Avatar + identity */}
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-btn)',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 700,
                  background: 'var(--color-brand-light)',
                  color: 'var(--color-brand)',
                  border: '1px solid rgba(196,149,106,0.20)',
                }}
              >
                {initials(company?.client_name || lead.company_name || lead.lead_name)}
              </span>

              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-semibold text-stone-900 truncate" style={{ fontSize: 18, lineHeight: 1.2 }}>
                    {company?.client_name || lead.company_name || lead.lead_name}
                  </h1>
                  {lead.is_closed && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#f0fdf4',
                        color: '#15803d',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      Closed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-stone-500 flex-wrap" style={{ fontSize: 13 }}>
                  <span className="flex items-center gap-1">
                    <Building2 size={13} className="text-stone-400" />
                    {lead.lead_name}
                  </span>
                  {companyLocation && (
                    <>
                      <span className="text-stone-300">·</span>
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-stone-400" />
                        {companyLocation}
                      </span>
                    </>
                  )}
                  {lead.project_name && (
                    <>
                      <span className="text-stone-300">·</span>
                      <span>{lead.project_name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Status block */}
            <div className="flex flex-col items-end gap-1.5">
              <span style={{ fontSize: 11, fontWeight: 500 }} className="text-stone-400">
                Status
              </span>
              <StageBadge stage={lead.stage_name} />
              {lead.report_id ? (
                <StageSelect
                  currentStageId={lead.stage_id}
                  stages={stages}
                  disabled={
                    lead.is_closed ||
                    !hasActor ||
                    // STRICT_ROLE_GATING (ALT-458): agents may only update stage from
                    // "Meeting Scheduled" (stage_id 4) onward. RLS enforces server-side;
                    // this disables the selector to give early feedback in the UI.
                    gated(
                      !agentCanEditLeadReport(
                        { isAdmin, isTeamLead, isQC, isAgent, isSalesUser, canReassign },
                        lead.stage_id,
                      ),
                      false,
                    )
                  }
                  saving={stageSaving}
                  onChange={handleStageChange}
                />
              ) : (
                <span className="text-stone-400" style={{ fontSize: 11 }}>
                  No report yet — fill the Lead Report tab.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress stepper card (Pre-Sales → Meeting → Closing) */}
        <div className="bg-[var(--color-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] rounded-[var(--radius-card)] px-6 py-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <ProgressStepper stage={lead.stage_name} isClosed={lead.is_closed} />
            </div>
            {hasActor && (
              <QuickTaskActions
                association={{
                  leadId: lead.lead_id,
                  assocLabel: company?.client_name || lead.company_name || lead.lead_name,
                  assocPhone: lead.mobile_no || lead.alt_mobile_no || null,
                }}
                leadId={lead.lead_id}
                ownerUserId={profile?.user_id ?? null}
                actorId={actor || null}
                recordName={company?.client_name || lead.company_name || lead.lead_name}
                onCallLogged={() => setCallsRefresh((n) => n + 1)}
                email={lead.email}
                projectId={lead.project_id ?? null}
                onEmailSent={() => setEmailsRefresh((n) => n + 1)}
              />
            )}
            {canClinch && (
              <button
                type="button"
                onClick={handleClinch}
                disabled={clinching}
                className="inline-flex items-center gap-1.5 bg-[var(--color-brand)] hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-[var(--radius-btn)] transition-colors shrink-0"
                style={{ fontSize: 13, padding: '6px 14px', height: 32 }}
              >
                {clinching ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />}
                Clinch / Close
              </button>
            )}
            {canReassign && (
              <button
                type="button"
                onClick={openReassign}
                className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-[var(--radius-btn)] transition-colors shrink-0"
                style={{ fontSize: 13, padding: '6px 14px', height: 32 }}
                title="Reassign this lead to another salesperson"
              >
                <UserCheck size={14} />
                Change salesperson
              </button>
            )}
          </div>
        </div>

        {/* No linked profile → block writes (audit fields must be a real user_id) */}
        {!hasActor && (
          <div
            className="rounded-[var(--radius-card)] px-4 py-3 flex items-start gap-2"
            style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13 }}
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>
              Your account isn't linked to a user profile yet, so changes can't be saved. Please sign out and back in,
              or contact an administrator.
            </span>
          </div>
        )}

        {/* Two-column: tabs (main) + right info panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
          {/* Main area */}
          <div className="min-w-0 bg-[var(--color-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] rounded-[var(--radius-card)]">
            {/* Tab bar */}
            <div className="flex items-center px-3 border-b border-[var(--border-color)]">
              {TABS.map((t) => {
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setTab(t.key); try { localStorage.setItem(`altleads:tab:lead:${id}`, t.key); } catch { /* ignore */ } }}
                    className="relative font-medium transition-colors"
                    style={{
                      fontSize: 13,
                      padding: '12px 14px',
                      color: isActive ? 'var(--color-brand)' : '#6B7280',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-900)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.color = '#6B7280';
                    }}
                  >
                    {t.label}
                    {isActive && (
                      <span
                        style={{
                          position: 'absolute',
                          left: 8,
                          right: 8,
                          bottom: -1,
                          height: 2,
                          background: 'var(--color-brand)',
                          borderRadius: '2px 2px 0 0',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="p-4">
            {tab === 'activity' && <ActivityTab leadId={lead.lead_id} actor={actor} />}
            {tab === 'report' && (
              <ReportTab
                lead={lead}
                domainId={company?.domain_id ?? null}
                actor={actor}
                userRole={profile?.role ?? undefined}
                onReportSaved={refreshLead}
              />
            )}
            {tab === 'meeting' && (
              <MeetingTab
                reportId={lead.report_id}
                leadId={lead.lead_id}
                stageName={lead.stage_name}
                actor={actor}
                onChanged={refreshLead}
              />
            )}
            </div>
          </div>

          {/* Right column: info panel + recent logged calls (ALT-269) */}
          <div className="flex flex-col gap-4 min-w-0">
            {/*
              SAFE_VIEW (ALT-492): when viewing a record owned by another rep, mask
              email + phone before passing to the info panel. Presentational only —
              the full data is still fetched from Supabase; server-side field redaction
              via RLS column grants is a future step. Admin / TL / QC are exempt.
            */}
            {(() => {
              const safeViewExempt = isAdmin || isTeamLead || isQC;
              const isForeign = isForeignRecord(
                lead.salesperson_user_id,
                profile?.user_id ?? null,
                safeViewExempt,
              );
              const safeViewLead = isForeign
                ? {
                    ...lead,
                    email: maskContact(lead.email, 'email'),
                    mobile_no: maskContact(lead.mobile_no, 'phone'),
                    alt_mobile_no: maskContact(lead.alt_mobile_no, 'phone'),
                  }
                : lead;
              return (
                <>
                  {isForeign && (
                    <div
                      role="note"
                      style={{
                        fontSize: 12,
                        color: 'var(--color-gray-400, #9ca3af)',
                        background: 'var(--color-gray-50, #f9fafb)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        padding: '6px 10px',
                      }}
                    >
                      Viewing another rep's record — contact details are masked.
                    </div>
                  )}
                  <LeadInfoPanel lead={safeViewLead} company={company} loadingCompany={loadingCompany} />
                </>
              );
            })()}
            <CallLogPreview
              entity="lead"
              id={lead.lead_id}
              refreshSignal={callsRefresh}
              title="Call history"
            />
            {/* Emails sent from the CRM on this lead (ALT-510) */}
            <EmailActivityPanel leadId={lead.lead_id} refreshKey={emailsRefresh} />
            {/* Cold-lead / freshness signal (ALT-484-lite) — dark behind FRESHNESS_INSIGHT, no migration */}
            {FRESHNESS_INSIGHT && (
              <LeadFreshnessInsight reportId={lead.report_id} reportUpdatedDate={lead.updated_date} />
            )}
            {/* Reschedule intelligence (ALT-480) — dark behind RESCHEDULE_INSIGHT, no migration */}
            {RESCHEDULE_INSIGHT && <RescheduleInsight reportId={lead.report_id} />}
            {/* In-record activity hub (ALT-466) — no-op while TASKS_V2 is off */}
            <RecordActivityHub recordType="lead" recordId={lead.lead_id} />
            {/* Qualification + lost-reason + UTM (ALT-470/471/472) — dark behind LEAD_STATE_V2 */}
            {LEAD_STATE_V2 && (
              <QualificationCard
                reportId={lead.report_id}
                leadId={lead.lead_id}
                stageId={lead.stage_id}
                actorUserId={profile?.user_id ?? null}
                canQualify={isQC || isAdmin}
                canEditLostReasons={
                  isAdmin ||
                  isQC ||
                  (lead.salesperson_user_id != null &&
                    lead.salesperson_user_id === profile?.user_id)
                }
              />
            )}
            {/* Record stream / chatter (ALT-476) — dark behind STREAM_V1 */}
            {STREAM_V1 && (
              <StreamPanel
                recordType="lead"
                recordId={lead.lead_id}
                recordLabel={lead.lead_name ?? `Lead #${lead.lead_id}`}
                actorUserId={profile?.user_id ?? null}
                actorName={profile?.full_name ?? null}
                canPost={profile?.user_id != null}
              />
            )}
            {/* Collaborators & Associations (ALT-441/442) — dark behind COLLAB_ASSOC */}
            {COLLAB_ASSOC && (
              <>
                <CollaboratorsCard
                  recordType="lead"
                  recordId={lead.lead_id}
                  userOptions={collabUserOptions}
                  actorId={actor}
                />
                <AssociationsPanel
                  recordType="lead"
                  recordId={lead.lead_id}
                  targetOptions={collabTargetOptions}
                  actorId={actor}
                />
              </>
            )}
          </div>
        </div>

        {showReassign && (
          <ReassignModal
            entityLabel="Lead"
            ownerLabel="Salesperson"
            currentOwnerId={lead.salesperson_user_id}
            owners={reassignOwners}
            saving={reassignSaving}
            error={reassignError}
            onConfirm={handleReassign}
            onClose={() => setShowReassign(false)}
          />
        )}
      </motion.div>
    </AppShell>
  );
}
