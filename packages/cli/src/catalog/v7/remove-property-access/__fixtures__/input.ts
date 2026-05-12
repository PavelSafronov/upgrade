import { ReadPreference, ClientSession } from 'mongodb';

const ver = ReadPreference.minWireVersion;
const txn = session.transaction;
