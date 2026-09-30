# Installation und Betrieb

[English](operations.md) | [Deutsch](operations.de.md)

Diese Anleitung behandelt Installation und Betrieb des ioBroker-Adapters.

## Lokales Releasepaket installieren

Dieses Repository ist privat. Melde dich bei GitHub an, öffne die [Release-Seite `v0.13.1`](https://github.com/Zorax24/ioBroker.heiko/releases/tag/v0.13.1) und lade `iobroker.heiko-0.13.1.tgz` als dauerhaft aufbewahrte lokale Datei herunter. Tokens oder Zugangsdaten gehören nicht in Befehle, Adaptereinstellungen oder Supportberichte. Behalte das Archiv am Installationsort: npm vermerkt eine lokale Dateiabhängigkeit und kann das Paket bei späterer Paketpflege erneut benötigen.

Der geprüfte lokale Paketweg verwendet das ioBroker-Controller-Projektverzeichnis; die Paketdatei muss dort liegen:

```sh
npm install --omit=dev ./iobroker.heiko-0.13.1.tgz
iobroker add heiko --enabled false
```

Der lokale Tarball wurde in einer Debian-13-Entwicklungsinstanz für ioBroker installiert und einem Smoke-Test unterzogen. Ein separates Update von `0.12.3` auf `0.13.1` bestand die dokumentierten passiven Live-Verbindungs-/Ausleseprüfungen; Steuerungen wurden dabei nicht ausgelöst und die Live-Cloud-API wurde nicht getestet. Die Instanz wird deaktiviert angelegt. Lege vor dem Start die native Listener-Konfiguration über das etablierte ioBroker-Verfahren des Hosts fest und prüfe sie. Der Paketinstallationsweg über die Admin-Oberfläche war nicht Teil der dokumentierten Prüfungen. Umfang und Grenzen stehen unter [Validierung](validation.de.md).

## W600-Bridge konfigurieren

Paketvorgaben: Bridge aktiviert, Listener `0.0.0.0:8899`, Upstream-Weiterleitung an `www.myheatpump.com:18899` aktiviert, lokales Auto-ACK deaktiviert, direkte W600-Schreibzugriffe deaktiviert, Rohframe-Aufbewahrung aktiviert, Cloud-API deaktiviert und Cloud-Schreibzugriffe deaktiviert.

Das W600 ist TCP-Client und initiiert die Verbindung zum ioBroker-Listener. Der Adapter öffnet die ausgehende Verbindung zum konfigurierten Upstream. Für einen lokalen Test an Loopback binden. Bei einer Installation Bind-Adresse und Firewall vor dem Start prüfen; den Listener nicht im öffentlichen Internet verfügbar machen. Ein reines Dokumentationsbeispiel ist Adapter `192.0.2.10:8899` und W600 `192.0.2.20`; diese Adressen sind für Beispiele reserviert.

Nur erforderliche Verbindungen erlauben: W600 zum Adapter-Listener und bei aktivierter Weiterleitung den ioBroker-Host zu `www.myheatpump.com`, TCP-Port `18899`. Aktiviertes Upstream-Forwarding leitet Datenblöcke in beide Richtungen unverändert weiter und dekodiert eine passive Kopie, einschließlich herstellerseitiger CMD05-Frames. `directWritesEnabled` und `cloudWritesEnabled` steuern nur vom Adapter initiierte Schreibzugriffe; sie filtern keine weitergeleiteten Daten und sind keine Firewall-Regeln. Bei `autoAckWithoutUpstream=true` werden gültige CMD01-/CMD02-Frames lokal bestätigt, wenn der Upstream nicht verfügbar ist, sowohl bei absichtlicher Deaktivierung als auch bei Verbindungsabbruch. Lokale ACKs emulieren weder Cloud noch App. Die lokale Integrationssuite prüfte Bridge-Datenstrom und ACK-Verhalten mit Loopback-Fixtures, nicht mit einem Live-Upstream oder physischen W600.

## Instanzen und Sitzungen

Eine Bridge-Instanz pro Wärmepumpe verwenden und für jede Instanz auf demselben Host einen eigenen Listen-Port festlegen. Jedes W600 auf Host und Port seiner Instanz konfigurieren. Telemetrie mehrerer W600-Clients kann denselben Instanz-Namensraum nutzen; direkte Schreibzugriffe werden nur bei genau einer aktiven W600-Sitzung angenommen und bei Mehrdeutigkeit abgewiesen. Nach einer Wiederverbindung aktualisiert der erste gültige Geräte-Frame die Direkt-Schreibbereitschaft.

`bridge.activeClients`, `info.connection`, `info.bridgeListening`, `meta.last_seen` und `bridge.upstreamConnected` zeigen verschiedene Teile des Verbindungspfads. Ein TCP-Socket allein belegt weder aktuelle Telemetrie noch einen aktiven Upstream. Bedingungen für direkte und Cloud-Schreibzugriffe stehen unter [Steuerungen](controls.de.md).

## Backup, Update, Rollback und Entfernung

Vor einem Update:

1. Ein wiederherstellbares ioBroker-Backup erstellen und die Konfiguration der `heiko`-Instanz dokumentieren.
2. Das vorherige Adapterpaket aufbewahren und die installierte Version notieren.
3. Bei Updates von Versionen vor `0.12.0` Skripte, Aliase, Historien und Dashboards auf alte `parNN`-/`parameters.*`-IDs prüfen; der Katalog verwendet beschreibende `Einstellungen.*`-IDs.
4. Das authentifizierte Releasepaket installieren und die Instanzkonfiguration vor dem Aktivieren prüfen.

Die Aktivierung des Updates startet den Adapter neu und unterbricht W600-/Upstream-Verbindungen kurz. Diese Unterbrechung einplanen; nicht den gesamten ioBroker-Controller neu starten. Eine Mapping-Schema-Aktualisierung kann alte Telemetrie leeren, bis neue gültige Frames eintreffen. Nach dem Update Instanzgesundheit, Listener, W600-Verbindung, Telemetrieaktualität und Upstream getrennt prüfen. Abhängige Skripte und Steuerungen vor dem Fortsetzen von Automationen kontrollieren.

Für einen Rollback das aufbewahrte Adapterpaket über einen lokalen Paketweg erneut installieren, bei Bedarf die Instanzkonfiguration wiederherstellen, neu starten und dieselben States prüfen. Ein Rollback von `0.13.1` wurde nicht getestet; siehe [Validierung](validation.de.md).

Vor der Entfernung den W600-/Netzwerkpfad wiederherstellen, der vor der lokalen Bridge verwendet wurde, falls die Wärmepumpe für ihre MyHeatPump-Verbindung von diesem Adapter abhängt. Danach Instanz stoppen/deaktivieren und abhängige Skripte sowie Objektnutzer prüfen, bevor sie entfernt wird. Die Entfernung einer aktiven Bridge kann Telemetrie und App-Zugriff unterbrechen.

## Fehlersuche

| Symptom | Prüfung |
| --- | --- |
| `info.bridgeListening` ist false | Bridge-Aktivierung und Host/Port prüfen, Portbelegung kontrollieren und Adapterfehler ansehen. |
| Listener aktiv, aber `info.connection` false | Prüfen, ob das W600 als TCP-Client auf Host/Port dieser Instanz zeigt und sie über Routing/Firewall erreichen kann. |
| `info.connection` true, aber `meta.last_seen` veraltet | TCP-Verbindung ist keine aktuelle Telemetrie. Reglerdatenpfad, `diagnostics.realtimeUpdates` und Zeitstempel prüfen. |
| `bridge.upstreamConnected` ist false | `upstreamEnabled`, DNS/Netzwerkzugriff auf `www.myheatpump.com:18899`, `bridge.lastUpstreamError` und Wiederverbindungszähler prüfen. Lokales Auto-ACK ist standardmäßig aus und stellt keinen Cloud-/App-Zugriff her. |
| Messwerte fehlen oder sind null | `-99`, NaN, null und nicht endliche Werte bedeuten nicht verfügbar, nicht null. Optionale Sensoren gibt es nicht in jeder Konfiguration. |
| `control.directWriteReady` ist false | Prüfen, ob Direktschreiben aktiviert, genau eine W600-Sitzung aktiv und ein gültiger Frame-Kontext eingetroffen ist. Nach Wiederverbindung aktualisiert der erste gültige Geräte-Frame die Bereitschaft. |
| Cloud-Schreibzugriffe werden abgewiesen | Cloud-API-/Schreibfreigabe, `control.deviceOnline`, Geräteauswahl und bei Nutzung der W600-Bridge den Upstream prüfen. `control.available` allein beweist keinen Online-Status. |
| Eine Bridge funktioniert, die zweite kann nicht lauschen | Den Instanzen unterschiedliche Ports zuweisen und jedes W600 auf die vorgesehene Instanz zeigen lassen. |

`status.compressorDemand` ist abgeleitete Regleraktivität, keine Inverter-Startfreigabe oder Relaisrückmeldung. `status.compressorRunning` bildet `realtime.Frequency > 0` gemäß gemeldetem Wert ab. Keiner der States ist ein elektrischer Nachweis oder eine Sicherheits-/Steuerintegritätsprüfung.

## Anonymisierte Diagnosedaten

Für einen Supportbericht genügen Adapterversion, Node.js-/js-controller-/Admin-Versionen, betroffene Objekt-IDs und boolesche Werte, relatives Alter von `meta.last_seen` und eine anonymisierte Fehlerkategorie. Vor dem Teilen Benutzernamen, Kennwörter, Cloud-Tokens, Geräte-IDs, Seriennummern, MAC-Adressen, private Hostnamen/-IP-Adressen, genaue Pfade, Roh-Hex, vollständige Logs und haushaltsbezogene Telemetrie entfernen.

`retainRawFrames=false` unterdrückt rohe Frame-/Diagnose-Payloads, bereinigt Roh-/Payload-Felder in Schreibprotokollen und leert gespeicherte Frame-/CMD05-Historie. Strukturierte Telemetrie sowie vom Bediener eingegebenes `command.rawHex` und dessen Ergebnis fallen nicht darunter und bleiben vertraulich. Exporte auch bei deaktivierter Rohframe-Aufbewahrung prüfen.
