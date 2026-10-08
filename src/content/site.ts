/** Institutional content in one place, so copy changes do not touch components. */

export const SITE_NAME = 'IT Museum — India';
export const SITE_TAGLINE = 'Documenting India’s contributions to the history of computing';

export const CONTACT = {
    // Verified against christuniversity.in/bangalore-yeshwanthpur-campus (Oct 2026).
    campus: 'CHRIST (Deemed to be University), Bangalore Yeshwanthpur Campus',
    addressLines: ['Nagasandra, Near Tumkur Road', 'Bangalore 560 073, Karnataka, India'],
    phoneDisplay: '+91 80 6989 6666',
    phoneHref: 'tel:+918069896666',
    // Museum mailbox from the previous site — confirm it is monitored.
    email: 'itmuseum@christuniversity.in',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=CHRIST+University+Bangalore+Yeshwanthpur+Campus+Nagasandra',
    mapEmbedUrl: 'https://maps.google.com/maps?q=CHRIST+University+Yeshwanthpur+Campus+Nagasandra+Bangalore&z=15&output=embed',
    directions:
        'The campus is near Tumkur Road in Nagasandra, about 2 km from Nagasandra Metro Station and 8.5 km from Yeshwanthpur Railway Station.',
};

export const LINKS = {
    dataArtMuseum: 'https://museum.dataart.com/',
    christByc: 'https://christuniversity.in/bangalore-yeshwanthpur-campus',
    retrospect: 'https://retrospect.dataart.com',
};

export const DATAART_CHAPTERS = [
    { n: 'I', title: 'From Military to Civil Computing', href: 'https://museum.dataart.com/history/chapter-1-from-military-to-civil-computing' },
    { n: 'II', title: 'Computers for Business and Industry', href: 'https://museum.dataart.com/history/chapter-2-computers-for-business-and-industry' },
    { n: 'III', title: 'Computer Globalization', href: 'https://museum.dataart.com/history/chapter-3-computer-globalization' },
    { n: 'IV', title: 'Early Networks and Proto-Internet', href: 'https://museum.dataart.com/history/chapter-4-early-networks-and-proto-internet' },
    { n: 'V', title: 'Mass Computerization', href: 'https://museum.dataart.com/history/chapter-5-mass-computerization' },
    { n: 'VI', title: 'Computer Footprint on Culture', href: 'https://museum.dataart.com/history/chapter-6-computer-footprint-on-culture' },
];

export const NAV = [
    { to: '/', label: 'Home', end: true },
    { to: '/collection', label: 'Archive' },
    { to: '/team', label: 'Team' },
    { to: '/contact', label: 'Visit & contact' },
];

/** Guideline copy from the previous submission page. The 5% AI figure is shown
 * as stated guidance pending institutional confirmation; it is not enforced. */
export const AI_POLICY_TEXT = 'AI-generated content must not exceed 5% of the total manuscript.';
export const TEMPLATE_PDF_URL = '/IT%20Research%20Paper%20Template%20.pdf';
