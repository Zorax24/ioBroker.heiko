# Steuerungen und State-Semantik

[English](controls.md) | [Deutsch](controls.de.md)

Diese Seite beschreibt die ioBroker-Steuerungen des Adapters. Schreibzugriffe können den realen Wärmepumpenbetrieb ändern. Der Adapter ist keine Sicherheitseinrichtung; lokale Softwaretests sind keine Hardwareabnahme.

## Bereitschaft und Status

- `control.directWriteReady`: Direktschreiben ist aktiviert, genau eine W600-Sitzung ist aktiv und für diese Sitzung liegt ein gültiger Frame-Kontext vor. Nach einer Wiederverbindung aktualisiert der erste gültige Geräte-Frame die Bereitschaft für die neue Sitzung.
- `control.writeReady`: Mindestens ein konfigurierter Schreibpfad ist bereit; vor dem Schreiben den jeweiligen Pfad-State prüfen.
- `control.cloudConnected`: Cloud-Authentifizierung/-Synchronisierung wurde abgeschlossen.
- `control.deviceOnline`: Von der Cloud gemeldeter Online-Status. Cloud-Schreibzugriffe verlangen ausdrücklich den Wert true.
- `control.available`: Cloud-Steuerzuordnung ist verfügbar; der State kann bei unbekanntem Online-Status true sein und beweist nicht, dass das Gerät online ist.
- `control.lastCommand`, `control.lastResult`, `control.lastError` und `writes.last`: letzter Befehl und gemeldetes Ergebnis.

Diese Werte sind Software-States und gemeldete Antworten, kein Nachweis physischer Ausführung. `status.compressorDemand` wird aus einem von null verschiedenen Regler-Funktionscode abgeleitet; es ist eine Aktivitätsanzeige, keine Inverter-Startfreigabe oder Relaisrückmeldung. `status.compressorRunning` bildet separat `realtime.Frequency > 0` gemäß gemeldetem Wert ab; keiner der States beweist einen elektrischen Ausgang oder physische Motordrehung.

## Direkte W600-Steuerung

`directWritesEnabled` ist standardmäßig false. Ein Direktzugriff benötigt eine aktive W600-Verbindung, genau eine aktive W600-Sitzung und einen Frame-Kontext dieser Sitzung. Telemetrie mehrerer Clients kann denselben Instanz-Namensraum nutzen; direkte Schreibzugriffe werden bei mehrdeutiger Sitzung abgewiesen. Eine Adapterinstanz pro Wärmepumpe verwenden. Diese Option und `cloudWritesEnabled` betreffen nur vom Adapter initiierte Schreibzugriffe; herstellerseitige CMD05-Frames werden von der transparenten Bridge dennoch weitergeleitet. Die Optionen sind weder Firewall noch Transportsperre.

| State | Akzeptierte Werte | CMD05-Parameter | Bestätigung |
| --- | --- | ---: | --- |
| `control.power` | Boolean `false` / `true` | `0` | Passende CMD02-Einstellung, Index 0 |
| `control.mode` | 0 Standby, 1 Warmwasser, 2 Heizen, 3 Kühlen, 4 Automatik | `3` | CMD02-Einstellung 3 ergibt zurückübersetzt die angeforderte Betriebsart |
| `control.coolingSetpoint` | Ganzzahlig `16`-`24 °C` | `22` | Exakter frischer CMD02-Wert |
| `control.heatingSetpoint` | Ganzzahlig `20`-`60 °C` | `37` | Passender CMD02-Wert |
| `control.hotWaterSetpoint` | Ganzzahlig `25`-`75 °C` | `54` | Passender CMD02-Wert |

Die öffentlichen Direktwerte der Betriebsart werden für das Geräteprotokoll übersetzt: 0 Standby, 1 Warmwasser, 2 Heizen, 3 Kühlen, 4 Automatik. Kombinierte Modi 5 und 6 werden direkt nicht unterstützt. Kühlwerte von 16-21 °C wurden in offiziellem App-Datenverkehr beobachtet; 22-24 °C sind eine vom Adapter akzeptierte Erweiterung und benötigen exaktes CMD02-Readback. Der feste Heiz-Sollwert gilt bei inaktiver Heizkurve. Bei aktiver Kurve `status.effectiveFlowSetpoint` oder den kompatiblen Alias `realtime.Setpoint` lesen; `control.heatingSetpoint` ist nicht der aktuelle kurvenabhängige Sollwert.

Ein Direktzugriff gilt erst als bestätigt, wenn nach dem Schreibbefehl auf derselben W600-Sitzung ein vollständiger, CRC-gültiger CMD02-Wert mit dem angeforderten Wert eintrifft. Teilframes, vor dem Schreibbefehl empfangene CMD02-Frames, Frames einer anderen Sitzung oder CRC-ungültige Frames bestätigen ihn nicht. Die lokale Integrationssuite prüfte Sequenzbindung und CRC-Verhalten mit simulierten Endpunkten. Das bestätigt Protokoll-Readback, nicht die physische Ausführung.

## Expertenparameter

`Einstellungen.*` ordnet 128 benannte Formularfelder CMD02-Positionen zu; 125 sind schreibbar, `par2`, `par3` und `par138` sind schreibgeschützte Versionsfelder. Der Katalog prüft vor CMD05 numerische Minima/Maxima, Ganzzahligkeit, Boolean-Werte oder Auswahloptionen.

Expertenzugriffe verwenden ein sechs Byte langes Parameter-Payload (`uint16le(index)`, danach `float32le(value)`) und warten bis zu 12 Sekunden auf ein passendes CMD02-Readback derselben Sitzung. Exakte `Einstellungen.*`-Pfade aus dem Objektbaum oder [MAPPING.md](../MAPPING.md) nutzen. Keine `parN`-IDs erraten, Kataloggrenzen nicht durch Raw-Hex umgehen und keine Grenzen eines anderen Modells/Reglers übernehmen. Nicht zugeordnete oder unbenannte Felder bleiben schreibgeschützt.

Direkte und Experten-Schreibzugriffe sind standardmäßig deaktiviert. Ihr lokales Protokollverhalten wurde in Software-Integrationstests geprüft; der Betrieb an einer konkreten Wärmepumpe wurde nicht physisch getestet. Zielgerät, Wert, Betriebsart, frisches Readback und unabhängige Schutzmaßnahmen vor einer Aktivierung prüfen.

## Optionale Cloud-API

Cloud-Steuerung und transparente W600-Weiterleitung sind getrennte Funktionen:

- `cloudControlEnabled` ist standardmäßig false. Bei Aktivierung authentifiziert sich der Adapter und ermittelt regelmäßig Geräte und Steuerwerte des Kontos.
- `cloudWritesEnabled` ist separat standardmäßig false. Der Client verwendet ermittelte Betriebsarten und gerätespezifische Grenzen, soweit der Dienst sie liefert; es gibt keinen universellen fest kodierten Cloud-Temperaturbereich.
- Cloud-Schreibzugriffe erfordern `control.deviceOnline === true`. `control.available` allein genügt bei unbekanntem Online-Status nicht. Wenn die W600-Bridge aktiv ist, wird außerdem ihr Upstream benötigt.
- Die Online-Status-Sperre für Schreibzugriffe deaktiviert keine Cloud-Lesezugriffe.
- Ein erfolgreicher Cloud-Befehl entspricht der API-Antwort mit anschließendem Aktualisierungsversuch; er bestätigt keine physische Ausführung.

Cloud-Lesezugriffe und die Schreibsperre wurden mit lokalen synthetischen Antworten getestet. Für die Release-QA wurde kein Live-Cloud-Konto oder -Dienst verwendet.

| Region | HTTPS-Dienst | Standardmandant |
| --- | --- | --- |
| EU | `https://eu.myheatpump.com:8443` | `euheatpump` |
| NA | `https://usa.myheatpump.com:8443` | `usaheatpump` |
| CN | `https://amitime.anylink.io:8443` | `amitime` |

Das Standardintervall beträgt 60 Sekunden und ist auf 15-3600 Sekunden begrenzt. Zugangsdaten, Tokens, Gerätekennungen oder Seriennummern gehören nicht in Diagnosen.

## Protokollbefehle und zwischengespeicherte Daten

| State | Befehl | Funktion |
| --- | ---: | --- |
| `command.ackRealtime` | `0x03` | CMD01-Echtzeitdaten bestätigen |
| `command.ackSetparams` | `0x04` | CMD02-Einstellungen bestätigen |
| `command.requestRealtime` | `0x06` | Echtzeitdaten anfordern |
| `command.requestSetparams` | `0x07` | Einstellungen anfordern |
| `command.reserved08` | `0x08` | Reserviert; Bedeutung nicht behauptet |
| `command.reserved09` | `0x09` | Reserviert; Bedeutung nicht behauptet |
| `command.republishCachedData` | - | Zwischengespeicherte CMD01-/CMD02-Frames an MyHeatPump erneut senden |

`command.republishCachedData` liest die gespeicherten `frames.cmd_01` und `frames.cmd_02`. Voraussetzung sind `retainRawFrames=true`, vollständige CRC-gültige Frames im Cache, genau eine aktive W600-Sitzung, ein aktiver Upstream und passender aktueller Modulkontext. Die Frames können alt sein und sind keine frische Messung. Bei deaktivierter Rohframe-Aufbewahrung funktioniert dieser Befehl nicht.

`allowRawHexControl` ist standardmäßig false. Rohframes nur mit unabhängig bestätigter Protokollevidenz freischalten oder senden. Das vom Bediener eingegebene `command.rawHex` und dessen Ergebnis sind von der passiven Frame-Aufbewahrung getrennt und bleiben auch bei `retainRawFrames=false` vertraulich.

`upstreamEnabled` ist standardmäßig true und `autoAckWithoutUpstream` false. Bei ausdrücklich aktiviertem Auto-ACK bestätigt der Adapter gültige CMD01-/CMD02-Frames lokal, wenn der Upstream nicht verfügbar ist, sowohl bei absichtlicher Deaktivierung als auch bei einem Ausfall. Die lokalen Tests decken auch Bridge-Pause/Fortsetzen und Wiederherstellung ab. Lokale ACKs stellen keine MyHeatPump-Cloud-/App-Steuerung bereit.

Ein Teil der vom Adapter erzeugten Validierungsmeldungen ist zweisprachig. Betriebssystem- und Hersteller-/Cloud-Fehlerdetails bleiben im Originaltext und können eine andere Sprache verwenden.
