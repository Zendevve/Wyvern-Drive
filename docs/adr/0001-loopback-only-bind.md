# Loopback-only bind until authentication exists

`wyvernd` in this milestone serves only `GET /api/v1/health` with no authentication, so any non-loopback `--listen` address fails startup with `INVALID_CONFIG`. No override flag exists: a bypass flag committed now would become the load-bearing exposure path later phases must retrofit auth around.
