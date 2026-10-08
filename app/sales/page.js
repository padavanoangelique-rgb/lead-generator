'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getAccessToken } from '../../lib/supabaseClient';
import { isEmbedded } from '../../lib/unlock';

function todayIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export default function SalesPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [txnModal, setTxnModal] = useState(null);
  const [txnForm, setTxnForm] = useState({ type: 'income', category: '', amount: '', description: '', txn_date: '' });
  const [hubBusy, setHubBusy] = useState(null);

  useEffect(() => {
    if (isEmbedded()) {
      setSession({ embedded: true });
      return;
    }
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
    const { data } = await supabase.from('sales').select('*, leads(name, address, permit_number, permit_type, email, contact, county, notes, audience)').order('converted_date', { ascending: false });
    setSales(data || []);
  }, []);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  async function updateSale(id, fields) {
    await supabase.from('sales').update(fields).eq('id', id);
    loadData();
  }

  async function openTxnModal(sale) {
    setTxnModal(sale);
    setTxnForm({ type: 'income', category: 'Job Payment', amount: '', description: sale.job_name, txn_date: todayIso() });
  }

  async function saveTxn() {
    await supabase.from('transactions').insert({
      sale_id: txnModal.id,
      type: txnForm.type,
      category: txnForm.category,
      amount: parseFloat(txnForm.amount) || 0,
      description: txnForm.description,
      txn_date: txnForm.txn_date,
    });
    setTxnModal(null);
    loadData();
  }

  function hubUrl(sale) {
    if (sale.hub_job_id) {
      return "https://hub.majesticpermits.com/admin/jobs/" + sale.hub_job_id;
    }
    const legacy = (sale.notes || "").match(/https:\/\/hub\.majesticpermits\.com\/admin\/jobs\/[\da-f-]{36}/i);
    return legacy ? legacy[0] : null;
  }

  async function sendToHub(sale) {
    const lead = sale.leads || {};
    if (lead.audience === "contractor_permitaio") {
      alert("This is a PermitAIO software prospect. Use PermitAIO onboarding instead of creating a permit job.");
      return;
    }
    let projectAddress = "";
    if (lead.audience && lead.audience !== "homeowner") {
      const entered = prompt("Enter the ACTUAL PROJECT PROPERTY ADDRESS. The lead's company mailing address must not be used as a permit job site:");
      if (entered === null) return;
      projectAddress = entered.trim();
      if (projectAddress.length < 5) {
        alert("A valid project property address is required.");
        return;
      }
    }

    setHubBusy(sale.id);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in to your verified staff account first.");
      const res = await fetch("/api/send-to-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ sale_id: sale.id, project_address: projectAddress }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        throw new Error(data.error || "Could not create the Majestic job.");
      }
      if (data.warning) alert(data.warning);
      window.open(data.url || ("https://hub.majesticpermits.com/admin/jobs/" + data.id), "_blank", "noopener,noreferrer");
      await loadData();
    } catch (err) {
      alert("Hub transfer failed: " + err.message);
    } finally {
      setHubBusy(null);
    }
  }

  if (!session) return null;

  const visible = sales.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${s.job_name} ${s.leads?.address || ''}`.toLowerCase().includes(q);
  });

  const totals = {
    inProgress: sales.filter(s => s.status === 'in_progress').length,
    completed: sales.filter(s => s.status === 'completed').length,
    value: sales.reduce((sum, s) => sum + Number(s.job_value || 0), 0),
  };

  return (
    <main>
      <div className="stats-bar">
        <div className="stat"><div className="num">{sales.length}</div><div className="label">Total Sales</div></div>
        <div className="stat"><div className="num">{totals.inProgress}</div><div className="label">In Progress</div></div>
        <div className="stat"><div className="num">{totals.completed}</div><div className="label">Completed</div></div>
        <div className="stat"><div className="num">${totals.value.toLocaleString()}</div><div className="label">Total Job Value</div></div>
      </div>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ marginBottom: 0 }}>Sales</h2>
          <input style={{ marginBottom: 0, width: 220 }} placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <p className="sub">Convert a lead first, then Send to Hub to open it as a job on hub.majesticpermits.com.</p>
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table>
            <thead>
              <tr><th>Job</th><th>Address</th><th>Value</th><th>Converted</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {visible.map(sale => (
                <tr key={sale.id}>
                  <td>{sale.job_name}</td>
                  <td>{sale.leads?.address || '\u2014'}</td>
                  <td>
                    {editingId === sale.id ? (
                      <input type="number" defaultValue={sale.job_value} style={{ width: 100, marginBottom: 0 }}
                        onBlur={e => { updateSale(sale.id, { job_value: parseFloat(e.target.value) || 0 }); setEditingId(null); }} autoFocus />
                    ) : (
                      <span onClick={() => setEditingId(sale.id)} style={{ cursor: 'pointer' }}>${Number(sale.job_value).toLocaleString()}</span>
                    )}
                  </td>
                  <td>{sale.converted_date}</td>
                  <td>
                    <select value={sale.status} onChange={e => updateSale(sale.id, { status: e.target.value })} style={{ marginBottom: 0, padding: '5px 7px', fontSize: 13 }}>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="lost">Lost</option>
                    </select>
                  </td>
                  <td className="row" style={{ gap: 6 }}>
                    <button className="btn-outline btn-sm" onClick={() => openTxnModal(sale)}>Log Payment</button>
                    {hubUrl(sale) ? (
                      <a className="btn-outline btn-sm" href={hubUrl(sale)} target="_blank" rel="noreferrer">Open Hub</a>
                    ) : (
                      <button className="btn-gold btn-sm" disabled={hubBusy === sale.id} onClick={() => sendToHub(sale)}>
                        {hubBusy === sale.id ? 'Sending\u2026' : 'Send to Hub'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No sales yet \u2014 convert a lead from the Lead Generator tab.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {txnModal && (
        <div className="modal-overlay" onClick={() => setTxnModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Log Payment / Cost \u2014 {txnModal.job_name}</h3>
            <div className="form-row">
              <label>Type</label>
              <select value={txnForm.type} onChange={e => setTxnForm({ ...txnForm, type: e.target.value })}>
                <option value="income">Money In (income)</option>
                <option value="expense">Money Out (expense)</option>
              </select>
            </div>
            <div className="form-row">
              <label>Category</label>
              <input value={txnForm.category} onChange={e => setTxnForm({ ...txnForm, category: e.target.value })} placeholder="Job Payment, Contractor Cost, etc." />
            </div>
            <div className="form-row">
              <label>Amount ($)</label>
              <input type="number" value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={txnForm.txn_date} onChange={e => setTxnForm({ ...txnForm, txn_date: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Description</label>
              <textarea value={txnForm.description} onChange={e => setTxnForm({ ...txnForm, description: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setTxnModal(null)}>Cancel</button>
              <button className="btn-gold" onClick={saveTxn}>Save</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
