const trim = require('trim');

function parse(content) {
  content = trim(content);

  if (content.length === 0) { return null; }

  // @apiSchema (optional group) {jsonschema=relative_path} additional_argument
  const parseRegExp = /^(?:\((.+?)\)){0,1}\s*\{(.+?)=(.+?)\}\s*(?:(.+))?/g;
  const matches = parseRegExp.exec(content);

  if (!matches) { return null; }

  return {
    group: matches[1],
    schema: matches[2],
    path: matches[3],
    element: matches[4] || 'apiParam'
  };
}

/**
 * Exports
 */
module.exports = {
  parse,
  path: 'local',
  method: 'push',
  preventGlobal: true
};
