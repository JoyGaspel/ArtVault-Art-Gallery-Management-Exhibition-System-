import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import useAutoRefresh from '../hooks/useAutoRefresh';
import PageLoadState from '../components/PageLoadState';

const prefetchedExhibits = new Set();

function monthDay(dateStr) {
  const d = new Date(dateStr);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return { day: d.getDate(), mon: months[d.getMonth()] };
}

function exhibitStatus(dateStr) {
  const eventDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);
  if (eventDate.getTime() === today.getTime()) return 'Happening today';
  return eventDate > today ? 'Upcoming' : 'Past exhibit';
}

export default function Exhibits() {
  const [exhibits, setExhibits] = useState([]);
  const [params] = useSearchParams();
  const search = (params.get('search') || '').trim().toLowerCase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    return api.get('/exhibits').then((res) => setExhibits(res.data.exhibits || [])).catch((err) => {
      setError(err.response?.data?.message || 'Could not load exhibits. Check that the API is running.');
    }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  useAutoRefresh(load);

  const visibleExhibits = search ? exhibits.filter((exhibit) => [exhibit.name, exhibit.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(search))) : exhibits;
  function prefetchExhibit(id) {
    const key = String(id);
    if (!key || prefetchedExhibits.has(key)) return;
    prefetchedExhibits.add(key);
    api.get(`/exhibits/${key}`).catch(() => prefetchedExhibits.delete(key));
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Events</div>
          <h1>Exhibits</h1>
          <div className="sub">Curated shows, online and in-gallery.</div>
        </div>
      </div>

      <PageLoadState loading={loading} error={error} onRetry={load} label="exhibits…" />
      {!loading && !error && visibleExhibits.length === 0 && <div className="empty">{search ? 'No exhibits match your search.' : 'No exhibits scheduled yet.'}</div>}
      {!loading && !error && visibleExhibits.length > 0 && (
        <div className="exhibit-list">
          {visibleExhibits.map((e, index) => {
            const md = monthDay(e.event_date);
            const status = exhibitStatus(e.event_date);
            return (
              <Link to={`/exhibits/${e._id}`} className={`exhibit-card${index === 0 ? ' exhibit-card-featured' : ''}`} key={e._id} onMouseEnter={() => prefetchExhibit(e._id)} onFocus={() => prefetchExhibit(e._id)}>
                <div className="exhibit-date">
                  <div className="day">{md.day}</div>
                  <div className="mon">{md.mon}</div>
                </div>
                <div className="exhibit-info">
                  <div className={`exhibit-status${status === 'Past exhibit' ? ' past' : ''}`}>{status}</div>
                  <div className="name">{e.name}</div>
                  <div className="desc">{e.description} · {e.artworks.length} pieces</div>
                </div>
                <div className="exhibit-count" aria-label={`${e.artworks.length} artworks`}><strong>{e.artworks.length}</strong><span>pieces</span></div>
                <span className="exhibit-arrow" aria-hidden="true">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
