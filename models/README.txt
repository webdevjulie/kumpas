The bundled `asl-landmark-mlp.onnx` model estimates static ASL A–Z handshapes from one MediaPipe hand (21 landmarks, wrist-centered and normalized by the wrist-to-middle-MCP distance). The browser runs it locally through ONNX Runtime Web. The webcam stream is not sent to an inference API. Digits are included in the upstream model but are not emitted by this app.

Model: ASL Hand Gesture Recognizer (Landmark MLP), by Doruk Doğular (`nocontextdoruk`)
Model card and source: https://huggingface.co/nocontextdoruk/asl-landmark-mlp
Pinned revision: 71375bf1bfd3fa79b74cbff5ab91c9a1f2dba197
Model license: CC BY-NC 4.0; non-commercial use only, with attribution.
See `asl-landmark-mlp.LICENSE.txt` and `asl-landmark-mlp.CITATION.cff`.

The model was trained on ASL-HG, not this project's camera data or FSL signer data. Its reported metrics are upstream results and are not a guarantee of accuracy here. Do not treat it as a full FSL vocabulary model. For general FSL signs, use locally captured, validated KNN samples.