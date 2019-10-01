const merge = require('lodash.merge');
const toposort = require(`toposort`);
const EventHandlerExecutionMetadata = require(`./EventHandlerExecutionMetadata`);

/**
 * Manages access to the trapped rooms, storing handlers and properties for
 * each plugin.
 *
 * @TODO document where certain events are triggered
 *
 * @class TrappedRoomManager
 * @property {Object.<string, Object.<number, Array.<Function>>>}
 *  eventStateValidators `Array` of event state validators for each plugin and
 *  handler.
 * @property {FunctionReflector} functionReflector `FunctionReflector` used to
 *  analyze event handler functions.
 * @property {Object.<string, Array.<number>>} handlerExecutionOrders `Array` of
 *  plugin IDs in execution order for each handler.
 * @property {Set.<string>} handlerNames Known event handler names.
 * @property {Object.<number, Object.<string, Function>>} handlers Event
 *  handlers for each plugin.
 * @property {boolean} handlersDirty Whether handlers have been changed since
 *  the last call to {@link TrappedRoomManager#determineExecutionOrders}.
 * @property {Object.<string, Object.<number, Array.<Function>>>}
 *  postEventHandlerHooks `Array` of post-event handler hooks for each plugin
 *  and handler.
 * @property {Object.<string, Object.<number, Array.<Function>>>}
 *  preEventHandlerHooks `Array` of pre-event handler hooks for each plugin and
 *  handler.
 * @property {Object.<number, Object.<string, *>>} properties Properties for
 *  each plugin.
 * @property {HhmRoomObject} room Associated room object.
 *
 */
class TrappedRoomManager {
  /**
   * Creates a trapped room manager for the given room.
   *
   * @function TrappedRoomManager#constructor
   * @param {HhmRoomObject} room Room object.
   */
  constructor(room) {
    const that = this;
    this._class = `TrappedRoomManager`;

    // TODO turn into map
    this.eventStateValidators = {};
    this.functionReflector = new HHM.classes.FunctionReflector(
        Math.floor((Math.random() * 10000) + 1));

    // TODO turn into map
    this.handlerExecutionOrders = {};
    this.handlerNames = new Set();

    // TODO turn into map
    this.handlers = {};
    this.handlersDirty = true;

    // TODO turn into map
    this.postEventHandlerHooks = {};
    // TODO turn into map
    this.preEventHandlerHooks = {};

    // TODO turn into map
    this.properties = {};

    this.room = room;
    this.room._trappedRoomManager = this;
  }

  /**
   * Helper function to add vertices for execution orders.
   *
   * This function adds one vertex for each plugin name in the execution order
   * `Array` for the given plugin ID, handler name and order property.
   *
   * @function TrappedRoomManager#_addVertices
   * @private
   * @param {Array.<Array<number, number>>} vertices `Array` of vertices which
   *  will be extended in this function. A vertex is an array of two plugin
   *  IDs: `[pluginToBeExecutedBefore, pluginToBeExecutedAfter]`.
   * @param {number} pluginId Plugin ID.
   * @param {string} handlerName Handler name.
   * @param {string} orderProperty One of `"before"` or `"after"`.
   */
  _addVertices(vertices, pluginId, handlerName, orderProperty) {
    const pluginFirst = orderProperty === `before`;
    const pluginRoom = this.room._pluginManager.getPlugin(pluginId);
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
      return this.room._pluginManager.getPluginId(pluginName);
    }).filter((pluginId) => pluginId >= 0);

    // Add vertex [`pluginToBeExecutedBefore`, `pluginToBeExecutedAfter`]
    for (let otherPluginId of pluginIds) {
      vertices.push([pluginFirst ? pluginId : otherPluginId,
          pluginFirst ? otherPluginId : pluginId]);
    }
  }

  /**
   * Returns a handler object for the given handler object or function.
   *
   * This function creates a new handler object if a handler function is given
   * or otherwise extends the given handler object.
   *
   * @function TrappedRoomManager#_createHandlerObject
   * @private
   * @param {number} pluginId Plugin ID.
   * @param {string} handlerName Handler name.
   * @param {(Function|object)} handler Event handler function or object.
   * @param {object.<*>} [additionalObjectDefaults] Additional properties to
   *  be merged into the handler object.
   * @returns {object} Event handler object.
   */
  _createHandlerObject(pluginId, handlerName, handler,
                       additionalObjectDefaults = {}) {

    const handlerObject = handler;

    const handlerObjectDefaults = {
      data: {

      },
      functions: handler,
    };

    const handlerObjectRequiredElements = {
      execute: (...args) => this.executeHandler(handlerObjectDefaults,
            new EventHandlerExecutionMetadata(handlerName, ...args)),
      meta: {
        name: handlerName,
        plugin: this.room.getPlugin(pluginId),
        userHandler: handler,
      },
    };

    return merge(handlerObjectDefaults, additionalObjectDefaults,
        handlerObject, handlerObjectRequiredElements);
  }

  /**
   * Executes the given handler.
   *
   * @function TrappedRoomManager#executeHandler
   * @param {object.<*>} handlerObject Handler object.
   * @param {EventHandlerExecutionMetadata} metadata Event metadata.
   * @param {...*} args Event arguments.
   * @returns {EventHandlerExecutionMetadata} Event metadata.
   */
  executeHandler(handlerObject, metadata, ...args) {

    handlerObject.metadata = metadata;

    const handlerFunctions = handlerObject.functions;

    // TODO do we expect a non object handler?
    if (typeof handlerFunctions === `function`) {
      this._executeHandlerFunction(handlerFunctions, handlerObject, metadata,
          ...args);
    }
     else if (typeof handlerFunctions !== `object`) {
      // TODO support string handlers?
      HHM.log.warn(`Invalid handler type: ${typeof handlerFunctions}`);
    }

    // Iterable
    else if (typeof handlerFunctions[Symbol.iterator] === `function`) {
      for (let h of handlerFunctions) {
        this._executeHandlerFunction(h, handlerObject, metadata, ...args);
      }
    }

    else {
      // Object iteration
      for (let h of Object.getOwnPropertyNames(handlerFunctions)) {
        this._executeHandlerFunction(handlerFunctions[h], handlerObject,
            metadata, ...args);
      }
    }

    return metadata;
  }

  /**
   * TODO documentation
   *
   * @param {Function} handlerFunction The handler function.
   * @param {object.<*>} handlerObject Handler object.
   * @param {EventHandlerExecutionMetadata} metadata Event metadata.
   * @param {...*} args Event arguments.
   */
  _executeHandlerFunction(handlerFunction, handlerObject, metadata,
      ...args) {

    const pluginName = handlerObject.meta.plugin.getName();

    let extraArgsPosition = this.functionReflector
        .getArgumentInjectionPosition(handlerFunction, args);

    if (extraArgsPosition >= 0) {
      args = args.concat(Array(Math.max(0, extraArgsPosition - args.length))
          .fill(undefined))
          .concat(metadata.forPlugin(pluginName, handlerObject));
    }

    try {
      metadata.registerReturnValue(pluginName, handlerFunction(...args));
    } catch (e) {
      HHM.log.error(`Error during execution of handler ` +
          `${metadata.handlerName} for plugin ${pluginName}`);
      HHM.log.error(e);
    }
  }

  /**
   * Returns whether the plugin with the given ID is both enabled and loaded.
   *
   * @function TrappedRoomManager#_isPluginEnabledAndLoaded
   * @private
   * @param {number} pluginId Plugin ID.
   * @returns {boolean} Whether the plugin is enabled.
   *
   * TODO remove
   */
  _isPluginEnabledAndLoaded(pluginId) {
    return this.room.getPluginManager().hasPlugin(pluginId)
      && this.room.getPluginManager().getPlugin(pluginId).isEnabled();
  }

  /**
   * Checks event state validity.
   *
   * An event state is valid unless one of the event state validators returns
   * `false`, in which case further event handler execution is aborted for the
   * given event.
   *
   * @function TrappedRoomManager#_isValidEventState
   * @private
   * @param {string} handlerName Event handler name.
   * @param {EventHandlerExecutionMetadata} metadata Event metadata.
   * @param {...*} args Event arguments.
   * @returns {boolean} `false` if one of the event state validators returned
   *  `false`, `true` otherwise.
   */
  _isValidEventState(handlerName, metadata, ...args) {
    // If no validator was set, all states are considered valid
    if (this.eventStateValidators[handlerName] === undefined) {
      return true;
    }

    // Return true unless at least one validator returns exactly false
    for (let pluginName of
        Object.getOwnPropertyNames(this.eventStateValidators[handlerName])) {

      for (let validator of this.eventStateValidators[handlerName][pluginName]) {
        if (validator({ metadata: metadata }, ...args) === false) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Makes sure the given handler name is registered so that pre- and post-event
   * handler hooks for that handler are executed.
   *
   * @function TrappedRoomManager#_provideHandler
   * @private
   * @param {number} pluginId Plugin ID.
   * @param {string} handlerName Event handler name.
   */
  _provideHandler(pluginId, handlerName) {
    // Make sure the handler is registered
    if (this.room[handlerName] === undefined) {
      this.room._pluginManager.getPlugin(pluginId)[handlerName] = () => {};
    }
  }

  /**
   * Helper function to make sure there's a handler for each plugin ID.
   *
   * This is not done once for all plugins but instead every time the handlers
   * are accessed to make it possible to load additional plugins at runtime
   * later on.
   *
   * @function TrappedRoomManager#_provideHandlerObjectForIdentifier
   * @private
   * @param {number} pluginId Plugin ID.
   */
  _provideHandlerObjectForIdentifier(pluginId) {
    if (!this.handlers.hasOwnProperty(pluginId)) {
      this.handlers[pluginId] = {};
    }
  }

  /**
   * Helper function to make sure there's a property holder for each plugin ID.
   *
   * This is not done once for all plugins but instead every time the
   * properties are accessed to make it possible to load additional plugins at
   * runtime later on.
   *
   * @function TrappedRoomManager#_providePropertyObjectForIdentifier
   * @private
   * @param {number} pluginId Plugin ID.
   */
  _providePropertyObjectForIdentifier(pluginId) {
    if (!this.properties.hasOwnProperty(pluginId)) {
      this.properties[pluginId] = {};
    }
  }

  /**
   * Determine execution order for the given plugins and handler name.
   *
   * @function TrappedRoomManager#determineExecutionOrders
   * @param {Array.<number>} pluginIds `Array` of plugin IDs for which the
   *  execution order is to be determined.
   * @param {string} handlerName Name of the event handler.
   * @returns {Array.<number>} Given plugin IDs sorted for proper execution
   *  order.
   */
  determineExecutionOrder(pluginIds, handlerName) {
    let vertices = [];

    // Establish execution order dependencies for each plugin
    for (let pluginId of pluginIds) {
      let pluginSpec = this.room.getPluginManager().getPlugin(pluginId)
          .getPluginSpec();

      if (!pluginSpec.hasOwnProperty(`order`)) {
        continue;
      }

      this._addVertices(vertices, pluginId, handlerName, `before`);
      this._addVertices(vertices, pluginId, handlerName, `after`);
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
      let pluginName = this.room._pluginManager.getPlugin(pluginId)._name;

      HHM.log.error(`There was a cyclic dependency for handler ${handlerName} and plugin ${pluginName}`);
      // TODO
      //HHM.log.error(this.room._pluginManager._createDependencyChain(pluginId, []));
      throw(e);
    }
  }

  /**
   * Determines the execution order for all plugins and handlers.
   *
   * @function TrappedRoomManager#determineExecutionOrders
   */
  determineExecutionOrders() {
    this.handlerExecutionOrders = {};

    for (let handlerName of this.handlerNames) {
      let pluginIds = [];

      // Collect plugins for current handler
      for (let pluginId of this.room._pluginManager.plugins.keys()) {
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
   *
   * @function TrappedRoomManager#getEventHandlerNames
   * @param {*} _ Unused.
   * @param {number} pluginId Plugin ID.
   * @returns {Array.<string>} Event handler names for the given plugin.
   */
  getEventHandlerNames(_, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    return Object.getOwnPropertyNames(this.handlers[pluginId]);
  }

  /**
   * Returns the internal event handler object for the given plugin and handler
   * name or undefined if no such handler exists.
   *
   * @function TrappedRoomManager#getEventHandlerObject
   * @param {number} pluginId Plugin ID.
   * @param {string} handlerName Event handler name.
   * @returns {(object.<*>|undefined)} Event handler object or undefined.
   */
  getEventHandlerObject(pluginId, handlerName) {
    return (this.handlers[pluginId] || {})[handlerName];
  }

  /**
   * Returns the event handler objects of all plugins for the given handler
   * name.
   *
   * @function TrappedRoomManager#getEventHandlerObjects
   * @param {string} handlerName Event handler name.
   * @returns {object.<number, object.<*>>} Event handler objects by plugin ID.
   */
  getEventHandlerObjects(handlerName) {
    return Object.getOwnPropertyNames(this.handlers)
        .filter((pluginId) => this.handlers[pluginId][handlerName] !== undefined)
        .map((pluginId) => [pluginId, this.handlers[pluginId][handlerName]])
        .reduce((result, currentValue) =>
          result[currentValue[0]] = currentValue[1], {});
  }

  /**
   * Returns the properties (not event handlers) registered for the given
   * plugin.
   *
   * To get both properties and event handlers, use
   * `Object.getOwnPropertyNames`.
   *
   * @function TrappedRoomManager#getPropertyNames
   * @param {*} _ Unused.
   * @param {number} pluginId Plugin ID.
   * @returns {Array.<string>} Property names for the given plugin.
   *
   */
  getPropertyNames(_, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    return Object.getOwnPropertyNames(this.properties[pluginId]);
  }

  /**
   * Returns whether there are event handlers registered for the given plugin.
   *
   * @function TrappedRoomManager#hasEventHandlers
   * @param {*} _ Unused.
   * @param {number} pluginId Plugin ID.
   * @returns {boolean} Whether there are event handlers registered for the
   *  given plugin.
   */
  hasEventHandlers(_, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    return Object.getOwnPropertyNames(this.handlers[pluginId]).length > 0;
  }

  /**
   * Returns whether there are properties registered for the given plugin.
   *
   * Note that global properties of the proxied room are NOT taken into account,
   * as are properties starting with an underscore.
   *
   * @function TrappedRoomManager#hasProperties
   * @param {*} _ Unused.
   * @param {number} pluginId Plugin ID.
   * @returns {boolean} Whether there are properties registered for the given
   *  plugin
   */
  hasProperties(_, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    return Object.getOwnPropertyNames(this.properties[pluginId])
        .filter(prop => !prop.startsWith('_')).length > 0;
  }

  /**
   * Returns the event handler registered for the given handler and plugin ID,
   * or undefined if none is registered.
   *
   * Note that this always returns exactly what the plugin author assigned as
   * the handler, to avoid unexpected behavior. If you want to access the
   * internal event handler, use {@link TrappedRoomManager#getEventHandlerObject}
   * instead which is available as {@link HhmRoomObject#getEventHandlerObject}.
   *
   * @function TrappedRoomManager#onEventHandlerGet
   * @param {*} _ Unused.
   * @param {string} handlerName Name of the event handler.
   * @param {number} pluginId Plugin ID.
   * @returns {(Function|undefined)} Event handler function or `undefined` if no
   *  such function is registered for the given plugin.
   */
  onEventHandlerGet(_, handlerName, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    if (this.handlers[pluginId][handlerName] !== undefined) {
      return this.handlers[pluginId][handlerName].meta.userHandler;
    }
  }

  /**
   * Returns whether there is an event handler registered for the given handler
   * and plugin.
   *
   * @function TrappedRoomManager#onEventHandlerHas
   * @param {*} _ Unused.
   * @param {string} handlerName Event handler name.
   * @param {number} pluginId Plugin ID.
   * @returns {boolean} whether there is an event handler registered for the
   *  given handler and plugin.
   */
  onEventHandlerHas(_, handlerName, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    return this.handlers[pluginId].hasOwnProperty(handlerName);
  }

  /**
   * Registers the given handler function for the given handler name and plugin
   * ID.
   *
   * @TODO handle onGameTick differently
   *
   * @function TrappedRoomManager#onEventHandlerSet
   * @param {*} _ Unused.
   * @param {string} handlerName Event handler name.
   * @param {(object|Function)} handler Event handler function or object
   * @param {number} pluginId Plugin ID.
   */
  onEventHandlerSet(_, handlerName, handler, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);
    this.handlerNames.add(handlerName);

    this.handlers[pluginId][handlerName] =
        this._createHandlerObject(pluginId, handlerName, handler);

    this.handlersDirty = true;

    this.room._pluginManager.triggerHhmEvent(HHM.events.EVENT_HANDLER_SET, {
      handler: this.handlers[pluginId][handlerName],
    });
  }

  /**
   * Removes the registered event handler for the given handler and plugin name.
   *
   * @function TrappedRoomManager#onEventHandlerUnset
   * @param {*} _ Unused.
   * @param {string} handlerName Event handler name.
   * @param {number} pluginId Plugin ID.
   */
  onEventHandlerUnset(_, handlerName, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    // TODO retain handler object, but set to deleted?
    const handler = this.handlers[pluginId][handlerName];
    const plugin = this.room._pluginManager.getPlugin(pluginId);

    delete this.handlers[pluginId][handlerName];

    this.handlersDirty = true;

    this.room._pluginManager.triggerHhmEvent(HHM.events.EVENT_HANDLER_UNSET, {
      handler
    });
  }

  /**
   * Returns whether the given property exists for the given plugin.
   *
   * Note that global properties of the proxied room are taken into account as
   * well so long as they don't start with an underscore.
   *
   * @function TrappedRoomManager#onPropertyHas
   * @param {*} _ Unused.
   * @param {string} propertyName Name of the property.
   * @param {number} pluginId Plugin ID.
   * @returns {boolean} Whether the given property exists for the given plugin.
   */
  onPropertyHas(_, propertyName, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    return this.properties[pluginId].hasOwnProperty(propertyName)
        || (!propertyName.startsWith(`_`)
            && this.room.hasOwnProperty(propertyName));
  }

  /**
   * Returns an array of handlers registered for the given plugin ID.
   *
   * @function TrappedRoomManager#onOwnHandlerNamesGet
   * @param {*} _ Unused.
   * @param {number} pluginId Plugin ID.
   * @returns {Array.<string>} Names of the registered handlers for the given
   *  plugin.
   */
  onOwnHandlerNamesGet(_, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    return Object.getOwnPropertyNames(this.handlers[pluginId]);
  }

  /**
   * Returns an array of properties (including event handlers) registered for
   * the given plugin ID.
   *
   * Properties are the object properties in the JavaScript sense here:
   *
   *  - properties of the proxied room (except ones starting with "_"),
   *    excluding event handlers
   *  - properties registered for the given plugin
   *  - handlers registered for the given plugin
   *
   * @function TrappedRoomManager#onOwnPropertyNamesGet
   * @param {*} _ Unused.
   * @param {number} pluginId Plugin ID.
   * @returns {Array.<string>} Names of the visible properties on the room proxy
   *  of the given plugin.
   */
  onOwnPropertyNamesGet(_, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);
    this._provideHandlerObjectForIdentifier(pluginId);

    return [...new Set(Object.getOwnPropertyNames(this.room)
        .filter(v => !v.startsWith(`_`) && !v.startsWith(`on`))
        .concat(this.getEventHandlerNames(_, pluginId))
        .concat(this.getPropertyNames(_, pluginId)))];
  }

  /**
   * Returns a property descriptor for the given handler and plugin ID.
   *
   * @function TrappedRoomManager#onOwnHandlerDescriptorGet
   * @param {*} _ Unused.
   * @param {string} handlerName Event handler name.
   * @param {number} pluginId Plugin ID.
   * @returns {(Object|undefined)} Property descriptor or `undefined` if the
   *  handler is not defined.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
   */
  onOwnHandlerDescriptorGet(_, handlerName, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    if (this.handlers[pluginId].hasOwnProperty(handlerName)) {
      return Object.getOwnPropertyDescriptor(this.handlers[pluginId],
          handlerName);
    }
  }

  /**
   * Returns a property descriptor for the given property and plugin ID.
   *
   * This will first look for a property on the given plugin, then for global
   * properties on the room object.
   *
   * @function TrappedRoomManager#onOwnPropertyDescriptorGet
   * @param {*} _ Unused.
   * @param {string} propertyName Property name.
   * @param {number} pluginId Plugin ID.
   * @returns {(Object|undefined)} Property descriptor or `undefined`.
   */
  onOwnPropertyDescriptorGet(_, propertyName, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    if (this.properties[pluginId].hasOwnProperty(propertyName)) {
      return Object.getOwnPropertyDescriptor(this.properties[pluginId],
          propertyName);
    }

    if (this.room.hasOwnProperty(propertyName)
        && !propertyName.startsWith(`_`)) {
      return Object.getOwnPropertyDescriptor(this.room, propertyName);
    }
  }

  /**
   * Executes the event handlers registered for the given handler.
   *
   * @TODO handle onGameTick differently
   *
   * @function TrappedRoomManager#onExecuteEventHandlers
   * @param {*} _ Unused.
   * @param {string} handlerName Event handler name.
   * @param {...*} args Event arguments.
   * @returns {boolean} `false` if one of the event handlers returned
   *  `false`, `true` otherwise.
   */
  onExecuteEventHandlers(_, handlerName, ...args) {
    if (this.handlersDirty) {
      this.determineExecutionOrders();
    }

    const metadata = new EventHandlerExecutionMetadata(handlerName);

    // Execute pre-event handler hooks
    if (this.preEventHandlerHooks[handlerName] !== undefined) {

      for (let pluginId of
          Object.getOwnPropertyNames(this.preEventHandlerHooks[handlerName])
              .map((id) => parseInt(id))) {

        if (!this._isPluginEnabledAndLoaded(pluginId)) {
          continue;
        }

        const pluginName = this.room._pluginManager.getPluginName(pluginId);

        for (let hook of this.preEventHandlerHooks[handlerName][pluginId]) {
          try {
            let returnValue = hook({
              room: this.room,
              // TODO pass object handler
              metadata: metadata.forPlugin(pluginName)
            }, ...args);

            args = Array.isArray(returnValue) ? returnValue : args;
            metadata.registerReturnValue(pluginName, returnValue);
          } catch (e) {
            HHM.log.error(`Error during execution of pre-event handler hook ` +
              `${handlerName} for plugin ${pluginName}`);
            HHM.log.error(e);
          }
        }
      }
    }

    // Execute event handlers
    if (this.handlerExecutionOrders.hasOwnProperty(handlerName)) {
      for (let pluginId of this.handlerExecutionOrders[handlerName]) {
        // Skip disabled plugins
        if (!this._isPluginEnabledAndLoaded(pluginId)) {
          continue;
        }

        // Abort if event state not valid
        if (!this._isValidEventState(handlerName, metadata, ...args)) {
          break;
        }

        this.executeHandler(this.handlers[pluginId][handlerName], metadata,
                ...args);
      }
    }

    // Execute post-event handler hooks
    if (this.postEventHandlerHooks[handlerName] !== undefined) {
      for (let pluginId of Object.getOwnPropertyNames(
          this.postEventHandlerHooks[handlerName]).map((id) => parseInt(id))) {

        if (!this._isPluginEnabledAndLoaded(pluginId)) {
          continue;
        }

        const pluginName = this.room._pluginManager.getPluginName(pluginId);

        for (let hook of this.postEventHandlerHooks[handlerName][pluginId]) {
          try {
            // TODO pass handler object
            hook({ room: this.room, metadata: metadata.forPlugin(pluginName) }, ...args);
          } catch (e) {
            HHM.log.error(`Error during execution of post-event handler hook ` +
                `${handlerName} for plugin ${pluginName}`);
            HHM.log.error(e);
          }
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
   * not a property with the given name set for the plugin.
   *
   * @function TrappedRoomManager#onPropertyGet
   * @param {*} _ Unused.
   * @param {string} propertyName Property name.
   * @param {number} pluginId Plugin ID.
   * @returns {(*|undefined)} Property value or `undefined`.
   */
  onPropertyGet(_, propertyName, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    if (typeof this.properties[pluginId][propertyName] !== `undefined` ||
        propertyName.startsWith(`_`)) {
      return this.properties[pluginId][propertyName];
    }

    if (typeof this.room[propertyName] !== `undefined`) {
      return this.room[propertyName];
    }
  }

  /**
   * Sets the given property to the given value for the given plugin ID.
   *
   * @function TrappedRoomManager#onPropertySet
   * @param {*} _ Unused.
   * @param {string} propertyName Property name.
   * @param {*} value New value for the property.
   * @param {number} pluginId Plugin ID.
   */
  onPropertySet(_, propertyName, value, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    let valueOld = this.properties[pluginId][propertyName];
    this.properties[pluginId][propertyName] = value;

    this.room._pluginManager.triggerHhmEvent(HHM.events.PROPERTY_SET, {
      plugin: this.room._pluginManager.getPlugin(pluginId),
      propertyName: propertyName,
      propertyValue: value,
      propertyValueOld: valueOld,
    });
  }

  /**
   * Unset the given property for the given plugin ID.
   *
   * @function TrappedRoomManager#onPropertyUnset
   * @param {*} _ Unused.
   * @param {string} propertyName Property name.
   * @param {number} pluginId Plugin ID.
   */
  onPropertyUnset(_, propertyName, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    const propertyValue = this.properties[pluginId][propertyName];

    delete this.properties[pluginId][propertyName];

    this.room._pluginManager.triggerHhmEvent(HHM.events.PROPERTY_UNSET, {
      plugin: this.room._pluginManager.getPlugin(pluginId),
      propertyName: propertyName,
      propertyValue: propertyValue,
    });
  }

  /**
   * Removes the handlers and properties for the given plugin ID.
   *
   * Must be called by {@link PluginManager#removePlugin} to ensure overall
   * consistency.
   *
   * @function TrappedRoomManager#removePluginHandlersAndProperties
   * @param {number} pluginId Plugin ID.
   */
  removePluginHandlersAndProperties(pluginId) {
    if (!this.room._pluginManager.hasPlugin(pluginId)) {
      return;
    }

    delete this.properties[pluginId];
    delete this.handlers[pluginId];
    this.handlersDirty = true;
  }

  /**
   * Add an event state validator function for the given handler names.
   *
   * The validator function should return false if the event state is no longer
   * valid and further event handlers should not be executed.
   *
   * @function TrappedRoomManager#addEventStateValidator
   * @param {number} pluginId Plugin ID.
   * @param {string} handlerNames Event handler name(s).
   * @param {Function} validator Validator function.
   * @returns {TrappedRoomManager} The trapped room manager, enables method
   *  chaining.
   */
  addEventStateValidator(pluginId, handlerNames, validator) {
    if (typeof handlerNames === `object` &&
        typeof handlerNames[Symbol.iterator] === 'function') {
      for (let handlerName of handlerNames) {
        this.addEventStateValidator(pluginId, handlerName, validator);
      }

      return this;
    }

    let handlerName = String(handlerNames);

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
   * Add a hook for the given handler names that is executed before plugin
   * event handlers.
   *
   * Hooks are passed the room object and the event arguments. If the hook
   * returns an `Array` it will be used to overwrite the event arguments.
   *
   * @function TrappedRoomManager#addPostEventHandlerHook
   * @param {number} pluginId Plugin ID.
   * @param {(string|Array.<string>)} handlerNames Event handler name(s).
   * @param {Function} hook Function hook.
   * @returns {TrappedRoomManager} The trapped room manager, enables method
   *  chaining.
   */
  addPreEventHandlerHook(pluginId, handlerNames, hook) {
    // TODO turn hook into handler object
    if (typeof handlerNames === `object` &&
        typeof handlerNames[Symbol.iterator] === 'function') {
      for (let handlerName of handlerNames) {
        this.addPreEventHandlerHook(pluginId, handlerName, hook);
      }

      return this;
    }

    let handlerName = String(handlerNames);

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
   * Add a hook for the given handler names that is executed after plugin
   * event handlers.
   *
   * It is executed regardless of event state validity.
   *
   * Hooks are passed the room object, a metadata object, and the event
   * arguments.
   *
   * @function TrappedRoomManager#addPostEventHandlerHook
   * @param {number} pluginId Plugin ID.
   * @param {(string|Array.<string>)} handlerNames Event handler name(s).
   * @param {Function} hook Function hook.
   * @returns {TrappedRoomManager} The trapped room manager, enables method
   *  chaining.
   */
  addPostEventHandlerHook(pluginId, handlerNames, hook) {
    // TODO turn hook into handler object
    if (typeof handlerNames === `object` &&
        typeof handlerNames[Symbol.iterator] === 'function') {
      for (let handlerName of handlerNames) {
        this.addPostEventHandlerHook(pluginId, handlerName, hook);
      }

      return this;
    }

    let handlerName = String(handlerNames);

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
}

module.exports = TrappedRoomManager;