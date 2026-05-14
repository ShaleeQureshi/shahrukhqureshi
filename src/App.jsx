import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Home from './pages/Home/Home';
import About from './pages/About/About';
import Contact from './pages/Contact/Contact';
import Projects from './pages/Projects/Projects';
import ProjectDetail from './pages/Projects/ProjectDetail';
import Post from './pages/Projects/Post';
import Server from './pages/Projects/Server';

// Resets scroll position to the top on every route change, so opening a new
// page or blog post starts at the top instead of inheriting the prior scroll.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div style={{ padding: 48, fontFamily: 'system-ui, sans-serif' }}>
      <h1>404</h1>
      <p>Nothing here. <Link to="/">Go home</Link>.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Route>
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:project" element={<ProjectDetail />} />
        <Route path="/projects/:project/:slug" element={<Post />} />
        <Route path="/server" element={<Server />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
