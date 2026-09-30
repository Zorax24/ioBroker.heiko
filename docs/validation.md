# Validation And Evidence

[English](validation.md) | [Deutsch](validation.de.md)

**Version 0.13.0** · **Evidence date:** 2026-09-30

Local software/package QA passed for version `0.13.0` on the environment below. The integration used loopback W600/upstream fixtures and synthetic cloud responses. Hardware acceptance and platform coverage are bounded separately; CI results are commit-specific. Release publication follows the maintained fresh-checkout, package-verification, privacy-review, and CI gates.

## Completed Local QA

| Check | Result |
| --- | --- |
| Environment | Windows; Node.js `24.15.0`; npm `11.12.1`; js-controller `7.2.2` |
| Build, check, lint | All passed, exit code 0 |
| Unit and package/metadata tests | 26 unit tests and 48 package/metadata tests passed |
| Regression tests | 5 passed |
| Package verification | Passed; archive contained 9 compiled JavaScript files and packaged documentation, with no source maps, tests, source files, or scripts |
| Integration | 17 passed in about 2 minutes, exit code 0; the packed adapter was installed, started, and stopped in a fresh isolated controller |
| Test network | W600/upstream endpoints were simulated on loopback; cloud behavior used synthetic responses. No production or home-network endpoint was used. |
| Local install fallback | `npm install --offline --omit=dev ./iobroker.heiko-0.13.0.tgz` and adding the instance disabled both succeeded. The loopback configuration was set before start; installed `build/main.js` matched the tested archive. |

The integration coverage includes frame CRC handling, telemetry and write confirmation, write-sequence/session binding, direct-write readiness after reconnect, bridge forwarding/recovery, optional local ACK behavior, the cloud online write gate, and raw-frame suppression. These are simulated protocol/software results, not physical device behavior.

## Compatibility Comparisons

- A read-only comparison with the installed `0.12.3` adapter found exact parity for all eight compiled JavaScript files. The only `io-package.json` difference was controller-added `common.installedFrom`. This is compiled-file provenance, not a source-file hash comparison or an audit.
- All 22 native settings, their defaults, and protected/encrypted metadata were reported unchanged.
- The settings catalog comparison covered all 128 fields, including 125 writable entries. IDs, CMD02 indices, types, pages/controls, integer/min/max constraints, writability, and numeric select codes were reported unchanged.

## CI And Release Process

The private CI matrix is defined for five jobs: Linux/Node.js 22/js-controller 6.0.11; Linux/Node.js 22, 24, and 26/js-controller 7.2.2; and Windows/Node.js 24/js-controller 7.2.2. Check the actual per-commit results in [GitHub Actions](https://github.com/Zorax24/ioBroker.heiko/actions); a configured matrix is not a pass result. The release process requires a fresh-checkout build/test, package-content verification, privacy review, and successful required CI before upload/tag. The published archive's SHA-256 checksum file is authoritative for download verification.

Authorized users download the private archive from the [v0.13.0 release page](https://github.com/Zorax24/ioBroker.heiko/releases/tag/v0.13.0).

## Not Tested Or Not Established

| Area | Boundary |
| --- | --- |
| Physical hardware | No current W600/heat-pump test for `0.13.0`. Historical evidence concerns selected mappings reported for a HEIKO THERMAL 12 installation; exact firmware is unknown and other models/sensors are not established. |
| Live cloud/upstream | No live MyHeatPump service/account was used; cloud behavior and upstream endpoints were simulated locally. |
| Admin UI | Admin package installation/configuration workflow was not tested. |
| Runtime/platform | Node.js 20, Node.js 22/26 results, Linux, and the minimum-controller CI job have no result established by the local run; use the Actions result for each commit. |
| Upgrade/rollback | Upgrade from the compared `0.12.3` archive, preservation of user aliases, and rollback were not exercised. |
| Security/asset rights | No independent security audit or hardware certification was performed. Rights in the owner-supplied AI icon and short manufacturer option labels were not independently cleared; see [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). |

## Dependency Audit Scope

The adapter runtime-only dependency audit reported 0 findings. Separately, the isolated controller dependency install reported 3 moderate advisories, and the root development/test dependency audit reported 12 findings: 1 low, 5 moderate, and 6 high. No automated audit fix was run. These dependency results are not an independent security audit and do not mean every dependency scope was clear.

## Sources

Sources checked on 2026-09-30:

- [ioBroker adapter repository guidance](https://github.com/ioBroker/ioBroker.repositories/blob/master/README.md).
- [ioBroker runtime recommendations](https://raw.githubusercontent.com/ioBroker/ioBroker/master/versions.json): Node.js 22, 24, and 26 accepted; 24 recommended; npm 11 recommended.
- [HEIKO heat-pump product information](https://heiko.pl/en/kategoria-produktu/heat-pumps/) (manufacturer product reference).
- Protocol/catalog provenance and the limits on inferred mappings are documented in [MAPPING.md](../MAPPING.md); manufacturer endpoint used by the bridge: `www.myheatpump.com:18899`.

The source retains its existing MIT license and required copyright notice; see [LICENSE](../LICENSE). Manufacturer names and protocol constants identify interoperability targets and do not imply endorsement or certification.
