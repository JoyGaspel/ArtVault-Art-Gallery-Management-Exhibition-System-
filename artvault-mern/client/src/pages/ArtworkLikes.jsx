import { useEffect, useState } from 'react';
import api from '../api';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import PageLoadState from '../components/PageLoadState';

export default function ArtworkLikes() {
  const { user } = useAuth();
  const toast = useToast();
  const [likes, setLikes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState('');

  function load(showLoading = true) {
    if (showLoading) setLoading(true);
    api.get('/likes', { params: { page: 1, limit: 50 } })
      .then((response) => {
        setLikes(Array.isArray(response.data?.likes) ? response.data.likes : []);
        setTotal(Number(response.data?.total) || 0);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load artwork likes.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);
  useAutoRefresh(() => load(false));

  async function removeLike(like) {
    if (user?.role !== 'main_admin' || removing) return;
    setRemoving(like._id);
    try {
      await api.delete(`/likes/${like._id}`);
      setLikes((current) => current.filter((item) => item._id !== like._id));
      setTotal((value) => Math.max(0, value - 1));
      toast('Like removed from the activity log.');
    } catch (err) {
      toast(err.response?.data?.message || 'Could not remove this like.', true);
    } finally {
      setRemoving('');
    }
  }

  if (!['sub_admin', 'main_admin'].includes(user?.role)) return <div className="empty">Administrator access is required.</div>;

  return (
    <section>
      <div className="page-head"><div><div className="eyebrow">Engagement</div><h1>Artwork likes</h1><div className="sub">Review recent artist likes and the artwork receiving attention.</div></div><div className="likes-total"><strong>{total}</strong><span>Total likes</span></div></div>
      <PageLoadState loading={loading} error={error} onRetry={() => load()} label="likes…" />
      {!error && !loading && likes.length === 0 && <div className="empty">No artwork likes yet.</div>}
      {!error && !loading && likes.length > 0 && <div className="likes-activity-list">{likes.map((like) => {
        const image = like.artwork?.thumbnail_url || like.artwork?.image_url;
        return <article className="like-activity-card" key={like._id}>
          <div className="like-activity-image">{image ? <img src={image} alt="" loading="lazy" /> : '♡'}</div>
          <div className="like-activity-details"><h2>{like.artwork?.title || 'Artwork unavailable'}</h2><div className="like-activity-artist">Liked by {like.artist?.name || 'Artist'}</div><div className="like-activity-meta">{(like.artwork?.categories || []).join(' · ') || 'Uncategorized'} · {new Date(like.createdAt).toLocaleString()}</div></div>
          {user.role === 'main_admin' && <button className="btn btn-danger btn-sm" type="button" disabled={removing === like._id} onClick={() => removeLike(like)}>{removing === like._id ? 'Removing…' : 'Remove like'}</button>}
        </article>;
      })}</div>}
    </section>
  );
}
