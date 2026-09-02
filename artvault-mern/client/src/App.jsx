import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Gallery from './pages/Gallery';
import ArtworkDetail from './pages/ArtworkDetail';
import Artists from './pages/Artists';
import ArtistProfile from './pages/ArtistProfile';
import Exhibits from './pages/Exhibits';
import ExhibitDetail from './pages/ExhibitDetail';
import Upload from './pages/Upload';
import Settings from './pages/Settings';
import ManageExhibits from './pages/ManageExhibits';
import ManageArtists from './pages/ManageArtists';
import ManageGallery from './pages/ManageGallery';
import Archives from './pages/Archives';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
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
              <Route path="/manage-gallery" element={<ProtectedRoute role="admin"><ManageGallery /></ProtectedRoute>} />
              <Route path="/archives" element={<ProtectedRoute role="admin"><Archives /></ProtectedRoute>} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
