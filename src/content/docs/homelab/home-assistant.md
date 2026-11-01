---
title: Home Assistant and Zigbee
description: How the Helix Tech homelab runs Home Assistant, Zigbee2MQTT and Mosquitto in containers, what the dashboards and automations do, and what broke along the way.
sidebar:
  order: 4
---

Home Assistant is the part of the lab the rest of the house notices. It
runs on the same [board](/homelab/zimaboard/) as everything else, in a
container, with Zigbee
devices reaching it through Zigbee2MQTT and a Mosquitto broker. This page
is about how the three fit together and what went wrong along the way; it
leaves out the addresses, entity names and tokens of this one
house.

## The three containers

**Home Assistant** runs on the host's network stack rather than behind a
Docker port mapping, so discovery protocols that depend on multicast and
broadcast still see the LAN. It is not privileged, and it runs with
`no-new-privileges`. The host's D-Bus socket is mounted read-only for the
integrations that use it. Its configuration lives in one directory on the
data disk, which is the only thing that must survive a rebuild.

**Mosquitto** is the MQTT broker, on the standard port, with its
configuration, data and log directories persisted separately.

**Zigbee2MQTT** owns the Zigbee network. The coordinator is a network
device, not a USB stick: Zigbee2MQTT talks to it over TCP, so no USB device
is passed into a container. Zigbee2MQTT depends on Mosquitto and starts after it.

The web interface of Zigbee2MQTT asks for an access code. Without one the
interface's websocket closes with code 4401. Home Assistant never uses that interface; it talks to
Zigbee2MQTT over MQTT, so the code does not affect it. Through the
reverse proxy the interface also needs the allow-list and the single
sign-on login, described under
[how traffic gets to a service](/homelab/zimaboard/#how-traffic-gets-to-a-service).

The Home Assistant image is pinned by digest. An update is a deliberate change to
the digest, a pull and a recreate, not a restart that happens to fetch
something newer.

## The watchdog

Zigbee2MQTT exits when it loses the coordinator. During a short network
drop the coordinator went away, Zigbee2MQTT exited with an error, and
Docker stopped restarting it while the coordinator was still unreachable.

A systemd timer on the host now runs a small script every two minutes. If
the container has exited with a non-zero code and the coordinator's port
answers again, it starts the container. A clean stop, exit code 0, is left
alone, so stopping Zigbee2MQTT on purpose does not turn into a fight with
the watchdog.

## Dashboards

The default dashboard is a custom one built from Mushroom cards through
HACS, set as the system default. Recent Home Assistant releases send the
old Overview to the built-in Home panel, so a custom layout has to live in
its own dashboard rather than replace Overview. Two frontend plugins load
on every page: swipe navigation, so the phone moves between tabs with a
swipe, and a sidebar mini player that shows whatever is playing.

Three tabs: a home tab with a greeting, a count of things that are on,
the weather, an all-off button, who is home and for how long, lights by
room, what is playing, the printer, a dehumidifier and a pet camera; a
media tab with the players by room; and a lab tab with the board's CPU,
memory, temperature and disk, container state, the speed test, Zigbee
health, monitor states and waiting updates.

A second account in the household sees a trimmed version. The lab tab and
the activity dashboard are admin only, and the built-in Map dashboard was
made admin only too, so that account's sidebar shows only what it uses.

The dashboard definition is YAML in version control, applied through the
websocket API by a script that saves the current configuration to a backup
first and can restore any backup.

## Integrations worth noting

- **The firewall**, through its REST API with a read-only account.
  Interface counters every 30 seconds feed derivative helpers that give
  upload and download in megabits per second over a one-minute window.
  Without the window, every reading dropped back to zero between samples.
  The firmware status endpoint gives a sensor that says whether an update
  is waiting, and a REST command starts the check.
- **The cable modem's** status pages, scraped for upstream power,
  downstream signal-to-noise, uncorrectable errors, uptime and the
  time-outs in its event log. Combined with the firewall's counters, a slow
  upload can be blamed on either the house or the line.
- **Uptime Kuma**, for monitor states, certificate expiry of the HTTPS
  monitors, and a push monitor that the daily image check reports to.
- **The access point**, over its admin API, for CPU, memory, temperature
  and client count. It also creates a Wi-Fi presence tracker per client;
  two are enabled and attached to the people as a second home signal next
  to the phone's GPS. A phone with a rotating private Wi-Fi address breaks
  this, so that setting is off on the home networks.
- **AdGuard Home**, for the query and block counts and the protection
  switch, which asks before toggling.
- **A pet camera** through a community bridge for the vendor's cloud
  account, running on the board and published on loopback only. The bridge
  signs in with a second account shared from the main one, with the
  password read from a file rather than the container's environment. It
  asks for a captcha after every restart, so a reboot or an image update
  means a reauthenticate prompt in Home Assistant. The live view uses the
  camera's RTSP stream through the Generic Camera integration instead of
  the vendor entity, which has no stream until one is started.
- **A dehumidifier**, a printer's ink levels over SNMP, Spotify, two
  Android TV boxes, a webOS TV, a Samsung TV, Plex clients, and a speed test
  posted to a local-only webhook by a timer on the host.

Two rules came out of this list. Integrations that point at something on
the LAN use an address, not a private name: the board's resolver list ends
with public fallbacks, those answer NODATA for private names, and Home
Assistant sometimes asked them, which left integrations stuck in a setup
retry loop. And the Home zone has to be moved to the house during
onboarding; left at the default, the person entity stays away and the
weather is for somewhere else.

## Automations

Automations are built in the interface and alert through the
companion app. A few of them:

- **Everything off when nobody is home.** The home zone at zero people for
  ten minutes with something still on runs a script that turns off the
  lights and the players, then reports the count.
- **A Zigbee button** with three actions: single press toggles one room,
  double press another, hold all of them. A long press arrives as `hold`
  then `release`, not `long`. The MQTT topic contains the device's friendly
  name, so renaming the button in Zigbee2MQTT silently breaks the
  automation until the topic is updated.
- **TV left on.** A TV on for two hours with nothing playing in that room
  gets a prompt on the phone with a Keep-on button; without a tap it turns
  off ten minutes later. Apps that report no playback look idle, which is
  why it asks first.
- **Alerts** for a monitor down, waiting container images, a failed backup
  (the host's nightly backup job posts to a local-only webhook on
  failure), a slow upload with the evidence attached, modem trouble, a
  certificate with under 14 days left, a firewall update, the Zigbee bridge
  down, low batteries, low ink and a full dehumidifier bucket.

The Zigbee bridge alert distinguishes `off`, meaning Zigbee2MQTT stopped,
from `unavailable`, meaning Home Assistant lost MQTT and Mosquitto is
probably the one that is down.

## Recovery

In order: restore Mosquitto's configuration and data, restore
Zigbee2MQTT's data, restore the Compose files and the environment values
that are kept out of version control, start Mosquitto, start Zigbee2MQTT,
then check the MQTT and Zigbee entities in Home Assistant. Home Assistant's
configuration directory is in the host's encrypted nightly backup, and its
own automatic backup is a second, application-level copy. The midnight
backup restarts Home Assistant, which is why "home since" times are kept in sensors
that survive a restart rather than read from an entity's last change.
