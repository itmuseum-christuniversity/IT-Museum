import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Landmark, Users } from 'lucide-react';
import heroImage from '../assets/hero-images/hero4.jpg';
import computingRoomImage from '../assets/hero-images/hero1.jpg';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAsync } from '../hooks/useAsync';
import { fetchPublishedArticles, type ArchiveItem } from '../services/archive';
import { isSupabaseConfigured } from '../lib/config';
import { ArchiveCard } from '../components/archive/ArchiveCard';
import { CardSkeletons } from '../components/ui/Skeleton';
import { Alert } from '../components/ui/Alert';
import { HomeSections } from '../components/home/HomeSections';
import { DATAART_CHAPTERS, LINKS } from '../content/site';
import { EXHIBITS } from '../content/exhibits';

const kolam = EXHIBITS[0];
const kolamCard: ArchiveItem = {
    id: kolam.id,
    kind: 'exhibit',
    title: kolam.title,
    summary: kolam.summary,
    authors: [],
    tags: kolam.tags,
    date: null,
    dateLabel: 'Dated',
    reference: kolam.number,
};

export default function Home() {
    usePageMeta('', 'The IT Museum — India documents and shares India’s contributions to the history of computing, in partnership between CHRIST University and the DataArt IT Museum.');
    const featured = useAsync(() => (isSupabaseConfigured ? fetchPublishedArticles(3) : Promise.resolve([])), []);

    return (
        <>
            <section className="hero" aria-labelledby="hero-title">
                <div className="container hero__grid">
                    <div className="hero__copy">
                        <span className="eyebrow">CHRIST University × DataArt IT Museum</span>
                        <h1 id="hero-title">India’s computing story, researched and preserved.</h1>
                        <p className="hero__lede">
                            The IT Museum — India documents the people, machines and ideas that shaped computing in India — from the first indigenous computers to a global digital
                            powerhouse — through peer-reviewed research and curated exhibits.
                        </p>
                        <div className="cluster">
                            <Link className="btn btn--gold btn--lg" to="/collection">
                                Explore the archive <ArrowRight size={18} aria-hidden="true" />
                            </Link>
                            <Link className="btn btn--on-dark btn--lg" to="/submission">
                                Contribute research
                            </Link>
                        </div>
                    </div>
                    <figure className="hero__figure">
                        <img
                            src={heroImage}
                            alt="Illustration of a museum gallery titled “The Evolution of Computing”, with display cases for vacuum tubes, transistors, integrated circuits, microprocessors and personal computers."
                            width={1024}
                            height={1024}
                            fetchPriority="high"
                        />
                        <figcaption>Illustration · The evolution of computing, from vacuum tubes to personal computers</figcaption>
                    </figure>
                </div>
            </section>

            <section className="section" aria-labelledby="mission-title">
                <div className="container mission">
                    <div>
                        <span className="eyebrow">Our mission</span>
                        <h2 id="mission-title">A public record of India’s contributions to computing</h2>
                        <hr className="rule-gold" />
                    </div>
                    <div className="mission__points">
                        <div>
                            <Landmark aria-hidden="true" />
                            <h3>Preserve</h3>
                            <p>Collect and archive research, case studies and historical narratives about computing in India, with integrity in preservation and inclusivity in access.</p>
                        </div>
                        <div>
                            <BookOpenCheck aria-hidden="true" />
                            <h3>Verify</h3>
                            <p>Every article passes IT, technical and literature review before the editorial admin approves it for the public archive.</p>
                        </div>
                        <div>
                            <Users aria-hidden="true" />
                            <h3>Share</h3>
                            <p>Open the collection to students, researchers and the public, and connect it to the DataArt IT Museum’s global history of computing.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="section section--sunken" aria-labelledby="featured-title">
                <div className="container">
                    <div className="section-head">
                        <div>
                            <span className="eyebrow">From the archive</span>
                            <h2 id="featured-title">Featured research & exhibits</h2>
                        </div>
                        <Link className="arrow-link" to="/collection">
                            Browse the full archive <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                    </div>
                    {featured.status === 'loading' && <CardSkeletons count={3} label="Loading featured research" />}
                    {featured.status === 'error' && (
                        <Alert tone="warning" title="Recent research could not be loaded." className="mb-5">
                            <p>
                                The exhibit below is still available.{' '}
                                <button type="button" className="link-button" onClick={featured.retry}>
                                    Try again
                                </button>
                            </p>
                        </Alert>
                    )}
                    {featured.status !== 'loading' && (
                        <div className="grid">
                            <ArchiveCard item={kolamCard} />
                            {featured.status === 'ready' && featured.data.map((item) => <ArchiveCard key={item.id} item={item} />)}
                        </div>
                    )}
                </div>
            </section>

            <section className="section" aria-labelledby="dawn-title">
                <div className="container spotlight">
                    <figure className="spotlight__figure">
                        <img
                            src={computingRoomImage}
                            alt="Illustration of a computing-history gallery with mainframe consoles, control panels and reel-to-reel tape drives."
                            width={1024}
                            height={1024}
                            loading="lazy"
                        />
                        <figcaption>Illustration · Mainframe-era computer hall</figcaption>
                    </figure>
                    <div>
                        <span className="eyebrow">A short history</span>
                        <h2 id="dawn-title">The dawn of Indian computing</h2>
                        <p className="prose">
                            In 1955, the <strong>HEC-2M</strong> arrived at the Indian Statistical Institute, marking India’s entry into the digital age. This was soon followed by
                            the <strong>TIFRAC</strong> in Mumbai — the first computer designed and built indigenously in India. These machines, housed in massive cooling halls,
                            were the architectural blueprints for India’s future as a global technology powerhouse.
                        </p>
                        <Link className="arrow-link" to="/collection">
                            Read the research in the archive <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </section>

            <section className="section section--ink" aria-labelledby="partnership-title">
                <div className="container partnership">
                    <div>
                        <span className="eyebrow">The partnership</span>
                        <h2 id="partnership-title">CHRIST University and the DataArt IT Museum</h2>
                    </div>
                    <div className="prose partnership__copy">
                        <p>
                            <a href={LINKS.dataArtMuseum} target="_blank" rel="noopener noreferrer">
                                DataArt
                            </a>
                            , a multinational IT firm, has established a collaborative partnership with the Department of Computer Science at{' '}
                            <a href={LINKS.christByc} target="_blank" rel="noopener noreferrer">
                                CHRIST University
                            </a>
                            , Bangalore Yeshwanthpur Campus. Through its IT Museum project, DataArt documents the IT innovation contributions of countries across Eastern and Central
                            Europe, Latin America and Asia.
                        </p>
                        <p>
                            As part of this Memorandum of Understanding, the DataArt IT Museum team collaborates with the University to document and showcase India’s contributions to
                            IT innovation — curating case studies, research articles and historical narratives, including the intersection of Indian traditions and IT advancements.
                            The Departments of Computer Science and Media Studies and the Centre for Digital Learning (CDL) at the Bangalore Yeshwanthpur Campus are actively engaged in
                            this initiative.
                        </p>
                    </div>
                </div>
                <div className="container">
                    <h3 className="chapters__title">The global timeline at the DataArt IT Museum</h3>
                    <ol className="chapters">
                        {DATAART_CHAPTERS.map((c) => (
                            <li key={c.n}>
                                <a href={c.href} target="_blank" rel="noopener noreferrer">
                                    <span className="chapters__n">Chapter {c.n}</span>
                                    <span className="chapters__name">{c.title}</span>
                                    <span className="visually-hidden"> (opens in a new tab)</span>
                                </a>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section className="section" aria-labelledby="exhibit-title">
                <div className="container exhibit-callout">
                    <div>
                        <span className="eyebrow">Heritage & computation exhibit</span>
                        <h2 id="exhibit-title">Kolam: where tradition meets computation</h2>
                        <p className="prose">
                            Alongside the history of machines, the museum presents heritage exhibits that reveal computational ideas in Indian traditions. The first examines the
                            recursive geometry and array grammars hidden in South Indian threshold patterns.
                        </p>
                        <Link className="btn" to="/article/kolam">
                            Visit the Kolam exhibit
                        </Link>
                    </div>
                    <blockquote className="pull-quote">
                        <p>“History is not a record of the past, but the blueprints for the future.”</p>
                        <footer>— The CHRIST University IT Museum Board</footer>
                    </blockquote>
                </div>
            </section>

            <HomeSections />

            <section className="section section--sunken" aria-labelledby="contribute-title">
                <div className="container contribute-band">
                    <div>
                        <h2 id="contribute-title">Help document India’s IT history</h2>
                        <p className="lede">
                            Faculty, researchers and students can submit original research for review. Prepare your manuscript in Google Docs using the museum template, then follow
                            the guided submission.
                        </p>
                    </div>
                    <div className="cluster">
                        <Link className="btn btn--primary btn--lg" to="/submission">
                            Start a submission
                        </Link>
                        <Link className="btn btn--lg" to="/submission/status">
                            Check a submission
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}
