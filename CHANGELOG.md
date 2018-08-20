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