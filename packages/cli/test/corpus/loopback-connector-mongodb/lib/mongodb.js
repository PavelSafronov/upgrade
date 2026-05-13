// Excerpt from loopbackio/loopback-connector-mongodb@HEAD, lib/mongodb.js lines 1655-1705
// Triggers: findoneand-metadata (findOneAndUpdate without includeResultMetadata)
'use strict';

const util = require('util');
const debug = require('debug')('loopback:connector:mongodb');

function fieldsArrayToObj(fields) { return fields || null; }

MongoDB.prototype.findOrCreate = function findOrCreate(model, filter, data, options, callback) {
  const self = this;
  const modelName = model;
  const idName = self.idName(modelName);

  filter = filter || {};
  let query = {};
  if (filter.where) {
    if (filter.where[idName]) {
      let id = filter.where[idName];
      delete filter.where[idName];
      id = self.coerceId(modelName, id, options);
      filter.where._id = id;
    }
    query = self.buildWhere(modelName, filter.where, options);
  }

  const sort = self.buildSort(modelName, filter.order, options);

  const projection = fieldsArrayToObj(filter.fields);

  const callbackFindOneAndUpdate = util.callbackify(() => this.collection(modelName).findOneAndUpdate(
    query,
    {$setOnInsert: data},
    {projection: projection, sort: sort, upsert: true},
  ));

  callbackFindOneAndUpdate(
    function(err, result) {
      if (self.debug) {
        debug('findOrCreate.callback', modelName, filter, err, result);
      }
      if (err) {
        return callback(err);
      }

      let value = result.value;
      const created = !!result.lastErrorObject.upserted;

      if (created && (value == null || Object.keys(value).length === 0)) {
        value = data;
        self.setIdValue(modelName, value, result.lastErrorObject.upserted);
      } else {
        value = self.fromDatabase(modelName, value);
        self.setIdValue(modelName, value, value._id);
      }
      callback(null, value, created);
    },
  );
};
