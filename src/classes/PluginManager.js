const $ = require(`jquery-browserify`);
const PluginLoader = require(`./PluginLoader`);
const TrappedRoomManager = require(`./TrappedRoomManager`);
const { RoomTrapper } = require(`haxball-room-trapper`);
const configError = new Error(`Invalid HHM configuration`);
const startError = new Error(`Error during HHM start`);

/**
 * PluginManager class, core of the HHM system.
 *
 * This class is responsible for managing the plugin and room lifecycle, like
 * dependency management and plugin configuration.
 *
 * @class PluginManager
 * @property {Object.<string, Array.<number>>} dependencies This caches reverse
 *  dependencies, i.e. it's mapping a plugin name to an array of plugin IDs
 *  which depend on it.
 */
class PluginManager {

  constructor() {
    this._class = `PluginManager`;
    this.dependencies = {};
  }

  /**
   * Adds a dependent to the dependencies of the given plugin.
   *
   * This means that the plugin `pluginId` depends on the plugin
   * `dependentName`.
   *
   * @function PluginManager#_addDependent
   * @private
   * @param {number} pluginId ID of the depending plugin.
   * @param {string} dependentName Name of the plugin that's being dependent on.
   */
  _addDependent(pluginId, dependentName) {
    if (!this.dependencies.hasOwnProperty(dependentName)) {
      this.dependencies[dependentName] = [];
    }

    // Do not add duplicates
    if ($.inArray(pluginId, this.dependencies[dependentName]) === -1) {
      this.dependencies[dependentName].push(pluginId);
    }
  }

  /**
   * Adds a plugin by name or by code, and returns the ID of the loaded plugin
   * or -1 if there was an error, or the loadStack if it was given.
   *
   * This function recursively loads a plugin and its dependencies and passes a
   * load stack around which contains IDs of loaded plugins in the load order.
   *
   * When initially calling this function, do not pass a loadStack, the function
   * will then return the ID of the loaded plugin or -1 if there was an error.
   *
   * @function PluginManager#_addPlugin
   * @private
   * @param {string} [pluginName] Name of the plugin, set to `undefined` if you
   *  want to load a plugin by code.
   * @param {(Function|string)} [pluginCode] Plugin code as `Function` or
   *  `string`.
   * @param {Array.<number>} [loadStack] `Array` of loaded plugin IDs in load
   *  order. Used internally during recursion.
   * @returns {Promise<(number|Array.<number>)>} When called without a
   *  `loadStack`, it will return the plugin ID or -1 if the plugin failed to
   *  load, otherwise it will return the updated `loadStack`.
   */
  async _addPlugin(pluginName, pluginCode, loadStack) {
    const initializePlugins = loadStack === undefined;
    loadStack = loadStack || [];
    let pluginId = -1;

    if (pluginName !== undefined && this.room.hasPlugin(pluginName)) {
      // Avoid loading plugins twice
        return loadStack || this.room.getPluginId(pluginName);
    }

    if (pluginCode === undefined) {
      pluginId = await this.pluginLoader.tryToLoadPluginByName(pluginName);
    } else {
      pluginId = this.pluginLoader.tryToLoadPluginByCode(pluginCode, pluginName);
    }

    loadStack = await this._checkPluginAndLoadDependencies(pluginId,
        loadStack);

    const success = loadStack.indexOf(false) === -1;

    if (success) {
      pluginName = this.getPluginName(pluginId);

      // Merge user config
      this._mergeConfig(pluginName, (HHM.config.plugins || {})[pluginName]);

      if (initializePlugins) {
        HHM.log.info(`Loading plugin ${pluginName} and its dependencies`);
        this._executeRoomLinkHandlers(loadStack);
      }
    }

    return initializePlugins ? (success ? pluginId : -1) : loadStack;
  }

  /**
   * Checks whether the given plugin is loaded and loads its dependencies.
   *
   * In case of any errors, the returned array will contain one or more `false`
   * entries.
   *
   * TODO return only false on error?
   *
   * @function PluginManager#_checkPluginAndLoadDependencies
   * @private
   * @param {number} pluginId ID of the plugin.
   * @param {Array.<number>} loadStack `Array` of loaded plugin IDs
   * @returns Promise<Array.<number>> Updated `loadStack` `Array`,
   *  boolean false indicates an error during plugin load, meaning all loaded
   *  plugins will be removed.
   */
  async _checkPluginAndLoadDependencies(pluginId, loadStack) {
    if (!this.hasPluginById(pluginId) || !this._checkPluginsCompatible()) {

      this._removePlugin(pluginId);
      loadStack.push(false);
      return loadStack;
    }

    loadStack.push(pluginId);

    const pluginRoom = this.getPluginById(pluginId);

    const pluginSpec = pluginRoom.getPluginSpec();

    if (!pluginSpec.hasOwnProperty(`dependencies`)) {
      return loadStack;
    }

    let dependencySuccess = true;
    let dependenciesAlreadyLoaded = [];
    for (let dependency of pluginSpec.dependencies) {
      this._addDependent(pluginId, dependency);

      if (this.room.hasPlugin(dependency)) {
        dependenciesAlreadyLoaded.push(dependency);
        continue;
      }

      loadStack = await this._addPlugin(dependency, undefined, loadStack);

      dependencySuccess = loadStack.indexOf(false) === -1
          && this._checkPluginsCompatible();

      if (!dependencySuccess) {
        break;
      }
    }

    // Remove plugin and its dependencies
    if (!dependencySuccess) {
      for (let dependency of pluginSpec.dependencies) {
        if (dependenciesAlreadyLoaded.indexOf(dependency) === -1) {
          this._removePlugin(this.getPluginId(dependency));
        }
      }

      this._removePlugin(pluginId);

      loadStack.push(false);
    }

    return loadStack;
  }

  /**
   * Checks whether incompatible plugins have been loaded.
   *
   * @function PluginManager#_checkPluginsCompatible
   * @private
   * @returns {boolean} `true` if all plugins are compatible with each other,
   *  `false` otherwise
   */
  _checkPluginsCompatible() {
    const pluginIds = Object.getOwnPropertyNames(this.room._plugins);

    for (let pluginId of pluginIds) {
      let pluginRoom = this.getPluginById(pluginId);
      let pluginSpec = pluginRoom.getPluginSpec();

      if (!pluginSpec.hasOwnProperty(`incompatible_with`)) {
        continue;
      }

      for (let incompatiblePluginName of pluginSpec.incompatible_with) {
        const incompatiblePluginId = this.getPluginId(incompatiblePluginName);
        if (incompatiblePluginId in pluginIds) {
          HHM.log.error(`Incompatible plugins: ${pluginId} incompatible with`
              + `${incompatiblePluginName}`);
          HHM.log.error(this._createDependencyChain(this.getPluginName(pluginId)));
          HHM.log.error(this._createDependencyChain(incompatiblePluginName));
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Recursively creates a dependency chain for the given dependency.
   *
   * Strictly for logging purposes.
   *
   * @function PluginManager#_createDependencyChain
   * @private
   * @param {number} dependencyId ID for which to create a dependency chain.
   * @param {Array.<number>} alreadyInChain To avoid endless recursion, the
   *  dependencies already processed are passed along in this `Array`.
   * @returns {string} Dependency chain as a newline-separated string, one line
   *  for each dependency, of the format "X required by Y".
   */
  _createDependencyChain(dependencyId, alreadyInChain = []) {
    if (dependencyId in alreadyInChain) {
      return ``;
    }

    const plugin = this.getPluginById(dependencyId);

    const dependencyName = plugin.getName();

    let result = ``;
    const disabled =  !plugin.isEnabled();

    alreadyInChain.push(dependencyId);

    if (this.dependencies.hasOwnProperty(dependencyName)) {
      // TODO this.dependencies[dependencyId] can be null, debug
      const dependents = this.dependencies[dependencyName].map(
          d => this.getPluginName(d));
      result += `${dependencyName} required by ${dependents}`
          + (disabled ? `(disabled)` : ``) + ".\n";
      for (let subDependency of this.dependencies[dependencyName]) {
        result += this._createDependencyChain(subDependency, alreadyInChain);
      }
    } else {
      result += `${dependencyName} required by user config`
          + (disabled ? `(disabled)` : ``) + ".\n";
    }

    return result;
  }

  /**
   * Recursively enables the given plugin and its dependencies.
   *
   * @function PluginManager#_enablePluginAndDependencies
   * @private
   * @param {number} pluginId ID of the plugin to be enabled.
   * @param {Array.<number>} enabledPlugins Already enabled plugins, to disable
   *  endless recursion.
   * @returns {boolean} `false` if the plugin and its dependencies were already
   *  enabled, `true` otherwise.
   */
  _enablePluginAndDependencies(pluginId, enabledPlugins = []) {
    let dependenciesEnabled = false;
    enabledPlugins.push(pluginId);
    for (let dependency of
        this.getPluginById(pluginId).getPluginSpec().dependencies || []) {

      let dependencyId = this.getPluginId(dependency);

      if (enabledPlugins.indexOf(dependencyId) !== -1) {
        continue;
      }

      dependenciesEnabled = this._enablePluginAndDependencies(
          dependencyId, enabledPlugins) || dependenciesEnabled;
    }

    const pluginIndex = this.room._pluginsDisabled.indexOf(pluginId);
    if (pluginIndex !== -1) {

      const plugin = this.getPluginById(pluginId);

      PluginManager.triggerLocalEvent(plugin, `onEnable`);

      this.room._pluginsDisabled.splice(pluginIndex, 1);

      this.triggerHhmEvent(HHM.events.PLUGIN_ENABLED, {
        plugin: this.getPluginById(pluginId),
      });

      return true;
    }

    return dependenciesEnabled;
  }

  /**
   * Executes the room link handlers of newly loaded plugins.
   *
   * After the `onRoomLink` handler execution order has been determined,
   * handlers / events will be executed / triggered in this order:
   *
   * - `onRoomLink` handler on the plugin
   * - `beforePluginLoaded` HHM event
   * - plugin is then marked as loaded an can process events
   * - `pluginLoaded` HHM event
   *
   * @function PluginManager#_executeRoomLinkHandlers
   * @private
   * @param {Array.<number>} loadStack `Array` of plugin IDs.
   */
  _executeRoomLinkHandlers(loadStack) {

    // Remove duplicates
    loadStack = [...new Set(loadStack)];

    loadStack.forEach((id) => {
      let plugin = this.getPluginById(id);

      // Add dummy onRoomLink handler if none exists, to keep proper execution
      // order
      if (typeof plugin.onRoomLink !== `function`) {
        plugin.onRoomLink = () => {};
      }

      const pluginSpec = plugin.getPluginSpec();

      if (pluginSpec.dependencies === undefined ||
          pluginSpec.dependencies.length === 0) return;

      pluginSpec.order = pluginSpec.order || {};
      const onRoomLinkOrder = pluginSpec.order.onRoomLink || {};
      onRoomLinkOrder.after = onRoomLinkOrder.after || [];

      for (let dependency of pluginSpec.dependencies) {
        // Allow self-dependency to avoid a plugin being disabled
        if (dependency === plugin._name) continue;

        onRoomLinkOrder.after.push(dependency);
      }

      onRoomLinkOrder.after = [...new Set(onRoomLinkOrder.after)];
      pluginSpec.order.onRoomLink = onRoomLinkOrder;
      plugin.pluginSpec = pluginSpec;
    });

    const onRoomLinkExecutionOrder = this.room._trappedRoomManager
        .determineExecutionOrder(loadStack, `onRoomLink`)
        .filter((id) => loadStack.indexOf(id) !== -1);

    HHM.log.info(`Loading the following plugins:`);
    HHM.log.info(onRoomLinkExecutionOrder.map(
        (id) => this.getPluginById(id)._name).join(", "));

    for (let pluginId of onRoomLinkExecutionOrder) {
      let plugin = this.getPluginById(pluginId);

      PluginManager.triggerLocalEvent(plugin, `onRoomLink`, HHM.roomLink);

      this.triggerHhmEvent( HHM.events.BEFORE_PLUGIN_LOADED, {
        plugin: plugin,
      });

      plugin._lifecycle.loaded = true;

      HHM.log.info(`Plugin loaded successfully: ${plugin._name}`);

      this.triggerHhmEvent(HHM.events.PLUGIN_LOADED, {
        plugin: plugin,
      });
    }
  }

  /**
   * Adds event handlers which must be in place before any plugin is loaded.
   *
   * Registers an initial `onRoomLink` handler which will be removed once
   * it has been executed.
   *
   * @function PluginManager#_initializeCoreEventHandlers
   */
  _initializeCoreEventHandlers() {
    this.room.onRoomLink =
        (roomLink) => {
          HHM.roomLink = roomLink;
          delete this.room.onRoomLink;
          HHM.deferreds.roomLink.resolve();
        };
  }

  /**
   * Loads the plugins defined in the user config.
   *
   * @function PluginManager#_loadUserPlugins
   * @private
   * @returns {Promise.<boolean>} Whether loading the user plugins was
   *  successful.
   */
  async _loadUserPlugins() {
    for (let pluginName of Object.getOwnPropertyNames(HHM.config.plugins || {})) {
      await this.addPluginByName(pluginName);

      if (!this.room.hasPlugin(pluginName)) {
        HHM.log.error(`Unable to load user plugin: ${pluginName}`);
        HHM.log.error(`HHM start aborted, please check your config`);
        return false;
      }
    }

    return true;
  }

  /**
   * Merges the given configuration into the configuration for the given plugin.
   *
   * @function PluginManager#_mergeConfig
   * @private
   * @param {string} pluginName Name of the plugin.
   * @param {Object.<string, *>} config Plugin configuration to be merged in.
   */
  _mergeConfig(pluginName, config) {
    if (!this.room.hasPlugin(pluginName) || config === undefined) {
      return;
    }

    $.extend(this.room.getPlugin(pluginName).getConfig(), config);
  }

  /**
   * Executes the `postInit` code from the config if any.
   *
   * @function PluginManager#_postInit
   * @private
   * @returns {Promise.<boolean>} Whether executing the `postInit` code was
   *  successful.
   */
  async _postInit() {
    if (HHM.config.hasOwnProperty(`postInit`) && !HHM.config.dryRun) {
      const postInitPluginId = await this.addPluginByCode(HHM.config.postInit,
          `_user/postInit`);

      if (postInitPluginId < 0) {
        HHM.log.error(`Unable to execute postInit code, please check the code`);

        return false;
      } else {
        const postInitPlugin = this.room._plugins[postInitPluginId];

        HHM.log.info(`postInit code executed`);

        return true;
      }
    }
  }

  /**
   * Removes the room proxy for the given plugin.
   *
   * @function PluginManager#_removePlugin
   * @private
   * @param {number} pluginId ID of the plugin to be removed.
   * @returns {boolean} Whether the removal was successful.
   */
  _removePlugin(pluginId) {

    if (!this.hasPluginById(pluginId)) return false;

    const pluginRoom = this.room._plugins[pluginId];

    delete this.room._plugins[pluginRoom._id];
    delete this.room._pluginIds[pluginRoom._name];
    this.room._pluginsDisabled.splice(
        this.room._pluginsDisabled.indexOf(pluginId), 1);
    this.room._trappedRoomManager.removePluginHandlersAndProperties(pluginId);

    this.triggerHhmEvent(HHM.events.PLUGIN_REMOVED, {
      plugin: pluginRoom,
    });

    return true;
  }

  /**
   * Triggers an event for the given room.
   *
   * @function PluginManager._triggerEventOnRoom
   * @private
   * @param {external:native-api.RoomObject} room Room on which the event
   *  handler will be called.
   * @param {string} eventHandlerName Name of the event handler.
   * @param {Array.<*>} args Event handler arguments.
   */
  static _triggerEventOnRoom(room, eventHandlerName, ...args) {
    if (room.hasOwnProperty(eventHandlerName)) {
      return room[eventHandlerName](...args);
    }

    return true;
  }

  /**
   * Loads the plugin for the given name and its dependencies.
   *
   * @function PluginManager#addPluginByName
   * @param {string} pluginName Name of the plugin.
   * @returns {number} Plugin ID if the plugin and all of its dependencies have
   * been loaded, -1 otherwise.
   */
  async addPluginByName(pluginName) {
    return await this._addPlugin(pluginName);
  }

  /**
   * Loads the plugin and its dependencies from the given code.
   *
   * If you specify a plugin name, it can be overwritten from the loaded plugin
   * code.
   *
   * @function PluginManager#addPluginByCode
   * @param {(Function|string)} pluginCode Plugin code as `Function` or
   *  `string`.
   * @param {string} pluginName Name of the plugin.
   * @returns {number} Plugin ID if the plugin and all of its dependencies have
   * been loaded, -1 otherwise.
   */
  async addPluginByCode(pluginCode, pluginName) {
    return await this._addPlugin(pluginName, pluginCode);
  }

  /**
   * Adds a plugin repository.
   *
   * Convenience wrapper around {@link PluginLoader#addRepository}.
   *
   * @function PluginManager#addRepository
   * @param {(string|Object)} repository The repository to be added, as `string`
   *  or `Object`.
   * @param {boolean} [append] Whether to append or prepend the repository to
   *  the `Array` of repositories.
   * @returns {boolean} Whether the repository was successfully added.
   * @see PluginLoader#addRepository
   */
  addRepository(repository, append  = false) {
    return this.pluginLoader.addRepository(repository, append);
  }

  /**
   * Disables the plugin with the given ID.
   *
   * Before calling this, make sure the plugin can be disabled (i.e. all
   * dependents have been disabled).
   *
   * @function PluginManager#disablePluginById
   * @param {number} pluginId Plugin ID.
   * @returns {boolean} `true` if the plugin has been or was already disabled,
   *  `false` otherwise.
   * @see PluginManager#getDependentPluginsById
   */
  disablePluginById(pluginId) {
    const plugin = this.getPluginById(pluginId);

    // Check if other plugins depend on this one
    if (this.isPluginRequired(pluginId)) {
      HHM.log.warn(`Can't disable plugin ${plugin.getName()}`);
      HHM.log.warn(this._createDependencyChain(plugin.getId(), []));
      return false;
    }

    // Already disabled
    if (this.room._pluginsDisabled.indexOf(plugin) !== -1) {
      return true;
    }

    PluginManager.triggerLocalEvent(plugin, `onDisable`);

    this.room._pluginsDisabled.push(pluginId);

    this.triggerHhmEvent(HHM.events.PLUGIN_DISABLED, {
      plugin: this.getPluginById(pluginId),
    });

    return true;
  }

  /**
   * Enables the given plugin and its dependencies.
   *
   * @function PluginManager#enablePluginById
   * @param {number} pluginId Plugin ID.
   * @returns {boolean} `true` if any plugin was enabled, `false` otherwise.
   */
  enablePluginById(pluginId) {
    return this._enablePluginAndDependencies(pluginId);
  }

  /**
   * Returns an `Array` of plugins that depend on the plugin with the given ID.
   *
   * @function PluginManager#getDependentPluginsById
   * @param {number} pluginId Plugins depending on this plugin will be returned.
   * @param {boolean} [recursive] Whether to recursively plugins that indirectly
   *  depend on the given plugin.
   * @param {boolean} [includeDisabled] Whether to include disabled dependencies.
   * @param {Set} [dependents] Used internally to avoid endless recursion.
   * @returns {Array.<number>} `Array` of plugin IDs which depend on the given
   *  `pluginId`.
   */
  getDependentPluginsById(pluginId, recursive = true, includeDisabled = false,
                          dependents = new Set()) {
    const pluginName = this.getPluginName(pluginId);

    if (this.dependencies[pluginName] === undefined ||
        this.dependencies[pluginName].length === 0) {
      return [];
    }

    let dependencies = includeDisabled ? this.dependencies[pluginName] :
        this.dependencies[pluginName].filter(
            (pluginId) => this.getPluginById(pluginId).isEnabled());

    if (!recursive) {
      return dependencies;
    }

    dependencies.forEach((pluginId) => {
      if (dependents.has(pluginId)) return;
      dependents.add(pluginId);

      dependencies.unshift(...this.getDependentPluginsById(pluginId, true,
          includeDisabled, dependents))
    });

    return [...new Set(dependencies)];
  }

  /**
   * Returns an `Array` of plugin IDs for currently enabled plugins.
   *
   * Note that his only returns plugins which are fully loaded.
   *
   * @function PluginManager#getEnabledPluginIds
   * @returns {Array.<number>} Enabled plugin IDs.
   */
  getEnabledPluginIds() {
    return Object.getOwnPropertyNames(this.room._plugins)
        .map((id) => Number(id))
        .filter((id) => this.getPluginById(id).isEnabled());
  }

  /**
   * Returns an `Array` of all registered handler names.
   *
   * @function PluginManager#getHandlerNames
   * @returns {Array.<string>} Registered handler names.
   */
  getHandlerNames() {
    if (this.room._trappedRoomManager === undefined) {
      return [];
    }

    let handlerNames = [];

    for (let pluginId of
        Object.getOwnPropertyNames(this.room._trappedRoomManager.handlers)) {
      handlerNames = handlerNames.concat(Object.getOwnPropertyNames(
          this.room._trappedRoomManager.handlers[pluginId]));
    }

    return [...new Set(handlerNames)];
  }

  /**
   * Returns an `Array` of loaded plugin IDs.
   *
   * @function PluginManager#getLoadedPluginIds
   * @returns {Array.<number>} Loaded plugin IDs.
   */
  getLoadedPluginIds() {
    return Object.getOwnPropertyNames(this.room._plugins)
        .filter((id) => this.getPluginById(id).isLoaded());
  }

  /**
   * Returns the plugin for the given ID or undefined if no such plugin exists.
   *
   * @function PluginManager#getPluginById
   * @param {number} pluginId Plugin ID.
   * @returns {external:haxball-room-trapper.TrappedRoom} Plugin room proxy.
   */
  getPluginById(pluginId) {
    return this.room._plugins[pluginId];
  }

  /**
   * Returns the trapped room for the given plugin.
   *
   * @function PluginManager#getPluginByName
   * @param {string} [pluginName] Name of the plugin or undefined to create new
   *  plugin.
   * @param {boolean} [create] `true` if a new plugin should be created if it
   *  does not exist. If no `pluginName` was given, this parameter is ignored
   *  and a new plugin is created.
   * @returns {(external:haxball-room-trapper.TrappedRoom|undefined)} Plugin
   *  room proxy or undefined if the plugin was not found and `create` is
   *  `false`.
   */
  getPluginByName(pluginName, create = false) {
    let pluginRoom;
    const hasPlugin = this.hasPluginByName(pluginName);

    if (pluginName === undefined || (create && !hasPlugin)) {
      const id = String(Date.now());
      this.room._plugins[id] =
          this.roomTrapper.createTrappedRoom(this.room, id);
      this.room._plugins[id]._id = id;
      this.room._plugins[id]._name = String(id);
      this.room._plugins[id]._lifecycle = { valid: false, loaded: false };
      pluginRoom = this.room._plugins[id];

      if (pluginName !== undefined) {
        this.room._pluginIds[pluginName] = id;
        this.room._plugins[id]._name = pluginName;
      }
    } else if (hasPlugin) {
      pluginRoom = this.room._plugins[this.room._pluginIds[pluginName]];
    } else {
      HHM.log.error(`Plugin not found: ${pluginName}`);
    }

    return pluginRoom;
  }

  /**
   * Returns a list of plugin dependencies.
   *
   * @TODO convert boolean parameters to destructuring
   *
   * @function PluginManager.getPluginDependencies
   * @param {number} pluginId Dependencies of this plugin are returned.
   * @param {boolean} [recursive] Whether to return dependencies recursively,
   *  or only direct dependencies
   * @param {boolean} [ids] Whether to return IDs instead of names.
   * @returns {Array.<string>} Plugin names or IDs of dependencies of the given
   *  plugin.
   */
  getPluginDependencies(pluginId, recursive = false, ids = false) {
    const plugin = this.getPluginById(pluginId);

    if ((plugin.getPluginSpec().dependencies || []).length === 0) {
      return [];
    }

    const dependencies = [];

    plugin.getPluginSpec().dependencies.forEach((pluginName) => {
      const dependency = this.getPluginByName(pluginName);

      dependencies.push(ids ? dependency._id : dependency._name);

      // Cyclic dependencies only possible on the first level to mark a plugin
      // as "can't be disabled"
      if (recursive && pluginName !== plugin._name) {
        dependencies.push(...this.getDependentPluginsById(
            dependency._id, true, ids));
      }
    });

    return [...new Set(dependencies)];
  }

  /**
   * Returns the ID for the given plugin, or -1 if the plugin does not exist.
   *
   * @function PluginManager#getPluginId
   * @param {string} pluginName Name of the plugin.
   * @returns {number} Plugin ID for the plugin with the given name, or -1 if
   *  no such plugin exists.
   */
  getPluginId(pluginName) {
    return this.room._pluginIds[pluginName] || -1;
  }

  /**
   * Returns the plugin loader of this plugin manager.
   *
   * @function PluginManager#getPluginLoader
   * @returns {PluginLoader} Associated plugin loader.
   */
  getPluginLoader() {
    return this.pluginLoader;
  }

  /**
   * Returns the plugin name for the given ID or the ID if the plugin has no
   * associated name.
   *
   * @function PluginManager#getPluginName
   * @param {number} pluginId ID of the plugin.
   * @returns {(string|number)} Name of the plugin or ID if the plugin has no
   *  name.
   */
  getPluginName(pluginId) {
    if (this.hasPluginById(pluginId)
        && this.room._plugins[pluginId].hasOwnProperty(`_name`)) {
      return this.room._plugins[pluginId]._name;
    }

    return pluginId;
  }

  /**
   * Returns the trapped room manager.
   *
   * @function PluginManager#getRoomManager
   * @returns {TrappedRoomManager} Trapped room manager of this plugin manager.
   */
  getRoomManager() {
    return this.room._trappedRoomManager;
  }

  /**
   * Returns `true` if a plugin with the given ID exists and is valid, `false`
   * otherwise.
   *
   * A plugin is valid if HBInit() has been called and no error happened during
   * plugin execution.
   *
   * @function PluginManager#hasPluginById
   * @param {number} pluginId ID of the plugin.
   * @returns {boolean} Whether a plugin with the given ID exists and is valid.
   */
  hasPluginById(pluginId) {
    return this.room._plugins.hasOwnProperty(pluginId)
        && this.getPluginById(pluginId)._lifecycle.valid;
  }

  /**
   * Returns `true` if the plugin with the given name exists and is valid,
   * `false` otherwise.
   *
   * @function PluginManager#hasPluginByName
   * @param {string} pluginName Name of the plugin.
   * @returns {boolean} Whether a plugin with the given name exists and is
   *  valid.
   * @see PluginManager#hasPluginById
   */
  hasPluginByName(pluginName) {
    return this.hasPluginById(this.getPluginId(pluginName));
  }

  /**
   * Returns true if the plugin is required, false otherwise.
   *
   * A plugin is required if a plugin that is not disabled depends on it.
   *
   * @TODO change implementation so that this checks whether the plugin can
   *    be disabled at all, i.e. whether it depends on itself or if one of its
   *    dependents depends on itself
   *
   * @function PluginManager#isPluginRequired
   * @param {number} pluginId ID of the plugin.
   * @returns Whether an enabled plugin depends on this plugin.
   */
  isPluginRequired(pluginId) {
    const pluginName = this.getPluginById(pluginId)._name;

    // No dependencies, not required
    if (!this.dependencies.hasOwnProperty(pluginName)) {
      return false;
    }

    for (let dependingPlugin of this.dependencies[pluginName]) {
      if (this.room._pluginsDisabled.indexOf(dependingPlugin) === -1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Provides a room object.
   *
   * If no room object was provided, create a new room based on the
   * HHM.config.room configuration, or use an empty object if HHM.config.dryRun
   * is true.
   *
   * The resulting room object is then extended with some basic HHM
   * functionality like access to plugins.
   *
   * @TODO split into provideRoom and decorateRoom or something?
   *
   * @function PluginManager#_provideRoom
   * @private
   * @param {external:native-api.RoomObject} [room]
   * @returns {HhmRoomObject} Extended room object.
   */
  _provideRoom(room) {
    if (HHM.config === undefined) {
      HHM.log.error(`No configuration loaded`);
      return;
    }

    if (room === undefined) {
      if (HHM.config.dryRun) {
        HHM.log.info(`Creating fake room for dry run`);
        room = {};
      } else if (typeof HHM.config.room === `object`) {
        HHM.log.info(`Creating room, gl with the captcha`);
        room = HBInit(HHM.config.room);
      } else {
        HHM.log.warn(`No room config was provided, please call ` +
            `HHM.manager.start(room) once you have created the room`);
        return;
      }
    }

    return require(`../room`).createRoom(room, this);
  }

  /**
   * Sets the given config parameter of the given plugin to the given value.
   *
   * If no parameter name was given, an event will be triggered that the
   * configuration was changed.
   *
   * If an object is passed as the paramName, the whole config will be
   * overwritten and an event will be triggered.
   *
   * @function PluginManager#setPluginConfig
   * @param {number} pluginId Plugin ID.
   * @param {string} [paramName] Name of the configuration parameter.
   * @param {*} [value] New value of the configuration parameter.
   */
  setPluginConfig(pluginId, paramName, value) {
    const plugin = this.getPluginById(pluginId);

    if (typeof paramName !== `string`) {
      if (typeof paramName === `object`) {
        plugin.getPluginSpec().config = paramName;
      }

      PluginManager.triggerLocalEvent(plugin, `onConfigSet`, {});

      return;
    }

    const config = plugin.getConfig();
    let oldValue = config[paramName];
    config[paramName] = value;

    PluginManager.triggerLocalEvent(plugin, `onConfigSet`,
        { paramName: paramName, newValue: value, oldValue: oldValue});
    PluginManager.triggerLocalEvent(plugin, `onConfigSet_${paramName}`,
        { newValue: value, oldValue: oldValue});
  }

  /**
   * Triggers an event with the given handler name and arguments.
   *
   * Calling an event handler directly will only execute the current
   * plugin's event handler, while using this function will trigger all
   * handlers for the given event. To trigger an event, simply use its event
   * handler name.
   *
   * Can also be (ab)used to trigger native events.
   *
   * @function PluginManager#triggerEvent
   * @param {string} eventHandlerName Name of the event handler to be triggered.
   * @param {...*} args Event arguments.
   * @returns {boolean} `false` if one of the event handlers returned `false`,
   *  `true` otherwise.
   * @see PluginManager#_triggerEventOnRoom
   * @see TrappedRoomManager#onExecuteEventHandlers
   */
  triggerEvent(eventHandlerName, ...args) {
    return PluginManager._triggerEventOnRoom(this.room, eventHandlerName,
        ...args);
  }

  /**
   * Trigger an HHM event.
   *
   * TODO documentation, make private?
   *
   * @function PluginManager#triggerHhmEvent
   * @param {string} [eventName] Name of the event.
   * @param {...*} [args] Event arguments.
   */
  triggerHhmEvent(eventName = HHM.events.OTHER, ...args) {
    this.room.triggerEvent(`onHhm_${eventName}`, ...args);
    this.room.triggerEvent(`onHhm`, eventName, ...args);
  }

  /**
   * Triggers an event only for the given plugin.
   *
   * TODO make private?
   *
   * @function PluginManager.triggerLocalEvent
   * @param {external:haxball-room-trapper.TrappedRoom} plugin Plugin room
   *  proxy.
   * @param {string} eventHandlerName Name of the event handler.
   * @param {...*} [args] Event arguments.
   */
  static triggerLocalEvent(plugin, eventHandlerName, ...args) {
    return PluginManager._triggerEventOnRoom(plugin, eventHandlerName, ...args);
  }

  /**
   * Starts the HHM plugin manager.
   *
   * If a room was provided, it will be used, otherwise a new room will be
   * created. If no room and no room config was provided, the start will be
   * aborted.
   *
   * @function PluginManager#start
   * @param {external:native-api.RoomObject} [room] Existing room object.
   * @returns {HhmRoomObject} Extended or newly created room object.
   */
  async start(room) {
    room = this._provideRoom(room);

    if (HHM.config === undefined) {
      HHM.log.error(`No configuration loaded`);
      return;
    }

    HHM.log.info(`HHM bootstrapping complete, config loaded`);

    // No room assumes this is a subsequent call which will await HHM start
    if (room === undefined) {
      await HHM.deferreds.managerStarted.promise();
      return this.room;
    }

    this.room = room;

    this.roomTrapper = new RoomTrapper(new TrappedRoomManager(this.room));

    this.pluginLoader = new PluginLoader(this.room,
        HHM.config.repositories || []);

    this._initializeCoreEventHandlers();

    HHM.log.info(`Waiting for room link`);

    await HHM.deferreds.roomLink.promise();

    await this._addPlugin(`hhm/core`) >= 0 || (() => { throw startError })();

    if (typeof Storage !== `undefined`) {
      HHM.storage = HHM.storage || require(`../storage`);

      await this._addPlugin(`hhm/persistence`) >= 0 ||
          (() => { throw startError })();
    } else {
      HHM.log.warn(`No support for localStorage, persistence is disabled`);
    }

    await this._loadUserPlugins() || (() => { throw startError })();

    HHM.log.info(`Initial user plugins loaded and configured`);

    await this._postInit() || (() => { throw startError })();

    HHM.deferreds.managerStarted.resolve();

    return room;
  }
};

module.exports = PluginManager;
