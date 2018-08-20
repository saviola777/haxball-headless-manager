/**
 * PluginManager module.
 */

const $ = require(`jquery-browserify`);
const config = require(`./ui/config`);
const ui = require(`./ui/index`);
const PluginLoader = require(`./PluginLoader`);
const EventHandlerManager = require(`./TrappedRoomManager`);
const TrappedRoomManager = require(`./TrappedRoomManager`);
const RoomTrapper = require(`@haxroomie/RoomTrapper`);
const configError = new Error(`Invalid HHM configuration`);

/**
 * PluginManager class, saviola of the HHM system.
 *
 * This class is responsible for managing the plugin and room lifecycle, like
 * dependency management and plugin configuration.
 */
module.exports = class PluginManager {

  constructor() {
    this.dependencies = {};
    this.observers = [];
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
   * Checks whether the given plugin is loaded and loads its dependencies.
   *
   * @return Promise<boolean> true if the plugin and all of its dependencies
   * were loaded, false otherwise.
   */
  async _addPlugin(pluginId) {
    if (!this.pluginLoader._checkPluginLoaded(pluginId)
        || !this._checkPluginsCompatible()) {
      this._removePlugin(pluginId);
      return false;
    }

    const pluginRoom = this.getPluginById(pluginId);

    const pluginSpec = pluginRoom.getPluginSpec();

    if (!pluginSpec.hasOwnProperty(`dependencies`)) {
      return true;
    }

    let dependencySuccess = true;
    let dependenciesAlreadyLoaded = [];
    for (let dependency of pluginSpec.dependencies) {
      this._addDependent(pluginId, dependency);

      if (this.room.hasPlugin(dependency)) {
        dependenciesAlreadyLoaded.push(dependency);
        continue;
      }

      dependencySuccess = await this.addPluginByName(dependency)
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

      return false;
    }

    return true;
  }

  /**
   * Make sure that all dependencies are loaded.
   *
   * If any dependency is not satisfied, an exception will be thrown.
   *
   * TODO needed? All dependencies should be satisfied at all times
   * automatically now
   *
   * @see _checkDependencyLoaded
   */
  _checkDependencies() {
    const pluginNames = Object.getOwnPropertyNames(this.room._plugins);

    // Check user config plugins
    for (let pluginName of Object.getOwnPropertyNames(HHM.config.plugins))
    {
      this._checkDependencyLoaded(pluginName, pluginNames);
    }

    for (let pluginName of pluginNames) {
      let pluginRoom = this.room._plugins[pluginName];
      let pluginSpec = pluginRoom.getPluginSpec();

      if (!pluginSpec.hasOwnProperty(`dependencies`)) {
        continue;
      }

      for (let dependency of
          Object.getOwnPropertyNames(pluginSpec.dependencies)) {
        this._checkDependencyLoaded(dependency, pluginNames);
      }
    }

    return true;
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
      const dependents = this.dependencies[dependencyId].map(
          (d) => this.getPluginName(d));
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
   * @return False if the plugin and its dependencies were already enabled,
   *  true otherwise
   */
  _enablePluginAndDependencies(pluginId) {
    let dependenciesEnabled = false;
    for (let dependency of
        this.getPluginById(pluginId).getPluginSpec().dependencies || []) {
        dependenciesEnabled = dependenciesEnabled
            || this._enablePluginAndDependencies(this.getPluginId(dependency));
    }

    const pluginIndex = this.room._pluginsDisabled.indexOf(pluginId);
    if (pluginIndex !== -1) {
      this.room._pluginsDisabled.splice(pluginIndex, 1);
      return true;
    }

    return dependenciesEnabled;
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

  async _loadUserPlugins() {
    for (let pluginName of Object.getOwnPropertyNames(HHM.config.plugins || {})) {
      await this.addPluginByName(pluginName);
      this._mergeConfig(pluginName, HHM.config.plugins[pluginName]);

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
    if (!this.room.hasPlugin(pluginName)) {
      return;
    }

    $.extend(this.room.getPlugin(pluginName).getPluginConfig(), config);
  }

  /**
   * Executes the postInit code from the config if any.
   */
  async _postInit() {
    if (HHM.config.hasOwnProperty(`postInit`) && !HHM.config.dryRun) {
      const postInitPluginId = await this.addPluginByCode(HHM.config.postInit);

      if (postInitPluginId < 0) {
        HHM.log.error(`Unable to execute postInit code, please check the code`);
      } else {
        const postInitPlugin = this.room._plugins[postInitPluginId];

        if (!postInitPlugin.hasOwnProperty(`_name`)) {
          postInitPlugin.pluginSpec = $.extend(postInitPlugin.pluginSpec,
              { name: `_postInit` });
          // Update displayed name
          this.notifyAll();
        }

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
    this.room._trappedRoomManager.removePluginHandlersAndProperties(pluginId);
  }

  /**
   * Loads the plugin for the given name and its dependencies.
   *
   * @return Plugin ID if the plugin and all of its dependencies have been loaded,
   * -1 otherwise.
   */
  async addPluginByName(pluginName) {
    let pluginId = await this.pluginLoader.tryToLoadPluginByName(pluginName);

    const result = await this._addPlugin(pluginId) ? pluginId : -1;

    if (result > 0) {
      const name =
          this.room._plugins[result]._name || this.room._plugins[result]._id;
      HHM.log.info(`Plugin added successfully: ${name}`);
    }

    this.notifyAll();

    return result;
  }

  /**
   * Loads the plugin from the given code and its dependencies.
   *
   * @return Plugin ID if the plugin and all of its dependencies have been loaded,
   * -1 otherwise.
   */
  async addPluginByCode(pluginCode) {
    let pluginId = this.pluginLoader.tryToLoadPluginByCode(pluginCode);

    const result = await this._addPlugin(pluginId) ? pluginId : -1;

    if (result > 0) {
      const name =
          this.room._plugins[result]._name || this.room._plugins[result]._id;
      HHM.log.info(`Plugin added successfully: ${name}`);
    }

    this.notifyAll();

    return result;
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

    this.room._pluginsDisabled.push(pluginId);

    this.notifyAll();

    return true;
  }

  /**
   * Enables the given plugin and its dependencies.
   *
   * @return true if any plugin was enabled, false otherwise.
   */
  enablePluginById(pluginId) {
    const pluginsEnabled = this._enablePluginAndDependencies(pluginId);

    if (pluginsEnabled) {
      this.notifyAll();
      return true;
    }

    return false;
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
   * Returns true if a plugin with the given ID exists, false otherwise.
   */
  hasPluginById(pluginId) {
    return this.room._plugins.hasOwnProperty(pluginId)
        && this.isPluginEnabled(pluginId);
  }

  /**
   * Returns whether the given plugin is enabled.
   */
  isPluginEnabled(pluginId) {
    return this.room._pluginsDisabled.indexOf(pluginId) === -1;
  }

  /**
   * Notifies all observers of changes.
   */
  notifyAll() {
    this.observers.forEach((observer) => observer.update(this));
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
    if (!config.isLoaded()) {
      HHM.log.error(`No configuration loaded`);
      return;
    }

    if (typeof room === `undefined`) {
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

    // TODO extract room code into other file?
    return require(`./room`).createRoom(room, this);
  }

  /**
   * Registers an observer which is notified when changes occur.
   *
   * Changes can be e.g. plugins being added, enabled/disabled.
   */
  registerObserver(observer) {
    this.observers.push(observer);
  }

  /**
   * Starts the HHM plugin manager.
   *
   * If a room was provided, it will be used, otherwise a new room will be
   * created. If no room and no room config was provided, the start will be
   * aborted.
   */
  async start(room) {
    if (!config.isLoaded()) {
      HHM.log.error(`No configuration loaded`);
      return;
    }

    HHM.log.info(`HHM bootstrapping complete, config loaded`);

    // No room for now, abort
    if (typeof room === `undefined`) {
      return;
    }

    this.room = room;

    this.roomTrapper = new RoomTrapper(new TrappedRoomManager(this.room));

    this.pluginLoader = new PluginLoader(this.room,
        HHM.config.repositories || []);

    if (!await this._loadUserPlugins()) {
      throw Error(`Error during HHM start`);
    }

    HHM.log.info(`Initial user plugins loaded and configured`);

    await this._postInit();

    return room;
  }
};