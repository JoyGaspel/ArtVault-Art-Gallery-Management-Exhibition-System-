import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function csvCell(value) {
  const text = String(value ?? '');
  return `"${/^[\s]*[=+@-]/.test(text) ? "'" : ''}${text.replaceAll('"', '""')}"`;
}

export default function Analytics() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [range, setRange] = useState({});
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api.get('/artworks/admin/analytics', { params: range, signal: controller.signal }).then(({ data: result }) => {
      if (controller.signal.aborted) return;
      setData(result); setFrom(result.from); setTo(result.to);
    }).catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || 'Could not load analytics.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [range]);
  function download() {
    const rows = [['ArtVault analytics', data.from, data.to, data.timezone],
      ['Metric', 'Value'], ['Uploads', data.uploads], ['Active uploading artists', data.activeArtists],
      ['Pending artwork reviews', data.pending], ['Pending over seven days', data.pendingOverSevenDays],
      ['Rejected artworks', data.rejected], ['Exhibit approval rate (%)', data.approvalRate ?? 'No decisions'],
      [], ['Date', 'Uploads'], ...data.trend.map((item) => [item.date, item.count]),
      [], ['Public category (top 25)', 'Artworks'], ...data.categories.map((item) => [item.category, item.count]),
      [], ['Exhibit entry status', 'Count'], ...Object.entries(data.entries),
    ];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `artvault-analytics-${data.from}-${data.to}.csv`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section>
    <div className="page-head"><div><div className="eyebrow">Curation insights</div><h1>Analytics</h1><p className="sub">Track participation, review workload, and exhibit decisions.</p></div></div>
    <form className="analytics-filters" onSubmit={(event) => { event.preventDefault(); setRange({ from, to }); }}>
      <label>From<input type="date" required value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>To<input type="date" required min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <button className="btn btn-primary" disabled={loading}>Apply</button>
      <button type="button" className="btn btn-ghost" disabled={!data || loading || Boolean(error)} onClick={download}>Download CSV</button>
    </form>
    {loading && <p role="status">Loading analytics…</p>}
    {error && <p role="alert">{error}</p>}
    {data && !loading && !error && <>
      <p className="hint">{data.from} to {data.to}, Philippine time. Current records created within this range; removed records are excluded. This is descriptive analytics, not a prediction.</p>
      <div className="analytics-metrics">
        {[['Artwork uploads', data.uploads], ['Active uploading artists', data.activeArtists], ['Pending reviews', data.pending], ['Pending over 7 days', data.pendingOverSevenDays], ['Rejected artworks', data.rejected], ['Exhibit approval rate', data.approvalRate === null ? 'No decisions' : `${data.approvalRate}%`]].map(([label, value]) => <div className="form-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      {data.pending > 0 && <p><Link to="/pending-artworks">Review {data.pending} pending artworks from this period</Link>{data.oldestPendingAt && ` · Oldest submitted ${new Date(data.oldestPendingAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}`}</p>}
      <div className="analytics-panels">
        <div className="form-card"><h2>Upload activity</h2><p className="hint">Daily submissions, including public, Vault, and pending artworks. Includes days with zero uploads.</p>
          <div className="analytics-scroll"><table><caption className="hint">Daily artwork uploads</caption><thead><tr><th scope="col">Date</th><th scope="col">Uploads</th></tr></thead><tbody>{data.trend.map((item) => <tr key={item.date}><th scope="row">{item.date}</th><td><meter min="0" max={Math.max(1, ...data.trend.map((row) => row.count))} value={item.count} aria-label={`${item.count} uploads`} /> {item.count}</td></tr>)}</tbody></table></div>
        </div>
        <div className="form-card"><h2>Public artwork categories</h2><p className="hint">Top 25 labels on currently approved public artworks created in the period. An artwork can count in multiple categories. Private labels are excluded.</p>
          {!data.categories.length ? <p>No public category data for this period.</p> : <table><thead><tr><th scope="col">Category</th><th scope="col">Artworks</th></tr></thead><tbody>{data.categories.map((item) => <tr key={item.category}><th scope="row">{item.category}</th><td><meter min="0" max={Math.max(1, ...data.categories.map((row) => row.count))} value={item.count} /> {item.count}</td></tr>)}</tbody></table>}
          <h2>Exhibit submissions</h2><p className="hint">Current status of entries submitted in the period. Approval rate = approved ÷ (approved + denied); excludes pending, withdrawn, and expired entries.</p>
          {!Object.keys(data.entries).length ? <p>No exhibit submissions for this period.</p> : <table><thead><tr><th scope="col">Status</th><th scope="col">Entries</th></tr></thead><tbody>{Object.entries(data.entries).map(([status, count]) => <tr key={status}><th scope="row">{status}</th><td>{count}</td></tr>)}</tbody></table>}
        </div>
      </div>
    </>}
  </section>;
}
