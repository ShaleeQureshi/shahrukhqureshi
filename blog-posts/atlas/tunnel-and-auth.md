---
title: Tunneling and auth for a one-person app
date: 2026-05-10
---

Atlas runs on a Mac Studio in my apartment. I want to use it from my phone on the subway, my laptop at a coffee shop, and occasionally from a friend's machine when mine is dead.

The naive approach is "open port 443 on my router and run a server." That's a security disaster. The slightly less naive approach is "set up a VPN." That works for me but is friction every time I want a new device on. The actual answer is Cloudflare Tunnel plus an auth gate.

This post is about both — what they do, what they cost, and why they're overkill in a way I'm fine with.

## Cloudflare Tunnel

Cloudflare Tunnel is a daemon that runs on the Mac. It establishes an outbound connection to Cloudflare's edge, and Cloudflare serves a public hostname that routes traffic back through the tunnel to my local service.

What this gets me:

- A public URL on a domain I own — say `atlas.quantyx.ca` — with a real TLS cert
- No open inbound ports on my router
- No public IP exposure
- Cloudflare's DDoS protection in front of the app
- Logs of every request hitting the tunnel

What it costs me:

- $0/month. The free tier covers this entirely.
- Setup time, about 20 minutes the first time, including the DNS records.

The thing I underestimated was how much I'd appreciate having Cloudflare in front of the app. The free tier includes WAF rules, bot detection, and rate limiting. For a personal app this is overkill. For a personal app that I'm definitely going to forget to harden myself, it's exactly right.

## Why not just Tailscale

Tailscale is the other obvious choice. It's a mesh VPN — every device I want to use is on a private network, and Atlas listens only on that network. No public URL, no Cloudflare, no auth gate needed.

I use Tailscale for some things (SSH'ing into the Mac, hitting Jarvis's internal endpoints). I didn't use it for Atlas because:

- **Friends' machines.** Sometimes I want to show someone what I built. Installing Tailscale on their laptop is a lot to ask.
- **Phones in weird states.** When my phone is acting up, the absolute last thing I want to debug is a VPN daemon. A public URL just works.
- **Browser-only contexts.** Sometimes I'm in a browser-only context — a hotel TV, a borrowed iPad. Tailscale doesn't help.

The cost of a public URL is having to take auth seriously. Which I was going to do anyway.

## Supabase auth

Auth for a one-user app is, objectively, overkill. I could hard-code an HTTP basic auth password and call it done.

I didn't, for three reasons.

**Password leaks happen.** If I ever shoulder-surf myself typing a hardcoded password on someone's machine, I'm rotating it everywhere. Email magic links can be revoked without rotating anything.

**Sessions across devices.** I want to log in on my phone and stay logged in for weeks. Implementing remember-me correctly is annoying. Supabase does it.

**Future-proofing.** If I ever want to share specific conversations with someone — read-only links to a thread — Supabase's row-level security gives me the primitives for free. Building that from scratch with a bare auth scheme means redoing half this work.

The Supabase config for Atlas is the most boring thing in the world:

- Email magic links only (no password)
- One row in the auth table — me
- An RLS policy on the conversation tables: `user_id = auth.uid()`
- A `@supabase/ssr` integration on the Next.js side that gates every page

Cost: $0/month on the free tier. Free tier covers way more than a single-user app could ever use.

## The middle layer

Between Cloudflare Tunnel and Supabase auth there's a middle layer that does the boring work of refusing requests that don't belong.

Every API route in the Next.js backend starts with the same check:

```javascript
const supabase = createServerClient(...)
const { data: { user } } = await supabase.auth.getUser()
if (!user) return new Response('Unauthorized', { status: 401 })
```

The FastAPI sidecar — which Next.js proxies to for model work — only listens on localhost. It has no auth of its own because nothing external can reach it. Defense in depth: the public surface has auth, the private surface is private by network topology.

The one piece I'd flag: the Cloudflare Tunnel sees the auth cookies in transit. They're TLS-encrypted, and Cloudflare's privacy posture is fine for my threat model, but if I were a higher-risk user I'd be uncomfortable with this. For my use it's irrelevant.

## What I'd tell someone setting this up

Three things took longer than they should have.

**The DNS records are weirdly fiddly.** Cloudflare Tunnel uses a CNAME pointing at a tunnel-specific hostname. Setting up the DNS, the tunnel routing rules, and the Next.js hostname expectations all need to agree. Took 30 minutes of "why does it say bad gateway."

**Next.js with Supabase SSR has gotchas.** The `@supabase/ssr` package is the current recommendation. Old tutorials use `@supabase/auth-helpers-nextjs`, which is deprecated. Cookie handling is the part that breaks if you mix versions.

**Local dev doesn't go through the tunnel.** Obvious in retrospect — when I run `npm run dev`, I'm hitting localhost, not the tunnel. But the first time I set up auth, I was confused why the local cookies weren't matching what production expected. Different hostnames mean different cookie scopes. Fix is to use the same domain for dev (e.g., `dev.atlas.quantyx.ca` routed to localhost via `/etc/hosts`).

For a one-user app, this whole setup is ridiculous. For a one-user app that I actually want to *use*, daily, from anywhere, it's the cheapest path to "works without thinking about it."

The whole stack — Cloudflare Tunnel, Supabase, the Next.js auth glue — costs me $0/month and about 2 hours of setup time. Whatever ChatGPT charges per month, I'm saving that, on a more flexible system, with my own models, against my own data.

That's the pitch of self-hosting in 2026. The infrastructure for "personal cloud" is finally mature enough that a weekend project can match a paid SaaS for the workflows that matter to you. The catch is you have to actually do the weekend project.
