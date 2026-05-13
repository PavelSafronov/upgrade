// Excerpt from Automattic/mongoose@fae374b1, test/aggregate.test.js lines 1194-1201
// Pinned at the last commit before the mongodb v6→v7 upgrade (Mongoose v9 merge).
// Triggers: cursor-implicit-batch-size (batchSize: 1000 on a cursor option)
'use strict';

const assert = require('assert');

it('is now a proper aggregate cursor vs what it was before gh-10410', function() {
  const MyModel = db.model('Test', { name: String });
  assert.throws(() => {
    MyModel.aggregate([]).cursor({ batchSize: 1000 }).exec();
  });
});
