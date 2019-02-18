/**
 * TODO documentation
 * Populates the HHM namespace
 */

module.exports.populate = () => {
  global.HHM = global.HHM || {};
  global.HHM.version = `0.9.0-git`;
  global.HHM.baseUrl = HHM.baseUrl || `https://haxplugins.tk/`;
  global.HHM.proxyUrl = HHM.proxyUrl || `https://haxplugins.tk/proxy/`;
  global.HHM.defaultConfigUrl = `${HHM.baseUrl}config/default.js`;
  global.HHM.log = require(`./log`)();

  // Stores global deferreds
  global.HHM.deferreds = {};

  // Classes
  global.HHM.classes = {
    EventHandlerExecutionMetadata: require(`./classes/EventHandlerExecutionMetadata`),
    FunctionReflector: require(`./classes/FunctionReflector`),
    PluginLoader: require(`./classes/PluginLoader`),
    PluginManager: require(`./classes/PluginManager`),
    TrappedRoomManager: require(`./classes/TrappedRoomManager`),
  };

  /**
   * HHM events, the type will be passed along with each event.
   */
  // TODO move to separate file?
  global.HHM.events = {
    /**
     * Any other event that does not (yet) have an event type.
     */
    'OTHER': `other`,

    /**
     * Triggered when a plugin was disabled.
     *
     * Event data:
     *  - plugin: the disabled plugin
     */
    'PLUGIN_DISABLED': `pluginDisabled`,

    /**
     * Triggered when a plugin was enabled.
     *
     * Event data:
     *  - plugin: the enabled plugin
     */
    'PLUGIN_ENABLED': `pluginEnabled`,

    /**
     * Triggered when a plugin was loaded.
     *
     * Triggered after the onRoomLink function for the given plugin has been
     * called.
     *
     * Event data:
     *  - plugin: the loaded plugin
     */
    'PLUGIN_LOADED': `pluginLoaded`,

    /**
     * Triggered when a plugin is removed.
     *
     * Event data:
     *  - plugin: the removed plugin
     */
    'PLUGIN_REMOVED': `pluginRemoved`,

    /**
     * Triggered when an event handler was set.
     *
     * Event data:
     *  - plugin: associated plugin
     *  - handlerName: name of the event handler
     *  - handlerFunction: handler function
     */
    'EVENT_HANDLER_SET': 'eventHandlerSet',

    /**
     * Triggered when an event handler was unset.
     *
     * Event data:
     *  - plugin: associated plugin
     *  - handlerName: name of the event handler
     */
    'EVENT_HANDLER_UNSET': 'eventHandlerUnset',

    /**
     * Triggered when a plugin property was unset.
     *
     * Event data:
     *  - plugin: associated plugin
     *  - propertyName: name of the property that was set
     *  - propertyValue: value the property was set to
     *  - propertyValueOld: previous value of the property or undefined
     */
    'PROPERTY_SET': 'propertyUnset',

    /**
     * Triggered when a plugin property was unset.
     *
     * Event data:
     *  - plugin: associated plugin
     *  - propertyName: name of the property that was unset
     */
    'PROPERTY_UNSET': 'propertyUnset',
  }
};