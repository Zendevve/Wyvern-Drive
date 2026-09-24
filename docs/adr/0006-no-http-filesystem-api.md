# No HTTP filesystem API in this milestone

The desktop reaches metadata operations exclusively through Wails bindings on the shared Go service; `wyvernd` exposes only `GET /api/v1/health`. No browser fetch adapter exists, and a plain browser shows a disabled message. Building an unauthenticated HTTP surface for UI convenience now would make Phase 9 authentication retrofit around a load-bearing API.
