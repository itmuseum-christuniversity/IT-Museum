import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

export default function Layout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const isHome = location.pathname === '/';

    return (
        <>
            <Header />
            <main className={!isHome ? 'blue-theme fade-in' : 'fade-in'}>
                {children}
            </main>
            <Footer />
        </>
    );
}
