# Spike Manifest

## Idea
Analyze Disbox (web, server, extension) and discloud repositories to extract design patterns, mechanisms, and architectures for Discord-based cloud storage, particularly around chunking, rate limiting, metadata management, and Discord CDN link expiration.

## Requirements
- **Folder and Metadata Reference Design**: Store file and folder structures as flat, indexed relational tables in IndexedDB (parent ID relationships) rather than nested ID arrays to avoid out-of-sync directory trees.
- **CORS Bypass Solution**: Document or implement client-side mechanisms (e.g. extension or helper proxy) to allow direct AJAX blob fetching of Discord attachment URLs, bypassing browser CORS restrictions.
- **Concurrency-Aware Rate Limiting**: Refactor the client's `RateLimiter` to support configurable concurrency (e.g. parallel requests) rather than serializing all API tasks.
- **Milisecond-Safe Backoff**: Always convert `retry_after` headers (which Discord returns in seconds) to milliseconds before sleeping to avoid cascading rate-limit errors.
- **Message-ID Driven URL Refreshing**: Retrieve fresh attachment URLs dynamically from the webhook API via Discord `messageId`s when cached CDN URLs approach their 24-hour expiration.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | competitor-architecture-metadata | standard | Given Disbox and Discloud, when analyzed for metadata persistence, then how do they manage folder systems and file listings? | VALIDATED | architecture, metadata |
| 002 | competitor-chunking-rate-limiting | standard | Given Disbox and Discloud, when analyzed for upload mechanics, then how do they chunk files and handle Discord webhook rate limits? | VALIDATED | chunking, uploads, rate-limits |
| 003 | competitor-cdn-link-expiry | standard | Given Discord's expiring CDN attachment URLs, when analyzed for file retrieval, then how do they refresh/resolve links? | VALIDATED | cdn, urls, resolution |
