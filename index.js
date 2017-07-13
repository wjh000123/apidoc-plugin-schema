const fs = require('fs');
const path = require('path');

const elementParser = require('./parser/api_schema');
const jsonschema = require('./schema/jsonschema');

const schemas = {
  jsonschema
};

let app = {};

module.exports = {
  init(_app) {
    app = _app;
    app.addHook('parser-find-elements', parserSchemaElements, 200);
  }
};

function parserSchemaElements(elements, element, block, filename) {
  if (element.name !== 'apischema') { return elements; }
  elements.pop();

  const values = elementParser.parse(element.content, element.source);
  app.log.debug('apischema.path', values.path);
  if (schemas[values.schema]) {
    const relativePath = path.join(path.dirname(filename), values.path);
    const data = fs.readFileSync(relativePath, 'utf8').toString();
    const newElements = schemas[values.schema](relativePath, data, values.element, values.group);

    // do not use concat
    for (let i = 0, l = newElements.length; i < l; i++) {
      elements.push(newElements[i]);
    }
  }
  return elements;
}
