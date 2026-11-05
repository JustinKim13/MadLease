// Vercel Edge Middleware for Open Graph meta tags + JSON-LD structured data
// Serves OG-enriched HTML for /listings/{id} to crawlers; real users pass through to the SPA

// Your Heroku backend API URL
const API_BASE_URL = 'https://madlease-backend-87f26c5ebdc0.herokuapp.com/api';

// Production domain for canonical URLs
const CANONICAL_DOMAIN = 'https://www.madlease.net';

// Site logo — change this one filename to update all favicons, OG images, and structured data.
// Also update the three <link>/<meta> tags in index.html that reference the same file.
const LOGO_FILENAME = 'madlease_logo_new.png';

// Known SPA routes — middleware passes these through with 200
const KNOWN_ROUTES = /^\/($|listings$|listings\/new$|listings\/[a-zA-Z0-9-]+$|listings\/[a-zA-Z0-9-]+\/edit$|profile$|messages$|messages\/[^/]+$|privacy$|terms$|contact$|about$)/;

export const config = {
  // Match all paths except static assets, sitemap, and llms files
  matcher: ['/((?!_next|assets|api|sitemap\\.xml|llms-full\\.txt|llms\\.txt|favicon\\.ico|madlease_logo\\.png|robots\\.txt|af846ec972ef74386cc4dd4ee841410d\\.txt|.*\\.js$|.*\\.css$|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$|.*\\.webp$|.*\\.woff2?$).*)'],
};

export default async function middleware(request) {
  const url = new URL(request.url);

  // Break redirect loops from in-app browsers (Snapchat, Instagram, etc.)
  // whose UA matches the bot regex but actually execute the redirect
  if (url.searchParams.has('_r')) {
    return;
  }

  const userAgent = request.headers.get('user-agent') || '';

  const isBot = /facebookexternalhit|Twitterbot|LinkedInBot|Discordbot|Slackbot|WhatsApp|TelegramBot|Googlebot|Applebot|Snapchat|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|Bingbot|DuckAssistBot|YandexBot|Bytespider|Amazonbot|Meta-ExternalAgent/i.test(userAgent);

  // Return 404 status for unknown routes so Google de-indexes them
  if (!KNOWN_ROUTES.test(url.pathname)) {
    const res = await fetch(new URL('/', request.url));
    return new Response(res.body, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // For bots hitting non-listing-detail routes, serve prerendered HTML so AI crawlers
  // and search engines can read real content instead of an empty SPA shell.
  const listingMatch = url.pathname.match(/^\/listings\/([a-zA-Z0-9-]+)$/);
  if (isBot && !listingMatch) {
    const staticHtml = renderStaticBotPage(url.pathname);
    if (staticHtml) {
      return new Response(staticHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400',
        },
      });
    }
    if (url.pathname === '/listings' || url.pathname === '/listings/') {
      try {
        const listingsRes = await fetch(`${API_BASE_URL}/listings`);
        if (listingsRes.ok) {
          const listings = await listingsRes.json();
          const html = renderListingsIndexHtml(listings);
          return new Response(html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600',
            },
          });
        }
      } catch (e) {
        console.error('Listings index bot render error:', e);
      }
    }
  }

  // Below this point: only the original /listings/{id} OG preview flow.
  if (!isBot || !listingMatch) {
    return;
  }

  // Fetch listing data for OG tags
  const listingId = listingMatch[1];

  try {
    const apiResponse = await fetch(`${API_BASE_URL}/listings/${listingId}/details`);

    if (!apiResponse.ok) {
      // Listing not found - let normal handling occur
      return;
    }

    const listing = await apiResponse.json();

    // Get the first image URL for og:image (permanent CloudFront URL in prod)
    const imageUrl = listing.preSignedGetUrls?.[0] || `${CANONICAL_DOMAIN}/${LOGO_FILENAME}`;

    // Build the canonical URL using the production domain
    const canonicalUrl = `${CANONICAL_DOMAIN}/listings/${listingId}`;

    // Format price — fall back to parking price for parking-only listings
    const rentOrParkingPrice = listing.rent || listing.parking?.price || 0;
    const price = rentOrParkingPrice ? `$${rentOrParkingPrice}/mo` : '';

    // Build description with key details
    const beds = listing.bedrooms ? `${listing.bedrooms} bed` : '';
    const baths = listing.bathrooms ? `${listing.bathrooms} bath` : '';
    const sqft = listing.squareFeet ? `${listing.squareFeet} sq ft` : '';
    const location = [listing.street, listing.city, listing.state].filter(Boolean).join(', ');

    const ogDescription = [price, beds, baths, sqft]
      .filter(Boolean)
      .join(' | ');

    // Build a richer body description for crawlers
    const bodyParts = [];
    if (listing.title) bodyParts.push(listing.title);
    if (location) bodyParts.push(`Located at ${location}.`);
    const isParking = listing.listingType === 'PARKING';
    if (price) bodyParts.push(`${isParking ? 'Price' : 'Rent'}: ${price}.`);
    if (beds || baths) bodyParts.push(`${[beds, baths].filter(Boolean).join(', ')}.`);
    if (sqft) bodyParts.push(`${sqft}.`);
    if (listing.startDate || listing.endDate) {
      const start = listing.startDate ? new Date(listing.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
      const end = listing.endDate ? new Date(listing.endDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
      if (start && end) bodyParts.push(`Available ${start} through ${end}.`);
      else if (start) bodyParts.push(`Available from ${start}.`);
    }
    if (listing.description) bodyParts.push(listing.description);
    const bodyText = bodyParts.join(' ');

    // Format dates for JSON-LD
    const datePosted = listing.createdAt ? new Date(listing.createdAt).toISOString().split('T')[0] : '';
    const validFrom = listing.startDate ? new Date(listing.startDate).toISOString().split('T')[0] : '';
    const validThrough = listing.endDate ? new Date(listing.endDate).toISOString().split('T')[0] : '';

    // Build JSON-LD structured data (not HTML-escaped — JSON is parsed as JSON)
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      "@id": canonicalUrl,
      "name": listing.title || '',
      "description": listing.description || '',
      "url": canonicalUrl,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": listing.street || '',
        "addressLocality": listing.city || '',
        "addressRegion": listing.state || '',
        "postalCode": listing.zipcode ? String(listing.zipcode) : '',
        "addressCountry": "US"
      },
      "offers": {
        "@type": "Offer",
        "price": rentOrParkingPrice,
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock"
      },
      "photo": listing.preSignedGetUrls?.length ? listing.preSignedGetUrls : [],
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": `${CANONICAL_DOMAIN}/` },
          { "@type": "ListItem", "position": 2, "name": "Listings", "item": `${CANONICAL_DOMAIN}/listings` },
          { "@type": "ListItem", "position": 3, "name": listing.title || 'Listing', "item": canonicalUrl }
        ]
      }
    };

    if (listing.bedrooms) jsonLd.numberOfRooms = listing.bedrooms;
    if (listing.bathrooms) jsonLd.numberOfBathroomsTotal = listing.bathrooms;
    if (listing.squareFeet) jsonLd.floorSize = { "@type": "QuantitativeValue", "value": listing.squareFeet, "unitCode": "FTK" };
    if (datePosted) jsonLd.datePosted = datePosted;
    if (validFrom) jsonLd.offers.validFrom = validFrom;
    if (validThrough) jsonLd.offers.validThrough = validThrough;

    // Construct HTML with OG tags + JSON-LD
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(listing.title)} | MadLease</title>

  <!-- Open Graph Tags -->
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="MadLease" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(listing.title)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(listing.title)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />

  <!-- Standard Meta Tags -->
  <meta name="description" content="${escapeHtml(ogDescription)}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Structured Data -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

  <!-- Redirect real users to the SPA (_r param prevents middleware loop) -->
  <script>window.location.replace("${canonicalUrl}?_r=1");</script>
  <noscript><meta http-equiv="refresh" content="0;url=${canonicalUrl}?_r=1" /></noscript>
</head>
<body>
  <h1>${escapeHtml(listing.title)}</h1>
  <p>${escapeHtml(bodyText)}</p>
  <p>View this listing on <a href="${canonicalUrl}?_r=1">MadLease</a> — UW-Madison's sublease and parking marketplace.</p>
${renderNavFooterHtml()}
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
      },
    });

  } catch (error) {
    // API error - fall back to normal SPA behavior
    console.error('OG middleware error:', error);
    return;
  }
}

// Static route content for bot prerendering — real copy crawlers can read,
// OG/Twitter tags, JSON-LD, and a redirect for human users.
const STATIC_ROUTES = {
  '/': {
    title: 'MadLease — UW-Madison Sublease & Parking Marketplace',
    description: 'Find verified subleases and parking spots near UW-Madison. MadLease connects Badgers with trusted student-to-student rentals and parking in Madison, Wisconsin.',
    h1: 'MadLease — Sublease & Parking Marketplace for UW-Madison Students',
    body: [
      'MadLease is the student-run sublease and parking marketplace built specifically for the University of Wisconsin–Madison community. Browse verified listings from fellow Badgers, save your favorites, and message hosts directly — all in one place.',
      'Every listing is posted by a real student or Madison-area resident. Users who sign up with a @wisc.edu email get an automatic verified badge, so renters can trust who they are talking to. Anyone can create a free account in seconds with any email or Google.',
      'Find apartments, houses, rooms, and standalone parking spots near campus, downtown Madison, State Street, Lakeshore, and the Capitol area. Filter by price, bedrooms, move-in and move-out dates, amenities, and listing type.',
      'Popular features include an interactive map view, saved favorites, direct messaging between renters and hosts, and dark mode. MadLease is free to use for both renters and subletters. You can also list or find standalone parking spots — perfect for game days or commuters.',
    ],
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'MadLease',
        url: `${CANONICAL_DOMAIN}/`,
        description: 'Sublease and parking marketplace for UW-Madison students.',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${CANONICAL_DOMAIN}/listings?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'MadLease',
        url: `${CANONICAL_DOMAIN}/`,
        logo: `${CANONICAL_DOMAIN}/${LOGO_FILENAME}`,
        areaServed: { '@type': 'City', name: 'Madison, Wisconsin' },
      },
    ],
  },
  '/about': {
    title: 'About MadLease — Built by Badgers, for Badgers',
    description: 'Learn about MadLease, the student-built sublease and parking marketplace for UW-Madison. Our mission, story, and how we verify listings.',
    h1: 'About MadLease',
    body: [
      'MadLease was built by UW-Madison students who were tired of scrolling Facebook groups and shady spreadsheets to find a sublease or parking spot. We set out to create a trusted, modern marketplace made specifically for the Badger community.',
      'Our mission is simple: make it easy and safe for UW-Madison students to find and list subleases, parking spots, and housing near campus. Every verified user signs in with their @wisc.edu email, giving renters confidence that they are dealing with real students.',
      'MadLease is free for renters and subletters. We do not take a commission, we do not sell your data, and we do not pad the platform with fake listings. Just real housing and parking, from real Badgers.',
      'We are continuously adding features based on student feedback — things like an interactive map, saved favorites, in-app messaging, standalone parking listings, and dark mode. If you have ideas or bug reports, reach out through our contact page.',
    ],
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'About MadLease',
        url: `${CANONICAL_DOMAIN}/about`,
        description: 'About the MadLease sublease and parking marketplace for UW-Madison students.',
      },
    ],
  },
  '/contact': {
    title: 'Contact MadLease — Support for UW-Madison Students',
    description: 'Get in touch with the MadLease team. Questions, bug reports, and feedback from UW-Madison students welcome.',
    h1: 'Contact MadLease',
    body: [
      'Have a question, bug report, user report, or feature request? We would love to hear from you. The MadLease team is made up of UW-Madison students who actively read every message.',
      'Reach us through the contact form on this page. Pick a reason for your message (general help, bug report, user report, feature request, or other), include your email, and we will get back to you as soon as possible.',
      'For urgent issues related to a listing or another user, please include as much detail as you can so we can look into it right away.',
    ],
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Contact MadLease',
        url: `${CANONICAL_DOMAIN}/contact`,
        description: 'Contact the MadLease team for support, bug reports, and feedback.',
      },
    ],
  },
  '/privacy': {
    title: 'Privacy Policy — MadLease',
    description: 'How MadLease collects, uses, and protects your personal information when using our UW-Madison sublease marketplace.',
    h1: 'Privacy Policy',
    body: [
      'Last updated: January 1, 2026.',
      'MadLease respects your privacy. This policy explains what information we collect when you use our sublease marketplace, how we use it, and the steps we take to protect it.',
    ],
    sections: [
      {
        h2: 'Information We Collect',
        paragraphs: ['When you use MadLease, we collect the following:'],
        list: [
          'Account Information: name, email address, and profile picture when you create an account or sign in with Google.',
          'Listing Information: property details, photos, location, and rental information you provide.',
          'Messages: we provide encrypted messaging between users — all messages are encrypted end-to-end, meaning we cannot read or access the content of your conversations.',
          'Usage Data: how you interact with our service, including saved listings and preferences.',
        ],
      },
      {
        h2: 'How We Use Your Information',
        paragraphs: ['We use your information to:'],
        list: [
          'Provide and maintain our subletting platform.',
          'Enable communication between renters and subletters.',
          'Improve our services and user experience.',
          'Send important updates about your account or listings.',
        ],
      },
      {
        h2: 'Data Storage and Security',
        paragraphs: [
          'Your data is stored securely using industry-standard practices. We use Firebase for authentication, AWS S3 for photo storage, and encrypted databases for other information. All messages between users are encrypted with keys that only you and the recipient possess — MadLease cannot decrypt or read your private conversations. We do not sell your personal information to third parties.',
        ],
      },
      {
        h2: 'Third-Party Services',
        paragraphs: ['We use the following third-party services:'],
        list: [
          'Google / Firebase for authentication and account management.',
          'Amazon Web Services for secure photo storage.',
        ],
      },
      {
        h2: 'Your Rights',
        paragraphs: ['You have the right to:'],
        list: [
          'Access and update your personal information.',
          'Delete your account and associated data.',
          'Request information about how your data is used.',
        ],
      },
      {
        h2: 'Contact Us',
        paragraphs: [
          'If you have questions about this Privacy Policy, please reach out through our contact page.',
        ],
      },
    ],
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'MadLease Privacy Policy',
        url: `${CANONICAL_DOMAIN}/privacy`,
        description: 'How MadLease collects, uses, and protects your personal information.',
      },
    ],
  },
  '/terms': {
    title: 'Terms of Service — MadLease',
    description: 'The rules and agreements for using MadLease, the UW-Madison sublease marketplace.',
    h1: 'Terms of Service',
    body: [
      'Last updated: January 1, 2026.',
      'By using MadLease, you accept and agree to be bound by the terms and provisions outlined on this page.',
    ],
    sections: [
      {
        h2: 'Acceptance of Terms',
        paragraphs: [
          'By accessing and using MadLease, you accept and agree to be bound by the terms and provisions of this agreement.',
        ],
      },
      {
        h2: 'Service Description',
        paragraphs: [
          'MadLease is a platform that connects people looking to sublet their housing with those seeking temporary accommodation. We facilitate communication but are not a party to any rental agreements.',
        ],
      },
      {
        h2: 'User Responsibilities',
        paragraphs: ['As a user, you agree to:'],
        list: [
          'Provide accurate and truthful information in listings.',
          'Respect other users and maintain appropriate communication.',
          'Comply with all applicable laws and regulations.',
          'Not use the platform for illegal or fraudulent activities.',
          'Ensure you have proper authorization to sublet any property.',
        ],
      },
      {
        h2: 'Prohibited Uses',
        paragraphs: ['You may not use MadLease to:'],
        list: [
          'Post false, misleading, or fraudulent listings.',
          'Harass, threaten, or harm other users.',
          'Upload illegal or inappropriate content.',
          'Attempt to circumvent platform security measures.',
          'Violate any local, state, or federal laws.',
        ],
      },
      {
        h2: 'Limitation of Liability',
        paragraphs: ['MadLease serves as a platform to connect users. We are not responsible for:'],
        list: [
          'The accuracy of listings or user-provided information.',
          'Disputes between users regarding rental agreements.',
          'Property conditions, damages, or safety issues.',
          'Financial transactions between users.',
        ],
      },
      {
        h2: 'Account Termination',
        paragraphs: [
          'We reserve the right to suspend or terminate accounts that violate these terms or engage in prohibited activities.',
        ],
      },
      {
        h2: 'Changes to Terms',
        paragraphs: [
          'We may update these terms periodically. Continued use of the platform constitutes acceptance of any changes.',
        ],
      },
      {
        h2: 'Contact Information',
        paragraphs: [
          'For questions about these Terms of Service, please reach out through our contact page.',
        ],
      },
    ],
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'MadLease Terms of Service',
        url: `${CANONICAL_DOMAIN}/terms`,
        description: 'The rules and agreements for using MadLease.',
      },
    ],
  },
};

// Crawlable internal nav footer — added to every bot-rendered page so crawlers can
// discover every route via <a href> links (bot HTML has no JS-driven navigation).
const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/listings', label: 'Browse Listings' },
  { href: '/about', label: 'About MadLease' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
];

function renderNavFooterHtml() {
  const items = NAV_LINKS
    .map(l => `    <li><a href="${CANONICAL_DOMAIN}${l.href}?_r=1">${escapeHtml(l.label)}</a></li>`)
    .join('\n');
  return `  <nav aria-label="Site">
  <h2>Explore MadLease</h2>
  <ul>
${items}
  </ul>
  </nav>`;
}

function renderSectionsHtml(sections) {
  if (!Array.isArray(sections)) return '';
  return sections.map(s => {
    const paras = (s.paragraphs || []).map(p => `  <p>${escapeHtml(p)}</p>`).join('\n');
    const listHtml = Array.isArray(s.list) && s.list.length
      ? `  <ul>\n${s.list.map(item => `    <li>${escapeHtml(item)}</li>`).join('\n')}\n  </ul>`
      : '';
    return `  <section>\n  <h2>${escapeHtml(s.h2 || '')}</h2>\n${paras}\n${listHtml}\n  </section>`;
  }).join('\n');
}

function renderStaticBotPage(pathname) {
  const route = STATIC_ROUTES[pathname] || STATIC_ROUTES[pathname.replace(/\/$/, '')];
  if (!route) return null;
  const canonicalUrl = `${CANONICAL_DOMAIN}${pathname === '/' ? '/' : pathname}`;
  const imageUrl = `${CANONICAL_DOMAIN}/${LOGO_FILENAME}`;
  const bodyHtml = route.body.map(p => `  <p>${escapeHtml(p)}</p>`).join('\n');
  const sectionsHtml = renderSectionsHtml(route.sections);
  const navHtml = renderNavFooterHtml();
  const jsonLdTags = (route.jsonLd || [])
    .map(obj => `  <script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(route.title)}</title>

  <meta name="description" content="${escapeHtml(route.description)}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="MadLease" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(route.title)}" />
  <meta property="og:description" content="${escapeHtml(route.description)}" />
  <meta property="og:image" content="${imageUrl}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(route.title)}" />
  <meta name="twitter:description" content="${escapeHtml(route.description)}" />
  <meta name="twitter:image" content="${imageUrl}" />

${jsonLdTags}

  <script>window.location.replace("${canonicalUrl}?_r=1");</script>
  <noscript><meta http-equiv="refresh" content="0;url=${canonicalUrl}?_r=1" /></noscript>
</head>
<body>
  <h1>${escapeHtml(route.h1)}</h1>
${bodyHtml}
${sectionsHtml}
  <p><a href="${CANONICAL_DOMAIN}/listings?_r=1">Browse all UW-Madison sublease and parking listings on MadLease</a>.</p>
${navHtml}
</body>
</html>`;
}

function renderListingsIndexHtml(listings) {
  const canonicalUrl = `${CANONICAL_DOMAIN}/listings`;
  const imageUrl = `${CANONICAL_DOMAIN}/${LOGO_FILENAME}`;
  const title = 'Browse UW-Madison Subleases & Parking — MadLease';
  const description = 'Browse verified sublease and parking listings near UW-Madison. Filter by price, bedrooms, dates, and amenities to find your next place or parking spot in Madison.';

  const safeListings = Array.isArray(listings) ? listings.slice(0, 100) : [];

  const itemListJson = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'MadLease UW-Madison Listings',
    itemListElement: safeListings.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${CANONICAL_DOMAIN}/listings/${l.publicId || l.id}`,
      name: l.title || 'Listing',
    })),
  };

  const listItemsHtml = safeListings.map(l => {
    const id = l.publicId || l.id;
    const href = `${CANONICAL_DOMAIN}/listings/${id}?_r=1`;
    const price = l.rent ? `$${l.rent}/mo` : '';
    const beds = l.bedrooms ? `${l.bedrooms} bed` : '';
    const baths = l.bathrooms ? `${l.bathrooms} bath` : '';
    const location = [l.street, l.city, l.state].filter(Boolean).join(', ');
    const meta = [price, beds, baths, location].filter(Boolean).join(' • ');
    return `  <li><a href="${escapeHtml(href)}"><strong>${escapeHtml(l.title || 'Listing')}</strong></a>${meta ? ` — ${escapeHtml(meta)}` : ''}</li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>

  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="MadLease" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${imageUrl}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${imageUrl}" />

  <script type="application/ld+json">${JSON.stringify(itemListJson)}</script>

  <script>window.location.replace("${canonicalUrl}?_r=1");</script>
  <noscript><meta http-equiv="refresh" content="0;url=${canonicalUrl}?_r=1" /></noscript>
</head>
<body>
  <h1>UW-Madison Subleases & Parking on MadLease</h1>
  <p>${escapeHtml(description)}</p>
  <h2>Current Listings</h2>
  <ul>
${listItemsHtml}
  </ul>
  <p>View all listings on <a href="${canonicalUrl}?_r=1">MadLease</a>.</p>
${renderNavFooterHtml()}
</body>
</html>`;
}

// Prevent XSS in generated HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
