export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup">
      <img src="/matloob-logo.svg" alt="" className={compact ? "brand-logo brand-logo-sm" : "brand-logo"} />
      <span className="brand-wordmark">
        <span className="brand-ar">مطلوب</span>
      </span>
    </span>
  );
}
