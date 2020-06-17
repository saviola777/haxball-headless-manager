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
 * @property {FunctionReflector} functionReflector `FunctionReflector` used to
 *  analyze event handler functions.
 * @property {Map.<string, Array.<number>>} handlerExecutionOrders `Array` of
 *  plugin IDs in execution order for each handler.
 * @property {Set.<string>} handlerNames Known event handler names.
 * @property {Object.<number, Object.<string, Function>>} handlers Event
 *  handlers for each plugin.
 * @property {boolean} handlersDirty Whether handlers have been changed since
 *  the last call to {@link TrappedRoomManager#determineExecutionOrders}.
 * @property {Map<string, Map.<number, Map.<string, Function>>>}
 *  postEventHandlerHooks `Map` of post-event handler hooks for each plugin and
 *  handler.
 * @property {Map.<string, Map.<number, Map.<string, Function>>>}
 *  postEventHooks `Map` of post-event hooks for each plugin and handler.
 * @property {Map<string, Map.<number, Map.<string, Function>>>}
 *  preEventHandlerHooks `Map` of pre-event handler hooks for each plugin and
 *  handler.
 * @property {Map.<string, Map.<number, Map.<string, Function>>>}
 *  preEventHooks `Map` of pre-event hooks for each plugin and handler.
 *
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
    this._class = `TrappedRoomManager`;

    this.functionReflector = new HHM.classes.FunctionReflector(
        Math.floor((Math.random() * 10000) + 1));

    this.handlerExecutionOrders = new Map();
    this.handlerNames = new Set();

    this.onGameTickHandlers = new Map();

    this.handlers = new Map();
    this.handlersDirty = true;

    this.postEventHooks = new Map();
    this.preEventHooks = new Map();

    this.preEventHandlerHooks = new Map();
    this.postEventHandlerHooks = new Map();

    this.properties = new Map();

    this.room = room;
    this.room._trappedRoomManager = this;
  }

  /**
   * Helper function which adds a hook to a map of hooks.
   *
   * @function TrappedRoomManager#_addHook
   * @private
   * @param {object} that To support method chaining, this object will be
   *  returned.
   * @param {Map.<string, Map.<number, Map.<string, Function>>>} hooks Map of
   *  hooks by handler name, plugin ID and hook ID.
   * @param {number} pluginId
   * @param {(string|Iterable)} handlerNames
   * @param {Function} hook
   * @param {string} [hookId] Unique hook identifier for the plugin and handler.
   * @returns {*} The argument `that`.
   */
  _addHook(that, hooks, pluginId, handlerNames, hook,
          hookId = hook.toString()) {

    if (typeof handlerNames === `object` &&
        typeof handlerNames[Symbol.iterator] === 'function') {
      for (let handlerName of handlerNames) {
        this._addHook(that, hooks, pluginId, handlerName, hook, hookId);
      }

      return that;
    }

    let handlerName = String(handlerNames);

    if (!hooks.has(handlerName)) {
      hooks.set(handlerName, new Map());
    }

    const handlerHooks = hooks.get(handlerName);


    if (!handlerHooks.has(pluginId)) {
      handlerHooks.set(pluginId, new Map());
    }

    handlerHooks.get(pluginId).set(hookId, hook);

    this._provideHandler(pluginId, handlerName);

    return that;
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

    const that = this;
    const handlerObject = handler;

    const handlerObjectDefaults = {
      data: {},
      function: handler,
    };

    const handlerObjectRequiredElements = {
      execute: (metadata, ...args) => {
        metadata = metadata || new EventHandlerExecutionMetadata(handlerName,
            ...args);

        return this.executeHandler(handlerObjectDefaults, metadata)
      },
      meta: {
        name: handlerName,
        plugin: this.room.getPlugin(pluginId),
        userHandler: handler,
      },
      data: {
        'hhm/core': {
          preEventHandlerHooks: new Map(),
          postEventHandlerHooks: new Map(),
        }
      },
      addPreEventHandlerHook: function (plugin, hook, hookId) {
        return that._addHook(this, this.data[`hhm/core`].preEventHandlerHooks,
            plugin.id, handlerName, hook, hookId);
      },
      addPostEventHandlerHook: function (plugin, hook, hookId) {
        return that._addHook(this, this.data[`hhm/core`].postEventHandlerHooks,
            plugin.id, handlerName, hook, hookId);
      },
      getData: function (pluginName, parameterName, defaultValue) {
        let result = (this.data[pluginName] || {})[parameterName];

        return result === undefined ? defaultValue : result;
      }
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
  executeHandler(handlerObject, metadata) {

    handlerObject.metadata = metadata;

    const handlerFunction = handlerObject.function;

    // TODO do we expect a non object handler?
    if (typeof handlerFunction === `function`) {
      this._executeHandlerFunction(handlerFunction, handlerObject, metadata);
    }
     else {
      // TODO support string handlers?
      HHM.log.warn(`Invalid handler function type: ${typeof handlerFunction}`);
    }

    return metadata;
  }

  /**
   * TODO documentation
   *
   * @param {Function} handlerFunction The handler function.
   * @param {object.<*>} handlerObject Handler object.
   * @param {EventHandlerExecutionMetadata} metadata Event metadata.
   */
  _executeHandlerFunction(handlerFunction, handlerObject, metadata) {

    const pluginName = handlerObject.meta.plugin.getName();

    let args = metadata.args;

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
      metadata.registerReturnValue(pluginName, e);
    }
  }

  _executeHooks(hooks, handlerName, metadata) {
    if (!hooks.has(handlerName)) {
      return;
    }

    for (const [pluginId, pluginHandlerHooks] of
        hooks.get(handlerName).entries()) {

      if (!this._isPluginEnabledAndLoaded(pluginId)) {
        continue;
      }

      const pluginName = this.room._pluginManager.getPluginName(pluginId);

      for (const [id, hook] of pluginHandlerHooks.entries()) {
        let returnValue = false;

        try {
          // TODO plugin-specific metadata?
          returnValue = hook({ room: this.room, metadata: metadata },
              ...metadata.args);

          if (returnValue !== undefined) {
            metadata.registerReturnValue(pluginName, returnValue, id);
          }
        } catch (e) {
          HHM.log.error(`Error during execution of hook ` +
              `${id} (handler ${handlerName}) for plugin ${pluginName}`);
          HHM.log.error(e);
        }
      }
    }
  }

  _executeOnGameTickHandlers() {
    this.onGameTickHandlers.forEach((handlerFunction) => handlerFunction());
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
    // TODO can this ever become undefined later on? If so, check for plugin
    //  handler instead of global handler
    if (this.room[handlerName] === undefined) {
      // TODO distinguish no-op handler from user-defined handler
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
    if (!this.handlers.has(pluginId)) {
      this.handlers.set(pluginId, new Map());
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
    if (!this.properties.has(pluginId)) {
      this.properties.set(pluginId, new Map());
    }
  }

  _updateOnGameTickHandlers() {
    this.onGameTickHandlers.clear();

    this.getAllEventHandlerObjects(`onGameTick`).forEach((h, pluginId) => {
      if (this.room._pluginManager.isPluginEnabled(pluginId)) {
        this.onGameTickHandlers.set(pluginId, h.function);
      }
    });
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
        if (!executionOrder.includes(pluginId)) {
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
    this.handlerExecutionOrders.clear();

    for (let handlerName of this.handlerNames) {
      let pluginIds = [];

      // Collect plugins for current handler
      for (let pluginId of this.room._pluginManager.plugins.keys()) {
        this._provideHandlerObjectForIdentifier(pluginId);

        if (this.handlers.get(pluginId).has(handlerName)) {
          pluginIds.push(pluginId);
        }
      }

      // No plugins for the given handler, remove it
      if (pluginIds.length === 0) {
        this.handlerNames.delete(handlerName);
        continue;
      }

      this.handlerExecutionOrders.set(handlerName,
          this.determineExecutionOrder(pluginIds, handlerName));
    }

    this.handlersDirty = false;
  }

  /**
   * Returns an `Array` of all registered handler names.
   *
   * @function PluginManager#getHandlerNames
   * @returns {Array.<string>} Registered handler names.
   */
  getAllEventHandlerNames() {
    return [...new Set(Array.from(this.handlers.keys())
        .flatMap((pluginId) => Array.from(this.handlers.get(pluginId).keys())))];
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

    return Array.from(this.handlers.get(pluginId).keys());
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
    return (this.handlers.get(pluginId) || new Map()).get(handlerName);
  }

  /**
   * Returns the event handler objects of all plugins for the given handler
   * name.
   *
   * @function TrappedRoomManager#getEventHandlerObjects
   * @param {string} handlerName Event handler name.
   * @returns {Map.<number, object.<*>>} Event handler objects by plugin ID.
   */
  getAllEventHandlerObjects(handlerName) {
    const eventHandlerObjects = new Map();

    Array.from(this.handlers.keys())
        .filter((pluginId) => this.handlers.get(pluginId).has(handlerName))
        .forEach((pluginId) => eventHandlerObjects.set(pluginId,
          this.getEventHandlerObject(pluginId, handlerName)));

    return eventHandlerObjects;
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

    return Array.from(this.properties.get(pluginId).keys());
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

    return this.handlers.get(pluginId).size > 0;
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

    return Array.from(this.properties.get(pluginId).keys())
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

    const handler = this.handlers.get(pluginId).get(handlerName);

    if (handler !== undefined) {
      return handler.meta.userHandler;
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

    return this.handlers.get(pluginId).has(handlerName);
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

    this.handlers.get(pluginId).set(handlerName,
        this._createHandlerObject(pluginId, handlerName, handler));

    this.handlersDirty = true;

    this.room._pluginManager.triggerHhmEvent(HHM.events.EVENT_HANDLER_SET, {
      handler: this.handlers.get(pluginId).get(handlerName),
    });
  }

  /**
   * Removes the registered event handler for the given handler and plugin name.
   *
   * TODO handle differently for onGameTick
   *
   * @function TrappedRoomManager#onEventHandlerUnset
   * @param {*} _ Unused.
   * @param {string} handlerName Event handler name.
   * @param {number} pluginId Plugin ID.
   */
  onEventHandlerUnset(_, handlerName, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    // TODO retain handler object, but set to deleted?
    const handler = this.handlers.get(pluginId).get(handlerName);

    this.handlers.get(pluginId).delete(handlerName);

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

    return this.properties.get(pluginId).has(propertyName)
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

    return Array.from(this.handlers.get(pluginId).keys());
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
   * @returns {Object} Property descriptor for the given handler.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
   */
  onOwnHandlerDescriptorGet(_, handlerName, pluginId) {
    this._provideHandlerObjectForIdentifier(pluginId);

    return {
      enumerable: true,
      configurable: true,
      writable: true,
      value: this.onEventHandlerGet(_, handlerName, pluginId)
    };
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
    return {
      enumerable: true,
      configurable: true,
      writable: true,
      value: this.onPropertyGet(_, propertyName, pluginId)
    };
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
   *  `false`, `true` otherwise. Always `true` for onGameTick events.
   */
  onExecuteEventHandlers(_, handlerName, ...args) {
    if (this.handlersDirty) {
      this._updateOnGameTickHandlers();
      this.determineExecutionOrders();
    }

    if (handlerName === `onGameTick`) {
      this._executeOnGameTickHandlers();

      return true;
    }

    const metadata = new EventHandlerExecutionMetadata(handlerName, ...args);

    metadata.setHandlers(this.getAllEventHandlerObjects(handlerName));

    // Execute pre-event hooks
    if (this.preEventHooks.has(handlerName)) {
      this._executeHooks(this.preEventHooks, handlerName, metadata);
    }

    let preEventReturnValue = metadata.getReturnValue();

    let executedHandlers = new Map();

    // Execute event handlers
    if (this.handlerExecutionOrders.has(handlerName) && preEventReturnValue) {

      for (let pluginId of this.handlerExecutionOrders.get(handlerName)) {

        // Skip disabled plugins
        if (!this._isPluginEnabledAndLoaded(pluginId)) {
          continue;
        }

        const argsOld = metadata.args;

        const handlerObject = this.handlers.get(pluginId).get(handlerName);

        metadata.setHandlers(new Map([[pluginId, handlerObject]]));

        // Execute pre-event handler hooks for this handler name
        this._executeHooks(this.preEventHandlerHooks, handlerName, metadata);

        // Execute pre-event handler hooks for this specific event handler
        this._executeHooks(handlerObject.data[`hhm/core`].preEventHandlerHooks,
            handlerName, metadata);

        // Only execute if none of the pre-event (handler) hooks returned false
        if (metadata.getReturnValue() === true) {
          this.executeHandler(handlerObject, metadata);
          executedHandlers.set(pluginId, handlerObject);

          // Execute post-event handler hooks for this specific event handler
          this._executeHooks(this.postEventHandlerHooks, handlerName, metadata);

          // Execute post-event handler hooks for this handler name
          this._executeHooks(handlerObject.data[`hhm/core`].postEventHandlerHooks,
              handlerName, metadata);
        }

        // Reset args
        metadata.args = argsOld;
      }
    }

    metadata.setHandlers(executedHandlers);

    // Execute post-event hooks
    if (this.postEventHooks.has(handlerName)) {
      this._executeHooks(this.postEventHooks, handlerName, metadata);
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

    const pluginProperties = this.properties.get(pluginId);

    if (pluginProperties.has(propertyName) || propertyName.startsWith(`_`)) {
      return pluginProperties.get(propertyName);
    }

    return this.room[propertyName];
  }

  /**
   * Sets the given property to the given value for the given plugin ID.
   *
   * @function TrappedRoomManager#onPropertySet
   * @param {*} _ Unused.
   * @param {string} propertyName Property name.
   * @param {*} propertyValue New value for the property.
   * @param {number} pluginId Plugin ID.
   */
  onPropertySet(_, propertyName, propertyValue, pluginId) {
    this._providePropertyObjectForIdentifier(pluginId);

    const plugin = this.room._pluginManager.getPlugin(pluginId);
    const pluginProperties = this.properties.get(pluginId);

    let propertyValueOld = pluginProperties.get(propertyName);
    pluginProperties.set(propertyName, propertyValue);

    this.room._pluginManager.triggerHhmEvent(HHM.events.PROPERTY_SET, {
      plugin,
      propertyName,
      propertyValue,
      propertyValueOld,
    });

    // Register plugin name after setting the plugin specification
    if (propertyName === `pluginSpec`) {

      // If pluginSpec is no object, use the value as plugin name
      // TODO document behavior
      if (typeof propertyValue !== `object`) {
        plugin.pluginSpec = { name: propertyValue };
        return;
      }

      if (propertyValue.hasOwnProperty(`name`)
          && propertyValue.name !== plugin._name) {

        plugin._name = propertyValue.name;

      } else if (plugin._name !== plugin._id) {
        propertyValue.name = plugin._name;
      }

      plugin.setConfig();

      return;
    }

    if (propertyName === `_name`) {
      if (plugin.pluginSpec === undefined) {
        plugin.pluginSpec = {};
      }

      plugin.pluginSpec.name = propertyValue;
      this.room._pluginManager.pluginIds.set(propertyValue, plugin._id);

      return;
    }
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

    const pluginProperties = this.properties.get(pluginId);

    const propertyValue = pluginProperties.get(propertyName);

    const returnValue = pluginProperties.delete(propertyName);

    if (returnValue) {
      this.room._pluginManager.triggerHhmEvent(HHM.events.PROPERTY_UNSET, {
        plugin: this.room._pluginManager.getPlugin(pluginId),
        propertyName: propertyName,
        propertyValue: propertyValue,
      });
    }
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

    let clearPluginHooks = (handlers) => handlers.delete(pluginId);

    // TODO solve cleaner, provide public API to remove hooks
    this.preEventHandlerHooks.forEach(clearPluginHooks);
    this.preEventHooks.forEach(clearPluginHooks);
    this.postEventHandlerHooks.forEach(clearPluginHooks);
    this.postEventHooks.forEach(clearPluginHooks);

    this.properties.delete(pluginId);
    this.handlers.delete(pluginId);
    this.handlersDirty = true;
  }

  /**
   * Add a hook for the given handler names that is executed before every
   * single plugin event handler.
   *
   * Hooks are passed the room and handler objects and the event arguments. If
   * the hook returns an `Array` it will be used to overwrite the event
   * arguments. If it returns `false`, the event handler will not be executed.
   *
   * @function TrappedRoomManager#addPreEventHook
   * @param {number} pluginId Plugin ID.
   * @param {(string|Array.<string>)} handlerNames Event handler name(s).
   *  hooks for the given plugin and handler names.
   * @param {Function} hook Function hook.
   * @param {*} [hookId] Unique identifier of this hook within the
   *  hooks for the given plugin and handler names, defaults to the hook code.
   * @returns {TrappedRoomManager} The trapped room manager, enables method
   *  chaining.
   */
  addPreEventHandlerHook(pluginId, handlerNames, hook, hookId) {
    this._addHook(this, this.preEventHandlerHooks, pluginId, handlerNames, hook,
        hookId);

    return this;
  }

  /**
   * Add a hook for the given handler names that is executed before plugin
   * event handlers.
   *
   * Hooks are passed the room object and the event arguments. If the hook
   * returns an `Array` it will be used to overwrite the event arguments.
   *
   * @function TrappedRoomManager#addPreEventHook
   * @param {number} pluginId Plugin ID.
   * @param {(string|Array.<string>)} handlerNames Event handler name(s).
   * @param {Function} hook Function hook.
   * @param {*} [hookId] Unique identifier of this hook within the
   *  hooks for the given plugin and handler names, defaults to the hook code.
   * @returns {TrappedRoomManager} The trapped room manager, enables method
   *  chaining.
   */
  addPreEventHook(pluginId, handlerNames, hook, hookId) {
    this._addHook(this, this.preEventHooks, pluginId, handlerNames, hook,
        hookId);

    return this;
  }

  /**
   * Add a hook for the given handler names that is executed after every single
   * plugin event handler.
   *
   * Hooks are passed the room and handler objects, the handler return value,
   * a metadata object, and the event arguments.
   *
   * @function TrappedRoomManager#addPostEventHook
   * @param {number} pluginId Plugin ID.
   * @param {(string|Array.<string>)} handlerNames Event handler name(s).
   * @param {Function} hook Function hook.
   * @param {*} [hookId] Unique identifier of this hook within the
   *  hooks for the given plugin and handler names, defaults to the hook code.
   * @returns {TrappedRoomManager} The trapped room manager, enables method
   *  chaining.
   */
  addPostEventHandlerHook(pluginId, handlerNames, hook, hookId) {
    this._addHook(this, this.postEventHandlerHooks, pluginId, handlerNames,
        hook, hookId);

    return this;
  }

  /**
   * Add a hook for the given handler names that is executed after all plugin
   * event handlers.
   *
   * It is executed regardless of event state validity.
   *
   * Hooks are passed the room object, a metadata object, and the event
   * arguments.
   *
   * @function TrappedRoomManager#addPostEventHook
   * @param {number} pluginId Plugin ID.
   * @param {(string|Array.<string>)} handlerNames Event handler name(s).
   *  hooks for the given plugin and handler names.
   * @param {Function} hook Function hook.
   * @param {*} [hookId] Unique identifier of this hook within the
   *  hooks for the given plugin and handler names, defaults to the hook code.
   * @returns {TrappedRoomManager} The trapped room manager, enables method
   *  chaining.
   */
  addPostEventHook(pluginId, handlerNames, hook, hookId) {
    return this._addHook(this, this.postEventHooks, pluginId, handlerNames,
        hook, hookId);
  }
}

module.exports = TrappedRoomManager;