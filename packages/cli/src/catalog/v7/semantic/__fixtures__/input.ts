import { MongoClient } from 'mongodb';

// aws-explicit-credentials
const client1 = new MongoClient('mongodb://AKID:SECRET@host/?authMechanism=MONGODB-AWS');

// mongodb-cr-auth
const client2 = new MongoClient(uri, { authMechanism: 'MONGODB-CR' });

// client-metadata-props
console.log(client.options.additionalDriverInfo);

// cursor-implicit-batch-size
const cursor = collection.find({}, { batchSize: 1000 });
