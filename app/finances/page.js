'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

function monthKey(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 7); // YYYY-MM
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function FinancesPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [leads, setLeads] = useState([]);
  const [settings, setSettings] = useState({ postage_rate: 0.78 });
  const [showTxnForm, setShowTxnForm] = useState(false);
  const [txnForm, setTxnForm] = useState({ type: 'expense', category: '', amount: '', description: '', txn_date: new Date().toISOString().slice(0, 10) });
  const [rateInput, setRateInput] = useState('0.78');

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
    const { data: txns } = await supabase.from('transactions').select('*').order('txn_date', { ascending: false });
    setTransactions(txns || []);
    const { data: leadRows } = await supabase.from('leads').select('first_notice_date, second_notice_date, third_notice_date');
    setLeads(leadRows || []);
    const { data: s } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (s) { setSettings(s); setRateInput(String(s.postage_rate)); }
  }, []);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  async function saveRate() {
    const rate = parseFloat(rateInput);
    if (isNaN(rate)) return;
    await supabase.from('app_settings').update({ postage_rate: rate }).eq('id', 1);
    loadData();
  }

  async function saveTxn() {
    await supabase.from('transactions').insert({
      type: txnForm.type,
      category: txnForm.category,
      amount: parseFloat(txnForm.amount) || 0,
      description: txnForm.description,
      txn_date: txnForm.txn_date,
    });
    setShowTxnForm(false);
    setTxnForm({ type: 'expense', category: '', amount: '', description: '', txn_date: new Date().toISOString().slice(0, 10) });
    loadData();
  }

  async function deleteTxn(id) {
    await supabase.from('transactions').delete().eq('id', id);
    loadData();
  }

  if (!session) return null;

  // ---------- Postage: count letters sent per month across all 3 notice stages ----------
  const postageByMonth = {};
  leads.forEach(l => {
    [l.first_notice_date, l.second_notice_date, l.third_notice_date].forEach(d => {
      const k = monthKey(d);
      if (k) postageByMonth[k] = (postageByMonth[k] || 0) + 1;
    });
  });
  const postageMonths = Object.keys(postageByMonth).sort().reverse();

  // ---------- Ledger totals ----------
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const totalPostageCost = postageMonths.reduce((s, k) => s + postageByMonth[k] * settings.postage_rate, 0);

  return (
    <main>
      <div className="finance-summary">
        <div className="card income"><div className="num">${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div className="label">Total Money In</div></div>
        <div className="card expense"><div className="num">${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div className="label">Total Money Out</div></div>
        <div className="card"><div className="num">${(totalIncome - totalExpense).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div className="label">Net</div></div>
      </div>

      <div className="panel">
        <h2>Postage — Letters Sent by Month</h2>
        <p className="sub">Automatically counted from every First, Second, and Third notice printed. Cost = letters × postage rate (not added to the ledger automatically — this is a running estimate).</p>
        <div className="row" style={{ marginBottom: 14 }}>
          <label style={{ marginBottom: 0 }}>Postage rate per letter ($)</label>
          <input type="number" step="0.01" value={rateInput} onChange={e => setRateInput(e.target.value)} style={{ width: 100, marginBottom: 0 }} />
          <button className="btn-outline btn-sm" onClick={saveRate}>Save Rate</button>
        </div>
        <table>
          <thead><tr><th>Month</th><th>Letters Sent</th><th>Estimated Postage Cost</th></tr></thead>
          <tbody>
            {postageMonths.map(k => (
              <tr key={k}>
                <td>{monthLabel(k)}</td>
                <td>{postageByMonth[k]}</td>
                <td>${(postageByMonth[k] * settings.postage_rate).toFixed(2)}</td>
              </tr>
            ))}
            {postageMonths.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No letters sent yet.</td></tr>}
          </tbody>
          {postageMonths.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td>{postageMonths.reduce((s, k) => s + postageByMonth[k], 0)}</td>
                <td>${totalPostageCost.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ marginBottom: 0 }}>Ledger — Money In / Money Out</h2>
          <button className="btn-gold btn-sm" onClick={() => setShowTxnForm(s => !s)}>{showTxnForm ? 'Cancel' : '+ Add Transaction'}</button>
        </div>
        {showTxnForm && (
          <div style={{ marginTop: 14 }}>
            <div className="grid-2">
              <div>
                <label>Type</label>
                <select value={txnForm.type} onChange={e => setTxnForm({ ...txnForm, type: e.target.value })}>
                  <option value="income">Money In (income)</option>
                  <option value="expense">Money Out (expense)</option>
                </select>
                <label>Category</label>
                <input value={txnForm.category} onChange={e => setTxnForm({ ...txnForm, category: e.target.value })} placeholder="Postage, Supplies, Job Payment..." />
              </div>
              <div>
                <label>Amount ($)</label>
                <input type="number" value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })} />
                <label>Date</label>
                <input type="date" value={txnForm.txn_date} onChange={e => setTxnForm({ ...txnForm, txn_date: e.target.value })} />
              </div>
            </div>
            <label>Description</label>
            <textarea value={txnForm.description} onChange={e => setTxnForm({ ...txnForm, description: e.target.value })} />
            <button className="btn-gold" onClick={saveTxn}>Save Transaction</button>
          </div>
        )}
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td>{t.txn_date}</td>
                  <td><span className={`badge ${t.type}`}>{t.type === 'income' ? 'In' : 'Out'}</span></td>
                  <td>{t.category}</td>
                  <td>{t.description}</td>
                  <td>${Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td><button className="btn-outline btn-sm" onClick={() => deleteTxn(t.id)}>Delete</button></td>
                </tr>
              ))}
              {transactions.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No transactions logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
