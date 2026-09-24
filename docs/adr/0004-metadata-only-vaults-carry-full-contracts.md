# Metadata-only vaults carry full durable contracts

Phase 1 vaults have no storage backend (`backend_type='local-test'`, `state='metadata_only'`) with a mandatory UI banner, yet the file/chunk/job tables ship with their full column contracts now. No fake upload/download operations and no pretend encryption keys: the tables pin what Phase 3 transfers must honor instead of simulating behavior that doesn't exist.
