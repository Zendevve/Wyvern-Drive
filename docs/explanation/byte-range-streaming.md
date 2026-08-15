# Byte-Range Media Streaming Architecture

This document explains how Wyvern Drive enables instant video seeking, audio streaming, and partial file reads directly from distributed Discord chunk attachments without downloading the entire file first.

---

## 1. The Challenge of Chunked Media Streaming

In traditional cloud storage architectures, files stored as distinct multi-part slices require full assembly on disk before media players (like HTML5 `<video>` or VLC) can play them. For a 4GB movie or 500MB video, requiring a 100% download before playback begins creates an unacceptable user experience.

Wyvern Drive solves this using an **Embedded HTTP Streaming Server (`pkg/server`)** paired with a **Virtual Range Engine (`pkg/engine`)**.

---

## 2. The HTTP Range Request Lifecycle

When an in-app HTML5 video player requests a file:

```
[ HTML5 Video Player ]
          │
          │ 1. GET /api/stream/file-123
          │    Range: bytes=37748736-41943040  (Seek to minute 14:20)
          ▼
[ Wyvern Local Server (127.0.0.1:49152) ]
          │
          │ 2. Engine.ReadRange(ctx, "file-123", 37748736, 41943040)
          ▼
[ Storage Engine ]
          │
          │ 3. Compute Chunk Overlap:
          │    - Chunk #2 (Bytes 37,748,736 - 56,623,103) Intersects!
          │
          │ 4. Fetch Chunk #2 from Discord CDN Attachment URL
          │ 5. AES-256-GCM Decrypt Chunk #2 in memory
          │ 6. Slice exact sub-range [0 : 4,194,304]
          ▼
[ HTTP 206 Partial Content Response ]
Content-Range: bytes 37748736-41943040/94371840
Content-Length: 4194305
Content-Type: video/mp4
```

---

## 3. Chunk Intersection Mathematics

Given a requested byte range $[S_{req}, E_{req}]$, a file size $F$, and a uniform chunk size $C$ (e.g. 18,874,368 bytes):

$$\text{Start Chunk Index} = \left\lfloor \frac{S_{req}}{C} \right\rfloor$$

$$\text{End Chunk Index} = \left\lfloor \frac{E_{req}}{C} \right\rfloor$$

For each chunk $i \in [\text{Start Chunk Index}, \text{End Chunk Index}]$:
- Chunk Start Byte: $S_{chunk} = i \times C$
- Chunk End Byte: $E_{chunk} = S_{chunk} + \text{Len}(\text{Chunk}_i) - 1$
- Relative Slice Start: $\max(0, S_{req} - S_{chunk})$
- Relative Slice End: $\min(\text{Len}(\text{Chunk}_i) - 1, E_{req} - S_{chunk})$

Because chunk sizes are deterministic, seeking to any arbitrary timestamp in a video only requires downloading and decrypting 1 or 2 chunks (18MB–36MB), providing instantaneous seeking latency.
