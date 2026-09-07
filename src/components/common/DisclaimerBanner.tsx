export type DisclaimerBannerProps = {
  className?: string;
};

const DEFAULT_TEXT =
  'Simulation pédagogique — ne constitue pas un conseil fiscal, juridique ou financier. Vérifiez auprès d’un professionnel avant toute décision.';

export function DisclaimerBanner({ className = '' }: DisclaimerBannerProps) {
  return (
    <aside
      role="note"
      aria-label="Avertissement légal"
      className={`border border-disclaimer-border bg-disclaimer-bg px-3 py-2 text-sm text-disclaimer-fg ${className}`.trim()}
    >
      <p className="m-0 leading-snug">{DEFAULT_TEXT}</p>
    </aside>
  );
}
