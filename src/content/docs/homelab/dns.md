---
title: DNS with AdGuard Home and Unbound
description: How name resolution works in the Helix Tech homelab, with AdGuard Home filtering in front of a recursive Unbound resolver, enforced by the firewall, and why private names answer the same in two places.
sidebar:
  order: 6
---

Every device in the house asks one resolver, that resolver filters and
caches, and behind it a recursive resolver walks the DNS tree itself
rather than handing every question to a public provider. The firewall
makes sure devices cannot quietly opt out. This page is about how the
pieces fit and what they cost to get right; it leaves out the addresses
and the domain of this one network.

## Two resolvers, one answer

**AdGuard Home** is what the devices talk to. It is the DNS server that
DHCP hands out, it filters against blocklists, it keeps a short query
log, and it holds the rewrites that give the lab's private names the
proxy's address. It runs in a container on the board, on Docker's default
bridge, with its data and configuration persisted on the data disk.

**Unbound** is AdGuard's primary upstream. It is a recursive resolver: it
starts at the root servers and follows the referrals down, so no single
upstream provider sees the whole household's queries, and answers are
validated with DNSSEC. It listens only on the Docker bridge address, on a
port of its own, and the host blocks clients on other bridges from
reaching it; only AdGuard is meant to ask. Its image is pinned by digest
and its custom configuration is mounted read-only.

AdGuard's fallback upstream is Quad9 over TLS, with Quad9's addresses as
bootstrap resolvers so the fallback can be found when Unbound is not
answering. Both upstreams are tested from AdGuard's own interface after
any change. EDNS client subnet is off: with a recursive resolver there
is nothing for it to improve and something for it to leak.

The router stays the private reverse-DNS resolver, so the query log shows
device names rather than addresses for the LAN.

## Lists

One large, well-maintained blocklist, plus AdGuard's own DNS, phishing
and malware lists. A URL-shortener list was tried and turned off: it
breaks ordinary shared links, and a block that someone has to ask about
is worse than the tracking it stops. More aggressive general lists stay
off for the same reason. The query log is kept for seven days, which is
long enough to find out why a page broke yesterday.

Client address anonymisation in the log is off. Anonymised, every query
looked like it came from the same place, and the point of the log at home
is to see which device is doing the asking.

## Who may ask

AdGuard's client allow-list names the LAN, loopback and link-local, the
current Docker bridge networks, and the VPN ranges. Anything else is
refused. The list is derived from the host's routing table by a script
rather than typed, and the script checks the ranges against recent
clients in the query log before applying them, so a new network cannot be
cut off by accident. It talks to AdGuard's authenticated API with
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
known gap. Blocking it means blocking the well-known DoH endpoints by
name, which is a list that never ends, so for now it is accepted rather
than pretended away.

The redirect has one side effect that cost an evening: an ACME client's
own propagation check, which asks the DNS provider's name servers for the
challenge record, gets AdGuard's answer instead. See
[Traefik](/homelab/traefik/#one-certificate-no-open-port) for the fix.

## Private names, twice

The lab's services are reached by names under a real domain, and the
public DNS for that domain has no records for them. Inside, AdGuard's
rewrites answer with the proxy's address. But the workstation uses
Tailscale's DNS when the tunnel is up, and Tailscale asks the firewall's
own Unbound, not AdGuard. So each private name has to exist in two
places: an AdGuard rewrite and a host override on the firewall.

Two small scripts keep them in step, one for each resolver, and the
proxy's add-app script calls both so a new service is reachable from the
LAN and over the VPN in the same step. Forget one and the service works
on the couch and not from the road, which is the kind of bug that is
reported a week later.

A related trap: the board's own resolver list ends with public fallbacks,
which answer NODATA for the private names. Software on the board that
looks up a private name sometimes gets that answer and concludes the
service does not exist. Anything on the board that talks to another
local service uses an address, not a name, for that reason, and Home
Assistant pins the firewall's name to its address in its Compose file.

## Recovery

Restore AdGuard's two directories and its Compose file, keep it on the
default bridge so it can reach Unbound, restore Unbound's configuration
directory and Compose definition, start Unbound, start AdGuard, then
resolve something through AdGuard from a LAN device. The board's recovery
check does the last step on its own: it asks AdGuard for the app names
and expects the proxy's address, and a recovery exercise stops AdGuard
briefly to prove the check notices.

## What is next

- A decision on DNS over HTTPS: block the known endpoints, or keep
  accepting the gap.
- A second AdGuard instance, so a container update does not take the
  house's DNS with it for the duration.
