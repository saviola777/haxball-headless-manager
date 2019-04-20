# Haxball Headless Manager

Suite of management scripts for headless haxball hosts, including
[plugins](https://github.com/saviola777/hhm-plugins) with
dependency management. [Changelog](./CHANGELOG.md). [License](./LICENSE).

Useful links:

- [Getting started](#getting_started): For users wanting to host their room
  using the HHM.
- [hhm-plugins](https://github.com/saviola777/hhm-plugins): Main plugin
  repository. Check it out to see which plugins already exist and how to use
  them.
- [HHM API documentation](https://haxplugins.tk/docs):
  Contains detailed information on how to write plugins, how to interact with
  the HHM core system and about the structure of the HHM itself. Please check
  it out before asking questions, thanks! 
  

# <a name="getting_started"></a> Getting started

This first part is for users, it shows how to set up and configure the HMM,
plugin developers will want to check out the API documentation.

## Preparing your configuration

To get started using the HHM, you first need to prepare your config. Take a
look at the
[default configuration](./config/default.js) and change it to your liking after
downloading it.


The following configuration directives are available currently:

- `HHM.config.room`: this is the object as you would pass it to HBInit, see the
    [RoomConfigObject documentation](https://github.com/haxball/haxball-issues/wiki/Headless-Host#roomconfigobject)
- `HHM.config.postInit`: this is a function (or source code as `String`) that is
    executed after the room is started, it is just another plugin, so make sure
    to retrieve your room instance using `HBInit()`.
- `HHM.config.plugins`: An object that maps plugin names (properties) to plugin
    configurations (which are again objects), see the example file linked above
- `HHM.config.repositories`: A list of strings (URLs) or objects containing a
    `url` and (optionally) a `prefix`, see the example file linked above

Make sure to read the example config file, it has detailed explanations of each
configuration directive.
 
If you have uploaded your config somewhere, simply paste the following line in
the dev console (insert the link to your config):

```javascript
let s = document.createElement("script");s.src="https://yourdomain.tld/config.js";document.head.appendChild(s);
```

Alternatively, paste your config into the dev console.

If you have used the abovementioned template, you are done! The HHM should
automatically be loaded alongside your configuration.

## Deploying your configuration on headless VPS

Once you have set up your config and plugins to your liking you might want to
deploy it on your headless VPS. The easiest way to do this is using
[Haxroomie](https://github.com/morko/haxroomie). After you have installed
Haxroomie, you have to upload your configuration and plugins to your VPS and
can then start a room using

```bash
haxroomie <token> --config yourHhmConfig.js --plugins pluginPath1.js,pluginPath2.js
```

The project [Haxroomie web](https://github.com/morko/haxroomie-web) adds a
web GUI to make managing your headless haxball rooms remotely very comfortable
from within your browser. 

# Adding plugins

Adding plugins can be done in several places:

- as part of your configuration file or haxroomie command line
- from the developer console
- from within the room

## Configuration file

To add a plugin in your configuration file, it has to be available in a
repository (e.g., on GitHub). You first have to add the repository and then add
the plugin you want to use.

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

For Haxroomie you can add plugins on the command line as described above and
in its [README](https://github.com/morko/haxroomie/blob/master/README.md),
but you have to make sure to pass them in the correct order if they depend on
each other, and you have to be aware that no plugin from your HHM config can
depend on the HHM plugins because they are loaded after the plugins from your
configuration file.

## Developer console

If you just want to load your own plugin or native headless script into a
running HHM system, paste your script into the following command:

```javascript
HHM.manager.addPluginByCode(`<paste your code here>`, `_user/my-plugin`)
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
      'host': `add your password here`,
      'admin': haxroomie.adminPassword || 'haxroomie'
    },
  },
};
```

Then, you have to authenticate for the `host` role in the room using the
following command:

```
!auth host add your password here
```

Now you can load plugins from configured repositories or from pastebin:

```
!plugin load fm/fill-teams
!plugin load _user/my-plugin https://pastebin.com/5wkZGNar
```

If some plugin causes problems you can enable and disable plugins as well:

```
!plugin disable fm/full-teams
!plugin enable _user/my-plugin
```

For more information on available plugins see the
[hhm-plugins repository](https://github.com/saviola777/hhm-plugins).

# Creating your own plugin repository

There are currently three ways to deploy your own plugin repository:

- using a webserver to directly serve the plugins
- using a GitHub repository
- using a custom web app to serve the plugins

The first two will be described here, the last one is an advanced variant of the
first.

## Using a webserver

Assuming your domain is `yourdomain.tld` and you put the plugin
`author/plugin-name` so that it can be accessed at the URL
`https://yourdomain.tld/plugins/author/plugin-name.js`, your repository entry
would look like this:

```javascript
HHM.config.repositories = [
    // […]
    {
      type: `plain`, // optional, this is the default value
      url: `https://yourdomain.tld/plugins/`,
      suffix: `.js`, // optional, this is the default value
    }
];
```

## Using a GitHub repository

When it comes to a GitHub repository there are three things you need to know:
the repository name (i.e. user + repository), the path within the repository
where the plugins are stored, and the branch of the repository you want to use.

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
      branch: `master`, // optional, this is the default value
      suffix: `.js`, // optional, this is the default value
    }
];
```

# Building the HHM

You can build the project using `browserify` after installing the dependencies
using `npm install`, see the [makefile](./makefile).

# Feedback and Contributing

Feel free to create pull requests for plugins or other changes, or create issues
for bugs, questions or anything you want to discuss. You can find me in the
official Haxball IRC channel #haxball at freenode.