// @flow

// Flow-specific type syntax — fails tsx parser, requires the flow parser path
type QueryType = { [string]: mixed };
type NullableString = ?string;

const { MongoClient } = require('mongodb');

async function find(collection, query) {
  return collection.find(query, { batchSize: 1000 }).toArray();
}
