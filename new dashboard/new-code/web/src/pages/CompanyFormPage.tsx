/**
 * CompanyFormPage — New Company flow (/companies/new).
 *
 * DEDUP: for real companies (Demo unchecked) we normalise the website to a domain
 * and look for an existing non-demo company with a matching domain_clean OR
 * cin_number. A hit shows an inline "already exists" card with a link to the detail
 * page and blocks creation. When the Demo checkbox is checked (DEFAULT CHECKED) we
 * skip dedup entirely and always insert with is_demo=true.
 *
 * Owner is always "Unassigned" for now. // TODO ownership
 *
 * Default-owner-self (AMBIG A4) intentionally does NOT apply here: this form has
 * no owner/assignee picker — company ownership is per-project
 * (company_project_status.owner_user_id) and assigned later via the Reassign
 * flow. Skipped gracefully (no picker to default).
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, AlertCircle, Check, Loader2, ExternalLink } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { createCompany, type NewCompanyInput, type DuplicateMatch } from '../data/companies';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useUnsavedChanges } from '../components/ui/useUnsavedChanges';
import { humanizeWriteError } from '../lib/writeError';

const inputBase: React.CSSProperties = {
  fontSize: 13,
  padding: '6px 10px',
  border: '1px solid #d4d4d8',
  borderRadius: 6,
  background: '#fff',
  color: '#18181b',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s',
};

function FieldGroup({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="block font-medium text-stone-500" style={{ fontSize: 12 }}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500" style={{ fontSize: 11 }}>{error}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  hasError,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
  type?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputBase, borderColor: focused ? '#1A7EE8' : hasError ? '#f87171' : '#d4d4d8' }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

const emptyForm: NewCompanyInput = {
  company_name: '',
  company_web_url: '',
  cin_number: '',
  industry: '',
  city: '',
  size: '',
  linkedin_url: '',
  email: '',
  is_demo: true, // DEFAULT CHECKED
};

type Errors = Partial<Record<keyof NewCompanyInput | 'submit', string>>;

export function CompanyFormPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<NewCompanyInput>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);

  // Audit created_by stores the numeric user_id as text (ownership/RLS key).
  const createdBy = profile?.user_id != null ? String(profile.user_id) : null;

  // ── Unsaved-changes guard (cache + restore + warn) ──────────────────────────
  const dirty = JSON.stringify(form) !== JSON.stringify(emptyForm);
  const { cachedDraft, clearCache, dismissCached } = useUnsavedChanges({
    dirty, draft: form, cacheKey: 'company:new',
  });
  const promptedRef = useRef(false);
  useEffect(() => {
    if (!cachedDraft || promptedRef.current) return;
    promptedRef.current = true;
    (async () => {
      const ok = await confirm({
        title: 'Restore unsaved changes?',
        message: 'You have an unsaved new company from a previous session. Restore it?',
        confirmLabel: 'Restore', cancelLabel: 'Discard',
      });
      if (ok) { setForm(cachedDraft); toast.info('Restored your unsaved changes'); }
      else { clearCache(); }
      dismissCached();
    })();
  }, [cachedDraft, confirm, toast, clearCache, dismissCached]);

  const handleCancel = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        message: 'Your changes to this company will be lost.',
        tone: 'danger', confirmLabel: 'Discard', cancelLabel: 'Keep editing',
      });
      if (!ok) return;
      clearCache();
    }
    navigate('/companies');
  };

  const set = <K extends keyof NewCompanyInput>(key: K, value: NewCompanyInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
    if (key === 'company_web_url' || key === 'cin_number' || key === 'is_demo') setDuplicate(null);
  };

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.company_name.trim()) e.company_name = 'Company name is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Enter a valid email address.';
    }
    if (form.size && Number.isNaN(Number(form.size.trim()))) {
      e.size = 'Size must be a number.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicate(null);
    if (!validate()) return;

    if (createdBy == null) {
      setErrors({ submit: 'Your profile is still loading — please wait a moment and try again.' });
      return;
    }

    setSubmitting(true);
    setErrors({});
    const result = await createCompany(form, createdBy);
    setSubmitting(false);

    if (result.kind === 'error') {
      const msg = humanizeWriteError(result.message) ?? 'Something went wrong. Please try again.';
      setErrors({ submit: msg });
      toast.error(msg);
    } else if (result.kind === 'duplicate') {
      setDuplicate(result.match);
    } else {
      setSuccess(true);
      clearCache();
      toast.success('Company created');
      setTimeout(() => navigate(`/companies/${result.id}`), 500);
    }
  };

  return (
    <AppShell title="New Company">
      <div className="max-w-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-stone-400 mb-4" style={{ fontSize: 12 }}>
          <button type="button" onClick={handleCancel} className="flex items-center gap-1 hover:text-stone-700 transition-colors">
            <ArrowLeft size={13} />
            Companies
          </button>
          <ChevronRight size={11} />
          <span className="text-stone-600">New Company</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-lg p-6 space-y-6" noValidate>
          <h2 className="font-semibold text-stone-800" style={{ fontSize: 16 }}>New Company</h2>

          {/* Duplicate match card */}
          {duplicate && (
            <div className="rounded-lg px-4 py-3 flex items-start gap-2" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <div style={{ fontSize: 13 }}>
                <p className="font-medium">
                  This company already exists: {duplicate.name || 'Unnamed company'} (Owner: {duplicate.owner})
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/companies/${duplicate.id}`)}
                  className="inline-flex items-center gap-1 mt-1 text-blue-700 hover:text-blue-800 font-medium"
                  style={{ fontSize: 12 }}
                >
                  <ExternalLink size={12} /> Open existing company
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup label="Company Name" required error={errors.company_name}>
              <TextInput value={form.company_name} onChange={(v) => set('company_name', v)} placeholder="e.g. Acme Industries Ltd" hasError={Boolean(errors.company_name)} />
            </FieldGroup>
            <FieldGroup label="Website" error={errors.company_web_url}>
              <TextInput value={form.company_web_url} onChange={(v) => set('company_web_url', v)} placeholder="e.g. acme.com" />
            </FieldGroup>
            <FieldGroup label="CIN Number" error={errors.cin_number}>
              <TextInput value={form.cin_number} onChange={(v) => set('cin_number', v)} placeholder="Corporate Identity Number" />
            </FieldGroup>
            <FieldGroup label="Industry" error={errors.industry}>
              <TextInput value={form.industry} onChange={(v) => set('industry', v)} placeholder="e.g. Manufacturing" />
            </FieldGroup>
            <FieldGroup label="City" error={errors.city}>
              <TextInput value={form.city} onChange={(v) => set('city', v)} placeholder="e.g. Mumbai" />
            </FieldGroup>
            <FieldGroup label="Company Size" error={errors.size}>
              <TextInput value={form.size} onChange={(v) => set('size', v)} placeholder="No. of employees" type="text" />
            </FieldGroup>
            <FieldGroup label="LinkedIn URL" error={errors.linkedin_url}>
              <TextInput value={form.linkedin_url} onChange={(v) => set('linkedin_url', v)} placeholder="linkedin.com/company/..." />
            </FieldGroup>
            <FieldGroup label="Email" error={errors.email}>
              <TextInput value={form.email} onChange={(v) => set('email', v)} placeholder="contact@acme.com" type="email" hasError={Boolean(errors.email)} />
            </FieldGroup>
          </div>

          {/* Demo checkbox — default checked */}
          <label className="flex items-start gap-2.5 rounded-lg px-4 py-3 cursor-pointer" style={{ background: 'var(--color-gray-50)', border: '1px solid var(--border-color)' }}>
            <input
              type="checkbox"
              checked={form.is_demo}
              onChange={(e) => set('is_demo', e.target.checked)}
              style={{ marginTop: 2, width: 15, height: 15, accentColor: '#1A7EE8', cursor: 'pointer' }}
            />
            <span>
              <span className="block font-medium text-stone-700" style={{ fontSize: 13 }}>Demo company</span>
              <span className="block text-stone-500" style={{ fontSize: 12 }}>
                Skips duplicate detection and is flagged as demo data. Uncheck to create a real company (duplicate check runs against domain &amp; CIN).
              </span>
            </span>
          </label>

          {/* Submit row */}
          <div className="pt-2 flex items-center justify-between gap-4 border-t border-stone-100">
            <button
              type="button"
              onClick={handleCancel}
              className="border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-600 font-medium rounded-lg transition-colors"
              style={{ fontSize: 13, padding: '7px 16px' }}
              disabled={submitting}
            >
              Cancel
            </button>
            <div className="flex items-center gap-3">
              {errors.submit && (
                <span className="flex items-center gap-1 text-red-500" style={{ fontSize: 12 }}>
                  <AlertCircle size={13} />
                  {errors.submit}
                </span>
              )}
              <button
                type="submit"
                disabled={submitting || success}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                style={{ fontSize: 13, padding: '7px 20px' }}
              >
                {success ? (
                  <><Check size={14} /> Created</>
                ) : submitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Creating...</>
                ) : (
                  'Create Company'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export default CompanyFormPage;
