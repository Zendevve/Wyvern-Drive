# Wyvern Drive

Encrypted-drive development vaults and their metadata hierarchy, before any storage backend exists.

## Language

**Vault**:
A named namespace owning one entry tree.
_Avoid_: Drive, local vault (standalone)

**Metadata-only vault**:
A vault with no storage backend, used for Phase 1 development (`backend_type='local-test'`, `state='metadata_only'`).
_Avoid_: Local vault, test vault
