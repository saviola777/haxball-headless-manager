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
 * @see https://github.com/pimterry/loglevel
 */
module.exports = function Constructor() {
  let log = require(`loglevel`);
  let loglevelMessagePrefix = require(`@natlibfi/loglevel-message-prefix`);
  log.setLevel(2);

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
      ERROR: `error`
    }
  });


  log.info(`LogLevel library loaded`);

  return log;
};