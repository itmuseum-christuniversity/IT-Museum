
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Collection from './pages/Collection';
import Team from './pages/Team';
import Contact from './pages/Contact';
import Article from './pages/Article';
import Submission from './pages/Submission';
import Admin from './pages/Admin';

function App() {
    return (
        <Router>
            <Layout>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/collection" element={<Collection />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/article/:id" element={<Article />} />
                    <Route path="/submission" element={<Submission />} />
                    <Route path="/admin" element={<Admin />} />
                </Routes>
            </Layout>
        </Router>
    );
}

export default App;
