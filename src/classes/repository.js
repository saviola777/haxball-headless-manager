/**
 * Plugin repository-related classes.
 *
 * @module src/classes/repository
 */

/**
 * TODO documentation
 */
const stringify = require(`json-stable-stringify`);
const seed =  Math.floor((Math.random() * 10000) + 1);

const hash = require(`../hash`);

/**
 * Plugin repository class.
 *
 * Use the {@link repository.RepositoryFactory} to create new repositories.
 *
 * @class repository.Repository
 * @see repository.RepositoryFactory
 */
class Repository {

  /**
   * Repository constructor.
   *
   * @function repository.Repository#constructor
   * @throws {repository.RepositoryConfigError} If the user repository
   *  configuration is invalid.
   */
  constructor(userRepositoryConfig, handler) {

    this.userRepositoryConfig = userRepositoryConfig;
    this.handler = handler;
    this.type = handler.type;

    this.repositoryConfig = $.extend({},
        this.handler.getRepositoryConfigurationDefaults(),
        this.userRepositoryConfig);

    this._validateConfiguration();

    // TODO Turn into map
    this.pluginSources = new Map();

    this.initializationDeferred = new $.Deferred();
    this.handler.getRepositoryInformation(this)
        .then((repositoryInformation) => {

      this.repositoryInformation = $.extend(
          { name: stringify(this.userRepositoryConfig).substring(0, 200) },
          repositoryInformation);

      // Merge in repository configuration
      if (this.repositoryInformation.hasOwnProperty(`config`)) {
        $.extend(this.repositoryConfig, this.repositoryInformation.config);
      }

      this.configHash = hash(stringify(this.repositoryConfig), seed);

      this.initializationDeferred.resolve(this);
    });
  }

  /**
   * Helper function which loads data from the given URL using $.ajax.
   *
   * @function repository.Repository#_loadDataFromUrl
   * @private
   * @async
   * @param {string} url URL from which to load data.
   * @returns {Promise.<*>} Returned data.
   */
  async _loadDataFromUrl(url) {
    let data = false;

    await $.ajax({
      cache: false,
      crossDomain: true,
      url: url,
      success: (result) => {
        data = result;
      },
    });

    return data;
  }

  /**
   * Checks if a URL was returned by the handler and loads the data at the URL
   * if it was.
   *
   * @function repository.Repository#_postProcessPluginResult
   * @private
   * @async
   * @param {string} data Data returned by
   *  {@link repository.RepositoryTypeHandler.getPluginSource}.
   * @returns {Promise.<*>} Post-processed data.
   * @see repository.Repository#_loadDataFromUrl
   */
  async _postProcessPluginResult(data) {
    if (data.toString().startsWith(`http`)) {
      return this._loadDataFromUrl(data.toString());
    }

    return data;
  }

  /**
   * Checks if the repository configuration is valid.
   *
   * A repository configuration is considered invalid if any of the required
   * parameters (as defined by
   * {@link repository.RepositoryTypeHandler.getRepositoryConfigurationDefaults})
   * is missing.
   *
   * @function repository.Repository#_validateConfiguration
   * @private
   * @throws {repository.RepositoryConfigError} If the configuration is invalid.
   * @see repository.RepositoryTypeHandler.getRepositoryConfigurationDefaults
   */
  _validateConfiguration() {

    // Validate repository Config
    for (let property of Object.getOwnPropertyNames(this.repositoryConfig)) {

      // TODO mark user config hash as known to be invalid?
      if (this.repositoryConfig[property] === null) {
        throw new RepositoryConfigError(
            `Missing required property ${property} for repository type `
            + this.repositoryConfig.type);
      }
    }
  }

  /**
   * Awaits the initialization of the repository.
   *
   * @function repository.Repository#awaitInitialization
   * @async
   * @returns {Promise.<repository.Repository>} The initialized repository.
   * @see repository.Repository.isInitialized
   */
  async awaitInitialization() {
    return this.initializationDeferred.promise();
  }

  /**
   * Returns the full repository configuration.
   *
   * @function repository.Repository#getConfiguration
   * @returns {object.<*>} Repository configuration object.
   * @see repository.RepositoryTypeHandler.getRepositoryConfigurationDefaults
   * @see repository.RepositoryTypeHandler.getRepositoryInformation
   */
  getConfiguration() {
    return this.repositoryConfig;
  }

  /**
   * Returns the hash of the repository configuration.
   *
   * Two repositories with the same configuration hash are considered equal.
   *
   * @function repository.Repository#getConfigurationHash
   * @returns {number} Repository configuration hash.
   * @see repository.Repository#getConfiguration
   * @see external:murmurhash3_32_gc
   */
  getConfigurationHash() {
    return this.configHash;
  }

  /**
   * Returns the repository name.
   *
   * Each repository must have a name, the name is taken from these sources in
   * this order:
   *
   * <ol>
   *   <li>Repository information, see
   *   {@link repository.RepositoryTypeHandler.getRepositoryInformation}.</li>
   *   <li>Repository type handler can generate a name based on the repository
   *   configuration if the user has not specified a name.</li>
   *   <li>JSON string of the repository configuration object.</li>
   * </ol>
   *
   * @function repository.Repository#getName
   * @returns {string} Repository name.
   * @see repository.RepositoryTypeHandler.getRepositoryInformation
   */
  getName() {
    return this.repositoryInformation.name;
  }

  /**
   * Returns the source code for the given plugin name or false if it doesn't
   * exist in this repository.
   *
   * The plugin source is returned as string or as Function.
   *
   * @function repository.Repository#getPluginSource
   * @async
   * @param {string} pluginName Plugin name.
   * @returns {Promise.<(string|Function|boolean)>} Plugin source or false if
   *  the plugin does not exist in this repository.
   * @see repository.RepositoryTypeHandler.getPluginSource
   */
  async getPluginSource(pluginName) {
    if (!this.pluginSources.has(pluginName)) {
      this.pluginSources.set(pluginName,
          await this._postProcessPluginResult(
          await this.handler.getPluginSource(this, pluginName)));
    }

    return this.pluginSources.get(pluginName);
  }

  /**
   * Returns a list of plugins contained in this repository or an empty array
   * if the repository maintainer did not provide this information.
   *
   * @function repository.Repository#getPluginNames
   * @returns {Array.<string>} List of names of plugins contained in this
   *  repository.
   * @see repository.RepositoryTypeHandler.getRepositoryInformation
   */
  getPluginNames() {
    return this.repositoryInformation.plugins || [];
  }

  /**
   * Returns the repository information.
   *
   * @function repository.Repository#getRepositoryInformation
   * @returns {object.<*>} Repository information object.
   * @see repository.RepositoryTypeHandler.getRepositoryInformation
   */
  getRepositoryInformation() {
    return this.repositoryInformation;
  }

  /**
   * Returns the repository type.
   *
   * This is a string representing the type of the repository, e.g. github or
   * plain.
   *
   * @function repository.Repository#getType
   * @returns {string} Repository type.
   * @see repository.RepositoryFactory#createRepository
   */
  getType() {
    return this.type;
  }

  /**
   * Returns the user repository configuration.
   *
   * This is the configuration that was initially passed by the user to create
   * this repository.
   *
   * @function repository.Repository#getUserConfiguration
   * @returns {object.<*>} Repository configuration object.
   * @see repository.RepositoryFactory#createRepository
   */
  getUserConfiguration() {
    return this.userRepositoryConfig;
  }

  /**
   * Returns whether the repository has been initialized.
   *
   * A repository is considered initialized after the repository information
   * have become available.
   *
   * @function repository.Repository#isInitialized
   * @returns {boolean} Whether the repository is initialized.
   * @see repository.Repository#awaitInitialization
   */
  isInitialized() {
    return this.initializationDeferred.state() !== `pending`;
  }
}

/**
 * Factory class for repository objects.
 *
 * @class repository.RepositoryFactory
 * @see repository.Repository
 */
class RepositoryFactory {
  constructor(repositoryTypeHandlers = {}) {
    this.repositories = new Map();
    this.userRepositoryConfigs = new Map();
    this.repositoryTypeHandlers = new Map();

    Object.getOwnPropertyNames(repositoryTypeHandlers).forEach((type) => {
      try {
        this.addRepositoryTypeHandler(repositoryTypeHandlers[type], type);
      } catch (e) {
        HHM.log.error(`Failed to add repository type handler ${type}. `
            + `${e.name}: ${e.message}`);
      }
    });
  }

  /**
   * Adds a repository type handler.
   *
   * @function repository.RepositoryFactory#addRepositoryTypeHandler
   * @param {repository.RepositoryTypeHandler} handler Repository type handler.
   * @param {string} [type] Handler type, taken from the repository type handler
   *  object by default.
   * @throws {repository.RepositoryTypeError} If no type was found.
   */
  addRepositoryTypeHandler(handler, type = handler.type) {
    if (type === undefined) {
      throw new RepositoryTypeError(undefined);
    }

    // TODO warning if replace?
    this.repositoryTypeHandlers.set(type, $.extend(handler, { type }));
  }

  /**
   * Creates and initializes a repository for the given user configuration.
   *
   * @function repository.RepositoryFactory#createRepository
   * @async
   * @param {object.<*>} userRepositoryConfig Repository configuration object.
   * @throws {repository.RepositoryTypeError} If no handler was registered for
   *  the given repository type.
   * @throws {repository.RepositoryConfigError} If the user repository
   *  configuration is invalid.
   * @returns {Promise.<repository.Repository>} Repository object.
   */
  async createRepository(userRepositoryConfig) {

    if (!this.repositoryTypeHandlers.has(userRepositoryConfig.type)) {
      throw new RepositoryTypeError(userRepositoryConfig.type);
    }

    // Check if user repository Config is known
    const userRepositoryConfigHash = hash(stringify(userRepositoryConfig), seed);

    if (this.userRepositoryConfigs.has(userRepositoryConfigHash)) {
      return this.repositories.get(
          this.userRepositoryConfigs.get(userRepositoryConfigHash));
    }

    // Create repo from config, then compare resulting config with cache
    const repository = new Repository(userRepositoryConfig,
        this.repositoryTypeHandlers.get(userRepositoryConfig.type));

    await repository.awaitInitialization();

    const repositoryConfigHash = repository.getConfigurationHash();

    this.userRepositoryConfigs.set(userRepositoryConfigHash, repositoryConfigHash);

    // Save repository
    if (!this.repositories.has(repositoryConfigHash)) {
      this.repositories.set(repositoryConfigHash, repository);
    }

    // TODO Check cache and return cached repo, or create new repo from config,
    //  merge config with default values?
    return this.repositories.get(repositoryConfigHash);
  }
}

/**
 * Repository configuration error.
 *
 * @class repository.RepositoryConfigError
 */
class RepositoryConfigError extends Error {
  constructor(message) {
    super(`Repository configuration error: ${message}`);
    this.name = `RepositoryConfigError`;
  }
}

/**
 * Repository configuration error thrown when an invalid repository type is
 * encountered.
 *
 * @class repository.RepositoryTypeError
 */
class RepositoryTypeError extends RepositoryConfigError {
  constructor(message) {
    super(`Invalid repository type: ${message}`);
    this.name = `RepositoryTypeError`;
  }
}

module.exports = {
  RepositoryFactory,
  RepositoryConfigError,
  RepositoryTypeError,
  Repository
};