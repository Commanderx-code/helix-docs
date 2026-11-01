---
title: DNS with AdGuard Home and Unbound
description: How name resolution works in the Helix Tech homelab, with AdGuard Home filtering in front of a recursive Unbound resolver, enforced by the firewall, and why private names answer the same in two places.
sidebar:
  order: 6
---

Every device in the house asks one resolver, that resolver filters and
caches, and behind it a recursive resolver walks the DNS tree itself
rather than handing every question to a public provider. The firewall
redirects devices that try to use another resolver. This page is about
how the pieces fit; it leaves out the addresses
and the domain of this one network.

## Two resolvers, one answer

**AdGuard Home** is what the devices talk to. It is the DNS server that
DHCP hands out, it filters against blocklists, it keeps a short query
log, and it holds the rewrites that give the lab's private names the
proxy's address. It runs in a container on the board, on Docker's default
bridge, with its data and configuration persisted on the data disk.

**Unbound** is AdGuard's primary upstream. It is a recursive resolver: it
starts at the root servers and follows the referrals down, so no single
upstream provider sees the whole household's queries. It listens only on the Docker bridge address, on a
port of its own, and the host blocks clients on other bridges from
reaching it; only AdGuard is meant to ask. Its image is pinned by digest
and its custom configuration is mounted read-only.

AdGuard's fallback upstream is Quad9 over TLS, with Quad9's addresses as
bootstrap resolvers. EDNS client subnet is off.

The router stays the private reverse-DNS resolver, so the query log shows
device names rather than addresses for the LAN.

## Lists

One large blocklist, plus AdGuard's own DNS, phishing and malware lists.
A URL-shortener list is off, to avoid breaking ordinary shared links. The
query log is kept for seven days.

Client address anonymisation in the log is off, so the dashboard and the
query log show real device addresses.

## Who may ask

AdGuard's client allow-list names the LAN, loopback and link-local, the
current Docker bridge networks, and the VPN ranges. Anything else is
refused. The list is derived from the host's routing table by a script
rather than typed, and the script checks the ranges against recent
clients before applying them. A new network has to be added before its
clients can use AdGuard. The script talks to AdGuard's authenticated API with
credentials read from a file with mode 600, independent of the dashboard
login, and saves the previous settings beside it so any change can be
rolled back with one flag.

## The firewall makes it stick

Handing out the resolver over DHCP only works for devices that listen.
The firewall adds three rules on the LAN side, described on the
[OPNsense](/homelab/opnsense/#dns-stays-inside) page:

- any plain DNS on port 53 is redirected to AdGuard, whatever server was
  asked, so a device with a hard-coded public resolver still gets the
  filtered answer;
- the board itself is exempt, so Unbound can recurse upstream;
- DNS over TLS on port 853 is blocked for everyone except the board.

DNS over HTTPS is not caught by this, since it is just HTTPS. That is a
known gap.

The redirect has one side effect: an ACME client's
own propagation check, which asks the DNS provider's name servers for the
challenge record, gets AdGuard's answer instead. See
[Traefik](/homelab/traefik/#one-certificate-no-open-port) for the fix.

## Private names, twice

The lab's services are reached by names under a real domain, and the
public DNS for that domain has no records for them. Inside, AdGuard's
rewrites answer with the proxy's address. But the workstation uses
Tailscale's DNS, and Tailscale asks the firewall's
own Unbound, not AdGuard. So each private name has to exist in two
places: an AdGuard rewrite and a host override on the firewall.

Two small scripts keep them in step, one for each resolver, and the
proxy's add-app script calls both so a new service is reachable from the
LAN and over the VPN in the same step.

A related trap: the board's own resolver list ends with public fallbacks,
which answer NODATA for the private names. Home Assistant sometimes got
that answer, which left integrations stuck or unavailable. Its
integrations use an address, not a private name, for that reason, and it
pins the firewall's name to its address in its Compose file.

## Recovery

Restore AdGuard's two directories and its Compose file, keep it on the
default bridge so it can reach Unbound, restore Unbound's configuration
directory and Compose definition, start Unbound, start AdGuard, then
resolve something through AdGuard from a LAN device. The board's recovery
check does the last step on its own: it asks AdGuard for the app names
and expects the proxy's address, and a recovery exercise stops AdGuard
briefly to prove the check notices.
