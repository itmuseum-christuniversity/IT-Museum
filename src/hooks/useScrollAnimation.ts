import { useEffect } from 'react';

export function useScrollAnimation() {
    useEffect(() => {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    (entry.target as HTMLElement).style.opacity = '1';
                    (entry.target as HTMLElement).style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        const elements = document.querySelectorAll('.fade-in, .profile-card, .gallery-item, .card-premium');

        elements.forEach(el => {
            // Apply initial state if not already applied
            if (!(el as HTMLElement).style.opacity) {
                (el as HTMLElement).style.opacity = '0';
                (el as HTMLElement).style.transform = 'translateY(30px)';
                (el as HTMLElement).style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            }
            observer.observe(el);
        });

        return () => observer.disconnect();
    }); // Run on every render to catch new elements (or use specific ref approach commonly in React, but this mimics script.js broader selector behavior)
}
