# Events

This guide will cover the HHM event handling in depth. It is not necessary to
read this if you just want to develop plugins, check out {@tutorial writing-plugins}
first if you are interested in that.

This guide is still WIP.

There are two types of events within the HHM system:

- local events, which are executed on one plugin only (e.g., when you call
  `room.getPlugin("abc/some-other-plugin").onEventHandler(args)`, you trigger a
  local event on the plugin `abc/some-other-plugin`)
- global events, which are executed on all plugins that define an event handler
  for it (e.g., when you call `room.triggerEvent("onEventHandler", args)`, you
  trigger the global event `onEventHandler` on all plugins)

To keep things simple, the name of events is always the same as the event
handler name, i.e. you trigger an event using its event handler name.

## Event handling loop

The event handling loop is defined in {@link TrappedRoomManager#onExecuteEventHandlers}
and consists of the following steps:

### Pre-event hooks

First, all registered pre-event hooks for all enabled plugins are executed.
These hooks can return an `Array` which replaces the event arguments, or any
other value which can be taken into account in subsequent hooks. Unlike event
handlers, pre-event hooks are always executed regardless of intermediary event
state modification.

To add pre-event hooks, call {@link HhmRoomObject#addPreEventHook}
with the handler name(s) for which you want to register a hook and the hook
function, plus an optional hook identifier. Before the event arguments, an object
with the properties `room` ({@link HhmRoomObject}) and `metadata`
({@link EventHandlerExecutionMetadata~Proxy}) is passed to the hooks. Here's an
example for a pre-event hook:

```javascript
function onPlayerTeamChangePreEventHook({}, player) {
  getPlayerById(player.id, {}).team = player.team;
}
```

This function is part of the `sav/players` plugin's layer which removes 
asynchronity from the room API, it essentially sets the player team to the new
team right away instead of waiting for the player to actually be moved to the team
like the native API does.

Since event arguments can be transformed by pre-event handler hooks and there
is no defined order for the execution of these hooks, try to avoid making
assumptions on the event arguments and do careful type and value checking where
applicable while at the same time avoiding unexpected argument transformation.

### Pre-event handler hooks

If at least one of the pre-event hooks returned `false`, event execution is
cancelled and no further processing happens.

Otherwise, the pre-event handler hooks are executed next. The similar name may
be confusing, but note the small difference here: __handler__. These hooks are
executed before every single handler, but work very similar to the pre-event
hooks in most other regards: they can be added using {@link HhmRoomObject#addPreEventHandlerHook}, they can transform arguments (make sure to create new
object / arrays when transforming arguments, because arguments are reset after
each event handler is executed), and they receive the same arguments as the
other hooks. The `metadata` object can be used to access the current event
handler object.

The reason we need pre-event handler hooks is simple: consider the case when a
user joins the room, and the first `onPlayerJoin` handler decides that the user
should be kicked. When the second handler is executed, the player is no longer
in the room (or, worse, still in the room but in the process of being kicked),
we call this an _invalid event state_. Other examples include the game being
unpaused in the `onGamePause` handler, the game being stopped in the `onGameStart`
handler etc. The native API obviously didn't have this problem because it only
allows a single handler for each event type.

This takes the burden of making sure the room is in the correct state away from
the plugin authors, but it also means that, depending on the order of execution,
__certain handlers are not executed when their associated event happens__.

In addition to _global_ pre-event handler hooks, which are executed before every
single event handler for the associated handler names, it is also possible to
register pre-event handler hooks directly on the handler object, thereby
allowing us to have finely grained control over event handler execution. Simply
retrieve the appropriate handler object and call
`handler.addPreEventHandlerHook(plugin, hook, hookId)` where you pass the room
object of your plugin as well as the hook function and an optional hook
identifier.

Here's an example for a pre-event handler hook implementation:

```javascript
function onPlayerJoinPreEventHandlerHook({}, player) {
  return player.online === true;
}
```

This is from the `sav/players` plugin and it uses the custom player property
`online` (which is set to false when a player leaves) to check if the player
is still in the room and returns `false` if the player is no longer online.

### Event handler execution

And event handler is executed after all pre-event hooks and pre-event handler
hooks and it is only executed if none of those hooks returned `false`.

Before the handler is executed in the function {@link  TrappedRoomManager#_executeHandler},
the plugin-specific metadata object is injected into the handler arguments if
needed. This object is an instance of {@link EventHandlerExecutionMetadata~Proxy}
which gives limited access to the proxied metadata object and allows convenient
plugin-specific metadata storage.

### Post-event handler hooks

Much like the pre-event handler hooks, the post-event handler hooks can be
registered with {@link HhmRoomObject#addPostEventHandlerHook} (as well as
directly on the handler object) and will be executed after every event handler
with the same arguments `room` and `metadata`.

Post-event handler hooks are only executed if the associated event handler was
executed.

### Post-event hooks

Much like the pre-event hooks, the post-event hooks can be
registered with {@link HhmRoomObject#addPostEventHook} and will be
executed after every event handler with the same arguments `room` and `metadata`.

They have a less important role than pre-event hooks in that they are
essentially handlers which are executed after the main event handler execution
loop finishes. They are always executed regardless of event state validation. If
you want to make sure your handler is executed but do not need it to be executed
before the event handler execution loop, register it as a post-event handler hook.

If you want to check if any handlers were executed to decide if you hook needs
to be run, check `metadata.getHandlers().size`.

## HHM events

There's a number of events which are triggered as things happen within the
HHM plugin lifecycle. These are uninteresting in most situations and for most
plugin authors, but can be useful if you want to extend the HHM system or need
more control and react to plugin lifecycle events.

For each of the events listed below, two event handlers are called:

- `onHhm(args)`
- `onHhm_eventName(args)`

where `args` is a single object with the properties listed below plus a property
`eventName` which corresponds to one of the event names listed below and is
always included in the event arguments.

For example, a correct event handler for the event `eventHandlerSet` looks like
this:

```javascript
room.onHhm_eventHandlerSet = ({ plugin, handlerName, handler }) => {
  // Your event handler code
};
```

The available events are:

- `eventHandlerSet` and `eventHandlerUnset` for plugin event handlers being set /
  unset
- `propertySet` and `propertyUnset` for plugin properties being set / unset
- `pluginEnabled` and `pluginDisabled` for plugins being enabled and disabled
- `beforePluginLoaded`, `pluginLoaded` and `pluginRemoved` for plugins being
  loaded and removed
- `localEvent` for local events called on only one plugin

Each of these has a corresponding `HHM.events.` constant, see {@link HHM.events}
for more details on the events and event arguments.