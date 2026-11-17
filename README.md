# Filipino Sign Language-to-Text-to-Audio System Using Mathematical Feature Extraction and Computational Classification

**KUMPAS** is a browser-based Filipino Sign Language recognition prototype.

## Features

- Recognition webpage using browser webcam access and MediaPipe Hand Landmarker.
- Camera device selection, including Iriun Virtual Webcam when installed, running, and exposed to the browser.
- Palm-scale-normalized features for up to two hands and static/dynamic KNN recognition.
- Four-step workflow for collecting samples, inspecting live mathematical features, classifying signs, and testing held-out samples.
- Single or timed 25-frame sample capture, condition tags, per-label train/test splits, and JSON sample import/export.
- Limited built-in static-letter preview when no trainable static KNN samples are available.
- Webcam video recording with a local video download while recognition continues.
- Composable text output, configurable hold time, and Filipino/English speech playback.
- Mirrored or full-screen camera preview, quick copy and text download, and an eight-item phrasebook stored locally in the browser.
- Eight objective-aligned evaluation indicators, CSV export, and localStorage persistence.

## Run locally

1. Install Node.js LTS.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the Vite localhost URL in a supported browser and allow camera access.
5. To use Iriun, start Iriun on the phone and computer, then select **Iriun Virtual Webcam** in the camera list. It must appear as a video input device in the browser.

MediaPipe's JavaScript and WASM runtime are bundled with the app. The hand model is downloaded from Google's public model storage on first camera connection, so that connection requires internet access. Browser camera access requires localhost or HTTPS.

## Train recognition

The built-in letter preview estimates selected static letters (A, B, C, D, F, I, L, O, U, V, W, and Y); it is a geometric heuristic, not validated FSL accuracy. The data-preparation panel offers A–Z labels and custom approved labels. Other letters, including moving letters such as J and Z, and other signs need at least three varied, validated examples per sign label. KNN uses k = 3 and Euclidean distance; only training samples are used, and a label is returned only when the three nearest samples have a strict majority. Neighbor agreement is not measured recognition accuracy. Labels are filled automatically and spoken after the same result remains stable for the configured hold time; users do not need to type while signing. Static samples use one normalized landmark frame with a fixed 126-value vector for up to two hands; dynamic samples use a 12-frame resampled sequence. The live feature panel shows 3D fingertip distance ratios and joint-flexion angles. Use **Record sign video** to download a local webcam clip while recognition continues.

Samples are saved in this browser's `localStorage` and can be exported/imported as JSON. The split tool assigns held-out samples by label, but this sample-level split can leak near-duplicate frames and is not a participant-independent research split. Add varied representative samples for each validated label. Clearing browser site data removes them. The prototype does not synchronize data.

The phrasebook stores up to eight saved translations in this browser and does not sync them elsewhere. Use **Copy text** or **Download text** to share a translation intentionally. Camera frames are processed in the browser and are not uploaded by the app.

## Evaluation

The workflow can evaluate held-out KNN samples, and the recognition page can save timed static/dynamic test sessions. Held-out sample accuracy is an engineering check, not a research claim. Assess speech after listening and enter landmark accuracy only when independently annotated reference landmarks are available. The Evaluation page also supports manually entered attempts, category filters, and CSV export.

Classification rate is standardized as total decisions / total elapsed seconds (**decisions/s**). Landmark tracking accuracy must be compared with independently annotated reference landmarks, never with MediaPipe output as ground truth. The static/dynamic pairing decision is still pending the actual sampling design; see [docs/EVALUATION_PROTOCOL.md](./docs/EVALUATION_PROTOCOL.md).
