import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer


def main():
    model_dir = Path(sys.argv[1])
    mode = sys.argv[2] if len(sys.argv) > 2 else "document"
    payload = json.load(sys.stdin)
    texts = payload.get("texts", [])
    if not isinstance(texts, list) or any(not isinstance(text, str) for text in texts):
        raise ValueError("texts must be a list of strings")

    tokenizer = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
    tokenizer.enable_truncation(max_length=512)
    tokenizer.enable_padding(pad_id=0, pad_token="[PAD]")
    session = ort.InferenceSession(
        str(model_dir / "model_quantized.onnx"),
        providers=["CPUExecutionProvider"],
    )

    if mode == "query":
        texts = ["为这个句子生成表示以用于检索相关文章：" + text for text in texts]

    vectors = []
    for start in range(0, len(texts), 8):
        batch = tokenizer.encode_batch(texts[start : start + 8])
        inputs = {
            "input_ids": np.asarray([item.ids for item in batch], dtype=np.int64),
            "attention_mask": np.asarray([item.attention_mask for item in batch], dtype=np.int64),
            "token_type_ids": np.asarray([item.type_ids for item in batch], dtype=np.int64),
        }
        hidden = session.run(None, inputs)[0]
        pooled = hidden[:, 0, :].astype(np.float32)
        norms = np.maximum(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12)
        vectors.extend((pooled / norms).tolist())

    json.dump({"vectors": vectors}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
