import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Analytics = lazy(() => import('./pages/Analytics'));
const MfaChallenge = lazy(() => import('./pages/MfaChallenge'));
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
const PendingArtworks = lazy(() => import('./pages/PendingArtworks'));
const Archives = lazy(() => import('./pages/Archives'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const ExhibitSubmissions = lazy(() => import('./pages/ExhibitSubmissions'));
const ManageExhibitEntries = lazy(() => import('./pages/ManageExhibitEntries'));
const ExhibitSubmissionStatus = lazy(() => import('./pages/ExhibitSubmissionStatus'));
const ArtworkLikes = lazy(() => import('./pages/ArtworkLikes'));
const Vault = lazy(() => import('./pages/Vault'));
const MyArtworks = lazy(() => import('./pages/MyArtworks'));
const RemovedArtworks = lazy(() => import('./pages/RemovedArtworks'));
const OfflineWorkspace = lazy(() => import('./pages/OfflineWorkspace'));

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true }}>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<div className="empty" role="status">Loading page…</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/mfa" element={<MfaChallenge />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/terms" element={<Navigate to="/signup?terms=open" replace />} />

            <Route element={<AppLayout />}>
              <Route path="/" element={<Gallery />} />
              <Route path="/privacy" element={<Navigate to="/signup?terms=open" replace />} />
              <Route path="/analytics" element={<ProtectedRoute role={['sub_admin', 'main_admin']}><Analytics /></ProtectedRoute>} />
              <Route path="/artworks/:id" element={<ArtworkDetail />} />
              {import.meta.env.VITE_OFFLINE_READONLY === 'true' && <Route path="/offline-workspace" element={<OfflineWorkspace />} />}
              <Route path="/artists" element={<Artists />} />
              <Route path="/artists/:id" element={<ArtistProfile />} />
              <Route path="/exhibits" element={<Exhibits />} />
              <Route path="/exhibits/:id" element={<ExhibitDetail />} />
              <Route path="/upload" element={<ProtectedRoute role="artist"><Upload /></ProtectedRoute>} />
              <Route path="/vault" element={<ProtectedRoute role="artist"><Vault /></ProtectedRoute>} />
              <Route path="/my-artworks" element={<ProtectedRoute role="artist"><MyArtworks /></ProtectedRoute>} />
              <Route path="/removed-artworks" element={<ProtectedRoute role="artist"><RemovedArtworks /></ProtectedRoute>} />
              <Route path="/manage-vault" element={<ProtectedRoute role={['sub_admin', 'main_admin']}><Vault /></ProtectedRoute>} />
              <Route path="/exhibit-submissions" element={<ProtectedRoute role="artist"><ExhibitSubmissions /></ProtectedRoute>} />
              <Route path="/exhibit-submission-status" element={<ProtectedRoute role="artist"><ExhibitSubmissionStatus /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute role={['artist', 'admin', 'sub_admin', 'main_admin']}><Settings /></ProtectedRoute>} />
              <Route path="/manage-exhibits" element={<ProtectedRoute role="admin"><ManageExhibits /></ProtectedRoute>} />
              <Route path="/manage-exhibit-entries" element={<ProtectedRoute role="admin"><ManageExhibitEntries /></ProtectedRoute>} />
              <Route path="/manage-artists" element={<ProtectedRoute role="admin"><ManageArtists /></ProtectedRoute>} />
              <Route path="/manage-sub-admins" element={<ProtectedRoute role={['main_admin']}><ManageSubAdmins /></ProtectedRoute>} />
              <Route path="/manage-gallery" element={<ProtectedRoute role="admin"><ManageGallery /></ProtectedRoute>} />
              <Route path="/pending-artworks" element={<ProtectedRoute role={['sub_admin', 'main_admin']}><PendingArtworks /></ProtectedRoute>} />
              <Route path="/archives" element={<ProtectedRoute role="admin"><Archives /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute role={['sub_admin', 'main_admin']}><AuditLogs /></ProtectedRoute>} />
              <Route path="/artwork-likes" element={<ProtectedRoute role="main_admin"><ArtworkLikes /></ProtectedRoute>} />
            </Route>
          </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
