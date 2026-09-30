[English](README.md) | [Deutsch](README.de.md)

# ioBroker.heiko

**Version: `0.13.1`**

ioBroker adapter for HEIKO heat pumps connected through a W600 TCP interface. This repository contains an ioBroker adapter only; it does not provide a Home Assistant integration.

This project was developed with AI assistance using a vibe-coding approach. See this documentation for completed tests, supported hardware, and known limitations.

The adapter accepts the W600's inbound TCP connection, can transparently forward its byte stream to the MyHeatPump device server, and decodes mapped telemetry into ioBroker states. Optional direct W600 controls and a separate MyHeatPump cloud API client are available. See [MAPPING.md](MAPPING.md) for protocol and state mappings.

## Features

- Read temperatures, compressor frequency, pump/fan status and the effective flow-temperature target directly in ioBroker.
- Switch power and operating mode and adjust heating, cooling and hot-water targets through the local W600 connection.
- Access 128 mapped settings with readable labels, documented ranges and readback-confirmed writes for writable parameters.
- Enable transparent bidirectional MyHeatPump forwarding or operate locally with configurable ACK handling.
- Monitor connections, reconnects and diagnostics without an additional container or MQTT bridge.

## Compatibility

Validated against the reported HEIKO THERMAL 12 installation using a W600. The exact controller/W600 firmware is unknown; compatibility with other models, firmware, or optional sensors is not claimed.

The adapter is in ongoing productive use on a HEIKO THERMAL 12 installation, including communication and heat-pump control. Software checks and live upgrade verification are documented in [validation](docs/validation.md).

## Quick Start

### Requirements

- Declared package floor: Node.js `>=20`; ioBroker metadata requires js-controller `>=6.0.11` and Admin `>=7.6.20`.
- ioBroker currently recommends Node.js 24 and npm 11; see [validation](docs/validation.md) for this release's test scope and limits.
- A controller/W600 that uses the documented frame format and a network path from the W600 to the ioBroker host. Sensor names identify protocol fields; they do not guarantee that every sensor is fitted or reported.
- If transparent forwarding is enabled, outbound TCP access from the ioBroker host to `www.myheatpump.com:18899`.

### Release Installation

Download `iobroker.heiko-0.13.1.tgz` and `SHA256SUMS` from the [`v0.13.1` release page](https://github.com/Zorax24/ioBroker.heiko/releases/tag/v0.13.1). Verify the checksum and keep the package as a local file in the ioBroker controller project directory. If GitHub requests sign-in, use an account with access to the repository. Never put tokens or account credentials in installation commands or diagnostics.

The tested local package route, from that controller directory, is:

```sh
npm install --omit=dev ./iobroker.heiko-0.13.1.tgz
iobroker add heiko --enabled false
```

The instance is created disabled; review its configuration before starting it. This release-package installation route was verified in a Debian 13 ioBroker environment. See [validation](docs/validation.md) for completed software and live checks, and [GitHub Actions](https://github.com/Zorax24/ioBroker.heiko/actions) for automated results.

## Connect The Heat Pump

1. Open the HEIKO instance configuration in ioBroker Admin. Choose a free TCP listener port (default `8899`) and decide whether to forward to MyHeatPump.
2. Save the W600's previous destination. Point its existing TCP client connection at your ioBroker host's reachable LAN/VPN address and the configured listener port.
3. Start the instance and wait for fresh measurements and settings. Check the connection and data timestamps before enabling direct writes.

The W600 initiates the connection. `0.0.0.0` is a listener bind address, never the W600 destination. ioBroker Admin's web port is a separate service. Do not expose the W600 listener to the internet.

Packaged defaults:

| Setting | Default | Meaning |
| --- | --- | --- |
| W600 bridge | Enabled | Accepts the W600's inbound TCP client connection |
| Listen address / port | `0.0.0.0:8899` | Adapter listener on the ioBroker host |
| Upstream forwarding | Enabled | Forwards to `www.myheatpump.com:18899` |
| `autoAckWithoutUpstream` | `false` | No local ACK unless explicitly opted in |
| `retainRawFrames` | `true` | Retains frame payloads in states and diagnostics |
| Direct W600 writes | Disabled | No adapter-originated W600 controls by default |
| MyHeatPump cloud API / cloud writes | Disabled / disabled | Separate API client and write permission are opt-in |

Before the first start, review the bind address and firewall. For a local-only test, use a loopback listener; for a real W600, allow only the required local network path and do not expose the listener to the public internet. The W600 acts as a TCP client and initiates the connection to the adapter. For example, `192.0.2.20` connecting to `192.0.2.10:8899` is documentation-only; `192.0.2.0/24` is reserved for examples.

After starting, check `info.bridgeListening`. Once the W600 connects, check `info.connection`, `bridge.activeClients`, `meta.last_seen` and, when forwarding is enabled, `bridge.upstreamConnected`. A socket connection alone does not establish that fresh telemetry is arriving. See [operations and troubleshooting](docs/operations.md).

## Manufacturer Forwarding

```text
W600 TCP client -> ioBroker.heiko listener -> MyHeatPump device server
                         |                    www.myheatpump.com:18899
                         +-> passive frame decoding into ioBroker states
```

Configure forwarding in the instance settings:

- **On (`upstreamEnabled=true`):** relay the full W600 TCP stream to MyHeatPump and relay responses back. This includes device identifiers, measurements, operating states and settings. Manufacturer-originated commands may change the heat pump. The TCP relay is not encrypted by the adapter.
- **Off (`upstreamEnabled=false`):** do not open a manufacturer connection. Local decoding and enabled direct controls remain available. For local acknowledgements of valid CMD01/CMD02 frames, explicitly enable `autoAckWithoutUpstream`. Local ACKs do not emulate cloud/app access or delete data already held by the manufacturer.

The adapter forwards bytes unchanged while decoding a passive copy. `directWritesEnabled` and `cloudWritesEnabled` govern adapter-originated writes only; they do not filter forwarded manufacturer commands and are not firewall rules. The separate cloud API client is optional and is not required for the TCP relay or local W600 controls.

Use one adapter bridge instance per heat pump. Each bridge instance needs a unique listen port. Telemetry from multiple W600 clients shares the instance's ioBroker object namespace; direct writes require exactly one active W600 session and are rejected when the session is ambiguous. After reconnect, the first valid unit frame refreshes direct-write readiness for the new session.

## Daily Use And States

Everyday controls are `control.power`, `control.mode`, `control.heatingSetpoint`, `control.coolingSetpoint` and `control.hotWaterSetpoint`. Enable direct W600 writes deliberately in the instance settings and check `control.directWriteReady` before using them. Writes are serialized and reported successful only after fresh matching settings readback; inspect the current value after a timeout before retrying.

With a heating curve, read `status.effectiveFlowSetpoint` for the effective flow target. `control.heatingSetpoint` is the fixed heating target used without the curve.

- `status.*`: operating mode/activity, reported compressor/fan/pump states, flow switch, defrost, and effective flow target.
- `realtime.*`: mapped measurements and `realtime.rawJson` for CMD01 values.
- `settings.*`: compact confirmed CMD02 values; `settings.rawJson` retains wire values.
- `Einstellungen.*`: 128 named settings-page fields mapped to CMD02; 125 are writable subject to catalog constraints and explicit write enablement.
- `bridge.*`, `meta.*`, `frames.*`, `diagnostics.*`: connection, freshness, frame, and protocol diagnostics.
- `control.*`, `writes.*`, `command.*`: control readiness/results, write records, and protocol commands.

`status.compressorDemand` is derived from a non-zero controller function code. It is an activity indication, not inverter-start authorization or relay feedback. `status.compressorRunning` separately reflects reported `realtime.Frequency > 0`; neither state proves electrical output or physical motor rotation. Unavailable values such as `-99`, NaN, or non-finite values are not zero readings.

Direct writes are disabled by default. The full settings catalog also contains service and protection parameters affecting pumps, valves, frost protection, auxiliary heaters and anti-legionella functions. Change those only with device-specific knowledge or qualified technical support. See [controls](docs/controls.md) for mode values, ranges and confirmation rules.

## Updates, Backup And Removal

Use state IDs rather than display labels in scripts and visualizations. IDs are stable across the documented catalog comparison; since `0.12.0`, descriptive German parameter IDs replaced older `parNN` object IDs. Check legacy scripts, aliases, history, and dashboards when upgrading from an older version. See [MAPPING.md](MAPPING.md).

Before update or removal, back up ioBroker and record the instance configuration. For rollback, retain the previous adapter package and verify connection and telemetry freshness after restoring it. The `0.12.3` to `0.13.1` update and passive acceptance are recorded in [validation](docs/validation.md); no controls were actuated and rollback was not tested. Before removing an active bridge, restore the W600's previous network route if it depended on this adapter.

## Troubleshooting And Support

| Symptom | Check |
| --- | --- |
| No W600 connection | TCP client destination, reachable LAN/VPN route, listener port and firewall. |
| Listener cannot start | Port already occupied or bind address missing on the ioBroker host. |
| Connection but no current data | `meta.last_seen`, `meta.last_setparams` and receive/update counters; a socket alone does not prove fresh telemetry. |
| Cloud forwarding unavailable | Forwarding setting, DNS and outbound access to `www.myheatpump.com:18899`. |
| Write rejected or unconfirmed | Write enablement, `control.directWriteReady`, reported range and fresh readback; do not retry blindly. |

More checks and recovery steps: [operations](docs/operations.md). Report reproducible issues through [GitHub Issues](https://github.com/Zorax24/ioBroker.heiko/issues) with sanitized diagnostics.

## Privacy And Diagnostics

Raw frames are retained by default. `retainRawFrames=false` suppresses raw frame/diagnostic payloads and write-log raw fields and clears retained frame/CMD05 history. It does not erase structured telemetry or operator-supplied `command.rawHex` and its result. Treat states and logs as sensitive; sanitize device identifiers, host details, raw data, and household telemetry before sharing.

## Documentation

- [Installation, operations, backup, and rollback](docs/operations.md)
- [Controls and state semantics](docs/controls.md)
- [Protocol and state mapping](MAPPING.md)
- [Validation scope and evidence](docs/validation.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

The adapter source retains its existing MIT license and required copyright notice; see [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The project-owner-supplied AI-generated icon and short manufacturer option labels are included for this adapter, but their provenance and rights have not been independently cleared. Manufacturer names and protocol constants identify interoperability targets and do not imply endorsement. The adapter's MIT license does not grant unrestricted reuse rights to third-party artwork, names, or marks.
