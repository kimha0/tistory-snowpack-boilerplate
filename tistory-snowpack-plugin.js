const fs = require('fs').promises;
const parser = require('fast-xml-parser')

const options = {
  attributeNamePrefix: "@_",
  attrNodeName: "attr", //default is 'false'
  textNodeName: "#text",
  ignoreAttributes: true,
  ignoreNameSpace: false,
  allowBooleanAttributes: false,
  parseNodeValue: true,
  parseAttributeValue: false,
  trimValues: true,
  cdataTagName: "__cdata", //default is 'false'
  cdataPositionChar: "\\c",
  parseTrueNumberOnly: false,
  arrayMode: false, //"strict"
};

module.exports = function (snowpackConfig, pluginOptions) {
  return {
    name: 'tistory-snowpack-plugin',
    resolve: {
      input: ['.html'],
      output: ['.html']
    },
    tistoryOptions: {},
    tistoryVariables: {},

    async config(snowpackConfig) {
      {
        const xml = (await fs.readFile('src/index.xml')).toString()
        const isXML = parser.validate(xml)

        if (isXML) {
          this.tistoryOptions = parser.parse(xml, options)
        }
      }

      {
        const tistoryVariables = await fs.readFile('tistory.config.json')

        if (tistoryVariables) {
          this.tistoryVariables = JSON.parse(tistoryVariables)
        }
      }

    },
    async load({ filePath }) {
      const fileContents = await fs.readFile(filePath, 'utf-8');
      return fileContents
    },
    async transform({ id, contents, isDev, fileExt }) {

      if (fileExt === '.html') {
        const startTemplateRegexp = /<s_(\w+)>/g;
        const endTemplateRegexp = /<\/s_(\w+)>/g;

        const normalTemplateRegexp = /<(\/?)s_?(\w+)>/g;

        const ifStartTemplateRegexp = /<(\/?)s_(if|not)_?(\w+)>/g;
        const ifEndTemplateRegexp = /<\/s_(if|not)_?(\w+)>/g;

        const ifTemplateExp = /<\s*s_(if|not)_?(\w+)[^>]*>((.|\n)*?)<\s*\/\s*s_(if|not)_?(\w+)>/g;
        const ifTemplateHeaderExp = /<\s*s_(if|not)_?(\w+)[^>]*>/;

        const variableRegexp = /\[##_(\w+)_##]/g;

        let newContents = contents;

        {
          const ifTemplates = contents.match(ifTemplateExp)

          ifTemplates.forEach(template => {
            const [type, key] = template.match(ifTemplateHeaderExp)[0]
              .replace(/<s_(if|not)_((.|\n)*?)>/, '$1, $2')
              .split(',')


            if (type === 'if' && !this.tistoryVariables[key]) {
              newContents = newContents.replace(template, '')
            } else if (type === 'not' && this.tistoryVariables[key]) {
              newContents = newContents.replace(template, '')
            }
          })
        }

        {
          const templates = contents.match(normalTemplateRegexp)

          templates.forEach(template => {
            newContents = newContents.replace(template, '')
          })
        }

        {
          const variables = contents.match(variableRegexp)

          variables.forEach(variable => {
            const key = variable.replace(/\[##_(\w+)_##]/g, '$1')
            const values = this.tistoryVariables[key] || ""
            newContents = newContents.replace(variable, values)
          })
        }


        return newContents
      }
    }
  };
};
