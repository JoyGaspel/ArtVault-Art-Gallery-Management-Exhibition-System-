import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';

export default function ArtworkLikeButton({ artworkId, initialCount = 0, compact = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const canLike = user?.role === 'artist';
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(Number(initialCount) || 0);
  const [saving, setSaving] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(!canLike || compact);

  useEffect(() => setCount(Number(initialCount) || 0), [initialCount]);

  useEffect(() => {
    let cancelled = false;
    if (!canLike || !artworkId || compact) return undefined;
    api.get(`/artworks/${artworkId}/likes/me`)
      .then((response) => {
        if (!cancelled) {
          setLiked(Boolean(response.data?.liked));
          setCount(Number(response.data?.likeCount) || 0);
          setStatusLoaded(true);
        }
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [artworkId, canLike]);

  async function toggle(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!canLike || saving) return;
    setSaving(true);
    let currentLiked = liked;
    let currentCount = count;
    try {
      // Compact cards avoid one status request per artwork. Resolve the
      // current state only when the artist first interacts with the button.
      if (!statusLoaded) {
        const status = await api.get(`/artworks/${artworkId}/likes/me`);
        currentLiked = Boolean(status.data?.liked);
        currentCount = Number(status.data?.likeCount) || currentCount;
        setLiked(currentLiked);
        setCount(currentCount);
        setStatusLoaded(true);
      }
    } catch (error) {
      toast(error.response?.data?.message || 'Could not check this like.', true);
      setSaving(false);
      return;
    }
    const nextLiked = !currentLiked;
    setLiked(nextLiked);
    setCount(Math.max(0, currentCount + (nextLiked ? 1 : -1)));
    try {
      const response = nextLiked
        ? await api.post(`/artworks/${artworkId}/likes`)
        : await api.delete(`/artworks/${artworkId}/likes`);
      setLiked(Boolean(response.data?.liked));
      setCount(Number(response.data?.likeCount) || 0);
    } catch (error) {
      setLiked(!nextLiked);
      setCount((value) => Math.max(0, value + (nextLiked ? -1 : 1)));
      toast(error.response?.data?.message || 'Could not update this like.', true);
    } finally {
      setSaving(false);
    }
  }

  if (!canLike) return <span className={`artwork-like-count${compact ? ' compact' : ''}`} aria-label={`${count} likes`}>♡ {count}</span>;
  return (
    <button type="button" className={`artwork-like-button${liked ? ' liked' : ''}${compact ? ' compact' : ''}`} onClick={toggle} disabled={saving} aria-pressed={liked} aria-label={liked ? 'Unlike artwork' : 'Like artwork'}>
      <span aria-hidden="true">{liked ? '♥' : '♡'}</span> {count}
    </button>
  );
}
