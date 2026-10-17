import { Link } from 'react-router-dom';
import AuthNav from '../components/AuthNav';

export default function Terms() {
  return <div className="auth-page">
    <AuthNav />
    <main className="form-card" style={{ maxWidth: 760, margin: '32px auto', padding: 28, lineHeight: 1.65 }}>
      <div className="eyebrow">Effective 17 October 2026</div>
      <h1>ArtVault Terms and Conditions</h1>
      <p>These terms explain how to use ArtVault and how artwork visibility, moderation, and account access work.</p>
      <h2>Accounts and access</h2>
      <p>Use accurate signup information, keep your password private, and only use an account you are authorized to access. Artists may upload and manage their own artworks. Administrators have role-based access for curation and moderation.</p>
      <h2>Your artworks</h2>
      <p>Only upload works and images you have the right to share. You keep ownership of your work. By choosing Public, you allow ArtVault to display it in the gallery and, when selected, exhibits. Vault works are hidden from public pages but may be viewed by authorized administrators for monitoring. You can change visibility later, subject to exhibit and moderation rules.</p>
      <h2>Respectful use</h2>
      <p>Do not upload unlawful, infringing, deceptive, abusive, or harmful content; attempt to access other accounts; or interfere with the service. ArtVault administrators may suspend accounts or remove content that violates these rules. Removed content may be kept in an administrator archive for review.</p>
      <h2>Notifications and data</h2>
      <p>ArtVault uses your email for account verification, password recovery, and important account notices. Optional activity emails can be controlled in settings. Your profile, artwork details, likes, submissions, and other account data are processed to provide the service. See any separate privacy notice when one is published.</p>
      <h2>Availability and changes</h2>
      <p>ArtVault may be unavailable during maintenance or connectivity problems. Offline access, where offered, may be read-only and may not reflect the latest online changes. Features and these terms may change; material changes should be communicated before they take effect.</p>
      <p>For questions, contact the ArtVault project administrators through the contact method provided by your institution or project team.</p>
      <p><Link to="/signup">Back to sign up</Link></p>
    </main>
  </div>;
}
