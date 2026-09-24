# Explicit migrations with VACUUM INTO backups

Schema comes from immutable numbered SQL files (`NNNN_description.sql`), never inferred from Go structs. The runner enforces consecutive versions, SHA-256 checksums, and refuses newer-than-known databases. Before applying pending migrations to a nonempty database it takes a consistent snapshot via parameterized `VACUUM INTO`, never a plain file copy of a WAL database.
