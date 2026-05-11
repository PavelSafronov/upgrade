import { MongoClient } from 'mongodb';

const client = new MongoClient(uri, {
  maxPoolSize: 10
});

db.command({ ping: 1 }, {
  comment: 'health'
});
