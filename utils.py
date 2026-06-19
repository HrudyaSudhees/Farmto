# utils.py

import io
import numpy as np
from PIL import Image

TARGET_SIZE = 224
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

def preprocess_image(file_bytes: bytes) -> np.ndarray:
    """
    Convert raw image bytes to a normalized numpy array
    shaped for ONNX inferencing: (1, 3, TARGET_SIZE, TARGET_SIZE).
    """
    # Open the image and ensure 3 channels
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    img = img.resize((TARGET_SIZE, TARGET_SIZE))
    arr = np.array(img, dtype=np.float32) / 255.0   # shape: H x W x C, scaled 0-1

    # Normalize per channel (broadcasted)
    arr = (arr - MEAN) / STD

    # Rearrange (H, W, C) -> (C, H, W)
    arr = np.transpose(arr, (2, 0, 1))

    # Add batch dimension
    arr = arr[np.newaxis]
    return arr

