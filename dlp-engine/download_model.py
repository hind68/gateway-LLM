# download_models.py
import os

# Temporarily force HuggingFace to go online
os.environ["HF_HUB_OFFLINE"] = "0"

from app.detectors.presidio_detector import warm_up_models

print("Connecting to HuggingFace to download models...")
warm_up_models()
print("✅ Models downloaded and cached successfully!")