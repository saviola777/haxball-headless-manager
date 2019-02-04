/**
 * Plugin which adds HHM features to the Haxball room object.
 *
 * TODO move non-specific functions to manager
 */

/**
 * Extends the given room with HHM features.
 */
module.exports.createRoom = function(room, pluginManager) {
  room.sendChatNative = room.sendChat || Function.prototype;

  return $.extend(room, {
    _plugins: {},
    _pluginsDisabled: [],
    _pluginIds: {},
    _pluginManager: pluginManager,
  }, {

    /**
     * Add an event state validator function for the given handler name.
     *
     * @see TrappedRoomManager#addEventStateValidator
     */
    addEventStateValidator: function(handlerName, validator) {
      this.getPluginManager().getRoomManager()
          .addEventStateValidator(this._id, handlerName, validator);

      return this;
    },

    /**
     * Add a hook for the given handler name that is executed before plugin
     * event handlers.
     *
     * @see TrappedRoomManager#addPreEventHandlerHook
     */
    addPreEventHandlerHook: function(handlerName, hook) {
      this.getPluginManager().getRoomManager()
          .addPreEventHandlerHook(this._id, handlerName, hook);

      return this;
    },

    /**
     * Add a hook for the given handler name that is executed after plugin
     * event handlers.
     *
     * @see TrappedRoomManager#addPostEventHandlerHook
     */
    addPostEventHandlerHook: function(handlerName, hook) {
      this.getPluginManager().getRoomManager()
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
     * The plugin room and previously defined function (if any) are passed as
     * ...args arguments.
     *
     * @returns boolean true if the extension was successful, false if not
     */
    extend: function(name, element) {

      if (typeof element !== `function` && room[name] === undefined) {
        room[name] = element;
        return true;
      } else if (typeof element === `function`) {
        const previousFn = room[name];

        room[name] = function(...args) {
          if (this.isEnabled()) {
            return element({
              previousFunction: previousFn,
              callingPluginName: this._name,
            }, ...args);
          } else if (typeof previousFn === `function`) {
            return previousFn(...args);
          } else {
            this.log(`Plugin ${this._name}, which provides function ${name}, `
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
     */
    getHandlerNames: function() {
      return pluginManager.getRoomManager().getEventHandlerNames(room, this._id);
    },

    /**
     * Returns the associated plugin manager.
     */
    getPluginManager: function() {
      return pluginManager;
    },

    /**
     * Returns the trapped room for the given plugin.
     *
     * @param pluginName Name of the plugin or undefined to create new plugin
     * @param create True if a new plugin should be created if it does not exist
     */
    getPlugin: function(pluginName, create) {
      create = create || false;
      let pluginRoom = {};
      const hasPlugin = this.hasPlugin(pluginName);

      if (pluginName === undefined || (create && !hasPlugin)) {
        const id = String(Date.now());
        room._plugins[id] = pluginManager.roomTrapper.createTrappedRoom(room, id);
        room._plugins[id]._id = room._plugins[id]._name = id;
        room._plugins[id]._lifecycle = { accessed: false, loaded: false };
        room._pluginsDisabled.push(id);
        pluginRoom = room._plugins[id];

        if (pluginName !== undefined) {
          room._pluginIds[pluginName] = id;
          room._plugins[id]._name = pluginName;
        }
      } else if (hasPlugin) {
        pluginRoom = room._plugins[room._pluginIds[pluginName]];
      } else {
        HHM.log.error(`Plugin not found: ${pluginName}, please call hasPlugin first`);
      }

      return pluginRoom;
    },

    /**
     * Returns the configuration of this plugin.
     */
    getPluginConfig: function() {
      const pluginSpec = this.getPluginSpec();

      if (pluginSpec.hasOwnProperty(`config`)) {
        return pluginSpec.config;
      }

      return {};
    },

    /**
     * Returns the plugin specification for this plugin.
     */
    getPluginSpec: function() {
      if (this.hasOwnProperty(`pluginSpec`)) {
        return this.pluginSpec;
      }

      return {};
    },

    /**
     * Returns the property names specific to this plugin.
     */
    getPropertyNames: function() {
      return pluginManager.getRoomManager().getPropertyNames(room, this._id);
    },

    /**
     * Returns whether this plugin has a name.
     */
    hasName: function() {
      return this._name !== undefined && this._id !== this._name;
    },

    /**
     * Returns whether the given plugin is loaded.
     */
    hasPlugin: function(pluginName) {
      return room._pluginManager.hasPluginById(
          room._pluginManager.getPluginId(pluginName));
    },

    /**
     * Returns whether the function has been fully loaded.
     *
     * A plugin is loaded when all of its dependencies are loaded and its
     * onLoad event handler (if it exists) has been executed.
     */
    isLoaded: function() {
      return this._lifecycle.loaded || false;
    },

    /**
     * Returns whether this plugin is enabled.
     */
    isEnabled: function() {
      return room._pluginManager.isPluginEnabled(this._id);
    },

    /**
     * TODO documentation
     */
    log: function(message, level = HHM.log.level.INFO) {
      level = HHM.log.hasOwnProperty(level) ? level : HHM.log.level.INFO;
      if (HHM.log.hasOwnProperty(level)) {
        HHM.log[level](`[${this._name}] ` + message);
      }
    },

    /**
     * Sets a new name for this plugin.
     */
    setName: function(name) {
      this._name = name;
    },

    /**
     * Triggers an event with the given name and arguments.
     *
     * Calling an event handler directly will only execute the current
     * plugin's event handler, while using this function will trigger all
     * handlers for the given event. As the event name, the event handler name
     * minus the "on" has to be specified, e.g. for "onSomeEvent" it should be
     * "SomeEvent".
     *
     * Can also be (ab)used to trigger native events.
     */
    triggerEvent: function(eventName, ...args) {
      const eventHandler = `on${eventName}`;
      if (room.hasOwnProperty(eventHandler)) {
        return room[eventHandler](...args);
      }

      return true;
    },
  });
};