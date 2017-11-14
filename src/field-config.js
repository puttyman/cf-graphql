'use strict';

const _get = require('lodash.get');

const {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLList
} = require('graphql');

const {AssetType, EntryType, LocationType} = require('./base-types.js');
const { resolveWithDirectives } = require('./directives');

const NOTHING = {};

const is = type => entity => typeof entity === type;
const isString = is('string');
const isObject = is('object');

module.exports = {
  String: field => createFieldConfig(GraphQLString, field),
  Int: field => createFieldConfig(GraphQLInt, field),
  Float: field => createFieldConfig(GraphQLFloat, field),
  Bool: field => createFieldConfig(GraphQLBoolean, field),
  Location: field => createFieldConfig(LocationType, field),
  Object: createObjectFieldConfig,
  'Array<String>': createArrayOfStringsFieldConfig,
  'Link<Asset>': createAssetFieldConfig,
  'Array<Link<Asset>>': createArrayOfAssetsFieldConfig,
  'Link<Entry>': createEntryFieldConfig,
  'Array<Link<Entry>>': createArrayOfEntriesFieldConfig
};

function createFieldConfig (Type, field, resolveFn) {
  return {
    type: Type, resolve: (source, args, context, info) => {
      const fieldValue   = _get(source, ['fields', field.id], NOTHING);
      const directives   = _get(info, 'fieldNodes[0].directives', []);

      if(fieldValue === NOTHING) {
        return;
      }

      if (directives.length) {
        return resolveWithDirectives(Type, field, resolveFn, source, args, context, info);
      }

      return resolveFn ? resolveFn(fieldValue, context) : fieldValue;
    }
  };
}

function createObjectFieldConfig (field) {
  return createFieldConfig(GraphQLString, field, val => JSON.stringify(val));
}

function createArrayOfStringsFieldConfig (field) {
  return createFieldConfig(new GraphQLList(GraphQLString), field);
}

function createAssetFieldConfig (field) {
  return createFieldConfig(AssetType, field, getAsset);
}

function createArrayOfAssetsFieldConfig (field) {
  return createFieldConfig(new GraphQLList(AssetType), field, (links, ctx) => {
    if (Array.isArray(links)) {
      return links.map(link => getAsset(link, ctx)).filter(isObject);
    }
  });
}

function getAsset (link, ctx) {
  const linkedId = getLinkedId(link);
  if (isString(linkedId)) {
    return ctx.entryLoader.getIncludedAsset(linkedId);
  }
}

function createEntryFieldConfig (field, ctIdToType) {
  return createFieldConfig(typeFor(field, ctIdToType), field, (link, ctx) => {
    const linkedId = getLinkedId(link);
    if (isString(linkedId)) {
      return ctx.entryLoader.get(linkedId, field.linkedCt);
    }
  });
}

function createArrayOfEntriesFieldConfig (field, ctIdToType) {
  const Type = new GraphQLList(typeFor(field, ctIdToType));

  return createFieldConfig(Type, field, (links, ctx) => {
    if (Array.isArray(links)) {
      const ids = links.map(getLinkedId).filter(isString);
      return ctx.entryLoader.getMany(ids).then(coll => coll.filter(isObject));
    }
  });
}

function getLinkedId (link) {
  return _get(link, ['sys', 'id']);
}

function typeFor ({linkedCt}, ctIdToType = {}) {
  if (linkedCt) {
    return ctIdToType[linkedCt] || EntryType;
  } else {
    return EntryType;
  }
}
