# Controls And State Semantics

[English](controls.md) | [Deutsch](controls.de.md)

This page describes the adapter's ioBroker controls. Writes can change real heat-pump operation. The adapter is not a safety controller; the passive live connection/readout check does not validate actuation or safety on a particular installation.

## Readiness And Status

- `control.directWriteReady`: direct writing is enabled, exactly one W600 session is active, and a valid frame context is available. After reconnect, the first valid unit frame refreshes readiness for the new session.
- `control.writeReady`: at least one configured write path is ready; inspect the path-specific state before writing.
- `control.cloudConnected`: cloud authentication/synchronization completed.
- `control.deviceOnline`: online status reported by the cloud. Cloud writes require this value to be explicitly true.
- `control.available`: cloud control mapping is available; it can be true while online status is unknown and is not proof that the device is online.
- `control.lastCommand`, `control.lastResult`, `control.lastError`, and `writes.last`: latest command and reported outcome.

These are software states and reported responses, not proof of physical actuation. `status.compressorDemand` is derived from a non-zero controller function code; it is an activity indication, not inverter-start authorization or relay feedback. `status.compressorRunning` separately reflects reported `realtime.Frequency > 0`; neither state proves electrical output or motor rotation.

## Direct W600 Controls

`directWritesEnabled` defaults to false. A direct write requires an active W600 connection, exactly one active W600 session, and a frame context for that session. Multiple clients may share telemetry in the instance namespace, but direct writes are rejected when the session is ambiguous. Use one adapter instance per heat pump. This option, like `cloudWritesEnabled`, applies only to writes initiated by the adapter; it does not block manufacturer-originated CMD05 frames transparently forwarded through the bridge and is not a firewall or transport filter.

| State | Accepted values | CMD05 parameter | Confirmation |
| --- | --- | ---: | --- |
| `control.power` | Boolean `false` / `true` | `0` | Matching CMD02 setting index 0 |
| `control.mode` | 0 standby, 1 hot water, 2 heating, 3 cooling, 4 automatic | `3` | CMD02 setting index 3 maps back to requested mode |
| `control.coolingSetpoint` | Integer `16`-`24 °C` | `22` | Exact fresh CMD02 value |
| `control.heatingSetpoint` | Integer `20`-`60 °C` | `37` | Matching CMD02 value |
| `control.hotWaterSetpoint` | Integer `25`-`75 °C` | `54` | Matching CMD02 value |

Direct public modes map to the device protocol as follows: 0 standby, 1 hot water, 2 heating, 3 cooling, 4 automatic. Combined modes 5 and 6 are not supported by the direct path. Cooling values 16-21 °C were observed in official-app traffic; 22-24 °C are an adapter-accepted extension and require exact CMD02 readback. The fixed heating target applies when the heating curve is inactive. With the curve active, read `status.effectiveFlowSetpoint` or compatible alias `realtime.Setpoint`; `control.heatingSetpoint` is not the live curve-derived target.

A direct write is confirmed only by a complete, CRC-valid CMD02 value matching the request on the same W600 session after the write. Partial frames, a CMD02 frame received before the write, a different session, or an invalid-CRC frame cannot confirm it. The local integration suite exercised these sequence and CRC conditions using simulated endpoints. This confirms protocol-level readback handling, not physical actuation.

## Expert Parameter Controls

`Einstellungen.*` maps 128 named settings-page fields to CMD02 positions; 125 are writable, while `par2`, `par3`, and `par138` are read-only version fields. The catalog validates each write's numeric minimum/maximum, integer requirement, boolean value, or select option before creating CMD05.

Expert writes use a six-byte parameter payload (`uint16le(index)` followed by `float32le(value)`) and wait up to 12 seconds for a matching CMD02 readback on the same session. Use exact `Einstellungen.*` object paths from the object tree or [MAPPING.md](../MAPPING.md). Do not guess `parN` IDs, bypass catalog constraints with raw hex, or copy limits from another model/controller. Unmatched and unnamed fields remain non-writable.

Both direct and expert writes are disabled by default. Their local protocol behavior was covered by software integration tests; operation on a particular heat pump has not been physically tested. Review the target device, value, mode, fresh readback, and independent safeguards before enabling them.

## Optional Cloud API

Cloud control is separate from transparent W600 forwarding:

- `cloudControlEnabled` defaults to false. When enabled, the adapter authenticates and periodically discovers account devices and controls.
- `cloudWritesEnabled` separately defaults to false. The client uses discovered mode options and device-specific limits where supplied; there is no universal hard-coded cloud temperature range.
- Cloud writes require `control.deviceOnline === true`. `control.available` alone is insufficient when online state is unknown. If the W600 bridge is enabled, cloud writes also require its upstream connection.
- The online-state write gate does not disable cloud reads.
- Cloud command success reflects the API response followed by a state refresh attempt; it does not confirm physical actuation.

Cloud reads and write-gate behavior were tested against local synthetic responses. No live cloud account/service was used for release QA.

| Region | HTTPS service | Default tenant |
| --- | --- | --- |
| EU | `https://eu.myheatpump.com:8443` | `euheatpump` |
| NA | `https://usa.myheatpump.com:8443` | `usaheatpump` |
| CN | `https://amitime.anylink.io:8443` | `amitime` |

The default refresh interval is 60 seconds and is clamped to 15-3600 seconds. Never include account credentials, tokens, device identifiers, or serial numbers in diagnostics.

## Protocol Commands And Cached Data

| State | Command | Function |
| --- | ---: | --- |
| `command.ackRealtime` | `0x03` | Acknowledge CMD01 realtime data |
| `command.ackSetparams` | `0x04` | Acknowledge CMD02 settings data |
| `command.requestRealtime` | `0x06` | Request realtime data |
| `command.requestSetparams` | `0x07` | Request settings data |
| `command.reserved08` | `0x08` | Reserved; semantics not asserted |
| `command.reserved09` | `0x09` | Reserved; semantics not asserted |
| `command.republishCachedData` | - | Republish cached CMD01 and CMD02 frames to MyHeatPump |

`command.republishCachedData` reads retained `frames.cmd_01` and `frames.cmd_02`; it requires `retainRawFrames=true`, complete CRC-valid cached frames, exactly one active W600 session, an active upstream, and a matching current module context. The frames may be old and do not represent a fresh sample. The command cannot work while raw-frame retention is disabled.

`allowRawHexControl` defaults to false. Do not enable or send raw frames without independently confirmed protocol evidence. Operator-supplied `command.rawHex` and its result are separate from passive frame retention and remain sensitive even when `retainRawFrames=false`.

`upstreamEnabled` defaults to true and `autoAckWithoutUpstream` to false. With auto-ACK explicitly enabled, valid CMD01/CMD02 frames are acknowledged locally when the upstream is unavailable, including deliberate disablement and outage. The local tests also cover bridge stream pause/resume and recovery. These ACKs do not provide MyHeatPump cloud/app control.

Adapter-generated validation messages are bilingual. Operating-system and vendor/cloud error details are preserved verbatim and may remain in their original language.
