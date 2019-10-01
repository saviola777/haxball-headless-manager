# <a name="writing"></a> Writing & publishing plugins

To turn a regular headless script into an HHM plugin, nothing has to be changed
unless the script uses custom intervals to execute logic (these can be turned
into room event handlers using the `sav/cron` plugin).

The HHM provides a `HBInit()` function which returns a room instance just as you
would expect, parameters to this function are ignored.

## Plugin specification

The plugin specification is where the real power of the HHM lies: it allows
specifying dependencies, execution orders, default configuration and more. It
is, however, entirely optional. Here's an example:

```javascript
var room = HBInit();

room.pluginSpec = {
  name: `aut/plugin-name`,
  author: `author`,
  version: `1.0.0`,
  config: {
    param1: `value`,
  },
  configDescriptions: {
    param1: `Description`,
  },
  dependencies: [`aut/otherPlugin1`],
  order: {
    'onPlayerChat': {
      'before': [`aut/otherPlugin1`, `aut/otherPlugin2`],
      'after': [`aut/otherPlugin3`],
    }
  },
  incompatible_with: [`aut/otherPlugin4`],
}
```

- `name`:  The name can be anything, `aut/plugin-name` is just a useful
  convention to avoid name clashes.
- `author`: Entirely optional, informational.
- `version`: Entirely optional for the moment, informational. Must
  be a `string`.
- `config`: This should contain the default configuration of your plugin.
  Changes to these values at runtime can and should be handled by the plugin
  or otherwise the behavior should be documented.
  See [event handlers](#event_handlers).
- `configDescriptions`: Descriptions of configuration options, for documentation
  purposes (optional).
- `dependencies`: A list of plugin names that your plugin depends on. Note
  that it is possible to check for the availability of plugins at runtime
  (and even try to load additional plugins), so please do not include optional
  dependencies here.
- `order`: This object allows you to specify the execution order of handlers for
  your plugin in relation to others. Try to add entries only where it is
  really necessary, to avoid situations where no order can be established. See
  the example above for the structure, there is one entry for each handler,
  which can have the properties `before` and `after` holding a list of plugin
  names whose corresponding handler will be executed after (for `before`) or
  before (for `after`) this plugin's. For the example above, it can be read as
  `onPlayerChat of this plugin is to be executed before 'author/otherPlugin1'
  and 'author/otherPlugin2', and after 'author/otherPlugin3'`.
- `incompatible_with`: A list of plugin names that cannot be loaded at the same
    time as this plugin.


## <a name="event_handlers"></a> Event handlers

Event handlers can be defined as usual, using e.g.

```javascript
room.onPlayerChat = (player, message) => { /* … */ }
```

But for convenience it is also possible to use arrays (or objects) of handlers
if you need several handlers for an event in your plugin (execution in order of
definition):

```javascript
room.onPlayerChat = [
    (player, message) => { /* handler #1 */ },
    (player, message) => { /* handler #2 */ },
];

// or as an object, property names can be chosen freely
room.onPlayerChat = {
    handler1: (player, message) => { /* … */ },
    handler2: (player, message) => { /* … */ },
};
```

This also works recursively for nested arrays / objects.

For available event handlers, refer to

- the [native RoomObject documentation]{@link external:native-api.RoomObject},
- the documentation of the plugins you are using (see below for core plugins),
- {@tutorial events} guide
- and the following section, which will introduce HHM-specific event handlers.

## Local events

As described in {@tutorial events}, local events are called
on one plugin only. The following local events are added / changed by the HHM
system compared to the native API.

### Enabling / disabling plugins

When a plugin is loaded, it is initially enabled. To disable a plugin, you can
call

```javascript
// First disable dependent plugins
HHM.manager.getDependentPlugins(pluginId)
    .forEach((id) => HHM.manager.disablePlugin(id));
HHM.manager.disablePlugin(pluginId);
```

A plugin can only be disabled if no other enabled plugins depend on it.

These are the event handlers that are called prior to enabling / disabling a
plugin (without parameters):

- `onEnable`: called before a plugin is enabled (not called on plugin load)
- `onDisable`: called before a plugin is disabled


### Plugin initialization

Since HHM plugins get loaded only after the room link has become available, it
is no longer a problem to run code that is not wrapped inside an event handler
(e.g., when dealing with vanilla headless scripts). However, when you write an
HHM plugin it is still a good idea to put all your code inside event handlers
(and if you declare dependencies on other plugins, these dependencies might not
be available outside your event handlers).

The `onRoomLink(url)` event handler is the entry point of every plugin. It is
called after all dependent plugins have been loaded but before the plugin has
been marked as loaded. No other handler will be called before this by the HHM
system.

### Persistence

To persist data and keep it around after a room is closed and re-opened, the
HHM provides a simple persistence API through the `hhm/persistence` plugin.

To persist data, implement the `onPersist()` event handler, in which you return
the data that should be persisted. This data has to be serializable. This
handler is called regularly (every couple of minutes), so if your `onPersist`
handler performs costly operations it might make sense to cache them. The plugin
specification of your plugin is stored alongside the data returned.

If you cannot afford data loss, you may call

```javascript
room.getPlugin("hhm/persistence").persistPluginData(room);
```

manually, which will then trigger a call to your `onPersist` handler. You can
also call `persistAllPluginData()` – this should not be done unreasonably often,
for obvious reasons.

Before any kind of persistence happens (no matter if for
all or just one plugin), the event `onBeforePersist` is triggered for all
plugins. This is to allow plugins which rely on other plugins for their data
storage and persistence to prepare for data persistence (since the actual
persistence always happens in plugin load order).

When a plugin is loaded, the persistence plugin will call
`onRestore(data, pluginSpec)` if the handler is defined and persisted data
exists. It is called after your `onRoomLink` handler but before the plugin is
marked as loaded, so no other events can come in before this.

### Configuration changes

Managing configuration changes at runtime can be a hassle, so the HHM provides
an API for it.

To change a plugin's configuration, call

```javascript
// Change a param value
plugin.setConfig(paramName, newValue);
// Replace the whole configuration
plugin.setConfig(newConfigObject);
// Only notify the plugin that the config has changed
plugin.setConfig();
```

Whenever possible, you should use the first variation. When `setConfig` is
called, the HHM triggers a call to
`onConfigSet({ paramName, newValue, oldValue })` and
`onConfigSet_paramName({ newValue, oldValue })` (if a parameter name was
specified), or just `onConfigSet({})` if no parameter name was specified.

## Triggering events

To trigger custom or native events you can use the function
{@link HhmRoomObject#triggerEvent}:

```javascript
room.triggerEvent(`onPlayerRole`, playerId, role, added);
```

The first argument is the event handler name, and after that follow the event
arguments.


## Exporting functions

If you want to make functions available to other plugins, this is the preferred
way of doing so:

```javascript
function publicFunction() {
  // […]
}

function otherFunction() {
  let someVariable = publicFunction();
}

room.publicFunction = publicFunction;
```

When using your own functions, avoid using `room.publicFunction()` because it
is slower than directly using `publicFunction()`.

Other plugins can now call your function using

```javascript
room.getPlugin(`you/some-plugin`).publicFunction();
```

To export your function *globally*, i.e. in a way that it can be used like

```javascript
room.publicFunction();
```

… which you really shouldn't. It's a bad idea, because there __will__ be
name clashes if every plugin does this. This mainly makes sense if you want to
extend existing functions, like `sendChat` with custom logic. HHM uses a
decorator pattern for this. Only the last function that was registered will
be executed and it can decide whether to execute the previous function or not.
To extend an existing function or add a new function (this also works for
non-function properties, as long as they do not yet exist) you have to use the
{@link HhmRoomObject#extend} function:

```javascript
function mySendChat({ previousFunction }, message, playerId, { myPlugin_level }) {
  return previousFunction(`[${myPlugin_level}] ${message}`, playerId,
      arguments[arguments.length - 1]);
}

room.onRoomLink = () => {
  room.extend(`sendChat`, mySendChat);
};
```

In this example, we add a parameter to the `sendChat` function which will allow
us to add a dynamic prefix to any message sent by the host.

Let's look at the function signature:

`{ previousFunction }`: the first argument to every function that is passed to
`extend` is an object containing two entries: `previousFunction`, which is the
previous `sendChat` implementation, which could be the native implementation
or a function that was passed to `extend` previously; and `callingPluginName`
which contains the name of the plugin which called the function.

`message` and `playerId` are the native function arguments, which should be
passed to the `previousFunction` if you decide to call it.

`{ myPlugin_level }`: in this example we add an argument to the `sendChat`
implementation. It is an object containing a `myPlugin_level` property which we
extract. Why not simply add a `level` argument instead? This can be problematic
if other plugin authors have the same idea and add a different argument, then
the plugins become incompatible unless they coordinate their implementations,
which is something we would like to avoid.

Instead we introduce a pattern using [object destructuring](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)
which allows adding more arguments easily if all plugin authors follow it:

- the last argument of a custom function which is passed to `extend` must always
  expect an object
- any number of properties can be extracted from this object, for example using
  object destructuring – prefix the properties with your plugin name for
  bonus points
- using default values should best be done in the function signature, it would
  look like this:
  `{ myPlugin_level = 'default' } = {}`.
- this object must be passed to the `previousFunction`, for example using
  `arguments[arguments.length - 1]` (__note__: this is not possible when using
  arrow functions)

If you are not sure whether a `previousFunction` exists, you can check using
`if (typeof previousFunction === 'function')` and call it if it does exist.

## Interacting with the HHM system

Several components for the HHM system are exposed globally:

- `HHM.log`: HHM logger ([loglevel](https://github.com/pimterry/loglevel)),
    which gives you a way to log to the dev console. In most cases, you should
    use {@link HhmRoomObject#log} though, which is a wrapper automatically
    adding the plugin name.
- `HHM.config`: Contains the HHM config as described above.
- `HHM.manager`: Contains the HHM itself, can also be used outside of plugins to
    access the manager, the room etc.
- {@link HHM.deferreds}: Contains global jQuery
  [deferred objects](https://api.jquery.com/category/deferred-object/) which
  allow executing code after e.g. the manager has been loaded or the room link
  is available outside of plugins.

## Publishing

There are several ways to publish your plugin:

- You can create your own GitHub repository with a similar structure as
  [saviola777/hhm-plugins](https://github.com/saviola777/hhm-plugins)
- You can add it to this repository by cloning / forking it, adding your plugin
  under `src/author/pluginName` (and optionally creating a
  [pull request](https://help.github.com/articles/creating-a-pull-request/)).
- You can upload it onto your own server (which can be a proper directory
  structure to load plugins from, or e.g. a PHP script serving the plugins).
- You can just offer the file or code for download and the user can then
  copy & paste the plugin into the
  [web interface](https://github.com/morko/haxroomie-web) or dev console.

The next section will show you how to set up your own repository.

## Creating your own plugin repository

There are currently three ways to deploy your own plugin repository:

- using a webserver to directly serve the plugins
- using a GitHub repository
- using a custom web app to serve the plugins

The first two will be described here, the last one is an advanced variant of the
first.

### Using a webserver

Assuming your domain is `yourdomain.tld` and you put the plugin
`author/plugin-name` so that it can be accessed at the URL
`https://yourdomain.tld/plugins/author/plugin-name.js`, your repository entry
would look like this:

```javascript
HHM.config.repositories = [
    // […]
    {
      type: `plain`,
      url: `https://yourdomain.tld/plugins/`,
      suffix: `.js`, // optional, this is the default value
    }
];
```

Make sure you have your server set up to send
[CORS headers](https://enable-cors.org/) or else your plugins can't be loaded.

### Using a GitHub repository

When it comes to a GitHub repository there are three things you need to know:
the repository name (i.e. user + repository), the path within the repository
where the plugins are stored, and the version of the repository (a branch,
commit, or tag) you want to use.

Assuming your repository is accessible at
`https://github.com/XHerna/fm-publicbot`
and your plugins are stored in the directory `plugins` in the repository, and
you want to use the master branch (i.e., the plugin `fm/team-fill` would
be available at `https://github.com/XHerna/fm-publicbot/blob/master/plugins/fm/team-fill.js`), the entry would look like this:

```javascript
HHM.config.repositories = [
    // […]
    {
      type: `github`,
      repository: `XHerna/fm-publicbot`,
      path: `plugins`, // optional, defaults to `src`
      version: `master`, // optional, this is the default value
      suffix: `.js`, // optional, this is the default value
    }
];
```

### Providing repository information

Repository information are optional metadata describing a repository and its
contents. For URL-based repository types like GitHub repositories, the
repository information are loaded from the file `repository.json` at the root
of the repository:

```json
{
    "name": "Optional name for the repository",
    "description": "Optional description for the repository.",
    "author": "Optional author of the repository.",
    "config": {
        "path": "Optional path to where the plugins are in the repository",
        "otherParam": "Optional other repository configuration parameters"
    },
    "plugins": [
        "bla/bla",
        "bla/daa"
    ]
}
```

For other repository types, refer to the implementation of the [repository type
handler](https://github.com/saviola777/haxball-headless-manager/blob/master/src/repositories.js)
to find out how repository information can be provided. The `local`
repository type, for example, accepts the repository information as part of the
repository configuration.

# Useful plugins

This section will introduce some plugins which provide useful features to other
plugins or to users. If you are going to use any of these plugins, make sure to
include the specific plugin in your dependencies.

## `sav/core`

If you want to include all of these, just depend on the `sav/core` meta plugin.

### <a name="plugin_sav_commands"></a> `sav/commands`: Easier command processing

One of the first things most plugin authors will make use of it player commands,
i.e. the player types something like `!swap` in the room and then the plugin
reacts by executing some code.

Normally, that would work like this:

```javascript
room.onPlayerChat = (player, message) => {
  if (message === `!swap`) {
    // Do something
  }
  else if (message === `!p`) {
    // Do someth8ing
  }
}

```

Now this is quite simple and works well enough, but what if you want to use
parameters? Something like `!kick somePlayer`:

```javascript
room.onPlayerChat = (player, message) => {
  let messageParts = message.split(` `);
  if (messageParts[0] === `!kick`) {
    // Do something with messageParts[1]
  }
}

```

This will fail if a player writes just `!kick`, so you have to add in checks to
see if the correct number of arguments were provided. And you have to do that
for each new command you add, and you all have to do it in one function. Doesn't
look so nice and clean anymore, does it?

The plugin `sav/commands` handles all of this for you. You just tell it which
command you want to react to and how many parameters you expect, and you are
good to go:

```javascript
room.onCommand1_kick = (player, [playerName]) => {
  // Now you can just work with the playerName without having to worry about
  // anything
}
```

Handler names follow the syntax
`onCommand${numArguments}_${command}_${subcommand}`, so this handler will be
called when the command `!kick` is written with exactly one argument.

If the `[playerName]` seems confusing: this is called [destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)
and essentially means _assign the first element of the array to the variable
playerName_.

Here are some examples for handler names:

- `room.onCommand_help`: Called for `!help` but also for `!help topic` but not
  for `!helpme`.
- `room.onCommand0_help`: Only called for exactly `!help` without any arguments.
- `room.onCommand0_help_topic`: Called for `!help topic` only. Note that this
  has higher precedence compared to `room.onCommand1_help` for example. So if
  you have both `room.onCommand1_help` and `room.onCommand0_help_topic`, then
  only the latter is called when someone writes `!help topic`.

If you need more control, here you go:

- every handler gets the following arguments:
  `handler(player, arguments, argumentString, originalMessage)`, `arguments`
  may be an empty array if there were no arguments, `argumentString` is the
  original message minus the command, and `originalMessage` is just what its
  name suggests.
- the plugin exposes its parsing function to the public, so if you need to split
  by something other than a space, for example, you can use it:
  `room.getPlugin("sav/commands").parseMessage(originalMessage, numArgsMax, commandPrefix, separator)`
  which will return an object containing the properties `command`,
  `arguments`, `argumentString`, `separator`, `originalMessage` – if the message
  could not be parsed as a command, the `command` property will be an empty
  `string`.

For more information, check the [source code](https://github.com/saviola777/hhm-plugins/blob/master/src/sav/commands.js).


### <a name="plugin_sav_cron"></a> `sav/cron`: Execute code repeatedly or with delay

"Okay," you will ask me, "why do we need this? `setTimeout()` and `setInterval()`
are easy enough to use!" True, but: one of the ideas of this plugin system is to
be able to disable and enable plugins at runtime. And guess what `setTimeout()`
 and `setInterval()` do not allow? Being disabled (from the outside).

This plugins essentially wraps calls to `setTimeout()` and `setInterval()` in a
way that makes it possible to disable / pause these tasks.

This doesn't mean you can't use `setTimeout()` and `setInterval()` in your scripts
or plugins, but then your plugin can't be disabled properly and might break when
the system tries to disable it.

But no worries, here's how you can re-write your code to use the `sav/cron`
plugin:

```javascript
setTimeout(() => room.sendChat("Some message"), 3000);
```

would turn into

```javascript
room.onCron3Seconds = () => room.sendChat("Some message");
```

Here's the syntax:

`room.onCron${number}[Game]${unit}[Once]`

- `number` is any integer
- the optional `Game` modifier tells the plugin to use game ticks to execute
  instead of an interval, i.e. it will only execute when a game is running.
- possible `unit`s are `Seconds`, `Minutes`, and `Hours` (no singular version,
  and always starting with a capital letter)

Here's some handler name examples:

```javascript
room.onCron5Seconds = () => { /* executed every 5 seconds */ };
room.onCron5GameSeconds = () => { /* executed every 5 ingame seconds */ };
room.onCron7GameMinutesOnce = () => { /* executed once after 7 ingame minutes */ };
```

For more information, check the [plugin source](https://github.com/saviola777/hhm-plugins/blob/master/src/sav/cron.js).

### <a name="plugin_sav_roles"></a> `sav/roles`: Role and group management

This is a utility plugin offering role management via authentication and
explicit assignment.

"What and why?" you ask: at some point you will want to assign certain roles
or groups to players, for example to handle things like auto-admin. That's what
this plugin helps you with.

Let's look at the auto-admin case, which is already built into the plugin. In
your config you will find something like

```javascript
HHM.config.plugins = {
  'sav/roles': {
    roles: {
      'host': ``,
      'admin': haxroomie.adminPassword || 'haxroomie'
    },
  },
  // […]
};
```

This tells the plugin: _there are two roles: `host`, which can only be explicitly
assigned, and `admin` which can be gained using the password `haxroomie`_ (let's
ignore the `haxroomie.adminPassword` for now). You can add more roles here if
you like, but you can also add them programmatically later. It's probably a good
idea to change the default password!

There are two types of roles:

- Player roles are temporary roles assigned to a player which are lost when the
  user refreshes his browser and re-joins the room.
- User roles are persistent roles which are assigned to every player with the
  same auth as the player it was initially assigned to

Let's look at authentication, how do people actually authenticate for their role?
In this example, a player would need to write

`!auth admin haxroomie`

to authenticate for the `admin` role (which would give them admin immediately,
and automatically from now on each time they join – it's a user role).

But how do you use all of this in your plugin? Let's look at an example where we
simply add a custom role `cheerleader` which allows execution of the command
`!cheer`:

```javascript
let roles;
room.onRoomLink = () => {
  // First get the roles plugin, this is just a shortcut so you don't have to
  // write this every time
  roles = room.getPlugin(`sav/roles`);
  // Add our custom role with a password
  roles.addOrUpdateRole(`cheerleader`, `ch33r`);
};

room.onPlayerRoleAdded_cheerleader = (player) => {
  room.sendChat(`We have a new cheerleader: ${player.name}!`);
};

room.onCommand_cheer = (player) => {
  if (roles.ensurePlayerRoles(player.id, `cheerleader`, room, { feature: `!cheer` })) {
    room.sendChat(`${player.name} is cheering!`);
  }
};
```

Now if a player wrote `!auth cheerleader ch33r`, they would be allowed to execute
the `!cheer` command. Other players executing the command would get the message:

```
Access denied for !cheer of plugin abc/cheer. It requires one of the following
player roles: cheerleader.
```

The most important functions of this plugin include:

- `addPlayerRole(playerId, role, userRole = false)`: give role to player,
  user roles are kept after the player leaves and re-joins the room.
- `hasPlayerRole(playerId, role, userRole = false)`: returns whether the player
  has the given player/user role.
- `ensurePlayerRoles(playerId, roles, plugin, { feature, message = "Access denied", userRole = false })`:
  convenience function to ensure the player has at least one of the given player
  / user roles and print
  an error message if not. `roles` can be a single role or an array of roles.
- `removePlayerRole(playerId, role)`: removes the role from the player and user.

To keep track of role changes, the plugin offers the following event handlers:

- `onPlayerRole(player, role, added, userRole)`: called whenever a role is added
  or removed.
- `onPlayerRole_roleName(player, added, userRole)`: called whenever the specific
  role is added or removed.
- `onPlayerRoleAdded(player, role, userRole)` and
  `onPlayerRoleRemoved(player, role, userRole)`:
  called whenever a role is added or removed.
- `onPlayerRoleAdded_roleName(player, userRole)` and
  `onPlayerRoleRemoved_roleName(player, userRole)`:
  called whenever the specific role is added or removed.


For more information, see the [plugin source](https://github.com/saviola777/hhm-plugins/blob/master/src/sav/roles.js).

### <a name="plugin_sav_help"></a> `sav/help`: Display help and usage information

Players joining your room for the first time will have no idea about all the
commands your plugins provide, so it is important to provide help texts and
usage information.

And since this sounds like a pretty repetitive process, the plugin `sav/help`
provides a simple way to register and display help texts.

Here's an example for the `!auth` command:

```javascript
room.getPlugin(`sav/help`).registerHelp(`auth`, ` ROLE PASSWORD`);
```

Now, when a user types `!help auth` they (and only they, nobody else in the
room) will see the message

```
Usage: !auth ROLE PASSWORD
```

So basically, the text you provided will be appended to the command. Nothing too
fancy, but it's a more convenient way of writing

```javascript
room.onCommand_help_auth = (player) => room.sendChat(`Usage: !auth ROLE PASSWORD`, player.id);
```

Plus the correct command prefix will automatically be displayed. If you want to
display the help text to the user (for example because they used the command
wrongly), you can write

```javascript
room.getPlugin(`sav/help`).displayHelp(playerId, `auth`);
```

And that's it (for now). The help plugin is still work in progress, future
plans include:

- displaying the help text when calling a command without parameters
- display sub-command when calling parent command (that is not bound)
- better auto `!help`

For more information see the [plugin source](https://github.com/saviola777/hhm-plugins/blob/master/src/sav/help.js).

### <a name="plugin_sav_players"></a> `sav/chat`: Enhanced chat

The chat plugin was meant to completely re-implement the haxball chat, adding
timestamps, channels, a PM system between players, and more. To do this, all
messages have to be routed through the host user.

Due to negative feedback all of this is disabled by default, and the chat plugin
just offers these features out of the box:

- flood protection for host messages
- message prefixes in `sendChat`

A ton of configuration options allow fine-grained control over the features
of this plugin. Here's an example of how to use the message prefixes in your plugin:

```javascript
room.sendAnnouncement(`Global message`, undefined, { prefix: `REFEREE` });
```

For more information see the [plugin source](https://github.com/saviola777/hhm-plugins/blob/master/src/sav/chat.js).

### <a name="plugin_sav_players"></a> `sav/players`: Store player-specific information

If you want to store player-specific data in your plugin, you can of course do
so simply using an object with the player IDs as keys. But then you'd have to
deal with persistence yourself!

Anyways, the `sav/players` plugin provides a centralized way of storing
player-specific information, with some convenience functions.

Let's get started with an example:

```javascript
let getPlayerData;

room.onRoomLink = () => {
  getPlayerData = room.getPlugin(`sav/players`).buildPlayerPluginDataGetter(`my-plugin-name`);
}
```

Wait, don't stop reading just yet! It looks confusing, but it's quite simple:
here you build a function which will return player-specific data for your plugin.
So later you can call

```javascript
room.onSomeEvent = (player) => {
  let playerData = getPlayerData(player.id);
}
```

to retrieve the player data. Each data record is automatically initialized as an
empty object, so any changes to it will be mirrored in the stored data.
Persistence is automatically handled. Of course, your plugin can have more than
one getter function, but make sure to avoid name clashes by always using your
plugin name as a prefix:

```javascript
let getPlayerGoalInfo;
let getPlayerAssistInfo;

room.onRoomLink = () => {
  getPlayerGoalInfo = room.getPlugin(`sav/players`)
      .buildPlayerPluginDataGetter(`my-plugin-name/goal-info`);
  getPlayerAssistInfo = room.getPlugin(`sav/players`)
        .buildPlayerPluginDataGetter(`my-plugin-name/assist-info`);
}
```

The same can be done for _users_ instead of players as well. A player is
identified by a unique ID that never changes, and if a player leaves the room
and rejoins, the game will treat him like a different player, because he gets a
new ID.

A user, on the other hand, is identified by a unique authentication string, which
is the public part of a key pair used in asymmetric cryptography. Unlike the ID
this `auth` string does not change when the user re-joins the room. Since it is
generated and stored in the browser, changing the browser (or creating a new
browser profile) will change the `auth` string.

So in most cases you will want to store user information instead of player
information, but make sure to always consider that there could be several
_players_ belonging to the same _user_ in the room (e.g. you testing
your plugin and joining the room in several browser tabs).

For more information… [you know the drill](https://github.com/saviola777/hhm-plugins/blob/master/src/sav/players.js).

## `sav/*`

Other plugins provided by [saviola777](https://github.com/saviola777/).

### `sav/plugin-control`: Plugin management from within the room

This plugin is still work in progress and aims to provide hosts and admins the
option of managing plugins from within the room.

Current features:

- Enable and disable plugins using `!plugin enable pluginName` and
  `!plugin disable pluginName`
  This does not support recursive operation, any plugin you want to disable must
  not be depended on by other enabled plugins.
- Load plugins by name or URL using `!plugin load nameOrUrl`, supports raw JS
  and pastebin links


# HHM development and local deployment with haxroomie

While HHM can be run directly using the provided configuration files, it still
requires some copy&paste or upload of files, so the recommended workflow is to
use haxroomie now.

First download and build haxroomie:

```bash
git clone https://github.com/morko/haxroomie.git
# switch to development branch (optional)
git checkout develop
npm install
```

Now you can setup an alias for haxroomie

```bash
alias haxroomie="~/git/haxroomie/src/cli/index.js -d ~/git/haxroomie/data -c ~/git/haxball-headless-manager/local/haxroomie/config-testing.js -w"
```

Adjust the paths for the haxroomie, user data and config directory as needed.

In your haxroomie config, you can specify local repositories as well as the
local HHM file:

```javascript
let config = {
  // ID for the room (has to be unique):
  'room1': {

    // Options for room1:
    autoStart: true,
    roomName: 'haxroomie',
    playerName: 'host',
    maxPlayers: 12,
    public: false,
    token: process.env.HAXBALL_TOKEN,
    repositories: [
      {
        type: `github`,
        repository: `morko/hhm-sala-plugins`,
      },
      {
        type: `local`,
        path: `/home/USER/git/hhm-plugins`
      },
    ],
    pluginConfig: {
      'sav/roles': {
        roles: {
          admin: 'adminpass',
          host: 'hostpass',
        },
      },
      'sav/core': {},
      'sav/plugin-control': {},
      'hr/spam': {},
      'local/test': {}
    },
    hhm: '/home/USER/git/haxball-headless-manager/dist/.local/hhm-testing.js',
  },
};
module.exports = config;
```

To build HHM, run `make` in the repository directory after installing its
dependencies using `npm install`.


# Further reading

Now that you have a general overview, you should be able to get started on your
plugins!

If you have…

- questions or feedback,
- found mistakes or bugs,
- any nice plugins or configurations

… then please let me know in an issue or via the haxball IRC.

I plan on including showcases for nice and useful room scripts in the future.
