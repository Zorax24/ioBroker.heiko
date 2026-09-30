# Validierung und Belege

[English](validation.md) | [Deutsch](validation.de.md)

**Version 0.13.0** · **Belegstand:** 2026-09-30

Die lokale Software-/Paket-QA für Version `0.13.0` ist in der unten beschriebenen Umgebung bestanden. Die Integration nutzte Loopback-Fixtures für W600/Upstream und synthetische Cloud-Antworten. Hardwareabnahme und Plattformabdeckung sind separat abgegrenzt; CI-Ergebnisse gelten jeweils für einen Commit. Veröffentlichungen folgen den etablierten Fresh-Checkout-, Paketprüfungs-, Datenschutz- und CI-Gates.

## Abgeschlossene lokale QA

| Prüfung | Ergebnis |
| --- | --- |
| Umgebung | Windows; Node.js `24.15.0`; npm `11.12.1`; js-controller `7.2.2` |
| Build, Check, Lint | Alle bestanden, Exitcode 0 |
| Unit- und Paket-/Metadatentests | 26 Unit-Tests und 48 Paket-/Metadatentests bestanden |
| Regressionstests | 5 bestanden |
| Paketprüfung | Bestanden; Archiv enthielt 9 kompilierte JavaScript-Dateien und Dokumentation, aber keine Source Maps, Tests, Quelldateien oder Skripte |
| Integration | 17 bestanden in etwa 2 Minuten, Exitcode 0; das gepackte Archiv wurde in einem frischen isolierten Controller installiert, gestartet und gestoppt |
| Testnetzwerk | W600-/Upstream-Endpunkte waren simuliert und auf Loopback beschränkt; Cloud-Verhalten nutzte synthetische Antworten. Keine Produktions- oder Heimnetz-Endpunkte wurden verwendet. |
| Lokaler Installations-Fallback | `npm install --offline --omit=dev ./iobroker.heiko-0.13.0.tgz` und das Anlegen der deaktivierten Instanz waren erfolgreich. Loopback-Konfiguration wurde vor dem Start gesetzt; das installierte `build/main.js` stimmte mit dem geprüften Archiv überein. |

Die Integration deckte Frame-CRC, Telemetrie und Schreibbestätigung, Schreibsequenz-/Sitzungsbindung, Readiness nach Wiederverbindung, Bridge-Weiterleitung/-Wiederherstellung, optionales lokales ACK, Cloud-Online-Schreibsperre und Rohframe-Unterdrückung ab. Dies sind simulierte Protokoll-/Softwareergebnisse, keine physische Geräteprüfung.

## Kompatibilitätsvergleiche

- Ein lesender Vergleich mit dem installierten Adapter `0.12.3` ergab exakte Übereinstimmung aller acht kompilierten JavaScript-Dateien. Die einzige Abweichung in `io-package.json` war das vom Controller ergänzte `common.installedFrom`. Das ist Provenienz kompilierter Dateien, kein Hashvergleich von Quelldateien und kein Audit.
- Alle 22 nativen Einstellungen einschließlich Vorgaben sowie geschützte/verschlüsselte Metadaten wurden als unverändert gemeldet.
- Der Einstellungs-Katalogvergleich umfasste alle 128 Felder, darunter 125 schreibbare Einträge. IDs, CMD02-Indizes, Typen, Seiten/Steuerelemente, Ganzzahligkeit, Minima/Maxima, Schreibbarkeit und numerische Auswahlcodes wurden als unverändert gemeldet.

## CI und Releaseprozess

Die private CI-Matrix ist für fünf Jobs definiert: Linux/Node.js 22/js-controller 6.0.11; Linux/Node.js 22, 24 und 26/js-controller 7.2.2; sowie Windows/Node.js 24/js-controller 7.2.2. Die tatsächlichen Ergebnisse je Commit stehen unter [GitHub Actions](https://github.com/Zorax24/ioBroker.heiko/actions); eine definierte Matrix ist kein Prüfergebnis. Der Releaseprozess verlangt vor Upload/Tag Build und Tests aus einem frischen Checkout, Paketinhalt-Prüfung, Datenschutzprüfung und erfolgreiche erforderliche CI. Für Downloads ist die SHA-256-Prüfsummendatei des veröffentlichten Archivs maßgeblich.

Berechtigte Nutzer laden das private Archiv über die [Release-Seite `v0.13.0`](https://github.com/Zorax24/ioBroker.heiko/releases/tag/v0.13.0) herunter.

## Nicht getestet oder nicht belegt

| Bereich | Abgrenzung |
| --- | --- |
| Physische Hardware | Keine aktuelle W600-/Wärmepumpenprüfung für `0.13.0`. Historische Belege betreffen ausgewählte Zuordnungen einer als HEIKO THERMAL 12 gemeldeten Installation; die genaue Firmware ist unbekannt. Andere Modelle/Sensoren sind nicht belegt. |
| Live-Cloud/Upstream | Kein Live-MyHeatPump-Dienst/-Konto verwendet; Cloud-Verhalten und Upstream-Endpunkte wurden lokal simuliert. |
| Admin-Oberfläche | Installation/Konfiguration des Pakets über Admin wurde nicht getestet. |
| Laufzeit/Plattform | Node.js 20, Ergebnisse für Node.js 22/26, Linux und der CI-Job mit Mindest-Controller sind durch den lokalen Lauf nicht belegt; die Actions-Ergebnisse je Commit prüfen. |
| Upgrade/Rollback | Upgrade vom verglichenen Archiv `0.12.3`, Erhalt benutzerspezifischer Aliase und Rollback wurden nicht ausgeführt. |
| Sicherheit/Rechte | Kein unabhängiges Sicherheitsaudit und keine Hardware-Zertifizierung. Rechte am vom Eigentümer bereitgestellten KI-Icon und an kurzen Hersteller-Optionsbezeichnungen wurden nicht unabhängig geklärt; siehe [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). |

## Umfang des Dependency-Audits

Das reine Runtime-Dependency-Audit des Adapters meldete 0 Findings. Separat meldete die isolierte Controller-Abhängigkeitsinstallation 3 moderate Hinweise und das Audit der Root-Entwicklungs-/Testabhängigkeiten 12 Findings: 1 niedrig, 5 moderat und 6 hoch. Es wurde kein automatischer Audit-Fix ausgeführt. Diese Dependency-Ergebnisse sind kein unabhängiges Sicherheitsaudit und bedeuten nicht, dass jeder Abhängigkeitsbereich frei von Findings war.

## Quellen

Am 2026-09-30 geprüfte Quellen:

- [ioBroker-Richtlinien für Adapter-Repositories](https://github.com/ioBroker/ioBroker.repositories/blob/master/README.md).
- [ioBroker-Laufzeitempfehlungen](https://raw.githubusercontent.com/ioBroker/ioBroker/master/versions.json): Node.js 22, 24 und 26 akzeptiert; 24 empfohlen; npm 11 empfohlen.
- [HEIKO-Wärmepumpeninformationen](https://heiko.pl/en/kategoria-produktu/heat-pumps/) (Hersteller-Produktreferenz).
- Herkunft von Protokoll-/Katalogzuordnungen und Grenzen nicht belegter Interpretationen stehen in [MAPPING.md](../MAPPING.md); vom Adapter verwendeter Hersteller-Endpunkt: `www.myheatpump.com:18899`.

Der Quellcode behält die bestehende MIT-Lizenz und den erforderlichen Copyright-Hinweis; siehe [LICENSE](../LICENSE). Herstellernamen und Protokollkonstanten kennzeichnen Interoperabilitätsziele und bedeuten weder Unterstützung noch Zertifizierung.
