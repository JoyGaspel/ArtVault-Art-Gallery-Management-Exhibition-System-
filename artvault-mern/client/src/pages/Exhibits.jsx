import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function monthDay(dateStr) {
  const d = new Date(dateStr);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return { day: d.getDate(), mon: months[d.getMonth()] };
}

export default function Exhibits() {
  const [exhibits, setExhibits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/exhibits').then((res) => setExhibits(res.data.exhibits)).finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Events</div>
          <h1>Exhibits</h1>
          <div className="sub">Curated shows, online and in-gallery.</div>
        </div>
      </div>

      {loading && <div className="empty">Loading…</div>}
      {!loading && exhibits.length === 0 && <div className="empty">No exhibits scheduled yet.</div>}
      {!loading && exhibits.length > 0 && (
        <div className="exhibit-list">
          {exhibits.map((e) => {
            const md = monthDay(e.event_date);
            return (
              <Link to={`/exhibits/${e._id}`} className="exhibit-card" key={e._id}>
                <div className="exhibit-date">
                  <div className="day">{md.day}</div>
                  <div className="mon">{md.mon}</div>
                </div>
                <div className="exhibit-info">
                  <div className="name">{e.name}</div>
                  <div className="desc">{e.description} · {e.artworks.length} pieces</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
