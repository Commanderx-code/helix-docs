---
title: Homelab
description: Notes from the Helix Tech homelab, where networking, self-hosted services and home automation come together, written for anyone building something like it.
sidebar:
  label: Overview
  order: 1
---

The Helix Tech homelab is a small home network built and run as a place to
learn: a firewall of its own, a low-power board running the services the
house uses, home automation, and monitoring that says when something is
off. It is also where the Helix tools are put to work before they are
released.

These pages describe how it is put together and why. They are written for
someone building something similar, not as a record of this one network,
so they explain the choices and the setup, not the addresses.

## What it runs on

| Area | Built with |
| --- | --- |
| Networking | OPNsense as the firewall and router, with WireGuard for the way in from outside, and AdGuard Home and Unbound for DNS |
| Self-hosting | A ZimaBoard running Docker, with Traefik in front of the services |
| Home automation | Home Assistant, with Zigbee devices through Zigbee2MQTT and Mosquitto |
| Monitoring | Uptime Kuma for the services, and the Helix tools' own checks on the machines |
| Outside | A small VPS that serves helixtech.app, this site and the public status page |

## What these pages are

Each page covers one system or service: what it is for, how it is set up,
what it depends on, and what went wrong on the way and how it was fixed.
Where the setup is a file, the page shows the file with its secrets and
addresses taken out.

Not here, on purpose: internal addresses, host names, device names, the
remote-access path, and anything else that maps the network. Those stay
in the private notes the network is run from.

Pages arrive as they are written. Each one links to the one it builds on,
so a reader can start at the firewall and follow the wires in.
