'use strict';

const { GraphQLString }                       = require('graphql');
const { DirectiveLocation, GraphQLDirective } = require('graphql/type/directives');
const _get                                    = require('lodash/get');
const showdown                                = require('showdown');
const sanitizeHtml                            = require('sanitize-html');

const NOTHING = {};

// NOTE: Currently supports stirng fields only and unit tests are not here yet
class CFGraphQLDirective extends GraphQLDirective {
  constructor(args) {
    super(args);
    this.resolve = args.resolve;
  }
}

const MarkdownToHtmlDirective = new CFGraphQLDirective({
  name: 'mdToHtml',
  description:
    'Converts markdown to html',
  locations: [
    DirectiveLocation.FIELD,
  ],
  args: {
  },
  resolve: (resolve, source, args, context, info) => {
    return resolve().then(result => {
      const showdownConverter = new showdown.Converter();
      const convertedHtml = showdownConverter.makeHtml(result);
      const sanitisedHtml = sanitizeHtml(convertedHtml);
      return sanitisedHtml;
    });
  }
});

const ToUpperCaseDirective = new CFGraphQLDirective({
  name: 'toUpperCase',
  description:
    'Converts characters in a string to upper case.',
  locations: [
    DirectiveLocation.FIELD,
  ],
  args: {
  },
  resolve: (resolve, source, args, context, info) => {
    return resolve().then(result => result.toUpperCase());
  }
});

// Make sure to add your directive here
const serverDirectives = [MarkdownToHtmlDirective, ToUpperCaseDirective];

const resolveWithDirectives = (Type, field, resolveFn, source, args, context, info) => {

  const directives       = _get(info, 'fieldNodes[0].directives', []);
  const fieldValue       = _get(source, ['fields', field.id], NOTHING);
  let directiveResolvers = [];

  // Find all the directives that we need to resolve for that field
  directives.forEach((directive) => {
    const directiveName = _get(directive, 'name.value');
    serverDirectives.forEach(serverDirective => {
      if(directiveName === serverDirective.name && Type === GraphQLString) {
        directiveResolvers.push(serverDirective.resolve);
      }
    });

  });

  // Resolve the default resolver before running through the directive resolvers
  let defer;
  if(resolveFn) {
    defer = Promise.resolve(resolveFn(fieldValue, context));
  }  else {
    defer = Promise.resolve(fieldValue);
  }

  directiveResolvers.forEach(directiveResolver => {
    defer = defer.then(result => {
      return directiveResolver(() => Promise.resolve(result), source, args, context, info);
    });
  });

  return defer;
};

module.exports = {
  directives : serverDirectives,
  resolveWithDirectives
};