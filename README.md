# Haxball Headless Manager

Suite of management scripts for headless haxball hosts, including
[plugins](https://github.com/saviola777/hhm-plugins) with
dependency management. [Changelog](./CHANGELOG.md). [License](./LICENSE).

Useful links:

* [Getting started](#getting_started): For users wanting to host their room
  using the HHM.
* [hhm-plugins](https://github.com/saviola777/hhm-plugins): Main plugin
  repository. Check it out to see which plugins already exist and how to use
  them.
* [HHM wiki](https://github.com/saviola777/haxball-headless-manager/wiki):
  Contains detailed information on how to write plugins, how to interact with
  the HHM core system and about the structure of the HHM itself. Please check
  it out before asking questions, thanks! 
  

# <a name="getting_started"></a> Getting started

This first part is for users, it shows how to set up and configure the HMM,
while the later part, [writing & publishing plugins](#writing), is meant for
developers wanting to write plugins for the HHM.

## Preparing your configuration

To get started using the HHM, you first need to prepare your config (unless you want
to use the manual configuration and load your plugins later, then you can skip
to [Loading the HHM](#loading)). Take a look at the
[default configuration](./config/default.js) and change it to your liking.


The following configuration directives are available currently:

* `HHM.config.room`: this is the object as you would pass it to HBInit, see the
    [RoomConfigObject documentation](https://github.com/haxball/haxball-issues/wiki/Headless-Host#roomconfigobject)
* `HHM.config.postInit`: this is a function (or source code as `String`) that is
    executed after the room is started, it is just another plugin, so make sure
    to retrieve your room instance using `HBInit()`.
* `HHM.config.plugins`: An object that maps plugin names (properties) to plugin
    configurations (which are again objects), see the example file linked above
* `HHM.config.repositories`: A list of strings (URLs) or objects containing a
    `url` and (optionally) a `prefix`, see the example file linked above

 
If you have uploaded your config somewhere, simply paste the following line in the dev console (insert the link to your config):

```javascript
let s = document.createElement("script");s.src="https://yourdomain.tld/config.js";document.head.appendChild(s);
```

Alternatively, paste your config into the dev console.

If you have used the abovementioned template, you are done! The HHM should
automatically be loaded alongside your configuration.

# Building the HHM

You can build the project using `browserify` after installing the dependencies
using `npm install`, see the [makefile](./makefile).

# Feedback and Contributing

Feel free to create pull requests for plugins or other changes, or create issues
for bugs, questions or anything you want to discuss. You can find me in the
official Haxball IRC channel #haxball at freenode.