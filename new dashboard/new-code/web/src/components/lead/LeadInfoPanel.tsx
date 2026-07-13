/**
 * LeadInfoPanel — the persistent right-hand panel with three collapsible
 * sections: Lead Information (editable via pencil), Company Information
 * (read-only, from client_association), and Opportunity.
 */
import React from 'react';
import { Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CollapsibleSection, PanelField } from './primitives';
import { fmtDate, initials, type CompanyInfo } from '../../data/leadWorkspace';
import type { LeadDetail } from '../../lib/leadsApi';

export function LeadInfoPanel({
  lead,
  company,
  loadingCompany,
}: {
  lead: LeadDetail;
  company: CompanyInfo | null;
  loadingCompany: boolean;
}) {
  const linkedinHref = (url: string) =>
    url && url.trim() ? (url.startsWith('http') ? url : `https://${url}`) : undefined;

  const identityName = company?.client_name || lead.company_name || lead.lead_name;
  const identitySub = company?.location || lead.city_name;

  return (
    <div className="space-y-3">
      {/* 0) Identity header — tinted avatar block (Figma frame 003) */}
      <div
        style={{
          background: 'var(--color-brand-light)',
          border: '1px solid rgba(196,149,106,0.18)',
          borderRadius: 'var(--radius-card)',
          padding: '18px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            fontWeight: 700,
            background: 'var(--color-surface)',
            color: 'var(--color-brand)',
            border: '1px solid rgba(196,149,106,0.25)',
          }}
        >
          {initials(identityName)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-gray-900)', lineHeight: 1.3 }}>
            {identityName}
          </div>
          {identitySub && (
            <div style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 2 }}>
              {identitySub}
            </div>
          )}
        </div>
      </div>

      {/* 1) Lead Information — editable */}
      <CollapsibleSection
        title="Lead Information"
        action={
          <Link
            to={`/leads/${lead.lead_id}/edit`}
            className="flex items-center gap-1 text-stone-400 hover:text-blue-600 transition-colors"
            style={{ fontSize: 12 }}
            title="Edit lead"
            aria-label="Edit lead"
          >
            <Pencil size={13} />
          </Link>
        }
      >
        <div className="divide-y divide-stone-100">
          <PanelField label="Name" value={lead.lead_name} />
          <PanelField label="Role / Designation" value={lead.designation || lead.role_and_resp} />
          <PanelField label="Source" value={lead.source_name} />
          <PanelField label="Mobile" value={lead.mobile_no} href={lead.mobile_no ? `tel:${lead.mobile_no}` : undefined} copy />
          <PanelField
            label="Alternate Mobile"
            value={lead.alt_mobile_no}
            href={lead.alt_mobile_no ? `tel:${lead.alt_mobile_no}` : undefined}
            copy
          />
          <PanelField label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} copy />
          <PanelField label="Area of Interest" value={lead.area_of_interest} />
          <PanelField label="LinkedIn" value={lead.linkedin_url ? 'View Profile' : ''} href={linkedinHref(lead.linkedin_url)} />
          <PanelField label="Created" value={fmtDate(lead.created_date)} />
        </div>
      </CollapsibleSection>

      {/* 2) Company Information — read-only */}
      <CollapsibleSection title="Company Information">
        {loadingCompany ? (
          <div className="py-3 text-stone-400" style={{ fontSize: 12 }}>
            Loading company...
          </div>
        ) : company ? (
          <div className="divide-y divide-stone-100">
            <PanelField label="Client / Company" value={company.client_name} />
            <PanelField label="Contact" value={company.full_name} />
            <PanelField label="Location" value={company.location} />
            <PanelField label="Industry" value={company.industry_name} />
            <PanelField label="Domain / Sector" value={company.domain_name} />
            <PanelField label="Email" value={company.email} href={company.email ? `mailto:${company.email}` : undefined} copy />
            <PanelField
              label="Phone"
              value={company.mobile_number}
              href={company.mobile_number ? `tel:${company.mobile_number}` : undefined}
              copy
            />
            <PanelField
              label="Website"
              value={company.website ? company.website : ''}
              href={company.website ? (company.website.startsWith('http') ? company.website : `https://${company.website}`) : undefined}
            />
          </div>
        ) : (
          <div className="py-3 text-stone-300" style={{ fontSize: 12 }}>
            No company linked to this lead.
          </div>
        )}
      </CollapsibleSection>

      {/* 3) Opportunity */}
      <CollapsibleSection title="Opportunity">
        <div className="divide-y divide-stone-100">
          <PanelField label="Title" value={lead.title} />
          <PanelField label="Description" value={lead.description} />
          <PanelField label="Value" value={lead.value && lead.value !== '0' ? lead.value : ''} />
        </div>
      </CollapsibleSection>
    </div>
  );
}
