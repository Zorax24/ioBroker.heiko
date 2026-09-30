# HEIKO W600 protocol and state mapping

This document describes the implementation in this ioBroker adapter. It is not a Home Assistant specification.

## Scope And Evidence

The adapter documents the W600 TCP frame format reported for a historical HEIKO THERMAL 12 installation. The exact controller/W600 firmware is not established, and this is not a verified compatibility matrix for other models, firmware, or optional sensors. The default device-server endpoint is `www.myheatpump.com:18899`.

The mapping was derived from adapter source definitions, an official MyHeatPump settings form, and historical hardware observations. The historical record included passive W600 frames and display comparisons across inactive, heating, and cooling operation. It is not evidence that hardware is currently connected or that release `0.13.0` has been physically validated. Exact installation IPs, MAC addresses, serials, timestamps, measured values and logs have been removed from this sanitized copy.

For `0.13.0`, the local integration suite passed against simulated loopback endpoints; it did not exercise a physical heat pump or live cloud service. See [docs/validation.md](docs/validation.md) for the runtime, test counts, audit scope, and limits. Source pointers: [frame protocol](src/lib/protocol.ts), [adapter implementation](src/main.ts), [parameter catalog](src/lib/parameter-catalog-data.ts), and [object definitions](src/lib/definition.ts).

## Frame Format

| Direction | Header | CRC initial value | Purpose |
| --- | --- | ---: | --- |
| Unit/W600 to upstream | `AA55` | `0x40FD` | Telemetry and device frames |
| Upstream to unit, including adapter-originated frames | `55AA` | `0xBF02` | Cloud commands, ACK/request frames and direct parameter writes |

Frames use a little-endian 16-bit length at byte offset 10, followed by a command byte, payload, little-endian CRC16 and end byte `0x3A`. The CRC calculation uses the direction-specific initial value above.

- CMD `0x01`: ten prefix bytes followed by 43 little-endian Float32 values. The first float begins at payload offset 10.
- CMD `0x02`: two prefix bytes followed by 138 little-endian Float32 values. The first float begins at payload offset 2.
- Unavailable values `-99`, NaN, and non-finite numbers normalize to null. They are not converted to zero.
- CMD `0x05` direct parameter payload: `uint16le(parameterIndex) + float32le(value)` (six bytes).
- Adapter-generated ACK/request frames include CMD `0x03` ACK realtime, `0x04` ACK settings, `0x06` request realtime, and `0x07` request settings. Reserved CMD `0x08` and `0x09` are exposed as commands but their behavior is not described as a confirmed device function.

## Confirmed CMD01 Values

The `parNN` labels below refer to the protocol/form field names. They are not private device identifiers.

| Protocol field | ioBroker state | Meaning | Unit |
| --- | --- | --- | --- |
| `par01` | `status.activeFunctionCode` | Function code: 0 inactive, 2 heating, 3 cooling | - |
| `par04` | `realtime.Tuo` | Heat-pump water outlet / flow temperature | °C |
| `par05` | `realtime.Tui` | Heat-pump water inlet / return temperature | °C |
| `par06` | `realtime.Tup` | Plate heat-exchanger / liquid-line temperature | °C |
| `par07` | `realtime.Tw` | Domestic hot-water temperature; state appears only when available | °C |
| `par08` | `realtime.Tc` | Heating/cooling water or buffer control temperature | °C |
| `par09` | `realtime.Tv1` | Mixer circuit 1 temperature | °C |
| `par10` | `realtime.Tv2` | Mixer circuit 2 temperature; state appears only when available | °C |
| `par11` | `realtime.Tr` | Room sensor temperature | °C |
| `par12` | `realtime.P0Pwm` | P0 circulation-pump PWM signal | V |
| `par13` | `realtime.mixerValve1Signal` | Mixer-valve output 1 | V |
| `par14` | `realtime.mixerValve2Signal` | Mixer-valve output 2 | V |
| `par15` | `status.flowSwitchActive` | Flow-switch state | boolean |
| `par20` | `realtime.Frequency` | Actual compressor frequency | Hz |
| `par21` | `realtime.ValveOp` | Electronic expansion-valve position | steps |
| `par22` | `realtime.Pd` | High/condensing pressure | bar |
| `par23` | `realtime.Ps` | Low/suction pressure | bar |
| `par24` | `realtime.Ta` | Outdoor temperature | °C |
| `par25` | `realtime.Td` | Compressor discharge-gas temperature | °C |
| `par26` | `realtime.Ts` | Compressor suction-gas temperature | °C |
| `par27` | `realtime.Tp` | Outdoor heat-exchanger temperature | °C |
| `par28` | `realtime.Fan1` | Outdoor fan 1 speed | rpm |
| `par29` | `realtime.Fan2` | Outdoor fan 2 speed | rpm |
| `par30` | `realtime.Current` | Electrical current | A |
| `par31` | `realtime.Voltage` | Supply/inverter voltage | V |
| `par32` | `status.defrostActive` | Defrost state | boolean |
| `par33` | `status.pumpP0Running` | Pump P0 state | boolean |
| `par34` | `status.pumpP1Running` | Pump P1 state | boolean |
| `par35` | `status.pumpP2Running` | Pump P2 state | boolean |
| `par36` | `realtime.Setpoint`, `status.effectiveFlowSetpoint` | Currently effective heating/cooling flow target; calculated while the heating curve is active | °C |
| `par37` | `realtime.softwareVersion` | Numeric controller software version | - |
| `par38` | `realtime.calculatedCompressorSpeed` | Calculated compressor-speed value; not frequency in Hz | - |
| `par39` | `realtime.suctionSuperheat` | Suction superheat | K |
| `par40` | `realtime.dischargeSuperheat` | Discharge superheat | K |
| `par41` | `realtime.auxiliaryHeaterRuntime` | Auxiliary-heater runtime | min |
| `par42` | `realtime.heatingBackupHeaterRuntime` | Heating backup-heat-source runtime | min |
| `par43` | `realtime.dhwBackupHeaterRuntime` | Domestic-hot-water backup-heat-source runtime | min |

`status.compressorDemand` is derived from `par01 != 0`. It represents a non-zero controller activity/function code; it is not physical inverter-start authorization, a start relay state, or relay feedback. `status.compressorRunning` is separately derived from the reported `realtime.Frequency > 0`. Neither state proves electrical output or physical motor rotation. Fan and pump status states are derived from their mapped speeds/states.

The ten-byte CMD01 prefix is exposed only as `diagnostics.cmd01PrefixHex`. The earlier unverified prefix/register interpretation was removed in adapter version 0.6.0. No decoder for Modbus registers `542`-`545` or fault code `S10` is claimed. Unknown positions remain in `realtime.rawJson`, not as guessed semantic states.

## Confirmed CMD02 Values

| CMD02 state | Compact ioBroker state | Meaning |
| --- | --- | --- |
| `setting_000` | `settings.systemEnabled` | Main system enabled |
| `setting_003` | `settings.selectedMode` | 0 standby, 1 heating, 2 cooling, 3 hot water, 4 automatic |
| `setting_005` | `settings.dhwEnabled` | Domestic hot-water function enabled |
| `setting_006` | `settings.heatingEnabled` | Heating function enabled |
| `setting_007` | `settings.coolingEnabled` | Cooling function enabled |
| `setting_022` | `settings.constantCoolingTarget` | Constant cooling target |
| `setting_024`-`setting_028` | `settings.heatingCurve.outdoorPoint1`-`outdoorPoint5` | Heating-curve outdoor support points |
| `setting_029`-`setting_033` | `settings.heatingCurve.flowTarget1`-`flowTarget5` | Flow targets at the support points |
| `setting_037` | `settings.constantHeatingTarget` | Fixed heating flow target without the heating curve |

The source catalog contains 128 official settings-form fields matched to CMD02 positions; 125 are writable and three version fields are read-only. `Einstellungen.*` uses descriptive German IDs. `settings.rawJson` retains all 138 wire values. The technical `parN` names, CMD02 indices, sections, limits, select options, and confidence are available in object metadata. A reported `0.12.3` to `0.13.0` catalog comparison found all 128 fields and 125 writable flags unchanged, including IDs, indices, types, pages/controls, integer/min/max constraints, and numeric selection codes.

The language field `par5` did not match its assumed CMD02 position; `par137` is unnamed and `par190` is outside the packet. They are not exposed as confirmed named parameters. The version fields `par2`, `par3`, and `par138` are read-only. Other unconfirmed wire positions remain raw-only.

## Confirmed Control Mapping

| ioBroker state | Manufacturer field / CMD02 position | Direct W600 CMD05 parameter | Direct accepted value |
| --- | --- | ---: | --- |
| `control.power` | `par1` / `setting_000` | `0` | Off/on, encoded as 0/1 |
| `control.mode` | `par4` / `setting_003` | `3` | 0 standby, 1 hot water, 2 heating, 3 cooling, 4 automatic in ioBroker's public mode list |
| `control.coolingSetpoint` | `par23` / `setting_022` | `22` | Whole degrees `16`-`24 °C` |
| `control.heatingSetpoint` | `par38` / `setting_037` | `37` | Whole degrees `20`-`60 °C` |
| `control.hotWaterSetpoint` | `par55` / `setting_054` | `54` | Whole degrees `25`-`75 °C` |

`directWritesEnabled` and `cloudWritesEnabled` control only writes initiated by the adapter. The transparent bridge can still forward manufacturer-originated CMD05 frames while either option is false; these options are not firewall or transport filters.

Direct and expert writes require exactly one active W600 session. A direct write is confirmed only by a complete, CRC-valid CMD02 value matching the request after the write on that same session. Partial/pre-write CMD02 frames, frames from another session, and invalid-CRC frames cannot confirm it. The local integration suite exercised CRC rejection, sequence binding, matching readback, ambiguous-session rejection, and readiness refresh after reconnect using simulated endpoints. Use one adapter instance per heat pump; multiple W600 clients share the instance telemetry namespace, while direct writes are rejected unless the session is unique. This is software/protocol evidence, not physical control acceptance.

Cloud controls use the MyHeatPump HTTPS API and dynamically discovered device data-item IDs, mode options, and setpoint limits. They are independent of the local CMD05 path. Cloud writes require `control.deviceOnline === true`; `control.available` can still be true when online status is unknown. When the W600 bridge is enabled, cloud writes also require an active upstream. The local integration suite used synthetic cloud responses; no live cloud service/account was tested.

`command.republishCachedData` sends retained `frames.cmd_01` and `frames.cmd_02`. It requires `retainRawFrames=true`, complete CRC-valid cached frames, one active W600 session, an active upstream, and matching current module context. Cached data can be old and is not a fresh measurement; the command is unavailable when raw-frame retention is disabled.

## Deliberately Not Inferred

- The CMD01 prefix is not treated as fault/status registers.
- Unknown CMD01 values do not receive guessed objects.
- Unmatched CMD02 fields do not receive named states or write mappings.
- Cloud display values for unrelated measurements are not assigned invented CMD01 positions.
- Fault codes are not decoded from the current frame mapping.
- `-99`, NaN, null and non-finite values remain unavailable, not zero.

## Historical Versus Current Evidence

Earlier hardware observations established a correspondence between selected CMD01 values and the official display, including inactive/heating/cooling traces; the official settings page was compared read-only with CMD02 values. The historical installation was reported as HEIKO THERMAL 12, but exact controller/W600 firmware is not established. These observations do not establish compatibility with every unit or optional sensor and are not current physical validation of `0.13.0`.

The local `0.13.0` software/package suite passed on Windows with simulated loopback W600/upstream endpoints; the current runtime matrix and test limits are recorded in [docs/validation.md](docs/validation.md). No live unit, current heat-pump telemetry, or physical actuation is claimed. Manufacturer product information is available from [HEIKO](https://heiko.pl/en/kategoria-produktu/heat-pumps/); the endpoint `www.myheatpump.com:18899` is retained from the adapter's documented bridge protocol. Manufacturer names and protocol constants identify interoperability targets and do not imply endorsement. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for asset/source notices and [LICENSE](LICENSE) for the existing MIT license and copyright notice.
