const fs = require('fs');
const path = require('path');
const pathToRegexp = require('path-to-regexp');

const getPagesConfig = (appConfig, pathConfig) => {
  const pagesConfig = {};
  const customePageConfig = appConfig.pages || {};
  fs.readdirSync(path.join(pathConfig.appSrc, 'pages')).map((file) => {
    if (fs.statSync(path.join(pathConfig.appSrc, 'pages', file)).isDirectory()) {
      pagesConfig[file] = { path: `/${file}`, ...customePageConfig[file] };
      pagesConfig[file]._regexp = pathToRegexp(pagesConfig[file].path).toString()
    }
  });
  return pagesConfig;
}

module.exports = getPagesConfig