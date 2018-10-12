/**
 * Plugin to manage plugins: loading, enabling/disabling, configuration.
 *
 * Access to the functionality provided by this plugin requires the `host` role.
 * If no such role is defined in the configuration, anyone getting admin by the
 * host or the room script will have access.
 */

const room = HBInit();

room.pluginSpec = {
  name: `saviola/plugin-control`,
  author: `saviola`,
  version: `1.0.0`,
  dependencies: [
    `saviola/core`,
  ],
};

let roles;

room.onCommand_plugin_load = async (player, arguments) => {
  if (!roles.ensurePlayerRole(player, `host`, room, `plugin load`)) {
    return;
  }

  if (arguments.length === 0) {
    return room.sendChat(`Usage: !plugin load NAME URL, at least one of NAME `
      + `or URL must be specified.`);
  }

  let pluginName, pluginUrl;

  if (arguments.length > 1) {
    pluginName = arguments[0];
    pluginUrl = makeRawUrl(arguments[1]);
  } else if (arguments[0].startsWith(`http`)) {
    pluginUrl = makeRawUrl(arguments[0]);
  } else {
    pluginName = arguments[0];
  }

  const pluginLoader = room.getManager().getPluginLoader();
  let pluginId = -1;

  if (typeof pluginUrl !== `undefined`) {
    pluginId = await pluginLoader.tryToLoadPluginByUrl(pluginUrl, pluginName);
  } else if (typeof pluginName !== `undefined`) {
    pluginId = await pluginLoader.tryToLoadPluginByName(pluginName)
  }

  if (pluginId === -1) {
    room.sendChat(`Unable to load plugin ${pluginName} from URL ${pluginUrl}.`);
  } else {

  }
};

room.onLoad = () => {
  roles = room.getPlugin(`saviola/roles`);

  if (!roles.hasRole(`host`)) {
    roles.addOrUpdateRole(`host`);
    room.onPlayerAdminChange = (player, byPlayer) => {
      if (typeof byPlayer !== `undefined` && byPlayer.id !== 0) return;

      roles.setPlayerRole(player, `host`, player.admin);
    }
  }
};

function makeRawUrl(url) {
  if (url.includes(`pastebin`) && !url.contains(`raw`)) {
    return `https://pastebin.com/raw/${url.substr(url.lastIndexOf(`/`) + 1)}`;
  }

  return url;
}