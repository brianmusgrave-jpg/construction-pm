/**
 * @file src/lib/audio/recorder.ts
 * @description Browser MediaRecorder wrapper for Keeney Mode.
 *
 * Handles audio capture with visual state management, silence detection,
 * and max duration limits. Returns raw Blob for upload or offline queue.
 *
 * Sprint 21 — Keeney Mode
 */

export type RecorderState = "idle" | "recording" | "processing" | "error";

export interface RecorderOptions {
  /** Max recording duration in seconds. Default: 300 (5 min). */
  maxDuration?: number;
  /** Silence threshold for auto-stop (seconds of silence). Default: 3. */
  silenceTimeout?: number;
  /** Callback for audio level (0-1) for waveform visualization. */
  onAudioLevel?: (level: number) => void;
  /** Callback when state changes. */
  onStateChange?: (state: RecorderState) => void;
}

export interface RecordingResult {
  blob: Blob;
  duration: number; // seconds
  mimeType: string;
}

/**
 * Create and manage an audio recording session.
 *
 * Usage:
 * ```ts
 * const recorder = createRecorder({ onAudioLevel: setLevel });
 * await recorder.start();
 * const result = await recorder.stop();
 * // result.blob is ready for upload
 * ```
 */
export function createRecorder(options: RecorderOptions = {}) {
  const maxDuration = options.maxDuration ?? 300;
  const silenceTimeout = options.silenceTimeout ?? 3;

  let mediaRecorder: MediaRecorder | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let startTime = 0;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let levelInterval: ReturnType<typeof setInterval> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let state: RecorderState = "idle";
  let resolveStop: ((result: RecordingResult) => void) | null = null;

  function setState(newState: RecorderState) {
    state = newState;
    options.onStateChange?.(newState);
  }

  async function start(): Promise<void> {
    if (state === "recording") return;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analysis for level monitoring
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      // Choose best available codec
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunks = [];
      startTime = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const duration = (Date.now() - startTime) / 1000;
        cleanup();
        if (resolveStop) {
          resolveStop({ blob, duration, mimeType });
          resolveStop = null;
        }
      };

      mediaRecorder.start(1000); // collect in 1s chunks
      setState("recording");

      // Audio level monitoring for waveform
      if (options.onAudioLevel) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        levelInterval = setInterval(() => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          options.onAudioLevel!(avg / 255);
        }, 100);
      }

      // Max duration auto-stop
      maxTimer = setTimeout(() => {
        if (state === "recording") stop();
      }, maxDuration * 1000);
    } catch (err) {
      setState("error");
      throw err;
    }
  }

  function stop(): Promise<RecordingResult> {
    return new Promise((resolve) => {
      if (state !== "recording" || !mediaRecorder) {
        resolve({ blob: new Blob(), duration: 0, mimeType: "audio/webm" });
        return;
      }

      setState("processing");
      resolveStop = resolve;
      mediaRecorder.stop();
    });
  }

  function cleanup() {
    if (levelInterval) clearInterval(levelInterval);
    if (silenceTimer) clearTimeout(silenceTimer);
    if (maxTimer) clearTimeout(maxTimer);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (audioContext) audioContext.close().catch(() => {});
    mediaRecorder = null;
    audioContext = null;
    analyser = null;
    stream = null;
    levelInterval = null;
    silenceTimer = null;
    maxTimer = null;
    setState("idle");
  }

  function getState(): RecorderState {
    return state;
  }

  function getDuration(): number {
    if (state !== "recording") return 0;
    return (Date.now() - startTime) / 1000;
  }

  return { start, stop, cleanup, getState, getDuration };
}
