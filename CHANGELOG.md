# Changelog

## Version 1.0.1

- plugins can now be loaded from specific repositories
- plugins can now be added before starting the HHM, they will be loaded before
  the user plugins during HMM start
- some code was moved from hhm/core into the HHM, because it belonged there
- add default repository names
- when adding plugins, the plugin configuration can now be passed along, it
  will override the default plugin config, but will still be overridden by the
  user config
- a backup of the original plugin specification is now created when a plugin is
  loaded, it can be accessed via `plugin._pluginSpecOriginal`
- fix minor bugs and refactoring

## Version 1.0.0

- add support for object handlers
- rework event handler loop
- remove event state validators
- add pre/post-event handler hooks which are executed before and after every
  single event handler
- better event execution metadata
- add support for loading new versions of plugins at runtime
- small API improvements and refactoring

## Version 0.9.3

- rework repository system
- add support for local repositories

## Version 0.9.2

- first release which is deployed on [surge.sh](https://surge.sh)
- adjust config to haxroomie update
- remove baseUrl configuration directive
- add version and logLevel configuration directives
- change github repository handler config `branch` to `version`
- add local repository support
- remove support for CORS proxy
- add `hasRepository` function to PluginLoader
- the inability to load all user-specified plugins no longer leads to an error
  during HHM start
- better error reporting during HHM start
- rename `handlerFunction` parameter to `handler` in preparation of support for
  object handlers


## Version 0.9.1

- add JsDoc documentation to HHM code
- add repository information in README and config
- improve repository handling
- move some Node dependencies to `devDependencies`
- improve event handler execution metadata API
- function reflector now works for `Function` objects and string
  representations of functions
- improve status management of loaded / enabled plugins
- disable caching for AJAX calls
- clean up plugin and plugin manager interfaces
- fix bug in plugin enabling code where recursive enabling would fail
- begin clean up of different event system: HHM, local, global events
- add event which is executed before a plugin is marked as loaded but
  after its `onRoomLink` handler has been executed
- add observer pattern for plugin configuration changes
- HHM start fails now if one of the initial plugins (core, persistence)
  fail to load
- improve pre/post event handler hooks and event state validation system
- fix TrappedRoomManager interface
- fix a problem where calling `isLoaded()` on a plugin in a very early
  state of initialization would cause an error
- add storage support using localForage
- make event API more consistent, just like the native API player
  objects will now be passed to handlers


## Version 0.9.0

- ditch GUI, [haxroomie-web](https://github.com/morko/haxroomie-web) does a
  better job of it
- adjust default configurations to support haxroomie
- remove dryRun, trueHeadless, sendChatMaxLength from config
- start organising documentation (still useless, sorry!)
- revert back to old approach where plugins are only loaded after the room link
  is available. This makes everything easier, so deal with the minimal delay!
- fix problems with injected destructuring parameters
- remove custom event `onLoad`, please use `onRoomLink` for initialization
- when loading plugins by code, a name can now be passed along
- fix problem where plugin names were not picked up from the pluginSpec
- add event system for HHM-related events (plugin loaded/enabled/disabled)
- `_postInit` plugin is now called `_user/postInit`
- add custom event handlers `onEnable` and `onDisable`

## Version 0.8.1

- fix npm dependencies to automatically install from github repositories where
  necessary (thanks [morko](https://github.com/morko))
- `haxroomie-RoomTrapper` is renamed to haxball-room-trapper and we are back to
  using the repository of the original author (thanks
  [morko](https://github.com/morko))
- add config file for testing during development
- the plugin system now loads plugins as soon as possible and does not wait for
  the room link anymore. This means if you expecting the room to be running in
  your `onLoad` handler, this code has to be moved into the `onRoomLink` handler!
- add event system for HHM changes like plugins being added / disabled, which
  can also be used from within plugins

## Version 0.8.0

- add support for event state validators and pre-event handler hooks, which help
  deal with problematic multi-handler situations
- add room.log() function, which automatically adds the plugin name in log
  messages
- extra parameters (event handler execution metadata) are now passed more
  smartly by analysing the expected parameters of an event handler using
  reflection
- add room extension mechanism which allows extending existing room function or
  adding new ones using room.extend()
- plugins have been moved to a [separate repository](https://github.com/saviola777/hhm-plugins)
- refactoring!

## Version 0.7.3

- add support for iterable (e.g. array) or object handlers
- add [CORS Anywhere](https://github.com/Rob--W/cors-anywhere) proxy through
  which all AJAX requests are automatically proxied (thanks
  [morko](https://github.com/morko))
- add `HHM.log.toRoom()`, which allows logging to both the room and the console
- fix problem where plugins where sometimes loaded twice

## Version 0.7.2

- refactor room and plugin manager interfaces to be more intuitive and clear
- add custom event `onLoad` to give plugins a way to execute code once
  all dependencies have been loaded
- add custom `room.sendChat` implementation that automatically cuts long
  messages up to a maximum length defined in `HHM.config.sendChatMaxLength`
- improve cron plugin, see its changelog

## Version 0.7.1

- improve commands plugin (see plugins/saviola/commands.js for changelog)
- fix a problem when trying to load a plugin that was already loaded
- fix problem that allowed plugins to be disabled even if other plugins depended
  on it (#2)
- fix a problem that would not enable a plugin after it was disabled once


## Version 0.7.0

- initial version
- support for loading configuration file from URL or via upload
- support for adding plugins via file, repository name or pasted source code
- support for dependency management and execution order specification
- experimental support for enabling / disabling plugins
