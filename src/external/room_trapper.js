/**
 * This module contains documentation for components of the haxball room
 * trapper.
 *
 * From the GitHub page:
 *
 * This is a module for intercepting the setting and removing of HaxBall
 * RoomObject event handlers and properties. It has been made for a plugin
 * system for the HaxBall headless in mind.
 *
 * The module allows the plugins to manage room properties and event handlers
 * exactly like with the vanilla room object, but in the background a
 * trappedRoomManager manages access to the proxied room object as well as
 * storage and execution of event handlers and properties for each plugin.
 *
 * Instead of allowing a plugin to assign a handler or property to the
 * RoomObject, a Proxy is created with the method RoomTrapper.createTrappedRoom
 * and injected to be used by the plugin instead. The created Proxy will
 * intercept the setting, unsetting, as well as accessing and enumeration of
 * handlers and properties and instead will redirect the calls to the
 * trappedRoomManager. Other properties and methods of the RoomObject are
 * available to be used through the Proxy normally.
 *
 * @module
 * @external haxball-room-trapper
 * @see https://github.com/morko/haxball-room-trapper
 */

/**
 * Creates a new room trapper which will use the given trapped room manager.
 *
 * @class external:haxball-room-trapper.RoomTrapper
 * @classdesc Core class of the package, it creates the trapped room.
 * @function external:haxball-room-trapper.RoomTrapper#constructor
 * @param {external:haxball-room-trapper.TrappedRoomManager} trappedRoomManager
 *  The trapped room manager.
 */

/**
 * Creates a a proxied, or trapped, room object using the given original room
 * and identifier.
 *
 * @function external:haxball-room-trapper.RoomTrapper#createTrappedRoom
 * @param {external:native-api:RoomObject} roomObject Original room object.
 * @param {*} identifier Identifier of this trapped room.
 * @returns {external:haxball-room-trapper.TrappedRoom} The trapped room.
 * @see external:haxball-room-trapper.TrappedRoomManager
 */

/**
 * Implements a proxy that forwards access to room properties to the
 * {@link external:haxball-room-trapper.TrappedRoomManager}.
 *
 * @class external:haxball-room-trapper.TrappedRoom
 * @extends Proxy
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
 * @see https://github.com/morko/haxball-room-trapper/blob/master/src/RoomTrapper.js#L37
 */

/**
 * Plugin specification.
 *
 * Not part of the original `TrappedRoom` instance, added in the context of HHM.
 *
 * @member external:haxball-room-trapper.TrappedRoom.pluginSpec
 * @property {string} name Plugin name.
 * @property {string} [author] Name of the plugin author.
 * @property {string} [version] Plugin version.
 * @property {Array.<string>} [dependencies] `Array` of plugin names that this
 *  plugin depends on.
 * @property {Object.<string, Object.<string, Array.<string>>>} Specifies
 *  execution order for event handlers. It maps event handler names to `Object`s
 *  which contain an array of plugin names `before` or `after` which this
 *  plugin's event handler will be executed.
 * @property {Object.<string, *>} [config] Plugin configuration.
 */

/**
 * Default implementation of a TrappedRoomManager.
 *
 * A TrappedRoomManager manages access to properties of proxied rooms. It acts
 * as a combined proxy for any number of proxied rooms.
 *
 * Properties are divided into two categories by the RoomTrapper:
 *
 * - event handlers (all properties starting with "on"), must be functions
 * - all other properties
 *
 * This default implementation keeps a list of event handlers for each trapped
 * room and forwards any access to other properties straight to the proxied
 * room.
 *
 * Trapped room managers must implement the following methods:
 *
 * - `onEventHandlerGet(room, handler, identifier)`
 * - `onEventHandlerHas(room, handler, identifier)`
 * - `onEventHandlerSet(room, handler, callback, identifier)`
 * - `onEventHandlerUnset(room, handler, identifier)`
 * - `onOwnHandlerDescriptorGet(room, handler, identifier)`
 * - `onExecuteEventHandlers(room, handler, ...args)`
 * - `onPropertyGet(room, property, identifier)`
 * - `onPropertyHas(room, property, identifier)`
 * - `onPropertySet(room, property, value, identifier)`
 * - `onPropertyUnset(room, property, identifier)`
 * - `onOwnPropertyDescriptorGet(room, prop, identifier)`
 * - `onOwnPropertyNamesGet(room, identifier)`
 *
 * @class external:haxball-room-trapper.TrappedRoomManager
 * @see https://github.com/morko/haxball-room-trapper/blob/master/src/TrappedRoomManager.js
 */