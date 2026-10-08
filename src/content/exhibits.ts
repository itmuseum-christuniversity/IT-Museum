/** Curated, hand-authored exhibits that live in the codebase (not the review workflow). */
export interface Exhibit {
    id: string;
    number: string;
    title: string;
    subtitle: string;
    summary: string;
    tags: string[];
    sections: { heading: string; body?: string; items?: { title: string; body: string }[] }[];
    furtherReading: { label: string; href: string }[];
}

export const EXHIBITS: Exhibit[] = [
    {
        id: 'kolam',
        number: 'Exhibit 001',
        title: 'The Art of Kolam: Symmetry & Computation',
        subtitle: 'An in-depth analysis of South Indian threshold designs.',
        summary: 'Exploring the recursive geometry and array grammars hidden within traditional threshold patterns.',
        tags: ['Ethnomathematics', 'Heritage & computation'],
        sections: [
            {
                heading: 'Introduction to Kolam',
                body: 'Kolam is an ancient Indian folk art extensively used to beautifully adorn the thresholds and open courtyards in front of houses. The word "Kolam" in the Tamil language means form and beauty.',
            },
            {
                heading: 'Mathematical frameworks',
                items: [
                    { title: 'Angular encoding model', body: 'Maps angular movements in Kolam drawing to symbol sequences representing directions.' },
                    { title: 'Array grammar', body: 'Uses array grammars and contextual Array P Systems to generate and analyze patterns.' },
                ],
            },
        ],
        furtherReading: [
            { label: 'Kolam Simulation (arXiv:2307.02144)', href: 'https://arxiv.org/abs/2307.02144' },
            { label: 'IIT Madras Research Archive', href: 'https://www.iitm.ac.in/' },
        ],
    },
];

export const findExhibit = (id: string) => EXHIBITS.find((e) => e.id === id) ?? null;
