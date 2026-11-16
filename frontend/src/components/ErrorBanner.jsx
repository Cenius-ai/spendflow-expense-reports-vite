export default function ErrorBanner({ message, onRetry, retryLabel = "Retry" }) {
  return (
    <div className="banner banner--error" role="alert">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="btn btn--sm btn--secondary" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
