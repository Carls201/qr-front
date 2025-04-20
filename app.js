import { BrowserPDF417Reader } from 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.1/+esm';

document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('scanner-video');
    const scanBtn = document.getElementById('scan-btn');
    const statusElement = document.getElementById('status');

    let stream = null;
    let isScanning = false;
    let scanAnimationId = null;
    let lastScanTime = 0;
    let codeDetected = false;
    let scanner = null;

    const useNativeDetector = 'BarcodeDetector' in window;
    const barcodeDetector = useNativeDetector ? new BarcodeDetector({ formats: ['pdf417', 'code_128'] }) : null;

    function setStatus(message, isError = false, isSuccess = false) {
        statusElement.textContent = message;
        statusElement.style.color = isError ? '#e74c3c' : '#2c3e50';
        statusElement.style.backgroundColor = isError ? '#ffebee' : '#ecf0f1';

        if (isSuccess) {
            statusElement.classList.add('success');
        } else {
            statusElement.classList.remove('success');
        }
    }

    async function startScanning() {
        if (isScanning) return;

        try {
            setStatus('Iniciando cámara... Por favor espere.');
            scanBtn.disabled = true;

            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };

            stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = stream;

            await new Promise((resolve, reject) => {
                videoElement.onloadedmetadata = resolve;
                videoElement.onerror = reject;
                setTimeout(() => {
                    if (videoElement.readyState < 1) {
                        reject(new Error('Tiempo de espera agotado para cargar la cámara'));
                    }
                }, 3000);
            });

            await videoElement.play();

            isScanning = true;
            codeDetected = false;

            setStatus('Cámara lista. Escaneando...\n\nConsejos:\n- Asegure buena iluminación\n- Mantenga el documento plano\n- Evite sombras y reflejos');

            if (useNativeDetector) {
                scanAnimationId = requestAnimationFrame(scanNative);
            } else {
                setStatus('Usando ZXing como lector alternativo (modo escritorio).');
                scanner = new BrowserPDF417Reader();
                scanZXing();
            }

        } catch (error) {
            console.error('Error al iniciar cámara:', error);
            setStatus(`ERROR: ${error.message}`, true);
            stopScanning();
        }
    }

    async function scanNative() {
        if (!isScanning) return;

        try {
            const now = Date.now();
            if (now - lastScanTime < 500) {
                scanAnimationId = requestAnimationFrame(scanNative);
                return;
            }

            const barcodes = await barcodeDetector.detect(videoElement);

            if (barcodes.length > 0 && !codeDetected) {
                codeDetected = true;
                lastScanTime = now;
                handleScanResult(barcodes[0].rawValue);
                stopScanning();
                return;
            }
        } catch (err) {
            console.warn('Scan error (native):', err);
        }

        scanAnimationId = requestAnimationFrame(scanNative);
    }

    async function scanZXing() {
        try {
            const result = await scanner.decodeOnceFromVideoElement(videoElement);
            if (result && result.text) {
                codeDetected = true;
                handleScanResult(result.text);
                stopScanning();
            } else {
                setStatus('No se detectó ningún código. Intente de nuevo.', true);
            }
        } catch (err) {
            console.error('ZXing scan error:', err);
            setStatus('Error al escanear con ZXing: ' + err.message, true);
            stopScanning();
        }
    }

    function stopScanning() {
        if (scanAnimationId) cancelAnimationFrame(scanAnimationId);
        isScanning = false;

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
        }

        scanBtn.disabled = false;
        scanBtn.textContent = codeDetected ? 'Escanear Nuevo Código' : 'Iniciar Escaneo';
    }

    function handleScanResult(result) {
        console.log('Código detectado:', result);
        setStatus(`CÓDIGO DETECTADO:\n\n${result}\n\nProcesando información...`, false, true);
        fetchQRData(result);
    }

    async function fetchQRData(qrData) {
        try {
            const geo = await getGeolocation();
            setStatus(`${qrData}\n\nEnviando datos al servidor con ubicación...`, false, true);

            const response = await fetch('https://code-snap.duckdns.org/api/post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    info: qrData,
                    latitude: geo.latitude,
                    longitude: geo.longitude,
                    timestamp: new Date().toISOString()
                })
            });

            const data = await response.json();
            setStatus(`${qrData}\n\nRESPUESTA DEL SERVIDOR:\n${JSON.stringify(data, null, 2)}`, false, true);
        } catch (error) {
            console.error('Error al enviar datos:', error);
            setStatus(`${qrData}\n\nERROR AL ENVIAR:\n${error.message}`, true);
        }
    }

    function getGeolocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve({ latitude: 0, longitude: 0 });
            } else {
                navigator.geolocation.getCurrentPosition(
                    pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    () => resolve({ latitude: 0, longitude: 0 }),
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            }
        });
    }

    scanBtn.addEventListener('click', () => {
        if (isScanning) {
            stopScanning();
        } else {
            startScanning();
        }
    });

    window.addEventListener('beforeunload', stopScanning);
});