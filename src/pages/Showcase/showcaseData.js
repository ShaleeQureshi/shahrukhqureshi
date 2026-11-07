// Content for the career-day showcase. Plain language first; the "nerdy"
// strings are only shown when the visitor flips the detail toggle.
// Timings are rounded from the 2026-10-18 benchmark (p50, warm).

export const ACTORS = [
  {
    id: 'glasses',
    name: 'The glasses',
    color: 'var(--c-glasses)',
    plain: 'Ordinary Ray-Ban Meta sunglasses. They have a microphone, a tiny speaker in each arm, and a camera. I did not modify them.',
    nerdy: 'Ray-Ban Meta Gen 2. Audio over Bluetooth HFP; photos via Meta’s DAT SDK. No firmware changes.',
  },
  {
    id: 'phone',
    name: 'My phone',
    color: 'var(--c-phone)',
    plain: 'The glasses can only talk to a phone, so the phone is the messenger. It also turns my voice into text before anything leaves it.',
    nerdy: 'Swift companion app. On-device Whisper (WhisperKit) for speech to text; POSTs NDJSON over HTTPS through Tailscale.',
  },
  {
    id: 'box',
    name: 'The box',
    color: 'var(--c-box)',
    plain: 'A small silver computer on a shelf at home (a Mac Studio). This is where the assistant actually lives. Nothing is rented from a company.',
    nerdy: 'Mac Studio M3 Ultra, 96 GB. Services run in a local Kubernetes cluster (k3d on OrbStack); the models run natively on the Metal GPU.',
  },
  {
    id: 'home',
    name: 'The home brain',
    color: 'var(--c-home)',
    plain: 'A smaller AI that runs entirely inside the box. It answers simple questions and anything personal, and it never uses the internet.',
    nerdy: 'Qwen 3 8B as router/classifier and Qwen 2.5 responder via Ollama. Embeddings with nomic-embed-text into Postgres + pgvector.',
  },
  {
    id: 'cloud',
    name: 'The cloud helper',
    color: 'var(--c-cloud)',
    plain: 'A much bigger AI (Claude) that the box can phone for hard questions. It only gets what the box decides it is allowed to see.',
    nerdy: 'Claude via the claude CLI (Max plan, no API key) behind a native gateway. Tools arrive through an audited MCP server with built-in tools disabled.',
  },
];

// One question's journey through the system. Each stop is one beat of the
// animation: label (plain), detail (nerdy), the actor that lights up, and
// how long the beat takes in the real system (ms, used for the timer).
export const QUESTIONS = [
  {
    id: 'calendar',
    text: 'What’s on my calendar today?',
    answer: 'You have one thing: the career day at the masjid, at two.',
    route: 'cloud',
    why: 'Calendar access is a tool only the cloud helper can use, so the box sends it out, minus anything tagged private.',
    stops: [
      { actor: 'glasses', label: 'You tap the glasses and ask', detail: 'Touchpad tap starts push-to-talk; mic streams over Bluetooth', ms: 300 },
      { actor: 'phone', label: 'Your phone writes down what you said', detail: 'WhisperKit transcribes on the Neural Engine; text only leaves the phone', ms: 600 },
      { actor: 'box', label: 'The box reads it and decides who should answer', detail: 'Privacy screen, then the Qwen classifier: needs a tool → CLAUDE route', ms: 780 },
      { actor: 'cloud', label: 'The cloud helper checks the calendar and writes a reply', detail: 'Claude calls the calendar tool over MCP; the call is audited', ms: 3100 },
      { actor: 'glasses', label: 'You hear the answer in your ear', detail: 'First sentence streamed back as NDJSON; phone speaks it', ms: 400 },
    ],
  },
  {
    id: 'photo',
    text: 'What am I looking at?',
    answer: 'A plate of dates and a pot of Arabic coffee.',
    route: 'cloud',
    why: 'The home brain cannot see pictures yet, so photos go to the cloud helper.',
    stops: [
      { actor: 'glasses', label: 'You snap a photo and ask', detail: 'Camera button; photo rides along if taken in the last 60 s', ms: 400 },
      { actor: 'phone', label: 'Your phone sends the words and the picture', detail: 'Multipart upload to /photo, then /ask-text/stream with attach_latest_photo', ms: 700 },
      { actor: 'box', label: 'The box sees there is a picture', detail: 'Router reason image:no_local_vision → CLAUDE', ms: 200 },
      { actor: 'cloud', label: 'The cloud helper looks and describes it', detail: 'Persistent stream-json session with an image block', ms: 3500 },
      { actor: 'glasses', label: 'You hear what it saw', detail: 'Sentence-level TTS, time to first audio about 1 s', ms: 400 },
    ],
  },
  {
    id: 'health',
    text: 'What did my doctor say about my blood pressure?',
    answer: 'Your notes from Tuesday say it was normal; keep the evening walk.',
    route: 'home',
    why: 'Anything about health, money or family is answered at home. The box refuses to send it out, even if the home brain is slower.',
    stops: [
      { actor: 'glasses', label: 'You ask something personal', detail: 'Same push-to-talk path', ms: 300 },
      { actor: 'phone', label: 'Your phone writes it down', detail: 'On-device transcription', ms: 600 },
      { actor: 'box', label: 'The box spots a private topic and keeps it home', detail: 'Deterministic privacy screen fires before any model call', ms: 20 },
      { actor: 'home', label: 'The home brain reads your own notes and answers', detail: 'RAG over the wiki with privacy-tagged pages, local Qwen reply', ms: 400 },
      { actor: 'glasses', label: 'You hear it. The internet was never involved.', detail: 'Privacy class p50 0.37 s end to end on the cluster', ms: 300 },
    ],
  },
  {
    id: 'simple',
    text: 'What’s two plus two?',
    answer: 'Four.',
    route: 'home',
    why: 'Easy questions stay home because the home brain is fast and free.',
    stops: [
      { actor: 'glasses', label: 'You ask a quick one', detail: 'Push-to-talk', ms: 300 },
      { actor: 'phone', label: 'Your phone writes it down', detail: 'WhisperKit', ms: 600 },
      { actor: 'box', label: 'The box decides this is easy', detail: 'Classifier: trivial → LOCAL', ms: 780 },
      { actor: 'home', label: 'The home brain answers', detail: 'First token in 160 ms', ms: 190 },
      { actor: 'glasses', label: 'Four.', detail: 'Trivial class p50 1.0 s end to end', ms: 200 },
    ],
  },
  {
    id: 'device',
    text: 'Turn off the lights',
    answer: 'Done.',
    route: 'none',
    why: 'Commands like this do not need any AI at all. The box recognises the pattern and just does it.',
    stops: [
      { actor: 'glasses', label: 'You give a command', detail: 'Push-to-talk', ms: 300 },
      { actor: 'phone', label: 'Your phone writes it down', detail: 'WhisperKit', ms: 600 },
      { actor: 'box', label: 'The box recognises a device command and acts', detail: 'Rules-first router: NONE route, no model, 32 ms total', ms: 40 },
      { actor: 'glasses', label: 'Done.', detail: 'No model, no cloud, no cost', ms: 200 },
    ],
  },
];

// The overnight loop: Jarvis as a project worker you talk to on Discord.
export const OVERNIGHT = [
  {
    title: 'You send a message before bed',
    plain: 'From my phone, in a private Discord chat: “run orders-api”. That is the whole instruction.',
    nerdy: '#status channel verb → RunQueue row in SQLite; budget and resource gates checked.',
    color: 'var(--c-discord)',
  },
  {
    title: 'The box gives the AI a safe copy of the project',
    plain: 'It never works on the real files. It makes a scratch copy so nothing can be broken by accident.',
    nerdy: 'WorktreeManager creates a git worktree per run; async git subprocesses.',
    color: 'var(--c-box)',
  },
  {
    title: 'The cloud helper writes the code',
    plain: 'Claude Code reads the task, edits the copy, and explains what it did.',
    nerdy: 'claude CLI in headless mode; stdout persisted per iteration under data/runs/.',
    color: 'var(--c-cloud)',
  },
  {
    title: 'The tests run',
    plain: 'The project’s own checks run automatically. Did anything break?',
    nerdy: 'Per-project test command with a hard wallclock timeout; pytest/jest/JUnit parsers.',
    color: 'var(--c-phone)',
  },
  {
    title: 'The home brain grades the work',
    plain: 'A second, local AI reads the changes and the test results like a strict teacher and says pass or try again.',
    nerdy: 'Qwen 2.5 Coder 32B judge; verdict rows persisted; stuck detector on unchanging diffs.',
    color: 'var(--c-home)',
  },
  {
    title: 'Try again, or stop',
    plain: 'If the teacher says no, the feedback becomes the next instruction and the loop repeats. There is a cap so it cannot run forever.',
    nerdy: 'Iteration cap, wallclock cap, 50 Claude calls a day across everything.',
    color: 'var(--c-box)',
  },
  {
    title: 'You wake up to a summary',
    plain: 'A morning digest in Discord: what passed, what did not, your calendar, and what it cost.',
    nerdy: 'daily_digest worker at a fixed UTC hour; calendar via MCP; costs from llm_calls.',
    color: 'var(--c-discord)',
  },
];

export const NUMBERS = [
  { value: '1.0 s', label: 'typical answer time through the glasses', nerdy: 'p50 TTFB across 33 benchmark questions, cluster path, 2026-10-18' },
  { value: '0.4 s', label: 'for private questions, answered at home', nerdy: 'privacy class p50 372 ms, local route' },
  { value: '0', label: 'personal details sent to the cloud', nerdy: 'privacy screen runs before any model call; tagged pages stripped from RAG' },
  { value: '1,500+', label: 'automated checks that run before any change ships', nerdy: '1,534 unit/integration tests + 58 live-cluster tests' },
  { value: 'May 2026', label: 'first answer through the glasses', nerdy: 'Glasses v1.0.0, push-to-talk verified on Ray-Ban Meta' },
  { value: '$0', label: 'monthly cost beyond the subscriptions I already had', nerdy: 'Claude Max unchanged; everything else open source on hardware I own' },
];

// The live privacy demo: a tiny copy of the real rules so visitors can try
// their own question. The real router does the same first step.
export const PRIVATE_WORDS = [
  'doctor', 'health', 'blood', 'medication', 'medicine', 'therapy', 'sick', 'hospital',
  'money', 'bank', 'savings', 'salary', 'debt', 'loan', 'account', 'financial', 'rent',
  'family', 'wife', 'husband', 'kids', 'daughter', 'son', 'mother', 'father',
  'deen', 'prayer', 'quran', 'fast', 'zakat',
];
export const DEVICE_PATTERNS = [/^turn (on|off)\b/i, /^set a timer/i, /^stop$/i, /^pause\b/i, /^(lights|volume)\b/i];
export const TOOL_WORDS = ['calendar', 'email', 'inbox', 'schedule', 'meeting', 'remind', 'drive', 'file'];
export const EASY_WORDS = ['plus', 'minus', 'capital of', 'spell', 'how many days', 'synonym', 'hello', 'hi ', 'what time'];

export function classify(text) {
  const t = ` ${text.toLowerCase().trim()} `;
  if (!text.trim()) return null;
  if (DEVICE_PATTERNS.some((re) => re.test(text.trim()))) {
    return { route: 'none', title: 'No AI needed', why: 'This looks like a command. The box just does it.' };
  }
  if (PRIVATE_WORDS.some((w) => t.includes(` ${w}`))) {
    return { route: 'home', title: 'Stays home', why: 'This touches health, money, family or faith. The box answers it itself and never sends it out.' };
  }
  if (TOOL_WORDS.some((w) => t.includes(w))) {
    return { route: 'cloud', title: 'Cloud helper, with a tool', why: 'Reading your calendar or email needs a tool only the cloud helper has. It gets the question, not your private notes.' };
  }
  if (EASY_WORDS.some((w) => t.includes(w)) || text.trim().split(/\s+/).length <= 4) {
    return { route: 'home', title: 'Stays home', why: 'Short and simple. The home brain is fast and free, so it takes it.' };
  }
  return { route: 'cloud', title: 'Cloud helper', why: 'A longer or harder question. The box sends it to the bigger AI and reads the answer back to you.' };
}
