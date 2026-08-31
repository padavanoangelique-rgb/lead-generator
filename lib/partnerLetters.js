// Draws partnership/introduction letters to referral partners (realtors &
// brokers, property managers, title companies) — same visual system as the
// homeowner notice letters (lib/pdfLetters.js), different tone: these are
// relationship-building outreach, not an escalating notice, so nothing here
// uses urgency language on the 2nd/3rd touch.

import {
  wrapText, drawLetterBanner, drawDetailsBox, drawSignatureAndFooter,
  drawHelpPoints, splitAddress, mm,
} from './pdfLetters';

export const PARTNER_AUDIENCES = {
  realtor_broker: {
    label: 'Realtors & Brokers',
    nameLabel: 'Contact / Brokerage Name',
    namePlaceholder: 'Jane Realtor — Coastal Realty Group',
    tagline: 'Your Permit Resolution Partner',
    painPoint:
      'An open or expired permit can surface during an inspection, a title search, or a ' +
      'buyer’s financing review — and it can delay or kill a closing that took months to put together.',
    valueOneLiner: 'we resolve permit issues fast enough to keep your closing on schedule',
    reminderLine:
      'Open and expired permits are more common than most agents expect — county records ' +
      'show thousands sitting unresolved at any given time.',
  },
  property_manager: {
    label: 'Property Managers',
    nameLabel: 'Contact / Company Name',
    namePlaceholder: 'Tom Manager — Sunview Property Management',
    tagline: 'Your Portfolio’s Permit Resolution Partner',
    painPoint:
      'Managing a portfolio means compliance issues surface across multiple properties at ' +
      'once — and an open permit on any one of them can complicate a refinance, an insurance ' +
      'renewal, or a unit turnover.',
    valueOneLiner: 'we manage permit resolution across your entire portfolio through a single point of contact',
    reminderLine:
      'One unresolved permit rarely stays a one-property problem for long — it tends to ' +
      'resurface at renewal, refinance, or turnover.',
  },
  title_company: {
    label: 'Title Companies',
    nameLabel: 'Contact / Title Company Name',
    namePlaceholder: 'Alicia Title — Coastal Title Co.',
    tagline: 'Resolving Permit Issues Before They Block Closing',
    painPoint:
      'An open or expired permit discovered during a title search can stall or kill a closing ' +
      'at the worst possible moment, after everything else is already in order.',
    valueOneLiner: 'we clear the permit issue fast enough for title to stay clean and the deal to close on schedule',
    reminderLine:
      'A permit flag rarely resolves itself before closing day — the sooner research starts, ' +
      'the more closing dates it saves.',
  },
  contractor_permitaio: {
    label: 'Contractors — Permit AIO',
    nameLabel: 'Contact / Company Name',
    namePlaceholder: 'Mike Rodriguez — Sunshine Roofing & Windows',
    tagline: 'The All-In-One Permit & Compliance Platform',
    painPoint:
      'Every window, door, and roofing job comes with its own permit package, HOA approval, ' +
      'and product documentation — and tracking it all across active jobs in spreadsheets and ' +
      'email threads is where deadlines get missed and jobs stall.',
    valueOneLiner:
      'Permit AIO tracks every permit and HOA approval in one place, assembles your permit ' +
      'package automatically — floor plans, design pressures, and NOA documentation included ' +
      '— and generates the reports you need without the manual busywork',
    reminderLine:
      'Every week spent tracking permits by hand is a week not spent running jobs — the ' +
      'busywork adds up fast across an active pipeline.',
    helpPoints: [
      'Tracks every permit and HOA approval across all your jobs in one dashboard.',
      'Assembles the full permit package for you — floor plans, design pressures, and NOA documentation.',
      'Generates the status reports you need for clients, HOAs, and your own records.',
      'Built specifically for window, door, and roofing companies — not a generic project tool.',
    ],
    glanceFields: [
      ['PLATFORM', 'Web-based'],
      ['TRACKS', 'Permits & HOA'],
      ['BUILT FOR', 'Window/Door/Roofing'],
    ],
    // TODO: confirm real domain/phone once you send the Permit AIO page — placeholder for now.
    brand: {
      brandShortName: 'Permit AIO',
      wordmark: 'PERMIT AIO',
      signOffName: 'The Permit AIO Team',
      signOffSub: 'A Majestic Permits company',
      website: 'permitaio.com',
      qrUrl: 'https://permitaio.com',
    },
  },
  contractor_majestic: {
    label: 'Contractors — Majestic Permits',
    nameLabel: 'Contact / Company Name',
    namePlaceholder: 'Mike Rodriguez — Sunshine Roofing & Windows',
    tagline: 'Your Full-Service Permit Expediter, Start to Finish',
    painPoint:
      'Pulling and tracking permits means time at the building department, on hold, and ' +
      'chasing corrections — time your crews aren’t spending on the job in front of them.',
    valueOneLiner:
      'Majestic Permits handles the entire permit process for you, start to finish, so your ' +
      'crews stay on the job instead of in line at the building department',
    reminderLine:
      'A permit delay is a crew delay — the sooner it’s in someone else’s hands, the sooner the job moves.',
    helpPoints: [
      'We pull and track every permit for your jobs from application through close-out.',
      'We handle corrections, re-submittals, and building department communication directly.',
      'We coordinate inspections and keep you updated at every step.',
      'One point of contact for every job, so nothing falls through the cracks.',
    ],
    brand: {
      brandShortName: 'Majestic Permits',
      wordmark: 'MAJESTIC PERMITS',
      signOffName: 'The Majestic Permits Team',
      signOffSub: 'Permit Expediting Services',
      website: 'majesticpermits.com',
      qrUrl: 'https://majesticpermits.com',
    },
  },
};

const HELP_POINTS = [
  'We research the exact status of the permit with the local building department, usually within days.',
  'We coordinate any required re-inspection, documentation, or contractor sign-off.',
  'We work with a licensed general contractor to handle any repairs or corrections needed to close it out.',
  'We keep you informed at every step, so you always know exactly where things stand.',
];

function levelContent(info, level) {
  const help = info.helpPoints || HELP_POINTS;
  if (level === 2) {
    return {
      eyebrow: 'FOLLOW-UP',
      tag: 'FOLLOW-UP',
      tagStyle: 'gray',
      intent: `Just following up to make sure you have our information on hand. ${info.reminderLine}`,
      help: help.slice(0, 3),
      cta: 'Save this letter or add us to your contact list — one call is usually all it takes to get a resolution moving.',
    };
  }
  if (level === 3) {
    return {
      eyebrow: 'STAYING IN TOUCH',
      tag: 'STAYING IN TOUCH',
      tagStyle: 'solid',
      intent: 'No pressure — just wanted to stay on your radar. If a permit issue ever threatens to slow down a deal, we would welcome the chance to help.',
      help: help.slice(0, 2),
      cta: 'Feel free to reach out any time, even just to ask a quick question about a permit you’re seeing.',
    };
  }
  const brandName = info.brand?.brandShortName || 'The Permit Closer';
  return {
    eyebrow: 'PARTNERSHIP INTRODUCTION',
    tag: 'INTRODUCTION',
    tagStyle: 'outline',
    intent: `${info.painPoint} ${brandName} exists to solve exactly that problem — ${info.valueOneLiner}.`,
    help,
    cta: 'Keep our information on hand for your next transaction — call us the moment a permit issue surfaces so it doesn’t cost you the deal.',
  };
}

export function drawPartnerLetter(doc, audienceKey, level, data) {
  const info = PARTNER_AUDIENCES[audienceKey];
  const brandName = info.brand?.brandShortName || 'The Permit Closer';
  const L = levelContent(info, level);

  drawLetterBanner(doc, { eyebrow: L.eyebrow, tag: L.tag, tagStyle: L.tagStyle, subhead: info.tagline, wordmark: info.brand?.wordmark });
  const topY = (inches) => mm(inches);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(L.eyebrow, mm(0.85), topY(1.18));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Date: ' + (data.noticeDate || '________________'), mm(7.65), topY(1.18), { align: 'right' });

  doc.setTextColor(92, 92, 92);
  wrapText(doc,
    `${brandName} is not affiliated with any city, county, or government building department.`,
    mm(0.85), topY(1.4), mm(6.8), { font: 'helvetica', style: 'italic', size: 7.5, leading: 3.5 });

  // Address block — standard #10 window position
  const addrTop = 2.5;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
  doc.text(data.name || '', mm(0.9), topY(addrTop));
  doc.setFont('helvetica', 'normal');
  doc.text(data.addressLine1 || '', mm(0.9), topY(addrTop + 0.24));
  doc.text(data.addressLine2 || '', mm(0.9), topY(addrTop + 0.48));

  const reTop = 3.85;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.text('RE: ' + info.tagline, mm(0.85), topY(reTop));

  let y = topY(reTop + 0.32);
  const first = (data.name || '').split(/[\s—-]/)[0] || 'there';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  doc.text(`Hi ${first},`, mm(0.85), y);
  y += mm(0.25);

  y = wrapText(doc, L.intent, mm(0.85), y, mm(6.8), { size: 10.3, leading: 5.1 });
  y += mm(0.14);

  y = drawDetailsBox(doc, y, `${brandName.toUpperCase()} AT A GLANCE`, null, info.glanceFields || [
    ['SERVICE AREA', 'PBC/Broward/Dade/Martin'],
    ['RESPONSE TIME', 'Same week'],
    ['CONTRACTOR', 'Licensed & insured'],
  ]);
  y += mm(0.28);

  y = drawHelpPoints(doc, y, `How ${brandName} Can Help`, L.help);
  y += mm(0.05);
  y = wrapText(doc, L.cta, mm(0.85), y, mm(6.8), { style: 'bold', size: 10, leading: 4.8 });

  drawSignatureAndFooter(doc, y, info.brand);
}

export function leadToPartnerLetterData(lead) {
  const { line1, line2 } = splitAddress(lead.address);
  return {
    name: lead.name,
    addressLine1: line1,
    addressLine2: line2,
    noticeDate: new Date().toLocaleDateString('en-US'),
  };
}
