/**
 * email-templates.js — branded HTML email builder for Amplior CRM notifications.
 *
 * Brand:
 *   accent  = #1A7EE8 (blue)   text = #111111   bg = #F4F6FA   card = #FFFFFF
 *
 * Every template takes a `data` object. Common OPTIONAL fields supported across
 * all templates (callers may pass them; everything degrades gracefully):
 *   toName   — recipient's first name, used for the greeting ("Hi Priya,")
 *   ctaUrl   — deep link for the button (e.g. https://crm.altleads.com/leads/123).
 *              Falls back to APP_URL so the button always opens the CRM.
 */

'use strict';

// Base URL the action buttons point at. Override per-email via data.ctaUrl, or
// globally via the APP_BASE_URL env var. Defaults to production.
const APP_URL = process.env.APP_BASE_URL || 'https://crm.altleads.com';

/* ── Shared layout wrapper ─────────────────────────────────────── */

function wrap(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(title)}</title>
  <style>
    body { margin:0; padding:0; background:#F4F6FA; font-family:'Segoe UI',Arial,sans-serif; }
    .shell { max-width:600px; margin:32px auto; background:#FFFFFF; border-radius:10px;
             overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    .header { background:#1A7EE8; padding:24px 32px; }
    .logo   { font-size:22px; font-weight:700; color:#FFFFFF; letter-spacing:-0.5px; }
    .logo span { color:#DDEEFF; }
    .body   { padding:32px; color:#111111; }
    .greeting { font-size:15px; color:#111111; margin:0 0 18px; }
    .lead-in  { font-size:15px; color:#333; margin:0 0 22px; line-height:1.5; }
    .label  { font-size:12px; font-weight:600; text-transform:uppercase;
              color:#1A7EE8; letter-spacing:.8px; margin-bottom:4px; }
    .value  { font-size:15px; color:#111111; margin-bottom:18px; }
    .badge  { display:inline-block; padding:4px 12px; border-radius:20px;
              font-size:12px; font-weight:600; }
    .badge-green  { background:#D1FAE5; color:#065F46; }
    .badge-red    { background:#FEE2E2; color:#991B1B; }
    .badge-blue   { background:#DBEAFE; color:#1E40AF; }
    .badge-yellow { background:#FEF9C3; color:#854D0E; }
    .reason-box { background:#FFF7ED; border-left:4px solid #F59E0B;
                  padding:12px 16px; border-radius:4px; margin-top:8px;
                  font-size:14px; color:#111; }
    .cta    { display:inline-block; margin-top:24px; padding:12px 28px;
              background:#1A7EE8; color:#FFFFFF; text-decoration:none;
              border-radius:6px; font-weight:600; font-size:14px; }
    .note   { margin-top:24px; font-size:13px; color:#555; line-height:1.5; }
    .footer { padding:20px 32px; background:#F4F6FA; font-size:12px; color:#888;
              border-top:1px solid #E5E7EB; text-align:center; line-height:1.6; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="header">
      <div class="logo"><span>Alt</span>Leads &nbsp;|&nbsp; Amplior CRM</div>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      You're receiving this because you're part of the team on AltLeads CRM.<br/>
      This is an automated message — please don't reply to this email.
    </div>
  </div>
</body>
</html>`;
}

/* ── Small builders ────────────────────────────────────────────── */

function greeting(data) {
  const name = (data.toName || '').trim();
  return `<p class="greeting">Hi ${name ? esc(name) : 'there'},</p>`;
}

function leadIn(text) {
  return `<p class="lead-in">${text}</p>`;
}

function row(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `<div class="label">${esc(label)}</div><div class="value">${esc(value)}</div>`;
}

function button(label, data) {
  const url = data.ctaUrl || APP_URL;
  return `<a class="cta" href="${esc(url)}">${esc(label)}</a>`;
}

/* ── Template builders ─────────────────────────────────────────── */

function leadAssigned(data) {
  const { leadName = 'N/A', company = '', assignedByName = '' } = data;
  return wrap('New Lead Assigned — AltLeads', `
    <h2 style="margin-top:0;color:#1A7EE8;font-size:20px;">A new lead is yours</h2>
    ${greeting(data)}
    ${leadIn(`${assignedByName ? `${esc(assignedByName)} has assigned` : 'You have been assigned'} a new lead in AltLeads. Here are the details:`)}
    ${row('Lead', leadName)}
    ${row('Company', company)}
    ${row('Assigned By', assignedByName)}
    <span class="badge badge-blue">New Assignment</span>
    <br/>
    ${button('Open lead in AltLeads', data)}
    <p class="note">Give them a call or drop an email to start the conversation — you can log your first call straight from the lead.</p>
  `);
}

function leadReassigned(data) {
  const { leadName = 'N/A', company = '', assignedByName = '' } = data;
  return wrap('Lead Reassigned — AltLeads', `
    <h2 style="margin-top:0;color:#1A7EE8;font-size:20px;">A lead has been moved to you</h2>
    ${greeting(data)}
    ${leadIn(`This lead has been reassigned to you${assignedByName ? ` by ${esc(assignedByName)}` : ''}. It's now in your pipeline:`)}
    ${row('Lead', leadName)}
    ${row('Company', company)}
    ${row('Reassigned By', assignedByName)}
    <span class="badge badge-yellow">Reassigned</span>
    <br/>
    ${button('Open lead in AltLeads', data)}
    <p class="note">Review the history so far, then pick up the outreach from where it stands.</p>
  `);
}

function meetingScheduled(data) {
  const { leadName = 'N/A', meetingDate = '', meetingTime = '', mode = '' } = data;
  return wrap('Meeting Scheduled — AltLeads', `
    <h2 style="margin-top:0;color:#1A7EE8;font-size:20px;">Your meeting is confirmed</h2>
    ${greeting(data)}
    ${leadIn('A meeting has been scheduled. Here are the details:')}
    ${row('Lead', leadName)}
    ${row('Date', meetingDate)}
    ${row('Time', meetingTime)}
    ${row('Mode', mode)}
    <span class="badge badge-blue">Meeting Scheduled</span>
    <br/>
    ${button('View meeting details', data)}
    <p class="note">Add it to your calendar and prepare your talking points ahead of time.</p>
  `);
}

function meetingRescheduled(data) {
  const {
    leadName = 'N/A',
    oldDate = '', oldTime = '',
    newDate = '', newTime = '',
    mode = '', reason = '', rescheduledBy = '',
  } = data;
  const oldWhen = [oldDate, oldTime].filter(Boolean).join(' · ');
  const newWhen = [newDate, newTime].filter(Boolean).join(' · ');
  return wrap('Meeting Rescheduled — AltLeads', `
    <h2 style="margin-top:0;color:#D97706;font-size:20px;">Your meeting has moved</h2>
    ${greeting(data)}
    ${leadIn('The meeting time has changed. Please note the new slot:')}
    ${row('Lead', leadName)}
    ${oldWhen ? `<div class="label">Was</div><div class="value" style="color:#888;text-decoration:line-through;">${esc(oldWhen)}</div>` : ''}
    ${newWhen ? `<div class="label">Now</div><div class="value" style="font-weight:600;">${esc(newWhen)}</div>` : ''}
    ${row('Mode', mode)}
    ${row('Rescheduled By', rescheduledBy)}
    ${reason ? `<div class="label">Reason</div><div class="reason-box">${esc(reason)}</div>` : ''}
    <br/><span class="badge badge-yellow">Rescheduled</span>
    <br/>
    ${button('View meeting details', data)}
    <p class="note">Update your calendar with the new time so nothing slips.</p>
  `);
}

function meetingCancelled(data) {
  const {
    leadName = 'N/A',
    meetingDate = '', meetingTime = '',
    mode = '', reason = '', cancelledBy = '',
  } = data;
  return wrap('Meeting Cancelled — AltLeads', `
    <h2 style="margin-top:0;color:#991B1B;font-size:20px;">A meeting has been cancelled</h2>
    ${greeting(data)}
    ${leadIn('The following meeting has been cancelled:')}
    ${row('Lead', leadName)}
    ${row('Was scheduled for', [meetingDate, meetingTime].filter(Boolean).join(' · '))}
    ${row('Mode', mode)}
    ${row('Cancelled By', cancelledBy)}
    ${reason ? `<div class="label">Reason</div><div class="reason-box">${esc(reason)}</div>` : ''}
    <br/><span class="badge badge-red">Cancelled</span>
    <br/>
    ${button('Open lead in AltLeads', data)}
    <p class="note">Follow up with the contact to find a new time when you can.</p>
  `);
}

function approvalRequested(data) {
  const { leadName = 'N/A', agentName = '', leadNumber = '' } = data;
  const leadLabel = leadName + (leadNumber ? ` (${leadNumber})` : '');
  return wrap('Approval Required — AltLeads', `
    <h2 style="margin-top:0;color:#1A7EE8;font-size:20px;">A lead report needs your approval</h2>
    ${greeting(data)}
    ${leadIn(`${agentName ? `${esc(agentName)} has submitted` : 'A lead report has been submitted'} a report for your review.`)}
    ${row('Lead', leadLabel)}
    ${row('Submitted By', agentName)}
    <span class="badge badge-yellow">Pending Approval</span>
    <br/>
    ${button('Review & approve', data)}
    <p class="note">Please review and approve or send it back with feedback at your earliest convenience.</p>
  `);
}

function approvalApproved(data) {
  const { leadName = 'N/A', leadNumber = '', approvedByName = '' } = data;
  const leadLabel = leadName + (leadNumber ? ` (${leadNumber})` : '');
  return wrap('Lead Report Approved — AltLeads', `
    <h2 style="margin-top:0;color:#065F46;font-size:20px;">Your report was approved 🎉</h2>
    ${greeting(data)}
    ${leadIn(`Good news — your lead report has been approved${approvedByName ? ` by ${esc(approvedByName)}` : ''} and the meeting is scheduled.`)}
    ${row('Lead', leadLabel)}
    ${row('Approved By', approvedByName)}
    <span class="badge badge-green">Approved — Meeting Scheduled</span>
    <br/>
    ${button('View lead', data)}
    <p class="note">Nice work. Prepare for the meeting and keep the momentum going.</p>
  `);
}

function approvalRejected(data) {
  const { leadName = 'N/A', leadNumber = '', reason = '', rejectedByName = '' } = data;
  const leadLabel = leadName + (leadNumber ? ` (${leadNumber})` : '');
  return wrap('Lead Report Needs Changes — AltLeads', `
    <h2 style="margin-top:0;color:#991B1B;font-size:20px;">Your report needs a few changes</h2>
    ${greeting(data)}
    ${leadIn(`Your lead report was sent back${rejectedByName ? ` by ${esc(rejectedByName)}` : ''} with feedback. Please update it and resubmit.`)}
    ${row('Lead', leadLabel)}
    ${row('Reviewed By', rejectedByName)}
    ${reason ? `<div class="label">What to fix</div><div class="reason-box">${esc(reason)}</div>` : ''}
    <br/><span class="badge badge-red">Changes Requested</span>
    <br/>
    ${button('Edit & resubmit', data)}
    <p class="note">Address the feedback above and resubmit — you've got this.</p>
  `);
}

/* ── Task reminder (single task) ───────────────────────────────── */

function taskTypeBadge(taskType) {
  const t = String(taskType || '').toUpperCase();
  if (t === 'CALL')    return '<span class="badge badge-blue">Call</span>';
  if (t === 'MEETING') return '<span class="badge badge-yellow">Meeting</span>';
  return '<span class="badge badge-blue">To-do</span>';
}

function taskReminder(data) {
  const {
    subject: taskSubject = 'A task',
    taskType = 'TODO',
    dueLabel = '',          // pre-formatted IST due time, e.g. "Today, 5:00 PM IST"
    body = '',
    assocLabel = '',        // linked lead/company/contact name
    assocPhone = '',
    priority = '',
  } = data;
  return wrap('Task Reminder — AltLeads', `
    <h2 style="margin-top:0;color:#1A7EE8;font-size:20px;">A task is due</h2>
    ${greeting(data)}
    ${leadIn('This is a reminder for a task on your list in AltLeads:')}
    ${row('Task', taskSubject)}
    ${row('Due', dueLabel)}
    ${row('Related to', assocLabel)}
    ${row('Phone', assocPhone)}
    ${row('Priority', priority)}
    ${body ? `<div class="label">Notes</div><div class="reason-box">${esc(body)}</div><br/>` : ''}
    ${taskTypeBadge(taskType)}
    <br/>
    ${button('Open task in AltLeads', data)}
    <p class="note">Mark it done, snooze it, or jump to the linked record straight from your tasks.</p>
  `);
}

/* ── Task daily digest (opt-in) ────────────────────────────────── */

function taskDigest(data) {
  const { tasks = [], dateLabel = '' } = data;
  const items = Array.isArray(tasks) ? tasks : [];
  const rows = items.map((t) => {
    const subj = esc(t.subject || 'Task');
    const due = t.dueLabel ? `<span style="color:#888;">${esc(t.dueLabel)}</span>` : '';
    const overdue = t.overdue ? ' <span class="badge badge-red">Overdue</span>' : '';
    const assoc = t.assocLabel ? `<div style="font-size:13px;color:#555;">${esc(t.assocLabel)}</div>` : '';
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #EEF1F5;">
      <div style="font-size:15px;color:#111;font-weight:600;">${subj}${overdue}</div>
      ${assoc}
      <div style="font-size:13px;">${due}</div>
    </td></tr>`;
  }).join('');
  return wrap('Your tasks for today — AltLeads', `
    <h2 style="margin-top:0;color:#1A7EE8;font-size:20px;">Your tasks${dateLabel ? ` for ${esc(dateLabel)}` : ' for today'}</h2>
    ${greeting(data)}
    ${leadIn(`You have <strong>${items.length}</strong> open task${items.length === 1 ? '' : 's'} due today or overdue. Here they are:`)}
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <br/>
    ${button('Open my tasks', data)}
    <p class="note">You're getting this daily summary because you opted in. You can turn it off any time in Settings.</p>
  `);
}

/* ── HTML escape utility ───────────────────────────────────────── */

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Subject lines ─────────────────────────────────────────────── */

function subject(event, data) {
  const lead = data.leadName || 'Lead';
  switch (event) {
    case 'lead_assigned':       return `[AltLeads] New lead assigned to you: ${lead}`;
    case 'lead_reassigned':     return `[AltLeads] A lead was moved to you: ${lead}`;
    case 'meeting_scheduled':   return `[AltLeads] Meeting confirmed: ${lead}`;
    case 'meeting_rescheduled': return `[AltLeads] Meeting time changed: ${lead}`;
    case 'meeting_cancelled':   return `[AltLeads] Meeting cancelled: ${lead}`;
    case 'approval_requested':  return `[AltLeads] Approval needed: ${lead}`;
    case 'approval_approved':   return `[AltLeads] Approved — meeting scheduled: ${lead}`;
    case 'approval_rejected':   return `[AltLeads] Changes requested on your report: ${lead}`;
    case 'task_reminder':       return `[AltLeads] Task due: ${data.subject || 'A task'}`;
    case 'task_digest': {
      const n = Array.isArray(data.tasks) ? data.tasks.length : 0;
      return `[AltLeads] You have ${n} task${n === 1 ? '' : 's'} due today`;
    }
    default:                    return `[AltLeads] Notification`;
  }
}

/* ── Main export ───────────────────────────────────────────────── */

function buildEmail(event, data) {
  let html;
  switch (event) {
    case 'lead_assigned':       html = leadAssigned(data);       break;
    case 'lead_reassigned':     html = leadReassigned(data);     break;
    case 'meeting_scheduled':   html = meetingScheduled(data);    break;
    case 'meeting_rescheduled': html = meetingRescheduled(data);  break;
    case 'meeting_cancelled':   html = meetingCancelled(data);    break;
    case 'approval_requested':  html = approvalRequested(data);  break;
    case 'approval_approved':   html = approvalApproved(data);   break;
    case 'approval_rejected':   html = approvalRejected(data);   break;
    case 'task_reminder':       html = taskReminder(data);       break;
    case 'task_digest':         html = taskDigest(data);         break;
    default:
      html = wrap('AltLeads Notification', `${greeting(data)}<p>You have a new notification from AltLeads.</p>`);
  }
  return { subject: subject(event, data), html };
}

module.exports = { buildEmail };
