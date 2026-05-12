import { MongoClient, FindOneOptions } from 'mongodb';

const opts: FindOneOptions = { batchSize: 10, limit: 5, noCursorTimeout: true, projection: { name: 1 } };
