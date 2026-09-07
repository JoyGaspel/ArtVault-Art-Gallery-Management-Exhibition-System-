import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Gallery = lazy(() => import('./pages/Gallery'));
const ArtworkDetail = lazy(() => import('./pages/ArtworkDetail'));
const Artists = lazy(() => import('./pages/Artists'));
const ArtistProfile = lazy(() => import('./pages/ArtistProfile'));
const Exhibits = lazy(() => import('./pages/Exhibits'));
const ExhibitDetail = lazy(() => import('./pages/ExhibitDetail'));
const Upload = lazy(() => import('./pages/Upload'));
const Settings = lazy(() => import('./pages/Settings'));
const ManageExhibits = lazy(() => import('./pages/ManageExhibits'));
const ManageArtists = lazy(() => import('./pages/ManageArtists'));
const ManageSubAdmins = lazy(() => import('./pages/ManageSubAdmins'));
const ManageGallery = lazy(() => import('./pages/ManageGallery'));
const Archives = lazy(() => import('./pages/Archives'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<div className="route-loading" role="status">Loading ArtVault…</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route element={<AppLayout />}>
              <Route path="/" element={<Gallery />} />
              <Route path="/artworks/:id" element={<ArtworkDetail />} />
              <Route path="/artists" element={<Artists />} />
              <Route path="/artists/:id" element={<ArtistProfile />} />
              <Route path="/exhibits" element={<Exhibits />} />
              <Route path="/exhibits/:id" element={<ExhibitDetail />} />
              <Route path="/upload" element={<ProtectedRoute role="artist"><Upload /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute role="artist"><Settings /></ProtectedRoute>} />
              <Route path="/manage-exhibits" element={<ProtectedRoute role="admin"><ManageExhibits /></ProtectedRoute>} />
              <Route path="/manage-artists" element={<ProtectedRoute role="admin"><ManageArtists /></ProtectedRoute>} />
              <Route path="/manage-sub-admins" element={<ProtectedRoute role={['main_admin']}><ManageSubAdmins /></ProtectedRoute>} />
              <Route path="/manage-gallery" element={<ProtectedRoute role="admin"><ManageGallery /></ProtectedRoute>} />
              <Route path="/archives" element={<ProtectedRoute role="admin"><Archives /></ProtectedRoute>} />
            </Route>
          </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
