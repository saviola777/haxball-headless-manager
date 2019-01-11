# Version 0.8.0

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

# Version 0.7.3

- add support for iterable (e.g. array) or object handlers
- add [CORS Anywhere](https://github.com/Rob--W/cors-anywhere) proxy through
    which all AJAX requests are automatically proxied (thanks
    [morko](https://github.com/morko))
- add `HHM.log.toRoom()`, which allows logging to both the room and the console
- fix problem where plugins where sometimes loaded twice

# Version 0.7.2

- refactor room and plugin manager interfaces to be more intuitive and clear
- add custom event `onLoad` to give plugins a way to execute code once
    all dependencies have been loaded
- add custom `room.sendChat` implementation that automatically cuts long
    messages up to a maximum length defined in `HHM.config.sendChatMaxLength`
- improve cron plugin, see its changelog

# Version 0.7.1

- improve commands plugin (see plugins/saviola/commands.js for changelog)
- fix a problem when trying to load a plugin that was already loaded
- fix problem that allowed plugins to be disabled even if other plugins depended
    on it (#2)
- fix a problem that would not enable a plugin after it was disabled once


# Version 0.7.0

- initial version
- support for loading configuration file from URL or via upload
- support for adding plugins via file, repository name or pasted source code
- support for dependency management and execution order specification
- experimental support for enabling / disabling plugins 