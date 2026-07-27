FROM python:3.11-slim

WORKDIR /app

# System dependency for OCR - pytesseract is only a wrapper, it needs the
# actual tesseract binary present. Without this, /analyse-image silently
# fails inside the container even though it works on a machine that has
# the Windows/local installer run separately. Arabic is needed alongside
# French for Moroccan CIN cards, which mix both scripts.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-fra \
    tesseract-ocr-ara \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-fetch the multilingual NER model at build time. presidio_detector.py
# forces HF_HUB_OFFLINE=1 at runtime (this is a *local* DLP gateway - it
# shouldn't need egress to do its job) - that only works if the weights are
# already sitting in the HF cache before the container starts, which this
# step guarantees. HF_HUB_OFFLINE=0 here overrides that for the build only,
# so this RUN command itself is allowed to reach the Hub.
RUN HF_HUB_OFFLINE=0 python -c "from app.detectors.presidio_detector import warm_up_models; warm_up_models()"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
