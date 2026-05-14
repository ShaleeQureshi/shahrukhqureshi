import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Home from './pages/Home/Home';
import About from './pages/About/About';
import Contact from './pages/Contact/Contact';
import Projects from './pages/Projects/Projects';
import ProjectDetail from './pages/Projects/ProjectDetail';
import Post from './pages/Projects/Post';
import Server from './pages/Projects/Server';

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
