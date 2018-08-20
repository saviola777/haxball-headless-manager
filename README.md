# Haxball Headless Manager

Suite of management scripts for headless haxball hosts, including plugins with
dependency management. [Changelog](./CHANGELOG.md). [License](./LICENSE).

# Usage

This first part is for users, it shows how to set up and configure the HMM,
while the later part, [writing & publishing plugins](#writing), is meant for
developers wanting to write plugins for the HHM.

## Preparing your configuration

To get started using the HHM, you first need to prepare your config (unless you want
to use the manual configuration and load your plugins later, then you can skip
to [Loading the HHM](#loading)).


The following configuration directives are available currently:

* `HHM.config.room`: this is the object as you would pass it to HBInit, see the
    [RoomConfigObject documentation](https://github.com/haxball/haxball-issues/wiki/Headless-Host#roomconfigobject)
* `HHM.config.postInit`: this is a function (or source code as `String`) that is
    executed after the room is started, it is just another plugin, so make sure
    to retrieve your room instance using `HBInit()`.
* `HHM.config.plugins`: An object that maps plugin names (properties) to plugin
    configurations (which are again objects), see the example file linked below
* `HHM.config.repositories`: A list of strings (URLs) or objects containing a
    `url` and (optionally) a `prefix`, see the example file linked below
* `HHM.config.dryRun`: If set to true, HHM will just load the plugins and skip
    creating a room. Useful for debugging.
* `HHM.config.trueHeadless`: If set to true, no HHM UI is going to be created

Always start your configuration file with `HHM.config = HHM.config || {};`, see
[config/default.js](./config/default.js) for an example and a template to get
started. If you have uploaded your config somewhere and want to skip the HHM
configuration form, simply paste the following line in the dev console before
loading HHM (insert the link to your config):

```javascript
let s = document.createElement("script");s.src="https://yourdomain.tld/config.js";document.head.appendChild(s);
```

## <a name="loading"></a> Loading the HHM

To load the HHM, paste the following into the dev console of your browser (F12
in Chrome and Firefox):

```javascript
let s = document.createElement("script");s.src="https://haxplugins.tk/hhm.js";document.head.appendChild(s);
```

Then you will be prompted to upload / link your configuration file or create the
room using a manual configuration form. After solving the captcha, you will be
able to load additional plugins you didn't specify in your configuration, as
well as enable and disable plugins.


# <a name="writing"></a> Writing & publishing plugins

To turn a regular headless script into an HHM plugin, nothing has to be changed
unless

* the script requires the room to be up and running at load time; it is best to
    not run any code at load time that is not wrapped in an event handler
* the script uses custom intervals to execute logic (these can be turned into
    room event handlers using the `saviola/cron` plugin)
    
The HHM provides a `HBInit()` function which returns a room instance just as you
would expect, parameters to this function are ignored.


## HHM room functions

In addition to the native room API, the HHM provides the following functions:

* `addRepository(url, prefix)`: Adds a new plugin repository. Useful if you want
    to make sure your plugin dependencies can be loaded
* `getPlugin(pluginName, create)`: Can be used to access the room objects of
    other plugins, making it possible to use their features
* `getPluginConfig()`: Returns the configuration object of this plugin (i.e.
    `room.pluginSpec.config`)
* `getPluginSpec()`: Returns the plugin specification of this plugin (i.e.
    `room.pluginSpec`)
* `hasPlugin(pluginName)`: Returns whether a plugin with the given name is
    loaded and enabled
* `isEnabled()`: Returns whether this plugin is enabled
* `getHandlerNames()`: Returns a list of all known handler names (of enabled
    plugins)
* `isStarted()`: Returns whether the room is up and running
* `triggerEvent(event, ...args)`: Allows triggering events globally, use the
    handler name without the `on`. Calling event handlers on the room instance
    instead will only trigger the event handlers of your plugin

## The plugin specification

The plugin specification is where the real power of the HHM lies: it allows
specifying dependencies, execution orders, default configuration and more. It
is, however, entirely optional. Here's an example:

```javascript
let room = HBInit();

room.pluginSpec = {
  name: `author/pluginName`,
  author: `author`,
  version: `1.0.0`,
  config: {
    param1: `value`,
  },
  dependencies: [],
  order: {
    'onPlayerChat': {
      'before': [`author/otherPlugin1`, `author/otherPlugin2`],
      'after': [`author/otherPlugin3`],
    }
  },
  incompatible_with: [],
}
```

* `name`:  The name can be anything, author/pluginName is just a useful convention
    to avoid name clashes.
* `author`: Entirely optional, will be displayed in the UI.
* `version`: Entirely optional for the moment, will be displayed in the UI. Must
    be a `String`.
* `config`: This should contain the default configuration of your plugin. These
    values may be changed at runtime, so make sure to either always take the
    current value or take a copy of the configuration at a certain point (and
    clearly document the behavior either way).
* `dependencies`: A list of plugin names that your plugin needs to work. Note
    that it is possible to check for the availability of plugins at runtime
    (and even try to load additional plugins), so please do not include optional
    dependencies here.
* `order`: This object allows you to specify the execution order of handlers for
    your plugin in relation to others. Try to add entries only where it is
    really necessary, to avoid situations where no order can be established. See
    the example above for the structure, there is one entry for each handler,
    which can have the properties `before` and `after` holding a list of plugin
    names whose corresponding handler will be executed after (for `before`) or
    before (for `after`) this plugin's. For the example above, it can be read as
    `onPlayerChat of this plugin is to be executed before 'author/otherPlugin1'
    and 'author/otherPlugin2', and after 'author/otherPlugin3'`.
* `incompatible_with`: A list of plugin names that cannot be loaded at the same
    time as this plugin.
 

## Interacting with other plugins

There are two major ways of interacting with other plugins:

* Accessing their room instance using `room.getPlugin('author/otherplugin')`,
    which allows triggering that plugin's event handlers, accessing functions
    provided by that plugin and even modifying or extending that plugin (you
    should probably not do that)
* Triggering events globally using `room.triggerEvent('PlayerChat', player, message)`

## Publishing your plugins

There are several ways to publish your plugin:

* You can add it to this repository by cloning it, adding your plugin under
    `plugins/author/pluginName` and creating a
    [pull request](https://help.github.com/articles/creating-a-pull-request/)
* You can upload it into your own repository (which can be a proper directory
    structure to load plugins from, or e.g. a PHP script serving the plugins);
    take note that such a repository has to accessible through SSL and has to
    have proper CORS headers ([PHP](https://enable-cors.org/server_php.html),
    [Nginx](https://enable-cors.org/server_nginx.html)) set
* You can just offer the file or code for download and the user can then
    copy & paste the plugin into the web interface

Let me know if you need help setting up your own repository.

# Building the HHM

Two of the NPM dependencies are currently not available directly via NPM, you
will have to clone them and then call `npm install /path/to/dependency` inside
the HHM folder (note that NPM will automatically change the package.json):

* [@natlibfi/loglevel-message-prefix](https://github.com/NatLibFi/loglevel-message-prefix)
* [@haxroomie/RoomTrapper](https://github.com/saviola777/haxroomie-RoomTrapper)

After that you can build it using `browserify`, see the [makefile](./makefile).

# Feedback

Feel free to create pull requests for plugins or other changes, or create issues
for bugs, questions or anything you want to discuss. You can find me in the
official Haxball IRC channel #haxball at freenode.