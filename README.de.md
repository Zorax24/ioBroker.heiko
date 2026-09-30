[English](README.md) | [Deutsch](README.de.md)

# ioBroker.heiko

**Version: `0.13.1`**

ioBroker-Adapter für HEIKO-Wärmepumpen mit W600-TCP-Schnittstelle. Dieses Repository enthält ausschließlich einen ioBroker-Adapter und keine Home-Assistant-Integration.

Dieses Projekt wurde mit KI-Unterstützung nach einem Vibe-Coding-Ansatz entwickelt. Diese Dokumentation informiert über abgeschlossene Tests, unterstützte Hardware und bekannte Einschränkungen.

Der Adapter nimmt die eingehende TCP-Verbindung des W600 an, kann deren Datenstrom transparent zum MyHeatPump-Geräteserver weiterleiten und zugeordnete Telemetrie als ioBroker-States dekodieren. Optionale direkte W600-Steuerung und ein separater MyHeatPump-Cloud-API-Client sind verfügbar. Protokoll- und State-Zuordnungen stehen in [MAPPING.md](MAPPING.md).

## Funktionen

- Temperaturen, Verdichterfrequenz, Pumpen-/Lüfterzustände und den wirksamen Vorlauf-Sollwert direkt in ioBroker auslesen.
- Ein/Aus und Betriebsart schalten sowie Heiz-, Kühl- und Warmwasser-Sollwerte über die lokale W600-Verbindung einstellen.
- 128 zugeordnete Einstellungen mit verständlichen Bezeichnungen, dokumentierten Wertebereichen und Rücklesebestätigung bei schreibbaren Parametern nutzen.
- Transparente MyHeatPump-Weiterleitung in beide Richtungen aktivieren oder mit konfigurierbarer ACK-Behandlung lokal arbeiten.
- Verbindungen, Wiederverbindungen und Diagnosen ohne zusätzlichen Container oder MQTT-Bridge überwachen.

## Kompatibilität

Validiert wurde die gemeldete HEIKO-THERMAL-12-Installation mit W600. Die genaue Regler-/W600-Firmware ist unbekannt; Kompatibilität mit anderen Modellen, Firmwareständen oder optionalen Sensoren wird nicht behauptet.

Der Adapter wird an einer HEIKO THERMAL 12 dauerhaft produktiv eingesetzt, einschließlich Kommunikation und Wärmepumpensteuerung. Softwareprüfungen und Live-Update-Abnahme sind unter [Validierung](docs/validation.de.md) dokumentiert.

## Schnellstart

### Voraussetzungen

- Deklarierte Paketuntergrenze: Node.js `>=20`; die ioBroker-Metadaten verlangen js-controller `>=6.0.11` und Admin `>=7.6.20`.
- ioBroker empfiehlt derzeit Node.js 24 und npm 11; der [Validierungsbericht](docs/validation.de.md) beschreibt Prüfumfang und Grenzen dieses Releases.
- Ein Regler/W600 mit dem dokumentierten Frame-Format und ein Netzwerkpfad vom W600 zum ioBroker-Host. Sensornamen bezeichnen Protokollfelder und garantieren nicht, dass jeder Sensor eingebaut ist oder Werte liefert.
- Bei aktivierter transparenter Weiterleitung benötigt der ioBroker-Host ausgehenden TCP-Zugriff auf `www.myheatpump.com:18899`.

### Release installieren

Lade `iobroker.heiko-0.13.1.tgz` und `SHA256SUMS` von der [Release-Seite `v0.13.1`](https://github.com/Zorax24/ioBroker.heiko/releases/tag/v0.13.1) herunter. Prüfe die Prüfsumme und behalte das Paket als lokale Datei im ioBroker-Controller-Projektverzeichnis. Falls GitHub eine Anmeldung verlangt, verwende ein Konto mit Zugriff auf das Repository. Tokens oder Kontodaten gehören niemals in Installationsbefehle oder Diagnoseberichte.

Der geprüfte lokale Paketweg wird aus diesem Controller-Verzeichnis ausgeführt:

```sh
npm install --omit=dev ./iobroker.heiko-0.13.1.tgz
iobroker add heiko --enabled false
```

Die Instanz wird deaktiviert angelegt; prüfe ihre Konfiguration vor dem Start. Dieser Installationsweg mit dem Release-Paket wurde in einer Debian-13-ioBroker-Umgebung geprüft. Abgeschlossene Software- und Live-Prüfungen stehen unter [Validierung](docs/validation.de.md), automatisierte Ergebnisse unter [GitHub Actions](https://github.com/Zorax24/ioBroker.heiko/actions).

## Wärmepumpe verbinden

1. Öffne die HEIKO-Instanzkonfiguration in ioBroker Admin. Wähle einen freien TCP-Listen-Port (Vorgabe `8899`) und entscheide, ob an MyHeatPump weitergeleitet werden soll.
2. Sichere das bisherige Ziel des W600. Stelle dessen vorhandene TCP-Clientverbindung auf die erreichbare LAN-/VPN-Adresse deines ioBroker-Hosts und den eingestellten Listen-Port um.
3. Starte die Instanz und warte auf frische Messwerte und Einstellungen. Prüfe Verbindung und Datenzeitstempel, bevor du direkte Schreibzugriffe aktivierst.

Das W600 baut die Verbindung auf. `0.0.0.0` ist eine Listen-Bind-Adresse, niemals das Verbindungsziel des W600. Der Webport von ioBroker Admin ist ein anderer Dienst. Den W600-Listener nicht im Internet freigeben.

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

## Herstellerweiterleitung

```text
W600-TCP-Client -> ioBroker.heiko-Listener -> MyHeatPump-Geräteserver
                         |                    www.myheatpump.com:18899
                         +-> passive Frame-Dekodierung in ioBroker-States
```

Die Weiterleitung wird in den Instanzeinstellungen konfiguriert:

- **Ein (`upstreamEnabled=true`):** Den vollständigen W600-TCP-Datenstrom an MyHeatPump und Antworten zurück weiterleiten. Dazu gehören Gerätekennungen, Messwerte, Betriebszustände und Einstellungen. Herstellerseitige Befehle können die Wärmepumpe verändern. Die TCP-Weiterleitung wird vom Adapter nicht verschlüsselt.
- **Aus (`upstreamEnabled=false`):** Keine Herstellerverbindung aufbauen. Lokale Dekodierung und freigegebene Direktsteuerungen bleiben verfügbar. Für lokale Bestätigungen gültiger CMD01-/CMD02-Frames `autoAckWithoutUpstream` ausdrücklich aktivieren. Lokale ACKs ersetzen keinen Cloud-/App-Zugriff und löschen keine bereits beim Hersteller gespeicherten Daten.

Der Adapter leitet Bytes unverändert weiter und dekodiert eine passive Kopie. `directWritesEnabled` und `cloudWritesEnabled` betreffen nur adapterseitige Schreibzugriffe; sie filtern keine weitergeleiteten Herstellerbefehle und sind keine Firewall-Regeln. Der separate Cloud-API-Client ist optional und wird weder für die TCP-Weiterleitung noch für lokale W600-Steuerungen benötigt.

Verwende eine Bridge-Instanz pro Wärmepumpe. Jede Bridge-Instanz benötigt einen eindeutigen Listen-Port. Telemetrie mehrerer W600-Clients teilt sich den ioBroker-Objektnamensraum der Instanz; direkte Schreibzugriffe benötigen genau eine aktive W600-Sitzung und werden bei Mehrdeutigkeit abgewiesen. Nach einer Wiederverbindung aktualisiert der erste gültige Geräte-Frame die Direkt-Schreibbereitschaft für die neue Sitzung.

## Alltagsbedienung und Datenpunkte

Die Alltagssteuerungen sind `control.power`, `control.mode`, `control.heatingSetpoint`, `control.coolingSetpoint` und `control.hotWaterSetpoint`. Aktiviere direkte W600-Schreibzugriffe bewusst in den Instanzeinstellungen und prüfe vor der Bedienung `control.directWriteReady`. Schreibzugriffe werden nacheinander abgearbeitet und erst nach frischer, passender Einstellungs-Rückmeldung als erfolgreich gemeldet. Nach einem Timeout vor einem erneuten Versuch den aktuellen Wert prüfen.

Bei aktiver Heizkurve zeigt `status.effectiveFlowSetpoint` den wirksamen Vorlauf-Sollwert. `control.heatingSetpoint` ist der feste Heiz-Sollwert ohne Heizkurve.

- `status.*`: Betriebsart/Aktivität, gemeldete Verdichter-/Lüfter-/Pumpenstates, Durchflusswächter, Abtauung und effektiver Vorlauf-Sollwert.
- `realtime.*`: zugeordnete Messwerte und `realtime.rawJson` für CMD01-Werte.
- `settings.*`: kompakte bestätigte CMD02-Werte; `settings.rawJson` enthält Wire-Werte.
- `Einstellungen.*`: 128 benannte Formularfelder des Einstellungsbereichs, die CMD02 zugeordnet sind; 125 sind gemäß Kataloggrenzen schreibbar, wenn Schreibzugriffe ausdrücklich aktiviert wurden.
- `bridge.*`, `meta.*`, `frames.*`, `diagnostics.*`: Verbindung, Aktualität, Frames und Protokolldiagnose.
- `control.*`, `writes.*`, `command.*`: Steuerbereitschaft/-ergebnisse, Schreibprotokolle und Protokollbefehle.

`status.compressorDemand` wird aus einem von null verschiedenen Regler-Funktionscode abgeleitet. Es ist eine Aktivitätsanzeige, keine Inverter-Startfreigabe oder Relaisrückmeldung. `status.compressorRunning` bildet separat `realtime.Frequency > 0` gemäß gemeldetem Wert ab; keiner der States beweist einen elektrischen Ausgang oder physische Motordrehung. Nicht verfügbare Werte wie `-99`, NaN oder nicht endliche Zahlen sind keine Nullmessungen.

Direkte Schreibzugriffe sind standardmäßig deaktiviert. Der vollständige Einstellungskatalog enthält auch Service- und Schutzparameter für Pumpen, Ventile, Frostschutz, Zusatzheizungen und Anti-Legionellen-Funktionen. Diese nur mit gerätespezifischer Kenntnis oder fachlicher Unterstützung verändern. Betriebsartenwerte, Bereiche und Bestätigungsregeln stehen unter [Steuerungen](docs/controls.de.md).

## Updates, Sicherung und Entfernung

Nutze in Skripten und Visualisierungen State-IDs statt Anzeigebezeichnungen. Die IDs sind im dokumentierten Katalogvergleich stabil; seit `0.12.0` ersetzen beschreibende deutsche Parameter-IDs die älteren `parNN`-Objekt-IDs. Prüfe bei einem Upgrade älterer Versionen Skripte, Aliase, Historien und Dashboards. Siehe [MAPPING.md](MAPPING.md).

### Anzeigesprache

Namen, Beschreibungen und Parametergruppen sind auf Deutsch und Englisch hinterlegt. Mit Englisch als Sprache im ioBroker Admin erscheinen englische Anzeigenamen, etwa **Cooling setpoint**, **Compressor frequency** und **Flow temperature setpoint without heating curve**. Auswahltexte enthalten, wo zutreffend, beide Sprachen.

Technische Objekt-IDs werden nicht übersetzt. Beispielsweise erscheint `Einstellungen.HeizKühlkreis1.KühlSolltemperatur` auf Englisch als **Cooling setpoint**, behält aber seine ID, damit Skripte, Aliase, Historien und Dashboards weiter funktionieren. Nutze beim Durchsehen der Objekte die Anzeigenamen-Spalte im Admin.

Vor Update oder Entfernung ioBroker sichern und die Instanzkonfiguration dokumentieren. Für einen Rollback das vorherige Adapterpaket aufbewahren und nach der Wiederherstellung Verbindung und Telemetrieaktualität prüfen. Das Update von `0.12.3` auf `0.13.1` und die passive Abnahme stehen unter [Validierung](docs/validation.de.md); Steuerungen wurden nicht ausgelöst und ein Rollback wurde nicht getestet. Vor Entfernung einer aktiven Bridge den früheren W600-Netzwerkpfad wiederherstellen, falls das Gerät von diesem Adapter abhing.

## Fehlerhilfe und Support

| Symptom | Prüfen |
| --- | --- |
| Keine W600-Verbindung | TCP-Clientziel, erreichbarer LAN-/VPN-Pfad, Listen-Port und Firewall. |
| Listener startet nicht | Port bereits belegt oder Bind-Adresse am ioBroker-Host nicht vorhanden. |
| Verbindung, aber keine aktuellen Daten | `meta.last_seen`, `meta.last_setparams` und Empfangs-/Update-Zähler; eine TCP-Verbindung allein belegt keine frische Telemetrie. |
| Cloud-Weiterleitung nicht verfügbar | Weiterleitungseinstellung, DNS und ausgehender Zugriff auf `www.myheatpump.com:18899`. |
| Schreibzugriff abgewiesen oder unbestätigt | Schreibfreigabe, `control.directWriteReady`, zulässiger Bereich und frische Rückmeldung; nicht blind wiederholen. |

Weitere Prüf- und Wiederherstellungsschritte: [Betrieb](docs/operations.de.md). Reproduzierbare Fehler mit anonymisierten Diagnosen über [GitHub Issues](https://github.com/Zorax24/ioBroker.heiko/issues) melden.

## Datenschutz und Diagnosen

Rohframes werden standardmäßig aufbewahrt. `retainRawFrames=false` unterdrückt rohe Frame-/Diagnose-Payloads und Rohfelder in Schreibprotokollen und leert gespeicherte Frame-/CMD05-Historie. Strukturierte Telemetrie sowie vom Bediener eingegebenes `command.rawHex` und dessen Ergebnis werden dadurch nicht gelöscht. States und Logs vertraulich behandeln; Gerätekennungen, Hostdetails, Rohdaten und haushaltsbezogene Telemetrie vor dem Teilen anonymisieren.

## Dokumentation

- [Installation, Betrieb, Sicherung und Rollback](docs/operations.de.md)
- [Steuerungen und State-Semantik](docs/controls.de.md)
- [Protokoll- und State-Zuordnung](MAPPING.md)
- [Validierungsumfang und Belege](docs/validation.de.md)
- [Drittanbieterhinweise](THIRD_PARTY_NOTICES.md)

## Lizenz

Der Adapter-Quellcode behält seine bestehende MIT-Lizenz und den erforderlichen Copyright-Hinweis; siehe [LICENSE](LICENSE) und [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Das vom Projekteigentümer bereitgestellte KI-generierte Icon und kurze Hersteller-Optionsbezeichnungen sind für diesen Adapter enthalten; Herkunft und Rechte wurden nicht unabhängig geklärt. Herstellernamen und Protokollkonstanten dienen der Interoperabilität und bedeuten keine Herstellerunterstützung. Die MIT-Lizenz des Adapters gewährt keine uneingeschränkten Wiederverwendungsrechte an fremden Grafiken, Namen oder Marken.
