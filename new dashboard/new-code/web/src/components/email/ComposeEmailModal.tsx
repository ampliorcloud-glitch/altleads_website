/**
 * ComposeEmailModal — send an email as the logged-in user (ALT-503, ADR-35).
 *
 * Posts to notify-service /api/email/send. The From address is decided
 * server-side: the user's alias on the record's project sending domain
 * (verified domains only), else the fallback. Every send lands in email_log
 * so it appears in the record's Emails panel regardless of outcome.
 *
 * ALT-509: template picker (global admin templates + personal ones), merge
 * fields ({{first_name}} {{full_name}} {{company}} {{my_name}}) resolved from
 * the record at pick time, and "Save as my template".
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Send, BookmarkPlus, Paperclip, X } from 'lucide-react';
import { Modal, Field, TextInput, PrimaryButton, GhostButton } from '../admin/Modal';
import {
  sendEmail,
  fetchTemplates,
  saveTemplate,
  applyMergeFields,
  type EmailTemplate,
  type EmailAttachmentInput,
} from '../../data/emailSending';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';

export function ComposeEmailModal({
  open,
  onClose,
  to,
  projectId,
  leadId,
  contactId,
  companyId,
  recordName,
  companyName,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  /** Recipient — prefilled from the record, editable. */
  to: string;
  projectId?: number | null;
  leadId?: number | null;
  contactId?: number | null;
  companyId?: number | null;
  recordName?: string;
  /** Company name for the {{company}} merge field (falls back to recordName on company pages). */
  companyName?: string | null;
  /** Called after a successful send so the page can refresh its Emails panel. */
  onSent?: () => void;
}) {
  const toast = useToast();
  const { profile } = useAuth();
  const [recipient, setRecipient] = useState(to);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [files, setFiles] = useState<{ name: string; size: number; att: EmailAttachmentInput }[]>([]);

  // Re-seed when opened for a (possibly different) record; load templates.
  useEffect(() => {
    if (!open) return;
    setRecipient(to);
    setSubject('');
    setBody('');
    setTemplateId('');
    setFiles([]);
    fetchTemplates()
      .then((r) => setTemplates(r.templates))
      .catch(() => setTemplates([]));
  }, [open, to]);

  const mergeCtx = {
    recipientName: recordName ?? '',
    company: companyName ?? recordName ?? '',
    myName: (profile as { full_name?: string } | null)?.full_name ?? '',
  };

  function onPickTemplate(idStr: string) {
    setTemplateId(idStr === '' ? '' : Number(idStr));
    if (idStr === '') return;
    const t = templates.find((x) => x.template_id === Number(idStr));
    if (!t) return;
    setSubject(applyMergeFields(t.subject, mergeCtx));
    setBody(applyMergeFields(t.body, mergeCtx));
  }

  async function onSaveAsTemplate() {
    if (!subject.trim() && !body.trim()) {
      toast.error('Write a subject/message first, then save it as a template');
      return;
    }
    const name = window.prompt('Template name:', subject.trim().slice(0, 60) || 'My template');
    if (!name) return;
    setSavingTemplate(true);
    try {
      await saveTemplate('create', { name, subject, body, scope: 'personal' });
      toast.success('Saved to My templates');
      const r = await fetchTemplates();
      setTemplates(r.templates);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  }

  const MAX_TOTAL = 7 * 1024 * 1024; // 7MB decoded — matches the server cap

  async function onPickFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= 5) { toast.error('Max 5 attachments'); break; }
      const total = next.reduce((n, x) => n + x.size, 0) + f.size;
      if (total > MAX_TOTAL) { toast.error('Attachments too large — max 7MB total'); break; }
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
        r.onerror = () => reject(new Error('read failed'));
        r.readAsDataURL(f);
      });
      next.push({ name: f.name, size: f.size, att: { filename: f.name, content: b64, contentType: f.type || undefined } });
    }
    setFiles(next);
  }

  async function onSend() {
    if (!recipient.trim() || !subject.trim() || !body.trim()) {
      toast.error('Recipient, subject and message are all required');
      return;
    }
    setSending(true);
    try {
      const r = await sendEmail({
        to: recipient.trim(),
        subject: subject.trim(),
        // Plain-text body, preserved line breaks — rich text arrives with ALT-509 v2.
        text: body,
        project_id: projectId ?? null,
        lead_id: leadId ?? null,
        contact_id: contactId ?? null,
        company_id: companyId ?? null,
        ...(files.length ? { attachments: files.map((f) => f.att) } : {}),
      });
      toast.success(
        r.relay === 'domain'
          ? `Sent as ${r.from} ✓`
          : 'Sent via system mailbox (replies come to you) ✓',
      );
      onSent?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  const globals = templates.filter((t) => t.scope === 'global');
  const personals = templates.filter((t) => t.scope === 'personal');

  return (
    <Modal
      open={open}
      title={recordName ? `Email — ${recordName}` : 'Send email'}
      onClose={onClose}
      width={560}
      footer={
        <>
          <GhostButton onClick={() => void onSaveAsTemplate()} disabled={savingTemplate || sending}>
            {savingTemplate
              ? <Loader2 size={14} className="animate-spin" />
              : <span className="inline-flex items-center gap-1.5"><BookmarkPlus size={13} />Save as template</span>}
          </GhostButton>
          <GhostButton onClick={onClose} disabled={sending}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void onSend()} disabled={sending}>
            {sending
              ? <Loader2 size={14} className="animate-spin" />
              : <span className="inline-flex items-center gap-1.5"><Send size={13} />Send</span>}
          </PrimaryButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {templates.length > 0 && (
          <Field label="Template (optional — fills subject & message, then edit freely)">
            <select
              value={templateId}
              onChange={(e) => onPickTemplate(e.target.value)}
              style={{ fontSize: 13, padding: '6px 9px', border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff', height: 34, width: '100%' }}
            >
              <option value="">— none —</option>
              {globals.length > 0 && (
                <optgroup label="Team templates">
                  {globals.map((t) => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
                </optgroup>
              )}
              {personals.length > 0 && (
                <optgroup label="My templates">
                  {personals.map((t) => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
                </optgroup>
              )}
            </select>
          </Field>
        )}
        <Field label="To">
          <TextInput value={recipient} onChange={setRecipient} placeholder="name@company.com" />
        </Field>
        <Field label="Subject">
          <TextInput value={subject} onChange={setSubject} placeholder="Subject" />
        </Field>
        <Field label="Attachments (optional — up to 5 files, 7MB total)">
          <div className="flex items-center gap-2 flex-wrap">
            <label
              className="inline-flex items-center gap-1.5"
              style={{ fontSize: 12, padding: '5px 11px', height: 30, borderRadius: 6, border: '1px solid #d4d4d8', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 500 }}
            >
              <Paperclip size={13} /> Attach files
              <input type="file" multiple style={{ display: 'none' }} onChange={(e) => { void onPickFiles(e.target.files); e.target.value = ''; }} />
            </label>
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1" style={{ fontSize: 11.5, background: '#F4F4F5', borderRadius: 12, padding: '3px 8px', color: '#374151' }}>
                {f.name} <span style={{ color: '#9CA3AF' }}>({Math.ceil(f.size / 1024)}KB)</span>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', padding: 0, lineHeight: 0 }}
                  aria-label={`Remove ${f.name}`}
                ><X size={12} /></button>
              </span>
            ))}
          </div>
        </Field>
        <Field label="Message">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder={'Write your message…\n\nTip: templates can use {{first_name}}, {{full_name}}, {{company}}, {{my_name}}'}
            style={{
              fontSize: 13, padding: '8px 10px', border: '1px solid #d4d4d8',
              borderRadius: 6, width: '100%', resize: 'vertical', outline: 'none',
              fontFamily: 'inherit', color: '#18181b', background: '#fff',
            }}
          />
        </Field>
        <div style={{ fontSize: 11, color: '#71717A' }}>
          Sent from your address on this project's sending domain; replies go to your inbox.
          Every send appears in the record's Emails panel (sent or failed).
        </div>
      </div>
    </Modal>
  );
}
