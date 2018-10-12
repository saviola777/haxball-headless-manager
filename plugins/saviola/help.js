/**
 * Help plugin, provides basic help support for available commands.
 *
 * Provided helpers:
 *
 * - `registerHelp`: Registers a help text for the given command, the command
 *  can be passed as 'cmd subcmd' or 'cmd_subcmd'. The help text will always
 *  start with 'Usage: !cmd subcmd', after that the given help text will be
 *  inserted.
 *
 *  Example:
 *
 *  room.getPlugin(`saviola/help`).registerHelp(`auth`, ` ROLE PASSWORD.`);
 *
 *  Which will result in the output `Usage: !auth ROLE PASSWORD.` when typing
 *  `!help auth`.
 */
const room = HBInit();

room.pluginSpec = {
  name: `saviola/help`,
  author: `saviola`,
  version: `1.0.0`,
  dependencies: [
    `saviola/commands`
  ],
};

/**
 * General help command, which lists all available commands.
 */
room.onCommand0_help = function() {
  room.sendChat(`List of available commands, type ${getCommandPrefix()}help `
    + `command to get help for a specific command:`);
  room.sendChat(createCommandList().join(`, `));
};

/**
 * Catch-all help function which gets called if no specific help was registered
 * for a given help command.
 */
room.onCommand_help = function(player, arguments) {
  if (arguments.length === 0) return;

  const manager = room.getManager();

  const handlerNames = manager.getHandlerNames()
    .filter(h => h.endsWith(arguments.join(`_`)));

  const pluginNames = getPluginNamesForCommand(arguments);

  if (pluginNames.length === 0) {
    room.sendChat(`No help available for the given topic, is the plugin loaded `
    + `and enabled?`);
    return;
  }

  room.sendChat(`No help available for this command, it is handled by the `
    + `following plugin(s): ${pluginNames.join(`, `)}`);
};

/**
 * Helper function to register a help text for the given command.
 */
room.registerHelp = function(command, helpText) {
  if (command.includes(` `)) {
    command = command.split(` `).join(`_`);
  }

  helpText = `Usage: ${getCommandPrefix()}${command.split(`_`).join(` `)}${helpText}`;

  room[`onCommand_help_${command}`] = () => room.sendChat(helpText);
};

function createCommandList() {
  return [...new Set(room.getManager().getHandlerNames()
    .filter(h => h.startsWith(`onCommand`))
    .map(h => h.split(`_`)[1] || ``)
    .filter(h => h.length > 0))];
}

function getCommandPrefix() {
  return room.getPlugin(`saviola/commands`).getPluginConfig().commandPrefix;
}

function getPluginNamesForCommand(commandParts) {
  const manager = room.getManager();

  const handlerNames = manager.getHandlerNames()
    .filter(h => h.startsWith(`onCommand_`));

  let commandHandlerNames = [];
  for (let i = commandParts.length; i > 0; i--) {
    commandHandlerNames = handlerNames.filter(
        h => h.split(`_`, 2)[1].startsWith(commandParts.slice(0, i).join(`_`)));

    if (commandHandlerNames.length > 0) {
      break;
    }
  }

  return manager.getEnabledPluginIds()
    .filter(id => manager.getPluginById(id).getHandlerNames()
      .filter(h => commandHandlerNames.indexOf(h) !== -1).length > 0)
    .map(id => manager.getPluginName(id));
}
