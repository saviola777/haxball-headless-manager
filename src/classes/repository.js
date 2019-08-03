/**
 * TODO documentation
 */

/**
 * TODO documentation
 */
const stringify = require(`json-stable-stringify`);
const seed =  Math.floor((Math.random() * 10000) + 1);

const hash = require(`../hash`);

class Repository {

  constructor(userRepositoryConfig, handler) {
    // TODO Update config from handler?
    this.userRepositoryConfig = userRepositoryConfig;
    this.handler = handler;
    this.type = handler.type;

    this.repositoryConfig = $.extend({},
        this.handler.getRepositoryConfigurationDefaults(),
        this.userRepositoryConfig);

    this._validateConfiguration();

    this.pluginSources = {};

    this.initializationDeferred = new $.Deferred();
    this.handler.getRepositoryInformation(this)
        .then(async (repositoryInformation) => {


      this.repositoryInformation = repositoryInformation;

      // Merge in repository configuration
      if (this.repositoryInformation.hasOwnProperty(`config`)) {
        $.extend(this.repositoryConfig, this.repositoryInformation.config);
      }

      this.configHash = hash(stringify(this.repositoryConfig));

      this.initializationDeferred.resolve();
    });
  }

  async _loadDataFromUrl(url) {
    let data = false;

    await $.ajax({
      cache: false,
      crossDomain: true,
      //dataType: `text`,
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
   */
  async _postProcessPluginResult(data) {
    if (data.toString().startsWith(`http`)) {
      return this._loadDataFromUrl(data.toString());
    }

    return data;
  }

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
   * TODO documentation
   */
  getConfiguration() {
    return this.repositoryConfig;
  }

  /**
   * TODO documentation
   */
  getConfigurationHash() {
    return this.configHash;
  }

  /**
   * TODO documentation
   */
  getName() {
    return this.repositoryInformation.name;
  }

  /**
   * TODO documentation
   */
  async getPluginSource(pluginName) {
    if (this.pluginSources[pluginName] === undefined) {
      this.pluginSources[pluginName] =
          await this._postProcessPluginResult(
          await this.handler.getPluginSource(this, pluginName));
    }

    return this.pluginSources[pluginName];
  }

  /**
   * TODO documentation
   */
  getPluginNames() {
    return this.repositoryInformation.plugins || [];
  }

  /**
   * TODO documentation
   */
  getRepositoryInformation() {
    return this.repositoryInformation;
  }

  /**
   * TODO documentation
   */
  getType() {
    return this.type;
  }

  /**
   * TODO documentation
   */
  getUserConfiguration() {
    return this.userRepositoryConfig;
  }

  /**
   * TODO documentation
   */
  async awaitInitialization() {
    return this.initializationDeferred.promise();
  }
}

/**
 * TODO documentation
 */
class RepositoryFactory {
  constructor(repositoryTypeHandlers = {}) {
    // TODO document
    this.repositories = {};
    this.userRepositoryConfigs = {};
    this.repositoryTypeHandlers = {};

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
   * TODO documentation
   */
  addRepositoryTypeHandler(handler, type = handler.type) {

    if (type === undefined) {
      throw new RepositoryTypeError(undefined);
    }

    // TODO check .type, add handler, warning if replace?
    this.repositoryTypeHandlers[type] = $.extend(handler, { type });
  }

  /**
   * TODO documentation
   */
  async createRepository(userRepositoryConfig) {

    if (this.repositoryTypeHandlers[userRepositoryConfig.type]
        === undefined) {

      throw new RepositoryTypeError(userRepositoryConfig.type);
    }

    // Check if user repository Config is known
    const userRepositoryConfigHash =
        hash(stringify(userRepositoryConfig));

    if (this.userRepositoryConfigs[userRepositoryConfigHash] !== undefined) {
      return this.repositories[this.userRepositoryConfigs[userRepositoryConfigHash]];
    }

    // Create repo from config, then compare resulting config with cache
    const repository = new Repository(userRepositoryConfig,
        this.repositoryTypeHandlers[userRepositoryConfig.type]);

    await repository.awaitInitialization();

    const repositoryConfigHash = repository.getConfigurationHash();

    this.userRepositoryConfigs[userRepositoryConfigHash] = repositoryConfigHash;

    // Save repository
    if (this.repositories[repositoryConfigHash] === undefined) {
      this.repositories[repositoryConfigHash] = repository;
    }

    // Check cache and return cached repo, or create new repo from config
    // merge config with default values?
    return this.repositories[repositoryConfigHash];
  }
}

/**
 * TODO documentation
 */
class RepositoryConfigError extends Error {
  constructor(message) {
    super(`Repository configuration error: ${message}`);
    this.name = `RepositoryConfigError`;
  }
}

/**
 * TODO documentation
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