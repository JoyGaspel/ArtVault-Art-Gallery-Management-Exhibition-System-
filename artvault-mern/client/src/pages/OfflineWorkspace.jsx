import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import api, { deployedApiUrl } from '../api';
import { createOfflineSyncClient, supabaseEnabled } from '../lib/supabase';
import { makeOfflineDraft, readOfflineDrafts, writeOfflineDrafts } from '../lib/offlineDrafts';

const liveApi = axios.create({ baseURL: deployedApiUrl, timeout: 20000 });
const allowedCategories = new Set([
  'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
]);

function fieldsFrom(artwork) {
  return {
    title: artwork?.title || '',
    description: artwork?.description || '',
    categories: (artwork?.categories || []).join(', '),
    materials: (artwork?.materials || []).join(', '),
  };
}

function parseList(value, max, label) {
  const items = [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))];
  if (items.length > max || items.some((part) => part.length > (label === 'Category' ? 40 : 80))) {
    throw new Error(`${label}: use at most ${max} comma-separated values with short names.`);
  }
  if (label === 'Category' && items.some((part) => !allowedCategories.has(part))) {
    throw new Error('Choose categories from the ArtVault category list.');
  }
  return items;
}

export default function OfflineWorkspace() {
  const [artworks, setArtworks] = useState([]);
  const [drafts, setDrafts] = useState(readOfflineDrafts);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(fieldsFrom(null));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [conflicts, setConflicts] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);
  const selectedArtwork = artworks.find((artwork) => String(artwork._id) === selectedId);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const first = await api.get('/artworks', { params: { page: 1, limit: 100 } });
        const all = [...(first.data.artworks || [])];
        for (let page = 2; page <= (first.data.pages || 1); page += 1) {
          const response = await api.get('/artworks', { params: { page, limit: 100 } });
          all.push(...(response.data.artworks || []));
        }
        if (!cancelled) setArtworks(all);
      } catch {
        if (!cancelled) setMessage('Could not read the local snapshot. Check that the offline API and MongoDB are running.');
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function saveDraft(event) {
    event.preventDefault();
    try {
      if (!selectedArtwork) throw new Error('Choose an artwork from the local snapshot.');
      if (!form.title.trim() || form.title.trim().length > 50) throw new Error('Title must be between 1 and 50 characters.');
      if (form.description.trim().length > 1000) throw new Error('Description must be 1,000 characters or fewer.');
      const categories = parseList(form.categories, 5, 'Category');
      if (!categories.length) throw new Error('Choose at least one category.');
      const materials = parseList(form.materials, 20, 'Material');
      const existing = readOfflineDrafts().find((item) => item.id === String(selectedArtwork._id));
      const draft = makeOfflineDraft({ ...selectedArtwork, updated_at: existing?.expectedUpdatedAt || selectedArtwork.updated_at }, { ...form, categories, materials });
      const next = [...readOfflineDrafts().filter((item) => item.id !== draft.id), draft];
      writeOfflineDrafts(next);
      setDrafts(next);
      setConflicts((current) => { const copy = { ...current }; delete copy[draft.id]; return copy; });
      setMessage(`Draft for “${draft.title}” saved on this computer. It has not changed the live artwork.`);
    } catch (error) { setMessage(error.message || 'Could not save the draft.'); }
  }

  function selectArtwork(artwork) {
    const draft = drafts.find((item) => item.id === String(artwork._id));
    setSelectedId(String(artwork._id));
    setForm(fieldsFrom(draft || artwork));
  }

  function removeDraft(id) {
    const next = readOfflineDrafts().filter((item) => item.id !== id);
    writeOfflineDrafts(next);
    setDrafts(next);
    setConflicts((current) => { const copy = { ...current }; delete copy[id]; return copy; });
    setMessage('Local draft discarded. The live artwork was not changed.');
  }

  const sendDraft = useCallback(async (draft, accessToken, expectedUpdatedAt = draft.expectedUpdatedAt) => {
    try {
      await liveApi.patch(`/artworks/${draft.id}/sync-metadata`, {
        expectedUpdatedAt,
        title: draft.title,
        description: draft.description,
        categories: draft.categories,
        materials: draft.materials,
      }, { headers: { Authorization: `Bearer ${accessToken}` } });
      const next = readOfflineDrafts().filter((item) => item.id !== draft.id);
      writeOfflineDrafts(next);
      setDrafts(next);
      setConflicts((current) => { const copy = { ...current }; delete copy[draft.id]; return copy; });
      return 'synced';
    } catch (error) {
      if (error.response?.status === 409 && error.response.data?.current) {
        setConflicts((current) => ({ ...current, [draft.id]: error.response.data.current }));
        return 'conflict';
      }
      if (error.response?.status === 401) {
        setToken('');
        throw new Error('Your online session expired. Sign in again to continue.');
      }
      if (error.response?.status === 404 && error.response?.data?.message === 'Not Found') {
        throw new Error('The live server has not deployed the offline sync endpoint yet. Your draft is still saved on this computer.');
      }
      throw new Error(error.response?.data?.message || `Could not sync “${draft.title}”. The draft is still saved locally.`);
    }
  }, []);

  const syncAll = useCallback(async (accessToken) => {
    if (!accessToken || busy.current || !navigator.onLine) return;
    busy.current = true;
    setSyncing(true);
    let synced = 0;
    let conflicted = 0;
    let failed = 0;
    try {
      for (const draft of readOfflineDrafts()) {
        try {
          const result = await sendDraft(draft, accessToken);
          if (result === 'synced') synced += 1;
          else conflicted += 1;
        } catch (error) {
          failed += 1;
          setMessage(error.message);
          if (/session expired/i.test(error.message)) break;
        }
      }
      if (!failed) setMessage(`${synced} draft${synced === 1 ? '' : 's'} synced. ${conflicted ? `${conflicted} conflict${conflicted === 1 ? '' : 's'} need your decision.` : 'No conflicts.'}`);
    } finally { busy.current = false; setSyncing(false); }
  }, [sendDraft]);

  useEffect(() => {
    if (!token) return undefined;
    const onReconnect = () => syncAll(token);
    window.addEventListener('online', onReconnect);
    return () => window.removeEventListener('online', onReconnect);
  }, [token, syncAll]);

  async function signInAndSync(event) {
    event.preventDefault();
    if (!navigator.onLine) { setMessage('Reconnect to the internet before signing in. Your drafts remain saved.'); return; }
    const authClient = createOfflineSyncClient();
    if (!authClient) { setMessage('Supabase public URL/key are missing from client/.env. The local drafts are safe, but online sync cannot start.'); return; }
    setSyncing(true);
    try {
      const { data, error } = await authClient.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session?.access_token) throw new Error(error?.message || 'Could not sign in.');
      const accessToken = data.session.access_token;
      const { data: profile } = await liveApi.get('/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (profile.user?.role !== 'artist') throw new Error('Offline draft sync is for artist accounts only.');
      setPassword('');
      setToken(accessToken);
      setMessage('Signed in online. Checking your saved drafts now…');
      setSyncing(false);
      await syncAll(accessToken);
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || 'Could not verify your account online.');
      setSyncing(false);
    }
  }

  async function keepMyDraft(draft) {
    if (!token || !conflicts[draft.id]) return;
    setSyncing(true);
    try {
      await sendDraft(draft, token, conflicts[draft.id].updated_at);
      setMessage('Your draft was saved online after you chose it over the newer version.');
    } catch (error) { setMessage(error.message); }
    finally { setSyncing(false); }
  }

  return (
    <section className="offline-workspace">
      <div className="offline-workspace-heading"><div><span className="eyebrow">TRUSTED COMPUTER</span><h1>Offline drafts &amp; sync</h1><p>Save title and detail changes while disconnected. Nothing is uploaded until you sign in again. Images, Vault artworks, likes, and exhibit changes stay online-only.</p></div><span className="offline-draft-count">{drafts.length} local draft{drafts.length === 1 ? '' : 's'}</span></div>
      {message && <p className="offline-workspace-message" role="status">{message}</p>}
      <div className="offline-workspace-grid">
        <div className="offline-workspace-panel"><h2>Choose an artwork</h2><p>These are public artworks from the last local backup. You can draft only your own work; the live server checks ownership during sync.</p>{loading ? <p>Loading local artworks…</p> : <div className="offline-art-list">{artworks.map((artwork) => <button type="button" key={artwork._id} className={selectedId === String(artwork._id) ? 'selected' : ''} onClick={() => selectArtwork(artwork)}><strong>{artwork.title}</strong><span>by {artwork.artist?.name || 'Artist'}{drafts.some((draft) => draft.id === String(artwork._id)) ? ' · Draft saved' : ''}</span></button>)}</div>}</div>
        <div className="offline-workspace-panel"><h2>Edit a local draft</h2>{selectedArtwork ? <form onSubmit={saveDraft} className="offline-draft-form"><label>Title<input value={form.title} maxLength={50} required onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Description<textarea value={form.description} maxLength={1000} rows={5} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Categories (comma-separated)<input value={form.categories} onChange={(event) => setForm({ ...form, categories: event.target.value })} /></label><label>Materials (comma-separated)<input value={form.materials} onChange={(event) => setForm({ ...form, materials: event.target.value })} /></label><button className="btn btn-primary" type="submit">Save local draft</button></form> : <p>Select an artwork to start a draft.</p>}</div>
      </div>
      <div className="offline-workspace-panel offline-sync-panel"><h2>Reconnect and sync</h2><p>Sign in with the artist account that owns these artworks. Drafts sync automatically after sign-in or when the connection returns while this page stays open. You decide what to do with conflicts.</p>{!supabaseEnabled && <p className="offline-sync-warning">The client Supabase configuration is missing; reconnect sync is unavailable.</p>}{!token ? <form className="offline-sync-login" onSubmit={signInAndSync}><label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="btn btn-primary" type="submit" disabled={syncing || !supabaseEnabled}>{syncing ? 'Checking…' : 'Sign in and sync'}</button></form> : <div className="offline-sync-actions"><span>Online sign-in verified for this page only.</span><button className="btn btn-primary" type="button" disabled={syncing} onClick={() => syncAll(token)}>{syncing ? 'Syncing…' : 'Sync remaining drafts'}</button><button className="btn btn-ghost" type="button" onClick={() => setToken('')}>End sync session</button></div>}</div>
      {drafts.length > 0 && <div className="offline-workspace-panel"><h2>Saved on this computer</h2><div className="offline-queue">{drafts.map((draft) => <article key={draft.id}><div><strong>{draft.title}</strong><span>by {draft.artistName} · Saved {new Date(draft.savedLocallyAt).toLocaleString()}</span></div>{conflicts[draft.id] ? <div className="offline-conflict"><p><strong>Conflict:</strong> this artwork changed online after your backup. Your draft remains safe.</p><p>Online title: {conflicts[draft.id].title}</p><p>Local title: {draft.title}</p><button className="btn btn-ghost" type="button" disabled={syncing} onClick={() => removeDraft(draft.id)}>Keep online version</button><button className="btn btn-primary" type="button" disabled={syncing || !token} onClick={() => keepMyDraft(draft)}>Use my local draft</button></div> : <button className="btn btn-ghost" type="button" onClick={() => removeDraft(draft.id)}>Discard draft</button>}</article>)}</div></div>}
    </section>
  );
}
