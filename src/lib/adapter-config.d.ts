declare global {
    namespace ioBroker {
        interface AdapterConfig {
            bridgeEnabled: boolean;
            listenHost: string;
            listenPort: number;
            upstreamEnabled: boolean;
            upstreamHost: string;
            upstreamPort: number;
            autoAckWithoutUpstream: boolean;
            fallbackMnNumber: string;
            fallbackTarget: number;
            fallbackIdentifier: number;
            controlEnabled: boolean;
            directWritesEnabled: boolean;
            allowRawHexControl: boolean;
            retainRawFrames: boolean;
            cloudControlEnabled: boolean;
            cloudWritesEnabled: boolean;
            cloudRegion: 'EU' | 'NA' | 'CN';
            cloudTenant: string;
            cloudUsername: string;
            cloudPassword: string;
            cloudDeviceIdentifier: string;
            cloudSyncIntervalSec: number;
        }
    }
}

export {};
