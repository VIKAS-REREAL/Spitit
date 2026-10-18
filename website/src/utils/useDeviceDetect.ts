import { useState, useEffect } from 'react';

export type OperatingSystem = 'windows' | 'mac' | 'ios' | 'android' | 'linux' | 'unknown';

export interface DeviceInfo {
  os: OperatingSystem;
  osName: string;
  isWindows: boolean;
  isMac: boolean;
  isMobile: boolean;
  isSupported: boolean;
}

export function useDeviceDetect(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    os: 'windows',
    osName: 'Windows',
    isWindows: true,
    isMac: false,
    isMobile: false,
    isSupported: true,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent.toLowerCase();
    const platform = window.navigator.platform?.toLowerCase() || '';

    let os: OperatingSystem = 'unknown';
    let osName = 'Your Device';
    let isMobile = false;

    if (/iphone|ipad|ipod/.test(ua)) {
      os = 'ios';
      osName = 'iOS';
      isMobile = true;
    } else if (/android/.test(ua)) {
      os = 'android';
      osName = 'Android';
      isMobile = true;
    } else if (/mac|macintosh|macintel/.test(ua) || /mac/.test(platform)) {
      os = 'mac';
      osName = 'macOS';
    } else if (/win|windows/.test(ua) || /win/.test(platform)) {
      os = 'windows';
      osName = 'Windows';
    } else if (/linux/.test(ua) || /linux/.test(platform)) {
      os = 'linux';
      osName = 'Linux';
    }

    setDeviceInfo({
      os,
      osName,
      isWindows: os === 'windows',
      isMac: os === 'mac',
      isMobile,
      isSupported: os === 'windows',
    });
  }, []);

  return deviceInfo;
}
