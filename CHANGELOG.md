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