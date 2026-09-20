export default function PasswordToggle({ visible, onToggle }) {
  return (
    <button type="button" className="password-icon-toggle" onClick={onToggle}
      aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {visible ? <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.7" />
        </> : <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.7" />
          <path d="m3 3 18 18" />
        </>}
      </svg>
    </button>
  );
}
