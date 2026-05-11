import { MongoClient } from 'mongodb';

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
});

db.command({ ping: 1 }, { noResponse: false, comment: 'health' });
