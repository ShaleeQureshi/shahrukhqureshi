---
title: RAG over a personal vault
date: 2026-05-06
---

Jarvis has a memory. It's not a magic vector store and it's not the LLM's context window — it's my Obsidian vault, which I'd been writing into for years before Jarvis existed.

The vault is a directory of markdown files. Some are journal entries. Some are project docs. Some are book notes. Some are the kind of personal stuff you don't want to ever leave the machine. Getting Jarvis to read all of it usefully — without leaking the wrong parts to Claude or the wider internet — turned out to be one of the more interesting design problems.

## The model

Embeddings are BGE-large-en, served via sentence-transformers. Vector storage is ChromaDB. Standard stack.

The thing that takes most of the work isn't the model choice. It's three other things:

1. Chunking the markdown sensibly
2. Keeping the index fresh as I write
3. Privacy tagging

## Chunking

Naive chunking is "split every 512 tokens." This is fine if your corpus is articles. It's bad for a personal vault, where one file might contain six unrelated thoughts and another might be a single coherent essay.

The approach that worked: split on markdown headings, then merge tiny chunks back together, then split anything still too big. Each chunk keeps a reference to the file path and the heading path that contains it. When the RAG retriever returns a chunk, the citation includes both — `journal/2026-04-22.md > Mac Studio decision` — which makes it easy to verify what Jarvis is actually pulling.

The frontmatter parser was the other piece. Files have YAML frontmatter with tags, dates, project references. The chunker pulls that out and attaches it as metadata on every chunk from that file. Tags become filterable. Dates become filterable. Project references let me ask "what have I written about Atlas this month" and get back chunks scoped to that project.

## Keeping it fresh

The vault changes constantly. I write into it daily, sometimes more. If the index lags behind the filesystem, the retriever starts returning stale results — wrong file paths, deleted content, missing recent thoughts.

The fix is a filesystem watcher. A worker subscribes to filesystem events on the vault directory. When a file changes, it gets re-chunked and re-embedded. When a file is deleted, all chunks with that file path get removed from Chroma.

There's a debounce in front of this. If I save a file three times in 30 seconds (which I do, constantly, while writing), only the last save triggers re-embedding. The debounce is per-file, 10 seconds by default. Good enough for active writing, fast enough that the index lags real-time by under a minute.

## Privacy tags

This is the part I care about most.

My vault has stuff in it that I'm fine with Claude reading — project notes, technical docs, public-facing thinking. It also has stuff I am not fine with Claude reading — financial details, health information, anything about specific people in my life.

The mechanism is a `privacy` field in the YAML frontmatter:

```yaml
---
title: Some note
privacy: personal
tags: [journal]
---
```

The privacy levels are:

- `public` (default) — eligible for any retrieval, can be sent to Claude
- `personal` — retrievable for local model paths only, never sent to Claude
- `sensitive` — retrievable only when the message itself was tagged as personal context, never sent to Claude or any external service
- `restricted` — indexed but never retrieved by the RAG path. Only accessible by direct file lookup, which I do manually.

Every chunk inherits the privacy level of its file. The retriever takes a `max_privacy` parameter based on the current request:

- If the message is going to Claude, `max_privacy=public`
- If the message is being answered by a local model only, `max_privacy=personal` 
- If the message is in a private DM and the user explicitly marked it personal context, `max_privacy=sensitive`
- Restricted is never retrieved automatically, period

The filtering happens at the ChromaDB query level via a metadata filter, not after the fact. The personal chunks never even leave Chroma when the path is Claude-bound.

## Intake — writing back into the vault

The vault isn't read-only. Jarvis can write to it, but only into specific subdirectories: `inbox/`, `voice-memos/`, and `intakes/`. Everything else is read-only enforced at the BrainBridge layer.

The intake flow is: I send Jarvis a message like "remember that I want to look into the new Anthropic batch API pricing later." The router classifies it as a `brain_intake`. The path executor writes a new file in `inbox/2026-05-06-anthropic-batch-pricing.md` with frontmatter and the body, and replies "filed."

I review the inbox once or twice a week, move things into permanent locations, delete what wasn't worth keeping. The point is to capture friction-free, sort later.

Voice memos work the same way. I record a voice message in Discord. The voice processor transcribes it with Whisper, sends it through the router, and if it's an intake, files it in `voice-memos/2026-05-06-1947.md` with both the audio reference and the transcription.

## The smoke test

When I first turned RAG on against the real vault: 59 of 69 files indexed, 121 chunks. 10 files failed — turned out they had malformed YAML frontmatter that pre-dated when I cleaned up my templates. Fixed the frontmatter, reran the indexer, 69/69.

The actual retrieval quality surprised me. Queries returned chunks with real citations that I could click through to verify. The chunking-by-heading paid off — chunks felt like coherent thoughts, not arbitrary 500-token windows.

## What I'd change

Two things.

**Re-embedding is too expensive.** A full vault re-index takes 3–4 minutes. Incremental works fine but if I bump the embedding model version, I'm offline for a few minutes. I'd build a shadow index next time — embed into a new collection while the old one keeps serving, switch atomically when done.

**The privacy levels are coarse.** Four tiers covers most of my needs but I'd want a fifth for "this can go to Claude only with a per-message confirmation." Some edge cases — like asking Claude for help with a complicated personal situation — would benefit from a one-time waiver flow.

Both are quality-of-life. The current design works for the way I actually use it, which is the only test that matters.
