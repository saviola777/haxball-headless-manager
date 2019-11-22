# Haxball Headless Manager

Suite of management scripts for headless haxball hosts, including
[plugins](https://github.com/saviola777/hhm-plugins) with
dependency management. [Changelog](./CHANGELOG.md). [License](./LICENSE).

# Quick start

Here's how to get started using HHM in a graphical environment:

- copy the [default configuration file](./config/default.js) to your local PC or
  VPS
- change the file to suit your needs, most importantly
    - change room settings in `HHM.config.room`
    - add initialization code in `HHM.config.postInit`
    - add custom plugins in `HHM.config.plugins`
    - change host and admin passwords!
    - add custom repositories in `HHM.config.repositories`
- after making your changes, copy the whole file and paste it into the developer
  console on the [headless host](https://www.haxball.com/headless) page

More details below.

# Overview

Useful links:

- [haxroomie](https://github.com/morko/haxroomie#installation): If you have a
  VPS without a graphical environment or want to load plugins from disk, check
  out haxroomie, then come back here once you want to add more
  repositories / plugins or write your own plugins.
- [hhm-plugins](https://github.com/saviola777/hhm-plugins): Main plugin
  repository. Check it out to see which plugins already exist and how to use
  them.
- [hhm.surge.sh](https://hhm.surge.sh): This page provides access to the current
  HHM releases, and contains links and important information
- [HHM API documentation](https://hhm.surge.sh/api/):
  Contains detailed information on how to write plugins, how to interact with
  the HHM core system and about the structure of the HHM itself. Please check
  it out before asking questions, thanks!
- [haxroomie discord](https://discord.gg/TeJAEWu): If you need help or have
  questions / feedback.

This README shows how to add repositories and plugins to your HHM / haxroomie
configuration.

# Configuration overview

This section will show the HHM configuration directives you will be using when
running [haxroomie](https://github.com/morko/haxroomie), which is what most
people will want to do.

These configuration directives are available in both HHM and haxroomie:

- `HHM.config.plugins`: An object that maps plugin names (properties) to plugin
   configurations (which are again objects), see the example below.
   In haxroomie, this directive is called `pluginConfig`.
- `HHM.config.repositories`: A list of objects containing
  repository information, see the example below. In haxroomie, this directive is
  called `repositories`.


# Adding repositories

A repository generally looks like this:

```javascript
repositories = [{
    type: `github`,
    repository: `XHerna/fm-publicbot`,
    path: `plugins`, // optional, defaults to `src`
    version: `master`, // optional, this is the default value
    suffix: `.js`, // optional, this is the default value
  }
];
```

or


```javascript
repositories = [{
    type: `local`,
    path: `/path/to/local/directory`,
    plugins: { pluginName: pluginSource },
  }
];
```

Note that the `path` is needed when specifying the repository in haxroomie,
while the `plugins` is necessary when specifying the repository in HHM directly.

See the example configs to get a feeling for different ways of adding
repositories into your config.

# Adding plugins

Adding plugins can be done in several places:

- as part of your configuration file
- from the developer console
- from within the room

## Configuration file

To add a plugin in your configuration file, it has to be available in a
repository (e.g., on GitHub or locally). You first have to add the repository
and then add the plugin you want to use.

In this example, we will add the plugin `sav/plugin-control`, which we will
need later on.

The plugin is available in the GitHub repository
[saviola777/hhm-plugins](https://github.com/saviola777/hhm-plugins), so we add
the following entry in our config:

```javascript
HHM.config.repositories = [
  // […]
  {
    type: `github`,
    repository: `saviola777/hhm-plugins`
  },
];
```

This repository is already part of the default configuration file. To add the
plugin, you have to add a line in the `HHM.config.plugins` variable:

```javascript
HHM.config.plugins = {
  // […]
  'sav/plugin-control': {},
};
```

And that's it!

For Haxroomie you can add plugins in the configuration file in a similar way,
see its [README](https://github.com/morko/haxroomie/blob/master/README.md).

## Developer console

If you just want to load your own plugin or native headless script into a
running HHM system, paste your script into the following command:

```javascript
HHM.manager.addPlugin({ pluginCode: `<paste your code here>`,
  pluginName: `_user/my-plugin` })
```

You can repeat this for any number of scripts / plugins, just make sure to
change the plugin name at the end (and make sure the scripts don't interfere
with each other).

## In the room

To load a plugin from within the room, you have to first enable the plugin
`sav/plugin-control` as described above. Then, you have to add a password for
the `host` role in your config, like this:

```javascript
HHM.config.plugins = {
  // […]
  'sav/roles': {
    roles: {
      'host': `add your host password here`,
      'admin': `add your admin password here`
    },
  },
};
```

Then, you have to authenticate for the `host` role in the room using the
following command:

```
!auth host add your host password here
```

Now you can load plugins from configured repositories:

```
!plugin load fm/fill-teams
```

If some plugin causes problems you can enable and disable plugins as well:

```
!plugin disable fm/full-teams
!plugin enable _user/my-plugin
```

For more information on available plugins see the
[hhm-plugins repository](https://github.com/saviola777/hhm-plugins).


# Feedback and Contributing

Feel free to create pull requests for plugins or other changes, or create issues
for bugs, questions or anything you want to discuss. You can find me in the
official Haxball IRC channel #haxball at freenode and on the
[Haxroomie discord](https://discord.gg/TeJAEWu).
