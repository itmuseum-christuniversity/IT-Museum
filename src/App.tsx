import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import PublicLayout from './components/layout/PublicLayout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

// Route-level code splitting: the admin portal (Firebase Auth, pdf.js) and
// the form-heavy pages are only downloaded when visited.
const Collection = lazy(() => import('./pages/Collection'));
const Article = lazy(() => import('./pages/Article'));
const Team = lazy(() => import('./pages/Team'));
const Contact = lazy(() => import('./pages/Contact'));
const Submission = lazy(() => import('./pages/Submission'));
const SubmissionStatus = lazy(() => import('./pages/SubmissionStatus'));
const AdminApp = lazy(() => import('./admin/AdminApp'));

function PageFallback() {
    return (
        <div className="page-fallback" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" /> Loading…
        </div>
    );
}

export function AppRoutes() {
    const { pathname } = useLocation();
    return (
        <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageFallback />}>
                <Routes>
                    <Route path="/admin/*" element={<AdminApp />} />
                    <Route element={<PublicLayout />}>
                        <Route index element={<Home />} />
                        <Route path="collection" element={<Collection />} />
                        <Route path="article/:id" element={<Article />} />
                        <Route path="team" element={<Team />} />
                        <Route path="contact" element={<Contact />} />
                        <Route path="submission" element={<Submission />} />
                        <Route path="submission/status" element={<SubmissionStatus />} />
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </Suspense>
        </ErrorBoundary>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    );
}
