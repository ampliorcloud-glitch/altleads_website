import React, { useEffect, useRef, useState } from 'react';
import { Modal, Field, TextInput, SelectInput, PrimaryButton, GhostButton } from '../admin/Modal';
import { useToast } from '../ui/Toast';
import {
  addWishlist,
  searchCompanies,
  listStates,
  listCitiesByState,
  leadsByCompany,
  type CompanySearchOption,
  type StateOption,
  type CityOption,
  type CompanyLeadOption,
} from '../../data/wishlist';

/**
 * WishlistCreateModal — "Add to wishlist" prospect-capture form (ALT-276).
 *
 * Mirrors the legacy mobile Wishlist screen (minus the geo-photo/GPS, which are
 * mobile-only). Fields with mobile parity, required marked *:
 *   Company name* (searchable autocomplete; free-text allowed if no match),
 *   Lead/Prospect name, Mobile (digits, max 10), Designation, Address line 1*,
 *   Address line 2, State → City (cascading), PIN code*, Country (default India),
 *   Description.
 *
 * FOCUS-BUG NOTE: this reuses the shared admin Modal, which moves focus into the
 * dialog ONCE on open (depends on `open` only). We deliberately add NO effect
 * that re-focuses inputs on each keystroke — typing must never steal focus.
 */

interface WishlistCreateModalProps {
  open: boolean;
  onClose: () => void;
  /** Current user's numeric user_id (string) for created_by + assign_*. */
  actor: string | null;
  /** Called after a successful insert so the parent can refresh its list. */
  onCreated?: () => void;
}

/** Required-field label: the shared Field takes a string, so append " *". */
const req = (label: string) => `${label} *`;

export function WishlistCreateModal({ open, onClose, actor, onCreated }: WishlistCreateModalProps) {
  const toast = useToast();

  // ── form state ──────────────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [leadName, setLeadName] = useState('');
  const [mobile, setMobile] = useState('');
  const [designation, setDesignation] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [stateId, setStateId] = useState<number | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [pincode, setPincode] = useState('');
  const [description, setDescription] = useState('');
  // Country is UI-only (no backing wishlist column) — fixed default per mobile.
  const country = 'India';

  const [saving, setSaving] = useState(false);

  // ── company autocomplete ─────────────────────────────────────────────────
  const [companyResults, setCompanyResults] = useState<CompanySearchOption[]>([]);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [companyLeads, setCompanyLeads] = useState<CompanyLeadOption[]>([]);
  const searchTimer = useRef<number | null>(null);

  // ── location dropdown sources ─────────────────────────────────────────────
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  // Load states once when the modal opens; reset the form on each fresh open.
  useEffect(() => {
    if (!open) return;
    // reset
    setCompanyName(''); setCompanyId(null); setLeadName(''); setMobile('');
    setDesignation(''); setAddressLine1(''); setAddressLine2('');
    setStateId(null); setCityId(null); setPincode(''); setDescription('');
    setCompanyResults([]); setShowCompanyDropdown(false); setCompanyLeads([]);
    setCities([]);
    let cancelled = false;
    listStates().then((rows) => { if (!cancelled) setStates(rows); });
    return () => { cancelled = true; };
  }, [open]);

  // Debounced company search (>= 2 chars), mirroring the mobile 300ms debounce.
  const onCompanyNameChange = (v: string) => {
    setCompanyName(v);
    // Typing a different name clears a previously-picked canonical company.
    setCompanyId(null);
    setCompanyLeads([]);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    const q = v.trim();
    if (q.length < 2) {
      setCompanyResults([]);
      setShowCompanyDropdown(false);
      return;
    }
    searchTimer.current = window.setTimeout(async () => {
      const rows = await searchCompanies(q);
      setCompanyResults(rows);
      setShowCompanyDropdown(true);
    }, 300);
  };

  const pickCompany = async (c: CompanySearchOption) => {
    setCompanyName(c.companyName);
    setCompanyId(c.companyId);
    setShowCompanyDropdown(false);
    setCompanyResults([]);
    // Best-effort: pull this company's leads to offer designation auto-fill.
    const leads = await leadsByCompany(c.companyId);
    setCompanyLeads(leads);
  };

  // If the typed lead name matches a known lead for the picked company, auto-fill
  // its designation (mobile parity) — only when designation is still blank.
  const onLeadNameChange = (v: string) => {
    setLeadName(v);
    if (!designation && companyLeads.length > 0) {
      const match = companyLeads.find((l) => l.leadName.toLowerCase() === v.trim().toLowerCase());
      if (match && match.designation) setDesignation(match.designation);
    }
  };

  const onMobileChange = (v: string) => {
    // digits only, max 10 (mobile parity)
    const digits = v.replace(/\D/g, '').slice(0, 10);
    setMobile(digits);
  };

  const onStateChange = (v: string) => {
    const sid = v ? Number(v) : null;
    setStateId(sid);
    setCityId(null);
    setCities([]);
    if (sid == null) return;
    setCitiesLoading(true);
    listCitiesByState(sid).then((rows) => {
      setCities(rows);
      setCitiesLoading(false);
    });
  };

  // ── validation: required fields gate the Save button ─────────────────────
  // City is required (mobile parity + the captured city_id drives the address row
  // and the State/City shown in the list/detail — a wishlist with no location is
  // not useful prospect capture).
  const mobileValid = mobile.length === 0 || mobile.length === 10;
  const canSave =
    companyName.trim().length > 0 &&
    addressLine1.trim().length > 0 &&
    pincode.trim().length > 0 &&
    cityId != null &&
    mobileValid &&
    !saving;

  const handleSave = async () => {
    if (!canSave) return;
    if (mobile.length > 0 && mobile.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }
    setSaving(true);
    const res = await addWishlist({
      companyName,
      companyId,
      leadName,
      mobile,
      designation,
      addressLine1,
      addressLine2,
      cityId,
      pincode,
      description,
      actor,
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Added to wishlist.');
    onCreated?.();
    onClose();
  };

  const footer = (
    <>
      <GhostButton onClick={onClose} disabled={saving}>
        Cancel
      </GhostButton>
      <PrimaryButton onClick={handleSave} disabled={!canSave}>
        {saving ? 'Saving…' : 'Add to wishlist'}
      </PrimaryButton>
    </>
  );

  return (
    <Modal open={open} title="Add to wishlist" onClose={onClose} footer={footer} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Company name — searchable autocomplete; free-text allowed. */}
        <Field label={req('Company name')}>
          <div style={{ position: 'relative' }}>
            <TextInput
              value={companyName}
              onChange={onCompanyNameChange}
              placeholder="Search or type a company name"
            />
            {showCompanyDropdown && companyResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  marginTop: 2,
                  background: '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {companyResults.map((c) => (
                  <button
                    key={c.companyId}
                    type="button"
                    onClick={() => pickCompany(c)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 10px',
                      fontSize: 13,
                      color: '#374151',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    {c.companyName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        {/* Lead / prospect + Mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Lead / Prospect name">
            <TextInput value={leadName} onChange={onLeadNameChange} placeholder="Contact name" />
          </Field>
          <Field label="Mobile">
            <TextInput
              value={mobile}
              onChange={onMobileChange}
              placeholder="10-digit number"
              type="tel"
            />
          </Field>
        </div>

        <Field label="Designation">
          <TextInput value={designation} onChange={setDesignation} placeholder="e.g. Procurement Head" />
        </Field>

        {/* Address */}
        <Field label={req('Address line 1')}>
          <TextInput value={addressLine1} onChange={setAddressLine1} placeholder="Building, street" />
        </Field>
        <Field label="Address line 2">
          <TextInput value={addressLine2} onChange={setAddressLine2} placeholder="Area, landmark (optional)" />
        </Field>

        {/* State → City (cascading) + Country + PIN */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="State">
            <SelectInput value={stateId != null ? String(stateId) : ''} onChange={onStateChange}>
              <option value="">Select state…</option>
              {states.map((s) => (
                <option key={s.stateId} value={s.stateId}>{s.stateName}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label={req('City')}>
            <SelectInput
              value={cityId != null ? String(cityId) : ''}
              onChange={(v) => setCityId(v ? Number(v) : null)}
            >
              <option value="">
                {stateId == null ? 'Select a state first' : citiesLoading ? 'Loading…' : 'Select city…'}
              </option>
              {cities.map((c) => (
                <option key={c.cityId} value={c.cityId}>{c.cityName}</option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Country">
            <TextInput value={country} onChange={() => { /* fixed default; no wishlist column */ }} />
          </Field>
          <Field label={req('PIN code')}>
            <TextInput value={pincode} onChange={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit PIN" />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why is this a prospect? Any notes…"
            rows={3}
            style={{
              fontSize: 13,
              padding: '7px 10px',
              border: '1px solid #D1D5DB',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              outline: 'none',
              width: '100%',
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </Field>
      </div>
    </Modal>
  );
}

export default WishlistCreateModal;
