import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TopBar } from './Projects';
import './Projects.css';

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  const data = {};
  match[1].split('\n').forEach((line) => {
    const [key, ...rest] = line.split(':');
    if (key) data[key.trim()] = rest.join(':').trim();
  });
  return { data, content: match[2] };
}

export default function Post() {
  const { project, slug } = useParams();
  const [manifest, setManifest] = useState(null);
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRaw(null);

    Promise.all([
      fetch('/posts/manifest.json').then((r) => {
        if (!r.ok) throw new Error(`manifest fetch failed: ${r.status}`);
        return r.json();
      }),
      fetch(`/posts/${project}/${slug}.md`).then((r) => {
        if (!r.ok) throw new Error(`post fetch failed: ${r.status}`);
        return r.text();
      }),
    ])
      .then(([m, body]) => {
        if (cancelled) return;
        setManifest(m);
        setRaw(body);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [project, slug]);

  if (error) {
    return (
      <div className="terminal">
        <TopBar active="projects" path={`~/projects/${project}/${slug}.md`} />
        <Link to={`/projects/${project}`} className="back">← back to /projects/{project}</Link>
        <div className="error">error: {error}</div>
      </div>
    );
  }

  if (!manifest || raw === null) {
    return (
      <div className="terminal">
        <TopBar active="projects" path={`~/projects/${project}/${slug}.md`} />
        <div className="loading">loading<span className="cursor" /></div>
      </div>
    );
  }

  const projectData = manifest[project];
  const postMeta = projectData?.posts.find((p) => p.slug === slug);

  if (!projectData || !postMeta) {
    return (
      <div className="terminal">
        <TopBar active="projects" path={`~/projects/${project}/${slug}.md`} />
        <Link to="/projects" className="back">← back to /projects</Link>
        <div className="error">
          unknown post: <code>{project}/{slug}</code>
        </div>
      </div>
    );
  }

  const { data, content } = parseFrontmatter(raw);
  const title = data.title || postMeta.title;
  const date = data.date || postMeta.date;
  const accent = projectData.accent;

  return (
    <div className="terminal" style={{ '--accent': accent }}>
      <TopBar active="projects" path={`~/projects/${project}/${slug}.md`} />
      <Link to={`/projects/${project}`} className="back">← back to /projects/{project}</Link>

      <header className="post-header">
        <div className="meta-line">
          <span>{date}</span>
          <span style={{ margin: '0 8px' }}>·</span>
          <span className="filename" style={{ color: accent }}>
            ~/{project}/{slug}.md
          </span>
        </div>
        <h1>{title}</h1>
      </header>

      <article className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>
    </div>
  );
}
