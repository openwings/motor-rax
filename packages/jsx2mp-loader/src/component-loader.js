const { readJSONSync, writeJSONSync, writeFileSync, readFileSync, existsSync, mkdirpSync } = require('fs-extra');
const { relative, join, dirname, sep } = require('path');
const compiler = require('jsx-compiler');
const { getOptions } = require('loader-utils');

const cached = require('./cached');
const { removeExt } = require('./utils/pathHelper');


const ComponentLoader = __filename;

module.exports = function componentLoader(content) {
  const loaderOptions = getOptions(this);
  const { platform, entryPath, constantDir } = loaderOptions;
  const rawContent = readFileSync(this.resourcePath, 'utf-8');
  const resourcePath = this.resourcePath;
  const rootContext = this.rootContext;

  const outputPath = this._compiler.outputPath;
  const sourcePath = join(this.rootContext, dirname(entryPath));
  const relativeSourcePath = relative(sourcePath, this.resourcePath);
  const targetFilePath = join(outputPath, relativeSourcePath);
  const distFileWithoutExt = removeExt(join(outputPath, relativeSourcePath));

  const isFromConstantDir = cached(function isFromConstantDir(dir) {
    return constantDir.some(singleDir => isChildOf(singleDir, dir));
  });

  if (isFromConstantDir(this.resourcePath)) {
    return '';
  }

  const compilerOptions = Object.assign({}, compiler.baseOptions, {
    resourcePath: this.resourcePath,
    outputPath,
    sourcePath,
    type: 'component',
    platform
  });

  const transformed = compiler(rawContent, compilerOptions);

  const config = Object.assign({}, transformed.config);
  if (Array.isArray(transformed.dependencies)) {
    transformed.dependencies.forEach(dep => {
      this.addDependency(dep);
    });
  }
  if (config.usingComponents) {
    const usingComponents = {};
    Object.keys(config.usingComponents).forEach(key => {
      const value = config.usingComponents[key];

      if (/^c-/.test(key)) {
        let result = './' + relative(dirname(this.resourcePath), value); // ./components/Repo.jsx
        result = removeExt(result); // ./components/Repo

        usingComponents[key] = result;
      } else {
        usingComponents[key] = value;
      }
    });
    config.usingComponents = usingComponents;
  }

  const distFileDir = dirname(distFileWithoutExt);
  if (!existsSync(distFileDir)) mkdirpSync(distFileDir);
  // Write code
  writeFileSync(distFileWithoutExt + '.js', transformed.code);
  // Write template
  writeFileSync(distFileWithoutExt + platform.extension.xml, transformed.template);
  // Write config
  writeJSONSync(distFileWithoutExt + '.json', config, { spaces: 2 });
  // Write acss style
  if (transformed.style) {
    writeFileSync(distFileWithoutExt + platform.extension.css, transformed.style);
  }
  // Write extra assets
  if (transformed.assets) {
    Object.keys(transformed.assets).forEach((asset) => {
      const content = transformed.assets[asset];
      const assetDirectory = dirname(join(outputPath, asset));
      if (!existsSync(assetDirectory)) mkdirpSync(assetDirectory);
      writeFileSync(join(outputPath, asset), content);
    });
  }

  function isCustomComponent(name, usingComponents = {}) {
    const matchingPath = join(dirname(resourcePath), name);
    for (let key in usingComponents) {
      if (
        usingComponents.hasOwnProperty(key)
        && usingComponents[key]
        && usingComponents[key].indexOf(matchingPath) === 0
      ) {
        return true;
      }
    }
    return false;
  }

  const denpendencies = [];
  Object.keys(transformed.imported).forEach(name => {
    if (isCustomComponent(name, transformed.usingComponents)) {
      denpendencies.push({ name, loader: ComponentLoader, options: { entryPath: loaderOptions.entryPath, platform: loaderOptions.platform, constantDir: loaderOptions.constantDir } });
    } else {
      denpendencies.push({ name });
    }
  });

  return [
    `/* Generated by JSX2MP ComponentLoader, sourceFile: ${this.resourcePath}. */`,
    generateDependencies(denpendencies),
  ].join('\n');
};

function generateDependencies(dependencies) {
  return dependencies
    .map(({ name, loader, options }) => {
      let mod = name;
      if (loader) mod = loader + '?' + JSON.stringify(options) + '!' + mod;
      return createImportStatement(mod);
    })
    .join('\n');
}

function createImportStatement(req) {
  return `import '${req}';`;
}

/**
 * judge whether the child dir is part of parent dir
 * @param {string} child
 * @param {string} parent
 */
function isChildOf(child, parent) {
  const childArray = child.split(sep).filter(i => i.length);
  const parentArray = parent.split(sep).filter(i => i.length);
  const clen = childArray.length;
  const plen = parentArray.length;

  let j = 0;
  for (let i = 0; i < plen; i++) {
    if (parentArray[i] === childArray[j]) {
      j++;
    }
    if (j === clen) {
      return true;
    }
  }
  return false;
}