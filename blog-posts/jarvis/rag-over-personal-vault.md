---
title: RAG over a personal vault
date: 2026-05-03
---

Jarvis has a memory. It's not a magic vector store and it's not the LLM's context window — it's my Obsidian vault, which I'd been writing into for years before Jarvis existed.

The vault is a directory of markdown files. Some are journal entries. Some are project docs. Some are book notes. Some are the kind of personal stuff you don't want to ever leave the machine. Getting Jarvis to read all of it usefully — without leaking the wrong parts to Claude or the wider internet — turned out to be one of the more interesting design problems.

## The model

Embeddings are BGE-large-en, served via sentence-transformers. Vector storage is ChromaDB. Standard stack, lazy-loaded so the heavy imports only happen the first time a query actually needs them.

The thing that takes most of the work isn't the model choice. It's three other things:

1. Chunking the markdown sensibly
2. Keeping the index fresh as I write
3. Privacy tagging

## Chunking

Naive chunking is "split every 512 tokens." This is fine if your corpus is articles. It's bad for a personal vault, where one file might contain six unrelated thoughts and another might be a single coherent essay.

The approach that worked: chunk on paragraph boundaries with a bit of character overlap between chunks, and fall back to keeping a paragraph whole when it's already small enough on its own. Each chunk keeps a reference to its source file, so when the RAG retriever returns a chunk, the citation points back to the actual markdown file I can open and verify.

The frontmatter parser was the other piece. Files have YAML frontmatter with tags, dates, project references. The parser pulls that out and attaches it as metadata on every chunk from that file — and it's strict about the shape, because a malformed frontmatter block should fail loudly at index time, not silently produce a chunk with garbage metadata.

## Keeping it fresh

The vault changes constantly. I write into it daily, sometimes more. If the index lags behind the filesystem, the retriever starts returning stale results — wrong file paths, deleted content, missing recent thoughts.

The fix is a filesystem watcher. A worker subscribes to filesystem events on the vault directory. When a file changes, it gets re-chunked and re-embedded. When a file is deleted, all chunks with that file path get removed from Chroma. Re-embedding is idempotent — it deletes the old chunks for a file before writing the new ones — so a re-index can't leave duplicates behind.

There's a debounce in front of this. Obsidian fires a noisy burst of save events every time it touches a file, so a per-path 2-second debounce collapses that burst into a single re-embed. Good enough for active writing, fast enough that the index lags real-time by well under a minute.

## Privacy tags

This is the part I care about most.

My vault has stuff in it that I'm fine with Claude reading — project notes, technical docs, public-facing thinking. It also has stuff I am not fine with Claude reading — financial details, health information, religious practice, anything about specific people in my life.

The mechanism is a `privacy` field in the YAML frontmatter, holding one or more category tags:

```yaml
---
title: Some note
privacy: [personal, financial]
tags: [journal]
---
```

The tags are categories, not a severity ladder — `personal`, `financial`, `health`, `deen`. The rule is simple and absolute: if a chunk carries any privacy tag, it is local-only. It can be retrieved to answer a question with a local model, and it never goes to Claude or any external service.

The enforcement is layered, because a single check is a single point of failure:

- **At the router.** The router guesses whether a message touches sensitive context and tags it. A message heading for Claude that looks personal gets caught here first.
- **At the retrieval query.** When the path is Claude-bound, the privacy filter is part of the ChromaDB `where` clause — privacy-tagged chunks never even come back from the vector store. Filtering at the query level, not after the fact, means the personal chunks aren't sitting in a variable somewhere waiting to be misused.

Defense in depth: the router gate and the retrieval filter are independent, and either one alone is sufficient. That's deliberate. A privacy leak isn't a bug you get to fix after it happens.

## Intake — writing back into the vault

The vault isn't read-only. Jarvis can write to it, but only into three specific subdirectories: `raw/intake/`, `voice-memos/`, and `jarvis-generated/`. Everything else is read-only, enforced at the bridge layer that mediates every brain interaction — code outside that bridge that constructs a path under the vault is, by definition, a bug.

The intake flow: I send Jarvis a message like "remember that I want to look into the new Anthropic batch API pricing later." The router classifies it as a brain intake. The path executor fills a template — strict frontmatter, all required sections present — and writes a new file into `raw/intake/` with a timestamped filename, then replies "filed." The write is atomic: it goes to a temp file, gets fsynced, and is renamed into place, so a crash mid-write can't leave a half-written note.

I review the intake folder periodically, move things into permanent locations in the wiki, delete what wasn't worth keeping. The point is to capture friction-free and sort later. Voice memos work the same way — recorded in Discord, transcribed by Whisper, filed with both the audio reference and the transcription.

## The smoke test

When I first turned RAG on against the real vault: 59 of 69 files indexed. The other 10 were known legacy frontmatter errors — malformed YAML that pre-dated when I tightened up my templates. The strict parser did exactly what it was supposed to: refused to index them rather than guessing.

The retrieval quality is what surprised me. Queries came back with real citations I could click through and verify. The paragraph-boundary chunking paid off — chunks read like coherent thoughts, not arbitrary 500-token windows.

## What I'd change

Two things.

**Re-embedding is too coupled to availability.** Incremental re-embeds are fast, but a full re-index — which I need if I bump the embedding model version — takes the index offline for a few minutes. I'd build a shadow index next time: embed into a new collection while the old one keeps serving, then switch atomically.

**The privacy tags are coarse.** The category tags cover most of what I need, but there's an edge case they don't: "this can go to Claude, but only with a one-time, per-message confirmation." Asking Claude for help with a complicated personal situation should be possible without permanently marking the note public. A per-message waiver flow would handle it.

Both are quality-of-life. The current design works for the way I actually use it, which is the only test that matters.
