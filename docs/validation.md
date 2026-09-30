# Validation And Evidence

[English](validation.md) | [Deutsch](validation.de.md)

**Version 0.13.1** · **Evidence date:** 2026-09-30

The build, static checks, tests, package checks, and local smoke check below passed for `0.13.1`. A limited live passive acceptance also passed after updating from `0.12.3`. It covers connection, fresh readout, and forwarding only; controls were not actuated, the heat pump was not observed running, the live cloud API was not tested, and rollback was not tested.

## Completed Local QA

The operator also confirms successful ongoing productive use and heat-pump control with the existing adapter. This is operational experience reported by the operator, distinct from the coordinator's command-free `0.13.1` maintenance checks below; it is not a claim that every service parameter or hardware variant was individually tested.

| Check | Result |
| --- | --- |
| Fresh checkout/dependencies | `npm ci` completed successfully in the isolated QA checkout |
| Development environments | Fresh Windows QA checkout with Node.js `24.15.0`; Debian 13 development ioBroker instance for installation/smoke checks with Node.js `24.21.0`, npm `11.19.0` |
| Build/type/lint | `npm run build`, `npm run check` (`tsc --noEmit`), and `npm run lint` passed |
| Unit/package/regression | `npm run test:ts`: 26 passed; `npm run test:package`: 48 passed; `npm run test:regressions`: 5 passed |
| Simulated integration | `npm run test:integration`: 18 passed, exit 0. The packed adapter was installed and started against loopback W600/upstream fixtures and synthetic cloud responses. |
| Development package smoke | Local `0.13.1` tarball installation and focused synthetic smoke check passed in a Debian 13 development ioBroker instance; separate from the live passive acceptance below. |
| Productive install runtime | The local tarball update ran with Node.js `24.21.0` and npm `12`; production host identity and paths are intentionally omitted. |
| Package | `npm pack` reproduced the tested archive byte-for-byte. The verifier passed: 28 files, 9 compiled JavaScript modules, required Admin/docs resources present, no source maps/tests/source/scripts/private fixture markers. |
| Package privacy | Gitleaks 8.30.1 with redaction reported 17 source candidates, previously reviewed as synthetic fixtures. The package scan reported 4 candidates, all translation labels. Package privacy verification passed; no raw candidate values are included here. |
| Runtime/dependency audit | Adapter runtime-only audit: 0 findings. Isolated controller dependencies: 3 moderate advisories. Root development/test dependencies: 12 findings (1 low, 5 moderate, 6 high); no automated audit fix was run. |
| Live update | Productive update from `0.12.3` to `0.13.1` completed. The main controller was not restarted; instance-list lines remained identical. |
| Live passive acceptance | W600 connectivity, fresh CMD01/CMD02 readout with `ack=true`, `q=0`, `bridge.lastCrcOk=true`, and upstream forwarding in both directions passed. `control.directWriteReady=true` indicates readiness only, not an issued command. |
| Live compatibility/configuration | All 128 parameter objects were present and no prior object ID was removed. Native configuration was byte- and logically unchanged; all five compared control values were unchanged; no new `control.lastCommandAt` appeared. |
| Live health | `info.lastError` was empty and the root HEIKO log had 0 warnings/errors during the acceptance window. |
| Device-state boundary | No control command was issued and no compressor-running test was performed. |

The simulated integration coverage includes frame CRC handling, telemetry and write confirmation, write-sequence/session binding, direct-write readiness after reconnect, bridge forwarding/recovery, optional local ACK behavior, the cloud online write gate, and raw-frame suppression. Those cases use simulated endpoints. The separate live acceptance verifies passive W600 readout and upstream forwarding only; it does not establish physical compressor operation or control behavior.

## Compatibility Comparisons

- An earlier read-only comparison against the installed `0.12.3` adapter found parity for eight compiled JavaScript files and reported 22 native settings unchanged. That comparison is historical evidence for the earlier source snapshot, not a binary-parity claim for `0.13.1`.
- The settings catalog comparison covered all 128 fields, including 125 writable entries. IDs, CMD02 indices, types, pages/controls, integer/min/max constraints, writability, and numeric select codes were reported unchanged in that comparison; it does not establish hardware compatibility.

## CI And Release Process

The CI matrix covers five jobs: Linux/Node.js 22/js-controller 6.0.11; Linux/Node.js 22, 24, and 26/js-controller 7.2.2; and Windows/Node.js 24/js-controller 7.2.2. Results for each commit are available in [GitHub Actions](https://github.com/Zorax24/ioBroker.heiko/actions). The release process includes a fresh-checkout build/test, package-content verification, privacy review, and successful required CI before release publication. Use the published archive's SHA-256 checksum file to verify your download.

## Validation Boundaries

| Area | Boundary |
| --- | --- |
| Hardware/model | Passive live acceptance passed on the reported HEIKO THERMAL 12/W600 installation. Exact controller/W600 firmware remains unknown; other models, firmware, and optional sensors are not established. |
| Actuation/compressor | No control command was issued and no compressor-running test was performed. `control.directWriteReady` is readiness, not evidence of actuation. |
| Live cloud API | Not tested. The observed upstream TCP connection is not evidence of cloud API authentication or control. |
| Rollback | Rollback from `0.13.1` was not tested. |
| Development smoke | The Debian 13 development-instance package smoke used synthetic traffic; it is separate from the productive passive acceptance described above. |
| Admin UI | Admin package installation/configuration workflow was not part of the documented checks. |
| Runtime/platform | Results for other Node.js/Linux/js-controller matrix combinations are commit-specific; consult the Actions result for the exact commit rather than inferring a pass from the configured matrix. |
| Security/asset rights | No independent security audit or hardware certification was performed. Rights in the owner-supplied AI icon and short manufacturer option labels were not independently cleared; see [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). |

## Dependency Audit Scope

The runtime and dependency results above are scope-specific audit outputs, not an independent security certification. They do not mean every dependency scope is free of findings.

## Sources

Sources checked on 2026-09-30:

- [ioBroker adapter repository guidance](https://github.com/ioBroker/ioBroker.repositories/blob/master/README.md).
- [ioBroker runtime recommendations](https://raw.githubusercontent.com/ioBroker/ioBroker/master/versions.json): Node.js 22, 24, and 26 accepted; 24 recommended; npm 11 recommended.
- [HEIKO heat-pump product information](https://heiko.pl/en/kategoria-produktu/heat-pumps/) (manufacturer product reference).
- Protocol/catalog provenance and the limits on inferred mappings are documented in [MAPPING.md](../MAPPING.md); manufacturer endpoint used by the bridge: `www.myheatpump.com:18899`.

The source retains its existing MIT license and required copyright notice; see [LICENSE](../LICENSE). Manufacturer names and protocol constants identify interoperability targets and do not imply endorsement or certification.
