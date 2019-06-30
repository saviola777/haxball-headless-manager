/**
 * Repository type handlers for the PluginLoader.
 *
 * Each repository handler has to accept an object as the first argument, which
 * contains repository parameters. The second argument is the plugin name to be
 * loaded.
 *
 * @module src/repositories
 */

module.exports = {
  github: githubRepositoryHandler,
  local: localRepositoryHandler,
  plain: plainRepositoryHandler,
};

/**
 * Plain repository handler.
 *
 * @alias module:src/repositories.plain
 * @param {string} [suffix] File name suffix, defaults to `.js`.
 * @param {string} url Base repository URL.
 * @param {string} pluginName Plugin name.
 * @returns {(string|boolean)} Plugin URL or false if no base URL given.
 */
function plainRepositoryHandler({ suffix = `.js`, url } = {},
                                pluginName) {
  if (url === undefined || pluginName === undefined) return false;

  if (!url.endsWith(`/`)) url += `/`;

  return url + pluginName + suffix;
}

/**
 * Local repository handler.
 *
 * Defers to a loader function which is expected to return a string or Function
 * representing the plugin to be loaded or false loading failed.
 *
 * @alias module:src/repositories.local
 * @param {Object.<string,(string|Function)>} plugins Repository mapping plugin
 *  names to plugin code (as string or Function).
 * @param {string} pluginName Plugin name.
 * @returns {(string|boolean|Function)} Plugin representation or empty string if
 *  the plugin could not be loaded or false if the load or pluginName were
 *  invalid.
 */
function localRepositoryHandler({ plugins } = {}, pluginName) {
  if (typeof plugins !== `object` || pluginName === undefined) return false;

  return plugins[pluginName] || "";
}

/**
 * GitHub repository handler.
 *
 * @alias module:src/repositories.github
 * @param {string} repository GitHub repository, e.g. `XHerna/fm-publicbot`.
 * @param {string} [version] Repository release, commit, or branch, defaults to
 *  `master`.
 * @param {string} [path] Path within the repository, defaults to `src`.
 * @param {string} [suffix] File name suffix, defaults to `.js`.
 * @param {string} pluginName Plugin name.
 * @returns {(string|boolean)} Plugin URL or false if no repository given.
 *
 */
function githubRepositoryHandler({ repository, version = `master`, path = `src`,
                                 suffix = `.js` } = {}, pluginName) {

  if (path.length > 0 && !path.endsWith(`/`)) path += `/`;

  if (repository === undefined || pluginName === undefined) return false;

  return `https://cdn.jsdelivr.net/gh/` +
      `${repository}@${version}/${path}${pluginName}${suffix}`;
}