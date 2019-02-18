/**
 * TrappedRoomManager plugin.
 */

const toposort = require(`toposort`);
const EventHandlerExecutionMetadata = require(`./EventHandlerExecutionMetadata`);

/**
 * Manages access to the trapped rooms, storing handlers and properties for
 * each plugin.
 */
module.exports = class TrappedRoomManager {
  constructor(room) {
    const that = this;
    this._class = `TrappedRoomManager`;
    this.room = room;
    this.functionReflector = new HHM.classes.FunctionReflector(
        Math.floor((Math.random() * 10000) + 1));
    this.handlers = {};
    this.handlerNames = new Set();
    this.handlerExecutionOrders = {};
    this.preEventHandlerHooks = {};
    this.postEventHandlerHooks = {};
    this.handlersDirty = true;
    this.eventStateValidators = {};

    this.properties = {};

    this.room._trappedRoomManager = this;
    this.room._pluginManager.registerEventHandler(() => that.handlersDirty = true,
        [HHM.events.PLUGIN_LOADED, HHM.events.PLUGIN_ENABLED,
          HHM.events.PLUGIN_DISABLED]
    );
  }

  /**
   * Helper function to add vertices for execution orders.
   */
  _addVertices(vertices, pluginId, handlerName, orderProperty, pluginFirst) {
    const pluginRoom = this.room._pluginManager.getPluginById(pluginId);
    const order = pluginRoom.getPluginSpec().order;
    let pluginNames;

    // Use specific order for handler if available
    if (order.hasOwnProperty(handlerName)
        && order[handlerName].hasOwnProperty(orderProperty)) {
      pluginNames = order[handlerName][orderProperty];
    } else if (order.hasOwnProperty(`*`)
        && order[`*`].hasOwnProperty(orderProperty)) {
      // otherwise use general order
      pluginNames = order[`*`][orderProperty];
    } else {
      return;
    }

    // Turn into array if necessary
    if (typeof pluginNames !== `object`) {
      pluginNames = [pluginNames];
    }

    // Convert names to IDs
    const pluginIds = pluginNames.map((pluginName) => {
      return this.room.getPlugin(pluginName)._id;
    });

    // Add vertex [`pluginToBeExecutedBefore`, `pluginToBeExectedAfter`]
    for (let otherPluginId of pluginIds) {
      vertices.push([pluginFirst ? pluginId : otherPluginId,
        pluginFirst ? otherPluginId : pluginId]);
    }
  }

  _executeHandler(handler, pluginName, metadata, ...args) {
    if (typeof handler === `function`) {
      let extraArgsPosition = this.functionReflector
        .getDestructuringArgPosition(handler, args);

      if (extraArgsPosition >= 0) {
        args = args.concat(Array(Math.max(0, extraArgsPosition - args.length))
          .fill(undefined)).concat(metadata);
      }

      let returnValue = handler(...args) !== false;
      metadata.registerReturnValue(pluginName, returnValue);
    } else if (typeof handler !== `object`) {
      // TODO support string handlers?
      HHM.log.warn(`Invalid handler type: ${typeof handler}`);
    }

    // Iterable
    else if (typeof handler[Symbol.iterator] === 'function') {
      for (let h of handler) {
        this._executeHandler(h, pluginName, metadata, ...args);
      }
    }

    else {
      // Object iteration
      for (let h of Object.getOwnPropertyNames(handler)) {
        this._executeHandler(handler[h], pluginName, metadata, ...args);
      }
    }
  }

  /**
   * Returns whether the plugin with the given ID is both enabled and loaded.
   */
  _isPluginEnabledAndLoaded(pluginId) {
    return this.room._pluginManager.isPluginEnabled(pluginId)
      && this.room.getPluginManager().getPluginById(pluginId).isLoaded();
  }

  /**
   * TODO documentation
   */
  _isValidEventState(handler, metadata, ...args) {
    // If no validator was set, all states are considered valid
    if (this.eventStateValidators[handler] === undefined) {
      return true;
    }

    // Return true unless at least one validator returns exactly false
    for (let pluginName of
        Object.getOwnPropertyNames(this.eventStateValidators[handler])) {

      for (let validator of this.eventStateValidators[handler][pluginName]) {
        if (validator({metadata: metadata}, ...args) === false) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Makes sure the given handler name is registered so that pre- and post-event
   * handler hooks for that handler are executed.
   */
  _provideHandler(pluginId, handlerName) {
    // Make sure the handler is registered
    if (this.room[handlerName] === undefined) {
      this.room._pluginManager.getPluginById(pluginId)[handlerName] = () => {};
    }
  }

  /**
   * Helper function to make sure there's a handler for each plugin ID.
   *
   * This is not done once for all plugins to make it possible to load
   * additional plugins at runtime later on.
   */
  _provideHandlerObjectForIdentifier(pluginId) {
    if (!this.handlers.hasOwnProperty(pluginId)) {
      this.handlers[pluginId] = {};
    }
  }

  /**
   * Helper function to make sure there's a property holder for each plugin ID.
   *
   * This is not done once for all plugins to make it possible to load
   * additional plugins at runtime later on.
   */
  _providePropertyObjectForIdentifier(pluginId) {
    if (!this.properties.hasOwnProperty(pluginId)) {
      this.properties[pluginId] = {};
    }
  }

  /**
   * Determine execution order for the given plugins and handler name.
   */
  determineExecutionOrder(pluginIds, handlerName) {
    let vertices = [];

    // Establish execution order dependencies for each plugin
    for (let pluginId of pluginIds) {
      let pluginSpec = this.room.getPluginManager().getPluginById(pluginId)
          .getPluginSpec();

      if (!pluginSpec.hasOwnProperty(`order`)) {
        continue;
      }

      this._addVertices(vertices, pluginId, handlerName, `before`, true);
      this._addVertices(vertices, pluginId, handlerName, `after`, false);
    }

    // Sort based on vertices
    try {
      const executionOrder = toposort(vertices);

      // Insert all plugins without execution order dependencies at the end
      for (let pluginId of pluginIds) {
        if (executionOrder.indexOf(pluginId) === -1) {
          executionOrder.push(pluginId);
        }
      }

      return executionOrder;
    }
    catch (e) {
      let pluginId = e.message.split('"')[1];
      let pluginName = this.room._pluginManager.getPluginById(pluginId)._name;

      HHM.log.error(`There was a cyclic dependency for handler ${handlerName} and plugin ${pluginName}`);
      //HHM.log.error(this.room._pluginManager._createDependencyChain(pluginId, []));
      throw(e);
    }
  }

  /**
   * Determines the execution order for all plugins and handlers.
   */
  determineExecutionOrders() {
    this.handlerExecutionOrders = {};

    for (let handlerName of this.handlerNames) {
      let pluginIds = [];

      // Collect plugins for current handler
      for (let pluginId of Object.getOwnPropertyNames(this.room._plugins)) {
        this._provideHandlerObjectForIdentifier(pluginId);

        if (this.handlers[pluginId].hasOwnProperty(handlerName)) {
          pluginIds.push(pluginId);
        }
      }

      // No plugins for the given handler, remove it
      if (pluginIds.length === 0) {
        this.handlerNames.delete(handlerName);
        continue;
      }

      this.handlerExecutionOrders[handlerName] =
          this.determineExecutionOrder(pluginIds, handlerName);
    }

    this.handlersDirty = false;
  }

  /**
   * Returns the event handler names for the given plugin.
   */
  getEventHandlerNames(room, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    return Object.getOwnPropertyNames(this.handlers[pluginId]);
  }

  /**
   * Returns the properties (not event handlers) registered for the given
   * plugin.
   *
   * To get both properties and event handlers, use Object.getOwnPropertyNames.
   */
  getPropertyNames(room, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    return Object.getOwnPropertyNames(this.properties[pluginId]);
  }

  /**
   * Returns whether the given there are handlers registered for the given
   * plugin ID.
   */
  hasEventHandlers(room, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    return Object.getOwnPropertyNames(this.handlers[pluginId]).length > 0;
  }

  /**
   * Returns whether there are properties registered for the given plugin ID.
   *
   * Note that global properties of the proxied room are NOT taken into account,
   * as are properties starting with an underscore.
   */
  hasProperties(room, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    return Object.getOwnPropertyNames(this.properties[pluginId])
        .filter(prop => !prop.startsWith('_')).length > 0;
  }

  /**
   * Returns the event handler registered for the given handler and plugin ID,
   * or undefined if none is registered.
   */
  onEventHandlerGet(room, handler, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);
    
    return this.handlers[pluginId][handler];
  }

  /**
   * Returns whether there is an event handler registered for the given handler
   * and plugin ID.
   */
  onEventHandlerHas(room, handler, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    return this.handlers[pluginId].hasOwnProperty(handler);
  }

  /**
   * Registers the given handler function for the given handler name and plugin
   * ID.
   *
   * TODO handle onGameTick differently
   */
  onEventHandlerSet(room, handlerName, handlerFunction, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);
    this.handlerNames.add(handlerName);

    this.handlers[pluginId][handlerName] = handlerFunction;

    this.handlersDirty = true;

    this.room._pluginManager.dispatchEvent({
      type: HHM.events.EVENT_HANDLER_SET,
      handlerFunction: handlerFunction,
      handlerName: handlerName,
      plugin: this.room._pluginManager.getPluginById(pluginId),
    });
  }

  /**
   * Removes the registered event handler for the given handler and plugin name.
   */
  onEventHandlerUnset(room, handlerName, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    delete this.handlers[pluginId][handlerName];

    this.handlersDirty = true;

    this.room._pluginManager.dispatchEvent({
      type: HHM.events.EVENT_HANDLER_UNSET,
      handlerName: handlerName,
      plugin: this.room._pluginManager.getPluginById(pluginId),
    });
  }

  /**
   * Returns whether the given property exists for the given plugin ID.
   *
   * Note that global properties of the proxied room are taken into account as
   * well so long as they don't start with an underscore.
   */
  onPropertyHas(room, property, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    return this.properties[pluginId].hasOwnProperty(property)
        || (!property.startsWith(`_`)
            && room.hasOwnProperty(property));
  }

  /**
   * Returns an array of handlers registered for the given plugin ID.
   */
  onOwnHandlerNamesGet(room, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    return Object.getOwnPropertyNames(this.handlers[pluginId]);
  }

  /**
   * Returns an array of properties registered for the given plugin ID.
   *
   * Properties are in the object properties in the JavaScript sense here:
   * handler names are returned as well.
   *
   * Note that global properties of the proxied room are taken into account as
   * well so long as they don't start with an underscore.
   */
  onOwnPropertyNamesGet(room, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);
    this._provideHandlerObjectForIdentifier(pluginId);

    return [...new Set(Object.getOwnPropertyNames(room)
      .concat(Object.getOwnPropertyNames(this.properties[pluginId]))
      .filter(v => !v.startsWith(`_`)))];
  }

  /**
   * Returns a property descriptor for the given handler and plugin ID.
   */
  onOwnHandlerDescriptorGet(room, handler, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    if (this.handlers[pluginId].hasOwnProperty(handler)) {
      return Object.getOwnPropertyDescriptor(this.handlers[pluginId], handler);
    }
  }

  /**
   * Returns a property descriptor for the given property and plugin ID.
   */
  onOwnPropertyDescriptorGet(room, property, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    if (this.properties[pluginId].hasOwnProperty(property)) {
      return Object.getOwnPropertyDescriptor(this.properties[pluginId],
          property);
    }

    if (room.hasOwnProperty(property) && !property.startsWith(`_`)) {
      return Object.getOwnPropertyDescriptor(room, property);
    }
  }

  /**
   * Executes the event handlers registered for the given handler.
   *
   * TODO handle onGameTick differently
   *
   * @return boolean false if one of the event handlers returned false, true
   *  otherwise
   */
  onExecuteEventHandlers(room, handler, ...args) {
    if (this.handlersDirty) {
      this.determineExecutionOrders();
    }

    const metadata = new EventHandlerExecutionMetadata(handler);

    // Execute pre-event handler hooks
    if (this.preEventHandlerHooks[handler] !== undefined) {

      for (let pluginId of
          Object.getOwnPropertyNames(this.preEventHandlerHooks[handler])) {

        if (!this._isPluginEnabledAndLoaded(pluginId)) {
          continue;
        }

        const pluginName = this.room._pluginManager.getPluginName(pluginId);

        for (let hook of this.preEventHandlerHooks[handler][pluginId]) {
          let returnValue = hook({room: this.room, metadata: metadata},
              ...args);

          args = Array.isArray(returnValue) ? returnValue : args;
          metadata.registerReturnValue(pluginName, returnValue);
        }
      }
    }

    // Execute event handlers
    if (this.handlerExecutionOrders.hasOwnProperty(handler)) {
      for (let pluginId of this.handlerExecutionOrders[handler]) {
        // Skip disabled plugins
        if (!this._isPluginEnabledAndLoaded(pluginId)) {
          continue;
        }

        // Abort if event state not valid
        if (!this._isValidEventState(handler, metadata, ...args)) {
          break;
        }

        this._executeHandler(this.handlers[pluginId][handler],
            this.room._pluginManager.getPluginName(pluginId), metadata,
                ...args);
      }
    }

    // Execute post-event handler hooks
    if (this.postEventHandlerHooks[handler] !== undefined) {
      for (let pluginId of
          Object.getOwnPropertyNames(this.postEventHandlerHooks[handler])) {

        if (!this._isPluginEnabledAndLoaded(pluginId)) {
          continue;
        }

        for (let hook of this.postEventHandlerHooks[handler][pluginId]) {
          hook({ room: this.room, metadata: metadata }, ...args);
        }
      }
    }

    return metadata.returnValue;
  }

  /**
   * Returns the given property for the given plugin ID.
   *
   * Note that global properties of the proxied room are taken into account as
   * well so long as they don't start with an underscore and only if there is
   * not a property set for the plugin name.
   */
  onPropertyGet(room, property, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    if (typeof this.properties[pluginId][property] !== `undefined` ||
        property.startsWith(`_`)) {
      return this.properties[pluginId][property];
    }

    if (typeof room[property] !== `undefined`) {
      return room[property];
    }
  }

  /**
   * Sets the given property to the given value for the given plugin ID.
   */
  onPropertySet(room, propertyName, value, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    let valueOld = this.properties[pluginId][propertyName];
    this.properties[pluginId][propertyName] = value;

    this.room._pluginManager.dispatchEvent({
      type: HHM.events.PROPERTY_SET,
      plugin: this.room._pluginManager.getPluginById(pluginId),
      propertyName: propertyName,
      propertyValue: value,
      propertyValueOld: valueOld,
    });
  }

  /**
   * Unset the given property for the given plugin ID.
   */
  onPropertyUnset(room, propertyName, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    delete this.properties[pluginId][propertyName];

    this.room._pluginManager.dispatchEvent({
      type: HHM.events.PROPERTY_UNSET,
      plugin: this.room._pluginManager.getPluginById(pluginId),
      propertyName: propertyName,
    });
  }

  /**
   * Removes the handlers and properties for the given plugin ID.
   *
   * Must be called by PluginManager#_removePlugin to ensure overall
   * consistency.
   */
  removePluginHandlersAndProperties(pluginId) {
    if (!this.room._pluginManager.hasPluginById(pluginId)) {
      return;
    }

    delete this.properties[pluginId];
    delete this.handlers[pluginId];
    this.handlersDirty = true;
  }

  /**
   * Add an event state validator function for the given handler name.
   *
   * The validator function should return false if the event state is no longer
   * valid and further event handlers should not be executed.
   */
  addEventStateValidator(pluginId, handlerName, validator) {
    if (this.eventStateValidators[handlerName] === undefined) {
      this.eventStateValidators[handlerName] = {};
    }

    if (this.eventStateValidators[handlerName][pluginId] === undefined) {
      this.eventStateValidators[handlerName][pluginId] = [];
    }

    this.eventStateValidators[handlerName][pluginId].push(validator);

    return this;
  }

  /**
   * Add a hook for the given handler name that is executed before plugin
   * event handlers.
   *
   * Hooks are passed the room object and the event arguments. If the hook
   * returns an array it will be used to overwrite the event arguments.
   */
  addPreEventHandlerHook(pluginId, handlerName, hook) {
    if (this.preEventHandlerHooks[handlerName] === undefined) {
      this.preEventHandlerHooks[handlerName] = {};
    }

    if (this.preEventHandlerHooks[handlerName][pluginId] === undefined) {
      this.preEventHandlerHooks[handlerName][pluginId] = [];
    }

    this.preEventHandlerHooks[handlerName][pluginId].push(hook);

    this._provideHandler(pluginId, handlerName);

    return this;
  }

  /**
   * Add a hook for the given handler name that is executed after plugin
   * event handlers.
   *
   * It is executed regardless of event state validity.
   *
   * Hooks are passed the room object, a metadata object, and the event
   * arguments.
   */
  addPostEventHandlerHook(pluginId, handlerName, hook) {
    if (this.postEventHandlerHooks[handlerName] === undefined) {
      this.postEventHandlerHooks[handlerName] = {};
    }

    if (this.postEventHandlerHooks[handlerName][pluginId] === undefined) {
      this.postEventHandlerHooks[handlerName][pluginId] = [];
    }

    this.postEventHandlerHooks[handlerName][pluginId].push(hook);

    this._provideHandler(pluginId, handlerName);

    return this;
  }
};