/**
 * Logging module.
 *
 * Includes and sets up the loglevel logger.
 *
 * To use the logger, simply call HHM.log.{info,warn,error,…}().
 *
 * After the room was started, messages can be logged using
 * `room.log(message, level)`.
 *
 * Levels can be accessed via HHM.log.level.*
 *
 * @module src/log
 * @see https://github.com/pimterry/loglevel
 */

/**
 * Creates a new loglevel logger instance, with a static `HHM` prefix and
 * dynamic level prefix.
 *
 * @TODO make initial log level configurable
 * @TODO document log levels
 *
 * @alias module:src/log.constructor
 * @returns {Object} Logger instance.
 */
function constructor() {
  let log = require(`loglevel`).noConflict();
  let loglevelMessagePrefix = require(`@natlibfi/loglevel-message-prefix`);
  log.setLevel(`info`);

  loglevelMessagePrefix(log, {
    prefixes: [`level`],
    staticPrefixes: [`HHM`],
  });

  $.extend(log, {
    level: {
      TRACE: `trace`,
      DEBUG: `debug`,
      INFO: `info`,
      WARN: `warn`,
      ERROR: `error`,
    }
  });


  log.info(`LogLevel library loaded`);

  return log;
}

module.exports = constructor;