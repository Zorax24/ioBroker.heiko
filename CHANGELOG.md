# Changelog

## 0.13.0

- Prepare a private distribution with English and German documentation and stable existing state IDs and configuration keys.
- Add translated object labels and clearer configuration help.
- Reject corrupt frames for telemetry and write confirmation while preserving transparent forwarding.
- Keep local telemetry available during upstream outages and improve configuration, lifecycle and command validation.
- Wait for startup initialization during early shutdown and avoid starting listeners after shutdown begins.
- Refresh direct-write readiness after the first valid device frame, including reconnection.
- Serialize direct and cloud commands and require fresh, same-session readback for direct writes.
- Reject mixed-device cached frames and suppress raw command history when raw retention is disabled.
- Add isolated simulated integration checks and a limited installation-package file selection.
- Make cross-platform test checkouts deterministic and remove an undeclared release-tool command.

## 0.12.3

- Republish the updated adapter icon as a fresh installable update.

## 0.12.2

- Replace the adapter icon with the supplied transparent heat-pump and wireless-module artwork.

## 0.12.1

- Expose the currently effective heating/cooling flow target from confirmed CMD01 `par36` as `status.effectiveFlowSetpoint`.
- Expose the confirmed heating-curve enable state as `status.heatingCurveActive`.
- Clarify that writable `control.heatingSetpoint` is the fixed flow target used only without the heating curve.

## 0.12.0

- Replace technical `parameters.*.parNNN` object IDs with descriptive German IDs under `Einstellungen.*`.
- Correct capitalization, spelling, umlauts and mixed English/German labels for all 128 confirmed parameters and their selections.
- Migrate acknowledged values and remove the obsolete `parNNN` object tree automatically.

## 0.11.1

- Bundle the generated parameter catalog as compiled JavaScript so production installations start without an external source JSON file.

## 0.11.0

- Add 128 named expert parameters verified by matching the official MyHeatPump settings form against live CMD02 values.
- Make 125 confirmed settings directly writable with official options and limits, explicit adapter permission and mandatory exact CMD02 readback.
- Keep software, database and outdoor-PCB EEPROM versions read-only and exclude the conflicting or unnamed page fields.
- Add cloud-free direct hot-water target control through confirmed CMD05 parameter 54.
- Align the direct heating target with the official `par38` whole-degree range.

## 0.10.2

- Allow integer direct cooling targets from 16 through 24 °C for weather-dependent cooling control.
- Keep exact fresh CMD02 readback mandatory, including for the extended 22 through 24 °C range.
- Publish the extended limit through `control.coolingSetpoint` metadata.

## 0.10.1

- Report `control.mode` commands with the public ioBroker mode value.
- Retain the translated W600 device value separately in `writes.last`.

## 0.10.0

- Add cloud-free direct W600 writes for `control.mode` and `control.heatingSetpoint`.
- Translate the existing ioBroker mode values to the confirmed CMD02 device-mode values.
- Publish current mode and heating target from fresh CMD02 settings even when cloud control is disabled.
- Keep combined heating/DHW and cooling/DHW modes on the cloud path until their additional parameters are confirmed.
- Require matching CMD02 readback for every new direct command.

## 0.9.0

- Add optional cloud-free direct W600 writes for `control.power` and `control.coolingSetpoint`.
- Build CMD `0x05` payloads as the live-confirmed little-endian parameter index plus Float32 value.
- Match exact captured frames for parameter 0 power off/on and parameter 22 cooling targets in protocol tests.
- Treat a direct write as successful only after a CMD `0x02` settings frame reports the requested value.
- Expose `settings.constantCoolingTarget`, direct-write readiness, selected transport and confirmed direct controls.
- Keep mode, heating target and hot-water target on the cloud path until corresponding direct frames are captured.

## 0.8.1

- Write initialized cloud-control indicators explicitly so ioBroker clears placeholder quality `q=32` even when the boolean value remains unchanged.

## 0.8.0

- Keep the confirmed control surface limited to official MyHeatPump power, product modes and heating, cooling and hot-water setpoints.
- Select the cloud device automatically with the MAC learned from the live W600 connection when no selector is configured.
- Add `control.writeReady` so automations can require the complete authenticated, mapped, online and connected write path.
- Apply product-specific mode choices and setpoint limits to the writable ioBroker objects.
- Clear stale control values whenever cloud control is disabled or synchronization fails.
- Persist a bounded history and total count of genuine CRC-valid cloud-to-unit CMD `0x05` frames without replaying them.

## 0.7.1

- Write final bridge states in parallel during shutdown so ioBroker updates and restarts do not exceed the stop timeout.

## 0.7.0

- Match an official MyHeatPump realtime screenshot to the same live CMD01 frame and promote only exact value/position correlations.
- Add P0 PWM voltage, mixer-valve outputs, flow-switch and defrost states.
- Split outdoor fan telemetry into confirmed `Fan1` and `Fan2` values and matching running states.
- Add confirmed P0, P1 and P2 pump states.
- Add calculated compressor speed as a separate non-Hz value plus suction and discharge superheat.
- Add official AH, HBH and HWTBH runtime counters.
- Keep external demand/lock signals and zero-only power, flow, COP and capacity fields unassigned until their wire positions are proven.

## 0.6.2

- Serialize final bridge state updates during adapter shutdown.
- Prevent asynchronous session cleanup from writing after the ioBroker state database has closed.

## 0.6.1

- Delete orphaned state values together with every obsolete telemetry object during migration.
- Replace the remaining legacy `sniffer.status` object with the correctly grouped `bridge.status` state.

## 0.6.0

- Rebuild CMD01 telemetry from live standby, heating and cooling traces and expose only confirmed semantic values.
- Correct `par06` to Tup, and confirm EEV position, high/low pressure, suction and outdoor-coil temperatures, fan speed, current draw and P0 operation.
- Add separate active-function, compressor-demand, compressor-running, fan-running and P0-running states.
- Remove the invalid interpretation of the always-zero CMD01 prefix as Modbus registers 500 and 542-545, including all derived fault and process-bit objects.
- Remove individual unknown/dead CMD01 and CMD02 objects; preserve complete wire data in `realtime.rawJson` and `settings.rawJson`.
- Expose only live-confirmed system, mode, function-enable, heating-curve and constant-heating-target settings.
- Remove unavailable sensor objects such as Tw and Tv2 while their value is `-99`/`NaN`, and recreate them automatically when valid data appears.

## 0.5.2

- Add `command.republishCachedData` to validate and resend the latest genuine CMD01 realtime and CMD02 settings frames through the active transparent MyHeatPump connection.
- Reject missing, malformed, wrong-direction, wrong-command, CRC-invalid or wrong-device cached frames before any cloud transmission.
- Keep local CMD05 generation blocked and do not alter cached device bytes during replay.

## 0.5.1

- Correct the HEIKO-documented W600 device server to `www.myheatpump.com:18899`.
- Keep the TCP bridge byte-transparent in both directions and expose separate forwarded-byte and last-forward timestamps.
- Pause and backpressure the W600 stream during upstream connection setup/reconnect so no early bytes are dropped; never synthesize ACKs while transparent cloud forwarding is enabled.
- Reconnect the cloud upstream automatically while the W600 connection remains active.
- Decode and CRC-check both captured wire formats: `AA55` from unit to cloud and `55AA` from cloud to unit.
- Generate local read/ACK commands in the live-confirmed server-to-unit format and use the captured broadcast context for CMD `0x06` and `0x07`.
- Clarify that `meta.mn_number` is the W600 module MAC; do not ship one installation's MAC as a package default.

## 0.5.0

- Add optional MyHeatPump cloud login and automatic device, product-model and remote-control data-item discovery.
- Add confirmed writable states for heat-pump power, operating mode, heating target, cooling target and domestic-hot-water target.
- Validate official mode values and product-specific temperature limits, serialize commands and wait for the cloud result.
- Keep cloud writes disabled by default and reject writes while the device is offline or the locally connected W600 has no working cloud upstream.
- Store the MyHeatPump password as protected encrypted native configuration and log every cloud write attempt without credentials or tokens.
- Continue to block guessed local CMD `0x05` frames; forwarded genuine write frames remain captured for future verified local control.

## 0.4.0

- Decode the five documented 16-bit words in the ten-byte CMD01 prefix as registers 500 and 542 through 545.
- Add `status.compressorDemand` from register 500 process bits and `status.compressorRunning` from the verified compressor frequency.
- Expose every documented operating, protection and fault bit, including P07, P10, E02-E08, S02, S03, S09 and S10.
- Add raw register values, `faults.anyActive`, `faults.activeCodes` and structured status JSON.
- Clarify that `info.connection` represents the W600 TCP socket and does not by itself prove fresh controller telemetry.

## 0.3.1

- Clear stale realtime and settings values once when migrating to the corrected protocol mapping schema.
- Keep values empty until a fresh CMD01/CMD02 frame arrives instead of displaying data from the former wrong mapping.

## 0.3.0

- Rebuilt the complete CMD `0x01` layout around stable raw positions `par01` through `par43`.
- Corrected the verified positions for Tuo, Tui, heating target, Tw, heating water, Tv1, Tv2, Tr, compressor frequency, Ta, Td, voltage, manual heating target and runtime counters.
- Removed misleading semantic states for fan, P0/P1/P2, current, pressure and valve opening because these values are not present at the formerly assigned positions.
- Added mapping confidence, protocol position and a technical description to every realtime and settings object.
- Added evidenced labels for the heating-curve and manual setpoint settings while retaining all unverified CMD `0x02` values under their stable `setting_000` through `setting_137` IDs.

## 0.2.7

- Reworked the adapter icon as a direct front view of a heat-pump outdoor unit.

## 0.2.6

- Updated the adapter icon to a clearer heat-pump outdoor-unit symbol.

## 0.2.5

- Restored `info.connection` to mean an active W600 heat-pump connection.
- Kept TCP listener readiness separately in `info.bridgeListening`.
- Documented that the instance can listen while the heat pump is disconnected.

## 0.2.4

- Added this packaged update protocol for ioBroker update visibility.
- Added a concrete adapter configuration guide to the README.
- Documented the recommended direct-bridge setup without the old sniffer container.

## 0.2.3

- Added listener-oriented status handling.
- This was corrected in `0.2.5` so `info.connection` again reflects the W600 client connection.

## 0.2.2

- Cleaned up remaining legacy configuration labels.
- Removed references to the old external command path.

## 0.2.1

- Removed the legacy external ingest path completely.
- Removed the old external ingest dependency, Admin config fields and native config keys.

## 0.2.0

- Moved the W600 TCP bridge into the adapter.
- Added direct frame parsing and direct ioBroker state updates.
- Added optional upstream forwarding to `myheatpump.com:8899`.

## 0.1.2

- Pointed local repository metadata to locally hosted README and icon assets.
