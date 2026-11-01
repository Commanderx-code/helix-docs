---
title: ZimaBoard
description: The small board that runs the homelab's services in Docker, how its containers are laid out, how they reach each other, and how it is backed up three ways.
sidebar:
  order: 3
---

Behind the [firewall](/homelab/opnsense/) sits one low-power board running
ZimaOS, and on it, in Docker, every service the house uses: the DNS
resolver and ad blocker, home automation, the reverse proxy, the status
monitor, the dashboard, and the tools that watch all of the above. This
page is how that box is organised and why, with the addresses, names and
keys left out.

## One layout for everything

Every service is a Docker Compose project, and every project lives in the
same two places:

```text
compose/<service>/compose.yaml    how to launch it
AppData/<service>/                its state
```

That split is the whole recovery story. A service is the pair of them;
copy both and it comes back on another host. Nothing is started from the
app store any more: the definitions that came from it were rewritten as
plain Compose files and the originals archived, so there is one way to
look at a service and one way to change it.

A container manager with a web interface mounts the compose folder as its
projects directory. It is the one place a service is started, stopped or
updated from, and it is the only container that holds the
Docker socket. The monitors that need to see containers, the log viewer
and the system stats, go through a read-only socket proxy that permits
GET requests only, on an internal network with no published port. The
socket is root on the host; handing it to anything that does not need to
write with it is the line that is not crossed.

## How traffic gets to a service

Services are reached by name through a reverse proxy, which sits on its
own address on the LAN so it looks like a separate host to the firewall.
Internal DNS answers every service name with the proxy's address; the
proxy terminates TLS with one wildcard certificate it renews itself, and
routes by host name to the container behind it.

Three networks carry that:

- an **internal** network, with no route out, where the proxy reaches
  containers by name: the dashboard, the Zigbee bridge, the log viewer,
  the stats page;
- a private bridge for the one manager that needs to be reachable from
  the proxy but not from the internal network;
- the host itself, for services that bind to the host for a reason:
  home automation for device discovery, and the DNS resolver, which stays
  on Docker's default bridge so its upstream recursive resolver is at a
  fixed address.

Every route carries an allow-list of who may use it, checked against the
real connection peer, so forwarded-for headers do not open anything. The
management pages that must have a host port, the manager, the resolver's
admin page, the stats, are bound to the LAN address only, and a small
firewall script that runs after Docker starts filters those ports to the
LAN, ahead of Docker's own forwarding rules, with one exception for the
dashboard's widgets. The proxy is also blocked from the board's own VPN
and tunnel interfaces, so arriving over a VPN does not grant the LAN's
access.

## Hardening, in order of effect

- Every image is pinned to its digest, so an update is a decision to
  select a new digest, not something that happens at pull time. Weekly
  image scans run, one image at a time; automatic patching and automatic
  container updates are off.
- No container runs privileged; most run with `no-new-privileges`. The
  tunnel client runs with a read-only root filesystem, every capability
  dropped, and its token mounted from a root-only file rather than passed
  on the command line.
- Docker's log driver is `local` with a cap per file and per container,
  so a chatty service cannot fill the disk.
- A script documents and reapplies the private modes on app data,
  environment files and the backup folder. Recursive permission resets on
  the app data tree are avoided: containers differ in what they need.
- Things that were not earning their keep were removed rather than left
  running: a second container manager, an older one before it, a
  monitoring suite that used over a gigabyte of memory without being set
  up, a dashboard that was replaced.

## Backups, three ways

**Nightly, on the box.** A root-owned systemd timer stops the stateful
containers, home automation, the Zigbee bridge, the broker, the monitor,
the dashboard and the proxy, copies the Compose definitions, both app
data trees, the Docker daemon configuration and its own service files,
encrypts the archive with age, decrypts it again to verify it, restarts
the containers, and keeps 14 days on a dedicated USB disk. The script
refuses to write if that disk is not mounted, so a missing drive cannot
turn into a backup to the system disk. The firewall's configuration and
the VPS's export land on the same disk from timers of their own.

**Off-site.** A later timer copies the last few days of those encrypted
archives to an object-storage bucket with a bucket-only key and object
lock, so a compromised host cannot delete history. It never deletes;
lifecycle rules on the bucket do that. The archives are encrypted before
they leave, so the bucket holds nothing readable without the age
identity.

**The identity.** The private key that decrypts all of this is kept apart
from every backup, on the board and on the workstation, with a recoverable
copy elsewhere. It is never in a repository and never on the backup disk.
Without it the archives are noise, which is the point.

When any of the backup jobs fails, a systemd `OnFailure` unit sends a
notification through home automation, and the status monitor has a check
that fires if a fresh archive has not appeared in 28 hours. A failed backup
that nobody hears about is the same as no backup.

## Restoring

On a fresh host: restore the compose and app data trees to their paths,
the Docker daemon configuration and the systemd units as root, recreate
the internal networks before starting the stacks that use them, start the
dashboard, then rerun the management firewall script so its exception
for the dashboard's network exists. The restore has been exercised on
real archives, decrypting them on a workstation and comparing the
databases inside against the live systems.

## What is next

- VLANs, once the network hardware can carry them; the board's binding
  to one LAN address would change with it.
- Passkey login on the container manager.
- A larger drive for the one bulk copy that does not fit on the backup
  disk.
