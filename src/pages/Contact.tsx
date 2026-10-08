import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { PageIntro } from '../components/ui/PageIntro';
import { CONTACT } from '../content/site';

export default function Contact() {
    usePageMeta('Visit & contact', 'Visit the IT Museum at CHRIST University, Bangalore Yeshwanthpur Campus, or contact the museum by email or phone.');
    // The map is a third-party embed: load it only on request, with a text fallback.
    const [showMap, setShowMap] = useState(false);

    return (
        <>
            <PageIntro eyebrow="Visit" title="Visit & contact">
                <p>The IT Museum is based at the Bangalore Yeshwanthpur Campus of CHRIST (Deemed to be University).</p>
            </PageIntro>
            <section className="section section--tight">
                <div className="container contact">
                    <div className="stack">
                        <div className="contact__item">
                            <MapPin aria-hidden="true" />
                            <div>
                                <h2>Address</h2>
                                <address>
                                    {CONTACT.campus}
                                    <br />
                                    {CONTACT.addressLines.map((l) => (
                                        <span key={l}>
                                            {l}
                                            <br />
                                        </span>
                                    ))}
                                </address>
                                <p className="muted">{CONTACT.directions}</p>
                                <a href={CONTACT.mapsUrl} target="_blank" rel="noopener noreferrer" className="arrow-link">
                                    Get directions in Google Maps <ExternalLink size={14} aria-hidden="true" />
                                    <span className="visually-hidden"> (opens in a new tab)</span>
                                </a>
                            </div>
                        </div>
                        <div className="contact__item">
                            <Mail aria-hidden="true" />
                            <div>
                                <h2>Email</h2>
                                <p>
                                    <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
                                </p>
                                <p className="muted">For questions about research submissions, use the reference from your confirmation email.</p>
                            </div>
                        </div>
                        <div className="contact__item">
                            <Phone aria-hidden="true" />
                            <div>
                                <h2>Phone</h2>
                                <p>
                                    <a href={CONTACT.phoneHref}>{CONTACT.phoneDisplay}</a> <span className="subtle">(campus switchboard)</span>
                                </p>
                            </div>
                        </div>
                        <div className="card card--sunken">
                            <h2 className="h4">Submitting research?</h2>
                            <p>
                                Use the <Link to="/submission">guided submission</Link>. Already submitted? <Link to="/submission/status">Check your submission’s status</Link>.
                            </p>
                        </div>
                    </div>

                    <div className="contact__map">
                        {showMap ? (
                            <iframe
                                src={CONTACT.mapEmbedUrl}
                                title="Map of CHRIST University, Bangalore Yeshwanthpur Campus"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                allowFullScreen
                            />
                        ) : (
                            <div className="contact__map-placeholder">
                                <MapPin size={32} aria-hidden="true" />
                                <p>The interactive map is provided by Google Maps and loads only if you choose to view it.</p>
                                <button type="button" className="btn" onClick={() => setShowMap(true)}>
                                    Show map
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}
