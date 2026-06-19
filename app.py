import os
import io
from PIL import Image
import torch
import torch.nn as nn
import timm
import torchvision.transforms as transforms
from flask import Flask, request, jsonify, render_template

# Constants
TARGET_SIZE = 224
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

# Class names in the exact order used during training
CLASS_NAMES = ['Bacterial Spot', 'EarlyBlight', 'Healthy', 'LateBlight', 'Leaf Mold', 'TargetSpot', 'BlackSpot']

# Solutions for each disease
SOLUTIONS = {
    'Bacterial Spot': 'Apply copper-based fungicides. Prune affected branches and avoid overhead watering.',
    'EarlyBlight': 'Use fungicides containing mancozeb or chlorothalonil. Rotate crops and remove infected plant debris.',
    'Healthy': 'Your plant appears to be healthy. Continue with good care practices.',
    'LateBlight': 'Apply fungicides containing chlorothalonil or copper. Ensure good air circulation and avoid wet conditions.',
    'Leaf Mold': 'Improve air circulation and reduce humidity. Apply fungicides containing mancozeb or chlorothalonil.',
    'TargetSpot': 'Apply fungicides containing chlorothalonil or azoxystrobin. Remove and destroy infected leaves.',
    'BlackSpot': 'Use fungicides containing chlorothalonil or myclobutanil. Prune affected areas and ensure good air circulation.'
}

# Initialize Flask
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB upload limit

# Load PyTorch model once at startup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "Model", "best_resnet50_fsro.pth")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Recreate the exact model architecture from the training notebook
model = timm.create_model("resnet50", pretrained=False)
num_classes = len(CLASS_NAMES)
dropout_rate = 0.3 # The optimized value

n_features = model.get_classifier().in_features if hasattr(model, 'get_classifier') else model.fc.in_features
model.fc = nn.Sequential(
    nn.Dropout(p=dropout_rate),
    nn.Linear(n_features, num_classes)
)

# Load the saved weights
model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.to(device)
model.eval()


# Preprocessing pipeline
preprocess = transforms.Compose([
    transforms.Resize((TARGET_SIZE, TARGET_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=MEAN, std=STD)
])

def preprocess_image(file_bytes: bytes) -> torch.Tensor:
    """
    Load image bytes, and preprocess it for the model.
    Returns a tensor of shape (1, 3, TARGET_SIZE, TARGET_SIZE).
    """
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    return preprocess(img).unsqueeze(0)  # Add batch dim

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/cart")
def cart():
    return render_template("cart.html")

@app.route("/detect")
def detect():
    return render_template("detect.html")

@app.route("/get-help")
def get_help():
    return render_template("get-help.html")

@app.route("/shop")
def shop():
    return render_template("shop.html")

@app.route("/predict", methods=["POST"])
def predict():
    """
    Expects multipart/form-data with field "image".
    Returns JSON with predicted diseases, probabilities, and solutions.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400
    file = request.files["image"]
    img_bytes = file.read()

    # Preprocess
    try:
        input_tensor = preprocess_image(img_bytes)
    except Exception as e:
        return jsonify({"error": f"Error processing image: {e}"}), 400

    input_tensor = input_tensor.to(device)

    # Run inference
    with torch.no_grad():
        outputs = model(input_tensor)
        # Model was trained with BCEWithLogitsLoss, so use sigmoid for probabilities
        probabilities = torch.sigmoid(outputs)
        probs = probabilities.cpu().numpy().tolist()[0]


    # Determine positive labels (threshold = 0.5)
    positive = [cls for cls, p in zip(CLASS_NAMES, probs) if p > 0.5]
    if not positive:
        positive = ["Healthy"]
        
    solutions = [SOLUTIONS.get(p, "No specific solution found.") for p in positive]

    return jsonify({
        "predictions": positive,
        "probabilities": dict(zip(CLASS_NAMES, probs)),
        "solutions": solutions
    })


if __name__ == "__main__":
    # Development server; use Gunicorn or similar in production
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=5000, debug=debug_mode)