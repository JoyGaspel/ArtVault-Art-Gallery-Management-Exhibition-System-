import { useEffect, useState } from 'react';
import api from '../api';

// Private images require an authenticated request; an ordinary img URL cannot
// carry the artist's token. Revoke temporary blob URLs when the work changes.
export default function useArtworkMedia(artwork, variant = 'thumbnail') {
  const id = artwork?._id;
  const isPrivate = artwork?.visibility === 'private' || ['pending', 'rejected'].includes(artwork?.reviewStatus);
  const inlineThumbnail = isPrivate && variant === 'thumbnail' &&
    typeof artwork?.thumbnail_data === 'string' && artwork.thumbnail_data.startsWith('data:image/')
    ? artwork.thumbnail_data : '';
  const key = `${id || ''}:${variant}:${artwork?.updated_at || ''}`;
  const [media, setMedia] = useState({ key: '', url: '' });

  useEffect(() => {
    if (!isPrivate || !id || artwork?.has_image === false || inlineThumbnail) return undefined;
    const controller = new AbortController();
    let objectUrl = '';
    api.get(`/artworks/${id}/${variant}`, { responseType: 'blob', signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(data);
        setMedia({ key, url: objectUrl });
      })
      .catch(() => { if (!controller.signal.aborted) setMedia({ key, url: null }); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, isPrivate, key, variant, artwork?.has_image, inlineThumbnail]);

  if (isPrivate) return inlineThumbnail || (media.key === key ? media.url : '');
  return variant === 'image'
    ? (artwork?.image_url || '')
    : (artwork?.thumbnail_url || artwork?.image_url || '');
}
