/**
 * Basic role plugin.
 *
 * Provides four types of events to handle added / removed roles for players:
 *
 * - onPlayerRole(player, role, added)
 * - onPlayerRole_role(player, added)
 * - onPlayerRoleAdded/onPlayerRoleRemoved(player, role)
 * - onPlayerRoleAdded/onPlayerRoleRemoved_role(player)
 *
 * Players leaving does not trigger any authentication events.
 *
 * Use the config to add roles and passwords, e.g.
 *
 * HHM.config.plugins = {
*    'saviola/roles': {
 *      roles: {
 *        user: ``,
 *        admin: `somepw`,
 *      },
 *      defaultRole: `user`,
 * },
 *
 * Roles with empty passwords cannot be acquired using !auth.
 */

const room = HBInit();

room.pluginSpec = {
  name: `saviola/roles`,
  author: `saviola`,
  version: `1.0.0`,
  dependencies: [
    `saviola/core`,
  ],
  config: {
    roles: {},
    defaultRole: undefined,
  },
};

const authenticationInfo = new Map();

let playersHelper;

room.onLoad = () => {
  playersHelper = room.getPlugin(`saviola/players-helper`);

  room.getPlugin(`saviola/help`).registerHelp(`auth`, ` ROLE PASSWORD`);
};

room.onPlayerRole_admin = (player, added) => {
  room.setPlayerAdmin(player.id, added);
};

room.onPlayerAdminChange = (player) => {
  room.setPlayerRole(player, `admin`, player.admin);
};

room.onCommand_auth = (player, arguments, argumentString, message) => {
  const roles = room.getPluginConfig().roles;

  if (arguments.length < 2) {
    return false;
  }

  const role = arguments[0];
  const password =
      room.getPlugin(`saviola/commands`).parseMessage(message, 2).arguments[1];

  if (roles.hasOwnProperty(role) && roles[role] === password
      && roles[role] !== ``) {
    room.addPlayerRole(player, role);
    room.sendChat(`${player.name} authenticated for role ${role}`);
  }

  return false;
};

room.onPlayerJoin = (player) => {
  if (typeof room.getPluginConfig().defaultRole !== `undefined`) {
    room.addPlayerRole(player, room.getPluginConfig().defaultRole);
  }
};

/**
 * Remove authentication info for players leaving.
 *
 * TODO support rejoin
 */
room.onPlayerLeave = (player) => {
  return authenticationInfo.delete(player.id);
};

/**
 * Add the given role to the given player.
 */
room.addPlayerRole = (player, role) => {
  provideAuthenticationInfo(player.id);

  const returnValue = !authenticationInfo.get(player.id).has(role);

  if (returnValue) {
    authenticationInfo.get(player.id).add(role);
    triggerAuthenticationEvents(player, role);
  }

  return returnValue;
};

/**
 * Adds the given role with the given password, or updates the password for the
 * given role if it aleady existed.
 */
room.addOrUpdateRole = (role, password) => {
  if (typeof password === `undefined`) {
    password = ``;
  }

  room.getPluginConfig().roles[role] = password;
};

/**
 * Returns an array of roles for the given player.
 */
room.getRoles = (player) => {
  provideAuthenticationInfo(player.id);

  return [...authenticationInfo.get(player.id)];
};

/**
 * Returns whether the given player has the given role.
 */
room.hasPlayerRole = (player, role) => {
  provideAuthenticationInfo(player.id);

  return authenticationInfo.get(player.id).has(role);
};

room.ensurePlayerRole = (player, role, plugin, feature, message) => {
  if (room.hasPlayerRole(player, role)) {
    return true;
  }

  if (typeof message === `undefined`) {
    message = `Access denied`;
  }

  const pluginFeature = typeof feature === `undefined` ? plugin._name
      : `${feature} of plugin ${plugin.name}`;

  HHM.log.toRoom(`${message} for ${pluginFeature}. `
    + `Player ${player.name} does not have role ${role}`, `error`);

  return false;
};

/**
 * Returns whether the given role is among the known roles.
 */
room.hasRole = (role) => {
  return room.getPluginConfig().roles.hasOwnProperty(role);
};

/**
 * Removes the given role from the given player and returns whether the player
 * actually had the given role beforehand.
 */
room.removePlayerRole = (player, role) => {
  provideAuthenticationInfo(player.id);

  const returnValue = authenticationInfo.get(player.id).delete(role);

  if (returnValue) {
    triggerAuthenticationEvents(player, role, false);
  }

  return returnValue;
};

/**
 * Removes the given role.
 *
 * This will trigger authentication events for every player that had the given
 * role.
 *
 * TODO add option to disable triggering events?
 */
room.removeRole = (role) => {
  const returnValue = delete room.getPluginConfig().roles[role];

  authenticationInfo.forEach((playerId, roles) => {
    if (roles.delete(role)) {
      triggerAuthenticationEvents(playersHelper.getPlayerById(playerId),
          role, false);
    }
  });

  return returnValue;
};

/**
 * Convenience function for adding / removing a role based on a boolean state.
 */
room.setPlayerRole = (player, role, state) => {
  state ? room.addPlayerRole(player, role) : room.removePlayerRole(player, role);
};

function provideAuthenticationInfo(playerId) {
  if (!authenticationInfo.has(playerId)) {
    authenticationInfo.set(playerId, new Set());
  }
}

function triggerAuthenticationEvents(player, role, added) {
  if (typeof added === `undefined`) {
    added = true;
  }

  const addedString = added ? `Added` : `Removed`;

  room.triggerEvent(`PlayerRole`, player, role, added);
  room.triggerEvent(`PlayerRole_${role}`, player, added);
  room.triggerEvent(`PlayerRole${addedString}`, player, role);
  room.triggerEvent(`PlayerRole${addedString}_${role}`, player);
}