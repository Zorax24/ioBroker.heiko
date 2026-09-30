[English](README.md) | [Deutsch](README.de.md)

# ioBroker.heiko

**Version: `0.13.0`**

Privater ioBroker-Adapter für das W600-TCP-Format, das für eine historische HEIKO-THERMAL-12-Installation gemeldet wurde. Die Regler-/W600-Firmware ist nicht bekannt; die Kompatibilität mit anderen Modellen, Firmwareständen oder optionalen Sensoren ist nicht verifiziert. Dieses Repository enthält ausschließlich einen ioBroker-Adapter und keine Home-Assistant-Integration.

Dieses Projekt wurde mit KI-Unterstützung nach einem Vibe-Coding-Ansatz entwickelt. Diese Dokumentation informiert über abgeschlossene Tests, unterstützte Hardware und bekannte Einschränkungen.

Der Adapter nimmt die eingehende TCP-Verbindung des W600 an, kann deren Datenstrom transparent zum MyHeatPump-Geräteserver weiterleiten und zugeordnete Telemetrie als ioBroker-States dekodieren. Optionale direkte W600-Steuerung und ein separater MyHeatPump-Cloud-API-Client sind verfügbar. Protokoll- und State-Zuordnungen stehen in [MAPPING.md](MAPPING.md).

## Schnellstart

### Voraussetzungen

- Deklarierte Paketuntergrenze: Node.js `>=20`; die ioBroker-Metadaten verlangen js-controller `>=6.0.11` und Admin `>=7.6.20`.
- ioBroker empfiehlt derzeit Node.js 24 und npm 11. Die abgeschlossene lokale QA nutzte Node.js `24.15.0`, npm `11.12.1` und js-controller `7.2.2`; in der [Validierung](docs/validation.de.md) steht, was geprüft wurde und was nicht.
- Ein Regler/W600 mit dem dokumentierten Frame-Format und ein Netzwerkpfad vom W600 zum ioBroker-Host. Sensornamen bezeichnen Protokollfelder und garantieren nicht, dass jeder Sensor eingebaut ist oder Werte liefert.
- Bei aktivierter transparenter Weiterleitung benötigt der ioBroker-Host ausgehenden TCP-Zugriff auf `www.myheatpump.com:18899`.

### Installation aus dem privaten Release

Berechtigte GitHub-Nutzer laden `iobroker.heiko-0.13.0.tgz` über die private [Release-Seite `v0.13.0`](https://github.com/Zorax24/ioBroker.heiko/releases/tag/v0.13.0) herunter. Als lokale Datei im ioBroker-Controller-Projektverzeichnis ablegen. Keine unauthentifizierte Download-URL und keine Tokens oder Kontodaten in Befehlen oder Diagnoseberichten verwenden.

Der geprüfte lokale Paketweg wird aus diesem Controller-Verzeichnis ausgeführt:

```sh
npm install --omit=dev ./iobroker.heiko-0.13.0.tgz
iobroker add heiko --enabled false
```

Der lokale `.tgz`-Weg wurde mit `--offline` geprüft; der obige Befehl erlaubt npm, nicht zwischengespeicherte Abhängigkeiten bei Bedarf über die konfigurierte Registry zu beziehen. Diese Netzwerkvariante wurde nicht separat geprüft. Die Instanz wird deaktiviert angelegt; prüfe ihre native Konfiguration vor dem Start. Das vollständige lokale QA-Ergebnis und dessen Umfang stehen unter [Validierung](docs/validation.de.md). Die tatsächlichen Ergebnisse je Commit zeigt der private CI-Workflow unter [GitHub Actions](https://github.com/Zorax24/ioBroker.heiko/actions); die Definition der Matrix belegt nicht, dass alle Jobs bestanden sind.

### Erstkonfiguration

Paketvorgaben:

| Einstellung | Vorgabe | Bedeutung |
| --- | --- | --- |
| W600-Bridge | Aktiviert | Nimmt die eingehende TCP-Clientverbindung des W600 an |
| Listen-Adresse / Port | `0.0.0.0:8899` | Adapter-Listener auf dem ioBroker-Host |
| Upstream-Weiterleitung | Aktiviert | Leitet an `www.myheatpump.com:18899` weiter |
| `autoAckWithoutUpstream` | `false` | Ohne ausdrückliche Freigabe keine lokalen ACKs |
| `retainRawFrames` | `true` | Bewahrt Frame-Payloads in States und Diagnosen auf |
| Direkte W600-Schreibzugriffe | Deaktiviert | Standardmäßig keine adapterseitigen W600-Steuerungen |
| MyHeatPump-Cloud-API / Cloud-Schreibzugriffe | Deaktiviert / deaktiviert | Separater API-Client und Schreibfreigabe sind optional |

Prüfe Bind-Adresse und Firewall vor dem ersten Start. Für einen lokalen Test verwende einen Loopback-Listener; bei einem echten W600 erlaube nur den benötigten lokalen Netzwerkpfad und veröffentliche den Listener nicht im Internet. Das W600 ist TCP-Client und initiiert die Verbindung zum Adapter. `192.0.2.20` als W600 und `192.0.2.10:8899` als Adapter sind nur Dokumentationsbeispiele; `192.0.2.0/24` ist für Beispiele reserviert.

Prüfe nach dem Start `info.bridgeListening`. Nach Verbindung des W600 prüfe `info.connection`, `bridge.activeClients`, `meta.last_seen` und bei aktivierter Weiterleitung `bridge.upstreamConnected`. Eine Socket-Verbindung allein beweist keine aktuelle Telemetrie. Siehe [Betrieb und Fehlersuche](docs/operations.de.md).

## Bridge und Datenfluss

```text
W600-TCP-Client -> ioBroker.heiko-Listener -> MyHeatPump-Geräteserver
                         |                    www.myheatpump.com:18899
                         +-> passive Frame-Dekodierung in ioBroker-States
```

Bei `upstreamEnabled=true` werden Datenblöcke in beide Richtungen unverändert weitergeleitet; eine passive Kopie wird für ioBroker dekodiert. Das schließt herstellerseitige CMD05-Frames ein: `directWritesEnabled` und `cloudWritesEnabled` steuern nur vom Adapter initiierte Schreibzugriffe. Sie filtern keine weitergeleiteten Daten und sind keine Firewall-Regeln. `autoAckWithoutUpstream` ist standardmäßig false. Bei ausdrücklicher Aktivierung bestätigt der Adapter gültige CMD01-/CMD02-Frames lokal, solange der Upstream nicht verfügbar ist, sowohl bei absichtlich deaktivierter Weiterleitung als auch bei Verbindungsabbruch. Lokale ACKs emulieren weder Cloud noch App. Dieses Verhalten wurde in der lokalen Integrationssuite mit simulierten Endpunkten geprüft, nicht mit einem Live-Dienst oder einer Wärmepumpe.

Verwende eine Bridge-Instanz pro Wärmepumpe. Jede Bridge-Instanz benötigt einen eindeutigen Listen-Port. Telemetrie mehrerer W600-Clients teilt sich den ioBroker-Objektnamensraum der Instanz; direkte Schreibzugriffe benötigen genau eine aktive W600-Sitzung und werden bei Mehrdeutigkeit abgewiesen. Nach einer Wiederverbindung aktualisiert der erste gültige Geräte-Frame die Direkt-Schreibbereitschaft für die neue Sitzung.

## States und Steuerungen

- `status.*`: Betriebsart/Aktivität, gemeldete Verdichter-/Lüfter-/Pumpenstates, Durchflusswächter, Abtauung und effektiver Vorlauf-Sollwert.
- `realtime.*`: zugeordnete Messwerte und `realtime.rawJson` für CMD01-Werte.
- `settings.*`: kompakte bestätigte CMD02-Werte; `settings.rawJson` enthält Wire-Werte.
- `Einstellungen.*`: 128 benannte Formularfelder des Einstellungsbereichs, die CMD02 zugeordnet sind; 125 sind gemäß Kataloggrenzen schreibbar, wenn Schreibzugriffe ausdrücklich aktiviert wurden.
- `bridge.*`, `meta.*`, `frames.*`, `diagnostics.*`: Verbindung, Aktualität, Frames und Protokolldiagnose.
- `control.*`, `writes.*`, `command.*`: Steuerbereitschaft/-ergebnisse, Schreibprotokolle und Protokollbefehle.

`status.compressorDemand` wird aus einem von null verschiedenen Regler-Funktionscode abgeleitet. Es ist eine Aktivitätsanzeige, keine Inverter-Startfreigabe oder Relaisrückmeldung. `status.compressorRunning` bildet separat `realtime.Frequency > 0` gemäß gemeldetem Wert ab; keiner der States beweist einen elektrischen Ausgang oder physische Motordrehung. Nicht verfügbare Werte wie `-99`, NaN oder nicht endliche Zahlen sind keine Nullmessungen.

Direkte Steuerungen und Expertenparameter sind standardmäßig deaktiviert. Bestätigte Werte, Grenzen, Rücklesebedingungen, Anforderungen an zwischengespeicherte Daten und Einschränkungen stehen unter [Steuerungen](docs/controls.de.md). Softwaretests belegen keinen sicheren Betrieb an einer konkreten Anlage. Schreibzugriffe nur nach anlagenspezifischer Prüfung und mit geeigneten Schutzmaßnahmen aktivieren.

## IDs, Instanzen und Wartung

Nutze in Skripten und Visualisierungen State-IDs statt Anzeigebezeichnungen. Die IDs sind im dokumentierten Katalogvergleich stabil; seit `0.12.0` ersetzen beschreibende deutsche Parameter-IDs die älteren `parNN`-Objekt-IDs. Prüfe bei einem Upgrade älterer Versionen Skripte, Aliase, Historien und Dashboards. Siehe [MAPPING.md](MAPPING.md).

Vor Update oder Entfernung ioBroker sichern und die Instanzkonfiguration dokumentieren. Für einen Rollback das vorherige Adapterpaket aufbewahren und nach der Wiederherstellung Verbindung und Telemetrieaktualität prüfen. Ein Upgrade vom installierten Paket `0.12.3` und ein Rollback waren nicht Teil dieses QA-Laufs. Vor Entfernung einer aktiven Bridge den früheren W600-Netzwerkpfad wiederherstellen, falls das Gerät von diesem Adapter abhing. Weitere Hinweise: [Betrieb](docs/operations.de.md).

## Datenschutz und Diagnosen

Rohframes werden standardmäßig aufbewahrt. `retainRawFrames=false` unterdrückt rohe Frame-/Diagnose-Payloads und Rohfelder in Schreibprotokollen und leert gespeicherte Frame-/CMD05-Historie. Strukturierte Telemetrie sowie vom Bediener eingegebenes `command.rawHex` und dessen Ergebnis werden dadurch nicht gelöscht. States und Logs vertraulich behandeln; Gerätekennungen, Hostdetails, Rohdaten und haushaltsbezogene Telemetrie vor dem Teilen anonymisieren.

## Lizenz

Der Adapter-Quellcode behält seine bestehende MIT-Lizenz und den erforderlichen Copyright-Hinweis; siehe [LICENSE](LICENSE) und [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Das vom Projekteigentümer bereitgestellte KI-generierte Icon und kurze Hersteller-Optionsbezeichnungen sind für diesen Adapter enthalten; Herkunft und Rechte wurden nicht unabhängig geklärt. Herstellernamen und Protokollkonstanten dienen der Interoperabilität und bedeuten keine Herstellerunterstützung. Die MIT-Lizenz des Adapters gewährt keine uneingeschränkten Wiederverwendungsrechte an fremden Grafiken, Namen oder Marken.
