/**
 * Extends the `RoomObject` provided by the native Haxball API.
 *
 * @namespace HhmRoomObject
 * @extends external:native-api.RoomObject
 */

/***
 * Extends the given room with HHM features.
 */
module.exports.createRoom = function(room, pluginManager) {

  // Copy room because we have to re-use the given instance
  const parentRoom = Object.assign({}, room);

  return $.extend(room, {
    _class: `HhmRoomObject`,

    /**
     * Maps plugin IDs to trapped room instances.
     *
     * @member {Object.<Number, external:haxball-room-trapper.TrappedRoom>}
     *  HhmRoomObject._plugins
     */
    _plugins: {},

    /**
     * `Array` of disabled plugin IDs.
     *
     * @member {Array.<Number>} HhmRoomObject._pluginsDisabled
     */
    _pluginsDisabled: [],

    /**
     * Maps plugin names to plugin IDs.
     *
     * @member {Object.<String, Number>} HhmRoomObject._pluginIds
     */
    _pluginIds: {},

    /**
     * Associated plugin manager.
     *
     * @member {PluginManager} HhmRoomObject._pluginManager
     */
    _pluginManager: pluginManager,
  }, {

    /**
     * Add an event state validator function for the given handler names.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @param {(string|Array.<string>)} handlerNames Event handler names.
     * @param {Function} validator Validator function.
     * @returns {HhmRoomObject} Fluent interface.
     * @see TrappedRoomManager.addEventStateValidator
     */
    addEventStateValidator: function(handlerNames, validator) {
      pluginManager.getRoomManager()
          .addEventStateValidator(this._id, handlerNames, validator);

      return this;
    },

    /**
     * Add a hook for the given handler name that is executed before plugin
     * event handlers.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @param {(string|Array.<string>)} handlerName Event handler name(s).
     * @param {Function} hook Hook function.
     * @returns {HhmRoomObject} Fluent interface.
     * @see TrappedRoomManager#addPreEventHandlerHook
     */
    addPreEventHandlerHook: function(handlerName, hook) {
      pluginManager.getRoomManager()
          .addPreEventHandlerHook(this._id, handlerName, hook);

      return this;
    },

    /**
     * Add a hook for the given handler name that is executed after plugin
     * event handlers.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @param {string} handlerName Event handler name.
     * @param {Function} hook Hook function.
     * @returns {HhmRoomObject} Fluent interface.
     * @see TrappedRoomManager#addPostEventHandlerHook
     */
    addPostEventHandlerHook: function(handlerName, hook) {
      pluginManager.getRoomManager()
          .addPostEventHandlerHook(this._id, handlerName, hook);

      return this;
    },

    /**
     * Extends the global room object with an attribute or function.
     *
     * Please use very sparingly, this is primarily meant for workarounds or
     * functions that should be part of the room API but aren't (yet).
     *
     * If you try to pass a non-function and the room already had an attribute
     * with the same name, the extension will fail and false will be returned.
     *
     * The plugin room and previously defined function (if any) are passed in
     * a destructuring first argument.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @param {string} name Name of the room property that is being added or
     *  extended.
     * @param {(Function|*)} element New value for the given property, either a
     *  `Function` (extension will never fail) or any other type (extension will
     *  fail if property exists).
     * @returns {boolean} `true` if the extension was successful, `false` if not
     */
    extend: function(name, element) {

      if (typeof element !== `function` && room[name] === undefined) {
        room[name] = element;
        return true;
      } else if (typeof element === `function`) {
        const previousFn = room[name];
        const definingPlugin = this;

        room[name] = function(...args) {
          if (definingPlugin.isEnabled()) {
            return element({
              previousFunction: previousFn,
              callingPluginName: this._name,
            }, ...args);
          } else if (typeof previousFn === `function`) {
            return previousFn(...args);
          } else {
            this.log(`Plugin ${definingPlugin._name}, which provides function ${name}, `
              + `is disabled, please make sure to properly declare dependencies `
              + `and honor plugin states.`);
            return () => {};
          }
        };

        return true;
      }

      return false;
    },

    /**
     * Returns the handler names specific to this plugin.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @returns {Array.<string>} Handler names for this plugin.
     * @see TrappedRoomManager#getEventHandlerNames
     */
    getHandlerNames: function() {
      return pluginManager.getRoomManager().getEventHandlerNames(room, this._id);
    },

    /**
     * Returns the plugin ID.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @returns {number} Plugin ID.
     */
    getId: function() {
      return this._id;
    },

    /**
     * Returns the name of the plugin, or the ID if the plugin has no name.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @returns {string} Plugin name or ID (as a `string`) if the plugin has no
     *  name.
     */
    getName: function() {
      return this._name;
    },

    /**
     * Returns the parent room object.
     *
     * @memberOf HhmRoomObject
     * @returns {external:native-api.RoomObject} Parent room object, in most
     *  cases this is the native headless API room object.
     */
    getParentRoom() {
      return parentRoom;
    },

    /**
     * Returns the associated plugin manager.
     *
     * @memberOf HhmRoomObject
     * @returns {PluginManager} Associated plugin manager.
     */
    getPluginManager: function() {
      return pluginManager;
    },

    /**
     * Returns the trapped room for the given plugin.
     *
     * @memberOf HhmRoomObject
     * @param {string} [pluginName] Name of the plugin or undefined to create
     *  new plugin.
     * @param {boolean} [create] `true` if a new plugin should be created if it
     *  does not exist. If no `pluginName` was given, this parameter is ignored
     *  and a new plugin is created.
     * @returns {(external:haxball-room-trapper.TrappedRoom|undefined)} Plugin
     *  room proxy or undefined if the plugin was not found and `create` is
     *  `false`.
     * @see PluginManager#getPluginByName
     */
    getPlugin: function(pluginName, create) {
      return pluginManager.getPluginByName(pluginName, create);
    },

    /**
     * Returns the configuration of this plugin.
     *
     * If no parameter name is given, the whole config object is returned.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @param {string} [paramName] Configuration parameter name. If `undefined`,
     *  complete config is returned.
     * @returns {(Object|undefined|*)} Configuration object or value of the
     *  given configuration parameter or `undefined` if no such configuration
     *  parameter exists.
     */
    getConfig: function(paramName) {
      const pluginSpec = this.getPluginSpec();

      if (!pluginSpec.hasOwnProperty(`config`)) {
        pluginSpec.config = {};
      }

      return paramName === undefined ? pluginSpec.config :
          pluginSpec.config[paramName];
    },

    /**
     * Returns the plugin specification for this plugin.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @returns {external:haxball-room-trapper.TrappedRoom.pluginSpec} Plugin
     *  specification.
     */
    getPluginSpec: function() {
      if (!this.hasOwnProperty(`pluginSpec`)) {
        this.pluginSpec = {};
      }

      return this.pluginSpec;
    },

    /**
     * Returns the property names specific to this plugin.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @returns {Array.<string>} Plugin-specific property names.
     * @see TrappedRoomManager#getPropertyNames
     */
    getPropertyNames: function() {
      return pluginManager.getRoomManager().getPropertyNames(room, this._id);
    },

    /**
     * Returns the plugin source code.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @returns {string} Plugin source code.
     */
    getSourceCode: function() {
      return this._source;
    },

    /**
     * Returns whether this plugin has a name.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @returns {boolean} Whether the plugin has a name.
     */
    hasName: function() {
      return this._name !== undefined && String(this._id) !== this._name;
    },

    /**
     * Returns whether a valid plugin with the given name exists.
     *
     * @see PluginManager#hasPluginById
     * @memberOf HhmRoomObject
     * @returns {boolean} Whether a valid plugin with the given name exists.
     */
    hasPlugin: function(pluginName) {
      return pluginManager.hasPluginByName(pluginName);
    },

    /**
     * Returns whether the plugin has been fully loaded.
     *
     * A plugin is loaded when all of its dependencies have been loaded and its
     * `onRoomLink` handler has been executed.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @returns {boolean} Whether the plugin has been fully loaded.
     */
    isLoaded: function() {
      return (this._lifecycle !== undefined && this._lifecycle.loaded) || false;
    },

    /**
     * Returns whether this plugin is enabled.
     *
     * A plugin can only be enabled once it has been fully loaded.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @returns {boolean} Whether this plugin is enabled.
     */
    isEnabled: function() {
      return this.isLoaded()
          && pluginManager.room._pluginsDisabled.indexOf(this._id) === -1;
    },

    /**
     * Convenience logging function which will include the plugin name.
     *
     * Will not log to the room, but only to the browser console.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @param {string} message Message to be logged.
     * @param {string} level Log level.
     * @see module:src/log
     */
    log: function(message, level = HHM.log.level.INFO) {
      level = HHM.log.hasOwnProperty(level) ? level : HHM.log.level.INFO;
      if (HHM.log.hasOwnProperty(level)) {
        HHM.log[level](`[${this._name}] ` + message);
      }
    },

    /**
     * Sets the given configuration parameter to the given value.
     *
     * If no parameter name was given, an event will be triggered that the
     * configuration was changed.
     *
     * If an object is passed as the paramName, the whole config will be
     * overwritten and an event will be triggered.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @param {string} [paramName] Name of the configuration parameter.
     * @param {*} [value] New value of the configuration parameter.
     * @see PluginManager#setPluginConfig
     */
    setConfig: function(paramName, value) {
      return pluginManager.setPluginConfig(this._id, paramName, value);
    },

    /**
     * Sets a new name for this plugin.
     *
     * @memberOf HhmRoomObject
     * @instance
     * @param {string} name New plugin name.
     */
    setName: function(name) {
      this._name = name;
    },

    /**
     * Triggers an event with the given name and arguments.
     *
     * @memberOf HhmRoomObject
     * @param {string} eventHandlerName Name of the event handler to be
     *  triggered.
     * @param {...*} args Event arguments.
     * @returns {boolean} `false` if one of the event handlers returned `false`,
     *  `true` otherwise.
     * @see PluginManager#triggerEvent
     */
    triggerEvent: function(eventHandlerName, ...args) {
      return pluginManager.triggerEvent(eventHandlerName, ...args);
    },
  });
};