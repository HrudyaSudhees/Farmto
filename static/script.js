document.addEventListener('DOMContentLoaded', () => {
    
    // --- GENERAL & CART FUNCTIONS (Available on all pages) ---
    const updateCartCount = () => {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
        const cartCountElement = document.getElementById('cart-count');
        if (cartCountElement) {
            cartCountElement.textContent = cartCount;
        }
    };

    // --- SHOP PAGE LOGIC ---
    if (document.querySelector('.product-grid')) {
        const addToCartButtons = document.querySelectorAll('.add-to-cart-btn');
        addToCartButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const card = e.target.closest('.product-card');
                const product = {
                    id: card.dataset.id,
                    name: card.dataset.name,
                    price: parseFloat(card.dataset.price),
                    image: card.dataset.image,
                    quantity: 1
                };
                
                let cart = JSON.parse(localStorage.getItem('cart')) || [];
                const existingProductIndex = cart.findIndex(item => item.id === product.id);

                if (existingProductIndex > -1) {
                    cart[existingProductIndex].quantity += 1;
                } else {
                    cart.push(product);
                }

                localStorage.setItem('cart', JSON.stringify(cart));
                updateCartCount();
                alert(`${product.name} has been added to your cart!`);
            });
        });
    }

    // --- CART PAGE LOGIC ---
    if (document.getElementById('cart-items-container')) {
        const displayCartItems = () => {
            let cart = JSON.parse(localStorage.getItem('cart')) || [];
            const cartContainer = document.getElementById('cart-items-container');
            const cartTotalElement = document.getElementById('cart-total');
            
            cartContainer.innerHTML = ''; 

            if (cart.length === 0) {
                cartContainer.innerHTML = '<p class="cart-empty-message">Your cart is empty.</p>';
                if(cartTotalElement) cartTotalElement.textContent = '₹0';
                return;
            }

            let total = 0;
            cart.forEach(item => {
                total += item.price * item.quantity;
                cartContainer.innerHTML += `
                    <div class="cart-item">
                        <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                        <div class="cart-item-details">
                            <h3>${item.name}</h3>
                            <p>Price: ₹${item.price}</p>
                            <p>Quantity: ${item.quantity}</p>
                        </div>
                        <button class="remove-from-cart-btn" data-id="${item.id}">Remove</button>
                    </div>
                `;
            });

            if(cartTotalElement) cartTotalElement.textContent = `₹${total.toFixed(2)}`;

            document.querySelectorAll('.remove-from-cart-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const productId = e.target.dataset.id;
                    removeFromCart(productId);
                });
            });
        };

        const removeFromCart = (productId) => {
            let cart = JSON.parse(localStorage.getItem('cart')) || [];
            cart = cart.filter(item => item.id !== productId);
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCount();
            displayCartItems();
        };

        displayCartItems();
    }

    // --- DETECTOR PAGE LOGIC ---
    if (document.querySelector('.detector-container')) {
        const uploadInput = document.getElementById('uploadInput');
        const startCameraButton = document.getElementById('startCameraButton');
        const captureButton = document.getElementById('captureButton');
        const predictButton = document.getElementById('predictButton');
        const imagePreview = document.getElementById('imagePreview');
        const cameraFeed = document.getElementById('cameraFeed');
        const predictionResult = document.getElementById('predictionResult');

        let imageFile = null;
        let videoStream = null;

        // Upload image handler
        uploadInput.addEventListener('change', () => {
            if (uploadInput.files && uploadInput.files[0]) {
                imageFile = uploadInput.files[0];
                imagePreview.src = URL.createObjectURL(imageFile);
                imagePreview.classList.remove('hidden');
                cameraFeed.classList.add('hidden');
                predictionResult.textContent = '';
                // Stop camera if active
                if (videoStream) {
                    videoStream.getTracks().forEach(track => track.stop());
                    videoStream = null;
                }
                // Hide captureButton when upload used
                captureButton.classList.add('hidden');
            }
        });

        // Start camera handler
        startCameraButton.addEventListener('click', async () => {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
            }
            try {
                videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                cameraFeed.srcObject = videoStream;
                cameraFeed.classList.remove('hidden');
                imagePreview.classList.add('hidden');
                predictionResult.textContent = '';
                captureButton.classList.remove('hidden');
                imageFile = null; // Reset image file since we're using camera
            } catch (err) {
                alert('Camera access denied or not available: ' + err.message);
            }
        });

        // Capture camera frame handler
        captureButton.addEventListener('click', () => {
            if (!videoStream) return alert('Camera is not on');
            // Create a canvas to capture current frame
            const canvas = document.createElement('canvas');
            const size = 224;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(cameraFeed, 0, 0, size, size);
            canvas.toBlob(blob => {
                imageFile = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
                imagePreview.src = URL.createObjectURL(imageFile);
                imagePreview.classList.remove('hidden');
                cameraFeed.classList.add('hidden');
                // Stop video stream after capture if you want:
                videoStream.getTracks().forEach(track => track.stop());
                videoStream = null;
                captureButton.classList.add('hidden');
            }, 'image/jpeg', 0.92);
            predictionResult.textContent = '';
        });

        // Predict button handler: send imageFile to backend
        predictButton.addEventListener('click', async () => {
            if (!imageFile) {
                alert('Please upload an image or capture from the camera first.');
                return;
            }
            predictionResult.textContent = 'Analyzing...';

            const formData = new FormData();
            formData.append('image', imageFile);

            try {
                const response = await fetch('/predict', {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    predictionResult.textContent = `Prediction API error: ${errorData.error}`;
                    return;
                }
                const data = await response.json();
                let resultHTML = '';
                for (let i = 0; i < data.predictions.length; i++) {
                    resultHTML += `
                        <div class="result-entry">
                            <h4 class="result-label">Disease ${i + 1}</h4>
                            <h3>${data.predictions[i]}</h3>
                            <h4 class="result-label">Solution</h4>
                            <p>${data.solutions[i]}</p>
                        </div>
                    `;
                }
                predictionResult.innerHTML = resultHTML;
            } catch (error) {
                predictionResult.textContent = 'Network or server error: ' + error.message;
            }
        });
    }

    // --- This runs on every page load ---
    updateCartCount();
});