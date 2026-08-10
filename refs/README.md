# Vendored reference projects

Prior-art repositories vendored here for study. Each was shallow-cloned at the
commit listed; upstream URLs and SHAs are recorded for provenance. The original
Disbox packages (disbox-web, disbox-server, disbox-extension) are the primary
reference for Wyvern Drive; the others are similar Discord-cloud-storage
projects added during design research.

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

None of these are modified by Wyvern Drive; they are read-only reference
material. To refresh one: `git clone <upstream> refs/<dir>` and re-record the
new HEAD here.
