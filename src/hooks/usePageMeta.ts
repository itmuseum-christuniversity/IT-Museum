import { useEffect } from 'react';

const SUFFIX = 'IT Museum — India';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
    let el = document.head.querySelector<HTMLMetaElement>(selector);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.content = content;
}

/** Sets the document title and description for the current page. */
export function usePageMeta(title: string, description?: string) {
    useEffect(() => {
        const full = title ? `${title} · ${SUFFIX}` : `${SUFFIX} · CHRIST University & DataArt`;
        document.title = full;
        setMeta('meta[property="og:title"]', 'property', 'og:title', full);
        if (description) {
            setMeta('meta[name="description"]', 'name', 'description', description);
            setMeta('meta[property="og:description"]', 'property', 'og:description', description);
        }
    }, [title, description]);
}
