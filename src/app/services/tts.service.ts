import { Injectable } from '@angular/core';

interface TTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
  lang?: string;
  preferredGender?: 'female' | 'male';
}

interface UserLevel {
  speaking: number;
  writing: number;
  grammar: number;
  vocabulary: number;
}

@Injectable({
  providedIn: 'root'
})
export class TtsService {
  private speechSynthesis: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private speechQueue: string[] = [];
  private defaultTTSOptions: TTSOptions = {
    rate: 1,
    pitch: 1,
    volume: 1,
    lang: 'en-US',
    preferredGender: 'female'
  };
  private isSpeaking = false;

  constructor() {
    this.speechSynthesis = window.speechSynthesis;
    this.loadVoices();

    speechSynthesis.addEventListener('voiceschanged', () => {
      this.loadVoices();
    });
  }

  private loadVoices(): void {
    this.voices = this.speechSynthesis.getVoices();
    this.defaultTTSOptions.voice = this.voices.find(
      voice => voice.lang.startsWith('en') && voice.default
    );
  }

  async handleTTS(message: string, userLevel: UserLevel): Promise<void> {
    try {
      const chunks = message.match(/.{1,200}(?=\s|$)/g) || [];
      this.speechQueue.push(...chunks);

      if (!this.isSpeaking) {
        await this.processQueue(userLevel);
      }
    } catch (error) {
      console.error('Error in TTS:', error);
    }
  }

  private async processQueue(userLevel: UserLevel): Promise<void> {
    while (this.speechQueue.length > 0) {
      const chunk = this.speechQueue[0];
      const ttsOptions = this.getTTSOptionsForLevel(userLevel);

      try {
        this.isSpeaking = true;
        await this.speakText(chunk, ttsOptions);
        this.speechQueue.shift();
      } catch (error) {
        console.error('Speech error:', error);
        this.speechQueue = [];
      } finally {
        this.isSpeaking = false;
      }
    }
  }

  private async speakText(text: string, options: TTSOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.stopSpeech();

        const utterance = new SpeechSynthesisUtterance(text);
        Object.assign(utterance, options);

        utterance.onend = () => resolve();
        utterance.onerror = (error) => reject(error);

        setTimeout(() => {
          this.speechSynthesis.speak(utterance);
        }, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  private getTTSOptionsForLevel(userLevel: UserLevel): TTSOptions {
    const weightedAverage = (
      (userLevel.speaking * 2) +
      userLevel.vocabulary +
      userLevel.grammar
    ) / 4;

    const options: TTSOptions = { ...this.defaultTTSOptions };

    if (userLevel.speaking <= 2) {
      options.rate = 0.7 + (weightedAverage * 0.1);
    } else if (userLevel.speaking <= 3) {
      options.rate = 0.8 + (weightedAverage * 0.1);
    } else {
      options.rate = 0.9 + (weightedAverage * 0.1);
    }

    options.pitch = 1.0;
    options.volume = 1.0;

    if (this.voices.length > 0) {
      options.voice = this.getBestVoiceForLevel(userLevel);
    }

    return options;
  }

  private getBestVoiceForLevel(userLevel: UserLevel): SpeechSynthesisVoice | undefined {
    const voices = this.getAvailableVoices();
    if (voices.length === 0) return undefined;

    const preferredVoices = this.filterVoicesByGender(voices, this.defaultTTSOptions.preferredGender);
    if (preferredVoices.length === 0) return voices[0];

    if (userLevel.speaking <= 2) {
      return preferredVoices.find(voice =>
        voice.name.toLowerCase().includes('clear') ||
        voice.name.toLowerCase().includes('precise')
      ) || preferredVoices[0];
    }

    return preferredVoices.find(voice => voice.default) || preferredVoices[0];
  }

  private filterVoicesByGender(voices: SpeechSynthesisVoice[], preferredGender?: 'female' | 'male'): SpeechSynthesisVoice[] {
    if (!preferredGender) return voices;

    const femaleIndicators = ['female', 'woman', 'girl', 'samantha', 'victoria', 'karen', 'moira', 'tessa'];
    const maleIndicators = ['male', 'man', 'guy', 'daniel', 'david', 'james', 'john', 'peter'];
    const indicators = preferredGender === 'female' ? femaleIndicators : maleIndicators;

    return voices.filter(voice =>
      indicators.some(indicator =>
        voice.name.toLowerCase().includes(indicator) ||
        voice.voiceURI.toLowerCase().includes(indicator)
      )
    );
  }

  pauseSpeech(): void {
    this.speechSynthesis.pause();
  }

  resumeSpeech(): void {
    this.speechSynthesis.resume();
  }

  stopSpeech(): void {
    this.speechSynthesis.cancel();
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter(voice => voice.lang.startsWith('en'));
  }

  setVoiceGender(gender: 'female' | 'male'): void {
    this.defaultTTSOptions.preferredGender = gender;
  }

  getVoiceGender(): 'female' | 'male' | undefined {
    return this.defaultTTSOptions.preferredGender;
  }

  updateTTSOptions(options: TTSOptions): void {
    this.defaultTTSOptions = { ...this.defaultTTSOptions, ...options };
  }
}
