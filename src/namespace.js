/**
 * TODO documentation
 * Populates the HHM namespace
 */

module.exports.populate = () => {
  global.HHM = global.HHM || {};
  global.HHM.version = `0.8.0-git`;
  global.HHM.baseUrl = HHM.baseUrl || `https://haxplugins.tk/`;
  global.HHM.proxyUrl = HHM.proxyUrl || `https://haxplugins.tk/proxy/`;
  global.HHM.defaultConfigUrl = `${HHM.baseUrl}config/default.js`;
  global.HHM.log = require(`./log`)();

  // Stores global deferreds
  global.HHM.deferreds = {};

  // Classes
  global.HHM.classes = {
    EventHandlerExecutionMetadata: require(`./classes/EventHandlerExecutionMetadata`),
    FunctionReflector: require(`./classes/FunctionReflector`),
    PluginLoader: require(`./classes/PluginLoader`),
    PluginManager: require(`./classes/PluginManager`),
    TrappedRoomManager: require(`./classes/TrappedRoomManager`),
  };
};