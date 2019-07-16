/**
 * Built-in repository type handlers for the RepositoryFactory.
 *
 * Further handlers can be added using
 * `HHM.manager.getPluginRepositoryFactory.addRepositoryTypeHandler()`
 * later on.
 *
 * @module src/repository
 * @see repository.RepositoryFactory
 * @see repository.RepositoryTypeHandler
 */


const seed =  Math.floor((Math.random() * 10000) + 1);
const hash = require(`../hash`);

/**
 * Plain repository handler.
 *
 * @alias module:src/repository.plain
 * @param {string} [suffix] File name suffix, defaults to `.js`.
 * @param {string} url Base repository URL.
 * @param {string} pluginName Plugin name.
 * @returns {(string|boolean)} Plugin URL or false if no base URL given.
 */
function plainRepositoryTypeHandler({ suffix = `.js`, url } = {},
                                pluginName) {
  if (url === undefined || pluginName === undefined) return false;

  if (!url.endsWith(`/`)) url += `/`;

  return url + pluginName + suffix;
}

/**
 * Local repository handler.
 *
 * @alias module:src/repository.local
 * @param {Object.<string,(string|Function)>} plugins Repository mapping plugin
 *  names to plugin code (as string or Function).
 * @param {string} pluginName Plugin name.
 * @returns {(string|boolean|Function)} Plugin representation or empty string if
 *  the plugin could not be loaded or false if the load or pluginName were
 *  invalid.
 */
function localRepositoryTypeHandler({ plugins } = {}, pluginName) {
  if (typeof plugins !== `object` || pluginName === undefined) return false;

  return plugins[pluginName] || "";
}

/**
 * GitHub repository handler.
 *
 * @alias module:src/repository.github
 */
const github = {

  /**
   * GitHub repository handler.
   *
   * @alias module:src/repository.github
   * @param {repository.Repository} repository Repository object.
   * @param {string} pluginName Plugin name.
   * @returns {Promise.<(string|boolean)>} Plugin URL or false if plugin not
   *  available in the repository or some other error happened while trying to
   *  load the plugin.
   *
   */
  getPluginSource: async (repository, pluginName) => {

    let { "repository": repositoryName, path, suffix, version }
        = repository.getConfiguration();

    if (path.length > 0 && !path.endsWith(`/`)) path += `/`;

    if (pluginName === undefined) return false;

    const pluginUrl = `https://cdn.jsdelivr.net/gh/` +
        `${repositoryName}@${version}/${path}${pluginName}${suffix}`;

    let pluginSource = false;

    try {
      await $.ajax({
        cache: false,
        crossDomain: true,
        url: pluginUrl,
        dataType: `text`,
        success: text => {
          pluginSource = text;
        },
      });
    } catch (e) {
      // Plugin not available from this repository, no action necessary
    }

    return pluginSource;
  },

  getRepositoryConfigurationDefaults: () => {
    return {
      path: `src`,
      repository: null,
      suffix: `.js`,
      version: `master`,
    };
  },

  getRepositoryInformation: async (repository) =>  {

    let { "repository": repositoryName, version }
        = repository.getConfiguration();

    const repositoryInformationUrl = `https://cdn.jsdelivr.net/gh/` +
        `${repositoryName}@${version}/repository.json`;

    let repositoryInformation = {};

    try {
      await $.ajax({
        cache: false,
        crossDomain: true,
        url: repositoryInformationUrl,
        dataType: `json`,
        success: json => {
          repositoryInformation = json;
        },
      });
    } catch (e) {
      // No information available for this repository, no action necessary
    }

    if (repositoryInformation.name === undefined) {
      repositoryInformation.name = repositoryName;
    }

    repositoryInformation.name += `@${version}`;

    return repositoryInformation;
  },
};

/**
 * Local repository handler.
 *
 * @alias module:src/repository.local
 */
const local = {
  /**
   * Local repository handler.
   *
   * @alias module:src/repository.local
   * @param {repository.Repository} repository Repository object.
   * @param {string} pluginName Plugin name.
   * @returns {Promise.<(string|boolean)>} Plugin code or false if plugin not
   *  available in the repository.
   *
   */
  getPluginSource: async (repository, pluginName) => {

    if (pluginName === undefined) return false;

    const plugins = repository.getConfiguration().plugins;

    if (plugins.hasOwnProperty(pluginName)) {
      return plugins[pluginName];
    }

    return false;
  },

  getRepositoryConfigurationDefaults: () => {
    return {
      name: hash(new Date().toString(), seed),
      plugins: null
    };
  },

  getRepositoryInformation: async (repository) =>  {

    let { name, plugins, repositoryInformation } = repository.getConfiguration();

    let pluginNames = Object.getOwnPropertyNames(plugins);

    return $.extend({}, { name, plugins: pluginNames }, repositoryInformation);
  },
};

const plain = {
  /**
   * Plain URL repository handler.
   *
   * @alias module:src/repository.plain
   * @param {repository.Repository} repository Repository object.
   * @param {string} pluginName Plugin name.
   * @returns {Promise.<(string|boolean)>} Plugin URL or false if no plugin
   *  name was specified.
   *
   */
  getPluginSource: async (repository, pluginName) => {
    if (pluginName === undefined) return false;

    let { suffix, url } = repository.getConfiguration();

    if (!url.endsWith(`/`)) url += `/`;

    return url + pluginName + suffix;
  },

  getRepositoryConfigurationDefaults: () => {
    return {
      suffix: `.js`,
      url: null,
    };
  },

  getRepositoryInformation: async (repository) =>  {

    let { url } = repository.getConfiguration();

    if (!url.endsWith(`/`)) url += `/`;

    const repositoryInformationUrl = url + `repository.json`;

    let repositoryInformation = {};

    try {
      await $.ajax({
        cache: false,
        crossDomain: true,
        url: repositoryInformationUrl,
        dataType: `json`,
        success: json => {
          repositoryInformation = json;
        },
      });
    } catch (e) {
      // No information available for this repository, no action necessary
    }

    return $.extend({ name: url }, repositoryInformation);
  },
};


const RepositoryTypeHandlers = {
  github,
  local,
  plain,
};

module.exports = RepositoryTypeHandlers;

/**
 * Repository handler object.
 *
 * Each repository handler has to implement the functions shown here and
 * be registered with the {@link repository.RepositoryFactory}.
 *
 * It is assumed that whenever `repositoryConfiguration` objects are passed to
 * one of the RepositoryTypeHandler functions, the defaults returned from
 * {@link repository.RepositoryTypeHandler.getRepositoryConfigurationDefaults}
 * are already merged in.
 *
 * @namespace repository.RepositoryTypeHandler
 */

/**
 * Returns the source code or function representing the plugin associated with
 * the given name or false if no such plugin was found.
 *
 * @function repository.RepositoryTypeHandler.getPluginSource
 * @async
 * @param {repository.Repository} repository Repository object.
 * @param {string} pluginName Name of the plugin.
 * @returns {Promise.<(Function|string|boolean)>} Plugin source as string or
 *  function, or false if the plugin was not found or an error occurred.
 */

/**
 * Returns the repository information for the given repository.
 *
 * All required parameters should be marked by giving them the value `null`.
 *
 * @function repository.RepositoryTypeHandler.getRepositoryConfigurationDefaults
 * @returns {object.<*>} Default values for the repository configuration, user
 *  configuration will be merged into this.
 */

/**
 * Returns the repository information for the given repository.
 *
 * @function repository.RepositoryTypeHandler.getRepositoryInformation
 * @async
 * @param {repository.Repository} repository Repository object.
 * @returns {Promise.<repository.RepositoryInformation>} Repository information.
 */

/**
 * Repository information object.
 *
 * Repository information can be provided as part of the repository, but only
 * the repository name is mandatory. Repository maintainers can choose if an
 * which information to provide, but if a list of plugins is provided and the
 * repository contains plugins which are not part of that list, these plugins
 * may not be loaded from this repository.
 *
 * The repository type handler should generate a default name based on the
 * repository configuration if the repository maintainer has not provided any
 * repository information.
 *
 * @typedef {object.<*>} repository.RepositoryInformation
 * @property {string} name Repository name.
 * @property {string} [description] Repository description
 * @property {string} [author] Author(s) of the plugins in this repository.
 * @property {array.<string>} [plugins] Plugins contained in the repository.
 */