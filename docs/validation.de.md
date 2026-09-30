# Validierung und Belege

[English](validation.md) | [Deutsch](validation.de.md)

**Version 0.13.1** · **Belegstand:** 2026-09-30

Die unten aufgeführten Software-, Paket- und lokalen Smoke-Prüfungen für `0.13.1` wurden bestanden. Nach dem Update von `0.12.3` wurde außerdem eine begrenzte passive Live-Abnahme bestanden. Sie umfasst Verbindung, Auslesung und Weiterleitung; Steuerungen wurden nicht ausgelöst, ein laufender Verdichter nicht getestet, die Live-Cloud-API nicht verwendet und ein Rollback nicht geprüft.

## Abgeschlossene lokale QA

| Prüfung | Ergebnis |
| --- | --- |
| Entwicklungsumgebungen | Frischer Windows-QA-Checkout mit Node.js `24.15.0`; Debian-13-Entwicklungsinstanz für Installations-/Smoke-Tests mit Node.js `24.21.0`, npm `11.19.0` |
| Build/Typprüfung/Lint | `npm run build`, `npm run check` (`tsc --noEmit`) und `npm run lint` bestanden |
| Unit-Tests | 26 bestanden |
| Pakettests | 48 bestanden |
| Regressionstests | 5 bestanden |
| Simulierte Integration | `npm run test:integration`: 18 bestanden, Exitcode 0. Das gepackte Paket wurde mit Loopback-W600-/Upstream-Fixtures und synthetischen Cloud-Antworten installiert und gestartet. |
| Paket-Smoke in der Entwicklungsumgebung | Lokale Installation des Tarballs `0.13.1` und fokussierter synthetischer Smoke-Test in einer Debian-13-Entwicklungsinstanz bestanden; getrennt von der passiven Live-Abnahme. |
| Laufzeit der Produktivinstallation | Das lokale Tarball-Update nutzte Node.js `24.21.0` und npm `12`; Hostkennung und Pfade werden nicht veröffentlicht. |
| Paket | `npm pack` reproduzierte das geprüfte Archiv bytegleich. Paketprüfung bestanden: 28 Dateien, 9 kompilierte JavaScript-Module, benötigte Admin-/Dokumentationsressourcen enthalten, keine Source Maps/Tests/Quelldateien/Skripte/privaten Fixture-Marker. |
| Paketdatenschutz | Gitleaks 8.30.1 mit Redaktion meldete 17 Source-Kandidaten aus zuvor geprüften synthetischen Fixtures/Übersetzungsbezeichnungen. Der Paketscan meldete 4 Kandidaten, alle Übersetzungsbezeichnungen. Paket-Datenschutzprüfung bestanden; keine Rohwerte sind hier enthalten. |
| Laufzeit-/Dependency-Audit | Reines Adapter-Runtime-Audit: 0 Findings. Isolierte Controller-Abhängigkeiten: 3 moderate Hinweise. Root-Entwicklungs-/Testabhängigkeiten: 12 Findings (1 niedrig, 5 moderat, 6 hoch); kein automatischer Audit-Fix. |
| Live-Update | Produktives Update von `0.12.3` auf `0.13.1` abgeschlossen. Der Hauptcontroller wurde nicht neu gestartet; die Instanzlisten-Zeilen blieben identisch. |
| Passive Live-Abnahme | W600-Verbindung, frische CMD01-/CMD02-Auslesung mit `ack=true`, `q=0`, `bridge.lastCrcOk=true` sowie Upstream-Weiterleitung in beide Richtungen bestanden. `control.directWriteReady=true` bedeutet Bereitschaft, nicht einen ausgelösten Befehl. |
| Live-Kompatibilität/Konfiguration | Alle 128 Parameterobjekte waren vorhanden; keine bisherige Objekt-ID wurde entfernt. Native Konfiguration byte- und logisch unverändert; alle fünf verglichenen Steuerwerte unverändert; kein neues `control.lastCommandAt`. |
| Live-Gesundheit | `info.lastError` war leer; im HEIKO-Hauptlog gab es während des Abnahmefensters 0 Warnungen/Fehler. |
| Grenze des Gerätezustands | Es wurde kein Steuerbefehl gesendet und kein laufender Verdichter getestet. |

Die simulierte Integration deckte Frame-CRC, Telemetrie und Schreibbestätigung, Schreibsequenz-/Sitzungsbindung, Readiness nach Wiederverbindung, Bridge-Weiterleitung/-Wiederherstellung, optionales lokales ACK, Cloud-Online-Schreibsperre und Rohframe-Unterdrückung ab. Diese Fälle nutzen simulierte Endpunkte. Die separate Live-Abnahme verifiziert nur passive W600-Auslesung und Upstream-Weiterleitung; sie belegt weder Verdichterbetrieb noch Steuerverhalten.

## Kompatibilitätsvergleiche

- Ein früherer lesender Vergleich mit dem installierten Adapter `0.12.3` ergab Übereinstimmung bei acht kompilierten JavaScript-Dateien und meldete 22 unveränderte native Einstellungen. Das ist historische Evidenz zum früheren Quellstand, keine Behauptung binärer Übereinstimmung für `0.13.1`.
- Der Einstellungs-Katalogvergleich umfasste alle 128 Felder, darunter 125 schreibbare Einträge. IDs, CMD02-Indizes, Typen, Seiten/Steuerelemente, Ganzzahligkeit, Minima/Maxima, Schreibbarkeit und numerische Auswahlcodes wurden in diesem Vergleich als unverändert gemeldet; daraus folgt keine Hardwarekompatibilität.

## CI und Releaseprozess

Die private CI-Matrix ist für fünf Jobs definiert: Linux/Node.js 22/js-controller 6.0.11; Linux/Node.js 22, 24 und 26/js-controller 7.2.2; sowie Windows/Node.js 24/js-controller 7.2.2. Die tatsächlichen Ergebnisse je Commit stehen unter [GitHub Actions](https://github.com/Zorax24/ioBroker.heiko/actions); eine definierte Matrix ist kein Prüfergebnis. Der Releaseprozess verlangt vor Upload/Tag Build und Tests aus einem frischen Checkout, Paketinhalt-Prüfung, Datenschutzprüfung und erfolgreiche erforderliche CI. Für Downloads ist die SHA-256-Prüfsummendatei des veröffentlichten Archivs maßgeblich.

## Validierungsgrenzen

| Bereich | Abgrenzung |
| --- | --- |
| Modell/Firmware | Passive Live-Abnahme an der gemeldeten HEIKO-THERMAL-12-/W600-Installation bestanden. Die genaue Regler-/W600-Firmware ist unbekannt; andere Modelle, Firmwarestände und optionale Sensoren sind nicht belegt. |
| Aktorik/Verdichter | Es wurde kein Steuerbefehl gesendet und kein laufender Verdichter getestet. `control.directWriteReady` ist nur eine Bereitschaftsanzeige. |
| Live-Cloud-API | Nicht getestet. Eine verbundene Upstream-TCP-Strecke belegt weder Cloud-API-Authentifizierung noch Cloud-Steuerung. |
| Rollback | Rollback von `0.13.1` nicht getestet. |
| Entwicklungs-Smoke | Der Paket-Smoke in der Debian-13-Entwicklungsinstanz nutzte synthetischen Datenverkehr; er ist getrennt von der produktiven passiven Live-Abnahme. |
| Admin-Oberfläche | Der Paketinstallations-/Konfigurationsweg über Admin war nicht Teil der dokumentierten Prüfungen. |
| Laufzeit/Plattform | Ergebnisse für andere Node.js-/Linux-/js-controller-Matrixkombinationen gelten je Commit; maßgeblich ist der Actions-Status des konkreten Commits, nicht die definierte Matrix. |
| Upgrade/Rollback | Die Betriebsanleitung beschreibt Sicherung und Wiederherstellung; Erhalt benutzerspezifischer Aliase und ein produktives Rollback-Ergebnis sind durch diesen Beleg nicht nachgewiesen. |
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
