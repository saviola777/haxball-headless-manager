/**
 * PluginLoader class, responsible for loading plugins via repositories or via
 * code.
 *
 * @class PluginLoader
 * @property {HhmRoomObject} room Room object.
 * @property {Object.<string, Function>} repositoryTypeHandlers Handler
 *  functions for different repository types, see
 *  {@link module:src/repository}.
 */
class PluginLoader {

  constructor(pluginManager) {
    this._class = `PluginLoader`;
    this.pluginManager = pluginManager;
  }

  /**
   * Create and execute the plugin in a function context, passing a single
   * argument 'HBInit', which is a function returning the trapped room
   *
   * @function PluginLoader#_executePlugin
   * @private
   * @param {(Function|string)} pluginCode Plugin code as either a function
   *  or a string.
   * @param {external:haxball-room-trapper.TrappedRoom} pluginRoom Trapped room
   *  for the plugin.
   * @param {string} [pluginName] Default plugin name, will be overwritten by
   *  the name property of the `pluginSpec` if given.
   */
  _executePlugin(pluginCode, pluginRoom, pluginName) {
    const HBInit = () => {
      pluginRoom._lifecycle.valid = true;
      return pluginRoom;
    };

    // For scripts that use window.HBInit
    const windowCopy = {
      ...window,
      HBInit
    }

    try {
      if (typeof pluginCode === `function`) {
        pluginCode(HBInit, windowCopy);
      } else {
        Function.apply(null, [`HBInit`, `window`, pluginCode])(HBInit, windowCopy);
      }
    } catch (e) {
      HHM.log.error(`Unable to execute plugin. ${e.name}: ${e.message}`);
      pluginRoom._lifecycle.valid = false;
    }

    // TODO check if pluginSpec object or undefined, throw error otherwise
    if (pluginRoom.hasOwnProperty(`pluginSpec`)) {
      if (typeof pluginName !== `undefined`) {
        pluginRoom._name = pluginName;

        if (pluginRoom.pluginSpec.hasOwnProperty(`name`) &&
            pluginRoom.pluginSpec.name !== pluginName) {
          HHM.log.error(`Invalid plugin specification: name is ` +
              `${pluginRoom.pluginSpec.name} but was loaded as ${pluginName}`);
          pluginRoom._lifecycle.valid = false;
        }
      }
    }

    pluginRoom._source = typeof pluginCode === `function`
        ? pluginCode.toString() : pluginCode;
    pluginRoom._sourceHash = HHM.util.hashFunction(pluginRoom._source,
        HHM.util.hashSeed);

    if (!this.pluginManager.hasPlugin(pluginRoom._id)) {
      HHM.log.error(
          `Invalid plugin ${pluginRoom.getName()}, either an error happened ` +
          `during plugin execution or HBInit() was not called`);
      this.pluginManager.removePlugin(pluginRoom._id);
    }
  }

  /**
   * Returns whether the given repository already exists.
   *
   * Repositories are considered equal if their configuration is the same.
   *
   * @function PluginLoader#hasRepository
   * @param {repository.Repository} repository Repository object to be checked
   * @returns {boolean} true if the repository exists, false otherwise
   */
  hasRepository(repository) {
    return this.repositories.some((r) =>
        repository.getConfigurationHash() === r.getConfigurationHash());
  }

  /**
   * Initialize the repository configurations.
   *
   * Adds the given repositories using {@link PluginLoader#addRepository} after
   * removing all existing repositories.
   *
   * @function PluginLoader#initializeRepositories
   * @param {Array.<repository.Repository>} repositories Array of repositories,
   *  as strings or objects.
   * @see module:src/repositories
   */
  initializeRepositories(repositories) {
    this.repositories = [];
    for (let repository of repositories) {
      this.addRepository(repository, true);
    }
  }

  /**
   * Adds a repository.
   *
   * The repository can be specified as a `string`, then it is interpreted as
   * the `URL` of a `plain` type repository, or as an `Object`.
   *
   * If `append` is set to `true`, the new repository will be added with the
   * lowest priority, i.e. plugins will only be loaded from it they can't be
   * found in any other repository. Otherwise the repository will be added with
   * the highest priority.
   *
   * For more control over repository order, feel free to directly change the
   * `repositories` `Array`.
   *
   * The following default values are set if the given repository does not
   * include them:
   *
   * - `type`: `plain`
   * - `suffix`: `.js`
   *
   * @function PluginLoader#addRepository
   * @param {repository.Repository} repository The repository to be added.
   * @param {boolean} [append] Whether to append or prepend the repository to
   *  the `Array` of repositories.
   * @returns {boolean} Whether the repository was successfully added.
   */
  addRepository(repository, append = false) {

    // Check if repository exists
    if (this.hasRepository(repository)) {
      HHM.log.warn(`Skipping duplicate repository entry for repository `
          + `"${repository.getName()}"`);
      return false;
    }

    append ? this.repositories.push(repository)
        : this.repositories.unshift(repository);

    return true;
  }

  /**
   * Removes the given repository.
   *
   * @param {repository.Repository} repository Repository object to be removed.
   * @returns {boolean} what #hasRepository would have returned before calling
   *  this function.
   */
  removeRepository(repository) {
    for (let i = 0; i < this.repositories.length; i++) {
      if (repository.getConfigurationHash()
          === this.repositories[i].getConfigurationHash()) {

        this.repositories.splice(i, 1);
        return true;
      }
    }

    return false;
  }

  /**
   * Tries to load a plugin from name, code, or URL.
   *
   * @function PluginLoader#tryToLoadPlugin
   * @async
   * @param {string} [pluginName] Plugin name.
   * @param {(string|Function)} [pluginCode] Plugin code as string or function.
   * @param {object} [pluginConfig] Plugin configuration.
   * @returns {Promise.<number>} the ID of the plugin or -1 if it couldn't be
   *  #loaded.
   */
  async tryToLoadPlugin({ pluginName, pluginCode, pluginConfig } = {}) {
    let pluginId = -1;

    if (pluginCode !== undefined) {
      pluginId = this._tryToLoadPluginByCode(pluginCode, pluginName);
    } else if (pluginName !== undefined) {
      pluginId = await this._tryToLoadPluginByName(pluginName, pluginConfig);
    }

    if (pluginId !== -1 ) {
      const pluginRoom = this.pluginManager.getPlugin(pluginId);

      HHM.log.info(`Plugin ${pluginRoom.getName()} loaded from `
          + pluginRoom._loadedFrom.getName());
    }

    return pluginId;
  }

  /**
   * Tries to load a plugin from the plugin code.
   *
   * @function PluginLoader#_tryToLoadPluginByCode
   * @private
   * @param {(string|Function)} pluginCode Plugin code as `string` or `Function`.
   * @param {string} [pluginName] Optional default plugin name, used only if the
   *  plugin code does not set a name.
   * @param {object} [pluginConfig] Plugin configuration.
   * @returns {number} the ID of the plugin or -1 if it couldn't be loaded.
   * @see PluginLoader#_executePlugin
   */
  _tryToLoadPluginByCode(pluginCode, pluginName,
                         pluginConfig = {}) {
    const pluginRoom = this.pluginManager.getPlugin(pluginName, true);
    this._executePlugin(pluginCode, pluginRoom);

    pluginRoom._loadedFrom = { getName: () => `code`};

    return this.pluginManager.hasPlugin(pluginRoom.getName())
        ? pluginRoom._id : -1;
  }

  /**
   * Tries to load the given plugin from the configured repositories.
   *
   * @function PluginLoader#_tryToLoadPluginByName
   * @async
   * @private
   * @param {string} pluginName Name of the plugin to be loaded.
   * @param {object} [pluginConfig] Plugin configuration.
   * @returns {Promise.<number>} The ID of the plugin or -1 if it couldn't be
   *  loaded.
   */
  async _tryToLoadPluginByName(pluginName, pluginConfig = {}) {

    let repositoryCandidates = [];
    let otherRepositories = [];

    if (pluginConfig.repository !== undefined) {
      for (let repository of this.repositories) {
        if (pluginConfig.repository === repository.getName()) {
          repositoryCandidates.push(repository);
          break;
        }
      }
    }

    // Find repositories which claim they contain the plugin we're looking for
    for (let repository of this.repositories) {
      const repositoryInfo = repository.getRepositoryInformation();

      if (pluginConfig.repository !== undefined) {
        if (pluginConfig.repository === repository.getName()) {
          repositoryCandidates = [repository];
          break;
        }
      }
      else if (repositoryInfo.plugins !== undefined
          && repositoryInfo.plugins.includes(pluginName)) {
        repositoryCandidates.push(repository);
      } else {
        otherRepositories.push(repository)
      }
    }

    if (pluginConfig.repository !== undefined) {
      if (repositoryCandidates.length === 0) {
        HHM.log.warn(`Required repository ${pluginConfig.repository} for `
            + `plugin ${pluginName} not found`);
      }

      otherRepositories = [];
    }

    for (let repository of [...repositoryCandidates, ...otherRepositories]) {

      let repositoryResult = await repository.getPluginSource(pluginName);

      if (repositoryResult === false) {
        HHM.log.debug(`Repository ${repository.getName()} returned false `
          + `for plugin ${pluginName}`);
        continue;
      }

      // Assume it's plugin code
      const pluginId =
          await this._tryToLoadPluginByCode(repositoryResult, pluginName);

      if (pluginId !== -1) {
        this.pluginManager.getPlugin(pluginId)._loadedFrom = repository;

        return pluginId;
      }
    }

    HHM.log.warn(`Unable to load plugin ${pluginName} from configured `
        + `repositories`);

    return -1;
  }
}

module.exports = PluginLoader;