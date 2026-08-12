# Vendored reference projects

Prior-art repositories vendored here for study. Each was shallow-cloned at the
commit listed; upstream URLs and SHAs are recorded for provenance. The original
Disbox packages (disbox-web, disbox-server, disbox-extension) are the primary
reference for Wyvern Drive; the other Discord-cloud-storage projects were added
during design research. `ddrive`, `dsfs`, `discord-cdn-proxy`, `gcsfuse`,
`s3fs-fuse`, and `agent-fs` are architecture references vendored for the
2026-08 reference study (large-file handling, FUSE/object-store semantics,
caching, CDN URL refresh, sync/search).

| Directory | Upstream | Vendored commit |
|---|---|---|
| disbox-web | https://github.com/DisboxApp/web | 6efbc7f7c04c |
| disbox-server | https://github.com/DisboxApp/server | a4e7d067b997 |
| disbox-extension | https://github.com/DisboxApp/extension | da8b8db7094e |
| D-Drive | https://github.com/jasonzli-DEV/D-Drive | 86db7c5def71 |
| discord-drive | https://github.com/expiracy/discord-drive | a667d2baa029 |
| discord-cloud-storage | https://github.com/Sebastian-Webster/discord-cloud-storage | 2aef471f3291 |
| DiscordFS-GiacoBot | https://github.com/GiacoBot/DiscordFS | 48a4ec8c5895 |
| DiscordFS-Ryokau | https://github.com/Ryokau/DiscordFS | d89ee0619023 |
| ddrive | https://github.com/forscht/ddrive | e558f229712f28f0cff2cca7cb4c18b471dd04e0 |
| dsfs | https://github.com/darenliang/dsfs | 201bac4812170a0774facbf3cac1191cea5869b7 |
| discord-cdn-proxy | https://github.com/useapi/discord-cdn-proxy | 6b9744efdb8509388ca871c832a2ea7d3c9dc1b2 |
| gcsfuse | https://github.com/GoogleCloudPlatform/gcsfuse | 32f9546a24d1c2d87bbc03402b2104cf109cd51b |
| s3fs-fuse | https://github.com/s3fs-fuse/s3fs-fuse | 8627662250157080ce010f5d0480788c4e158900 |
| agent-fs | https://github.com/desplega-ai/agent-fs | 5900e205bd0b7db3127d31ed583935ae4f34c681 |

None of these are modified by Wyvern Drive; they are read-only reference
material. To refresh one: `git clone <upstream> refs/<dir>` and re-record the
new HEAD here.
