// Phase 2: populate with v4→v5 deprecated APIs.
// Patterns to add:
//   - Callback-based API (removed in v5 — the big one)
//   - Collection.insert / Collection.update / Collection.remove (removed in v5)
//   - Collection.mapReduce() (removed in v5)
//   - ObjectID (renamed to ObjectId in v5)
//   - slaveOk options
//   - Custom Promise library support (removed in v5)
//   - BulkWriteOptions.keepGoing (removed in v5)

export {};
