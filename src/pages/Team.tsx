import { usePageMeta } from '../hooks/usePageMeta';
import { PageIntro } from '../components/ui/PageIntro';
import { initials, TEAM, type TeamMember } from '../content/team';

function Portrait({ member }: { member: TeamMember }) {
    if (member.photo) {
        return <img className="person__photo" src={member.photo} alt={`Portrait of ${member.name}`} loading="lazy" width={240} height={300} />;
    }
    return (
        <div className="person__photo person__photo--monogram" role="img" aria-label={`${member.name} (no portrait)`}>
            <span aria-hidden="true">{initials(member.name)}</span>
        </div>
    );
}

export default function Team() {
    usePageMeta('Curators & team', 'The mentors, curators, editors, partners and student developers behind the IT Museum — India.');
    return (
        <>
            <PageIntro eyebrow="People" title="Curators & team">
                <p>The faculty, partners and students who research, review and build the IT Museum — India.</p>
            </PageIntro>
            <div className="section section--tight">
                <div className="container stack" style={{ ['--stack-gap' as string]: 'var(--space-8)' }}>
                    {TEAM.map((group) => (
                        <section key={group.id} aria-labelledby={`team-${group.id}`}>
                            <h2 id={`team-${group.id}`} className="team-group__title">
                                {group.title}
                            </h2>
                            <ul className="people">
                                {group.members.map((m) => (
                                    <li key={m.name} className="person">
                                        <Portrait member={m} />
                                        <div className="person__text">
                                            <h3 className="person__name">{m.name}</h3>
                                            <p className="person__role">{m.role}</p>
                                            {m.affiliation && <p className="subtle" style={{ margin: 0 }}>{m.affiliation}</p>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </>
    );
}
