'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { drawNoticeLetter, leadToLetterData } from '../lib/pdfLetters';
import { PARTNER_AUDIENCES, drawPartnerLetter, leadToPartnerLetterData } from '../lib/partnerLetters';
import { normalizeImportRows } from '../lib/leadImport';
import { getEmailTemplate, leadsToMailchimpCsv } from '../lib/emailContent';

const COUNTIES = ['Palm Beach County', 'Broward County', 'Miami-Dade County', 'Martin County'];

// One tab per audience/goal this tool generates leads and letters for.
// "homeowner" is the original expired-permit notice flow; the rest are
// referral-partner outreach (lib/partnerLetters.js) sharing the same
// leads/letters/tracking mechanism with different copy and fields.
const AUDIENCES = [
  {
    key: 'homeowner', kind: 'homeowner', label: 'Homeowners',
    nameLabel: 'Homeowner Name', namePlaceholder: 'Jane Homeowner',
    addressLabel: 'Property Address',
  },
  ...Object.entries(PARTNER_AUDIENCES).map(([key, info]) => ({
    key, kind: 'partner', label: info.label,
    nameLabel: info.nameLabel, namePlaceholder: info.namePlaceholder,
    addressLabel: 'Business Mailing Address',
  })),
];

function audienceConfig(key) {
  return AUDIENCES.find(a => a.key === key) || AUDIENCES[0];
}

function emptyFormFor(audienceKey) {
  return {
    audience: audienceKey,
    name: '', address: '', county: '', permit_number: '', permit_type: 'Building',
    date_issued: '', date_expired: '', contact: '', email: '', notes: '',
  };
}

// Dispatches to the right PDF drawing function based on the lead's audience.
function drawLetterForLead(doc, lead, level) {
  const aud = audienceConfig(lead.audience || 'homeowner');
  if (aud.kind === 'homeowner') {
    drawNoticeLetter(doc, level, leadToLetterData(lead, level));
  } else {
    drawPartnerLetter(doc, lead.audience, level, leadToPartnerLetterData(lead));
  }
}

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

function computeStage(lead, followUpDays) {
  // Returns { label, kind, nextLevel } describing what's due, if anything.
  if (lead.status === 'converted') return { label: 'Converted', kind: 'sale', nextLevel: null };
  if (lead.status === 'closed') return { label: 'Closed', kind: 'pending', nextLevel: null };

  if (!lead.first_notice_date) return { label: 'Not Sent', kind: 'pending', nextLevel: 1 };

  if (!lead.second_notice_date) {
    const age = daysAgo(lead.first_notice_date);
    if (age >= followUpDays) return { label: '2nd Notice Due', kind: 'due', nextLevel: 2 };
    return { label: `Waiting (${followUpDays - age}d)`, kind: 'pending', nextLevel: null };
  }
  if (!lead.third_notice_date) {
    const age = daysAgo(lead.second_notice_date);
    if (age >= followUpDays) return { label: '3rd Notice Due', kind: 'due', nextLevel: 3 };
    return { label: `Waiting (${followUpDays - age}d)`, kind: 'pending', nextLevel: null };
  }
  return { label: 'All Sent', kind: 'pending', nextLevel: null };
}

function todayIso() { return new Date().toISOString().slice(0, 10); }

export default function LeadsPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [leads, setLeads] = useState([]);
  const [settings, setSettings] = useState({ follow_up_days: 60, postage_rate: 0.78 });
  const [activeAudience, setActiveAudience] = useState('homeowner');
  const [search, setSearch] = useState('');
  const [statFilter, setStatFilter] = useState(null);
  const [showEntry, setShowEntry] = useState(false);
  const [form, setForm] = useState(emptyFormFor('homeowner'));
  const [genStatus, setGenStatus] = useState(null);
  const [bulkRows, setBulkRows] = useState([]);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [bulkStatus, setBulkStatus] = useState(null);
  const [fileName, setFileName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [importCounty, setImportCounty] = useState('');
  const [convertLead, setConvertLead] = useState(null);
  const [jobValue, setJobValue] = useState('');
  const [emailLevel, setEmailLevel] = useState(1);
  const [emailCopyStatus, setEmailCopyStatus] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) router.push('/login');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      if (!sess) router.push('/login');
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const loadData = useCallback(async () => {
    const { data: leadRows } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    setLeads(leadRows || []);
    const { data: s } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (s) setSettings(s);
  }, []);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  const activeConfig = audienceConfig(activeAudience);
  const isHomeowner = activeConfig.kind === 'homeowner';

  function switchAudience(key) {
    setActiveAudience(key);
    setStatFilter(null);
    setShowEntry(false);
    setForm(emptyFormFor(key));
    setGenStatus(null);
    setBulkRows([]);
    setUploadStatus(null);
    setBulkStatus(null);
    setFileName('');
    setPasteText('');
    setEmailLevel(1);
    setEmailCopyStatus(null);
  }

  function copyEmailTemplate() {
    const { subject, body } = getEmailTemplate(activeAudience, emailLevel);
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
      .then(() => setEmailCopyStatus({ type: 'ok', text: 'Copied — paste into a new Mailchimp campaign.' }))
      .catch(() => setEmailCopyStatus({ type: 'err', text: 'Could not copy — select and copy the text manually.' }));
  }

  function exportMailchimpCsv() {
    const csv = leadsToMailchimpCsv(audienceLeads, isHomeowner);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeAudience}_mailchimp_contacts.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Stats (scoped to the active audience tab) ----------
  const audienceLeads = leads.filter(l => (l.audience || 'homeowner') === activeAudience);

  const stats = {
    total: audienceLeads.length,
    due: audienceLeads.filter(l => computeStage(l, settings.follow_up_days).kind === 'due').length,
    pending: audienceLeads.filter(l => {
      const s = computeStage(l, settings.follow_up_days);
      return s.kind === 'pending' && l.status !== 'converted' && l.status !== 'closed';
    }).length,
    converted: audienceLeads.filter(l => l.status === 'converted').length,
    notSent: audienceLeads.filter(l => computeStage(l, settings.follow_up_days).nextLevel === 1).length,
  };

  const visibleLeads = audienceLeads.filter(l => {
    if (statFilter === 'due' && computeStage(l, settings.follow_up_days).kind !== 'due') return false;
    if (statFilter === 'converted' && l.status !== 'converted') return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(`${l.name} ${l.address} ${l.permit_number}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // ---------- Manual entry ----------
  async function saveLead(fields) {
    const { data, error } = await supabase.from('leads').insert(fields).select().single();
    if (error) throw error;
    return data;
  }

  async function generateSingle(mode) {
    if (!form.name || !form.address) {
      setGenStatus({ type: 'err', text: 'Name and address are required.' });
      return;
    }
    try {
      const lead = await saveLead({ ...form, audience: activeAudience, first_notice_date: todayIso(), status: 'pending' });
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'letter' });
      drawLetterForLead(doc, lead, 1);
      if (mode === 'print') { doc.autoPrint(); window.open(doc.output('bloburl'), '_blank'); }
      else { doc.save(`${lead.name.replace(/\s+/g, '_')}_first_notice.pdf`); }
      setGenStatus({ type: 'ok', text: 'Letter generated and lead saved.' });
      setForm(emptyFormFor(activeAudience));
      loadData();
    } catch (err) {
      setGenStatus({ type: 'err', text: 'Error: ' + err.message });
    }
  }

  // ---------- Bulk import (file upload or pasted portal text) ----------
  // Flags rows that already exist in the active audience's leads (by permit number, or by
  // address when no permit number is given) so re-pulling the same list doesn't create duplicates.
  async function flagDuplicates(rows) {
    const { data } = await supabase.from('leads').select('permit_number,address').eq('audience', activeAudience);
    const existingPermits = new Set((data || []).map(d => d.permit_number).filter(Boolean));
    const existingAddrs = new Set((data || []).map(d => (d.address || '').trim().toLowerCase()).filter(Boolean));
    return rows.map(r => ({
      ...r,
      _dup: r.permit_number ? existingPermits.has(r.permit_number) : existingAddrs.has(r.address.trim().toLowerCase()),
    }));
  }

  async function normalizeRows(rawRows) {
    const rows = normalizeImportRows(rawRows, importCounty);

    if (!rows.length) {
      setUploadStatus({ type: 'err', text: 'No valid rows found — make sure name and address are filled in for each row.' });
      setBulkRows([]);
      return;
    }
    setUploadStatus({ type: 'info', text: 'Checking for duplicates already in your leads…' });
    const checked = await flagDuplicates(rows);
    const dupCount = checked.filter(r => r._dup).length;
    setUploadStatus({
      type: 'ok',
      text: `${checked.length} row${checked.length === 1 ? '' : 's'} loaded` +
        (dupCount ? ` — ${dupCount} already in your leads and will be skipped.` : ', all new.'),
    });
    setBulkRows(checked);
  }

  function handleFile(file) {
    setFileName(file.name);
    setPasteText('');
    setUploadStatus({ type: 'info', text: 'Reading file…' });
    setBulkRows([]);
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) {
      window.Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => normalizeRows(res.data),
        error: (err) => setUploadStatus({ type: 'err', text: 'Could not read CSV: ' + err.message }),
      });
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = window.XLSX.read(data, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          normalizeRows(window.XLSX.utils.sheet_to_json(sheet, { defval: '' }));
        } catch (err) {
          setUploadStatus({ type: 'err', text: 'Could not read Excel file: ' + err.message });
        }
      };
      reader.onerror = () => setUploadStatus({ type: 'err', text: 'Could not open the file.' });
      reader.readAsArrayBuffer(file);
    } else {
      setUploadStatus({ type: 'err', text: 'Unsupported file type — please upload a .csv, .xlsx, or .xls file.' });
    }
  }

  function parsePastedText() {
    if (!pasteText.trim()) return;
    setFileName('');
    setUploadStatus({ type: 'info', text: 'Parsing pasted text…' });
    setBulkRows([]);
    window.Papa.parse(pasteText.trim(), {
      header: true, skipEmptyLines: true, delimiter: '',
      complete: (res) => normalizeRows(res.data),
      error: (err) => setUploadStatus({ type: 'err', text: 'Could not parse pasted text: ' + err.message }),
    });
  }

  // mode: 'save-only' just imports leads (for a later, controlled mailing batch);
  // 'download'/'print' also stamps first_notice_date and generates the letters now.
  async function generateBulk(mode) {
    const rows = bulkRows.filter(r => !r._dup);
    if (!rows.length) return;
    try {
      const today = todayIso();
      const inserted = [];
      for (const row of rows) {
        const { _dup, ...fields } = row;
        const lead = await saveLead(
          mode === 'save-only'
            ? { ...fields, audience: activeAudience }
            : { ...fields, audience: activeAudience, first_notice_date: today }
        );
        inserted.push(lead);
      }
      const skipped = bulkRows.length - rows.length;
      const skippedNote = skipped ? ` (${skipped} duplicate${skipped === 1 ? '' : 's'} skipped)` : '';

      if (mode === 'save-only') {
        setBulkStatus({ type: 'ok', text: `${inserted.length} lead${inserted.length === 1 ? '' : 's'} saved${skippedNote}. Print their 1st notices any time from the Leads table below.` });
      } else {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'letter' });
        inserted.forEach((lead, i) => {
          if (i > 0) doc.addPage();
          drawLetterForLead(doc, lead, 1);
        });
        if (mode === 'print') { doc.autoPrint(); window.open(doc.output('bloburl'), '_blank'); }
        else { doc.save(`bulk_first_notices_${today}.pdf`); }
        setBulkStatus({ type: 'ok', text: `${inserted.length} letters ${mode === 'print' ? 'sent to print' : 'downloaded'} and leads saved${skippedNote}.` });
      }
      setBulkRows([]);
      setFileName('');
      setPasteText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadData();
    } catch (err) {
      setBulkStatus({ type: 'err', text: 'Error: ' + err.message });
    }
  }

  // ---------- Print a notice (1st for a saved-but-not-mailed lead, or 2nd/3rd follow-up) ----------
  const NOTICE_FIELD = { 1: 'first_notice_date', 2: 'second_notice_date', 3: 'third_notice_date' };
  async function printNotice(lead, level, mode) {
    try {
      const field = NOTICE_FIELD[level];
      const { data: updated, error } = await supabase.from('leads')
        .update({ [field]: todayIso() }).eq('id', lead.id).select().single();
      if (error) throw error;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'letter' });
      drawLetterForLead(doc, updated, level);
      if (mode === 'print') { doc.autoPrint(); window.open(doc.output('bloburl'), '_blank'); }
      else { doc.save(`${lead.name.replace(/\s+/g, '_')}_notice_${level}.pdf`); }
      loadData();
    } catch (err) {
      alert('Error printing notice: ' + err.message);
    }
  }

  // Batch-prints 1st notices for every imported lead still sitting at "Not Sent".
  async function printAllNotSent() {
    const targets = visibleLeads.filter(l => computeStage(l, settings.follow_up_days).nextLevel === 1);
    if (!targets.length) return;
    if (!confirm(`Print & mark 1st notice sent for ${targets.length} lead(s)?`)) return;
    try {
      const today = todayIso();
      const updated = [];
      for (const lead of targets) {
        const { data, error } = await supabase.from('leads')
          .update({ first_notice_date: today }).eq('id', lead.id).select().single();
        if (error) throw error;
        updated.push(data);
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'letter' });
      updated.forEach((lead, i) => {
        if (i > 0) doc.addPage();
        drawLetterForLead(doc, lead, 1);
      });
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
      loadData();
    } catch (err) {
      alert('Error printing batch: ' + err.message);
    }
  }

  // ---------- Convert to sale ----------
  async function confirmConvert() {
    if (!convertLead) return;
    try {
      await supabase.from('sales').insert({
        lead_id: convertLead.id,
        job_name: convertLead.permit_number
          ? `${convertLead.name} — Permit #${convertLead.permit_number}`
          : `${convertLead.name} — ${audienceConfig(convertLead.audience || 'homeowner').label}`,
        job_value: parseFloat(jobValue) || 0,
        status: 'in_progress',
        converted_date: todayIso(),
      });
      await supabase.from('leads').update({ status: 'converted' }).eq('id', convertLead.id);
      setConvertLead(null);
      setJobValue('');
      loadData();
    } catch (err) {
      alert('Error converting to sale: ' + err.message);
    }
  }

  async function closeLead(lead) {
    await supabase.from('leads').update({ status: 'closed' }).eq('id', lead.id);
    loadData();
  }

  if (!session) return null;

  return (
    <main>
      <div className="audience-tabs">
        {AUDIENCES.map(a => (
          <button
            key={a.key}
            type="button"
            className={`audience-tab${a.key === activeAudience ? ' active' : ''}`}
            onClick={() => switchAudience(a.key)}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="stats-bar">
        <div className="stat" onClick={() => setStatFilter(null)}><div className="num">{stats.total}</div><div className="label">Total Leads</div></div>
        <div className="stat" onClick={() => setStatFilter('due')}><div className="num">{stats.due}</div><div className="label">Follow-up Due</div></div>
        <div className="stat" onClick={() => setStatFilter(null)}><div className="num">{stats.pending}</div><div className="label">Pending</div></div>
        <div className="stat" onClick={() => setStatFilter('converted')}><div className="num">{stats.converted}</div><div className="label">Converted</div></div>
      </div>

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ marginBottom: 0 }}>Single Letter</h2>
          <button className="btn-outline btn-sm" onClick={() => setShowEntry(s => !s)}>{showEntry ? 'Hide' : 'New Lead'}</button>
        </div>
        {showEntry && (
          <div style={{ marginTop: 14 }}>
            <div className="grid-2">
              <div>
                <label>{activeConfig.nameLabel}</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={activeConfig.namePlaceholder} />
                <label>{activeConfig.addressLabel}</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 Palm Ave, West Palm Beach, FL 33401" />
                <label>County / Market</label>
                <input value={form.county} onChange={e => setForm({ ...form, county: e.target.value })} placeholder="Palm Beach County" />
                <div className="row" style={{ gap: 6, marginTop: -8, marginBottom: 14 }}>
                  {COUNTIES.map(c => (
                    <button key={c} type="button" className="btn-outline btn-sm" onClick={() => setForm({ ...form, county: c })}>{c.replace(' County', '')}</button>
                  ))}
                </div>
                {isHomeowner && (
                  <>
                    <label>Permit Number</label>
                    <input value={form.permit_number} onChange={e => setForm({ ...form, permit_number: e.target.value })} placeholder="B-2019-004521" />
                  </>
                )}
              </div>
              <div>
                {isHomeowner && (
                  <>
                    <label>Permit Type</label>
                    <select value={form.permit_type} onChange={e => setForm({ ...form, permit_type: e.target.value })}>
                      {['Building', 'Electrical', 'Plumbing', 'Mechanical', 'Window & Door', 'Roofing', 'Swimming Pool', 'Site Plan & Zoning'].map(t => <option key={t}>{t}</option>)}
                    </select>
                    <label>Date Issued</label>
                    <input value={form.date_issued} onChange={e => setForm({ ...form, date_issued: e.target.value })} placeholder="03/14/2019" />
                    <label>Date Expired</label>
                    <input value={form.date_expired} onChange={e => setForm({ ...form, date_expired: e.target.value })} placeholder="09/14/2019" />
                  </>
                )}
                <label>Phone</label>
                <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="(561) 555-0100" />
                <label>Email (for Mailchimp export)</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" />
              </div>
            </div>
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <div className="row">
              <button className="btn-gold" onClick={() => generateSingle('download')}>Download PDF</button>
              <button className="btn-outline" onClick={() => generateSingle('print')}>Print</button>
            </div>
            {genStatus && <div className={`status-msg ${genStatus.type}`}>{genStatus.text}</div>}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Email Template</h2>
        <p className="sub">Not a sending integration — copy this into a new Mailchimp campaign, then import the Mailchimp CSV (below) into your audience and map its columns to these merge fields. *|FNAME|* is a Mailchimp default; *|ADDR|*{isHomeowner ? ', *|PERMIT|*, and *|PTYPE|*' : ''} are custom fields — create {isHomeowner ? 'them' : 'it'} once in Mailchimp's Audience → Settings → Merge fields.</p>
        <div className="row" style={{ marginBottom: 14 }}>
          <label style={{ marginBottom: 0 }}>Touch:</label>
          <select style={{ width: 200, marginBottom: 0 }} value={emailLevel} onChange={e => { setEmailLevel(Number(e.target.value)); setEmailCopyStatus(null); }}>
            <option value={1}>1st — Introduction</option>
            <option value={2}>2nd — Follow-up</option>
            <option value={3}>3rd — {isHomeowner ? 'Final' : 'Staying in Touch'}</option>
          </select>
        </div>
        {(() => {
          const tpl = getEmailTemplate(activeAudience, emailLevel);
          return (
            <>
              <label>Subject</label>
              <input readOnly value={tpl.subject} />
              <label>Body</label>
              <textarea readOnly value={tpl.body} style={{ minHeight: 220, fontFamily: 'monospace', fontSize: 13 }} />
            </>
          );
        })()}
        <div className="row">
          <button className="btn-gold" onClick={copyEmailTemplate}>Copy Subject + Body</button>
        </div>
        {emailCopyStatus && <div className={`status-msg ${emailCopyStatus.type}`}>{emailCopyStatus.text}</div>}
      </div>

      <div className="panel">
        <h2>Import Leads</h2>
        <p className="sub">
          {isHomeowner
            ? "From a CSV/Excel export, or pasted straight out of a building department portal's search results."
            : `From a CSV/Excel export, or pasted from a spreadsheet, CRM export, or directory listing of ${activeConfig.label.toLowerCase()}.`}
          {' '}Up to 100 rows. Columns can be named however the source uses them — name/company, address, {isHomeowner ? 'permit #, issue/expire date, ' : ''}etc. are matched automatically. Rows already in your leads (by {isHomeowner ? 'permit # or ' : ''}address) are flagged and skipped.
        </p>

        <div className="row" style={{ marginBottom: 14 }}>
          <label style={{ marginBottom: 0 }}>Default county/market for rows with none:</label>
          <select style={{ width: 200, marginBottom: 0 }} value={importCounty} onChange={e => setImportCounty(e.target.value)}>
            <option value="">— none —</option>
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="upload-box" onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); }}>
          Tap to choose a CSV or Excel file — or drag one here
        </div>
        <input ref={fileInputRef} type="file" className="no-print" style={{ display: 'none' }}
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={e => e.target.files.length && handleFile(e.target.files[0])} />
        {fileName && <div className="file-chip">{fileName}</div>}

        <p className="tag" style={{ margin: '16px 0 6px' }}>
          {isHomeowner ? '— or paste a table copied from the county portal —' : '— or paste a list copied from a spreadsheet, CRM, or directory —'}
        </p>
        <textarea
          placeholder={isHomeowner
            ? 'Paste rows copied from the building department search results (works best copied directly from the results grid)'
            : `Paste rows for ${activeConfig.label.toLowerCase()} — name/company, address, contact, etc.`}
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          style={{ minHeight: 100 }}
        />
        <button className="btn-outline btn-sm" disabled={!pasteText.trim()} onClick={parsePastedText}>Parse Pasted Text</button>

        {uploadStatus && <div className={`status-msg ${uploadStatus.type}`}>{uploadStatus.text}</div>}
        {bulkRows.length > 0 && (
          <div style={{ marginTop: 14, overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Name</th><th>Address</th>{isHomeowner && <th>Permit #</th>}<th>Status</th></tr></thead>
              <tbody>
                {bulkRows.slice(0, 12).map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>{r.address}</td>
                    {isHomeowner && <td>{r.permit_number || '—'}</td>}
                    <td>{r._dup ? <span className="badge due">Duplicate — skip</span> : <span className="badge sale">New</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bulkRows.length > 12 && <p className="tag">...and {bulkRows.length - 12} more</p>}
          </div>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn-navy" disabled={!bulkRows.filter(r => !r._dup).length} onClick={() => generateBulk('save-only')}>Save Leads Only</button>
          <button className="btn-gold" disabled={!bulkRows.filter(r => !r._dup).length} onClick={() => generateBulk('download')}>Save + Download All PDFs</button>
          <button className="btn-outline" disabled={!bulkRows.filter(r => !r._dup).length} onClick={() => generateBulk('print')}>Save + Print All</button>
        </div>
        {bulkStatus && <div className={`status-msg ${bulkStatus.type}`}>{bulkStatus.text}</div>}
      </div>

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ marginBottom: 0 }}>Leads</h2>
          <div className="row" style={{ gap: 8 }}>
            {stats.notSent > 0 && (
              <button className="btn-outline btn-sm" onClick={printAllNotSent}>Print All Not-Sent ({stats.notSent})</button>
            )}
            <button className="btn-outline btn-sm" disabled={!audienceLeads.some(l => l.email)} onClick={exportMailchimpCsv}>Export for Mailchimp (CSV)</button>
            <input style={{ marginBottom: 0, width: 220 }} placeholder="Search name, address, permit..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Address</th>{isHomeowner && <th>Permit #</th>}
                <th>1st Sent</th><th>2nd Sent</th><th>3rd Sent</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map(lead => {
                const stage = computeStage(lead, settings.follow_up_days);
                return (
                  <tr key={lead.id}>
                    <td>{lead.name}</td>
                    <td>{lead.address}</td>
                    {isHomeowner && <td>{lead.permit_number || '—'}</td>}
                    <td>{lead.first_notice_date || '—'}</td>
                    <td>{lead.second_notice_date || '—'}</td>
                    <td>{lead.third_notice_date || '—'}</td>
                    <td><span className={`badge ${stage.kind}`}>{stage.label}</span></td>
                    <td className="no-print">
                      <div className="row" style={{ gap: 6 }}>
                        {stage.nextLevel === 1 && <button className="btn-outline btn-sm" onClick={() => printNotice(lead, 1, 'print')}>Print 1st</button>}
                        {stage.nextLevel === 2 && <button className="btn-outline btn-sm" onClick={() => printNotice(lead, 2, 'print')}>Print 2nd</button>}
                        {stage.nextLevel === 3 && <button className="btn-outline btn-sm" onClick={() => printNotice(lead, 3, 'print')}>Print 3rd</button>}
                        {lead.status !== 'converted' && lead.status !== 'closed' && (
                          <button className="btn-gold btn-sm" onClick={() => { setConvertLead(lead); setJobValue(''); }}>Convert</button>
                        )}
                        {lead.status !== 'converted' && lead.status !== 'closed' && (
                          <button className="btn-outline btn-sm" onClick={() => closeLead(lead)}>Close</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleLeads.length === 0 && <tr><td colSpan={isHomeowner ? 8 : 7} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No leads match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {convertLead && (
        <div className="modal-overlay" onClick={() => setConvertLead(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Convert to Sale</h3>
            <p className="tag">{convertLead.name} — {convertLead.address}</p>
            <div className="form-row">
              <label>Job Value ($)</label>
              <input type="number" value={jobValue} onChange={e => setJobValue(e.target.value)} placeholder="0.00" />
            </div>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setConvertLead(null)}>Cancel</button>
              <button className="btn-gold" onClick={confirmConvert}>Convert</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
