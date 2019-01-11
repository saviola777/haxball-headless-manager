/**
 * The core plugin that is always added initially and adds general features
 * needed by the system.
 */

const ui = require(`./ui/index`);

module.exports.initializeCorePlugin = (room) => {
  room.pluginSpec = {
    name: `_core`,
    author: `saviola`,
    version: `1.0.0`,
    dependencies: [
      `_core` // Can't be disabled
    ],
  };

  room.properties = { players: new Set() };

  room.extend(`isRoomStarted`, () => {
      return ui.isRoomLinkAvailable();
  });

  room.extend(`pauseGame`, ({ previousFunction: pauseGame }, pause) => {
    pauseGame(pause);
    room.properties.paused = pause;
  });

  room.extend(`isGamePaused`, () => {
    return room.properties.paused === true;
  });

  room.extend(`isGameStarted`, () => {
    return room.getScores() !== null;
  });

  room.extend(`kickPlayer`, ({ previousFunction: kickPlayer}, playerId, reason,
                             ban) => {
    room.properties.players.delete(playerId);

    kickPlayer(playerId, reason, ban);
  });

  room.getPluginManager().getRoomManager()
    // Event state validators
    .setEventStateValidator(`onPlayerJoin`, ({}, player) => {
      return room.properties.players.has(player.id);
    })
    .setEventStateValidator(`onPlayerChat`, ({ metadata }) => {
      return metadata.returnValue !== false;
    })
    .setEventStateValidator(`onGameStart`, () => {
      return room.getScores() !== null;
    })
    .setEventStateValidator(`onGameStop`, () => {
      return room.getScores() === null;
    })
    .setEventStateValidator(`onGamePause`, () => {
      return room.properties.paused === true;
    })
    .setEventStateValidator(`onGameUnpause`, () => {
      return room.properties.paused === false;
    })
    // Pre and post event handler hooks
    .setPreEventHandlerHook(`onGamePause`, () => {
      room.properties.paused = true;
    })
    .setPreEventHandlerHook(`onGameUnpause`, () => {
      room.properties.paused = false;
    })
    .setPreEventHandlerHook(`onPlayerJoin`, ({}, player) => {
      room.properties.players.add(player.id);
    })
    .setPreEventHandlerHook(`onPlayerLeave`, ({}, player) => {
      room.properties.players.delete(player.id);
    });

  return true;
};