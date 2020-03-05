/**
 * Manages metadata during event handler execution.
 *
 * @property {boolean} returnValue Current return value of this event handler
 *  execution, this value is `true` until the first (pre) event handler returns
 *  `false`, and cannot change back to `true` afterwards.
 * @property {string} handlerName Name of the executed event handlers.
 * @property {Map.<string, Map.<*, *>>} handlerReturnValues Map of return
 *  values of handlers and hooks by plugin name. Return values can be `boolean`
 *  as well as complex types.
 * @property {Array.<string>} handlerPlugins Array of plugins which have
 *  handled this event.
 * @property {Map.<string, *>} data Additional custom event handling
 *  metadata.
 *
 *  TODO document all properties, remove getters in favor of get xy() where
 *   necessary or direct access otherwise
 *
 * @class EventHandlerExecutionMetadata
 */
class EventHandlerExecutionMetadata {
  constructor(handlerName, ...args) {
    this._class = `EventHandlerExecutionMetadata`;
    this.returnValue = true;
    this.mostRecentReturnValue = undefined;
    this.handlerName = handlerName;
    this.handlerReturnValues = new Map();
    this.handlerPlugins = [];
    this.handlers = [];
    this.args = args;
    this.data = new Map();
  }

  /**
   * Creates the array for handler return values for the given plugin if it
   * doesn't exist.
   *
   * @function EventHandlerExecutionMetadata#_provideHandlerReturnValuesObject
   * @param {string} pluginName Name of the plugin.
   * @param {boolean} [pushToHandlers] Whether to push the plugin name to the
   *  list of handler plugins.
   * @private
   */
  _provideHandlerReturnValuesObject(pluginName, pushToHandlers = false) {
    if (!this.handlerReturnValues.has(pluginName)) {
      this.handlerReturnValues.set(pluginName, new Map());
      if (pushToHandlers === true) this.handlerPlugins.push(pluginName);
    }
  }

  /**
   * Creates a metadata proxy for the given plugin name and event handler.
   *
   * @function EventHandlerExecutionMetadata#forPlugin
   * @param {string} pluginName Name of the plugin.
   * @param {object.<*>} eventHandler Event handler object.
   * @returns {EventHandlerExecutionMetadata.Proxy} The proxy.
   *
   * @see EventHandlerExecutionMetadata.Proxy
   */
  forPlugin(pluginName, eventHandler) {
    return new EventHandlerExecutionMetadata.Proxy(this, pluginName,
        eventHandler);
  }

  /**
   * Returns the custom metadata stored for the given property and plugin.
   *
   * @function EventHandlerExecutionMetadata#get
   * @param {string} property Name of the property.
   * @param {string} pluginName Name of the plugin.
   * @returns {(undefined|*)} The stored value or undefined if no value is
   *  stored for the property and plugin name.
   */
  get(property, pluginName) {
    return (this.data.get(pluginName) || {})[property];
  }

  /**
   * Returns the current event handler objects.
   *
   * For pre-event hooks, this contains all handlers that will be executed.
   * For pre-event handler hooks, this contains the current event handler.
   * For post-event handler hooks, this contains the current event handler.
   * For post-event hooks, this contains all handlers that were executed.
   *
   * @function EventHandlerExecutionMetadata#getArgs
   * @returns {Map.<number, object>} Map of event handler objects by plugin ID.
   */
  getHandlers() {
    return this.handlers;
  }

  /**
   * Returns the most recently registered return value.
   *
   * @function EventHandlerExecutionMetadata#getMostRecentReturnValue
   * @param {string} [pluginName] Name of the plugin for which you want to
   *  retrieve the registered return values.
   * @param {*} [id] ID of the handler or hook.
   * @returns {*} Return value of the most recently executed handler or
   *  undefined if no return values have been registered yet.
   */
  getMostRecentReturnValue() {
    return this.mostRecentReturnValue;
  }

  /**
   * Returns the current overall return value or plugin return value(s).
   *
   * @function EventHandlerExecutionMetadata#getReturnValue
   * @param {string} [pluginName] Name of the plugin for which you want to
   *  retrieve the registered return values.
   * @param {*} [id] ID of the handler or hook.
   * @returns {(boolean|*)} The overall return value if no parameters are given,
   * Map of return values for the given plugin if no id is given, or return
   * value for the given handler/hook ID or undefined.
   */
  getReturnValue(pluginName, id) {
    if (pluginName === undefined) {
      return this.returnValue;
    }

    this._provideHandlerReturnValuesObject(pluginName);

    return id === undefined ? this.handlerReturnValues.get(pluginName) :
        this.handlerReturnValues.get(pluginName).get(id);
  }

  /**
   * Registers a return value for the given plugin.
   *
   * @function EventHandlerExecutionMetadata#registerReturnValue
   * @param {string} pluginName Name of the plugin.
   * @param {*} returnValue Return value of the event handler, can be anyhting.
   *  If it is `false` and the `returnValue` of this metadata object has been
   *  `true`, it will be changed to false.
   * @param {*} [id] ID of the handler or hook that returned this value. By
   *  convention, this is the hook ID for pre-event (handler) hooks and the
   *  handler name for the actual event handler.
   * @returns {EventHandlerExecutionMetadata} The metadata object.
   */
  registerReturnValue(pluginName, returnValue, id = this.handlerName) {
    this._provideHandlerReturnValuesObject(pluginName, true);

    this.handlerReturnValues.get(pluginName).set(id, returnValue);

    this.args = Array.isArray(returnValue) ? returnValue : this.args;

    this.returnValue = returnValue !== false && this.returnValue;
    this.mostRecentReturnValue = returnValue;

    return this;
  }

  /**
   * Sets the custom metadata for the given property and plugin.
   *
   * @function EventHandlerExecutionMetadata#set
   * @param {string} pluginName Name of the plugin.
   * @param {string} property Name of the property.
   * @param {*} value The value that should be stored.
   * @returns {EventHandlerExecutionMetadata} The metadata object.
   *
   */
  set(pluginName, property, value) {
    this.data.set(pluginName, this.data.get(pluginName) || {});

    this.data.get(pluginName)[property] = value;

    return this;
  }

  /**
   * Sets the context handlers.
   *
   * @function EventHandlerExecutionMetadata#setHandlers
   * @param {Map.<number, object>} handlers Map of handler objects by plugin ID.
   * @returns {EventHandlerExecutionMetadata} The metadata object.
   *
   */
  setHandlers(handlers) {
    this.handlers = handlers;

    return this;
  }
}

/**
 * Metadata proxy for plugins which makes setting and getting properties more
 * convenient.
 *
 * @property {EventHandlerExecutionMetadata} metadata Proxied metadata object.
 * @property {string} pluginName Name of the plugin this proxy was created for.
 * @property {object.<*>} eventHandler Associated event handler object.
 *
 * @class EventHandlerExecutionMetadata.Proxy
 * @see EventHandlerExecutionMetadata#forPlugin
 */
class Proxy {
  constructor(metadata, pluginName, eventHandler) {
    this.metadata = metadata;
    this.pluginName = pluginName;
    this.eventHandler = eventHandler;
  }

  /**
   * Returns the current event arguments.
   *
   * @function EventHandlerExecutionMetadata~Proxy#getArgs
   * @see EventHandlerExecutionMetadata#getArgs
   */
  get args() {
    return this.metadata.args;
  }

  /**
   * Returns the current event handler objects.
   *
   * @function EventHandlerExecutionMetadata~Proxy#getHandlers
   * @see EventHandlerExecutionMetadata#getArgs
   */
  getHandlers() {
    return this.metadata.handlers;
  }

  /**
   * Returns the current overall return value or plugin return value.
   *
   * @function EventHandlerExecutionMetadata~Proxy#getReturnValue
   * @see EventHandlerExecutionMetadata#getReturnValue
   */
  getReturnValue(pluginName, id) {
    return this.metadata.getReturnValue(pluginName, id);
  }

  /**
   * Returns the stored property for the given plugin.
   *
   * @function EventHandlerExecutionMetadata~Proxy#get
   * @param {string} property Name of the property to be retrieved.
   * @param {string} [pluginName] Name of the plugin. If not given, the
   *  property will be returned for the plugin associated with this proxy.
   * @returns {(undefined|*)} Stored value or undefined if no value is stored
   *  for the given plugin and property.
   *
   * @see EventHandlerExecutionMetadata#get
   */
  get(property, pluginName = this.pluginName) {
    return this.metadata.get(property, pluginName);
  }

  /**
   * Sets the property for the plugin to the given value.
   *
   * @function EventHandlerExecutionMetadata~Proxy#set
   * @param {string} property Property to be set.
   * @param {*} value New value of the property.
   * @see EventHandlerExecutionMetadata#set
   */
  set(property, value) {
    this.metadata.set(this.pluginName, property, value);

    return this;
  }
}

module.exports = EventHandlerExecutionMetadata;
module.exports.Proxy = Proxy;