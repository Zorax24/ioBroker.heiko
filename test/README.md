# Offline Integration Fixtures

The cached-frame republish integration case requires `retainRawFrames=true`. With retention disabled, the adapter does not keep the `frames.cmd_01` and `frames.cmd_02` payloads needed for republishing. Test fixtures use synthetic W600 frames and loopback-only sockets.
