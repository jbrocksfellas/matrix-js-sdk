/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { TrackStatsReporter } from "../../../../src/webrtc/stats/trackStatsReporter";
import { MediaTrackStats } from "../../../../src/webrtc/stats/media/mediaTrackStats";

describe("TrackStatsReporter", () => {
    describe("should on frame and resolution stats", () => {
        it("creating empty frame and resolution report, if no data available.", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            TrackStatsReporter.buildFramerateResolution(trackStats, {});
            expect(trackStats.getFramerate()).toEqual(0);
            expect(trackStats.getResolution()).toEqual({ width: -1, height: -1 });
        });
        it("creating empty frame and resolution report.", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsReporter.buildFramerateResolution(trackStats, {
                framesPerSecond: 22.2,
                frameHeight: 180,
                frameWidth: 360,
            });
            expect(trackStats.getFramerate()).toEqual(22);
            expect(trackStats.getResolution()).toEqual({ width: 360, height: 180 });
        });
    });

    describe("should on simulcast", () => {
        it("creating simulcast framerate.", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            TrackStatsReporter.calculateSimulcastFramerate(
                trackStats,
                {
                    framesSent: 100,
                    timestamp: 1678957001000,
                },
                {
                    framesSent: 10,
                    timestamp: 1678957000000,
                },
                3,
            );
            expect(trackStats.getFramerate()).toEqual(30);
        });
    });

    describe("should on bytes received stats", () => {
        it("creating build bitrate received report.", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsReporter.buildBitrateReceived(
                trackStats,
                {
                    bytesReceived: 2001000,
                    timestamp: 1678957010,
                },
                { bytesReceived: 2000000, timestamp: 1678957000 },
            );
            expect(trackStats.getBitrate()).toEqual({ download: 800, upload: 0 });
        });
    });

    describe("should on bytes send stats", () => {
        it("creating build bitrate send report.", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            TrackStatsReporter.buildBitrateSend(
                trackStats,
                {
                    bytesSent: 2001000,
                    timestamp: 1678957010,
                },
                { bytesSent: 2000000, timestamp: 1678957000 },
            );
            expect(trackStats.getBitrate()).toEqual({ download: 0, upload: 800 });
        });
    });

    describe("should on codec stats", () => {
        it("creating build bitrate send report.", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            const remote = {} as RTCStatsReport;
            remote.get = jest.fn().mockReturnValue({ mimeType: "video/v8" });
            TrackStatsReporter.buildCodec(remote, trackStats, { codecId: "codecID" });
            expect(trackStats.getCodec()).toEqual("v8");
        });
    });

    describe("should on package lost stats", () => {
        it("creating build package lost on send report.", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            TrackStatsReporter.buildPacketsLost(
                trackStats,
                {
                    type: "outbound-rtp",
                    packetsSent: 200,
                    packetsLost: 120,
                },
                {
                    packetsSent: 100,
                    packetsLost: 30,
                },
            );
            expect(trackStats.getLoss()).toEqual({ packetsTotal: 190, packetsLost: 90, isDownloadStream: false });
        });
        it("creating build package lost on received report.", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsReporter.buildPacketsLost(
                trackStats,
                {
                    type: "inbound-rtp",
                    packetsReceived: 300,
                    packetsLost: 100,
                },
                {
                    packetsReceived: 100,
                    packetsLost: 20,
                },
            );
            expect(trackStats.getLoss()).toEqual({ packetsTotal: 280, packetsLost: 80, isDownloadStream: true });
        });
    });

    describe("should set state of a TrackStats", () => {
        it("to not alive if Transceiver undefined", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            TrackStatsReporter.setTrackStatsState(trackStats, undefined);
            expect(trackStats.alive).toBeFalsy();
        });

        it("to not alive if Transceiver has no local track", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            const ts = {
                sender: {
                    track: null,
                } as RTCRtpSender,
            } as RTCRtpTransceiver;

            TrackStatsReporter.setTrackStatsState(trackStats, ts);
            expect(trackStats.alive).toBeFalsy();
        });

        it("to alive if Transceiver remote and track is alive", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            trackStats.alive = false;
            const ts = {
                receiver: {
                    track: {
                        readyState: "live",
                        enabled: false,
                        muted: false,
                    } as MediaStreamTrack,
                } as RTCRtpReceiver,
            } as RTCRtpTransceiver;

            TrackStatsReporter.setTrackStatsState(trackStats, ts);
            expect(trackStats.alive).toBeTruthy();
        });

        it("to alive if Transceiver local and track is live", async () => {
            const trackStats = new MediaTrackStats("1", "local", "video");
            trackStats.alive = false;
            const ts = {
                sender: {
                    track: {
                        readyState: "live",
                        enabled: false,
                        muted: false,
                    } as MediaStreamTrack,
                } as RTCRtpSender,
            } as RTCRtpTransceiver;

            TrackStatsReporter.setTrackStatsState(trackStats, ts);
            expect(trackStats.alive).toBeTruthy();
        });

        it("to not alive if Transceiver track is ended", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            const ts = {
                receiver: {
                    track: {
                        readyState: "ended",
                        enabled: false,
                        muted: false,
                    } as MediaStreamTrack,
                } as RTCRtpReceiver,
            } as RTCRtpTransceiver;

            TrackStatsReporter.setTrackStatsState(trackStats, ts);
            expect(trackStats.alive).toBeFalsy();
        });

        it("to not alive and muted if Transceiver track is live and muted", async () => {
            const trackStats = new MediaTrackStats("1", "remote", "video");
            const ts = {
                receiver: {
                    track: {
                        readyState: "live",
                        enabled: false,
                        muted: true,
                    } as MediaStreamTrack,
                } as RTCRtpReceiver,
            } as RTCRtpTransceiver;

            TrackStatsReporter.setTrackStatsState(trackStats, ts);
            expect(trackStats.alive).toBeTruthy();
            expect(trackStats.muted).toBeTruthy();
        });
    });

    describe("should build Track Summary", () => {
        it("and returns empty summary if stats list empty", async () => {
            const summary = TrackStatsReporter.buildTrackSummary([]);
            expect(summary).toEqual({
                audioTrackSummary: {
                    count: 0,
                    muted: 0,
                },
                videoTrackSummary: {
                    count: 0,
                    muted: 0,
                },
            });
        });

        it("and returns  summary if stats list not empty", async () => {
            const summary = TrackStatsReporter.buildTrackSummary([]);
            expect(summary).toEqual({
                audioTrackSummary: {
                    count: 0,
                    muted: 0,
                },
                videoTrackSummary: {
                    count: 0,
                    muted: 0,
                },
            });
        });
    });
});
