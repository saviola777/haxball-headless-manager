/**
 * Commands plugin, which allows convenient processing of commands.
 *
 * To make command processing easier, this plugin automatically parses commands
 * and triggers the corresponding events.
 *
 * To receive events for a specific command, you have to add an event handler
 * for the command itself, e.g. onCommandHelp, which will be triggered every
 * time the help or Help command is used, or the command and number of
 * arguments, e.g. onCommandHelp0, which will only be called when help or Help
 * is used without further arguments.
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
 * The plugin will trigger the event handlers onCommandKick and onCommandKick1
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
 *
 * TODO implement subcommands
 */

const room = HBInit();

room.pluginSpec = {
  name: `saviola/commands`,
  author: `saviola`,
  version: `1.0.0`,
  config: {
    commandPrefix: `!`,
  },
};

/**
 * Triggers command events if a command was found in the incoming message.
 */
room.onPlayerChat = function(player, message) {
  const parsedMessage = room.parseMessage(message);

  let returnValue = true;

  if (parsedMessage.command !== ``) {
    returnValue = room.triggerEvent(`Command${parsedMessage.command}`, player,
        parsedMessage.arguments, parsedMessage.argumentString) !== false;
    returnValue = room.triggerEvent(`Command${parsedMessage.command}`
        + `${parsedMessage.arguments.length}`, player, parsedMessage.arguments,
        parsedMessage.argumentString) !== false && returnValue;
  }

  return returnValue;
};

/**
 * Parse given message into command and arguments using the given command prefix
 * and separator.
 *
 * @returns Object containing the command, and array of arguments, as well as
 *  a string containing all the arguments.
 */
room.parseMessage = function(message, commandPrefix, separator) {
  message = message.trim();

  if (typeof commandPrefix === `undefined`) {
    commandPrefix = room.pluginSpec.config.commandPrefix;
  }

  if (typeof separator === `undefined`) {
    separator = ` `;
  }

  if (!message.startsWith(commandPrefix) || message.length < 2) {
    return {
      command: ``,
      arguments: [],
      argumentString: ``,
    }
  }

  const parts = message.split(separator).map(arg => arg.trim())
    .filter(arg => arg.length > 0);

  const argumentString = parts.length > 1 ? message.split(separator, 2)[1] : ``;

  const command = parts[0][commandPrefix.length].toLocaleUpperCase()
      + (parts[0].length > commandPrefix.length + 1
        ? parts[0].substr(commandPrefix.length + 1) : ``);

  // Remove command from the message parts
  parts.shift();

  return {
    command: command,
    arguments: parts,
    argumentString: argumentString,
  };
};