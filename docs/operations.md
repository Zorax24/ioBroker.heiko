# Installation And Operations

[English](operations.md) | [Deutsch](operations.de.md)

This guide covers installing and operating the private ioBroker adapter. Authorized GitHub users download the package from the private [`v0.13.0` release page](https://github.com/Zorax24/ioBroker.heiko/releases/tag/v0.13.0).

## Install The Local Release Package

Sign in to GitHub, open the release page when the release is available, and download `iobroker.heiko-0.13.0.tgz` to a local file. Do not place tokens or account credentials in commands, adapter settings, or support reports.

The tested local package route uses the ioBroker controller project directory and the package file in that directory:

```sh
npm install --omit=dev ./iobroker.heiko-0.13.0.tgz
iobroker add heiko --enabled false
```

The route was verified with `--offline`; the command above lets npm resolve uncached dependencies from its configured registry if needed, though that networked dependency fetch was not separately tested. The instance is added disabled. Before starting it, set and review the native listener configuration using the host's established ioBroker configuration procedure. The local QA used a loopback-only listener before start, then installed, started, and stopped the packed adapter. It did not test an Admin UI package-install workflow. See [validation](validation.md) for full environment and limits.

## Configure The W600 Bridge

Packaged defaults: bridge enabled, listener `0.0.0.0:8899`, upstream forwarding enabled to `www.myheatpump.com:18899`, local auto-ACK disabled, direct W600 writes disabled, raw-frame retention enabled, cloud API disabled, and cloud writes disabled.

The W600 is a TCP client and initiates a connection to the ioBroker listener. The adapter makes the outbound connection to the configured upstream. For a local-only test, bind to loopback. For an installation, review the intended local bind address and firewall before starting; do not expose the listener to the public internet. A documentation-only example is adapter `192.0.2.10:8899` and W600 `192.0.2.20`; these addresses are reserved for examples.

Allow only required paths: W600 to the adapter listener and, when forwarding is enabled, ioBroker host to `www.myheatpump.com` TCP port `18899`. When enabled, upstream forwarding relays bytes unchanged in both directions while decoding a passive copy, including manufacturer-originated CMD05 frames. `directWritesEnabled` and `cloudWritesEnabled` govern adapter-originated writes only; they do not filter forwarded traffic and are not firewall controls. If `autoAckWithoutUpstream=true`, valid CMD01/CMD02 frames receive local ACKs when the upstream is unavailable, whether it is deliberately disabled or disconnected. Local ACKs do not emulate cloud/app control. The local integration suite exercised bridge stream recovery and ACK behavior using loopback fixtures; it did not use a live upstream or physical W600.

## Instances And Sessions

Use one bridge instance per heat pump and a distinct listen port for every instance on the same host. Configure each W600 for its intended host/port. Multiple W600 clients may contribute telemetry to one instance namespace, but direct writes are accepted only with exactly one active W600 session; ambiguous sessions are rejected. After reconnect, the first valid unit frame refreshes direct-write readiness for the new session.

`bridge.activeClients`, `info.connection`, `info.bridgeListening`, `meta.last_seen`, and `bridge.upstreamConnected` report different parts of the path. A connected TCP socket does not itself prove fresh telemetry or a working upstream. Use [controls](controls.md) for direct/cloud write conditions.

## Backup, Update, Rollback, And Removal

Before updating:

1. Create a restorable ioBroker backup and record the `heiko` instance configuration.
2. Retain the previous adapter package and note the installed version.
3. When upgrading from before `0.12.0`, check scripts, aliases, history, and dashboards for legacy `parNN`/`parameters.*` IDs; the catalog uses descriptive `Einstellungen.*` IDs.
4. Install the authenticated release package and review the instance configuration before enabling it.

After an update, verify instance health, listener state, W600 connectivity, telemetry freshness, and upstream state separately. Review dependent scripts and controls before resuming automations.

For rollback, reinstall the retained adapter package using a tested local package procedure, restore the instance configuration if needed, restart, and check the same states. Upgrade from `0.12.3` and rollback were not exercised in this QA run; see [validation](validation.md).

Before removal, restore the W600/network path that preceded the local bridge if the heat pump depends on this adapter for its MyHeatPump connection. Then stop/disable the instance and check dependent scripts and object consumers before removing it. Removing a bridge that is still in the active path can interrupt telemetry and app access.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `info.bridgeListening` is false | Confirm the bridge is enabled, review host/port, check whether another service owns the port, and inspect the adapter error state. |
| Listener is up but `info.connection` is false | Confirm the W600 is a TCP client pointed at this instance's host/port and can reach it through routing/firewall. |
| `info.connection` is true but `meta.last_seen` is old | TCP connectivity is not fresh telemetry. Check controller reporting, `diagnostics.realtimeUpdates`, and timestamps. |
| `bridge.upstreamConnected` is false | Check `upstreamEnabled`, DNS/network access to `www.myheatpump.com:18899`, `bridge.lastUpstreamError`, and reconnect count. Local auto-ACK is off by default and does not restore cloud/app access. |
| Measurements are absent or null | `-99`, NaN, null, and non-finite values mean unavailable, not zero. Optional sensors are not present on every configuration. |
| `control.directWriteReady` is false | Check that direct writes are enabled, exactly one W600 session is active, and a valid frame context has arrived. After reconnect, readiness refreshes on the first valid unit frame. |
| Cloud writes are rejected | Check cloud API/write enablement, `control.deviceOnline`, selected device, and (when the W600 bridge is used) upstream connectivity. `control.available` alone does not prove the device is online. |
| One bridge works but another cannot listen | Assign distinct ports to the instances and point each W600 at its intended instance. |

`status.compressorDemand` is derived controller activity, not inverter-start authorization or relay feedback. `status.compressorRunning` reflects reported `realtime.Frequency > 0`. Neither is electrical proof or a safety/control-integrity check.

## Sanitized Diagnostics

For a support report, include only the adapter version, Node.js/js-controller/Admin versions, affected object IDs and boolean status, relative `meta.last_seen` age, and a redacted error category. Remove usernames, passwords, cloud tokens, device IDs, serials, MAC addresses, private hostnames/IPs, exact paths, raw hex, full logs, and household-identifying telemetry before sharing.

`retainRawFrames=false` suppresses raw frame and diagnostic payload fields, redacts raw/payload fields from write records, and clears retained frame/CMD05 history. Structured telemetry and operator-supplied `command.rawHex`/its result are outside that option and remain sensitive. Check exported diagnostics even when raw retention is disabled.
