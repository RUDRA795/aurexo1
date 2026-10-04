/**
 * ORCA Indic Multilingual Voice & Speech Processing Engine
 * Supports seamless speech-to-text recognition and text-to-speech synthesis
 * for Indian regional maritime languages.
 */

export interface IndicLanguage {
  code: string; // BCP-47 tag
  name: string;
  nativeName: string;
  flag: string;
  unicodeRange?: [number, number];
}

export const INDIC_LANGUAGES: IndicLanguage[] = [
  { code: 'en-IN', name: 'English (India)', nativeName: 'English', flag: '🇮🇳' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', unicodeRange: [0x0900, 0x097f] },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', unicodeRange: [0x0b80, 0x0bff] },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', unicodeRange: [0x0c00, 0x0c7f] },
  { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', unicodeRange: [0x0d00, 0x0d7f] },
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳', unicodeRange: [0x0980, 0x09ff] },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', unicodeRange: [0x0900, 0x097f] },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳', unicodeRange: [0x0a80, 0x0aff] },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', unicodeRange: [0x0c80, 0x0cff] },
  { code: 'or-IN', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', flag: '🇮🇳', unicodeRange: [0x0b00, 0x0b7f] },
];

/**
 * Automatically inspects text and detects matching Indic script
 */
export function detectIndicLanguage(text: string): IndicLanguage {
  if (!text) return INDIC_LANGUAGES[0];

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    for (const lang of INDIC_LANGUAGES) {
      if (lang.unicodeRange && code >= lang.unicodeRange[0] && code <= lang.unicodeRange[1]) {
        return lang;
      }
    }
  }

  // Fallback to English (India)
  return INDIC_LANGUAGES[0];
}

/**
 * Cleans markdown formatting characters (asterisks, hashtags, bullets) so TTS reads natural prose
 */
export function cleanTextForSpeech(markdownText: string): string {
  return markdownText
    .replace(/[*#_`~[\]()<>]/g, ' ')
    .replace(/•/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Synthesizes speech using the browser Web Speech API
 * Returns a cancel/stop function.
 */
export function speakText(
  text: string,
  langCode: string = 'en-IN',
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onError) onError(new Error('Speech synthesis not supported on this browser'));
    return () => {};
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const clean = cleanTextForSpeech(text);
  if (!clean) return () => {};

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = langCode;
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Try to find a matching voice if available
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find((v) => v.lang === langCode || v.lang.replace('_', '-').startsWith(langCode.slice(0, 2)));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.onstart = () => {
    if (onStart) onStart();
  };

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = (e) => {
    if (onError) onError(e);
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
    if (onEnd) onEnd();
  };
}
