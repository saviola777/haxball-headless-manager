/**
 * Helper script for player information and management.
 */
const room = HBInit();

room.pluginSpec = {
  name: `saviola/players-helper`,
  author: `saviola`,
  version: `1.0.0`,
};

/**
 * Returns the player object for the given player ID.
 */
room.getPlayerById = (playerId) => {
  return room.getPlayerList().filter(p => p.id === playerId)[0];
};