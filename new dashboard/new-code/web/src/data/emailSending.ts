/**
 * emailSending.ts — client for the notify-service email endpoints
 * (ALT-503/506, ADR-35: per-project domain-authenticated sending).
 *
 * Same-origin in production; VITE_NOTIFY_URL for local dev (like writeGateway).
 */
import { supabase } from '../lib/supabase';

const NOTIFY_URL: string = (import.meta as any).env?.VITE_NOTIFY_URL ?? '';

export interface DnsRecord {
  purpose: 'spf' | 'dkim' | 'dmarc' | string;
  type: 'TXT' | 'CNAME';
  host: string;
  value: string;
  verified: boolean;
  seen?: string;
}

export interface SendingDomain {
  domain_id: number;
  domain: string;
  /** Who hosts this domain's mailboxes — decides which connector users get (board entry 6). */
  provider: 'google' | 'microsoft' | 'relay';
  status: 'pending' | 'verified' | 'disabled';
  dns_records: DnsRecord[];
  notes: string | null;
  verified_at: string | null;
}

export interface ProjectEmailSetting {
  project_id: number;
  domain_id: number;
}

export interface DomainsResponse {
  domains: SendingDomain[];
  settings: ProjectEmailSetting[];
  aliases: { user_id: number; domain_id: number; alias: string; display_name: string | null }[];
  relay: 'configured' | 'fallback';
  fallback_domain: string;
}

async function authFetch(path: string, init?: RequestInit): Promise<any> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`${NOTIFY_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

export function fetchDomains(): Promise<DomainsResponse> {
  return authFetch('/api/email/domains');
}

export function addDomain(domain: string, provider: SendingDomain['provider'] = 'relay'): Promise<{ domain: SendingDomain }> {
  return authFetch('/api/email/domains', { method: 'POST', body: JSON.stringify({ domain, provider }) });
}

export function saveDnsRecords(domainId: number, dns_records: Omit<DnsRecord, 'verified' | 'seen'>[]): Promise<{ domain: SendingDomain }> {
  return authFetch(`/api/email/domains/${domainId}/records`, {
    method: 'POST',
    body: JSON.stringify({ dns_records }),
  });
}

export function verifyDomain(domainId: number): Promise<{ domain: SendingDomain; verified: boolean }> {
  return authFetch(`/api/email/domains/${domainId}/verify`, { method: 'POST', body: '{}' });
}

export function setProjectDomain(projectId: number, domainId: number | null): Promise<void> {
  return authFetch('/api/email/project-setting', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, domain_id: domainId }),
  });
}

/** Set (or clear with alias=null/'') a per-user alias override — option 3b. Default behavior (no row) = 3a auto-alias. */
export function setAlias(userId: number, domainId: number, alias: string | null, displayName?: string | null): Promise<void> {
  return authFetch('/api/email/alias', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, domain_id: domainId, alias, display_name: displayName ?? null }),
  });
}

export interface EmailLogEntry {
  id: number;
  sent_to: string | null;
  email_type: string | null;
  subject: string | null;
  status: 'sent' | 'failed';
  error: string | null;
  message_id: string | null;
  lead_id: number | null;
  contact_id: number | null;
  company_id: number | null;
  actor: string | null;
  created_date: string;
}

/** Emails for one record (any authenticated user) or, with no filter, the full log (admin only). */
export function fetchEmailLog(filter: { lead_id?: number; contact_id?: number; company_id?: number; limit?: number } = {}): Promise<{ emails: EmailLogEntry[] }> {
  const params = new URLSearchParams();
  if (filter.lead_id != null) params.set('lead_id', String(filter.lead_id));
  if (filter.contact_id != null) params.set('contact_id', String(filter.contact_id));
  if (filter.company_id != null) params.set('company_id', String(filter.company_id));
  if (filter.limit != null) params.set('limit', String(filter.limit));
  const qs = params.toString();
  return authFetch(`/api/email/log${qs ? `?${qs}` : ''}`);
}

export interface EmailTemplate {
  template_id: number;
  name: string;
  subject: string;
  body: string;
  scope: 'global' | 'personal';
  owner_user_id: number | null;
  is_active: boolean;
}

export function fetchTemplates(): Promise<{ templates: EmailTemplate[] }> {
  return authFetch('/api/email/templates');
}

export function saveTemplate(action: 'create' | 'update' | 'delete', template: Partial<EmailTemplate>): Promise<{ template?: EmailTemplate }> {
  return authFetch('/api/email/templates', { method: 'POST', body: JSON.stringify({ action, template }) });
}

/**
 * Merge-field resolution ({{first_name}}, {{full_name}}, {{company}}, {{my_name}}) —
 * resolved at compose time from the record context. Unknown fields are left
 * visible so the sender notices and fixes them before sending.
 */
export function applyMergeFields(text: string, ctx: { recipientName?: string | null; company?: string | null; myName?: string | null }): string {
  const full = (ctx.recipientName ?? '').trim();
  const first = full.split(/\s+/)[0] ?? '';
  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, first)
    .replace(/\{\{\s*full_name\s*\}\}/gi, full)
    .replace(/\{\{\s*company\s*\}\}/gi, (ctx.company ?? '').trim())
    .replace(/\{\{\s*my_name\s*\}\}/gi, (ctx.myName ?? '').trim());
}

export interface EmailAttachmentInput {
  filename: string;
  /** base64-encoded bytes (no data: prefix) */
  content: string;
  contentType?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  project_id?: number | null;
  lead_id?: number | null;
  contact_id?: number | null;
  company_id?: number | null;
  /** Max 5 files / 7MB total (server-enforced too). */
  attachments?: EmailAttachmentInput[];
}

export function sendEmail(input: SendEmailInput): Promise<{ ok: true; id: string; from: string; relay: 'domain' | 'fallback' }> {
  return authFetch('/api/email/send', { method: 'POST', body: JSON.stringify(input) });
}
