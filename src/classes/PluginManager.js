const $ = require(`jquery-browserify`);
const EventHandlerExecutionMetadata = require(`./EventHandlerExecutionMetadata`);
const PluginLoader = require(`./PluginLoader`);
const TrappedRoomManager = require(`./TrappedRoomManager`);
const { RoomTrapper } = require(`haxball-room-trapper`);
const configError = new Error(`Invalid HHM configuration`);
const repository = require(`./repository`);

/**
 * PluginManager class, core of the HHM system.
 *
 * This class is responsible for managing the plugin and room lifecycle, like
 * dependency management and plugin configuration.
 *
 * @class PluginManager
 * @property {Map.<string, Array.<number>>} dependencies This caches reverse
 *  dependencies, i.e. it's mapping a plugin name to an array of plugin IDs
 *  which depend on it.
 * @property {Map.<number, external:haxball-room-trapper.TrappedRoom>} plugins
 *  Maps plugin IDs to trapped room instances.
 * @property {Array.<number>} pluginsDisabled Array of disabled plugin IDs.
 * @property {Map.<string, number>} pluginIds Maps plugin names to plugin IDs.
 */
class PluginManager {

  constructor() {
    this._class = `PluginManager`;
    this.dependencies = new Map();
    this.repositoryFactory = new repository.RepositoryFactory(
        require(`../repository`));
    this.plugins = new Map();
    this.pluginsDisabled = [];
    this.pluginIds = new Map();
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
    if (!this.dependencies.has(dependentName)) {
      this.dependencies.set(dependentName, []);
    }

    const dependencies = this.dependencies.get(dependentName);

    // Do not add duplicates
    if ($.inArray(pluginId, dependencies) === -1) {
      dependencies.push(pluginId);
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
   * @function PluginManager#addPlugin
   * @async
   * @param {Object} [pluginInfo] Plugin information like name, url, or code.
   *  At least one of URL, code or name has to be given
   * @param {string} [pluginName] Name of the plugin, set to `undefined` if
   *  you want to load a plugin by code.
   * @param {(Function|string)} [pluginCode] Plugin code as `Function` or
   *  `string`.
   * @param {Array.<number>} [loadStack] `Array` of loaded plugin IDs in load
   *  order. Used internally during recursion.
   * @returns {Promise<(number|Array.<number>)>} When called without a
   *  `loadStack`, it will return the plugin ID or -1 if the plugin failed to
   *  load, otherwise it will return the updated `loadStack`.
   */
  async addPlugin({ pluginName, pluginCode } = {}, loadStack) {
    const initializePlugins = loadStack === undefined;
    loadStack = loadStack || [];

    if (pluginName !== undefined && this.room.hasPlugin(pluginName)) {
      // Avoid loading plugins twice
        return loadStack || this.getPluginId(pluginName);
    }

    const pluginId = await this.pluginLoader.tryToLoadPlugin(
        { pluginName, pluginCode });

    loadStack = await this._checkPluginAndLoadDependencies(pluginId, loadStack);

    const success = loadStack.indexOf(false) === -1;

    if (success) {
      pluginName = this.getPluginName(pluginId);

      // Merge user config
      this._mergeConfig(pluginName,
          (HHM.config.plugins || {})[pluginName]);

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
   * @async
   * @private
   * @param {number} pluginId ID of the plugin.
   * @param {Array.<number>} loadStack `Array` of loaded plugin IDs
   * @returns {Promise.<Array.<number>>} Updated `loadStack` `Array`,
   *  boolean false indicates an error during plugin load, meaning all loaded
   *  plugins will be removed.
   */
  async _checkPluginAndLoadDependencies(pluginId, loadStack) {
    if (!this.hasPlugin(pluginId) || !this._checkPluginsCompatible()) {

      this.removePlugin(pluginId);
      loadStack.push(false);
      return loadStack;
    }

    loadStack.push(pluginId);

    const pluginRoom = this.getPlugin(pluginId);

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

      loadStack = await this.addPlugin({ pluginName: dependency }, loadStack);

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
          this.removePlugin(this.getPluginId(dependency));
        }
      }

      this.removePlugin(pluginId);

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
    const pluginIds = this.plugins.keys();

    for (let pluginId of pluginIds) {
      let pluginRoom = this.getPlugin(pluginId);
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

    const plugin = this.getPlugin(dependencyId);

    const dependencyName = plugin.getName();

    let result = ``;
    const disabled =  !plugin.isEnabled();

    alreadyInChain.push(dependencyId);

    if (this.dependencies.has(dependencyName)) {
      // TODO this.dependencies[dependencyId] can be null, debug
      const dependents = this.dependencies.get(dependencyName).map(
          d => this.getPluginName(d));
      result += `${dependencyName} required by ${dependents}`
          + (disabled ? `(disabled)` : ``) + ".\n";
      for (let subDependency of this.dependencies.get(dependencyName)) {
        result += this._createDependencyChain(subDependency, alreadyInChain);
      }
    } else {
      result += `${dependencyName} required by user config`
          + (disabled ? `(disabled)` : ``) + ".\n";
    }

    return result;
  }

  /**
   * Creates the initial user repositories.
   *
   * @function PluginManager#_createInitialRepositories
   * @private
   * @async
   * @param {Array.<object.<*>>} userRepositoryConfigs Array of user repository
   *  configuration objects.
   * @returns {Promise.<Array.<repository.Repository>>} Array of created
   *  repository objects.
   */
  async _createInitialRepositories(userRepositoryConfigs) {
    const repositories = [];

    for (let i = 0; i < userRepositoryConfigs.length; i++) {
      try {
        repositories.push(await this.repositoryFactory.createRepository(
            userRepositoryConfigs[i]));
      } catch (e) {
        HHM.log.error(`Error during repository creation for user repository at `
          + `index ${i}. ${e.name}: ${e.message}`);
      }
    }

    return repositories;
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
   *  enabled or the plugin does not exist, `true` otherwise.
   */
  _enablePluginAndDependencies(pluginId, enabledPlugins = []) {
    if (!this.hasPlugin(pluginId)) {
      return false;
    }

    let dependenciesEnabled = false;
    enabledPlugins.push(pluginId);
    for (let dependency of
        this.getPlugin(pluginId).getPluginSpec().dependencies || []) {

      let dependencyId = this.getPluginId(dependency);

      if (enabledPlugins.indexOf(dependencyId) !== -1) {
        continue;
      }

      dependenciesEnabled = this._enablePluginAndDependencies(
          dependencyId, enabledPlugins) || dependenciesEnabled;
    }

    const pluginIndex = this.pluginsDisabled.indexOf(pluginId);
    if (pluginIndex !== -1) {

      const plugin = this.getPlugin(pluginId);

      this.triggerLocalEvent(plugin, `onEnable`);

      this.pluginsDisabled.splice(pluginIndex, 1);

      this.triggerHhmEvent(HHM.events.PLUGIN_ENABLED, {
        plugin: this.getPlugin(pluginId),
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
      let plugin = this.getPlugin(id);

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
        (id) => this.getPlugin(id)._name).join(", "));

    for (let pluginId of onRoomLinkExecutionOrder) {
      let plugin = this.getPlugin(pluginId);

      this.triggerLocalEvent(plugin, `onRoomLink`, HHM.roomLink);

      this.triggerHhmEvent(HHM.events.BEFORE_PLUGIN_LOADED, {
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
   * Returns the plugin ID and name for the given plugin name or ID.
   *
   * @function PluginManager#_extractPluginNameAndId
   * @param {(string|number)} pluginIdOrName Plugin ID or name
   */
  _extractPluginNameAndId(pluginIdOrName) {
    if (typeof pluginIdOrName === `number`) {
      return {
        pluginId: pluginIdOrName,
        pluginName: this.getPluginName(pluginIdOrName),
      };
    }

    return {
      pluginId: this.getPluginId(pluginIdOrName),
      pluginName: pluginIdOrName,
    };
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
   * @async
   * @private
   * @returns {Promise.<boolean>} Whether loading the user plugins was
   *  successful.
   */
  async _loadUserPlugins() {
    for (let pluginName of Object.getOwnPropertyNames(HHM.config.plugins || {})) {
      await this.addPlugin({ pluginName });

      if (!this.room.hasPlugin(pluginName)) {
        HHM.log.warn(`Unable to load user plugin: ${pluginName}`);
      }
    }
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
   * @async
   * @private
   * @returns {Promise.<boolean>} Whether executing the `postInit` code was
   *  successful.
   */
  async _postInit() {
    if (HHM.config.hasOwnProperty(`postInit`) && !HHM.config.dryRun) {
      const postInitPluginId = await this.addPlugin({
          pluginName: `_user/postInit`,
          pluginCode: HHM.config.postInit,
      });

      if (postInitPluginId < 0) {
        HHM.log.error(`Unable to execute postInit code, please check the code`);

        return false;
      } else {
        const postInitPlugin = this.plugins.get(postInitPluginId);

        HHM.log.info(`postInit code executed`);

        return true;
      }
    }
  }

  /**
   * Reloads the given plugin from the configured repositories.
   *
   * To accomplish this, the following things happen:
   *
   *  - all plugins that depend on this plugin are recursively disabled unless
   *    safe is set to false
   *  - the given plugin is disabled and removed
   *  - the given plugin is re-added from the configured repositories
   *  - the dependent plugins are re-enabled unless safe is set to false
   *
   * @function PluginManager#reloadPlugin
   * @param {string} pluginName Plugin name to be reloaded.
   * @param {boolean} [safe] Whether to disable dependent plugins before
   *  unloading the given plugin.
   * @returns {boolean} Whether the plugin was successfully reloaded
   * @throws {Error} If the given plugin is not loaded or if safe mode was
   *  enabled but the plugin can't be disabled.
   */
  async reloadPlugin(pluginName, safe = true) {
    if (!this.hasPlugin(pluginName)) {
      throw new Error(`Plugin ${pluginName} is not loaded`);
    }

    const pluginId = this.getPluginId(pluginName);

    let dependentPlugins = [];

    if (safe) {
      if (!this.canPluginBeDisabled(pluginId)) {
        throw new Error(`Plugin ${pluginName} can't be safely reloaded`);
      }

      dependentPlugins = this.disablePlugin(pluginId, true)
          .filter(id => id != pluginId).reverse();
    }

    this.removePlugin(pluginId);

    const newPluginId = await this.addPlugin({ pluginName });

    if (safe) {
      for (let dependentId of dependentPlugins) {
        this.enablePlugin(dependentId);
      }
    }

    return newPluginId !== -1;
  }

  /**
   * Removes the room proxy for the given plugin.
   *
   * @function PluginManager#removePlugin
   * @param {number} pluginId ID of the plugin to be removed.
   * @returns {boolean} Whether the removal was successful.
   */
  removePlugin(pluginId) {

    if (!this.hasPlugin(pluginId)) return false;

    const pluginRoom = this.plugins.get(pluginId);

    this.plugins.delete(pluginRoom._id);
    this.pluginIds.delete(pluginRoom._name);
    this.pluginsDisabled.splice(
        this.pluginsDisabled.indexOf(pluginId), 1);
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
   * @async
   * @param {string} pluginName Name of the plugin.
   * @deprecated Please use #addPlugin instead
   * @returns {Promise.<number>} Plugin ID if the plugin and all of its
   *  dependencies have been loaded, -1 otherwise.
   */
  async addPluginByName(pluginName) {
    return this.addPlugin({ pluginName });
  }

  /**
   * Loads the plugin and its dependencies from the given code.
   *
   * If you specify a plugin name, it can be overwritten from the loaded plugin
   * code.
   *
   * @function PluginManager#addPluginByCode
   * @async
   * @param {(Function|string)} pluginCode Plugin code as `Function` or
   *  `string`.
   * @param {string} pluginName Name of the plugin.
   * @deprecated Please use #addPlugin instead
   * @returns {Promise.<number>} Plugin ID if the plugin and all of its
   *  dependencies have been loaded, -1 otherwise.
   */
  async addPluginByCode(pluginCode, pluginName) {
    return this.addPlugin({ pluginName, pluginCode });
  }

  /**
   * Disables the plugin with the given ID.
   *
   * Before calling this, make sure the plugin can be disabled (i.e. all
   * dependents have been disabled) or set `recursive` to `true`.
   *
   * @function PluginManager#disablePluginById
   * @param {number} pluginId Plugin ID.
   * @param {boolean} [recursive] Whether to recursively disable plugins which
   *  depend on the given plugin.
   * @deprecated Use #disablePlugin instead
   * @returns {array.<number>} Array of disabled plugin IDs or empty array if
   *  the plugin could not be disabled or was already disabled.
   * @see PluginManager#getDependentPlugins
   */
  disablePluginById(pluginId, recursive = false) {
    return this.disablePlugin(pluginId, recursive);
  }

  /**
   * Disables the plugin with the given ID or name.
   *
   * Before calling this, make sure the plugin can be disabled (i.e. all
   * dependents have been disabled) or set `recursive` to `true`.
   *
   * @function PluginManager#disablePlugin
   * @param {(number|string)} pluginIdOrName Plugin ID or name.
   * @param {boolean} [recursive] Whether to recursively disable plugins which
   *  depend on the given plugin.
   * @param {array.<number>} [pluginIdStack] Used internally to avoid infinite
   *  recursion.
   * @returns {array.<number>} Array of disabled plugin IDs or empty array if
   *  the plugin could not be disabled or was already disabled.
   * @see PluginManager#getDependentPlugins
   */
  disablePlugin(pluginIdOrName, recursive = false, pluginIdStack = []) {
    const { pluginId } = this._extractPluginNameAndId(pluginIdOrName);
    const plugin = this.getPlugin(pluginId);
    const disabledPlugins = [];

    // Already disabled or can't be disabled
    if (this.pluginsDisabled.indexOf(pluginId) !== -1
        || pluginIdStack.indexOf(pluginId) !== -1
        || !this.canPluginBeDisabled(pluginId)) {
      return disabledPlugins;
    }

    pluginIdStack.push(pluginId);

    const dependents = this.getDependentPlugins(pluginId);

    // Check if other plugins depend on this one
    if (dependents.length > 0) {

      if (!recursive) {
        HHM.log.warn(`Can't disable plugin ${plugin.getName()}`);
        HHM.log.warn(this._createDependencyChain(plugin.getId(), []));
        return disabledPlugins;
      }

      // Disable dependent plugins
      for (let dependentId of dependents) {
        disabledPlugins.push(...this.disablePlugin(dependentId, true,
            pluginIdStack));
      }
    }

    this.triggerLocalEvent(plugin, `onDisable`);

    disabledPlugins.push(pluginId);
    this.pluginsDisabled.push(pluginId);

    this.triggerHhmEvent(HHM.events.PLUGIN_DISABLED, {
      plugin: this.getPlugin(pluginId),
    });

    return disabledPlugins;
  }

  /**
   * Enables the given plugin and its dependencies.
   *
   * @function PluginManager#enablePlugin
   * @param {(number|string)} pluginIdOrName Plugin ID or name.
   * @returns {boolean} `true` if any plugin was enabled, `false` otherwise.
   */
  enablePlugin(pluginIdOrName) {
    const { pluginId } = this._extractPluginNameAndId(pluginIdOrName);

    return this._enablePluginAndDependencies(pluginId);
  }

  /**
   * Enables the given plugin and its dependencies.
   *
   * @function PluginManager#enablePluginById
   * @param {number} pluginId Plugin ID.
   * @deprecated Use #enablePlugin instead
   * @returns {boolean} `true` if any plugin was enabled, `false` otherwise.
   */
  enablePluginById(pluginId) {
    return this.enablePlugin(pluginId);
  }

  /**
   * Returns an `Array` of plugins that depend on the plugin with the given ID.
   *
   * @function PluginManager#getDependentPlugins
   * @param {(number|string)} pluginIdOrName Id or name of the plugin whose
   *  dependents will be returned.
   * @param {boolean} [recursive] Whether to recursively plugins that indirectly
   *  depend on the given plugin.
   * @param {boolean} [includeDisabled] Whether to include disabled dependencies.
   * @param {Set} [dependents] Used internally to avoid endless recursion.
   * @returns {Array.<number>} `Array` of plugin IDs which depend on the given
   *  `pluginId`.
   */
  getDependentPlugins(pluginIdOrName, recursive = true, includeDisabled = false,
                          dependents = new Set()) {
    const { pluginName } =
        this._extractPluginNameAndId(pluginIdOrName);

    if (!this.dependencies.has(pluginName) ||
        this.dependencies.get(pluginName).length === 0) {
      return [];
    }

    let dependencies = includeDisabled ? this.dependencies.get(pluginName) :
        this.dependencies.get(pluginName).filter(
            (pluginId) => this.getPlugin(pluginId).isEnabled());

    if (!recursive) {
      return dependencies;
    }

    dependencies.forEach((id) => {
      if (dependents.has(id)) return;
      dependents.add(id);

      dependencies.push(...this.getDependentPlugins(id, true,
          includeDisabled, dependents));
    });

    return [...new Set(dependencies)].reverse();
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
   * @deprecated Use #getDependentPlugins instead
   * @returns {Array.<number>} `Array` of plugin IDs which depend on the given
   *  `pluginId`.
   */
  getDependentPluginsById(pluginId, recursive = true, includeDisabled = false,
                          dependents = new Set()) {
    return this.getDependentPlugins(pluginId, recursive, includeDisabled,
        dependents);
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
    return Array.from(this.plugins.keys())
        .filter((id) => this.getPlugin(id).isEnabled());
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

    for (let pluginId of Object.getOwnPropertyNames(
        this.room._trappedRoomManager.handlers)) {

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
    return Array.from(this.plugins.keys())
        .filter((id) => this.getPlugin(id).isLoaded());
  }

  /**
   * Returns the plugin for the given ID or name, or undefined if no such
   * plugin exists.
   *
   * @function PluginManager#getPlugin
   * @param {(number|string)} pluginIdOrName Plugin ID or name or undefined to
   *  create a new plugin.
   * @param {boolean} [create] `true` if a new plugin should be created if it
   *  does not exist. If no `pluginName` was given, this parameter is ignored
   *  and a new plugin is created.
   * @returns {(external:haxball-room-trapper.TrappedRoom|undefined)} Plugin
   *  room proxy or undefined if the plugin was not found and `create` is
   *  `false`.
   */
  getPlugin(pluginIdOrName, create = false) {
    const { pluginId, pluginName } =
        this._extractPluginNameAndId(pluginIdOrName);

    if (pluginId !== -1) {
      return this.plugins.get(pluginId);
    }

    let pluginRoom;
    const hasPlugin = this.hasPlugin(pluginName);

    if (pluginName === undefined || (create && !hasPlugin)) {
      const id = Date.now();
      this.plugins.set(id,
          this.roomTrapper.createTrappedRoom(this.room, id));
      pluginRoom = this.plugins.get(id);
      pluginRoom._id = id;
      pluginRoom._name = String(id);
      pluginRoom._lifecycle = { valid: false, loaded: false };

      if (pluginName !== undefined) {
        this.pluginIds.set(pluginName, id);
        pluginRoom._name = pluginName;
      }
    } else if (hasPlugin) {
      pluginRoom = this.plugins.get(this.getPluginId(pluginName));
    }

    return pluginRoom;
  }

  /**
   * Returns the plugin for the given ID or undefined if no such plugin exists.
   *
   * @function PluginManager#getPluginById
   * @param {number} pluginId Plugin ID.
   * @deprecated use #getPlugin instead
   * @returns {external:haxball-room-trapper.TrappedRoom} Plugin room proxy.
   */
  getPluginById(pluginId) {
    return this.getPlugin(pluginId);
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
   * @deprecated use #getPlugin instead
   * @returns {(external:haxball-room-trapper.TrappedRoom|undefined)} Plugin
   *  room proxy or undefined if the plugin was not found and `create` is
   *  `false`.
   */
  getPluginByName(pluginName, create = false) {
    return this.getPlugin(pluginName, create);
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
    const plugin = this.getPlugin(pluginId);

    if ((plugin.getPluginSpec().dependencies || []).length === 0) {
      return [];
    }

    const dependencies = [];

    plugin.getPluginSpec().dependencies.forEach((pluginName) => {
      const dependency = this.getPlugin(pluginName);

      dependencies.push(ids ? dependency._id : dependency._name);

      // Cyclic dependencies only possible on the first level to mark a plugin
      // as "can't be disabled"
      if (recursive && pluginName !== plugin._name) {
        dependencies.push(...this.getDependentPlugins(
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
    return this.pluginIds.get(pluginName) || -1;
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
   * @returns {string} Name of the plugin or ID as string if the plugin has no
   *  name.
   */
  getPluginName(pluginId) {
    return this.plugins.has(pluginId) ? this.plugins.get(pluginId)._name
        : String(pluginId);
  }

  /**
   * Returns the plugin repository factory.
   *
   * @function PluginManager#getPluginRepositoryFactory
   * @returns {repository.RepositoryFactory} Plugin repository factory.
   */
  getPluginRepositoryFactory() {
    return this.repositoryFactory;
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
   * Returns `true` if a plugin with the given ID or name exists and is valid,
   * `false` otherwise.
   *
   * A plugin is valid if HBInit() has been called and no error happened during
   * plugin execution.
   *
   * @function PluginManager#hasPlugin
   * @param {(number|string)} pluginIdOrName ID of the plugin.
   * @returns {boolean} Whether a plugin with the given ID exists and is valid.
   */
  hasPlugin(pluginIdOrName) {
    // Prevent infinite recursion in case of plugin ID
    const pluginId = typeof pluginIdOrName === `number` ? pluginIdOrName :
        this._extractPluginNameAndId(pluginIdOrName).pluginId;

    return this.plugins.has(pluginId)
        && this.plugins.get(pluginId)._lifecycle.valid;
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
   * @deprecated use #hasPlugin instead
   * @returns {boolean} Whether a plugin with the given ID exists and is valid.
   */
  hasPluginById(pluginId) {
    return this.hasPlugin(pluginId);
  }

  /**
   * Returns `true` if the plugin with the given name exists and is valid,
   * `false` otherwise.
   *
   * @function PluginManager#hasPluginByName
   * @param {string} pluginName Name of the plugin.
   * @deprecated use #hasPlugin instead
   * @returns {boolean} Whether a plugin with the given name exists and is
   *  valid.
   * @see PluginManager#hasPlugin
   */
  hasPluginByName(pluginName) {
    return this.hasPlugin(pluginName);
  }

  /**
   * Returns whether the given plugin is enabled.
   */
  isPluginEnabled(pluginIdOrName) {
    const { pluginId, pluginName } =
        this._extractPluginNameAndId(pluginIdOrName);

    return this.hasPlugin(pluginId) &&
        this.getPlugin(pluginId).isEnabled();
  }

  /**
   * Returns true if the plugin can be disabled, false otherwise.
   *
   * A plugin can be disabled if it does not depend on itself and if all of the
   * plugins that depend on it can be disabled.
   *
   * @function PluginManager#canPluginBeDisabled
   * @param {number} pluginIdOrName ID or name of the plugin.
   * @returns {boolean} Whether an enabled plugin depends on this plugin.
   */
  canPluginBeDisabled(pluginIdOrName) {
    const { pluginId } = this._extractPluginNameAndId(pluginIdOrName);

    const dependentPlugins = this.getDependentPlugins(pluginId, false);

    return !(dependentPlugins.indexOf(pluginId) !== -1
        || dependentPlugins.some((id) => !this.canPluginBeDisabled(id)));
  }

  /**
   * Provides a room object.
   *
   * If no room object was provided, create a new room based on the
   * HHM.config.room configuration.
   *
   * The resulting room object is then extended with some basic HHM
   * functionality like access to plugins.
   *
   * @TODO split into provideRoom and decorateRoom or something?
   *
   * @function PluginManager#_provideRoom
   * @private
   * @param {external:native-api.RoomObject} [room]
   * @returns {(HhmRoomObject|undefined)} Extended room object.
   */
  _provideRoom(room) {

    if (room === undefined) {
      if (typeof HHM.config.room === `object`) {
        HHM.log.info(`Creating room, gl with the captcha`);
        room = HBInit(HHM.config.room);
      } else {
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
   * @param {(number|string)} pluginIdOrName Plugin ID or name.
   * @param {string} [paramName] Name of the configuration parameter.
   * @param {*} [value] New value of the configuration parameter.
   */
  setPluginConfig(pluginIdOrName, paramName, value) {
    const { pluginId } = this._extractPluginNameAndId(pluginIdOrName);

    const plugin = this.getPlugin(pluginId);

    if (typeof paramName !== `string`) {
      if (typeof paramName === `object`) {
        plugin.getPluginSpec().config = paramName;
      }

      this.triggerLocalEvent(plugin, `onConfigSet`, {});

      return;
    }

    const config = plugin.getConfig();
    let oldValue = config[paramName];
    config[paramName] = value;

    this.triggerLocalEvent(plugin, `onConfigSet`,
        { paramName, newValue: value, oldValue});
    this.triggerLocalEvent(plugin, `onConfigSet_${paramName}`,
        { newValue: value, oldValue});
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
   * @TODO documentation, make private?
   *
   * @function PluginManager#triggerHhmEvent
   * @param {string} [eventName] Name of the event.
   * @param {Object} [args] Event arguments.
   */
  triggerHhmEvent(eventName = HHM.events.OTHER, args) {
    $.extend(args, { eventName });
    this.triggerEvent(`onHhm_${eventName}`, args);
    this.triggerEvent(`onHhm`, args);
  }

  /**
   * Triggers an event only for the given plugin.
   *
   * A corresponding HHM event will be triggered as well.
   *
   * @TODO make private?
   *
   * @function PluginManager#triggerLocalEvent
   * @param {external:haxball-room-trapper.TrappedRoom} plugin Plugin room
   *  proxy.
   * @param {string} eventHandlerName Name of the event handler.
   * @param {...*} [args] Event arguments.
   */
  triggerLocalEvent(plugin, eventHandlerName, ...args) {
    const eventHandlerObject = plugin.getEventHandlerObject(eventHandlerName);
    let metadata = new EventHandlerExecutionMetadata(eventHandlerName);

    if (eventHandlerObject !== undefined) {
      metadata = eventHandlerObject.execute(...args);
    }

    this.triggerHhmEvent(HHM.events.LOCAL_EVENT, { plugin,
      localEventName: eventHandlerName, localEventArgs: args,
      metadata,
    });
  }

  /**
   * Starts the HHM plugin manager.
   *
   * If a room was provided, it will be used, otherwise a new room will be
   * created. If no room and no room config was provided, the start will be
   * aborted.
   *
   * @function PluginManager#start
   * @async
   * @param {external:native-api.RoomObject} [room] Existing room object.
   * @returns {Promise.<(HhmRoomObject|boolean)>} Extended or newly created room
   *  object or false if no config was loaded.
   */
  async start(room) {
    if (HHM.config === undefined) {
      return false;
    }

    room = this._provideRoom(room);

    HHM.log.info(`HHM bootstrapping complete, config loaded`);

    // No room assumes there was no room config, so we wait for the next call
    // to start() and return the room afterwards
    if (room === undefined) {
      await HHM.deferreds.managerStarted.promise();
      return this.room;
    }

    this.room = room;

    this.roomTrapper = new RoomTrapper(new TrappedRoomManager(this.room));

    this._initializeCoreEventHandlers();

    this.pluginLoader = new PluginLoader(this.room,
        await this._createInitialRepositories(HHM.config.repositories || []));

    HHM.log.info(`Waiting for room link`);

    await HHM.deferreds.roomLink.promise();

    await this.addPlugin({ pluginName: `hhm/core` }) >= 0 ||
        (() => { throw new Error(
            `Error during HHM start: unable to load hhm/core plugin`); })();

    if (typeof Storage !== `undefined`) {
      HHM.storage = HHM.storage || require(`../storage`);

      await this.addPlugin({ pluginName: `hhm/persistence` }) >= 0 ||
          (() => { throw new Error(`Error during HHM start: unable to load `
            + `hhm/persistence plugin`); })();
    } else {
      HHM.log.warn(`No support for localStorage, persistence is disabled`);
    }

    await this._loadUserPlugins();

    HHM.log.info(`Initial user plugins loaded and configured`);

    await this._postInit() || (() => {
      throw new Error(`Error during HHM start, _postInit failed`); })();

    HHM.deferreds.managerStarted.resolve();

    return room;
  }
}

module.exports = PluginManager;
