/**
 * Built-in repository type handlers for the RepositoryFactory.
 *
 * Further handlers can be added using
 * `HHM.manager.getPluginRepositoryFactory().addRepositoryTypeHandler()`
 * later on.
 *
 * @module src/repository
 * @see repository.RepositoryFactory
 * @see repository.RepositoryTypeHandler
 */

const repository = require(`./classes/repository`);

/**
 * GitHub repository handler.
 *
 * Configuration:
 *
 *  - repository: required parameter (GitHub repository, e.g. "user/repo")
 *  - path: directory that contains the plugins (default: "src")
 *  - suffix: file type of the plugins (default: ".js")
 *  - version: branch, tag, or commit of the repository (default: "master")
 *
 * @alias module:src/repository.github
 */
const github = {

  /**
   * Loads the given plugin from the given GitHub repository.
   *
   * @function repository.github.getPluginSource
   * @async
   * @param {repository.Repository} repository Repository object.
   * @param {string} pluginName Plugin name.
   * @throws repository.RepositoryTypeError If a non-github repository is given.
   * @returns {Promise.<(string|boolean)>} Plugin URL or false if plugin not
   *  available in the repository or some other error happened while trying to
   *  load the plugin.
   *
   */
  getPluginSource: async (repository, pluginName) => {
    if (repository.type !== `github`) {
      throw new repository.RepositoryTypeError(repository.type);
    }

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

  /**
   * Returns GitHub repository configuration defaults.
   *
   * @function repository.github.getConfigurationDefaults
   * @returns {object.<*>} GitHub repository configuration defaults.
   */
  getRepositoryConfigurationDefaults: () => {
    return {
      path: `src`,
      repository: null,
      suffix: `.js`,
      version: `master`,
    };
  },

  /**
   * Returns GitHub repository information.
   *
   * The handler will load the contents of the file "respository.json" in the
   * root of the GitHub repository.
   *
   * The version parameter will be appended to the repository name. If no
   * custom repository name is specified, the GitHub repository name is used.
   *
   * @function repository.github.getRepositoryInformation
   * @throws repository.RepositoryTypeError If a non-github repository is given.
   * @returns {repository.RepositoryInformation} GitHub repository information.
   */
  getRepositoryInformation: async (repository) =>  {
    if (repository.type !== `github`) {
      throw new repository.RepositoryTypeError(repository.type);
    }

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
 * A local repository is a self-contained repository which defines all plugins
 * in its configuration.
 *
 * Configuration:
 *
 *  - plugins: required object that maps plugin names to plugin source (string
 *    or functions)
 *  - repositoryInformation: optional repository information object
 *
 * @alias module:src/repository.local
 */
const local = {
  /**
   * Loads the given plugin from the given local repository.
   *
   * @function module:src/repository.local.getPluginSource
   * @async
   * @param {repository.Repository} repository Repository object.
   * @param {string} pluginName Plugin name.
   * @throws repository.RepositoryTypeError If a non-local repository is given.
   * @returns {Promise.<(string|boolean)>} Plugin code or false if plugin not
   *  available in the repository.
   */
  getPluginSource: async (repository, pluginName) => {
    if (repository.type !== `local`) {
      throw new repository.RepositoryTypeError(repository.type);
    }

    if (pluginName === undefined) return false;

    const plugins = repository.getConfiguration().plugins;

    if (plugins.hasOwnProperty(pluginName)) {
      return plugins[pluginName];
    }

    return false;
  },

  /**
   * Returns the local repository configuration defaults.
   *
   * @function module:src/repository.local.getRepositoryConfigurationDefaults
   * @returns {object.<*>} Repository configuration defaults.
   */
  getRepositoryConfigurationDefaults: () => {
    return {
      name: new Date().toString(),
      plugins: null
    };
  },

  /**
   * Returns the local repository information.
   *
   * @function module:src/repository.local.getRepositoryInformation
   * @async
   * @throws repository.RepositoryTypeError If a non-local repository is given.
   * @returns {Promise.<repository.RepositoryInformation>} Repository information.
   */
  getRepositoryInformation: async (repository) =>  {
    if (repository.type !== `local`) {
      throw new repository.RepositoryTypeError(repository.type);
    }

    let { name, plugins, repositoryInformation } = repository.getConfiguration();

    let pluginNames = Object.getOwnPropertyNames(plugins);

    return $.extend({}, { name, plugins: pluginNames }, repositoryInformation);
  },
};

/**
 * Plain repository handler.
 *
 * A plain repository is a repository that consists of plugins being loaded
 * from a base url plus the plugin name plus a file type.
 *
 * The repository information is loaded from the file "repository.json" below
 * the base URL.
 *
 * Configuration:
 *
 *  - suffix: file type (default: ".js")
 *  - url: required base URL
 *
 * @alias module:src/repository.plain
 */
const plain = {
  /**
   * Loads the given plugin from the given plain repository.
   *
   * @function module:src/repository.plain.getPluginSource
   * @async
   * @param {repository.Repository} repository Repository object.
   * @param {string} pluginName Plugin name.
   * @throws repository.RepositoryTypeError If a non-plain repository is given.
   * @returns {Promise.<(string|boolean)>} Plugin URL or false if no plugin
   *  name was specified.
   */
  getPluginSource: async (repository, pluginName) => {
    if (repository.type !== `plain`) {
      throw new repository.RepositoryTypeError(repository.type);
    }

    if (pluginName === undefined) return false;

    let { suffix, url } = repository.getConfiguration();

    if (!url.endsWith(`/`)) url += `/`;

    return url + pluginName + suffix;
  },

  /**
   * Loads the given plugin from the given plain repository.
   *
   * @function module:src/repository.plain.getRepositoryConfigurationDefaults
   * @throws repository.RepositoryTypeError If a non-plain repository is given.
   * @returns {object.<*>} Repository configuration object.
   */
  getRepositoryConfigurationDefaults: () => {
    return {
      suffix: `.js`,
      url: null,
    };
  },

  /**
   * Loads the given plugin from the given plain repository.
   *
   * @function module:src/repository.plain.getPluginSource
   * @async
   * @param {repository.Repository} repository Repository object.
   * @throws repository.RepositoryTypeError If a non-plain repository is given.
   * @returns {Promise.<repository.RepositoryInformation>} Repository
   *  information object.
   */
  getRepositoryInformation: async (repository) =>  {
    if (repository.type !== `plain`) {
      throw new repository.RepositoryTypeError(repository.type);
    }

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
 * @property {Array.<string>} [plugins] Plugins contained in the repository.
 */