/**
 * Manages metadata during event handler execution.
 *
 * @property {boolean} returnValue Current return value of this event handler
 *  execution, this value is `true` until the first (pre) event handler returns
 *  `false`, and cannot change back to `true` afterwards.
 * @property {string} handlerName Name of the executed event handlers.
 * @property {Object.<string, Array.<*>>} handlerReturnValues Array of return
 *  values of handlers by plugin name. Return values can be `boolean` as well as
 *  complex types.
 * @property {Array.<string>} handlerPlugins Array of plugins which have
 *  handled this event.
 * @property {Object.<string, *>} data Additional custom event handling
 *  metadata.
 *
 * @class EventHandlerExecutionMetadata
 */
class EventHandlerExecutionMetadata {
  constructor(handlerName) {
    this._class = `EventHandlerExecutionMetadata`;
    this.returnValue = true;
    this.handlerName = handlerName;
    this.handlerReturnValues = {};
    this.handlerPlugins = [];
    this.data = {};
  }

  /**
   * Creates the array for handler return values for the given plugin if it
   * doesn't exist.
   *
   * @function EventHandlerExecutionMetadata#_provideHandlerReturnValuesObject
   * @param {string} pluginName Name of the plugin.
   * @param {boolean} pushToHandlers Whether to push the plugin name to the list
   *  of handler plugins.
   * @private
   */
  _provideHandlerReturnValuesObject(pluginName, pushToHandlers) {
    if (this.handlerReturnValues[pluginName] === undefined) {
      this.handlerReturnValues[pluginName] = [];
      if (pushToHandlers === true) this.handlerPlugins.push(pluginName);
    }
  }

  /**
   * Creates a metadata proxy for the given plugin name.
   *
   * @function EventHandlerExecutionMetadata#forPlugin
   * @param {string} pluginName Name of the plugin.
   * @returns {EventHandlerExecutionMetadata~Proxy} The proxy.
   *
   * @see EventHandlerExecutionMetadata~Proxy
   */
  forPlugin(pluginName) {
    return new EventHandlerExecutionMetadata.Proxy(this, pluginName);
  }

  /**
   * Returns the custom metadata stored for the given property and plugin.
   *
   * @function EventHandlerExecutionMetadata#get
   * @param {string} pluginName Name of the plugin.
   * @param {string} property Name of the property.
   * @returns {(undefined|*)} The stored value or undefined if no value is
   *  stored for the property and plugin nanem.
   */
  get(pluginName, property) {
    return (this.data[pluginName] || {})[property];
  }

  /**
   * Returns the current overall return value or plugin return value.
   *
   * @function EventHandlerExecutionMetadata#getReturnValue
   * @param {string} pluginName Name of the plugin for which you want to
   *  retrieve the registered return values.
   * @returns {(boolean|*)} The overall return value if no parameters are given,
   * otherwise it returns the return value of the first handler for the given
   * plugin or `undefined` if no return values have been registered for the
   * given plugin.
   */
  getReturnValue(pluginName) {
    if (pluginName === undefined) {
      return this.returnValue;
    } else {
      this._provideHandlerReturnValuesObject(pluginName);
      return this.handlerReturnValues[pluginName].slice(-1)[0];
    }
  }

  /**
   * Registers a return value for the given plugin.
   *
   * @function EventHandlerExecutionMetadata#registerReturnValue
   * @param {string} pluginName Name of the plugin.
   * @param {*} returnValue Return value of the event handler, can be anyhting.
   *  If it is `false` and the `returnValue` of this metadata object has been
   *  `true`, it will be changed to false.
   * @returns {EventHandlerExecutionMetadata} The metadata object.
   */
  registerReturnValue(pluginName, returnValue) {
    this._provideHandlerReturnValuesObject(pluginName, true);

    this.handlerReturnValues[pluginName].push(returnValue);
    this.returnValue = returnValue !== false && this.returnValue;

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
    this.data[pluginName] = this.data[pluginName] || {};

    this.data[pluginName][property] = value;

    return this;
  }
};

/**
 * Metadata proxy for plugins which makes setting and getting properties more
 * convenient.
 *
 * @property {EventHandlerExecutionMetadata} metadata Proxied metadata object.
 * @property {string} pluginName Name of the plugin this proxy was created for.
 *
 * @class EventHandlerExecutionMetadata~Proxy
 * @see EventHandlerExecutionMetadata#forPlugin
 */
class Proxy {
  constructor(metadata, pluginName) {
    this.metadata = metadata;
    this.pluginName = pluginName;
  }

  /**
   * Returns the current overall return value or plugin return value.
   *
   * @function EventHandlerExecutionMetadata~Proxy#getReturnValue
   * @param {string} [pluginName] Name of the plugin for which you want to
   *  retrieve the registered return values.
   * @returns {(boolean|*)} The overall return value if no parameters are given,
   *  otherwise it returns the return value of the first handler for the given
   *  plugin or `undefined` if no return values have been registered for the
   *  given plugin.
   * @see EventHandlerExecutionMetadata#getReturnValue
   */
  getReturnValue(pluginName) {
    return this.metadata.getReturnValue(pluginName);
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
  get(property, pluginName) {
    return this.metadata.get(pluginName || this.pluginName, property);
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