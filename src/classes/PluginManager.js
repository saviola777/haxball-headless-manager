/**
 * PluginManager module.
 */

const $ = require(`jquery-browserify`);
const PluginLoader = require(`./PluginLoader`);
const TrappedRoomManager = require(`./TrappedRoomManager`);
const { RoomTrapper } = require(`haxball-room-trapper`);
const configError = new Error(`Invalid HHM configuration`);

/**
 * PluginManager class, saviola of the HHM system.
 *
 * This class is responsible for managing the plugin and room lifecycle, like
 * dependency management and plugin configuration.
 */
module.exports = class PluginManager {

  constructor() {
    this._class = `PluginManager`;
    this.dependencies = {};
    this.eventHandlers = { '*' : [] };
  }

  /**
   * Adds a given plugin dependent to the depencencies of the given plugin
   * pluginName.
   *
   * This means that the plugin pluginId depends on the plugin dependentName.
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
   * or false if there was an error, or the loadStack if it was given.
   *
   * This function recursively loads a plugin and its dependencies and passes a
   * load stack around which contains IDs of loaded plugins in the load order.
   *
   * When initially calling this function, do not pass a loadStack, the function
   * will then return the ID of the loaded plugin or false if there was an error
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

    return initializePlugins ? (success ? pluginId : false) : loadStack;
  }

  /**
   * Checks if the given dependency is among the loaded plugins and throw an
   * error if not.
   */
  _checkDependencyLoaded(dependency, pluginNames) {
    if ($.inArray(dependency, pluginNames) === -1) {
      HHM.log.error(`Could not find dependency: ${dependency}`);
      HHM.log.error(this._createDependencyChain(dependency, []));
      throw configError;
    }
  }

  /**
   * Checks whether the given plugin is loaded and loads its dependencies.
   *
   * @return Promise<Array> Array of functions to be executed after plugin load,
   *  in reverse order. Boolean `true` indicates no function for that plugin,
   *  boolean false indicates an error during plugin load, meaning all loaded
   *  plugins will be removed and none of the functions in this array are
   *  executed.
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
   * @return boolean true if all plugins are compatible with each other, false
   *  otherwise
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
   */
  _createDependencyChain(dependencyId, alreadyInChain) {
    if (dependencyId in alreadyInChain) {
      return ``;
    }

    let dependencyName = this.getPluginName(dependencyId);

    let result = ``;
    const disabled =  !this.isPluginEnabled(dependencyId);

    alreadyInChain.push(dependencyId);

    if (this.dependencies.hasOwnProperty(dependencyName)) {
      // TODO this.dependencies[dependencyId] can be null, debug
      const dependents = this.dependencies[dependencyId].map(
          d => this.getPluginName(d));
      result += `${dependencyName} required by ${dependents}`
          + (disabled ? `(disabled)` : ``) + ".\n";
      for (let subDependency of this.dependencies[dependencyId]) {
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
   * @return boolean False if the plugin and its dependencies were already
   *  enabled, true otherwise
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

      dependenciesEnabled = dependenciesEnabled
          || this._enablePluginAndDependencies(dependencyId, enabledPlugins);
    }

    const pluginIndex = this.room._pluginsDisabled.indexOf(pluginId);
    if (pluginIndex !== -1) {

      const plugin = this.getPluginById(pluginId);

      if (plugin.onEnable !== undefined) {
        plugin.onEnable();
      }

      this.room._pluginsDisabled.splice(pluginIndex, 1);


      this.dispatchEvent({
        type: HHM.events.PLUGIN_ENABLED,
        plugin: this.getPluginById(pluginId),
      });

      return true;
    }

    return dependenciesEnabled;
  }

  /**
   * TODO documentation
   */
  _executeRoomLinkHandlers(loadStack) {

    loadStack = [...new Set(loadStack)];

    loadStack.map(id => {
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

      plugin.onRoomLink(HHM.roomLink);

      plugin._lifecycle.loaded = true;

      HHM.log.info(`Plugin loaded successfully: ${plugin._name}`);

      this.dispatchEvent({
        type: HHM.events.PLUGIN_LOADED,
        plugin: plugin,
      });
    }
  }

  /**
   * Adds event handlers which must be in place before any plugin is loaded.
   */
  _initializeCoreEventHandlers() {
    this.registerEventHandler(({ plugin, propertyName, propertyValue }) => {
      // Register plugin name after setting the plugin specification
      if (propertyName === `pluginSpec`) {

        if (propertyValue.hasOwnProperty(`name`)
          && propertyValue.name !== plugin._name) {

          this.room._pluginIds[propertyValue.name] = plugin._id;
          plugin._name = propertyValue.name;

        } else if (plugin._name !== plugin._id) {
          propertyValue.name = plugin._name;
        }

        return true;
      }

      if (propertyName === `_name`) {
        if (plugin.pluginSpec === undefined) {
          plugin.pluginSpec = {};
        }

        plugin.pluginSpec.name = propertyValue;

        return true;
      }
    }, [HHM.events.PROPERTY_SET]);

    this.room.onRoomLink =
        (roomLink) => {
          HHM.roomLink = roomLink;
          HHM.deferreds.roomLink.resolve();
          delete this.room.onRoomLink;
        };
  }

  /**
   * Returns true if the plugin is required, false otherwise.
   *
   * A plugin is required if a plugin that is not disabled depends on it.
   */
  _isRequired(pluginName) {
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
   * Loads the plugins defined in the user config.
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
   */
  _mergeConfig(pluginName, config) {
    if (!this.room.hasPlugin(pluginName) || config === undefined) {
      return;
    }

    $.extend(this.room.getPlugin(pluginName).getPluginConfig(), config);
  }

  /**
   * Executes the postInit code from the config if any.
   */
  async _postInit() {
    if (HHM.config.hasOwnProperty(`postInit`) && !HHM.config.dryRun) {
      const postInitPluginId = await this.addPluginByCode(HHM.config.postInit,
          `_user/postInit`);

      if (postInitPluginId < 0) {
        HHM.log.error(`Unable to execute postInit code, please check the code`);
      } else {
        const postInitPlugin = this.room._plugins[postInitPluginId];

        HHM.log.info(`postInit code executed`);
      }
    }
  }

  /**
   * Removes the room proxy for the given plugin.
   */
  _removePlugin(pluginId) {

    if (!this.hasPluginById(pluginId)) return;

    const pluginRoom = this.room._plugins[pluginId];

    delete this.room._plugins[pluginRoom._id];
    delete this.room._pluginIds[pluginRoom._name];
    this.room._pluginsDisabled.splice(
        this.room._pluginsDisabled.indexOf(pluginId), 1);
    this.room._trappedRoomManager.removePluginHandlersAndProperties(pluginId);

    this.dispatchEvent({
      type: HHM.events.PLUGIN_REMOVED,
      plugin: pluginRoom,
    });
  }

  /**
   * Dispatch the given event.
   *
   * TODO add further data to the event, like plugin manager
   */
  dispatchEvent(event) {

    (this.eventHandlers[event.type] || []).forEach((handler) => handler(event));
    (this.eventHandlers[`*`] || []).forEach((handler) => handler(event));

    this.room.triggerEvent(`HhmEvent_${event.type || HHM.events.OTHER}`, event);
    this.room.triggerEvent(`HhmEvent`, event);
  }

  /**
   * Loads the plugin for the given name and its dependencies.
   *
   * @return Plugin ID if the plugin and all of its dependencies have been loaded,
   * -1 otherwise.
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
   * @return Plugin ID if the plugin and all of its dependencies have been
   * loaded, -1 otherwise.
   */
  async addPluginByCode(pluginCode, pluginName) {
    return await this._addPlugin(pluginName, pluginCode);
  }

  /**
   * Adds a plugin repository.
   */
  addRepository(url, suffix) {
    this.pluginLoader.addRepository(url, suffix);
  }

  /**
   * Disables the plugin with the given ID.
   */
  disablePluginById(pluginId) {
    const pluginName = this.getPluginName(pluginId);

    // Check if other plugins depend on this one
    if (this._isRequired(pluginName)) {
      HHM.log.warn(`Can't disable plugin ${pluginName}`);
      HHM.log.warn(this._createDependencyChain(pluginName, []));
      return false;
    }

    // Already disabled
    if (!this.isPluginEnabled(pluginId)) {
      return true;
    }

    const plugin = this.getPluginById(pluginId);

    if (plugin.onDisable !== undefined) {
      plugin.onDisable();
    }

    this.room._pluginsDisabled.push(pluginId);

    this.dispatchEvent({
      type: HHM.events.PLUGIN_DISABLED,
      plugin: this.getPluginById(pluginId),
    });

    return true;
  }

  /**
   * Enables the given plugin and its dependencies.
   *
   * @return boolean true if any plugin was enabled, false otherwise.
   */
  enablePluginById(pluginId) {
    return this._enablePluginAndDependencies(pluginId);
  }

  /**
   * Returns a list of plugin IDs for currently enabled plugins.
   *
   * Be aware that this list may contain plugins that are not yet fully loaded.
   */
  getEnabledPluginIds() {
    return Object.getOwnPropertyNames(this.room._plugins)
        .filter(id => this.isPluginEnabled(id));
  }

  /**
   * Returns an array of all registered handler names.
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
   * Returns array of loaded plugin IDs.
   */
  getLoadedPluginIds() {
    return Object.getOwnPropertyNames(this.room._plugins);
  }

  /**
   * Returns the plugin for the given ID or undefined if no such plugin exists.
   */
  getPluginById(pluginId) {
    return this.room._plugins[pluginId];
  }

  /**
   * Returns the ID for the given plugin, or -1 if the plugin does not exist.
   */
  getPluginId(pluginName) {
    return this.room._pluginIds[pluginName] || -1;
  }

  /**
   * Returns the plugin loader of this plugin manager.
   */
  getPluginLoader() {
    return this.pluginLoader;
  }

  /**
   * Returns the plugin name for the given ID or the ID if the plugin has no
   * associated name.
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
   */
  getRoomManager() {
    return this.room._trappedRoomManager;
  }

  /**
   * Returns true if a plugin with the given ID exists, false otherwise.
   */
  hasPluginById(pluginId) {
    return this.room._plugins.hasOwnProperty(pluginId)
        && this.room._pluginManager.getPluginById(pluginId)._lifecycle.accessed;
  }

  /**
   * Returns whether the given plugin is enabled.
   */
  isPluginEnabled(pluginId) {
    return this.room._pluginsDisabled.indexOf(pluginId) === -1;
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
   */
  provideRoom(room) {
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
   * Registers a plugin manager event handler.
   *
   * Registers the given handler function for the given event types, or for all
   * events if no event types are specified.
   *
   * For event types see the HHM.events variable.
   */
  registerEventHandler(handler, eventTypes = [`*`]) {
    let eventHandlers = this.eventHandlers;

    eventTypes.forEach((type) => {
      if (!eventHandlers.hasOwnProperty(type)) {
        eventHandlers[type] = [];
      }

      eventHandlers[type].push(handler);
    });

    return this;
  }

  /**
   * Starts the HHM plugin manager.
   *
   * If a room was provided, it will be used, otherwise a new room will be
   * created. If no room and no room config was provided, the start will be
   * aborted.
   */
  async start(room) {
    if (HHM.config === undefined) {
      HHM.log.error(`No configuration loaded`);
      return;
    }

    HHM.log.info(`HHM bootstrapping complete, config loaded`);

    // No room for now, abort
    if (room === undefined) {
      HHM.log.info(`No room provided, not starting the HHM`);
      return;
    }

    this.room = room;

    this.roomTrapper = new RoomTrapper(new TrappedRoomManager(this.room));

    this.pluginLoader = new PluginLoader(this.room,
        HHM.config.repositories || []);

    this._initializeCoreEventHandlers();

    HHM.log.info(`Waiting for room link`);

    await HHM.deferreds.roomLink.promise();

    await this._addPlugin(`hhm/core`);

    if (!await this._loadUserPlugins()) {
      throw Error(`Error during HHM start`);
    }

    HHM.log.info(`Initial user plugins loaded and configured`);

    await this._postInit();

    HHM.deferreds.managerStarted.resolve();

    return room;
  }
};