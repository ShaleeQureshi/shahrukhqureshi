import { Link } from 'react-router-dom';
import Story from './Story';

export default function Home() {
  return (
    <>
      <h1>Shahrukh Qureshi</h1>
      <p style={{ color: '#6b7280', marginTop: 4 }}>
        Engineer, builder, perpetual tinkerer.
      </p>
      <p>
        I build software for a living and weird projects for fun. Right now I'm
        focused on <Link to="/projects/jarvis">Jarvis</Link>, my own AI assistant.
        It runs on a small computer at home, talks to me through my sunglasses, and
        does programming work while I sleep.
      </p>

      <Story />

      <p>
        The rule is simple: local models do everything they can. Qwen, running on
        the box, answers quick questions, keeps anything private at home, and plans,
        writes and tests code for my projects. Only the problems it cannot crack are
        escalated to Claude, and Qwen checks that work too.
      </p>
      <p>
        Want more? <Link to="/showcase">The full walkthrough</Link> lets you try the
        privacy check yourself. The build diary is under <Link to="/projects">work</Link>,
        and there's a bit <Link to="/about">about me</Link>.
      </p>
    </>
  );
}
