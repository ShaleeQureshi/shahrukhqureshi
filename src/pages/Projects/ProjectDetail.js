import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TopBar } from './Projects';
import './Projects.css';

export default function ProjectDetail() {
  const { project } = useParams();
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

  if (error) {
    return (
      <div className="terminal">
        <TopBar active="projects" path={`~/projects/${project}`} />
        <div className="error">error: {error}</div>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="terminal">
        <TopBar active="projects" path={`~/projects/${project}`} />
        <div className="loading">loading<span className="cursor" /></div>
      </div>
    );
  }

  const data = manifest[project];

  if (!data) {
    return (
      <div className="terminal">
        <TopBar active="projects" path={`~/projects/${project}`} />
        <Link to="/projects" className="back">← back to /projects</Link>
        <div className="error">
          no such project: <code>{project}</code>
        </div>
      </div>
    );
  }

  const posts = [...data.posts].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="terminal">
      <TopBar active="projects" path={`~/projects/${project}`} />
      <Link to="/projects" className="back">← back to /projects</Link>

      <div className="prompt-line">
        <span className="p">$</span>
        <span>ls ./{project}</span>
      </div>

      <h1 style={{ color: data.accent, marginTop: 16, fontSize: 22 }}>
        <span style={{ marginRight: 8 }}>▸</span>{data.title || data.name}
      </h1>
      <div style={{ color: 'var(--muted)', marginBottom: 8 }}>{data.subtitle}</div>
      <p style={{ color: 'var(--text)', maxWidth: 720 }}>{data.description}</p>

      <div className="posts" style={{ '--accent': data.accent }}>
        {posts.map((post) => (
          <Link
            key={post.slug}
            to={`/projects/${project}/${post.slug}`}
            className="post-entry"
            style={{ '--accent': data.accent }}
          >
            <div>
              <span className="date">{post.date}</span>
              <span className="filename">{post.slug}.md</span>
            </div>
            <div className="summary">{post.summary}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
