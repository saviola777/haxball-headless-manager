/**
 * Class that manages metadata during event handler execution.
 */

module.exports = class EventHandlerExecutionMetadata {
  constructor(handlerName) {
    this._class = `EventHandlerExecutionMetadata`;
    this.returnValue = true;
    this.handlerName = handlerName;
    this.handlerReturnValues = {};
    this.handlers = [];
    this.data = {};
  }

  /**
   * TODO documentation
   */
  _provideHandlerReturnValuesObject(pluginName, pushToHandlers) {
    if (this.handlerReturnValues[pluginName] === undefined) {
      this.handlerReturnValues[pluginName] = [];
      if (pushToHandlers === true) this.handlers.push(pluginName);
    }
  }

  /**
   * TODO documentation
   */
  registerReturnValue(pluginName, returnValue) {
    this._provideHandlerReturnValuesObject(pluginName, true);

    this.handlerReturnValues[pluginName].push(returnValue);
    this.returnValue = returnValue !== false && this.returnValue;
  }

  /**
   * TODO documentation
   */
  set(namespace, attribute, value) {
    this.data[namespace + '::' + attribute] = value;

    return this;
  }

  /**
   * TODO documentation
   */
  get(namespace, attribue) {
    return this.data[namespace + '::' + attribue];
  }

  /**
   * Returns the current overall return value or plugin return value.
   *
   * This function returns the overall return value if no parameters are given,
   * otherwise it returns the return value of the first handler for the given
   * plugin or undefined if no return values have been registered for the given
   * plugin.
   */
  getReturnValue(pluginName) {
    if (pluginName === undefined) {
      return this.returnValue;
    } else {
      this._provideHandlerReturnValuesObject(pluginName);
      return this.handlerReturnValues[pluginName].slice(-1)[0];
    }
  }
};