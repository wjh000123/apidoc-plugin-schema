function exists(keys, key) {
  return keys.indexOf(key) !== -1;
}

function formatType(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// TODO change / to |, requires core fix to allow `Empty parser result.`
// https://github.com/apidoc/apidoc-core/blob/master/lib/parsers/api_param.js
function makeType(param) {
  // console.log('makeType',param);
  param = Array.isArray(param) ? param[0] : param;
  const strarr = [];
  if (param.format) {
    strarr.push(formatType(param.format));
    if (Array.isArray(param.type) && param.type.indexOf('null') !== -1) {
      strarr.push('Null');
    }
    return strarr.join('/');
  }
  let str = '';
  if (Array.isArray(param.type)) {
    param.type.map((type) => {
      str = type;
      if (str === 'array') {
        str = `${makeType(param.items)}[]`;
      }
      strarr.push(formatType(str));
    });
    return strarr.join('/');
  } else if (param.type) {
    str = param.type;
    if (str === 'array') {
      str = `${makeType(param.items)}[]`;
    }
    return formatType(str);
  }

  return 'Unknown';
}

function makeSize(param) {
  if (param.type === 'array') { param = param.items; }

  const keys = Object.keys(param);
  let str = '';

  if (param.type === 'string' && (exists(keys, 'minLength') || exists(keys, 'maxLength'))) {
    if (exists(keys, 'minLength') && exists(keys, 'maxLength') && param.minLength === param.maxLength) {
      return `{${param.minLength}}`;
    }

    str = '{';
    if (exists(keys, 'minLength')) {
      str += param.minLength;
    }
    str += '..';
    if (exists(keys, 'maxLength')) {
      str += param.maxLength;
    }
    str += '}';
  } else if ((param.type === 'integer' || param.type === 'number') && (exists(keys, 'minimum') || exists(keys, 'maximum'))) {
    if (exists(keys, 'minimum') && exists(keys, 'maximum') && param.minimum === param.maximum) {
      return `{${param.minimum}}`;
    }

    str = '{';
    if (exists(keys, 'minimum')) {
      str += param.minimum;
    } else {
      str += '-∞';
    }
    str += ' - ';
    if (exists(keys, 'maximum')) {
      str += param.maximum;
    } else {
      str += '∞';
    }
    str += '}';
  }

  return str;
}

function makeAllowedValues(param) {
  if (param.type === 'array') { param = param.items; }

  // convert null,true,false to string, add quotes to strings
  if (!Array.isArray(param.enum)) { return ''; }

  const values = [];
  param.enum = param.enum.map((item) => {
    if (typeof item === 'string') {
      values.push(`"${item}"`); // ensures values with spaces render properly
    } else if (typeof item === 'number') {
      values.push(item);
    } else if (item === null) {
      // required to be at beginning
      values.unshift('null');
    } else if (item === true) {
      // required to be at beginning
      values.unshift('true');
    } else if (item === false) {
      // required to be at beginning
      values.unshift('false');
    }
    return item;
  });

  return `=${values.join(',')}`;
}

function isRequired(schema, key) {
  if (schema.type === 'array') { schema = schema.items; }

  // TODO figure out way to display when anyOf, oneOf
  return (exists(Object.keys(schema), 'required') && (schema.required.indexOf(key) !== -1))
    || (exists(Object.keys(schema.properties), key) && schema.properties[key].required);
}


function traverse(schema, p, group) {
  const params = {};

  p = p || '';


  let properties = {};
  // schema = mergeAllOf(schema);
  if (schema.type === 'object') {
    properties = schema.properties;
  } else if (schema.type === 'array' && !schema.items) { // catch errors
    throw SyntaxError('ERROR: schema array missing items');
  } else if (schema.type === 'array' && schema.items.type === 'object') {
    // schema.items = mergeAllOf(schema.items);
    properties = schema.items.properties;
  }

  // console.log('properties',properties);

  for (let key in properties) {
    if (!properties.hasOwnProperty(key)) { continue; }
    const param = properties[key];
    // console.log('param',param);
    if (!param) { continue; }

    const type = makeType(param);
    const size = makeSize(param);
    const allowedValues = makeAllowedValues(param);

    let description = param.description;
    if (param.type === 'array') {
      description += ` ${param.items.description}`;
    }

    // make field
    const parent = p ? `${p}.` : '';
    let field = parent + key;

    if (exists(Object.keys(param), 'default')) {
      if (typeof param.default === 'object') {
        field += `='${JSON.stringify(param.default)}'`;
      } else {
        field += `=${param.default}`;
      }
    }

    if (!isRequired(schema, key)) {
      field = `[${field}]`;
    }

    if (p) key = `${p}.${key}`;
    const g = group ? `(${group}) ` : '';
    // make group
    params[key] = `${g}{${type}${size}${allowedValues}} ${field} ${description}`;
    // console.log(parent+key, params[parent + key])
    let subs = {};
    // var subgroup = p ? p+'.' : ''; // TODO apidoc - groups cannot have `.` in them
    if (param.type === 'array' && param.items.type === 'object') {
      subs = traverse(param.items, key, group); // subgroup+
    } else if (param.type === 'object') {
      subs = traverse(param, key, group); // subgroup+
    }
    for (const subKey in subs) {
      if (!subs.hasOwnProperty(subKey)) { continue; }
      params[`${key}.${subKey}`] = subs[subKey];
    }
  }

  return params;
}

const $RefParser = require('json-schema-ref-parser');

function build(relativePath, data, element, group) {
  data = JSON.parse(data);

  // run sync - https://github.com/BigstickCarpet/json-schema-ref-parser/issues/14
  let elements = [],
    done = false;
  $RefParser.dereference(relativePath, data, {}, (err, schema) => {
    if (err) {
      console.error(err);
      done = true;
      return;
    }
    const lines = traverse(schema, null, group);
    for (const l in lines) {
      if (!lines.hasOwnProperty(l)) { continue; }

      const res = {
        source: `@${element} ${lines[l]}\n`,
        name: element.toLowerCase(),
        sourceName: element,
        content: `${lines[l]}\n`
      };
      elements.push(res);
    }
    done = true;
  });
  require('deasync').loopWhile(() => !done);
  // console.log('generated', elements);
  return elements;
}

module.exports = build;
