'use strict';

const cfGraphql = require('.');
const {graphql} = require('graphql');

window.cfGraphql = function (spaceId, cdaToken) {
  const client = cfGraphql.createClient({spaceId, cdaToken});
  const ctx = () => ({entryLoader: client.createEntryLoader()});

  return query => {
    return client.getContentTypes()
    .then(cfGraphql.prepareSpaceGraph)
    .then(cfGraphql.createSchema)
    .then(schema => graphql(schema, query, null, ctx()));
  };
};
