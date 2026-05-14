import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Projects.css';

const ASCII = String.raw`
  ____   ____   ___    _ _____ ____ _____ ____
 |  _ \ |  _ \ / _ \  | | ____/ ___|_   _/ ___|
 | |_) || |_) | | | |_| |  _|| |     | | \___ \
 |  __/ |  _ <| |_| |_  _|___| |___  | |  ___) |
 |_|    |_| \_\\___/  |_|_____\____| |_| |____/
`;

export function TopBar({ active, path = '~/projects' }) {
  return (
    <div className="topbar">
      <span className="prompt">shahrukh@home</span>
      <span>:</span>
      <span>{path}</span>
      <span className="prompt">$</span>
      <nav className="nav">
        <Link to="/" className={active === 'home' ? 'active' : ''}>home</Link>
        <Link to="/about" className={active === 'about' ? 'active' : ''}>about</Link>
        <Link to="/projects" className={active === 'projects' ? 'active' : ''}>work</Link>
        <Link to="/contact" className={active === 'contact' ? 'active' : ''}>contact</Link>
      </nav>
    </div>
  );
}

export default function Projects() {
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/posts/manifest.json')
      .then((r) => {
        if (!r.ok) throw new Error(`manifest fetch failed: ${r.status}`);
        return r.json();
      })
      .then(setManifest)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="terminal">
      <TopBar active="projects" />
      <pre className="ascii">{ASCII}</pre>

      <div className="prompt-line">
        <span className="p">$</span>
        <span>cat ./projects</span>
      </div>

      {error && (
        <div className="error">error: {error}</div>
      )}

      {!manifest && !error && (
        <div className="loading">loading<span className="cursor" /></div>
      )}

      {manifest && (
        <div className="cards">
          {Object.entries(manifest).map(([key, project]) => (
            <Link key={key} to={`/projects/${key}`} className="card">
              <div className="name" style={{ color: project.accent }}>
                <span className="arrow">▸</span>
                {project.title || project.name}
              </div>
              <div className="subtitle">{project.subtitle}</div>
              <div className="desc">{project.description}</div>
              <div className="meta">
                {project.tags.map((tag) => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
                <span className="count">
                  {project.posts.length} post{project.posts.length === 1 ? '' : 's'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
