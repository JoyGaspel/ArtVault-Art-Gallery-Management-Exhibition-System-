const KEY = 'artvault:offline-artwork-drafts:v1';

export function readOfflineDrafts() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value.filter((draft) => draft && typeof draft.id === 'string') : [];
  } catch { return []; }
}

export function writeOfflineDrafts(drafts) {
  // Metadata only; never put images, passwords, or access tokens here.
  if (!Array.isArray(drafts) || drafts.length > 100) throw new Error('The offline draft limit is 100 artworks.');
  localStorage.setItem(KEY, JSON.stringify(drafts));
  window.dispatchEvent(new Event('artvault:offline-drafts-changed'));
}

export function makeOfflineDraft(artwork, values) {
  if (!artwork?._id || !artwork.updated_at || artwork.visibility === 'private') {
    throw new Error('Only public artworks with a snapshot date can be drafted offline.');
  }
  return {
    id: String(artwork._id),
    artistName: artwork.artist?.name || 'Artist',
    expectedUpdatedAt: artwork.updated_at,
    savedLocallyAt: new Date().toISOString(),
    title: values.title.trim(),
    description: values.description.trim(),
    categories: values.categories,
    materials: values.materials,
  };
}
