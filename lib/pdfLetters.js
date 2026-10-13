// Draws the escalating notice letters (First / Second / Third).
// Address stays at the #10 window position.
// No filled black banner at the top — a plain text header only.
// Details box wraps long values so permit type cannot run into the dates.
// County dumps store owners as LAST FIRST; letters flip that for the envelope and greeting.

export const PAGE_W = 215.9, PAGE_H = 279.4;
export const mm = (inches) => inches * 25.4;

const LEVELS = {
  1: {
    eyebrow: 'COURTESY NOTICE',
    tag: 'FIRST NOTICE',
    tagStyle: 'outline',
    intent: 'Our records show that a permit tied to your property has expired without a final inspection or closed status. This is the first notice we are sending to make you aware of the situation while it is still simple to resolve.',
    urgency: 'Acting now, while the fix is straightforward, is always easier than waiting until it affects a sale, refinance, or insurance renewal.',
    urgencyBold: false,
  },
  2: {
    eyebrow: 'SECOND NOTICE \u2014 STILL UNRESOLVED',
    tag: 'SECOND NOTICE',
    tagStyle: 'gray',
    intent: 'This is our second notice regarding the expired permit on your property. Our records still show no final inspection or closure on file. The longer an expired permit sits open, the more it can complicate a future sale, refinance, or insurance claim.',
    urgency: 'We recommend addressing this before it becomes a larger, more costly issue at closing or renewal time.',
    urgencyBold: true,
  },
  3: {
    eyebrow: 'THIRD & FINAL NOTICE',
    tag: 'FINAL NOTICE',
    tagStyle: 'solid',
    intent: 'This is our final notice. The permit referenced below remains expired and unresolved on our records. Unresolved permits are a matter of public record and can surface unexpectedly during a title search, sale, refinance, or insurance inspection.',
    urgency: 'This is your last courtesy notice from our office. After this, we will assume you have chosen to handle the matter independently or through another party.',
    urgencyBold: true,
  },
};

const HELP_POINTS = [
  'We research the exact status of the permit with the local building department on your behalf.',
  'We coordinate any required re-inspection, documentation, or contractor sign-off.',
  'We work with a licensed general contractor to handle any repairs or corrections needed to close out the permit.',
  'We manage the closure process from start to finish so the permit no longer shows as open.',
  'We keep you informed at every step, with no obligation until you decide to move forward.',
];

const NAME_SUFFIXES = new Set(['JR', 'SR', 'II', 'III', 'IV', 'V', 'TR', 'TRUST', 'TRUSTEE', 'TTEE', 'ESQ']);
const LAST_PREFIXES = new Set(['DE', 'DEL', 'DELA', 'VAN', 'VON', 'DA', 'DI', 'ST', 'SAN']);
const ENTITY = /\b(LLC|INC|CORP|LP|LTD|LLP|PLLC|HOA|ASSOCIATION)\b/i;
const STREET = /^(?:\d+\s)|\b(?:ST|AVE|AVENUE|BLVD|RD|CT|LN|TER|CIR|HWY|PL|DR|WAY|TRAIL|TRL)\b/i;

function titleWord(word) {
  const up = word.toUpperCase().replace(/\./g, '');
  if (up === 'JR' || up === 'SR' || up === 'II' || up === 'III' || up === 'IV' || up === 'V') return up === 'JR' || up === 'SR' ? up[0] + up.slice(1).toLowerCase() : up;
  if (up === 'TRUST') return 'Trust';
  if (up === 'TRUSTEE' || up === 'TTEE') return 'Trustee';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function flipPerson(part) {
  const words = String(part || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words.map(titleWord).join(' ');
  const suffixes = [];
  const core = words.slice();
  while (core.length > 1 && NAME_SUFFIXES.has(core[core.length - 1].toUpperCase().replace(/\./g, ''))) {
    suffixes.unshift(core.pop());
  }
  if (core.length < 2) return words.map(titleWord).join(' ');
  let lastCount = 1;
  if (LAST_PREFIXES.has(core[0].toUpperCase()) && core.length > 2) lastCount = 2;
  const last = core.slice(0, lastCount);
  const given = core.slice(lastCount);
  if (!given.length) return words.map(titleWord).join(' ');
  return [...given, ...last, ...suffixes].map(titleWord).join(' ');
}

function firstGiven(display) {
  const token = String(display || '').split(/\s+/)[0] || '';
  return token.length > 1 ? token : 'Property Owner';
}

export function ownerLetterName(raw) {
  const name = String(raw || '').trim();
  if (!name) return { display: '', greeting: 'Property Owner' };
  if (/^\d/.test(name) || STREET.test(name)) return { display: name, greeting: 'Property Owner' };
  if (ENTITY.test(name) && !name.includes('&')) return { display: name, greeting: 'Property Owner' };
  const people = name.split(/\s*&\s*/).map(flipPerson).filter(Boolean);
  const display = people.join(' & ');
  return { display, greeting: firstGiven(people[0]) };
}

export function wrapText(doc, text, x, y, maxWidth, opts) {
  const { font = 'helvetica', style = 'normal', size = 10, leading = 14.5 } = opts;
  doc.setFont(font, style);
  doc.setFontSize(size);
  const words = String(text || '').split(' ');
  let line = '';
  for (const w of words) {
    const test = (line + ' ' + w).trim();
    if (doc.getTextWidth(test) > maxWidth && line) {
      doc.text(line, x, y);
      y += leading;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) { doc.text(line, x, y); y += leading; }
  return y;
}

function wrapLines(doc, text, maxWidth, size) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = (line + ' ' + w).trim();
    if (doc.getTextWidth(test) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function shortPermitType(type) {
  const raw = String(type || '').trim();
  if (!raw) return 'N/A';
  const head = raw.split(' - ')[0].trim();
  return head || raw;
}

export function drawQRCode(doc, text, x, y, size) {
  if (typeof window === 'undefined' || !window.qrcode) return;
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 2;
  const cell = size / (count + quiet * 2);
  doc.setFillColor(0, 0, 0);
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        doc.rect(x + (col + quiet) * cell, y + (row + quiet) * cell, cell, cell, 'F');
      }
    }
  }
}

export function drawSeal(doc, cx, cy, r) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, r, 'FD');
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r * 0.58 : r * 0.24;
    pts.push([cx + rad * Math.cos(ang), cy - rad * Math.sin(ang)]);
  }
  doc.setFillColor(0, 0, 0);
  doc.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], 'F', true);
}

export function drawLetterBanner(doc, { tag, tagStyle, subhead = 'Independent Permit Resolution Service', wordmark = 'THE PERMIT CLOSER' }) {
  const W = PAGE_W;
  const top = mm(0.42);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(wordmark, mm(0.85), top);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(92, 92, 92);
  doc.text(subhead, mm(0.85), top + mm(0.16));

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  const tagW = doc.getTextWidth(tag) + mm(0.28);
  const tagX = W - mm(0.85) - tagW;
  const tagY = top - mm(0.16);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4);
  if (tagStyle === 'solid') {
    doc.setFillColor(0, 0, 0);
    doc.roundedRect(tagX, tagY, tagW, mm(0.26), 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
  } else if (tagStyle === 'gray') {
    doc.setFillColor(232, 232, 232);
    doc.roundedRect(tagX, tagY, tagW, mm(0.26), 1, 1, 'FD');
    doc.setTextColor(0, 0, 0);
  } else {
    doc.roundedRect(tagX, tagY, tagW, mm(0.26), 1, 1, 'S');
    doc.setTextColor(0, 0, 0);
  }
  doc.text(tag, tagX + tagW / 2, tagY + mm(0.17), { align: 'center' });

  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4);
  doc.line(mm(0.85), top + mm(0.28), W - mm(0.85), top + mm(0.28));
  doc.setTextColor(0, 0, 0);
  return top + mm(0.28);
}

export function drawDetailsBox(doc, boxTop, title, badge, fields) {
  const boxW = mm(6.8);
  const pad = mm(0.12);
  const colW = (boxW - pad) / fields.length;
  const valueSize = 9;
  const valueLeading = 4.2;
  const wrapped = fields.map(([, val]) => wrapLines(doc, val || 'N/A', colW - mm(0.12), valueSize));
  const maxLines = Math.max(1, ...wrapped.map((lines) => lines.length));
  const boxH = mm(0.62) + maxLines * valueLeading;

  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4);
  doc.roundedRect(mm(0.85), boxTop, boxW, boxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(title, mm(1.02), boxTop + mm(0.2));
  if (badge) doc.text(badge, mm(0.85) + boxW - mm(0.16), boxTop + mm(0.2), { align: 'right' });

  fields.forEach(([label], i) => {
    const fx = mm(1.02) + i * colW;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.setTextColor(92, 92, 92);
    doc.text(label, fx, boxTop + mm(0.42));
    doc.setFont('helvetica', 'bold'); doc.setFontSize(valueSize);
    doc.setTextColor(0, 0, 0);
    wrapped[i].forEach((line, li) => {
      doc.text(line, fx, boxTop + mm(0.58) + li * valueLeading);
    });
  });

  return boxTop + boxH;
}

export function drawSignatureAndFooter(doc, y, opts = {}) {
  const {
    signOffName = 'The Permit Closer Team',
    signOffSub = 'A division of Majestic Permits LLC',
    phone = '561-888-3805',
    areaLine = 'Serving Palm Beach, Broward, Miami-Dade & Martin Counties',
    website = 'thepermitcloser.com',
    qrUrl = 'https://thepermitcloser.com',
  } = opts;
  y += mm(0.11);
  if (qrUrl) {
    const qrSize = mm(0.6);
    const qrX = mm(7.65) - qrSize;
    const qrY = y - mm(0.05);
    drawQRCode(doc, qrUrl, qrX, qrY, qrSize);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    doc.setTextColor(92, 92, 92);
    doc.text('SCAN TO LEARN MORE', qrX + qrSize / 2, qrY + qrSize + mm(0.09), { align: 'center' });
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Sincerely,', mm(0.85), y);
  y += mm(0.42);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.text(signOffName, mm(0.85), y);
  y += mm(0.18);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.setTextColor(92, 92, 92);
  doc.text(signOffSub, mm(0.85), y);
  const barH = mm(0.42);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4);
  doc.line(0, PAGE_H - barH, PAGE_W, PAGE_H - barH);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  doc.text(`${phone}   \u2022   ${areaLine}`, PAGE_W / 2, PAGE_H - barH / 2 - 0.4, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.setTextColor(92, 92, 92);
  doc.text(website, PAGE_W / 2, PAGE_H - barH / 2 + 3.4, { align: 'center' });
}

export function drawHelpPoints(doc, y, heading, points, opts = {}) {
  const { size = 9.6, leading = 4.6 } = opts;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text(heading, mm(0.85), y);
  y += mm(0.22);
  points.forEach((pt) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(size);
    doc.text('\u2022', mm(0.85), y);
    doc.setFont('helvetica', 'normal');
    y = wrapText(doc, pt, mm(1.05), y, mm(6.55), { size, leading });
    y += mm(0.03);
  });
  return y;
}

export function drawNoticeLetter(doc, level, data) {
  const L = LEVELS[level];
  drawLetterBanner(doc, { tag: L.tag, tagStyle: L.tagStyle });
  const topY = (inches) => mm(inches);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(L.eyebrow, mm(0.85), topY(1.18));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Date of Notice: ' + (data.noticeDate || '________________'), mm(7.65), topY(1.18), { align: 'right' });

  doc.setTextColor(92, 92, 92);
  wrapText(doc,
    'This is a courtesy notice from The Permit Closer, a private permit resolution service. ' +
    'It is not issued by, and is not affiliated with, any city, county, or government building department.',
    mm(0.85), topY(1.4), mm(6.8), { font: 'helvetica', style: 'italic', size: 7.5, leading: 3.5 });

  const addrTop = 2.5;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
  doc.text(data.name || '', mm(0.9), topY(addrTop));
  doc.setFont('helvetica', 'normal');
  doc.text(data.addressLine1 || '', mm(0.9), topY(addrTop + 0.24));
  doc.text(data.addressLine2 || '', mm(0.9), topY(addrTop + 0.48));

  const reTop = 3.85;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.text('RE: Expired Permit \u2014 Permit #' + (data.permit || 'N/A'), mm(0.85), topY(reTop));

  let y = topY(reTop + 0.32);
  const first = data.greeting || (data.name || '').split(' ')[0] || 'Property Owner';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  doc.text(`Dear ${first},`, mm(0.85), y);
  y += mm(0.25);

  y = wrapText(doc, L.intent, mm(0.85), y, mm(6.8), { size: 10.3, leading: 5.1 });
  y += mm(0.05);
  y = wrapText(doc, L.urgency, mm(0.85), y, mm(6.8), { style: L.urgencyBold ? 'bold' : 'normal', size: 10.3, leading: 5.1 });
  y += mm(0.14);

  y = drawDetailsBox(doc, y, 'PERMIT NOTICE DETAILS', 'STATUS: EXPIRED', [
    ['PERMIT NUMBER', data.permit || 'N/A'],
    ['PERMIT TYPE', shortPermitType(data.type)],
    ['DATE ISSUED', data.issued || 'N/A'],
    ['DATE EXPIRED', data.expired || 'N/A'],
  ]);
  y += mm(0.28);

  y = drawHelpPoints(doc, y, 'How The Permit Closer Can Help', HELP_POINTS);
  drawSignatureAndFooter(doc, y);
}

export function splitAddress(fullAddress) {
  const parts = (fullAddress || '').split(',');
  if (parts.length <= 1) return { line1: fullAddress || '', line2: '' };
  return { line1: parts[0].trim(), line2: parts.slice(1).join(',').trim() };
}

export function leadToLetterData(lead) {
  const { line1, line2 } = splitAddress(lead.address);
  const owner = ownerLetterName(lead.name);
  return {
    name: owner.display,
    greeting: owner.greeting,
    addressLine1: line1,
    addressLine2: line2,
    permit: lead.permit_number,
    type: lead.permit_type,
    issued: lead.date_issued,
    expired: lead.date_expired,
    noticeDate: new Date().toLocaleDateString('en-US'),
  };
}
