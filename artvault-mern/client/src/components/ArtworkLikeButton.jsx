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
  const [statusLoaded, setStatusLoaded] = useState(!canLike);
  const likeCacheKey = canLike && user?.id ? `artvault:liked:${user.id}:${artworkId}` : '';

  useEffect(() => setCount(Number(initialCount) || 0), [initialCount]);

  useEffect(() => {
    // Reset account-specific state whenever the signed-in artist changes.
    // The cache key includes the artist id, so one account can never inherit
    // another account's red liked state after logout/login.
    setLiked(false);
    setStatusLoaded(!canLike);
    if (!likeCacheKey) return;
    try {
      const cached = localStorage.getItem(likeCacheKey);
      if (cached !== null) setLiked(cached === '1');
    } catch { /* Local storage is optional. */ }
    // The API remains authoritative; the cached value only prevents a
    // visible flash while the account-specific status is being fetched.
  }, [likeCacheKey]);

  useEffect(() => {
    const onLikesChanged = (event) => {
      const detail = event.detail || {};
      if (String(detail.artworkId) === String(artworkId) && Number.isFinite(Number(detail.likeCount))) {
        setCount(Number(detail.likeCount));
        if (typeof detail.liked === 'boolean') setLiked(detail.liked);
      }
    };
    window.addEventListener('artvault:likes-changed', onLikesChanged);
    return () => window.removeEventListener('artvault:likes-changed', onLikesChanged);
  }, [artworkId]);

  useEffect(() => {
    let cancelled = false;
    if (!canLike || !artworkId) return undefined;
    api.get(`/artworks/${artworkId}/likes/me`)
      .then((response) => {
        if (!cancelled) {
          const likeCount = Number(response.data?.likeCount) || 0;
          const serverLiked = Boolean(response.data?.liked);
          setLiked(serverLiked);
          setCount(likeCount);
          try { if (likeCacheKey) localStorage.setItem(likeCacheKey, serverLiked ? '1' : '0'); } catch { /* Local storage is optional. */ }
          setStatusLoaded(true);
        }
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [artworkId, canLike, likeCacheKey]);

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
        try { if (likeCacheKey) localStorage.setItem(likeCacheKey, currentLiked ? '1' : '0'); } catch { /* Local storage is optional. */ }
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
      const likeCount = Number(response.data?.likeCount) || 0;
      setCount(likeCount);
      try { if (likeCacheKey) localStorage.setItem(likeCacheKey, nextLiked ? '1' : '0'); } catch { /* Local storage is optional. */ }
      window.dispatchEvent(new CustomEvent('artvault:likes-changed', { detail: { artworkId, likeCount, liked: Boolean(response.data?.liked) } }));
      if (nextLiked) window.setTimeout(() => window.dispatchEvent(new Event('artvault:notifications-changed')), 350);
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
