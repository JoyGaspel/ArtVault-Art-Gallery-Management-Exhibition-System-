export function TermsContent() {
  return (
    <div className="terms-copy">
      <p>These terms and privacy information explain what you provide when creating an ArtVault account, how your information and artworks are used, and the limits of account access, moderation, and deletion. Review them before selecting the required agreement checkbox. Opening this notice does not itself mean you accepted it.</p>

      <section>
        <h3>Accounts and access</h3>
        <p>Use accurate signup information, keep your password private, and only use an account you are authorized to access. Artists may upload and manage their own artworks. Administrators have role-based access for curation and moderation.</p>
        <p>Registration requires your first and last name, a valid email address you control, a password, and acceptance of these terms. Where offered, a name extension is optional. Verify your email before accessing protected features. Profile photo, biography, and specializations are optional. Do not submit identity documents, financial details, or unrelated personal information.</p>
        <p>Keep email codes, authenticator secrets, and backup security codes private. You may enable an authenticator, one-time backup codes, or both. Backup-code setup, replacement, and disabling require email verification; each backup code is single-use. Security checks do not authorize sharing accounts.</p>
      </section>

      <section>
        <h3>Your artworks</h3>
        <p>Only upload works and images you have the right to share. You keep ownership of your work. By choosing Public, you allow ArtVault to display it in the gallery and, when selected, exhibits. Vault works are hidden from public pages but may be viewed by authorized administrators for monitoring. You can change visibility later, subject to exhibit and moderation rules.</p>
        <p>Each upload requires an artwork image, title, one to five categories, a Public or Vault destination, private ownership proof, and an explicit declaration that you created the work or have permission to display it. Description and materials are optional. Selecting Others requires a specific category name. Proof should show relevant sketches, creation progress, editable layers, or permission; a copy of the finished image alone is insufficient. Do not include another person's private information without permission.</p>
        <p>Your public profile and approved public artworks are visible to visitors. Vault, pending, and rejected artworks are restricted to the owner and authorized administrators. Ownership proof is not published in gallery responses. Administrator accounts have no public artist profile; if a Sub-admin returns to Artist status, the artist profile becomes public again.</p>
      </section>

      <section>
        <h3>Respectful use</h3>
        <p>Do not upload unlawful, infringing, deceptive, abusive, or harmful content; attempt to access other accounts; or interfere with the service. ArtVault administrators may suspend accounts or remove content that violates these rules. Removed content may be kept in an administrator archive for review.</p>
        <p>Local sexual-content screening may block nudity, pornography, or suggestive content. It does not detect every harmful image or classify graphic violence. Animated artwork uploads are not accepted. When configured, Google Cloud Vision receives artwork for online matching and Gemini receives artwork and proof for creation-evidence assessment. Provider services have their own data-processing terms. Automated checks can make mistakes: a match does not establish copying and no match does not establish ownership. Uncertain submissions wait for review; contact the administrators to request review of an incorrect decision.</p>
      </section>

      <section>
        <h3>Notifications and data</h3>
        <p>ArtVault processes account details, artwork metadata and images, proof, likes, exhibit entries, email preferences, and activity/security records to operate and protect the gallery. Supabase supports authentication, MongoDB stores application data, hosting services run the application, and the configured email service sends messages. Operational analytics use aggregated records to support curation; private proof and email addresses are not included in analytics exports.</p>
        <p>Your registered email receives verification, password-recovery, security, and role-change messages. Optional artist activity emails can be controlled in Settings; required security notices have no opt-out. Sub-admins receive their own security messages, but dedicated moderation-email subscriptions are not currently implemented. You do not need to provide your email password to ArtVault.</p>
      </section>

      <section>
        <h3>Retention, access, and deletion</h3>
        <p>Records are retained while needed to operate the service. Removing artwork or requesting account deletion can create administrator archives containing the original records and proof. Artist recovery is available for 30 days where offered; expiry of recovery does not automatically erase administrator archives. An account deletion request can suspend the account pending Main Admin review, rather than immediately erasing all data. Logs, backups, and provider-side copies can remain. Permanent archive deletion follows administrator review and the deployment operator's retention policy; universal automatic erasure is not currently implemented.</p>
        <p>Use Settings to correct your profile, manage optional emails, or request account deletion after email verification. Contact the project administrators for information-access requests, corrections, archive-deletion requests, retention questions, or moderation appeals. The deployment operator is responsible for defining archive, log, backup, and provider retention periods.</p>
      </section>

      <section>
        <h3>Availability and changes</h3>
        <p>ArtVault may be unavailable during maintenance or connectivity problems. Offline access, where offered, may be read-only and may not reflect the latest online changes. Features and these terms may change; material changes should be communicated before they take effect.</p>
      </section>

      <p className="terms-contact">For questions, contact the ArtVault project administrators through the contact method provided by your institution or project team.</p>
      {import.meta.env.VITE_PRIVACY_CONTACT && <p className="terms-contact">Privacy and account contact: {import.meta.env.VITE_PRIVACY_CONTACT}</p>}
    </div>
  );
}
