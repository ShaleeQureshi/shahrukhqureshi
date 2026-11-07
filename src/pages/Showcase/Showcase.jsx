import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Showcase.css';
import { ACTORS, QUESTIONS, OVERNIGHT, NUMBERS, classify } from './showcaseData';

const ACTOR_BY_ID = Object.fromEntries(ACTORS.map((a) => [a.id, a]));
const ROUTE_LABEL = { home: 'Stays home', cloud: 'Cloud helper', none: 'No AI needed' };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

// ---- Icons (inline SVG, currentColor) ------------------------------------

function Icon({ id, size = 40 }) {
  const common = { width: size, height: size, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (id) {
    case 'glasses':
      return (
        <svg {...common}>
          <path d="M4 22h40" />
          <rect x="6" y="20" width="15" height="11" rx="5.5" />
          <rect x="27" y="20" width="15" height="11" rx="5.5" />
          <path d="M21 25c1.5-1.5 4.5-1.5 6 0" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...common}>
          <rect x="14" y="5" width="20" height="38" rx="4" />
          <path d="M21 9h6M24 38h.01" />
        </svg>
      );
    case 'box':
      return (
        <svg {...common}>
          <rect x="7" y="14" width="34" height="22" rx="4" />
          <circle cx="15" cy="25" r="2.2" />
          <circle cx="22" cy="25" r="2.2" />
          <path d="M30 20v10M35 20v10" />
        </svg>
      );
    case 'home':
      return (
        <svg {...common}>
          <path d="M8 24 24 10l16 14" />
          <path d="M12 22v16h24V22" />
          <path d="M20 38v-9h8v9" />
        </svg>
      );
    case 'cloud':
      return (
        <svg {...common}>
          <path d="M14 36h20a8 8 0 0 0 1-15.9A10 10 0 0 0 16 19a8.5 8.5 0 0 0-2 17Z" />
          <path d="M24 30v-8M20 26l4-4 4 4" />
        </svg>
      );
    case 'discord':
      return (
        <svg {...common}>
          <path d="M10 14c4-2 8-3 14-3s10 1 14 3l4 20c-4 3-8 4-11 4l-2-4c-3 1-7 1-10 0l-2 4c-3 0-7-1-11-4Z" />
          <circle cx="18" cy="24" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="30" cy="24" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}

// ---- Journey (the hero) ----------------------------------------------------

function Journey({ nerdy, reduced }) {
  const [qid, setQid] = useState(QUESTIONS[0].id);
  const [step, setStep] = useState(-1); // -1 idle, 0..n-1 beats, n done
  const [elapsed, setElapsed] = useState(0);
  const timers = useRef([]);
  const question = useMemo(() => QUESTIONS.find((q) => q.id === qid), [qid]);
  const stops = question.stops;
  const done = step >= stops.length;
  const running = step >= 0 && !done;

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const play = () => {
    clear();
    setStep(0);
    setElapsed(0);
    let acc = 0;
    stops.forEach((s, i) => {
      // Real beats are compressed so the whole journey plays in a few seconds.
      const wait = reduced ? 0 : Math.min(1400, Math.max(500, s.ms * 0.45));
      acc += wait;
      const t = setTimeout(() => {
        setStep(i + 1);
        setElapsed(stops.slice(0, i + 1).reduce((a, b) => a + b.ms, 0));
      }, acc);
      timers.current.push(t);
    });
  };

  useEffect(() => () => clear(), []);
  useEffect(() => { clear(); setStep(-1); setElapsed(0); }, [qid]);

  const activeActor = running ? stops[step].actor : null;
  const litActors = new Set(stops.slice(0, Math.max(step, 0) + (done ? 0 : 1)).map((s) => s.actor));
  if (step === -1) litActors.clear();

  const lanes = ['glasses', 'phone', 'box'];

  return (
    <section className="sc-journey" aria-labelledby="journey-title">
      <div className="sc-journey-head">
        <h2 id="journey-title">Follow one question</h2>
        <p>Pick a question, press play, and watch where it goes. Every beat is a real step in the system, with real timing.</p>
      </div>

      <div className="sc-qpick" role="radiogroup" aria-label="Pick a question">
        {QUESTIONS.map((q) => (
          <button
            key={q.id}
            role="radio"
            aria-checked={q.id === qid}
            className={`sc-chip ${q.id === qid ? 'is-on' : ''} route-${q.route}`}
            onClick={() => setQid(q.id)}
          >
            {q.text}
          </button>
        ))}
      </div>

      <div className={`sc-stage ${running ? 'is-running' : ''}`}>
        <div className="sc-lanes">
          {lanes.map((id) => (
            <ActorNode key={id} id={id} lit={litActors.has(id)} active={activeActor === id} />
          ))}
          <div className="sc-fork" aria-hidden={question.route === 'none'}>
            <ActorNode id="home" lit={litActors.has('home')} active={activeActor === 'home'} dim={question.route !== 'home'} small />
            <ActorNode id="cloud" lit={litActors.has('cloud')} active={activeActor === 'cloud'} dim={question.route !== 'cloud'} small />
          </div>
        </div>

        <ol className="sc-beats" aria-live="polite">
          {stops.map((s, i) => {
            const state = i < step ? 'done' : i === step && !done ? 'now' : 'todo';
            return (
              <li key={i} className={`sc-beat is-${state}`} style={{ '--beat': ACTOR_BY_ID[s.actor].color }}>
                <span className="sc-beat-dot" />
                <div>
                  <div className="sc-beat-label">{s.label}</div>
                  {nerdy && <div className="sc-beat-detail">{s.detail}</div>}
                </div>
                <span className="sc-beat-ms">{(s.ms / 1000).toFixed(s.ms < 100 ? 2 : 1)} s</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="sc-journey-foot">
        <button className="sc-play" onClick={play} disabled={running}>
          {step === -1 ? 'Play the journey' : done ? 'Play it again' : 'Playing…'}
        </button>
        <div className={`sc-answer ${done ? 'is-shown' : ''}`} aria-hidden={!done}>
          <span className="sc-answer-tag" style={{ '--tag': ACTOR_BY_ID[question.route === 'none' ? 'box' : question.route].color }}>
            {ROUTE_LABEL[question.route]} &middot; {(elapsed / 1000).toFixed(1)} s
          </span>
          <p className="sc-answer-text">&ldquo;{question.answer}&rdquo;</p>
          <p className="sc-answer-why">{question.why}</p>
        </div>
      </div>
    </section>
  );
}

function ActorNode({ id, lit, active, dim, small }) {
  const actor = ACTOR_BY_ID[id];
  return (
    <div
      className={`sc-actor ${lit ? 'is-lit' : ''} ${active ? 'is-active' : ''} ${dim ? 'is-dim' : ''} ${small ? 'is-small' : ''}`}
      style={{ '--actor': actor.color }}
    >
      <div className="sc-actor-badge"><Icon id={id} size={small ? 30 : 38} /></div>
      <div className="sc-actor-name">{actor.name}</div>
    </div>
  );
}

// ---- Cast -----------------------------------------------------------------

function Cast({ nerdy }) {
  return (
    <section className="sc-cast" aria-labelledby="cast-title">
      <h2 id="cast-title">Meet the five things involved</h2>
      <div className="sc-cast-grid">
        {ACTORS.map((a) => (
          <article key={a.id} className="sc-cast-card" style={{ '--actor': a.color }}>
            <div className="sc-cast-icon"><Icon id={a.id} size={34} /></div>
            <h3>{a.name}</h3>
            <p>{nerdy ? a.nerdy : a.plain}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---- Privacy demo ----------------------------------------------------------

function PrivacyDemo({ nerdy }) {
  const [text, setText] = useState('');
  const verdict = useMemo(() => classify(text), [text]);
  const examples = ['How much is in my savings account?', 'Explain the CAP theorem briefly', 'Set a timer for ten minutes', 'What’s the capital of Japan?'];
  return (
    <section className="sc-privacy" aria-labelledby="privacy-title">
      <div className="sc-privacy-copy">
        <h2 id="privacy-title">Private things stay in the house</h2>
        <p>
          Before any AI sees a question, the box checks what it is about. Health, money, family and faith
          are answered by the home brain and never leave. Try it: type anything you might ask.
        </p>
        {nerdy && (
          <p className="sc-nerdy-note">
            This is a copy of the real first step: a deterministic privacy screen, then rule-based device commands,
            then the Qwen classifier. The real one also strips privacy-tagged wiki pages out of any context that goes to Claude.
          </p>
        )}
      </div>
      <div className="sc-privacy-try">
        <label className="sc-visually-hidden" htmlFor="privacy-input">Type a question</label>
        <input
          id="privacy-input"
          className="sc-input"
          placeholder="Type a question you might ask…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
        />
        <div className="sc-examples">
          {examples.map((e) => (
            <button key={e} className="sc-chip is-quiet" onClick={() => setText(e)}>{e}</button>
          ))}
        </div>
        <div className={`sc-verdict ${verdict ? `route-${verdict.route} is-shown` : ''}`} aria-live="polite">
          {verdict ? (
            <>
              <div className="sc-verdict-icon"><Icon id={verdict.route === 'none' ? 'box' : verdict.route} size={36} /></div>
              <div>
                <div className="sc-verdict-title">{verdict.title}</div>
                <div className="sc-verdict-why">{verdict.why}</div>
              </div>
            </>
          ) : (
            <div className="sc-verdict-empty">The decision shows up here.</div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---- Overnight loop --------------------------------------------------------

function Overnight({ nerdy }) {
  const [i, setI] = useState(0);
  const stepItem = OVERNIGHT[i];
  const loopBack = i === OVERNIGHT.length - 2; // "Try again, or stop"
  return (
    <section className="sc-overnight" aria-labelledby="overnight-title">
      <div className="sc-overnight-head">
        <h2 id="overnight-title">The other job: working while I sleep</h2>
        <p>
          The glasses are the fun part. The useful part is that the same box can take on a programming task
          overnight, check its own work, and report back in the morning. Step through one night.
        </p>
      </div>
      <div className="sc-overnight-body">
        <ol className="sc-track" aria-label="Steps of one overnight run">
          {OVERNIGHT.map((s, idx) => (
            <li key={s.title}>
              <button
                className={`sc-track-dot ${idx === i ? 'is-on' : ''} ${idx < i ? 'is-past' : ''}`}
                style={{ '--actor': s.color }}
                onClick={() => setI(idx)}
                aria-current={idx === i ? 'step' : undefined}
                aria-label={`Step ${idx + 1}: ${s.title}`}
              >
                {idx + 1}
              </button>
            </li>
          ))}
        </ol>
        <article className="sc-step-card" style={{ '--actor': stepItem.color }} key={i}>
          <div className="sc-step-kicker">Step {i + 1} of {OVERNIGHT.length}</div>
          <h3>{stepItem.title}</h3>
          <p>{stepItem.plain}</p>
          {nerdy && <p className="sc-step-nerdy">{stepItem.nerdy}</p>}
          <div className="sc-step-nav">
            <button className="sc-btn-quiet" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>Back</button>
            {loopBack ? (
              <>
                <button className="sc-btn" onClick={() => setI(2)}>Teacher said try again</button>
                <button className="sc-btn" onClick={() => setI(i + 1)}>Teacher said pass</button>
              </>
            ) : (
              <button className="sc-btn" onClick={() => setI(Math.min(OVERNIGHT.length - 1, i + 1))} disabled={i === OVERNIGHT.length - 1}>
                {i === OVERNIGHT.length - 1 ? 'Morning' : 'Next'}
              </button>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

// ---- Numbers ----------------------------------------------------------------

function Numbers({ nerdy }) {
  return (
    <section className="sc-numbers" aria-labelledby="numbers-title">
      <h2 id="numbers-title">A few honest numbers</h2>
      <dl className="sc-numbers-grid">
        {NUMBERS.map((n) => (
          <div key={n.label} className="sc-number">
            <dt>{n.value}</dt>
            <dd>{n.label}{nerdy && <span className="sc-number-nerdy"> {n.nerdy}</span>}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---- Page -------------------------------------------------------------------

export default function Showcase() {
  const [nerdy, setNerdy] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    document.title = 'Jarvis & the glasses — how it works';
    return () => { document.title = 'Shahrukh Qureshi'; };
  }, []);

  return (
    <div className={`sc ${nerdy ? 'is-nerdy' : ''}`}>
      <header className="sc-top">
        <Link to="/" className="sc-brand">Shahrukh Qureshi</Link>
        <label className="sc-toggle">
          <input type="checkbox" checked={nerdy} onChange={(e) => setNerdy(e.target.checked)} />
          <span className="sc-toggle-track" aria-hidden><span className="sc-toggle-knob" /></span>
          <span>Show the engineering</span>
        </label>
      </header>

      <section className="sc-hero">
        <p className="sc-hero-kicker">A project by Shahrukh, built evenings and weekends in 2026</p>
        <h1>
          I built my own AI assistant. It lives in a small box in my room and talks to me through my sunglasses.
        </h1>
        <p className="sc-hero-sub">
          No company runs it. It knows my calendar, my notes and my projects, it keeps private things private,
          and it answers in about a second. This page shows how, with no jargon unless you ask for it.
        </p>
        <div className="sc-hero-cta">
          <a href="#journey-title" className="sc-btn">See a question travel</a>
          <a href="#overnight-title" className="sc-btn-quiet">See it work overnight</a>
        </div>
      </section>

      <Journey nerdy={nerdy} reduced={reduced} />
      <Cast nerdy={nerdy} />
      <PrivacyDemo nerdy={nerdy} />
      <Overnight nerdy={nerdy} />
      <Numbers nerdy={nerdy} />

      <section className="sc-more">
        <h2>Want the long version?</h2>
        <p>
          I kept a build diary. The glasses story starts with <Link to="/projects/glasses/hello-glasses">Putting Jarvis in my Ray-Bans</Link>,
          the server story with <Link to="/projects/jarvis/building-the-orchestrator">Building the orchestrator</Link>.
          Everything else is under <Link to="/projects">work</Link>.
        </p>
        <p className="sc-more-contact">
          Questions, or want to build something like this? <Link to="/contact">Say hello</Link>.
        </p>
      </section>
    </div>
  );
}
