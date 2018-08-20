/**
 * TrappedRoomManager plugin.
 */

const toposort = require(`toposort`);

/**
 * Manages access to the trapped rooms, storing handlers and properties for
 * each plugin.
 */
module.exports = class TrappedRoomManager {
  constructor(room) {
    const that = this;
    this.room = room;
    this.handlers = {};
    this.handlerNames = new Set();
    this.handlerExecutionOrders = {};
    this.handlersDirty = true;

    this.properties = {};

    this.room._trappedRoomManager = this;
    this.room._pluginManager.registerObserver({
      update: () => that.handlersDirty = true
    });
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
    const pluginIds = [];
    for (let pluginName of pluginNames) {
      this.room.getPluginId()
    }

    // Add vertex [`pluginToBeExecutedBefore`, `pluginToBeExectedAfter`]
    for (let otherPluginName of pluginNames) {
      vertices.push([pluginFirst ? pluginId : otherPluginName,
        pluginFirst ? otherPluginName : pluginId]);
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
   * Determines the execution order for plugins.
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

      let vertices = [];

      // Establish execution order dependencies for each plugin
      for (let pluginId of pluginIds) {
        let pluginSpec = this.room.getPluginSpec(pluginId);

        if (!pluginSpec.hasOwnProperty(`order`)) {
          continue;
        }

        this._addVertices(vertices, pluginId, handlerName, `before`, true);
        this._addVertices(vertices, pluginId, handlerName, `after`, false);
      }

      // Sort based on vertices
      const executionOrder = toposort(vertices);

      // Insert all plugins without execution order dependencies at the end
      for (let pluginId of pluginIds) {
        if (executionOrder.indexOf(pluginId) === -1) {
          executionOrder.push(pluginId);
        }
      }

      this.handlerExecutionOrders[handlerName] = executionOrder;
    }

    this.handlersDirty = false;
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
   * Note that global properties of the proxied room are taken into account as
   * well so long as they don't start with an underscore.
   */
  onOwnPropertyNamesGet(room, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    return [...new Set(Object.getOwnPropertyNames(room)
    .filter((v) => !v.startsWith(`_`))
    .concat(Object.getOwnPropertyNames(this.properties[pluginId])))];
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
   * Registers the given callback function for the given handler and plugin ID.
   */
  onEventHandlerSet(room, handler, callback, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);
    this.handlerNames.add(handler);

    this.handlers[pluginId][handler] = callback;

    this.handlersDirty = true;
  }

  /**
   * Removes the registered event handler for the given handler and plugin name.
   */
  onEventHandlerUnset(room, handler, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    delete this.handlers[pluginId][handler];

    this.handlersDirty = true;
  }

  /**
   * Executes the event handlers registered for the given handler.
   *
   * @return boolean false if one of the event handlers returned false, true
   *  otherwise
   */
  onExecuteEventHandlers(room, handler, ...args) {
    if (this.handlersDirty) {
      this.determineExecutionOrders();
    }

    if (!this.handlerExecutionOrders.hasOwnProperty(handler)) return;

    let returnValue = true;
    for (let pluginId of this.handlerExecutionOrders[handler]) {
      // Skip disabled plugins
      if (!this.room._pluginManager.isPluginEnabled(pluginId)) {
        continue;
      }

      if (this.handlers[pluginId][handler](...args) === false) {
        returnValue = false;
      }
    }
    return returnValue;
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
      .filter((prop) => !prop.startsWith('_')).length > 0;
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
  onPropertySet(room, property, value, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    this.properties[pluginId][property] = value;

    // Register plugin name after setting the plugin specification
    // TODO move into other method
    if (property === `pluginSpec`
        && this.properties[pluginId][property].hasOwnProperty(`name`)) {
      this.room._pluginIds[this.properties[pluginId][property][`name`]] =
          this.properties[pluginId][`_id`];
      this.properties[pluginId][`_name`] =
          this.properties[pluginId][property][`name`];
    }
  }

  /**
   * Unset the given property for the given plugin ID.
   */
  onPropertyUnset(room, property, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    delete this.properties[pluginId][property];
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
};