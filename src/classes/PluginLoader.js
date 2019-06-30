const hashFunction = require(`../hash`);
const deepEqual = require(`deep-equal`);
const hashSeed = 14868;

/**
 * PluginLoader class, responsible for loading plugins via repositories or via
 * code.
 *
 * @class PluginLoader
 * @property {HhmRoomObject} room Room object.
 * @property {Object.<string, Function>} repositoryTypeHandlers Handler
 *  functions for different repository types, see
 *  {@link module:src/repositories}.
 */
class PluginLoader {

  constructor(room, repositories) {
    this._class = `PluginLoader`;
    this.room = room;
    this.repositoryTypeHandlers = require(`../repositories`);

    this.initializeRepositories(repositories);
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

    try {
      if (typeof pluginCode === `function`) {
        pluginCode(HBInit);
      } else {
        Function.apply(null, [`HBInit`, pluginCode])(HBInit);
      }
    } catch (e) {
      HHM.log.error(`Unable to execute plugin: ${e.message}`);
      pluginRoom._lifecycle.valid = false;
    }

    if (typeof pluginName !== `undefined`
        && pluginRoom.hasOwnProperty(`pluginSpec`)
        && !pluginRoom.pluginSpec.hasOwnProperty(`name`)) {
      pluginRoom._name = pluginName;
    }

    pluginRoom._source = typeof pluginCode === `function`
        ? pluginCode.toString() : pluginCode;
    pluginRoom._sourceHash = hashFunction(pluginRoom._source, hashSeed);
  }

  /**
   * Loads a plugin with the given name from the given URL.
   *
   * The plugin will be loaded as plain text from the given URL and then
   * executed in a function context.
   *
   * @function PluginLoader#_loadPlugin
   * @private
   * @param {string} pluginUrl Plugin URL.
   * @param {string} [pluginName] Optional default plugin name.
   * @returns {number} Plugin ID if it was loaded or -1 otherwise
   * @see PluginLoader#_executePlugin
   */
  async _loadPlugin(pluginUrl, pluginName) {
    const that = this;

    try {
      await $.ajax({
        cache: false,
        crossDomain: true,
        url: pluginUrl,
        dataType: `text`,
        success: pluginSource => {
          const pluginRoom = that.room.getPlugin(pluginName, true);

          that._executePlugin(pluginSource, pluginRoom,
              pluginName);

          pluginName = pluginRoom._name;

          if (!that.room._pluginManager.hasPluginById(pluginRoom._id)) {
            HHM.log.error(
                `Invalid plugin ${pluginName}, either an error happened ` +
                `during plugin execution or HBInit() was not called`);
            that.room._pluginManager._removePlugin(pluginRoom._id);
          } else {
            HHM.log.info(`Plugin source loaded: ${pluginUrl}`);
            pluginRoom._loadedFrom = pluginUrl;
          }
        },
      });
    } catch (e) {
      // Plugin not available from this repository, no action necessary
    }

    return typeof pluginName !== `undefined` && that.room.hasPlugin(pluginName)
        ? that.room._pluginManager.getPluginId(pluginName) : -1;
  }

  /**
   * Returns whether the given repository already exists.
   *
   * A deep comparison is performed between repository objects.
   *
   * @function PluginLoader#hasRepository
   * @param {Object} repository Repository object to be checked
   * @returns {boolean} true if the repository exists, false otherwise
   */
  hasRepository(repository) {
    return this.repositories.some((r) => deepEqual(repository, r));
  }

  /**
   * Initialize the repository configurations.
   *
   * Adds the given repositories using {@link PluginLoader#addRepository} after
   * removing all existing repositories.
   *
   * @function PluginLoader#initializeRepositories
   * @param {Array.<(string|Object)>} repositories Array of repositories, as
   *  strings or objects.
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
   * @param {Object} repository The repository to be added.
   * @param {boolean} [append] Whether to append or prepend the repository to
   *  the `Array` of repositories.
   * @returns {boolean} Whether the repository was successfully added.
   */
  addRepository(repository, append = false) {
    let repositoryObject = $.extend({}, repository);

    if (this.repositoryTypeHandlers[repositoryObject.type] === undefined) {
      HHM.log.error(`No handler for repository type "${repositoryObject.type}"`);
      return false;
    }

    // Check if repository exists
    for (let existingRepository of this.repositories) {
      if (deepEqual(repositoryObject, existingRepository)) {
        HHM.log.warn(`Skipping duplicate repository entry for repository of`
            + `type "${repositoryObject.type}"`);
        return false;
      }
    }

    append ? this.repositories.push(repositoryObject)
        : this.repositories.unshift(repositoryObject);

    return true;
  }

  /**
   * Adds a function which generates a URL based on the repository configuration
   * and a plugin name.
   *
   * @function PluginLoader#registerRepositoryTypeHandler
   * @param repositoryType String identifying the repository type.
   * @param handler Function which will receive two arguments (repository object
   *  and plugin name) and is expected to return an HTTPs URL which can be used
   *  to load the plugin, or false in case of errors.
   * @returns {boolean} Whether the repository type handler was successfully
   *  registered.
   */
  registerRepositoryTypeHandler(repositoryType, handler) {
    if (typeof handler !== `function` || handler.length < 2) {
      HHM.log.error(`Invalid repository type handler, must be function with`
          + `at least two arguments`);
      return false;
    }

    this.repositoryTypeHandlers[repositoryType] = handler;

    return true;
  }

  /**
   * Tries to load a plugin from name, code, or URL.
   *
   * Convenience function which calls one of the other `tryToLoadPlugin`
   * functions.
   */
  async tryToLoadPlugin({ pluginName, pluginCode, pluginUrl } = {}) {
    let pluginId = -1;

    if (pluginCode !== undefined) {
      pluginId = this.tryToLoadPluginByCode(pluginCode, pluginName);
    } else if (pluginUrl !== undefined) {
      pluginId = await this.tryToLoadPluginByUrl(pluginUrl, pluginName);
    } else if (pluginName !== undefined) {
      pluginId = await this.tryToLoadPluginByName(pluginName);
    }

    return pluginId;
  }

  /**
   * Tries to load a plugin from the plugin code.
   *
   * @function PluginLoader#tryToLoadPluginByCode
   * @param {(string|Function)} pluginCode Plugin code as `string` or `Function`.
   * @param {string} [pluginName] Optional default plugin name, used only if the
   *  plugin code does not set a name.
   * @returns {number} the ID of the plugin or -1 if it couldn't be loaded.
   * @see PluginLoader#_executePlugin
   */
  tryToLoadPluginByCode(pluginCode, pluginName) {
    const pluginRoom = this.room.getPlugin(pluginName, true);
    pluginRoom._loadedFrom = undefined;
    this._executePlugin(pluginCode, pluginRoom);

    return pluginRoom._id;
  }

  /**
   * Tries to load the given plugin from the configured repositories.
   *
   * @function PluginLoader#tryToLoadPluginByName
   * @param {string} pluginName Name of the plugin to be loaded.
   * @returns {number} The ID of the plugin or -1 if it couldn't be loaded.
   */
  async tryToLoadPluginByName(pluginName) {
    for (let repository of this.repositories) {
      // TODO create specific repository URL
      if (this.repositoryTypeHandlers[repository.type] === undefined) {
        HHM.log.debug(`No handler for repository type ${repository.type}`);
        continue;
      }

      let repositoryResult = this.repositoryTypeHandlers[repository.type](
          repository, pluginName);

      if (repositoryResult === false) {
        HHM.log.debug(`Repository handler ${repository.type} returned false `
          + `for plugin ${pluginName}`);
        continue;
      }

      // Check if it's a URL
      if (repositoryResult.startsWith(`http`)) {
        HHM.log.debug(`Trying to load plugin ${pluginName} from ` +
            `${repository.type} repository: ${repositoryResult}`);

        await this._loadPlugin(repositoryResult, pluginName);
      } else if (repositoryResult.length > 0) {
        // Assume it's plugin code
        await this.tryToLoadPluginByCode(repositoryResult, pluginName);
      }

      if (this.room.hasPlugin(pluginName)) {
        return this.room._pluginManager.getPluginId(pluginName);
      }
    }

    HHM.log.warn(`Unable to load plugin ${pluginName} from configured repositories`);

    return -1;
  }

  /**
   * Tries to load a plugin from the given URL.
   *
   * @function PluginLoader#tryToLoadPluginByUrl
   * @param {string} url Plugin must be served as plain text at this URL.
   * @param {string} [pluginName] Optional default plugin name, which may be
   *  overwritten by the plugin code.
   * @returns {number} The ID of the plugin or -1 if it couldn't be loaded.
   */
  async tryToLoadPluginByUrl(url, pluginName) {
    let pluginId = -1;

    if (typeof pluginName !== `undefined` && this.room.hasPlugin(pluginName)) {
      return this.room._pluginManager.getPluginId(pluginName);
    }

    pluginId = this._loadPlugin(url, pluginName);

    if (pluginId === -1) {
      HHM.log.warn(`Unable to load plugin from URL ${url}`);
    }

    return pluginId;
  }
}

module.exports = PluginLoader;