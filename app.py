from flask import Flask, render_template, request, jsonify, send_file
import datetime
import threading
import time
import os
from gtts import gTTS
import speech_recognition as sr
import pygame
import io

app = Flask(__name__)

alarms = []

def check_alarms():
    while True:
        now = datetime.datetime.now().strftime('%H:%M')
        for alarm in alarms:
            if alarm['time'] == now and not alarm['triggered']:
                alarm['triggered'] = True
                speak_alarm(alarm['message'])
        time.sleep(60)  # Check every minute

def speak_alarm(message):
    tts = gTTS(text=message, lang='en')
    tts.save("static/alarm.mp3")
    # Initialize pygame mixer if not already done
    if not pygame.mixer.get_init():
        pygame.mixer.init()
    # Play the alarm sound
    pygame.mixer.music.load("static/alarm.mp3")
    pygame.mixer.music.play()

threading.Thread(target=check_alarms, daemon=True).start()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/set_alarm', methods=['POST'])
def set_alarm():
    data = request.json
    alarm_time = data['time']
    message = data['message']
    alarms.append({'time': alarm_time, 'message': message, 'triggered': False})
    return jsonify({'status': 'success'})

@app.route('/record_audio', methods=['POST'])
def record_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'})
    
    audio_file = request.files['audio']
    r = sr.Recognizer()
    
    try:
        with sr.AudioFile(audio_file) as source:
            audio = r.record(source)
        text = r.recognize_google(audio)
        return jsonify({'text': text})
    except sr.UnknownValueError:
        return jsonify({'error': 'Could not understand audio'})
    except sr.RequestError as e:
        return jsonify({'error': 'Could not request results from Google Speech Recognition service'})
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/check_alarms')
def check_alarms_endpoint():
    now = datetime.datetime.now().strftime('%H:%M')
    triggered_alarms = [alarm for alarm in alarms if alarm['time'] == now and not alarm['triggered']]
    for alarm in triggered_alarms:
        alarm['triggered'] = True
    return jsonify({'alarms': triggered_alarms})

@app.route('/alarm_sound')
def alarm_sound():
    return send_file('static/alarm.mp3', mimetype='audio/mpeg')

if __name__ == '__main__':
    app.run(debug=True)