# Evaluation Protocol and Metric Definitions

Use the same documented protocol for every run and retain attempt-level records. The dashboard calculates the eight objective indicators below; it does not determine the research design or create ground truth.

## Static indicators

1. **FSL sign/alphabet-to-text accuracy** = correctly classified static attempts / all evaluated static attempts × 100.
2. **Text-to-audio output accuracy** = correct, successful speech outputs / static attempts with an audio assessment × 100. Assess the spoken output against the study's rubric.
3. **Average processing time** = mean recorded static recognition processing time, in milliseconds. This prototype measures MediaPipe inference, feature extraction, and classification together.
4. **Classification rate** = total static classification decisions / total measured static elapsed seconds, in **decisions per second (decisions/s)**.

## Dynamic indicators

1. **Landmark tracking accuracy** must compare detected landmarks against independently annotated reference landmarks. MediaPipe's own output is not ground truth. Before collecting data, specify frame sampling, normalization, visibility/occlusion handling, the accepted error threshold, and the conversion to accuracy percentage. Do not enter a guessed score.
2. **Dynamic motion text-to-audio translation accuracy** = dynamic attempts with both correct text and a successful, assessed speech output / dynamic attempts assessed for both × 100.
3. **Average spatial-temporal processing time** = mean dynamic temporal-feature extraction and classification time, in milliseconds. This implementation measures those stages; it does not include camera capture or MediaPipe inference.
4. **Dynamic landmark classification rate** = total dynamic classification decisions / total measured dynamic classification seconds, in **decisions per second (decisions/s)**.

Rates are pooled as total decisions divided by total elapsed time, not averaged from per-attempt rates. Only include elapsed intervals collected using a consistent protocol. The recognition page records speech correctness only when the evaluator selects an assessment; landmark accuracy is optional and must be based on independent annotations.

## Classifier and dataset

Research evaluation uses **KNN with k = 3** and majority voting. Static signs and fingerspelling letters use Euclidean distance; dynamic signs and J/Z letters use frame-based dynamic time warping to align the timing of the 12-frame sequences. At least three samples are required for every label in a sign type, and predictions without a strict majority among the three nearest samples are rejected. The displayed neighbor agreement is not a probability or an accuracy measurement. When static KNN samples are unavailable, the app uses the bundled `nocontextdoruk/asl-landmark-mlp` model to estimate ASL-based A–Z handshapes locally from 21 MediaPipe landmarks. Its upstream validation is not an independent evaluation of this app or of FSL signers; do not report it as validated FSL accuracy. The pretrained model is CC BY-NC 4.0, so use it only in non-commercial contexts with attribution. Moving letters J and Z use motion rules or correctly labeled dynamic KNN samples. Use FSL-validated samples for general FSL vocabulary and independent camera/user evaluation. Static KNN samples contain palm-scale-normalized 3D coordinates for 21 landmarks per hand; two-hand features retain the relative wrist positions. Dynamic samples contain the same feature vectors resampled to 12 evenly spaced frames.

The recognition workflow can split saved samples per label and evaluate KNN on the held-out portion. This is only a software smoke check: frames recorded in the same session may be highly correlated, so it is not a participant-independent split and must not be reported as research accuracy. The KNN classifier excludes samples marked as test from its training set. A label needs at least four saved examples before the splitter can assign at least one test sample while retaining three training examples.

The live feature panel reports wrist-to-middle-MCP hand scale, landmark centroid, five fingertip-to-wrist/base-to-wrist ratios, and five joint-flexion angles. The classifier's static feature vector is 126 values (21 landmarks × 3 coordinates × two hand slots); dynamic samples resample 12 such vectors. These values differ from a 62-feature representation and should not be described as 62 features.

No complete FSL model or KNN training examples are bundled. Samples are captured and classified in the browser; the project does not use an application backend. Add FSL signs and fingerspelling alphabet samples validated by FSL users or a qualified specialist. The implementation is a browser-based prototype; its results are not a substitute for a participant-independent research train/test protocol. Record participant-independent splits and prevent samples from the same participant leaking across train/test sets.

## Statistical comparison

The pairing decision is **pending** until the sampling design confirms whether the same participants/cases provide matched static and dynamic observations. Ten trials per category alone do not establish pairing. Do not claim a paired t-test (or any other test) until the adviser/statistician confirms the design, unit of analysis, and assumptions. Use an appropriate paired or independent-samples method only after that confirmation.

## Data privacy and limitations

Evaluation records and KNN samples are stored in browser `localStorage`; they are not synchronized across devices and can be removed by clearing site data. Use non-identifying test codes. CSV export includes the attempt-level measurements and is filtered by the selected category.
