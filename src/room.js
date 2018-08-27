/**
 * Plugin which adds HHM features to the Haxball room object.
 *
 * TODO add getManager, move non-specific functions to manager
 */

const ui = require(`./ui/index`);

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
     * Returns the handler names specific to this plugin.
     */
    getHandlerNames: function() {
      return pluginManager.getRoomManager().getEventHandlerNames(room, this._id);
    },

    /**
     * Returns the associated plugin manager.
     */
    getManager: function() {
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

      if (typeof pluginName === `undefined` || (create && !hasPlugin)) {
        const id = String(Date.now());
        room._plugins[id] = pluginManager.roomTrapper.createTrappedRoom(room, id);
        room._plugins[id]._id = id;
        room._plugins[id]._accessed = false;
        pluginRoom = room._plugins[id];

        if (typeof pluginName !== `undefined`) {
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
     * Returns whether the given plugin is loaded and activated.
     */
    hasPlugin: function(pluginName) {
      return room._pluginIds.hasOwnProperty(pluginName)
          && room._pluginManager.isPluginEnabled(
              room._pluginManager.getPluginId(pluginName));
    },

    /**
     * Returns whether this plugin is enabled.
     */
    isEnabled: function() {
      return room._pluginManager.isPluginEnabled(this._id);
    },

    /**
     * Returns false while waiting for the user to solve the captcha, true
     * once a room link exists.
     */
    isStarted: function() {
      return ui.isRoomLinkAvailable();
    },

    /**
     * Splits overlong messages if necessary.
     */
    sendChat: function(message) {
      if (message.length <= 140) {
        return this.sendChatNative(message);
      }

      this.sendChatNative(`${message.substr(0, 137)}...`);

      let index = 137;
      let i = 1;

      while (i * 140 < HHM.config.sendChatMaxLength) {
        // TODO use message length for efficiency?
        if (typeof message[index + 137] === `undefined`) {
          return this.sendChatNative(`...${message.substr(index)}`);
        }

        this.sendChatNative(`...${message.substr(index, 134)}...`);
        index += 134;
        i++;
      }

      this.sendChatNative(`[Overlong message was cut off by flood protection]`);
    },

    /**
     * Triggers the given event with the given arguments.
     *
     * Calling an event handler directly will only execute the current
     * plugin's event handler, while using this function will trigger all
     * handlers for the given event. As the event name, the event handler name
     * minus the "on" has to be specified, e.g. for "onSomeEvent" it should be
     * "SomeEvent".
     */
    triggerEvent: function(event, ...args) {
      const eventHandler = `on${event}`;
      if (room.hasOwnProperty(eventHandler)) {
        return room[eventHandler](...args);
      }

      return true;
    },
  });
};