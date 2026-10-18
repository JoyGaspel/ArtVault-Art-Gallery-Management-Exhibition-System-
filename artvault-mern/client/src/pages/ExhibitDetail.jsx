import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import ArtCard from '../components/ArtCard';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { exhibitPhase, exhibitScheduleLabel } from '../utils/exhibitSchedule';
import { goBackOr } from '../utils/navigation';

export default function ExhibitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exhibit, setExhibit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load({ silent = false } = {}) {
    if (!silent) { setLoading(true); setError(''); }
    return api.get(`/exhibits/${id}`).then((res) => { setExhibit(res.data.exhibit); setError(''); })
      .catch((err) => { if (!silent) setError(err.response?.data?.message || 'Could not load this exhibit.'); })
      .finally(() => { if (!silent) setLoading(false); });
  }
  useEffect(() => { load(); }, [id]);
  useAutoRefresh(() => load({ silent: true }));

  if (loading) return <div className="empty">Loading…</div>;
  if (error) return <div className="empty">{error}<br /><button className="btn btn-ghost btn-sm" type="button" onClick={() => load()}>Try again</button></div>;
  if (!exhibit) return <div className="empty">Exhibit not found.</div>;

  return (
    <section>
      <button className="back-link" type="button" onClick={() => goBackOr(navigate, '/exhibits')}>← Back to exhibits</button>
      <div className="exhibit-detail-hero">
        <div><div className="eyebrow">Digital exhibition · {exhibitPhase(exhibit) === 'current' ? 'Happening now' : exhibitPhase(exhibit) === 'past' ? 'Past exhibit' : 'Upcoming'}</div><h1>{exhibit.name}</h1><p>{exhibitScheduleLabel(exhibit)}</p><p>{exhibit.description || 'A curated collection of works from the ArtVault community.'}</p></div>
        <div className="exhibit-detail-count"><strong>{exhibit.artworks.length}</strong><span>works on view</span></div>
      </div>
      <div className="exhibit-welcome"><span>✦</span><div><strong>Welcome to the exhibition</strong><small>Explore each work to discover its story, artist, and materials.</small></div></div>

      {exhibit.artworks.length === 0 ? (
        <div className="empty">No artworks assigned to this exhibit yet.</div>
      ) : (
        <div className="gallery-grid exhibit-art-gallery">
          {exhibit.artworks.map((w, i) => (
            <ArtCard key={w._id} artwork={w} priority={i < 2} to={`/artworks/${w._id}?exhibit=${id}&position=${i}`} />
          ))}
        </div>
      )}
    </section>
  );
}
