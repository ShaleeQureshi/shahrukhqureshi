import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Projects.css';

export const PROJECTS_ASCII = String.raw`
  ____   ____   ___    _ _____ ____ _____ ____
 |  _ \ |  _ \ / _ \  | | ____/ ___|_   _/ ___|
 | |_) || |_) | | | |_| |  _|| |     | | \___ \
 |  __/ |  _ <| |_| |_  _|___| |___  | |  ___) |
 |_|    |_| \_\\___/  |_|_____\____| |_| |____/
`;

export const SERVER_ASCII = String.raw`
  ____  _____ ______     _______ ____
 / ___|| ____|  _ \ \   / / ____|  _ \
 \___ \|  _| | |_) \ \ / /|  _| | |_) |
  ___) | |___|  _ < \ V / | |___|  _ <
 |____/|_____|_| \_\ \_/  |_____|_| \_\
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
        <Link to="/server" className={active === 'server' ? 'active' : ''}>server</Link>
        <Link to="/contact" className={active === 'contact' ? 'active' : ''}>contact</Link>
      </nav>
    </div>
  );
}

export default function Projects({
  category,
  cmd = 'cat ./projects',
  active = 'projects',
  ascii = PROJECTS_ASCII,
  path = '~/projects',
}) {
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

  const entries = manifest
    ? Object.entries(manifest).filter(
        ([, project]) => !category || project.category === category
      )
    : [];

  return (
    <div className="terminal">
      <TopBar active={active} path={path} />
      <pre className="ascii">{ascii}</pre>

      <div className="prompt-line">
        <span className="p">$</span>
        <span>{cmd}</span>
      </div>

      {error && (
        <div className="error">error: {error}</div>
      )}

      {!manifest && !error && (
        <div className="loading">loading<span className="cursor" /></div>
      )}

      {manifest && entries.length === 0 && (
        <div className="loading">no projects found</div>
      )}

      {manifest && entries.length > 0 && (
        <div className="cards">
          {entries.map(([key, project]) => (
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
