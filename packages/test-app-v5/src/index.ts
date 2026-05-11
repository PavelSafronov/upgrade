// Phase 2: populate with v5→v6 deprecated APIs.
// Patterns to add:
//   - db.addUser() / admin.addUser() (removed in v6)
//   - collection.stats() (removed in v6)
//   - BulkWriteResult.nInserted / nUpserted / nMatched / nModified / nRemoved (removed in v6)
//   - sslCA / sslCRL / sslCert / sslKey / sslPass / sslValidate / tlsCertificateFile (removed in v6)
//   - keepAlive / keepAliveInitialDelay options (removed in v6)
//   - findOneAndUpdate / findOneAndReplace / findOneAndDelete without includeResultMetadata (behavior change)
//   - withTransaction return value usage (behavior change)

export {};
