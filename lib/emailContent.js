// Generates email subject/body templates (one per audience + touch level) and a
// Mailchimp-ready contacts CSV export. This is not a sending integration — there's
// no email API/account wired up. The workflow is: copy a template into a new
// Mailchimp campaign, import the exported CSV into a Mailchimp audience, map its
// columns to the merge fields below (create the custom ones once in Mailchimp's
// Audience → Settings → Merge fields), then Mailchimp sends the actual emails.
//
// Merge tags used: *|FNAME|* is a Mailchimp default field. *|ADDR|*, *|PERMIT|*,
// and *|PTYPE|* are custom fields — create them in Mailchimp once (any short
// text type) before importing, then map the matching CSV column to each
// during import.

import { PARTNER_AUDIENCES } from './partnerLetters';

const HOMEOWNER_EMAIL = {
  1: {
    subject: 'Your Permit at *|ADDR|* Has Expired — Here’s How We Can Help',
    body:
      'Hi *|FNAME|*,\n\n' +
      'Our records show that a permit tied to your property at *|ADDR|* has expired without ' +
      'a final inspection or closed status. We’re reaching out because this is still simple to ' +
      'resolve while it’s fresh — waiting only makes it harder when it surfaces at a sale, ' +
      'refinance, or insurance renewal.\n\n' +
      'The Permit Closer researches the exact status with the local building department, ' +
      'coordinates any re-inspection or contractor sign-off needed, and works with a licensed ' +
      'general contractor to handle any corrections — so you don’t have to manage any of it yourself.\n\n' +
      'Permit Number: *|PERMIT|*\nPermit Type: *|PTYPE|*\n\n' +
      'Reply to this email or call 561-888-3805 and we’ll take it from here.\n\n' +
      'The Permit Closer Team\nA division of Majestic Permits LLC\nthepermitcloser.com',
  },
  2: {
    subject: 'Following Up — Permit at *|ADDR|* Still Shows Expired',
    body:
      'Hi *|FNAME|*,\n\n' +
      'Just following up on the expired permit at *|ADDR|*. Our records still show no final ' +
      'inspection or closure on file — the longer it sits open, the more it can complicate a ' +
      'future sale, refinance, or insurance claim.\n\n' +
      'We’re ready to help whenever you are — reply to this email or call 561-888-3805.\n\n' +
      'The Permit Closer Team\nA division of Majestic Permits LLC\nthepermitcloser.com',
  },
  3: {
    subject: 'Final Notice — Permit at *|ADDR|*',
    body:
      'Hi *|FNAME|*,\n\n' +
      'This is our final email regarding the permit at *|ADDR|*, which remains expired and ' +
      'unresolved on our records. Unresolved permits are a matter of public record and can ' +
      'surface unexpectedly during a title search, sale, refinance, or insurance inspection.\n\n' +
      'If you’d like help resolving it, reply to this email or call 561-888-3805 — we’re glad ' +
      'to help whenever you’re ready.\n\n' +
      'The Permit Closer Team\nA division of Majestic Permits LLC\nthepermitcloser.com',
  },
};

function partnerEmail(info, level) {
  const brandName = info.brand?.brandShortName || 'The Permit Closer';
  const website = info.brand?.website || 'thepermitcloser.com';
  const signOff = info.brand?.signOffName || 'The Permit Closer Team';
  const signOffSub = info.brand?.signOffSub || 'A division of Majestic Permits LLC';
  const sig = `${signOff}\n${signOffSub}\n${website}`;

  if (level === 2) {
    return {
      subject: `Following Up — ${info.tagline}`,
      body:
        `Hi *|FNAME|*,\n\nJust following up to make sure you have our information on hand. ` +
        `${info.reminderLine}\n\nReply to this email any time — we’re glad to help whenever a ` +
        `permit issue comes up.\n\n${sig}`,
    };
  }
  if (level === 3) {
    return {
      subject: `Staying in Touch — ${brandName}`,
      body:
        `Hi *|FNAME|*,\n\nNo pressure — just wanted to stay on your radar. If a permit issue ` +
        `ever threatens to slow down a deal, we would welcome the chance to help.\n\n${sig}`,
    };
  }
  return {
    subject: info.tagline,
    body:
      `Hi *|FNAME|*,\n\n${info.painPoint} ${brandName} exists to solve exactly that problem — ` +
      `${info.valueOneLiner}.\n\nKeep our information on hand for your next transaction — reply ` +
      `to this email or give us a call, and we’ll take it from there.\n\n${sig}`,
  };
}

// Returns { subject, body } for the given audience key + touch level (1/2/3).
export function getEmailTemplate(audienceKey, level) {
  if (audienceKey === 'homeowner') {
    return HOMEOWNER_EMAIL[level] || HOMEOWNER_EMAIL[1];
  }
  const info = PARTNER_AUDIENCES[audienceKey];
  if (!info) return HOMEOWNER_EMAIL[1];
  return partnerEmail(info, level);
}

function csvEscape(v) {
  return `"${String(v || '').replace(/"/g, '""')}"`;
}

// Builds a Mailchimp-importable CSV of the given leads (already filtered to one
// audience tab). Column headers are human-readable — map them to Mailchimp merge
// fields (FNAME, and the custom ADDR/PERMIT/PTYPE/COMPANY fields) during import.
export function leadsToMailchimpCsv(leads, isHomeowner) {
  const headers = isHomeowner
    ? ['Email Address', 'First Name', 'Full Name', 'Address', 'Permit Number', 'Permit Type', 'Phone']
    : ['Email Address', 'First Name', 'Company / Contact', 'Address', 'Phone'];

  const rows = leads.filter(l => l.email).map(l => {
    const first = (l.name || '').split(/[\s—-]/)[0] || '';
    return isHomeowner
      ? [l.email, first, l.name, l.address, l.permit_number, l.permit_type, l.contact]
      : [l.email, first, l.name, l.address, l.contact];
  });

  return [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');
}
