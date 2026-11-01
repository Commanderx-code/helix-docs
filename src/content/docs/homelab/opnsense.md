---
title: OPNsense
description: The firewall at the edge of the Helix Tech homelab, what it does, how it is locked down, and how it is backed up.
sidebar:
  order: 2
---

OPNsense is the first thing between the internet and everything else in
the lab. It is the router, the firewall, the DHCP server and the only way
in from outside. This page is about how it is set up and why; it leaves out
the addresses, names and keys that would describe this one network.

## The shape

One box with two ports: the WAN side takes whatever the ISP hands out over
DHCP, the LAN side is a single flat network for the house. There is no VLAN
separation yet. The access point is in bridge mode and there is no managed
switch, so a trusted, IoT and guest split is on the list, after the
hardware for it.

The WAN accepts exactly one inbound thing: WireGuard on its UDP port. There
are no port forwards for applications. The one service that is public, the
status page, reaches the internet through a tunnel from the inside, so
nothing on the WAN needs to be opened for it.

## Accounts and access

- The web interface and SSH are reachable only from a short list of
  administrator devices, held in a firewall alias, plus the two internal
  hosts that need the API: the server that runs the backups and the
  reverse proxy that fronts the interface. Everyone else on the LAN, and
  every VPN client, is blocked and logged.
- Administrator login uses a password plus a one-time code. Root cannot log
  in over SSH; a named account with a key can, and uses sudo.
- Services that talk to the firewall get accounts of their own, with only
  the rights they use. Home automation reads the ARP table, the interfaces
  and the firmware state, and is denied configuration writes. The backup
  job has a separate account that can download configuration history and
  nothing else: no rule access, no shell, a throwaway password, and a
  denied write.
- Web sessions time out after 15 minutes of idling, and access is logged.
- The anti-lockout rule was turned off only after the explicit allow rules
  and the populated administrator alias were checked in the live ruleset.
  Lock yourself out of the firewall once and you keep that order forever.

The interface is reached by a name, through the reverse proxy, with a
certificate the browser trusts; the proxy checks the real peer address, so
a forged forwarded-for header gets nowhere. The proxy in turn verifies the
firewall's own certificate. The direct address still works for recovery,
with the self-signed certificate and its warning.

## DNS stays inside

Every device gets the internal resolver over DHCP. For devices that ignore
that and bring their own resolver, a LAN rule redirects any plain DNS on
port 53 to the internal one. The resolver host itself is exempt so it can
recurse upstream, and a source-NAT rule keeps the replies symmetric.

Encrypted DNS is handled separately. DNS over TLS on port 853 is blocked
for everyone except the resolver host, which uses it for its own upstream.
DNS over HTTPS is not blocked by this, since it is just HTTPS; that is a
known gap, not an oversight.

The VPN interfaces get the same treatment with less trust: a client coming
in over WireGuard or Tailscale may reach the resolver and nothing else on
the inside unless a later rule says so.

## CrowdSec, and what is not on

CrowdSec runs on the firewall with its agent, its local API and the
firewall bouncer, so addresses with a bad reputation are dropped at the
edge. Suricata, the intrusion prevention engine, is installed but off: it
was not turned on without traffic and hardware sizing to justify it, and
an IPS that is on without being tuned is noise. UPnP is not installed.

## Backups

A timer on the internal server pulls the latest saved configuration every
night, encrypts it with age, decrypts the result to check it byte for byte,
and keeps 14 days of them on a dedicated backup disk. The job pins the
firewall's API certificate: if the certificate ever changes, the backup
fails on purpose until the new one has been checked over a trusted path.

The configuration download contains secrets, so the backup account's
credential lives outside every container mount, and the age identity that
can decrypt the backups is stored apart from the backups themselves.

A snapshot of the configuration was taken before the hardening pass and
another after it, both encrypted, so the whole change can be undone as one
step.

## Changing it safely

Changes to the firewall are made with scripts kept under version control,
each with a recorded rollback: the script saves the rule identifiers and
the previous state it replaced, and `--rollback` removes only what it
added. A one-off change through the web interface is fine, but the scripts
are what make the same change reproducible on a rebuild.

The access lockdown was applied with a helper that takes a snapshot first,
plans the change, applies it, and rolls back by itself unless the
administrator confirms access from an allowed device within a window.
That is the pattern for anything that could cut off access: let the
machine undo it unless a human says it worked.

## What is next

- VLANs, once the access point and a managed switch can carry them.
- A decision on Suricata, with traffic numbers.
- A remote WireGuard client's DNS path, exercised end to end rather than
  reasoned about.
