import bijuKc from '../assets/team/biju-kc.jpg';
import vinayM from '../assets/team/vinay-m.jpg';
import nirmalaMn from '../assets/team/nirmala-mn.jpg';
import balakrishnanC from '../assets/team/balakrishnan-c.jpg';
import gayathrySw from '../assets/team/gayathry-sw.jpg';
import rajasekharD from '../assets/team/rajasekhar-d.jpg';
import alexeyP from '../assets/team/alexey-p.jpg';
import krishnaP from '../assets/team/krishna-p.jpg';
import jehosonJj from '../assets/team/jehoson-jj.jpg';
import vishnuS from '../assets/team/profile-pic.jpg';

export interface TeamMember {
    name: string;
    role: string;
    affiliation?: string;
    photo?: string;
}

export interface TeamGroup {
    id: string;
    title: string;
    members: TeamMember[];
}

// Credits as published on the previous site. Members without a photo are
// shown with a monogram (portraits were intentionally removed in Feb 2026).
export const TEAM: TeamGroup[] = [
    {
        id: 'mentors',
        title: 'Mentors',
        members: [
            { name: 'Dr. Fr. Biju K C', role: 'Chief Curator', photo: bijuKc },
            { name: 'Dr. Vinay M', role: 'Co-Chief Curator', photo: vinayM },
            { name: 'Dr. Nirmala M N', role: 'Co-Chief Curator', photo: nirmalaMn },
        ],
    },
    {
        id: 'coordination',
        title: 'Core coordination team',
        members: [
            { name: 'Dr. Balakrishnan C', role: 'Coordinator & Curator', affiliation: 'Computer Science, BYC', photo: balakrishnanC },
            { name: 'Dr. Gayathry S Warrier', role: 'Curator — Technical', affiliation: 'Computer Science, BYC', photo: gayathrySw },
            { name: 'Dr. Rajasekhar D', role: 'Curator — Cultural', affiliation: 'Media Studies, BYC', photo: rajasekharD },
            { name: 'Mr. Jack Joy', role: 'Curator — Logistics', affiliation: 'CDL, BYC' },
        ],
    },
    {
        id: 'partner',
        title: 'Collaborating partner',
        members: [{ name: 'Dr. Alexey Pomigalov', role: 'DataArt IT Museum Curator', affiliation: 'DataArt', photo: alexeyP }],
    },
    {
        id: 'editorial',
        title: 'Editorial team',
        members: [
            { name: 'Dr. Krishna Presannakumar', role: 'Editor — Technical', affiliation: 'Computer Science, BYC', photo: krishnaP },
            { name: 'Dr. Jehoson Jiresh J', role: 'Editor — Linguistic', affiliation: 'English & Cultural Studies, BYC', photo: jehosonJj },
        ],
    },
    {
        id: 'developers',
        title: 'Student developers',
        members: [
            { name: 'Shruthi S Patel', role: 'Front End Developer', affiliation: 'BCA' },
            { name: 'Vishnu S', role: 'Back End Developer', affiliation: 'BCA', photo: vishnuS },
            { name: 'Shashwat', role: 'Full Stack Developer', affiliation: 'BCA' },
        ],
    },
];

export function initials(name: string): string {
    const parts = name
        .replace(/^(Dr\.|Fr\.|Mr\.|Ms\.|Mrs\.)\s*/g, '')
        .replace(/^(Dr\.|Fr\.)\s*/g, '')
        .split(/\s+/)
        .filter((p) => /^[A-Za-z]/.test(p));
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
