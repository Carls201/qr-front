// Elementos del DOM
const video = document.getElementById('video');
const qrCanvas = document.getElementById('qrCanvas');
const qrData = document.getElementById('qrData');
const qrTime = document.getElementById('qrTime');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const scanButton = document.getElementById('scanButton');
const geoButton = document.getElementById('geoButton');

// Variables de estado
let stream = null;
let cameraActive = false;
let lastScanResult = null;

// Event listeners
startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
scanButton.addEventListener('click', scanSingleQRCode);
geoButton.addEventListener('click', getLocation);

// Función para iniciar la cámara
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }, 
            audio: false 
        });
        
        video.srcObject = stream;
        await video.play(); // Esperar a que el video esté listo
        
        startButton.disabled = true;
        stopButton.disabled = false;
        scanButton.disabled = false;
        cameraActive = true;
        
        qrData.textContent = 'Cámara lista para escanear';
        
    } catch (err) {
        console.error('Error al acceder a la cámara:', err);
        qrData.textContent = 'Error: No se pudo acceder a la cámara';
    }
}

// Función para detener la cámara
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    video.srcObject = null;
    cameraActive = false;
    
    startButton.disabled = false;
    stopButton.disabled = true;
    scanButton.disabled = true;
    
    qrData.textContent = lastScanResult 
        ? `Último código: ${lastScanResult.data}` 
        : 'Cámara detenida';
}

// Función para escanear un único código QR al presionar el botón
async function scanSingleQRCode () {
    if (!cameraActive) {
        qrData.textContent = 'Error: La cámara no está activa';
        return;
    }
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        qrData.textContent = 'Error: El video no está listo';
        return;
    }
    
    // Configurar canvas
    qrCanvas.width = video.videoWidth;
    qrCanvas.height = video.videoHeight;
    
    // Dibujar frame actual en el canvas
    const qrContext = qrCanvas.getContext('2d');
    qrContext.drawImage(video, 0, 0, qrCanvas.width, qrCanvas.height);
    
    // Leer datos de la imagen
    const imageData = qrContext.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
    
    // Intentar decodificar QR
    try {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
        });
        
        if (code) {
            lastScanResult = {
                data: code.data,
                timestamp: new Date()
            };
            
            // Mostrar resultado
            qrData.textContent = code.data;
            qrTime.textContent = `Escaneado: ${lastScanResult.timestamp.toLocaleString()}`;
            
            // Efecto visual
            document.querySelector('.result-container').classList.add('qr-detected');
            setTimeout(() => {
                document.querySelector('.result-container').classList.remove('qr-detected');
            }, 1000);
            
            // Hacer fetch con los datos
            await fetchQRData(code.data);
        } else {
            qrData.textContent = 'No se detectó ningún código QR';
        }
    } catch (error) {
        console.error('Error al escanear QR:', error);
        qrData.textContent = 'Error al procesar el código QR';
    }
}

// Función para hacer fetch de los datos
async function fetchQRData(qrData) {
    //https://qr-back-s3hl.onrender.com/api/post
    const res = await getGeolocation();
    fetch(`https://qr-back-s3hl.onrender.com/api/post`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            info: qrData,
            latitude: res.latitude,
            longitude: res.longitude
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Datos recibidos:', data);
        // Procesar la respuesta
    })
    .catch(error => {
        console.error('Error en el fetch:', error);
        if (qrData.textContent) {
            qrData.textContent = `Error al consultar: ${error.message}`;
        }
    });
}

// Función para obtener la geolocalización
function getGeolocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject("Geolocalización no soportada en este navegador.");
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy, // Precisión en metros
            });
          },
          (error) => {
            reject(`Error al obtener geolocalización: ${error.message}`);
          },
          {
            enableHighAccuracy: true, // Mayor precisión (GPS)
            timeout: 10000, // 10 segundos de espera
          }
        );
      }
    });
}