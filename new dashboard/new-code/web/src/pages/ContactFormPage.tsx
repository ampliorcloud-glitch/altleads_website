import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useUnsavedChanges } from '../components/ui/useUnsavedChanges';
import { humanizeWriteError } from '../lib/writeError';
import {
  fetchCompanyOptions,
  fetchCityOptions,
  findDuplicateContact,
  insertContact,
  deriveLinkedinClean,
  type CompanyOption,
  type CityOption,
  type Contact,
} from '../data/contacts';

/* ------------------------------------------------------------------ */
/*  Input styles                                                        */
/* ------------------------------------------------------------------ */

const fieldLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 4, display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 13, padding: '8px 10px',
  border: '1px solid #E5E7EB', borderRadius: 6,
  background: '#fff', color: '#111827', outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <label style={fieldLabel}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export function ContactFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  // Form state
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [altMobileNo, setAltMobileNo] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [cityId, setCityId] = useState<number | ''>('');
  const [isDemo, setIsDemo] = useState(true); // default checked

  // Lookup data
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);

  // Dedup state
  const [duplicate, setDuplicate] = useState<Contact | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Prefill company from ?company=<id>
  const prefillCompany = searchParams.get('company');
  useEffect(() => {
    if (prefillCompany) setCompanyId(Number(prefillCompany));
  }, [prefillCompany]);

  // Load lookups
  useEffect(() => {
    setLookupsLoading(true);
    Promise.all([fetchCompanyOptions(), fetchCityOptions()]).then(([c, ci]) => {
      setCompanies(c);
      setCities(ci);
      setLookupsLoading(false);
    }).catch(() => setLookupsLoading(false));
  }, []);

  // ── Unsaved-changes guard (cache + restore + warn) ──────────────────────────
  const draft = { fullName, designation, email, mobileNo, altMobileNo, linkedinUrl, companyId, cityId, isDemo };
  const baseline = useMemo(() => ({
    fullName: '', designation: '', email: '', mobileNo: '', altMobileNo: '', linkedinUrl: '',
    companyId: (prefillCompany ? Number(prefillCompany) : '') as number | '',
    cityId: '' as number | '', isDemo: true,
  }), [prefillCompany]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const { cachedDraft, clearCache, dismissCached } = useUnsavedChanges({
    dirty, draft, cacheKey: 'contact:new',
  });

  // Offer to restore a draft cached from a previous session (once).
  const promptedRef = useRef(false);
  useEffect(() => {
    if (!cachedDraft || promptedRef.current) return;
    promptedRef.current = true;
    (async () => {
      const ok = await confirm({
        title: 'Restore unsaved changes?',
        message: 'You have an unsaved new contact from a previous session. Restore it?',
        confirmLabel: 'Restore', cancelLabel: 'Discard',
      });
      if (ok) {
        const c = cachedDraft;
        setFullName(c.fullName); setDesignation(c.designation); setEmail(c.email);
        setMobileNo(c.mobileNo); setAltMobileNo(c.altMobileNo); setLinkedinUrl(c.linkedinUrl);
        setCompanyId(c.companyId); setCityId(c.cityId); setIsDemo(c.isDemo);
        toast.info('Restored your unsaved changes');
      } else {
        clearCache();
      }
      dismissCached();
    })();
  }, [cachedDraft, confirm, toast, clearCache, dismissCached]);

  // Cancel/Back — confirm before discarding unsaved edits.
  const handleCancel = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        message: 'Your changes to this contact will be lost.',
        tone: 'danger', confirmLabel: 'Discard', cancelLabel: 'Keep editing',
      });
      if (!ok) return;
      clearCache();
    }
    navigate('/contacts');
  };

  // Validate
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // Dedup check (only for real rows)
  async function checkDuplicate(): Promise<Contact | null> {
    if (isDemo) return null; // skip dedup for demo rows
    setCheckingDup(true);
    const linkedinClean = deriveLinkedinClean(linkedinUrl);

    let match: Contact | null = null;
    if (email.trim()) {
      match = await findDuplicateContact({ email: email.trim() });
    } else if (linkedinClean) {
      match = await findDuplicateContact({ linkedinClean });
    } else if (mobileNo.trim()) {
      match = await findDuplicateContact({ mobileNo: mobileNo.trim() });
    }
    setCheckingDup(false);
    return match;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setDuplicate(null);

    if (!validate()) return;

    // Check dedup for real contacts
    if (!isDemo) {
      const dup = await checkDuplicate();
      if (dup) {
        setDuplicate(dup);
        return;
      }
    }

    setSubmitting(true);
    const linkedinClean = deriveLinkedinClean(linkedinUrl);
    // Default-owner-self (AMBIG A4) intentionally does NOT apply here: a contact
    // has no owner field on this create form — ownership is per-project
    // (contact_project_status.owner_user_id) and assigned later via the Reassign
    // flow, so there is no assignee picker to default. Skipped gracefully.
    const createdBy = user?.email ?? profile?.email ?? 'unknown';

    const { contactId, error } = await insertContact({
      fullName: fullName.trim(),
      designation: designation.trim(),
      email: email.trim(),
      mobileNo: mobileNo.trim(),
      altMobileNo: altMobileNo.trim(),
      linkedinUrl: linkedinUrl.trim(),
      linkedinClean,
      companyId: companyId !== '' ? Number(companyId) : null,
      cityId: cityId !== '' ? Number(cityId) : null,
      isDemo,
      createdBy,
    });

    setSubmitting(false);

    if (error) {
      const msg = humanizeWriteError(error) ?? 'Something went wrong. Please try again.';
      setSubmitError(msg);
      toast.error(msg);
      return;
    }

    clearCache();
    toast.success('Contact created');
    navigate(`/contacts/${contactId}`);
  };

  /* ---------------------------------------------------------------- */

  return (
    <AppShell title="New Contact">
      <div className="space-y-4" style={{ maxWidth: 640 }}>
        {/* Back nav */}
        <button
          onClick={handleCancel}
          className="flex items-center gap-1.5 text-stone-500 hover:text-stone-800 transition-colors"
          style={{ fontSize: 13 }}
        >
          <ArrowLeft size={15} />
          Back to Contacts
        </button>

        {/* Form card */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'block', width: 4, height: 20, background: '#1A7EE8', borderRadius: 2 }} />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>Add New Contact</h2>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Full Name */}
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Full Name" required>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ravi Sharma"
                    style={{ ...inputStyle, borderColor: fieldErrors.fullName ? '#EF4444' : '#E5E7EB' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.fullName ? '#EF4444' : '#E5E7EB'; }}
                  />
                  {fieldErrors.fullName && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{fieldErrors.fullName}</p>}
                </Field>
              </div>

              {/* Designation */}
              <Field label="Designation">
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Sales Head"
                  style={{ ...inputStyle }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                />
              </Field>

              {/* Email */}
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. ravi@company.com"
                  style={{ ...inputStyle }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                />
              </Field>

              {/* Mobile */}
              <Field label="Mobile No.">
                <input
                  type="tel"
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  placeholder="e.g. 9876543210"
                  style={{ ...inputStyle }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                />
              </Field>

              {/* Alt Mobile */}
              <Field label="Alt Mobile No.">
                <input
                  type="tel"
                  value={altMobileNo}
                  onChange={(e) => setAltMobileNo(e.target.value)}
                  placeholder="Alternative number"
                  style={{ ...inputStyle }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                />
              </Field>

              {/* LinkedIn */}
              <Field label="LinkedIn URL">
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  style={{ ...inputStyle }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                />
              </Field>

              {/* Company */}
              <Field label="Company">
                {lookupsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, color: '#9CA3AF', fontSize: 13 }}>
                    <Loader2 size={13} className="animate-spin" /> Loading...
                  </div>
                ) : (
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value !== '' ? Number(e.target.value) : '')}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                  >
                    <option value="">Select company...</option>
                    {companies.map((c) => (
                      <option key={c.company_id} value={c.company_id}>{c.company_name}</option>
                    ))}
                  </select>
                )}
              </Field>

              {/* City */}
              <Field label="City">
                {lookupsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, color: '#9CA3AF', fontSize: 13 }}>
                    <Loader2 size={13} className="animate-spin" /> Loading...
                  </div>
                ) : (
                  <select
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value !== '' ? Number(e.target.value) : '')}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                  >
                    <option value="">Select city...</option>
                    {cities.map((c) => (
                      <option key={c.city_id} value={c.city_id}>{c.city_name}</option>
                    ))}
                  </select>
                )}
              </Field>

              {/* Demo checkbox */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isDemo}
                    onChange={(e) => { setIsDemo(e.target.checked); setDuplicate(null); }}
                    style={{ width: 15, height: 15, accentColor: '#1A7EE8', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: '#374151' }}>
                    Demo / test contact{' '}
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      (checked by default — uncheck for real contacts; dedup check runs for real contacts)
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Dedup warning */}
            {duplicate && (
              <div style={{
                marginTop: 16, padding: '12px 14px', borderRadius: 8,
                background: '#FFFBEB', border: '1px solid #FDE68A',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <AlertCircle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', margin: '0 0 2px' }}>
                    This contact already exists
                  </p>
                  <p style={{ fontSize: 13, color: '#78350F', margin: 0 }}>
                    <strong>{duplicate.full_name}</strong>
                    {duplicate.company_name && ` @ ${duplicate.company_name}`}
                    {' '}(Owner: Unassigned){' '}
                    <Link to={`/contacts/${duplicate.contact_id}`} style={{ color: '#1A7EE8' }}>
                      View contact →
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {/* Submit error */}
            {submitError && (
              <div style={{
                marginTop: 16, padding: '10px 14px', borderRadius: 8,
                background: 'rgba(196,77,77,0.06)', border: '1px solid rgba(196,77,77,0.15)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: '#DC2626',
              }}>
                <AlertCircle size={14} />
                {submitError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3" style={{ marginTop: 24 }}>
              <button
                type="submit"
                disabled={submitting || checkingDup || !!duplicate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#1A7EE8', color: '#fff',
                  fontSize: 13, fontWeight: 500,
                  borderRadius: 6, border: 'none',
                  padding: '9px 22px', cursor: (submitting || checkingDup || !!duplicate) ? 'not-allowed' : 'pointer',
                  opacity: (submitting || checkingDup || !!duplicate) ? 0.6 : 1,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!submitting && !checkingDup && !duplicate) (e.currentTarget as HTMLElement).style.background = '#1463B8'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#1A7EE8'; }}
              >
                {(submitting || checkingDup) ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {submitting ? 'Saving...' : checkingDup ? 'Checking...' : 'Save Contact'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  fontSize: 13, fontWeight: 500, color: '#6B7280',
                  background: 'transparent', border: '1px solid #E5E7EB',
                  borderRadius: 6, padding: '9px 18px', cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#9CA3AF'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

export default ContactFormPage;
