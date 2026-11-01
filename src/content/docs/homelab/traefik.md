---
title: Traefik and Authelia
description: The private HTTPS reverse proxy in the Helix Tech homelab, how it gets a trusted certificate without opening a port, how access is decided per app, and the login in front of the admin tools.
sidebar:
  order: 5
---

Every service in the lab is reached by a name over HTTPS, with a
certificate the browser trusts, and nothing on the firewall is opened for
it. Traefik does that: one container, one wildcard certificate, one file
per app. Authelia adds a single login in front of the tools that should
not be a port number and a password away. This page is about the shape
of it and the decisions; it leaves out the names, addresses and tokens of
this one network.

Traefik replaced Nginx Proxy Manager. The point-and-click proxy was fine
until the access lists and the headers wanted to be in version control,
and then the files were the feature.

## The container

- The image is pinned by digest and updated like the other pinned images,
  on purpose and one at a time.
- It runs as an unprivileged user with a read-only root filesystem, every
  capability dropped and `no-new-privileges`. Ports 80 and 443 work
  because the host lowers the unprivileged port start to zero, which is a
  smaller grant than a capability on the container.
- No Docker socket. Routes are plain files watched by Traefik's file
  provider, not labels read off containers. The proxy therefore cannot
  enumerate or control the other containers, and a route is a file that
  can be reviewed, committed and rolled back.
- The proxy has an address of its own on the LAN through a macvlan
  network, so allow-lists see the real client address rather than a Docker
  bridge. Upstreams that are containers are reached by name over an
  internal network; upstreams that use the host's network stack are
  reached by address.
- A health check runs on a loopback-only entry point, which also serves
  the API without a login for the local tooling described below.

A saved change to a file in the dynamic directory applies within seconds.
Changes to the static configuration, the entry points, the certificate
resolver and the providers, need a restart.

## One certificate, no open port

One Let's Encrypt certificate covers the lab's domain and its wildcard,
obtained through the DNS challenge against the domain's DNS provider. The
API token for that is scoped to DNS edits on that one zone, lives in a
file with mode 600, and is read through the `_FILE` form of the variable,
so it is not in the container's environment for `docker inspect` to show.
Traefik renews the certificate when 30 days are left, and a separate
alert fires at 14 days, so an alert means renewal failed rather than that
it is due.

One wrinkle came from the firewall's DNS policy, which redirects every
plain DNS query on the LAN to the internal resolver whatever server was
asked. The ACME client's own propagation check asks the provider's name
servers for the challenge record; redirected, it got no record and never
passed. The check is turned off and replaced with a fixed wait. Let's
Encrypt checks from outside and is unaffected.

## A route per app

Each app has one file with a router and a service: the host name, the
upstream, and a middleware chain. Upstreams that speak HTTPS are verified
against their real certificate where they have one. The firewall's
interface is verified against its own public certificate, the access
point against the vendor's root certificate, and a printer with a
certificate that names nobody is proxied without verification, which is
what it was before and is noted as such.

The middleware chain is always in the same order:

1. **An allow-list.** Named lists of client addresses: the whole LAN,
   the administrator's two devices, the same two devices over the VPNs,
   the monitoring host. A source outside the list gets 403. The public
   status page is the only route open to anyone, and it has its own
   login and public pages.
2. **The login**, on the admin tools, described below.
3. **Security headers.** HSTS for a year, `nosniff`, and
   `X-Frame-Options: SAMEORIGIN`, replacing whatever the app sends. The
   printer is the exception: its page serves scripts as `text/js`, which
   `nosniff` makes the browser refuse, so it keeps only its own
   `DENY`.

The entry point deletes aliased forwarded headers, so an underscore
variant of `X-Forwarded-For` is dropped instead of reaching an app that
might read it as the real one.

The access log keeps only failed requests, status 400 to 599. The
allow-list's 403s and upstream errors stand out in the log viewer;
successful requests, the monitor's checks among them, are not written.

## Adding an app

A new app needs a route file and a name in two resolvers: the LAN's and
the one the VPN clients use. A script on the workstation does all of it:

```bash
scripts/traefik/add-app.py NAME UPSTREAM [--allow LIST] [--login] [--insecure]
```

It checks that the proxy can reach the upstream, writes the route file and
copies it to the host, waits until the proxy's API shows the route
enabled, adds the DNS rewrite in both resolvers, then requests the page
through the proxy. The wildcard certificate already covers the name. A
monitor and a dashboard tile are separate, deliberately. Removing an app
is the route file and the two DNS records, in reverse.

The script asks the API through the loopback-only entry point, with
`docker exec`, because the dashboard itself sits behind the login.

## What else has to let the proxy in

The proxy's address is allowed in four places, and all four had to change
when it took over from the old proxy:

- The host's own firewall, so the proxy can reach the host-network apps.
- The firewall's alias for the hosts that may reach its web interface.
- The firewall's VPN rules, which let the administrator's devices reach
  the proxy over WireGuard and Tailscale, and the route the VPNs advertise
  for it.
- Home Assistant's trusted proxies, which live in its interface-managed
  HTTP settings rather than YAML. Without that entry it answers 400 to
  every proxied request.

Keep the list. Retiring the old proxy was a scripted pass over the same
four places plus the monitor, with the old data archived encrypted before
it was deleted.

## Authelia

Authelia is a forward-auth login, a password plus a time-based one-time
code, on the admin tools: the log viewer, the system monitor, the Zigbee
interface, the network scanner and the proxy's own dashboard. The
allow-lists still apply first; the login is a second gate, not a
replacement for the first.

- It runs as an unprivileged user, read-only, capabilities dropped, on an
  internal network with no internet access and no published port; only
  the proxy can reach it. With no internet, its NTP start-up check is off
  and the host keeps the clock.
- The user file holds an argon2id hash made on the workstation, so the
  password itself never goes to the server. The session secret, the
  storage key and the reset secret are random files read through `_FILE`
  variables.
- A session lasts two hours idle or twelve in all, or a month with
  "remember me". Three wrong logins in two minutes lock the account for
  ten. There is no mail server, so password reset by email is off and the
  one-time code for enrolling the second factor is written to a file on
  the host, read over SSH, then scanned into the authenticator app.
- The monitoring host may load, without a login, only the one page each
  monitor checks, with GET or HEAD. A down app still fails its check; a
  redirect from that page lands on the login page, which the monitor also
  counts as up. Nothing behind the page is open to it. A monitor on a new
  protected page needs its own bypass rule or it sees the login page and
  reports that as the app.

If Authelia is down, the protected pages answer 500 or loop to a login
page that does not load. The way in is to remove the login middleware
from those routes in the dynamic files on the host, which applies in
seconds, fix Authelia, and put it back. A lost authenticator is one
command to delete the user's TOTP entry and enrol again.

## Checks

The monitoring host loads the proxy's dashboard and watches the
certificate's expiry. The board's recovery check confirms that the LAN
resolver answers the proxy's address for the app names and that the proxy
serves a valid certificate, and a recovery exercise stops the resolver and
the proxy briefly to prove the checks notice. See
[ZimaBoard](/homelab/zimaboard/#how-traffic-gets-to-a-service) for where
this sits in the host's layout and [OPNsense](/homelab/opnsense/) for the
firewall side of the access lists.
