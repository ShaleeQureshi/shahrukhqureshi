import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <>
      <h1>Shahrukh Qureshi</h1>
      <p style={{ color: '#6b7280', marginTop: 4 }}>
        Engineer, builder, perpetual tinkerer.
      </p>
      <p>
        I build software for a living and weird projects for fun. Right now I'm
        focused on <Link to="/projects/jarvis">Jarvis</Link>, a self-hosted AI server
        running on consumer hardware.
      </p>
      <p>
        See <Link to="/projects">recent work</Link> or read
        a bit <Link to="/about">about me</Link>.
      </p>
    </>
  );
}
