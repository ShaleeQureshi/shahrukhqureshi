import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import './Story.css';

gsap.registerPlugin(MotionPathPlugin);

// Two geometries: a wide scene for desktop, a tall one for phones. Node
// centres plus the paths the traveller follows (sender -> receiver).
const LAYOUTS = {
  wide: {
    viewBox: '0 0 820 380',
    box: { x: 430, y: 40, w: 220, h: 300, labelY: 60 },
    nodes: { glasses: [70, 110], phone: [270, 110], router: [540, 120], qwen: [540, 258], claude: [740, 86], discord: [70, 300] },
    paths: {
      glassesToPhone: 'M118 110 L 232 110',
      phoneToRouter: 'M306 110 C 400 110, 420 120, 500 120',
      discordToRouter: 'M118 300 C 250 300, 400 300, 450 250 C 490 212, 505 170, 514 150',
      routerToQwen: 'M540 158 L 540 220',
      routerToClaude: 'M570 108 C 640 100, 660 86, 706 86',
      qwenToClaude: 'M576 250 C 660 240, 700 190, 718 118',
    },
    lock: [612, 100], grade: [588, 260], bubble: [70, 44],
  },
  tall: {
    viewBox: '0 -34 400 594',
    box: { x: 128, y: 140, w: 262, h: 390, labelY: 516 },
    nodes: { glasses: [66, 60], phone: [200, 60], router: [258, 212], qwen: [258, 400], claude: [335, 60], discord: [66, 212] },
    paths: {
      glassesToPhone: 'M102 60 L 166 60',
      phoneToRouter: 'M200 96 C 200 150, 258 130, 258 174',
      discordToRouter: 'M102 212 L 222 212',
      routerToQwen: 'M258 250 L 258 362',
      routerToClaude: 'M290 194 C 330 180, 335 140, 335 96',
      qwenToClaude: 'M292 386 C 395 350, 410 200, 352 94',
    },
    lock: [318, 150], grade: [304, 402], bubble: [80, -8],
  },
};

const WHO = {
  glasses: 'my glasses', phone: 'my phone', router: 'the box', qwen: 'home brain (Qwen)', claude: 'cloud helper (Claude)', discord: 'Discord',
};

// Every scenario is a list of beats: where the traveller goes, what the
// caption says, who lights up, and the real time the step takes (ms, from
// the 2026-10-18 benchmark). Travel is animated at constant speed; the
// real numbers go in the side panel.
const SCENARIOS = [
  {
    title: 'A quick question',
    colour: 'var(--s-home)',
    cost: 'Free, runs on the box',
    leaves: 'No',
    note: 'Easy questions never need the cloud. Most of the time here is the phone writing down what I said.',
    beats: [
      { say: '“What’s two plus two?”', from: 'glasses', path: 'glassesToPhone', lit: ['glasses', 'phone'], who: 'glasses', ms: 300 },
      { say: 'My phone turns my voice into text on the phone itself and sends only the words to the box.', path: 'phoneToRouter', lit: ['phone', 'router'], who: 'phone', ms: 600 },
      { say: 'The box decides: easy. The home brain, a Qwen model running on the box, can answer this.', path: 'routerToQwen', lit: ['router', 'qwen'], who: 'router', ms: 780 },
      { say: '“Four.” The home brain answers in a fraction of a second and the reply is read into my ear.', path: 'routerToQwen', reverse: true, chain: ['phoneToRouter', 'glassesToPhone'], lit: ['qwen', 'glasses'], who: 'qwen', ms: 360, answer: 'Four.' },
    ],
  },
  {
    title: 'A private question',
    colour: 'var(--s-home)',
    cost: 'Free, runs on the box',
    leaves: 'No, locked',
    note: 'Health, money, family and faith are answered at home even when the cloud would be smarter. The lock is a rule, not a preference.',
    beats: [
      { say: '“What did my doctor say about my blood pressure?”', from: 'glasses', path: 'glassesToPhone', lit: ['glasses', 'phone'], who: 'glasses', ms: 300 },
      { say: 'Only text leaves the phone, never the recording.', path: 'phoneToRouter', lit: ['phone', 'router'], who: 'phone', ms: 600 },
      { say: 'The box spots a health topic and locks the door to the cloud before any AI reads the question.', path: 'routerToQwen', lit: ['router', 'qwen'], who: 'router', ms: 20, lock: true },
      { say: 'The home brain reads my own notes and answers. The internet was never involved.', path: 'routerToQwen', reverse: true, chain: ['phoneToRouter', 'glassesToPhone'], lit: ['qwen', 'glasses'], who: 'qwen', ms: 700, answer: 'Normal on Tuesday.' },
    ],
  },
  {
    title: 'A hard question',
    colour: 'var(--s-cloud)',
    cost: 'One cloud call',
    leaves: 'The question only',
    note: 'The cloud helper is slower and costs a call, so the box uses it only when a tool or a bigger brain is needed.',
    beats: [
      { say: '“What’s on my calendar today?”', from: 'glasses', path: 'glassesToPhone', lit: ['glasses', 'phone'], who: 'glasses', ms: 300 },
      { say: 'The phone sends the words to the box.', path: 'phoneToRouter', lit: ['phone', 'router'], who: 'phone', ms: 600 },
      { say: 'This needs a calendar tool and a bigger brain. The box sends it to Claude with anything private stripped out.', path: 'routerToClaude', lit: ['router', 'claude'], who: 'router', ms: 780 },
      { say: 'Claude checks the calendar and writes a reply. The box reads it back to me.', path: 'routerToClaude', reverse: true, chain: ['phoneToRouter', 'glassesToPhone'], lit: ['claude', 'glasses'], who: 'claude', ms: 3100, answer: 'Career day at two.' },
    ],
  },
  {
    title: 'Coding while I sleep',
    colour: 'var(--s-discord)',
    cost: 'Mostly free; Claude only when needed',
    leaves: 'Code for the hard parts',
    note: 'Local Qwen models plan, write and test code on the box. Claude is brought in for the problems they cannot crack, and Qwen checks the result.',
    beats: [
      { say: 'Before bed I message the box on Discord: “run orders-api”.', from: 'discord', path: 'discordToRouter', lit: ['discord', 'router'], who: 'discord', ms: 1000 },
      { say: 'The home brain takes the job: it reads the project, makes a safe copy, and writes the first version of the code itself.', path: 'routerToQwen', lit: ['router', 'qwen'], who: 'qwen', ms: 180000 },
      { say: 'When it hits something it cannot crack, that part is escalated to Claude. Everything else stays local.', path: 'qwenToClaude', lit: ['qwen', 'claude'], who: 'claude', ms: 240000 },
      { say: 'Claude’s work comes back and the tests run. The home brain grades the whole result like a strict teacher: pass, or try again.', path: 'qwenToClaude', reverse: true, lit: ['claude', 'qwen'], who: 'qwen', ms: 90000, grade: true },
      { say: 'In the morning a summary is waiting on my phone: what passed, what did not, and what it cost.', path: 'routerToQwen', reverse: true, chain: ['discordToRouter'], lit: ['qwen', 'discord'], who: 'discord', ms: 2000, answer: '2 passed, 0 failed' },
    ],
  },
];

const NODE_IDS = Object.keys(LAYOUTS.wide.nodes);
const READ_SECONDS = 2.6;
const ANSWER_SECONDS = 3.2;
const SPEED = 170; // svg units per second, constant along a route

function fmt(ms) {
  if (ms >= 60000) return `${Math.round(ms / 60000)} min`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 700px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    const update = () => setNarrow(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}

export default function Story() {
  const narrow = useNarrow();
  return <Scene key={narrow ? 'tall' : 'wide'} layout={narrow ? LAYOUTS.tall : LAYOUTS.wide} />;
}

function Scene({ layout }) {
  const root = useRef(null);

  useEffect(() => {
    const el = root.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = (sel) => el.querySelector(sel);
    const caption = $('.story-caption');
    const title = $('.story-title');
    const bubble = $('.story-bubble');
    const bubbleText = $('.story-bubble text');
    const dot = $('.story-dot');
    const lock = $('.story-lock');
    const grade = $('.story-grade');
    const dots = el.querySelectorAll('.story-progress i');
    const panel = { step: $('.sp-step'), who: $('.sp-who'), ms: $('.sp-ms'), total: $('.sp-total-v'), leaves: $('.sp-leaves'), cost: $('.sp-cost'), note: $('.sp-note') };
    const pathEl = (name) => $(`[data-path="${name}"]`);
    const total = { v: 0 };

    const setLit = (ids, active) => {
      NODE_IDS.forEach((id) => {
        const n = $(`[data-node="${id}"]`);
        n.classList.toggle('is-lit', ids.includes(id));
        n.classList.toggle('is-active', id === active);
      });
    };
    const setCaption = (text) => {
      gsap.timeline().to(caption, { opacity: 0, y: -4, duration: 0.18, ease: 'power1.in' })
        .call(() => { caption.textContent = text; })
        .to(caption, { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' });
    };
    const setPanel = (sc, bi, b) => {
      panel.step.textContent = `${bi + 1} of ${sc.beats.length}`;
      panel.who.textContent = WHO[b.who];
      panel.who.style.color = `var(--s-${b.who === 'router' ? 'box' : b.who})`;
      panel.ms.textContent = fmt(b.ms);
      panel.leaves.textContent = ['glasses', 'phone', 'discord'].includes(b.who) && bi < 2 ? 'Not yet' : sc.leaves;
      panel.cost.textContent = sc.cost;
      panel.note.textContent = sc.note;
    };
    const countTotal = (ms) => gsap.to(total, {
      v: total.v + ms, duration: 0.8, ease: 'power1.out', onUpdate: () => { panel.total.textContent = fmt(total.v); },
    });

    if (reduced) {
      setLit(NODE_IDS, null);
      title.textContent = 'How it works';
      caption.textContent = 'A question travels glasses → phone → the box. Easy and private questions are answered at home by Qwen. Hard ones go to Claude. Overnight, Qwen writes and tests code on the box and Claude is brought in for the hardest problems.';
      setPanel(SCENARIOS[0], 3, SCENARIOS[0].beats[3]);
      panel.total.textContent = '2.0 s';
      return undefined;
    }

    gsap.ticker.lagSmoothing(500, 33);
    const master = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });

    SCENARIOS.forEach((sc, si) => {
      const tl = gsap.timeline();
      tl.call(() => {
        title.textContent = sc.title;
        el.style.setProperty('--s-current', sc.colour);
        dots.forEach((d, i) => d.classList.toggle('is-on', i === si));
        gsap.set(bubble, { opacity: 0 });
        gsap.set([lock, grade], { opacity: 0, scale: 0.6 });
        total.v = 0;
        panel.total.textContent = '0.0 s';
        setLit([], null);
      });
      sc.beats.forEach((b, bi) => {
        const names = b.reverse ? [b.path, ...(b.chain || [])] : [b.path];
        tl.call(() => { setCaption(b.say); setLit(b.lit, b.who); setPanel(sc, bi, b); });
        if (bi === 0) {
          const [cx, cy] = layout.nodes[b.from];
          tl.set(dot, { opacity: 1, x: cx, y: cy, scale: 1 });
          tl.to(dot, { scale: 1.35, duration: 0.22, yoyo: true, repeat: 1, ease: 'sine.inOut' });
        }
        // One route = several path elements; ease in on the first, run at
        // constant speed through the middle, ease out on the last, so the
        // traveller never stops at a node it is only passing.
        names.forEach((name, i) => {
          const p = pathEl(name);
          const dur = Math.max(0.45, p.getTotalLength() / SPEED);
          const single = names.length === 1;
          const ease = single ? 'power2.inOut' : i === 0 ? 'power2.in' : i === names.length - 1 ? 'power2.out' : 'none';
          tl.to(dot, { duration: dur, ease, motionPath: { path: p, align: p, alignOrigin: [0.5, 0.5], start: b.reverse ? 1 : 0, end: b.reverse ? 0 : 1 } });
        });
        tl.call(() => { countTotal(b.ms); });
        if (b.lock) tl.to(lock, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, '<');
        if (b.grade) tl.to(grade, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, '<');
        if (b.answer) {
          tl.call(() => { bubbleText.textContent = b.answer; });
          tl.fromTo(bubble, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
        }
        tl.to({}, { duration: b.answer ? ANSWER_SECONDS : READ_SECONDS });
      });
      tl.to(dot, { opacity: 0, duration: 0.35, ease: 'power1.in' });
      master.add(tl);
    });

    const onVis = () => (document.hidden ? master.pause() : master.play());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      master.kill();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [layout]);

  const { nodes, paths, box } = layout;
  return (
    <figure className="story" ref={root} aria-label="Animated explanation of how Jarvis answers a question and does coding work overnight">
      <div className="story-head">
        <span className="story-title">How it works</span>
        <span className="story-progress" aria-hidden>{SCENARIOS.map((s) => <i key={s.title} />)}</span>
      </div>
      <div className="story-body">
        <div className="story-main">
          <svg className="story-scene" viewBox={layout.viewBox} role="img" aria-hidden>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="22" className="story-boxframe" />
            <text x={box.x + box.w / 2} y={box.labelY} textAnchor="middle" className="story-boxlabel">the box · a Mac Studio at home</text>

            {Object.entries(paths).map(([name, d]) => (
              <path key={name} data-path={name} d={d} className="story-route" />
            ))}

            <Node id="glasses" at={nodes.glasses} label="my glasses" colour="var(--s-glasses)">
              <path d="M-18 0h36" /><rect x="-18" y="-6" width="15" height="12" rx="6" /><rect x="3" y="-6" width="15" height="12" rx="6" />
            </Node>
            <Node id="phone" at={nodes.phone} label="my phone" sub="voice → text" colour="var(--s-phone)">
              <rect x="-9" y="-16" width="18" height="32" rx="4" /><path d="M-3 -12h6" />
            </Node>
            <Node id="router" at={nodes.router} label="the box decides" sub="easy? private? hard?" colour="var(--s-box)">
              <path d="M0 14V0M0 0L-11 -11M0 0L11 -11" /><circle cx="-11" cy="-11" r="3" /><circle cx="11" cy="-11" r="3" />
            </Node>
            <Node id="qwen" at={nodes.qwen} label="home brain · Qwen" sub="answers, writes code, grades" colour="var(--s-home)">
              <path d="M-13 3 L0 -10 L13 3" /><path d="M-9 1v11h18V1" />
            </Node>
            <Node id="claude" at={nodes.claude} label="cloud helper · Claude" sub="for the hardest problems" colour="var(--s-cloud)">
              <path d="M-12 8h22a7 7 0 0 0 1-14 9 9 0 0 0-17-2 7.5 7.5 0 0 0-6 16Z" />
            </Node>
            <Node id="discord" at={nodes.discord} label="Discord" sub="a chat on my phone" colour="var(--s-discord)">
              <path d="M-14 -6c4-2 8-3 14-3s10 1 14 3l3 16c-4 3-8 4-11 4l-2-3c-3 1-5 1-8 0l-2 3c-3 0-7-1-11-4Z" /><circle cx="-5" cy="2" r="2" fill="currentColor" stroke="none" /><circle cx="5" cy="2" r="2" fill="currentColor" stroke="none" />
            </Node>

            <g className="story-lock" transform={`translate(${layout.lock[0]} ${layout.lock[1]})`}>
              <rect x="-11" y="-6" width="22" height="18" rx="4" /><path d="M-6 -6v-5a6 6 0 0 1 12 0v5" />
            </g>
            <g className="story-grade" transform={`translate(${layout.grade[0]} ${layout.grade[1]})`}>
              <circle r="13" /><path d="M-6 0l4 4 8-9" />
            </g>
            <g className="story-bubble" transform={`translate(${layout.bubble[0]} ${layout.bubble[1]})`}>
              <rect x="-66" y="-20" width="132" height="34" rx="17" />
              <path d="M-4 14l4 10 6-10z" />
              <text x="0" y="2" textAnchor="middle">Four.</text>
            </g>
            <g className="story-dot"><circle r="17" className="story-dot-halo" /><circle r="8" className="story-dot-core" /></g>
          </svg>
          <figcaption className="story-caption">Watch a question travel through the system.</figcaption>
        </div>

        <aside className="story-panel" aria-live="polite">
          <div className="sp-row"><span>Step</span><strong className="sp-step">–</strong></div>
          <div className="sp-row"><span>Working now</span><strong className="sp-who">–</strong></div>
          <div className="sp-row"><span>This step, real time</span><strong className="sp-ms">–</strong></div>
          <div className="sp-row sp-total"><span>Time so far</span><strong className="sp-total-v">0.0 s</strong></div>
          <div className="sp-row"><span>Leaves the house?</span><strong className="sp-leaves">–</strong></div>
          <div className="sp-row"><span>Cost</span><strong className="sp-cost">–</strong></div>
          <p className="sp-note">Times are measured on the real system, not made up for the animation.</p>
        </aside>
      </div>
    </figure>
  );
}

function Node({ id, at, label, sub, colour, children }) {
  const [x, y] = at;
  return (
    <g data-node={id} className="story-node" style={{ '--n': colour }} transform={`translate(${x} ${y})`}>
      <circle r="30" className="story-node-ring" />
      <g className="story-node-icon">{children}</g>
      <text y="48" textAnchor="middle" className="story-node-label">{label}</text>
      {sub && <text y="64" textAnchor="middle" className="story-node-sub">{sub}</text>}
    </g>
  );
}
