import { Link } from 'react-router-dom';
import { CONTACT, LINKS } from '../../content/site';

export default function SiteFooter() {
    return (
        <footer className="site-footer">
            <div className="container site-footer__grid">
                <div>
                    <p className="site-footer__title">IT Museum — India</p>
                    <p className="site-footer__text">
                        A collaboration between CHRIST (Deemed to be University), Bangalore Yeshwanthpur Campus, and the DataArt IT Museum, documenting India’s contributions to
                        the history of computing.
                    </p>
                    <a href={LINKS.retrospect} target="_blank" rel="noopener noreferrer">
                        Explore the history of data and computing at DataArt Retrospect<span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                </div>
                <nav aria-label="Footer">
                    <p className="site-footer__title">Explore</p>
                    <ul className="site-footer__links">
                        <li>
                            <Link to="/collection">Digital archive</Link>
                        </li>
                        <li>
                            <Link to="/team">Curators & team</Link>
                        </li>
                        <li>
                            <Link to="/submission">Contribute research</Link>
                        </li>
                        <li>
                            <Link to="/submission/status">Check a submission</Link>
                        </li>
                        <li>
                            <Link to="/admin">Staff sign-in</Link>
                        </li>
                    </ul>
                </nav>
                <div>
                    <p className="site-footer__title">Visit & contact</p>
                    <address className="site-footer__text">
                        {CONTACT.campus}
                        <br />
                        {CONTACT.addressLines.map((l) => (
                            <span key={l}>
                                {l}
                                <br />
                            </span>
                        ))}
                        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
                        <br />
                        <a href={CONTACT.phoneHref}>{CONTACT.phoneDisplay}</a>
                    </address>
                </div>
            </div>
            <div className="container site-footer__bottom">
                <p>© {new Date().getFullYear()} IT Museum, CHRIST (Deemed to be University). All rights reserved.</p>
                <p>
                    In partnership with{' '}
                    <a href={LINKS.dataArtMuseum} target="_blank" rel="noopener noreferrer">
                        DataArt IT Museum<span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                    .
                </p>
            </div>
        </footer>
    );
}
