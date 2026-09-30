[English](README.md) | [Deutsch](README.de.md)

# ioBroker.heiko

**Version: `0.13.0`**

Private ioBroker adapter for the W600 TCP format reported for a historical HEIKO THERMAL 12 installation. The controller/W600 firmware is not established, and compatibility with other models, firmware, or optional sensors is not verified. This repository contains an ioBroker adapter only; it does not provide a Home Assistant integration.

This project was developed with AI assistance using a vibe-coding approach. See this documentation for completed tests, supported hardware, and known limitations.

The adapter accepts the W600's inbound TCP connection, can transparently forward its byte stream to the MyHeatPump device server, and decodes mapped telemetry into ioBroker states. Optional direct W600 controls and a separate MyHeatPump cloud API client are available. See [MAPPING.md](MAPPING.md) for protocol and state mappings.

## Quick Start

### Requirements

- Declared package floor: Node.js `>=20`; ioBroker metadata requires js-controller `>=6.0.11` and Admin `>=7.6.20`.
- ioBroker currently recommends Node.js 24 and npm 11. The completed local QA used Node.js `24.15.0`, npm `11.12.1`, and js-controller `7.2.2`; see [validation](docs/validation.md) for what was and was not tested.
- A controller/W600 that uses the documented frame format and a network path from the W600 to the ioBroker host. Sensor names identify protocol fields; they do not guarantee that every sensor is fitted or reported.
- If transparent forwarding is enabled, outbound TCP access from the ioBroker host to `www.myheatpump.com:18899`.

### Private release installation

Authorized GitHub users can download `iobroker.heiko-0.13.0.tgz` from the private [`v0.13.0` release page](https://github.com/Zorax24/ioBroker.heiko/releases/tag/v0.13.0). Save it as a local file in the ioBroker controller project directory. Do not use an unauthenticated download URL or put tokens or account credentials in commands or diagnostics.

The tested local package route, from that controller directory, is:

```sh
npm install --omit=dev ./iobroker.heiko-0.13.0.tgz
iobroker add heiko --enabled false
```

The local `.tgz` route was verified with `--offline`; the command above lets npm resolve uncached dependencies through its configured registry if needed. Networked dependency resolution was not separately exercised. The instance is created disabled; review its native configuration before starting it. The full local QA result and its scope are summarized in [validation](docs/validation.md). The private CI workflow's per-commit results are shown in [GitHub Actions](https://github.com/Zorax24/ioBroker.heiko/actions); the matrix definition is not evidence that every job has passed.

### First configuration

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

## Bridge And Data Flow

```text
W600 TCP client -> ioBroker.heiko listener -> MyHeatPump device server
                         |                    www.myheatpump.com:18899
                         +-> passive frame decoding into ioBroker states
```

When `upstreamEnabled` is true, byte chunks are forwarded unchanged in both directions while a passive copy is decoded for ioBroker. This includes manufacturer-originated CMD05 frames: `directWritesEnabled` and `cloudWritesEnabled` govern only writes initiated by the adapter; they do not filter forwarded traffic and are not firewall controls. `autoAckWithoutUpstream` defaults to false. If explicitly enabled, valid CMD01/CMD02 frames are acknowledged locally while the upstream is unavailable, whether forwarding is deliberately disabled or the connection is down. Local ACKs are not a cloud/app emulator. The behavior was exercised by the local integration suite with simulated endpoints; it has not been validated against a live service or heat pump.

Use one adapter bridge instance per heat pump. Each bridge instance needs a unique listen port. Telemetry from multiple W600 clients shares the instance's ioBroker object namespace; direct writes require exactly one active W600 session and are rejected when the session is ambiguous. After reconnect, the first valid unit frame refreshes direct-write readiness for the new session.

## States And Controls

- `status.*`: operating mode/activity, reported compressor/fan/pump states, flow switch, defrost, and effective flow target.
- `realtime.*`: mapped measurements and `realtime.rawJson` for CMD01 values.
- `settings.*`: compact confirmed CMD02 values; `settings.rawJson` retains wire values.
- `Einstellungen.*`: 128 named settings-page fields mapped to CMD02; 125 are writable subject to catalog constraints and explicit write enablement.
- `bridge.*`, `meta.*`, `frames.*`, `diagnostics.*`: connection, freshness, frame, and protocol diagnostics.
- `control.*`, `writes.*`, `command.*`: control readiness/results, write records, and protocol commands.

`status.compressorDemand` is derived from a non-zero controller function code. It is an activity indication, not inverter-start authorization or relay feedback. `status.compressorRunning` separately reflects reported `realtime.Frequency > 0`; neither state proves electrical output or physical motor rotation. Unavailable values such as `-99`, NaN, or non-finite values are not zero readings.

Direct controls and expert parameter writes are disabled by default. The supported direct values, ranges, confirmation rules, cached-data command requirements, and limitations are described in [controls](docs/controls.md). Software tests do not establish safe operation on a particular installation. Do not enable writes without device-specific review and appropriate safeguards.

## IDs, Instances, And Maintenance

Use state IDs rather than display labels in scripts and visualizations. IDs are stable across the documented catalog comparison; since `0.12.0`, descriptive German parameter IDs replaced older `parNN` object IDs. Check legacy scripts, aliases, history, and dashboards when upgrading from an older version. See [MAPPING.md](MAPPING.md).

Before update or removal, back up ioBroker and record the instance configuration. For rollback, retain the previous adapter package and verify connection and telemetry freshness after restoring it. Upgrade from the installed `0.12.3` package and rollback were not part of this QA run. Before removing an active bridge, restore the W600's previous network route if it depended on this adapter. More detail: [operations](docs/operations.md).

## Privacy And Diagnostics

Raw frames are retained by default. `retainRawFrames=false` suppresses raw frame/diagnostic payloads and write-log raw fields and clears retained frame/CMD05 history. It does not erase structured telemetry or operator-supplied `command.rawHex` and its result. Treat states and logs as sensitive; sanitize device identifiers, host details, raw data, and household telemetry before sharing.

## License

The adapter source retains its existing MIT license and required copyright notice; see [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The project-owner-supplied AI-generated icon and short manufacturer option labels are included for this adapter, but their provenance and rights have not been independently cleared. Manufacturer names and protocol constants identify interoperability targets and do not imply endorsement. The adapter's MIT license does not grant unrestricted reuse rights to third-party artwork, names, or marks.
