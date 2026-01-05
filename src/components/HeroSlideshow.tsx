import { useState, useEffect } from 'react';
import hero1 from '../assets/hero-images/hero1.jpg';
import hero2 from '../assets/hero-images/hero2.jpg';
import hero3 from '../assets/hero-images/hero3.jpg';
import hero4 from '../assets/hero-images/hero4.jpg';

const images = [hero1, hero2, hero3, hero4];

export default function HeroSlideshow() {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
        }, 5000); // Change image every 5 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="hero-slideshow-container">
            {images.map((image, index) => (
                <div
                    key={index}
                    className={`hero-slide ${index === currentImageIndex ? 'active' : ''}`}
                    style={{
                        backgroundImage: `url(${image})`
                    }}
                />
            ))}
            {/* Overlay */}
            <div className="hero-overlay-gradient"></div>
        </div>
    );
}
