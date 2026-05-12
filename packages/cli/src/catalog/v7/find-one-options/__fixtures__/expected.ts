import { MongoClient, FindOneOptions } from 'mongodb';

const opts: FindOneOptions = {
  projection: { name: 1 }
};
