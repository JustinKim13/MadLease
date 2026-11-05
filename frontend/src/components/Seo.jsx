import { Helmet } from 'react-helmet-async';

const CANONICAL_DOMAIN = 'https://www.madlease.net';
const DEFAULT_IMAGE = `${CANONICAL_DOMAIN}/madlease_logo_new.png`;

/**
 * Per-route SEO metadata. Pass `path` as the route path (e.g. "/listings").
 * For listing pages, pass a full `canonical` override.
 */
export default function Seo({
  title,
  description,
  path = '/',
  canonical,
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
  jsonLd,
}) {
  const fullTitle = title || 'MadLease — Subleases & Parking at UW-Madison';
  const desc = description || "UW-Madison's marketplace for subleases and parking spots. Post your listing or find your next place in minutes.";
  const url = canonical || `${CANONICAL_DOMAIN}${path}`;

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="MadLease" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
