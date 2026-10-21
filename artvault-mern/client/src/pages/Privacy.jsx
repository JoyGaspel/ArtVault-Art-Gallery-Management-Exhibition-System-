import { Link } from 'react-router-dom';

export default function Privacy() {
  const contact = import.meta.env.VITE_PRIVACY_CONTACT;
  return <section className="privacy-page">
    <div className="page-head"><div><div className="eyebrow">Your information</div><h1>Privacy notice</h1><p className="sub">ArtVault gallery and exhibit system · Updated October 21, 2026</p></div></div>
    <div className="form-card terms-copy">
      <h2>What we collect and why</h2>
      <p>We process your name, email, profile details, artwork images and descriptions, private ownership proof, exhibit submissions, likes, notification preferences, account verification information, and activity records. These support authentication, gallery display, curation, ownership checks, account protection, and service operation. Provide only information necessary for those purposes; avoid including personal documents or unrelated personal details in proof images.</p>
      <h2>Public content and private access</h2>
      <p>Public profiles and approved public artworks can be viewed by visitors. Vault content and pending or rejected uploads are hidden from public pages but accessible to the owner and authorized administrators. Vault means restricted access, not a guarantee that only the artist can see it. Ownership proof is not shown in public artwork responses.</p>
      <h2>Automated checks and service providers</h2>
      <p>Sexual-content screening runs locally on the application server using NSFWJS. When configured, Google Cloud Vision receives artwork for online image matching, and Gemini receives artwork and proof to assess creation evidence. Supabase supports authentication, MongoDB stores application records and images, and the configured email service delivers verification and activity messages. Hosting and provider services have their own processing and retention terms; deployment administrators must review them.</p>
      <p>Automated checks can be incorrect. An online match does not establish copying, and no match does not establish ownership. Uncertain results are sent for administrator review. Ask an administrator to review an incorrect restriction or decision.</p>
      <h2>Retention and deletion</h2>
      <p>Account and artwork records are retained while needed to provide the service. Removing artwork can create an administrator archive containing the original record, including its proof. Artist recovery is available for 30 days where offered; expiry of recovery does not automatically erase administrator archives. Account deletion can also archive artwork. Permanent archive deletion follows the application's administrator approval process. Activity records and provider-side copies can remain after an account or artwork is removed.</p>
      <p>The deployment operator must define and apply a retention schedule for archives, logs, backups, and provider data. ArtVault does not currently promise automatic erasure of every copy when an account is deleted.</p>
      <h2>Your controls</h2>
      <p>In Settings you can update your profile, manage optional activity emails, and request account deletion after email verification. Required verification and account-security notices may still be sent. Contact the project administrators for access or correction requests, archive deletion requests, or questions about information held by service providers.</p>
      {contact && <p>Privacy contact: {contact}</p>}
      {!contact && <p>Contact the ArtVault administrators through your institution's project contact channel. The deployment operator should publish a dedicated privacy contact here.</p>}
      <p>Keep your password and authenticator private. We use access controls and transport security, but no system can guarantee absolute security.</p>
      <Link to="/settings">Account settings</Link>
    </div>
  </section>;
}
