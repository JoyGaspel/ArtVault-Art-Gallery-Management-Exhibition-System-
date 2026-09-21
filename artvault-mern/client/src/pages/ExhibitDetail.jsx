import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import ArtCard from '../components/ArtCard';

export default function ExhibitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exhibit, setExhibit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/exhibits/${id}`).then((res) => setExhibit(res.data.exhibit)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="empty">Loading…</div>;
  if (!exhibit) return <div className="empty">Exhibit not found.</div>;

  return (
    <section>
      <button className="back-link" onClick={() => navigate(-1)}>← Back to exhibits</button>
      <div className="exhibit-detail-hero">
        <div><div className="eyebrow">Digital exhibition · {new Date(exhibit.event_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div><h1>{exhibit.name}</h1><p>{exhibit.description || 'A curated collection of works from the ArtVault community.'}</p></div>
        <div className="exhibit-detail-count"><strong>{exhibit.artworks.length}</strong><span>works on view</span></div>
      </div>
      <div className="exhibit-welcome"><span>✦</span><div><strong>Welcome to the exhibition</strong><small>Explore each work to discover its story, artist, and materials.</small></div></div>

      {exhibit.artworks.length === 0 ? (
        <div className="empty">No artworks assigned to this exhibit yet.</div>
      ) : (
        <div className="gallery-grid exhibit-art-gallery">
          {exhibit.artworks.map((w, i) => (
            <ArtCard key={w._id} artwork={w} height={150 + ((i * 39) % 110)} />
          ))}
        </div>
      )}
    </section>
  );
}
