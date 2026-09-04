// Generates email subject/body templates (one per audience + touch level) and a
// Mailchimp-ready contacts CSV export. This is not a sending integration — there's
// no email API/account wired up. The workflow is: copy a template into a new
// Mailchimp campaign, import the exported CSV into a Mailchimp audience, map its
// columns to the merge fields below, then Mailchimp sends the actual emails.
//
// Merge tags used: *|FNAME|* is a Mailchimp default field. *|ADDR|*, *|PERMIT|*,
// and *|PTYPE|* are custom fields.

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

const PERMIT_AIO_EMAIL = {
  1: {
    subject: '*|FNAME|*, stop filling out permits by hand',
    body:
      'Hi *|FNAME|*,\n\n' +
      'Most window, door, and roofing shops we sit with are still running permits the old way: ' +
      'a folder on the desk, a spreadsheet two weeks behind, a city login only one person remembers, ' +
      'and an HOA packet waiting on a floor plan, a design-pressure sheet, or an NOA.\n\n' +
      'Crews are ready. The paperwork is not. That is a system problem — not a staffing problem.\n\n' +
      'Permit AIO is the platform we built for that shop. One dashboard for every permit and HOA. ' +
      'The package assembled for you. Follow-ups that age on the job instead of living in someone’s inbox. ' +
      'Reports for the homeowner, the HOA, and the owner — generated from the live file, not typed from memory.\n\n' +
      'What that looks like in a typical shop:\n' +
      '• Permit admin: about 16 hours a week by hand → about 3 hours inside Permit AIO\n' +
      '• That time at $40/hour: roughly $32,000 a year → about $6,000\n' +
      '• Jobs one coordinator can keep current: 12–18 → 35–45\n\n' +
      'Those are working numbers from South Florida shops, not a guarantee. They are what happens when ' +
      'the same person stops hunting files and starts working a list.\n\n' +
      'We will load your open jobs and run the first two weeks with your coordinator so the dashboard ' +
      'matches how you already work. Reply with how many permits you have open and who owns the paperwork. ' +
      'Or call 561-888-3805.\n\n' +
      'The Permit AIO Team\nA Majestic Construction Permits LLC company\npermitaio.com',
  },
  2: {
    subject: 'Your coordinator is still the permit department — that is the bottleneck',
    body:
      'Hi *|FNAME|*,\n\n' +
      'Checking back in. The expensive part of permitting is not the first submittal. It is the second, ' +
      'third, and fourth touch — the city asked for a revised NOA, the HOA went quiet, the homeowner wants ' +
      'a screenshot. By hand, that lives in one inbox. When that person is out, the pipeline stops.\n\n' +
      'Permit AIO puts a next action and a date on every job. When it ages, it surfaces. Follow-up becomes ' +
      'a list, not a memory — which is how one coordinator covers more than twice the jobs without dropping ' +
      'the ones already in review.\n\n' +
      'If you want the two-week setup on a job you already have in motion, reply to this email or call 561-888-3805.\n\n' +
      'The Permit AIO Team\nA Majestic Construction Permits LLC company\npermitaio.com',
  },
  3: {
    subject: 'Permitting is still stuck in 1998. Your shop does not have to be.',
    body:
      'Hi *|FNAME|*,\n\n' +
      'Last note from us for now. Building departments will keep taking paper and packets assembled by hand. ' +
      'That will not change this year.\n\n' +
      'What can change is your side of the counter: no handwritten checklists, no “I think we submitted that ' +
      'last month,” no single person who is the entire permit department because they are the only one who ' +
      'knows where the files are.\n\n' +
      'Permit AIO is how a modern window, door, or roofing shop meets an old process — structured, searchable, ' +
      'and ready when the city asks for the thing you already have.\n\n' +
      'When you want a live workspace on the jobs you have open today, we are here. 561-888-3805.\n\n' +
      'The Permit AIO Team\nA Majestic Construction Permits LLC company\npermitaio.com',
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

export function getEmailTemplate(audienceKey, level) {
  if (audienceKey === 'homeowner') {
    return HOMEOWNER_EMAIL[level] || HOMEOWNER_EMAIL[1];
  }
  if (audienceKey === 'contractor_permitaio') {
    return PERMIT_AIO_EMAIL[level] || PERMIT_AIO_EMAIL[1];
  }
  const info = PARTNER_AUDIENCES[audienceKey];
  if (!info) return HOMEOWNER_EMAIL[1];
  return partnerEmail(info, level);
}

function csvEscape(v) {
  return `"${String(v || '').replace(/"/g, '""')}"`;
}

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
