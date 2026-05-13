import { MongoClient, FindOneOptions } from 'mongodb';

const opts: FindOneOptions = {
  limit: 5,
  projection: { name: 1 }
};
