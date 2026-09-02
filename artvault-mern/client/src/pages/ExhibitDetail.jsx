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
      <div className="page-head">
        <div>
          <div className="eyebrow">{new Date(exhibit.event_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          <h1>{exhibit.name}</h1>
          <div className="sub">{exhibit.description}</div>
        </div>
      </div>

      {exhibit.artworks.length === 0 ? (
        <div className="empty">No artworks assigned to this exhibit yet.</div>
      ) : (
        <div className="gallery-grid">
          {exhibit.artworks.map((w, i) => (
            <ArtCard key={w._id} artwork={w} height={150 + ((i * 39) % 110)} />
          ))}
        </div>
      )}
    </section>
  );
}
