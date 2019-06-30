/**
 * HHM namespace, containing all globally visible components of the system.
 *
 * @namespace HHM
 */


module.exports.populate = () => {
  global.HHM = global.HHM || {};

  /**
   * Current HHM version information.
   *
   * @member HHM.version
   */
  global.HHM.version = {
    identifier: require(`./_version`).npmVersionString.split(`@`)[2],
    gitHash: require(`./_version`).gitHash,
    buildDate: require(`./_version`).buildDate,
  };

  // Append git hash to version identifier if it ends with '-git'
  if (HHM.version.identifier.endsWith(`-git`)) {
    HHM.version.identifier += `#${HHM.version.gitHash}`;
  }

  /**
   * Logger.
   *
   * @see module:src/log
   * @member HHM.log
   */
  global.HHM.log = require(`./log`)();
  HHM.log.setLevel(HHM.config.logLevel || HHM.log.getLevel());

  /**
   * Stores global deferreds.
   *
   * These are jQuery deferred objects.
   *
   * @see https://api.jquery.com/category/deferred-object/
   * @member HHM.deferreds
   */
  global.HHM.deferreds = {};

  /**
   * Contains the hash function used within the HHM.
   *
   * @member HHM.hashFunction
   * @see external:murmurhash3_32_gc
   */
  global.HHM.hashFunction = require(`./hash`);

  /**
   * Provides access to all classes of the HHM.
   *
   * @member HHM.classes
   */
  global.HHM.classes = {
    EventHandlerExecutionMetadata: require(`./classes/EventHandlerExecutionMetadata`),
    FunctionReflector: require(`./classes/FunctionReflector`),
    PluginLoader: require(`./classes/PluginLoader`),
    PluginManager: require(`./classes/PluginManager`),
    TrappedRoomManager: require(`./classes/TrappedRoomManager`),
  };


  // TODO move to separate file?
  /**
   * HHM events, the event name will be passed along with each event in addition
   * to the event data listed as "Properties" below.
   *
   * @property {string} eventName Name of the event.
   *
   * @namespace HHM.events
   */
  global.HHM.events = {
    /**
     * Triggered when an event handler was set.
     *
     * @property {HhmRoomObject} plugin Associated plugin.
     * @property {string} handlerName Name of the event handler.
     * @property {*} handler Handler function or object.
     *
     * @memberOf HHM.events
     */
    'EVENT_HANDLER_SET': `eventHandlerSet`,

    /**
     * Triggered when an event handler was unset.
     *
     * @property {HhmRoomObject} plugin Associated plugin.
     * @property {string} handlerName Name of the event handler.
     * @property {*} handler Previously set handler function or object.
     */
    'EVENT_HANDLER_UNSET': `eventHandlerUnset`,

    /**
     * Triggered before a local event is dispatched.
     *
     * Local events are only executed on one plugin. Currently known local
     * event types:
     *
     *  - roomLink
     *  - enable
     *  - disable
     *  - configSet
     *
     * @property {HhmRoomObject} plugin Associated plugin.
     * @property {string} localEventName Name of the local event, see the list
     *  above.
     * @property {Array} localEventArgs Arguments to the local event, if any.
     *
     * @memberOf HHM.events
     */
    'LOCAL_EVENT': `localEvent`,

    /**
     * Any other event that does not (yet) have an event type.
     *
     * @property {Array} eventArgs Arguments to the event, if any.
     *
     * @memberOf HHM.events
     */
    'OTHER': `other`,

    /**
     * Triggered after a plugin was disabled.
     *
     * @property {HhmRoomObject} plugin The disabled plugin.
     *
     * @memberOf HHM.events
     */
    'PLUGIN_DISABLED': `pluginDisabled`,

    /**
     * Triggered after a plugin was enabled.
     *
     * @property {HhmRoomObject} plugin The enabled plugin.
     *
     * @memberOf HHM.events
     */
    'PLUGIN_ENABLED': `pluginEnabled`,

    /**
     * Triggered before a plugin is loaded.
     *
     * Triggered after the onRoomLink function for the given plugin has been
     * called but before the plugin has been marked as loaded.
     *
     * @property {HhmRoomObject} plugin The loaded plugin.
     *
     * @memberOf HHM.events
     */
    'BEFORE_PLUGIN_LOADED': `beforePluginLoaded`,

    /**
     * Triggered after a plugin was loaded.
     *
     * Triggered after the onRoomLink function for the given plugin has been
     * called and the plugin has been marked as loaded.
     *
     * @property {HhmRoomObject} plugin The loaded plugin.
     *
     * @memberOf HHM.events
     */
    'PLUGIN_LOADED': `pluginLoaded`,

    /**
     * Triggered after a plugin was removed.
     *
     * @property {HhmRoomObject} plugin The removed plugin.
     *
     * @memberOf HHM.events
     */
    'PLUGIN_REMOVED': `pluginRemoved`,

    /**
     * Triggered after a plugin property was set.
     *
     * @property {HhmRoomObject} plugin Associated plugin.
     * @property {string} propertyName  Name of the property that was set.
     * @property {*} propertyValue Value the property was set to.
     * @property {*} propertyValueOld Previous value of the property or
     *  undefined.
     *
     * @memberOf HHM.events
     */
    'PROPERTY_SET': `propertySet`,

    /**
     * Triggered after a plugin property was unset.
     *
     * @property {HhmRoomObject} plugin Associated plugin.
     * @property {string} propertyName Name of the property that was unset.
     * @property {*} propertyValue Value of the property that was unset.
     *
     * @memberOf HHM.events
     */
    'PROPERTY_UNSET': `propertyUnset`,
  }
};