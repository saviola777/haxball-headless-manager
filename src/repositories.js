/**
 * Repository type handlers for the PluginLoader.
 *
 * TODO documentation
 *
 * @module src/repositories
 */

module.exports = {
  github: githubRepositoryHandler,
  plain: plainRepositoryHandler,
};


/**
 * Plain repository handler.
 *
 * @alias module:src/repositories.plain
 * @param {Object} repositoryConfig Repository configuration object.
 * @param {string} repositoryConfig.suffix File name suffix, defaults to `.js`.
 * @param {string} repositoryConfig.url Base repository URL.
 * @param {string} pluginName Plugin name.
 * @returns {string} Plugin URL.
 */
function plainRepositoryHandler(repositoryConfig, pluginName) {
  let suffix = repositoryConfig.suffix || `.js`;
  let url = repositoryConfig.url;

  if (url === undefined) return false;

  if (!url.endsWith(`/`)) url += `/`;

  return url + pluginName + suffix;
}

/**
 * GitHub repository handler.
 *
 * @alias module:src/repositories.github
 * @param {Object} repositoryConfig Repository configuration object.
 * @param {string} repositoryConfig.repository GitHub repository, e.g.
 *  `XHerna/fm-publicbot`.
 * @param {string} repositoryConfig.branch Repository branch, defaults to
 *  `master`.
 * @param {string} repositoryConfig.path Path within the repository, defaults to
 *  `src`.
 * @param {string} repositoryConfig.suffix File name suffix, defaults to `.js`.
 * @param {string} pluginName Plugin name.
 * @returns {string} Plugin URL.
 *
 */
function githubRepositoryHandler(repositoryConfig, pluginName) {
  let repository = repositoryConfig.repository;
  let branch = repositoryConfig.branch || `master`;
  let path = repositoryConfig.path || `src`;
  let suffix = repositoryConfig.suffix || `.js`;

  if (path.length > 0 && !path.endsWith(`/`)) path += `/`;

  if (repository === undefined) return false;

  return `https://raw.githubusercontent.com/` +
      `${repository}/${branch}/${path}${pluginName}${suffix}`;
}