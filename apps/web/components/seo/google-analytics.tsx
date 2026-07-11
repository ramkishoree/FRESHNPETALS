import Script from 'next/script';

/**
 * Customer-facing analytics only — never rendered anywhere under
 * `/admin` (the admin panel has a hard no-analytics rule; see
 * app/(storefront)/layout.tsx, the only place this is imported).
 * No-ops entirely when NEXT_PUBLIC_GA_MEASUREMENT_ID isn't set.
 */
export function GoogleAnalytics({
  measurementId,
  nonce,
}: {
  measurementId: string;
  nonce?: string;
}) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        {...(nonce ? { nonce } : {})}
      />
      <Script id="ga4-init" strategy="afterInteractive" {...(nonce ? { nonce } : {})}>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
