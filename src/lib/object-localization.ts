import { polishText } from './polish';

export interface BilingualText {
    en: string;
    de: string;
    pl?: string;
}

export interface LocalizedObjectText {
    name: BilingualText;
    desc?: BilingualText;
}

export const OBJECT_LOCALIZATION: Record<string, LocalizedObjectText> = {
    info: { name: { en: 'Information', de: 'Informationen' } },
    'info.connection': { name: { en: 'W600 connected', de: 'W600 verbunden' } },
    'info.bridgeListening': { name: { en: 'Bridge listener active', de: 'Bridge-Listener aktiv' } },
    'info.lastError': {
        name: { en: 'Last error', de: 'Letzter Fehler' },
        desc: {
            en: 'Adapter-generated validation messages are bilingual. Operating-system and vendor/cloud error details are preserved verbatim and may use their original language.',
            de: 'Vom Adapter erzeugte Validierungsmeldungen sind zweisprachig. Betriebssystem- und Hersteller-/Cloud-Fehlerdetails bleiben unverändert und können in der Ursprungssprache erscheinen.',
        },
    },
    bridge: { name: { en: 'TCP bridge', de: 'TCP-Bridge' } },
    'bridge.status': { name: { en: 'Bridge status', de: 'Bridge-Status' } },
    'bridge.upstreamConnected': { name: { en: 'Upstream connected', de: 'Upstream verbunden' } },
    'bridge.lastCrcOk': { name: { en: 'Last frame CRC valid', de: 'CRC des letzten Frames gültig' } },
    'bridge.activeClients': { name: { en: 'Active W600 clients', de: 'Aktive W600-Clients' } },
    'bridge.listenPort': { name: { en: 'Listen port', de: 'Listen-Port' } },
    'bridge.upstreamPort': { name: { en: 'Connected upstream port', de: 'Verbundener Upstream-Port' } },
    'bridge.lastFrameLength': { name: { en: 'Last frame length', de: 'Länge des letzten Frames' } },
    'bridge.discardedBytes': { name: { en: 'Discarded stream bytes', de: 'Verworfene Stream-Bytes' } },
    'bridge.bytesUnitToUpstream': {
        name: { en: 'Bytes forwarded from W600 to upstream', de: 'Vom W600 zum Upstream weitergeleitete Bytes' },
    },
    'bridge.bytesUpstreamToUnit': {
        name: { en: 'Bytes forwarded from upstream to W600', de: 'Vom Upstream zum W600 weitergeleitete Bytes' },
    },
    'bridge.upstreamReconnects': {
        name: { en: 'Upstream reconnect attempts', de: 'Upstream-Wiederverbindungsversuche' },
    },
    'bridge.listenHost': { name: { en: 'Listen host', de: 'Listen-Host' } },
    'bridge.upstreamHost': { name: { en: 'Connected upstream host', de: 'Verbundener Upstream-Host' } },
    'bridge.lastUnitRemote': { name: { en: 'Last W600 remote endpoint', de: 'Letzter W600-Gegenstellen-Endpunkt' } },
    'bridge.lastUpstreamError': {
        name: { en: 'Last upstream error', de: 'Letzter Upstream-Fehler' },
        desc: {
            en: 'Adapter-generated connection messages are bilingual; operating-system error details remain verbatim.',
            de: 'Vom Adapter erzeugte Verbindungsmeldungen sind zweisprachig; Betriebssystem-Fehlerdetails bleiben unverändert.',
        },
    },
    'bridge.lastUnitToUpstreamAt': {
        name: { en: 'Last W600-to-upstream forwarding', de: 'Letzte W600-zu-Upstream-Weiterleitung' },
    },
    'bridge.lastUpstreamToUnitAt': {
        name: { en: 'Last upstream-to-W600 forwarding', de: 'Letzte Upstream-zu-W600-Weiterleitung' },
    },
    'bridge.lastDirection': { name: { en: 'Last frame direction', de: 'Richtung des letzten Frames' } },
    'bridge.lastCommand': { name: { en: 'Last frame command', de: 'Befehl des letzten Frames' } },
    meta: { name: { en: 'Metadata', de: 'Metadaten' } },
    'meta.last_seen': {
        name: { en: 'Last valid realtime frame', de: 'Letzter gültiger Echtzeit-Frame' },
        desc: {
            en: 'Updated only by a CRC-valid CMD01 frame; invalid frames do not refresh telemetry freshness.',
            de: 'Wird nur durch einen CRC-gültigen CMD01-Frame aktualisiert; ungültige Frames erneuern die Telemetriefrische nicht.',
        },
    },
    'meta.last_setparams': {
        name: { en: 'Last valid settings frame', de: 'Letzter gültiger Einstellungs-Frame' },
        desc: {
            en: 'Updated only by a CRC-valid CMD02 frame; invalid frames do not refresh settings freshness.',
            de: 'Wird nur durch einen CRC-gültigen CMD02-Frame aktualisiert; ungültige Frames erneuern die Einstellungsfrische nicht.',
        },
    },
    'meta.mn_number': { name: { en: 'W600 module MAC / MN number', de: 'W600-Modul-MAC / MN-Nummer' } },
    'meta.deviceIdentifier': {
        name: { en: 'Device identifier / W600 module MAC', de: 'Gerätekennung / W600-Modul-MAC' },
    },
    'meta.identifier': { name: { en: 'Frame identifier', de: 'Frame-Kennung' } },
    'meta.target': { name: { en: 'Frame target', de: 'Frame-Ziel' } },
    'meta.mappingSchemaVersion': { name: { en: 'Mapping schema version', de: 'Mapping-Schemaversion' } },
    status: { name: { en: 'Operating status', de: 'Betriebsstatus' } },
    'status.activeFunctionCode': {
        name: { en: 'Active function code', de: 'Aktiver Funktionscode' },
        desc: {
            en: 'Live-confirmed CMD01 function code: 0 inactive, 2 heating, 3 cooling.',
            de: 'Live-bestätigter CMD01-Funktionscode: 0 inaktiv, 2 Heizen, 3 Kühlen.',
        },
    },
    'status.effectiveFlowSetpoint': {
        name: { en: 'Effective flow temperature setpoint', de: 'Aktuell wirksame Vorlauf-Solltemperatur' },
        desc: {
            en: 'Current flow-water target from CMD01 par36. With the heating curve active, this is the calculated target.',
            de: 'Aktuell verwendeter Vorlauf-Sollwert aus CMD01 par36. Bei aktiver Heizkurve ist dies der berechnete Sollwert.',
        },
    },
    'status.heatingCurveActive': {
        name: { en: 'Heating curve active', de: 'Heizkurve aktiv' },
        desc: {
            en: 'Confirmed heating-curve enable state from CMD02 setting_023.',
            de: 'Bestätigte Heizkurvenfreigabe aus CMD02 setting_023.',
        },
    },
    'status.compressorDemand': {
        name: { en: 'Compressor demand (inferred)', de: 'Verdichteranforderung (abgeleitet)' },
        desc: {
            en: 'Compatibility proxy derived from a nonzero active-function code. No independent demand bit is validated; this does not prove a compressor request or operation.',
            de: 'Kompatibilitätswert aus einem Funktionscode ungleich null. Kein unabhängiges Anforderungsbit ist bestätigt; dies belegt weder eine Verdichteranforderung noch den Betrieb.',
        },
    },
    'status.compressorRunning': {
        name: { en: 'Compressor running', de: 'Verdichter läuft' },
        desc: {
            en: 'Derived from the verified compressor frequency; true when realtime.Frequency is greater than 0 Hz.',
            de: 'Aus der bestätigten Verdichterfrequenz abgeleitet; true bei realtime.Frequency über 0 Hz.',
        },
    },
    'status.flowSwitchActive': {
        name: { en: 'Flow switch active', de: 'Strömungswächter aktiv' },
        desc: {
            en: 'Official flow-switch state from CMD01 par15.',
            de: 'Offizieller Strömungswächterzustand aus CMD01 par15.',
        },
    },
    'status.defrostActive': {
        name: { en: 'Defrost active', de: 'Abtauung aktiv' },
        desc: { en: 'Official defrost state from CMD01 par32.', de: 'Offizieller Abtauzustand aus CMD01 par32.' },
    },
    'status.pumpP0Running': {
        name: { en: 'Pump P0 running', de: 'Pumpe P0 läuft' },
        desc: { en: 'Official pump P0 state from CMD01 par33.', de: 'Offizieller Pumpenzustand P0 aus CMD01 par33.' },
    },
    'status.pumpP1Running': {
        name: { en: 'Pump P1 running', de: 'Pumpe P1 läuft' },
        desc: { en: 'Official pump P1 state from CMD01 par34.', de: 'Offizieller Pumpenzustand P1 aus CMD01 par34.' },
    },
    'status.pumpP2Running': {
        name: { en: 'Pump P2 running', de: 'Pumpe P2 läuft' },
        desc: { en: 'Official pump P2 state from CMD01 par35.', de: 'Offizieller Pumpenzustand P2 aus CMD01 par35.' },
    },
    'status.fan1Running': {
        name: { en: 'Outdoor unit fan 1 running', de: 'Außengeräte-Lüfter 1 läuft' },
        desc: {
            en: 'Derived from the official fan 1 speed in CMD01 par28.',
            de: 'Aus der offiziellen Lüfterdrehzahl 1 in CMD01 par28 abgeleitet.',
        },
    },
    'status.fan2Running': {
        name: { en: 'Outdoor unit fan 2 running', de: 'Außengeräte-Lüfter 2 läuft' },
        desc: {
            en: 'Derived from the official fan 2 speed in CMD01 par29.',
            de: 'Aus der offiziellen Lüfterdrehzahl 2 in CMD01 par29 abgeleitet.',
        },
    },
    realtime: { name: { en: 'Realtime telemetry', de: 'Echtzeit-Telemetrie' } },
    'realtime.json': { name: { en: 'Realtime JSON', de: 'Echtzeit-JSON' } },
    'realtime.rawJson': { name: { en: 'CMD01 raw values JSON', de: 'CMD01-Rohwerte-JSON' } },
    settings: { name: { en: 'Confirmed settings', de: 'Bestätigte Einstellungen' } },
    'settings.heatingCurve': { name: { en: 'Heating curve', de: 'Heizkurve' } },
    'settings.rawJson': { name: { en: 'CMD02 raw values JSON', de: 'CMD02-Rohwerte-JSON' } },
    Einstellungen: { name: { en: 'Confirmed settings', de: 'Bestätigte Einstellungen' } },
    'Einstellungen.AnzahlBestätigteParameter': {
        name: { en: 'Confirmed parameter count', de: 'Anzahl bestätigter Parameter' },
    },
    'Einstellungen.AnzahlSchreibbareParameter': {
        name: { en: 'Directly writable parameter count', de: 'Anzahl direkt schreibbarer Parameter' },
    },
    frames: { name: { en: 'Frames', de: 'Frames' } },
    'frames.lastCommand': { name: { en: 'Last frame command', de: 'Befehl des letzten Frames' } },
    'frames.lastPayload': {
        name: { en: 'Last frame payload', de: 'Nutzlast des letzten Frames' },
        desc: {
            en: 'Raw frame content is replaced with [suppressed] when retainRawFrames is disabled.',
            de: 'Rohdaten werden bei deaktiviertem retainRawFrames durch [suppressed] ersetzt.',
        },
    },
    'frames.lastUpdate': { name: { en: 'Last frame update', de: 'Letzte Frame-Aktualisierung' } },
    writes: { name: { en: 'Writes', de: 'Schreibvorgänge' } },
    'writes.last': {
        name: { en: 'Last write attempt', de: 'Letzter Schreibversuch' },
        desc: {
            en: 'Raw and payload fields are suppressed when retainRawFrames is disabled; command status and metadata remain.',
            de: 'Rohdaten- und Payload-Felder werden bei deaktiviertem retainRawFrames unterdrückt; Befehlsstatus und Metadaten bleiben erhalten.',
        },
    },
    'writes.lastUpdate': { name: { en: 'Last write update', de: 'Letzte Schreibaktualisierung' } },
    'writes.cloudToUnitCmd05Count': {
        name: { en: 'Captured valid cloud-to-unit CMD05 frames', de: 'Erfasste gültige Cloud-zu-W600-CMD05-Frames' },
    },
    'writes.cloudToUnitCmd05History': {
        name: { en: 'Distinct valid cloud-to-unit CMD05 frames', de: 'Einmalige gültige Cloud-zu-W600-CMD05-Frames' },
        desc: {
            en: 'Raw CMD05 history is cleared when retainRawFrames is disabled; the numeric capture count remains.',
            de: 'Der CMD05-Rohdatenverlauf wird bei deaktiviertem retainRawFrames geleert; der numerische Erfassungszähler bleibt erhalten.',
        },
    },
    diagnostics: { name: { en: 'Diagnostics', de: 'Diagnose' } },
    'diagnostics.receivedMessages': { name: { en: 'Received frames', de: 'Empfangene Frames' } },
    'diagnostics.realtimeUpdates': { name: { en: 'Realtime updates', de: 'Echtzeit-Aktualisierungen' } },
    'diagnostics.settingsUpdates': { name: { en: 'Settings updates', de: 'Einstellungs-Aktualisierungen' } },
    'diagnostics.frameUpdates': { name: { en: 'Frame updates', de: 'Frame-Aktualisierungen' } },
    'diagnostics.invalidValues': { name: { en: 'Invalid values', de: 'Ungültige Werte' } },
    'diagnostics.lastMessageTs': {
        name: { en: 'Last received frame', de: 'Letzter empfangener Frame' },
        desc: {
            en: 'Reception time includes frames with invalid CRC; use meta.last_seen and meta.last_setparams for valid telemetry freshness.',
            de: 'Empfangszeit einschließlich Frames mit ungültiger CRC; für gültige Telemetriefrische meta.last_seen und meta.last_setparams verwenden.',
        },
    },
    'diagnostics.lastTopic': { name: { en: 'Last source', de: 'Letzte Quelle' } },
    'diagnostics.lastPayload': {
        name: { en: 'Last payload', de: 'Letzte Nutzlast' },
        desc: {
            en: 'Raw payload is replaced with [suppressed] when retainRawFrames is disabled.',
            de: 'Die Roh-Payload wird bei deaktiviertem retainRawFrames durch [suppressed] ersetzt.',
        },
    },
    'diagnostics.cmd01PrefixHex': {
        name: { en: 'CMD01 prefix bytes (raw)', de: 'CMD01-Präfixbytes (Rohdaten)' },
        desc: {
            en: 'The ten unassigned CMD01 prefix bytes are shown only when raw-frame retention is enabled.',
            de: 'Die zehn nicht zugeordneten CMD01-Präfixbytes werden nur bei aktivierter Rohframe-Speicherung angezeigt.',
        },
    },
    control: { name: { en: 'Heat-pump control', de: 'Wärmepumpensteuerung' } },
    'control.cloudConnected': { name: { en: 'MyHeatPump cloud connected', de: 'MyHeatPump-Cloud verbunden' } },
    'control.available': { name: { en: 'Cloud control available', de: 'Cloud-Steuerung verfügbar' } },
    'control.writesEnabled': { name: { en: 'Cloud writes enabled', de: 'Cloud-Schreibzugriff aktiviert' } },
    'control.writeReady': {
        name: { en: 'A confirmed write path is ready', de: 'Ein bestätigter Schreibweg ist bereit' },
        desc: {
            en: 'Cloud readiness requires an explicitly enabled write path and a confirmed online state; direct readiness requires exactly one active W600 connection.',
            de: 'Cloud-Bereitschaft erfordert einen ausdrücklich freigegebenen Schreibweg und einen bestätigten Online-Status; direkte Bereitschaft erfordert genau eine aktive W600-Verbindung.',
        },
    },
    'control.directWritesEnabled': {
        name: { en: 'Direct W600 writes enabled', de: 'Direkte W600-Schreibzugriffe aktiviert' },
        desc: {
            en: 'Enables direct W600 control. Local direct commands are rejected unless exactly one W600 connection is active.',
            de: 'Aktiviert direkte W600-Steuerung. Direkte lokale Befehle werden abgelehnt, wenn nicht genau eine W600-Verbindung aktiv ist.',
        },
    },
    'control.directWriteReady': {
        name: { en: 'Direct W600 write path ready', de: 'Direkter W600-Schreibweg bereit' },
        desc: {
            en: 'True only when direct writes are enabled, exactly one W600 connection is active, and a verified frame context is available.',
            de: 'Nur dann true, wenn direkte Schreibzugriffe aktiviert sind, genau eine W600-Verbindung aktiv ist und ein bestätigter Frame-Kontext vorliegt.',
        },
    },
    'control.transport': { name: { en: 'Last control transport', de: 'Letzter Steuerweg' } },
    'control.directConfirmedCommands': {
        name: { en: 'Confirmed direct W600 controls', de: 'Bestätigte direkte W600-Steuerungen' },
    },
    'control.deviceOnline': {
        name: { en: 'MyHeatPump device online', de: 'MyHeatPump-Gerät online' },
        desc: {
            en: 'Online state reported by the MyHeatPump cloud API.',
            de: 'Onlinezustand laut MyHeatPump-Cloud-API.',
        },
    },
    'control.status': {
        name: { en: 'Cloud control status', de: 'Cloud-Steuerungsstatus' },
        desc: {
            en: 'Status values are stable machine-readable strings and are not translated.',
            de: 'Statuswerte sind stabile maschinenlesbare Zeichenfolgen und werden nicht übersetzt.',
        },
    },
    'control.deviceId': { name: { en: 'MyHeatPump device ID', de: 'MyHeatPump-Geräte-ID' } },
    'control.deviceName': { name: { en: 'MyHeatPump device name', de: 'MyHeatPump-Gerätename' } },
    'control.deviceSerialNumber': {
        name: { en: 'MyHeatPump device serial number', de: 'MyHeatPump-Geräteseriennummer' },
    },
    'control.deviceSelector': { name: { en: 'Cloud device selector used', de: 'Verwendeter Cloud-Gerätefilter' } },
    'control.modeOptions': { name: { en: 'Available cloud modes', de: 'Verfügbare Cloud-Modi' } },
    'control.lastSync': { name: { en: 'Last cloud synchronization', de: 'Letzte Cloud-Synchronisierung' } },
    'control.lastCommand': { name: { en: 'Last control command', de: 'Letzter Steuerbefehl' } },
    'control.lastCommandAt': { name: { en: 'Last control command time', de: 'Zeitpunkt des letzten Steuerbefehls' } },
    'control.lastResult': {
        name: { en: 'Last control command result', de: 'Ergebnis des letzten Steuerbefehls' },
        desc: {
            en: 'For direct W600 writes, success means the same connection returned a matching CRC-valid CMD02 value; this confirms the reported setting, not physical compressor action. For cloud writes, success means the API returned a successful command result; the later snapshot refresh is best-effort and also does not prove physical action.',
            de: 'Bei direkten W600-Schreibvorgängen bedeutet Erfolg, dass dieselbe Verbindung einen passenden CRC-gültigen CMD02-Wert zurückmeldete; dies bestätigt die gemeldete Einstellung, nicht eine physische Verdichteraktion. Bei Cloud-Schreibvorgängen bedeutet Erfolg, dass die API ein erfolgreiches Befehlsergebnis meldete; die spätere Snapshot-Aktualisierung ist unverbindlich und beweist ebenfalls keine physische Aktion.',
        },
    },
    'control.lastError': {
        name: { en: 'Last control error', de: 'Letzter Steuerungsfehler' },
        desc: {
            en: 'Adapter-generated validation messages are bilingual. Text returned by the cloud API or operating system is preserved verbatim and may use its original language.',
            de: 'Vom Adapter erzeugte Validierungsmeldungen sind zweisprachig. Texte der Cloud-API oder des Betriebssystems bleiben unverändert und können in der Ursprungssprache erscheinen.',
        },
    },
    'control.refresh': { name: { en: 'Refresh cloud control data', de: 'Cloud-Steuerdaten aktualisieren' } },
    'control.power': {
        name: { en: 'Heat pump on/off', de: 'Wärmepumpe Ein/Aus' },
        desc: {
            en: 'Direct W600 writes require a single active W600 connection and matching fresh CMD02 readback. Cloud API success does not prove physical relay or compressor action.',
            de: 'Direkte W600-Schreibvorgänge erfordern genau eine aktive W600-Verbindung und eine passende frische CMD02-Rücklesung. Cloud-API-Erfolg belegt keine physische Relais- oder Verdichteraktion.',
        },
    },
    'control.mode': {
        name: { en: 'Operating mode', de: 'Betriebsart' },
        desc: {
            en: 'Direct modes 0 through 4 require exactly one active W600 connection and matching fresh CMD02 readback on that connection. Combined modes 5 and 6 remain cloud-only.',
            de: 'Direkte Modi 0 bis 4 erfordern genau eine aktive W600-Verbindung und eine passende frische CMD02-Rücklesung derselben Verbindung. Kombinierte Modi 5 und 6 bleiben Cloud-only.',
        },
    },
    'control.heatingSetpoint': {
        name: { en: 'Flow temperature setpoint without heating curve', de: 'Vorlauf-Solltemperatur ohne Heizkurve' },
        desc: {
            en: 'Fixed flow target without the heating curve from MyHeatPump par38 / W600 CMD05 parameter 37. With the curve active, use status.effectiveFlowSetpoint. Direct writes require exactly one active W600 connection and matching fresh CMD02 readback.',
            de: 'Fester Vorlauf-Sollwert ohne Heizkurve aus MyHeatPump par38 / W600 CMD05-Parameter 37. Bei aktiver Heizkurve status.effectiveFlowSetpoint verwenden. Direkte Schreibvorgänge erfordern genau eine aktive W600-Verbindung und eine passende frische CMD02-Rücklesung.',
        },
    },
    'control.coolingSetpoint': {
        name: { en: 'Cooling setpoint', de: 'Kühl-Solltemperatur' },
        desc: {
            en: 'Direct W600 CMD05 cooling target, confirmed by a matching fresh CMD02 readback. Direct writes require exactly one active W600 connection.',
            de: 'Direkter W600-CMD05-Kühl-Sollwert, bestätigt durch eine passende frische CMD02-Rücklesung. Direkte Schreibvorgänge erfordern genau eine aktive W600-Verbindung.',
        },
    },
    'control.hotWaterSetpoint': {
        name: { en: 'Domestic hot water setpoint', de: 'Warmwasser-Solltemperatur' },
        desc: {
            en: 'Official MyHeatPump par55 / direct W600 CMD05 parameter 54 target. Direct writes require exactly one active W600 connection and matching fresh CMD02 readback.',
            de: 'Offizieller MyHeatPump-par55-/direkter W600-CMD05-Parameter-54-Sollwert. Direkte Schreibvorgänge erfordern genau eine aktive W600-Verbindung und eine passende frische CMD02-Rücklesung.',
        },
    },
    command: { name: { en: 'Commands', de: 'Befehle' } },
    'command.ackRealtime': { name: { en: 'Acknowledge realtime frame', de: 'Echtzeit-Frame bestätigen' } },
    'command.ackSetparams': { name: { en: 'Acknowledge settings frame', de: 'Einstellungs-Frame bestätigen' } },
    'command.requestRealtime': { name: { en: 'Request realtime data', de: 'Echtzeitdaten anfordern' } },
    'command.requestSetparams': { name: { en: 'Request settings data', de: 'Einstellungsdaten anfordern' } },
    'command.reserved08': { name: { en: 'Send reserved command 08', de: 'Reservierten Befehl 08 senden' } },
    'command.reserved09': { name: { en: 'Send reserved command 09', de: 'Reservierten Befehl 09 senden' } },
    'command.rawHex': { name: { en: 'Raw hex frame', de: 'Rohdaten-Frame (Hex)' } },
    'command.sendRawHex': { name: { en: 'Send raw hex frame', de: 'Rohdaten-Frame senden' } },
    'command.republishCachedData': {
        name: {
            en: 'Republish cached data to MyHeatPump',
            de: 'Zwischengespeicherte Daten an MyHeatPump erneut senden',
        },
    },
    'command.lastSent': { name: { en: 'Last sent command', de: 'Zuletzt gesendeter Befehl' } },
    'command.lastSentAt': { name: { en: 'Last sent time', de: 'Zeitpunkt des letzten Sendens' } },
    'command.lastResult': { name: { en: 'Last command result', de: 'Ergebnis des letzten Befehls' } },
    'command.lastError': {
        name: { en: 'Last command error', de: 'Letzter Befehlsfehler' },
        desc: {
            en: 'Adapter-generated validation messages are bilingual; protocol and operating-system error details may remain verbatim.',
            de: 'Vom Adapter erzeugte Validierungsmeldungen sind zweisprachig; Protokoll- und Betriebssystem-Fehlerdetails können unverändert bleiben.',
        },
    },
};

export function localizedName(id: string, fallback: string | BilingualText): BilingualText {
    const text =
        OBJECT_LOCALIZATION[id]?.name ?? (typeof fallback === 'string' ? { en: fallback, de: fallback } : fallback);
    return { ...text, pl: text.pl ?? polishText(text.en) };
}

export function localizedDescription(id: string, fallback?: string | BilingualText): BilingualText | undefined {
    const description = OBJECT_LOCALIZATION[id]?.desc;
    if (description) {
        return { ...description, pl: description.pl ?? polishText(description.en) };
    }
    if (typeof fallback === 'string') {
        return { en: fallback, de: fallback, pl: polishText(fallback) };
    }
    return fallback ? { ...fallback, pl: fallback.pl ?? polishText(fallback.en) } : undefined;
}
