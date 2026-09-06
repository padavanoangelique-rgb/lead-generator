'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
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
    const { data } = await supabase.from('sales').select('*, leads(name, address, permit_number, permit_type, email, contact, county, notes)').order('converted_date', { ascending: false });
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

  function alreadyOnHub(sale) {
    return (sale.notes || '').includes('hub.majesticpermits.com/admin/jobs/');
  }

  async function sendToHub(sale) {
    const lead = sale.leads || {};
    setHubBusy(sale.id);
    try {
      const res = await fetch('/api/send-to-hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.name || sale.job_name,
          address: lead.address || '',
          email: lead.email || '',
          phone: lead.contact || '',
          permit_number: lead.permit_number || '',
          permit_type: lead.permit_type || '',
          county: lead.county || '',
          notes: lead.notes || '',
          job_value: sale.job_value || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        alert(data.error || 'Could not create Hub job');
        return;
      }
      await supabase.from('sales').update({
        notes: `Hub job: https://hub.majesticpermits.com/admin/jobs/${data.id}`,
      }).eq('id', sale.id);
      window.open(`https://hub.majesticpermits.com/admin/jobs/${data.id}`, '_blank');
      loadData();
    } catch (err) {
      alert('Hub request failed: ' + err.message);
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
      </div>
    </main>
  );
}
