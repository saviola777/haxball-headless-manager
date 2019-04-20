/**
 * HHM namespace, containing all globally visible components of the system.
 *
 * @namespace HHM
 */


module.exports.populate = () => {
  global.HHM = global.HHM || {};

  /**
   * Current HHM version.
   *
   * @member HHM.version
   */
  global.HHM.version = `0.9.1-git`;

  /**
   * Default base URL, can be overridden in the configuration file.
   *
   * The base URL is used to load the HHM and core plugins. Mainly useful during
   * development when switching between stable and development versions of the
   * HHM and its plugins.
   *
   * @member HHM.baseUrl
   */
  global.HHM.baseUrl = HHM.baseUrl || `https://haxplugins.tk/`;

  /**
   * URL for the CORS proxy.
   *
   * This is used to allow plugins to be loaded from external sources which
   * are not configured for CORS. Make sure there is a CORS Anywhere reverse
   * proxy running at this URL or plugin loading will not work.
   *
   * @see https://github.com/Rob--W/cors-anywhere
   * @member HHM.proxyUrl
   */
  global.HHM.proxyUrl = HHM.proxyUrl || `https://haxplugins.tk/proxy/`;

  /**
   * Logger.
   *
   * @see module:src/log
   * @member HHM.log
   */
  global.HHM.log = require(`./log`)();

  /**
   * Stores global deferreds.
   *
   * These are JQuery deferred objects.
   *
   * @see https://api.jquery.com/category/deferred-object/
   * @member HHM.deferreds
   */
  global.HHM.deferreds = {};

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
     * @property {Function} handlerFunction Handler function.
     *
     * @memberOf HHM.events
     */
    'EVENT_HANDLER_SET': `eventHandlerSet`,

    /**
     * Triggered when an event handler was unset.
     *
     * @property {HhmRoomObject} plugin Associated plugin.
     * @property {string} handlerName Name of the event handler.
     * @property {Function} handlerFunction Previously set handler function.
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