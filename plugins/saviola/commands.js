/**
 * Commands plugin, which allows convenient processing of commands.
 *
 * To make command processing easier, this plugin automatically parses commands
 * and triggers the corresponding events.
 *
 * To receive events for a specific command, you have to add an event handler
 * for the command itself, e.g. onCommand_help, which will be triggered every
 * time the help command is used, or the command and number of arguments, e.g.
 * onCommand0_help, which will only be called when help is used without further
 * arguments. Sub-commands are available by chaining further words divided by
 * underscored, i.e. onCommand_help_command will trigger on '!help command'.
 *
 * It also provides a parseMessage function, which can be called using
 *
 * room.getPlugin(`saviola/commands`).parseMessage(message, `!`, ` `), and returns
 * an object like this:
 *
 * {
 *  command: command string without the command prefix, or an empty string if
 *    the message could not be parsed as a command,
 *  arguments: Array of arguments, extracted by splitting the original message
 *    by e.g. spaces, removing any empty parts as well as the command itself,
 *  argumentString: The original message minus the command itself
 * }
 *
 * Example:
 *
 * Someone writes: !kick foo
 *
 * The plugin will trigger the event handlers onCommand_kick and onCommand1_kick
 * (the number indicates the number of arguments after the command), with the
 * following parameters:
 *
 * - player: player object as per the headless API
 * - arguments: Array of space-separated arguments in the command, in this case
 *    ["foo"]
 * - argumentString: String containing all arguments, in this case "foo"
 *
 * Configuration:
 *
 * - commandPrefix: Any line that starts with this is interpreted as a command.
 *    Defaults to `!`. Lines that only contain this command prefix are ignored.
 * - multiCommandPrefixHidesMessage: If set to true, and lines that start with
 *   two or more command prefixes (i.e. `!!`) are never displayed to the room,
 *   but are otherwise treated like normal commands
 *
 * TODO add onCommand catch-all support
 *
 * Changelog:
 *
 * 1.2.0:
 *  - add support for messages starting with multiple command prefixes to be
 *    hidden always
 *  - improve custom message parsing by providing an numArgsMax parameter
 *
 * 1.1.0:
 *  - add sub-command support
 *  - change syntax from onCommandFoo# to onCommand#_foo
 */

const room = HBInit();

room.pluginSpec = {
  name: `saviola/commands`,
  author: `saviola`,
  version: `1.2.0`,
  config: {
    commandPrefix: `!`,
    multiCommandPrefixHidesMessage: true,
  },
};

/**
 * Triggers command events if a command was found in the incoming message.
 */
room.onPlayerChat = function(player, message) {
  message = room.getPluginConfig().commandPrefix !== ` `
      ? message.trimStart() : message;

  const parsedMessage = room.parseMessage(message);
  let returnValue = !room.getPluginConfig().multiCommandPrefixHidesMessage
      || (message.length === removeMultiCommandPrefix(message,
          room.getPluginConfig().commandPrefix).length);

  if (parsedMessage.command !== ``) {
    return triggerEvents(player, parsedMessage) && returnValue;
  }

  return true;
};

/**
 * Parse given message into command and arguments using the given command prefix
 * and separator.
 *
 * @returns Object containing the command, and array of arguments, as well as
 *  a string containing all the arguments and the separator that was used.
 */
room.parseMessage = function(message, numArgsMax, commandPrefix, separator) {
  if (typeof numArgsMax === `undefined`) {
    numArgsMax = -2;
  }

  numArgsMax++;

  if (typeof commandPrefix === `undefined`) {
    commandPrefix = room.getPluginConfig().commandPrefix;
  }

  if (typeof separator === `undefined`) {
    separator = ` `;
  }

  if (!message.startsWith(commandPrefix) || message.length < 2) {
    return {
      command: ``,
      arguments: [],
      argumentString: ``,
      separator: separator,
    }
  }

  message = removeMultiCommandPrefix(message, commandPrefix);

  const parts = message.split(separator, numArgsMax).map(arg => arg.trim())
    .filter(arg => arg.length > 0);

  const argumentString = parts.length > 1 ? message.split(separator, 2)[1] : ``;

  const command = parts[0][commandPrefix.length]
      + (parts[0].length > commandPrefix.length + 1
        ? parts[0].substr(commandPrefix.length + 1) : ``);

  // Remove command from the message parts
  parts.shift();

  return {
    command: command,
    arguments: parts,
    argumentString: argumentString,
    separator: separator,
    originalMessage: message,
  };
};

/**
 * Triggers the appropriate events for the given parsed message.
 *
 * The most specific sub-command will be triggered if several candidates are
 * found.
 */
function triggerEvents(player, parsedMessage) {
  const eventHandlers = room.getManager().getHandlerNames()
    .filter(handler => handler.startsWith(`onCommand`));

  let subcommand = parsedMessage.command;
  const potentialSubcommands = [subcommand];

  // Find potential subcommands
  // e.g. for !help plugin xyz the potential subcommands would be
  // 'help plugin xyz', 'help plugin', and 'help'
  for (let i = 0; i < parsedMessage.arguments.length; i++) {
    subcommand = subcommand + `_${parsedMessage.arguments[i]}`;
    potentialSubcommands.push(subcommand);
  }

  // Find the handler for the most specific subcommand
  for (let i = potentialSubcommands.length - 1; i >= 0; i--) {
    let subcommandEventHandlers = eventHandlers
      .filter(handler => handler.endsWith(potentialSubcommands[i]));

    // As soon as we have a match, trigger events and return
    if (subcommandEventHandlers.length > 0) {
      const j = parsedMessage.arguments.length - i;
      const arguments = parsedMessage.arguments.slice(i);
      const argumentString = arguments.join(parsedMessage.separator);
      let returnValue = true;

      returnValue = room.triggerEvent(
          `Command${j}_${potentialSubcommands[i]}`, player, arguments,
          argumentString, parsedMessage.originalMessage) !== false;
      returnValue = room.triggerEvent(`Command_${potentialSubcommands[i]}`,
          player, arguments, argumentString, parsedMessage.originalMessage)
          !== false && returnValue;

      return returnValue;
    }
  }
}

function removeMultiCommandPrefix(message, commandPrefix) {
  while (message.startsWith(commandPrefix + commandPrefix)) {
    message = message.substr(commandPrefix.length);
  }

  return message;
}