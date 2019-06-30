# Haxball Headless Manager

The Haxball Headless Manager (HHM) is a script to make managing headless haxball
rooms easier and allow several headless scripts (plugins) to run in parallel and
interact with each other. For further information, see the
[GitHub repository](https://github.com/saviola777/haxball-headless-manager).

This site is home to the official HHM
[release channels](https://hhm.surge.sh/releases/) as well as
the API documentation and several guides
illustrating the structure and inner workings of the system:

- {@tutorial writing-plugins}: For plugin authors and users who want to get an
  overview of existing plugins.
- {@tutorial events}: For a more in-depth explanation of the HHM event handling
  and available event handlers.

Thanks to [salamini](https://github.com/morko/) for
providing the [haxroomie](https://github.com/morko/haxroomie) and
[room trapper project](https://github.com/morko/haxball-room-trapper) projects.

## Releases

To use any of the [releases](https://hhm.surge.sh/releases/),
include the name or version number in
your configuration:

- `"X.Y.Z"`: use specific version (see
  [releases](https://hhm.surge.sh/releases/))
- `"latest"`: always the latest stable release
- `"git"`: a recent git build, I'll try to keep this
  functional as much as possible, but it will often be broken anyways
