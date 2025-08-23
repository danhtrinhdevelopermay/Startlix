import FingerprintJS from '@fingerprintjs/fingerprintjs'

let fpPromise: Promise<FingerprintJS.Agent> | null = null;

// Initialize the agent at application startup.
function getFingerprintAgent(): Promise<FingerprintJS.Agent> {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load({
      // Use a custom endpoint if needed
      endpoint: undefined,
    });
  }
  return fpPromise;
}

// Get the visitor identifier when you need it.
export async function getDeviceFingerprint(): Promise<string> {
  try {
    const fp = await getFingerprintAgent();
    const result = await fp.get();
    
    // The visitor identifier
    return result.visitorId;
  } catch (error) {
    console.error('Error generating device fingerprint:', error);
    
    // Fallback: generate a simple fingerprint based on browser info
    const fallbackData = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.platform,
      navigator.cookieEnabled
    ].join('|');
    
    // Simple hash function for fallback
    let hash = 0;
    for (let i = 0; i < fallbackData.length; i++) {
      const char = fallbackData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}

// Check if device fingerprinting is supported
export function isDeviceFingerprintingSupported(): boolean {
  return typeof window !== 'undefined' && 
         typeof navigator !== 'undefined' && 
         typeof screen !== 'undefined';
}

// Get additional device info for enhanced detection
export function getDeviceInfo() {
  if (!isDeviceFingerprintingSupported()) {
    return null;
  }
  
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookieEnabled: navigator.cookieEnabled,
    localStorageEnabled: (() => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch {
        return false;
      }
    })()
  };
}