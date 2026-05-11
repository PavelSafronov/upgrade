import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  const cursor = client.db('test').collection('docs').find({});

  const stream1 = cursor.stream({ transform: JSON.stringify });
  const stream2 = cursor.stream({ transform: (doc) => doc.name });
}
