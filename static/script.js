// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js')
            .then(registration => {
                console.log('SW registered');
            })
            .catch(error => {
                console.log('SW registration failed');
            });
    });
}

// Update current time
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('time').textContent = timeString;
}

setInterval(updateTime, 1000);
updateTime();

// Set alarm
document.getElementById('set-alarm').addEventListener('click', function() {
    const time = document.getElementById('alarm-time').value;
    const message = document.getElementById('alarm-message').value;

    if (!time || !message) {
        alert('Please fill in both time and message');
        return;
    }

    // Store in localStorage for offline functionality
    const alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
    alarms.push({ time: time, message: message, triggered: false });
    localStorage.setItem('alarms', JSON.stringify(alarms));

    // Try to sync with server if online
    if (navigator.onLine) {
        fetch('/set_alarm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ time: time, message: message }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                updateAlarmsList();
                document.getElementById('alarm-time').value = '';
                document.getElementById('alarm-message').value = '';
            }
        });
    } else {
        updateAlarmsList();
        document.getElementById('alarm-time').value = '';
        document.getElementById('alarm-message').value = '';
        alert('Alarm set offline - will work when app is open');
    }
});

// Update alarms list
function updateAlarmsList() {
    const alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
    const alarmsList = document.getElementById('alarms');
    alarmsList.innerHTML = '';

    alarms.forEach((alarm, index) => {
        const li = document.createElement('li');
        li.textContent = `${alarm.time} - ${alarm.message}`;
        if (alarm.triggered) {
            li.style.textDecoration = 'line-through';
            li.style.color = '#888';
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.marginLeft = '10px';
        deleteBtn.style.backgroundColor = '#f44336';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.padding = '5px 10px';
        deleteBtn.style.borderRadius = '3px';
        deleteBtn.style.cursor = 'pointer';

        deleteBtn.addEventListener('click', () => {
            alarms.splice(index, 1);
            localStorage.setItem('alarms', JSON.stringify(alarms));
            updateAlarmsList();
        });

        li.appendChild(deleteBtn);
        alarmsList.appendChild(li);
    });
}

// Audio recording (offline-capable)
let mediaRecorder;
let audioChunks = [];

document.getElementById('record-btn').addEventListener('click', function() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        document.getElementById('recording-status').textContent = 'Recording stopped. Processing...';
    } else {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.start();
                document.getElementById('recording-status').textContent = 'Recording... Click again to stop.';

                audioChunks = [];
                mediaRecorder.addEventListener('dataavailable', event => {
                    audioChunks.push(event.data);
                });

                mediaRecorder.addEventListener('stop', () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);

                    // Display recorded audio
                    document.getElementById('recording-result').innerHTML = `<audio controls src="${audioUrl}"></audio>`;
                    document.getElementById('recording-status').textContent = 'Recording complete. Click to record again.';

                    // Try offline speech recognition first
                    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
                        recognition.continuous = false;
                        recognition.interimResults = false;
                        recognition.lang = 'en-US';

                        recognition.onresult = (event) => {
                            const transcript = event.results[0][0].transcript;
                            document.getElementById('alarm-message').value = transcript;
                        };

                        recognition.onerror = () => {
                            // Fallback to server if offline speech recognition fails
                            if (navigator.onLine) {
                                const formData = new FormData();
                                formData.append('audio', audioBlob);

                                fetch('/record_audio', {
                                    method: 'POST',
                                    body: formData,
                                })
                                .then(response => response.json())
                                .then(data => {
                                    if (data.text) {
                                        document.getElementById('alarm-message').value = data.text;
                                    } else if (data.error) {
                                        alert('Error: ' + data.error);
                                    }
                                });
                            } else {
                                alert('Offline speech recognition failed. Please try again or enter message manually.');
                            }
                        };

                        // Create audio element for recognition
                        const audio = new Audio(audioUrl);
                        audio.onloadeddata = () => {
                            recognition.start();
                        };
                    } else if (navigator.onLine) {
                        // Fallback to server
                        const formData = new FormData();
                        formData.append('audio', audioBlob);

                        fetch('/record_audio', {
                            method: 'POST',
                            body: formData,
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.text) {
                                document.getElementById('alarm-message').value = data.text;
                            } else if (data.error) {
                                alert('Error: ' + data.error);
                            }
                        });
                    } else {
                        alert('Speech recognition not available offline. Please enter message manually.');
                    }
                });
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
                alert('Error accessing microphone. Please check permissions.');
            });
    }
});

// Check for alarms every minute (works offline)
setInterval(() => {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-GB', { hour12: false }).substring(0, 5); // HH:MM format

    const alarms = JSON.parse(localStorage.getItem('alarms') || '[]');

    alarms.forEach(alarm => {
        if (alarm.time === currentTime && !alarm.triggered) {
            alarm.triggered = true;
            localStorage.setItem('alarms', JSON.stringify(alarms));

            // Trigger alarm notification
            if (Notification.permission === 'granted') {
                new Notification('Alarm!', { body: alarm.message });
            }

            // Play alarm sound (using Web Speech API for offline speech synthesis)
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(alarm.message);
                speechSynthesis.speak(utterance);
            } else {
                // Fallback: try to play a beep sound
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.type = 'square';

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 2);
            }

            updateAlarmsList();
        }
    });

    // Also try server check if online
    if (navigator.onLine) {
        fetch('/check_alarms')
        .then(response => response.json())
        .then(data => {
            if (data.alarms && data.alarms.length > 0) {
                // Handle server-side alarms
            }
        })
        .catch(() => {
            // Offline, continue with local storage
        });
    }
}, 60000);

// Request notification permission
if ('Notification' in window) {
    Notification.requestPermission();
}

// Load alarms on page load
document.addEventListener('DOMContentLoaded', updateAlarmsList);