import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  QrCode,
  Download,
  Copy,
  Check,
  Globe,
  Wifi,
  Apple,
  Share2,
  PlusSquare,
  Sparkles,
  ExternalLink,
  X,
  Layers,
  ShieldCheck,
  CheckCircle2,
  HardDriveDownload
} from 'lucide-react';
import { api } from '../api/client';

interface MobileAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileAppModal: React.FC<MobileAppModalProps> = ({ isOpen, onClose }) => {
  const [networkIps, setNetworkIps] = useState<string[]>([]);
  const [primaryIp, setPrimaryIp] = useState<string>('');
  const [selectedUrlType, setSelectedUrlType] = useState<'wifi' | 'origin' | 'custom'>('wifi');
  const [customUrl, setCustomUrl] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [activePlatformTab, setActivePlatformTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [copied, setCopied] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Capture PWA beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Fetch host network info from backend
  useEffect(() => {
    let isMounted = true;
    api.getNetworkInfo()
      .then((info) => {
        if (!isMounted) return;
        if (info && info.availableIps && info.availableIps.length > 0) {
          setNetworkIps(info.availableIps);
          setPrimaryIp(info.primaryIp || info.availableIps[0]);
        }
      })
      .catch((err) => {
        console.warn('Network info not reachable, fallback to origin:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Determine effective download URL
  const getActiveUrl = (): string => {
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;

    if (selectedUrlType === 'wifi' && primaryIp) {
      // If running through Vite dev (port 5173) or Backend (port 4000)
      return `${protocol}//${primaryIp}${port || ':4000'}`;
    }
    if (selectedUrlType === 'custom' && customUrl.trim()) {
      return customUrl.trim().startsWith('http') ? customUrl.trim() : `http://${customUrl.trim()}`;
    }
    return window.location.origin;
  };

  const activeUrl = getActiveUrl();

  // Generate QR Code on URL change
  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(activeUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#030712',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate QR Code:', err));
  }, [activeUrl, isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTriggerInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallSuccess(true);
      setInstallPrompt(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-vault-900 border border-vault-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-vault-800 flex items-center justify-between bg-vault-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-agri-500/10 border border-agri-500/30 flex items-center justify-center text-agri-400 shadow-inner">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Download AgriVault Mobile App
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-agri-500/20 text-agri-300 border border-agri-500/40">
                  PWA Mobile
                </span>
              </div>
              <p className="text-xs text-vault-400">
                Scan with your phone camera to launch & install the full native app instantly
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-vault-400 hover:text-white hover:bg-vault-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Native PWA Direct Install Banner (if supported on this device) */}
          {installPrompt && !isInstalled && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-agri-950/80 via-emerald-950/60 to-vault-900 border border-agri-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-agri-950/40">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-agri-500/20 text-agri-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">This Device Can Install Directly!</p>
                  <p className="text-[11px] text-vault-300">
                    Click below to install AgriVault as a standalone desktop or mobile application.
                  </p>
                </div>
              </div>
              <button
                onClick={handleTriggerInstall}
                className="w-full sm:w-auto px-4 py-2 bg-agri-500 hover:bg-agri-400 text-vault-950 font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-2 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Install AgriVault App</span>
              </button>
            </div>
          )}

          {isInstalled && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>AgriVault is already installed on this device as a Progressive Web App!</span>
            </div>
          )}

          {/* Main Grid: QR Code Left + Instructions Right */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* Left: QR Code Card */}
            <div className="md:col-span-5 flex flex-col items-center text-center p-5 rounded-2xl bg-vault-950 border border-vault-800 shadow-inner">
              <div className="relative p-3 bg-white rounded-xl shadow-xl border-4 border-slate-200">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Scan QR code to install AgriVault"
                    className="w-56 h-56 object-contain rounded"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-vault-500">
                    <QrCode className="w-12 h-12 animate-pulse" />
                  </div>
                )}
                {/* Center Badge Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-lg bg-vault-950 border-2 border-agri-400 flex items-center justify-center shadow-lg">
                    <img src="/icons/logo.png" alt="AgriVault" className="w-6 h-6 object-contain" />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-agri-400">
                <QrCode className="w-4 h-4" />
                <span>Point Phone Camera to Scan</span>
              </div>
              <p className="text-[11px] text-vault-400 mt-1 max-w-[240px]">
                Works with any Android camera, iPhone Camera app, or Google Lens
              </p>

              {/* URL Switcher Selector */}
              <div className="w-full mt-4 pt-4 border-t border-vault-800 space-y-2">
                <label className="text-[11px] font-semibold text-vault-400 block text-left">
                  QR Code Target Address:
                </label>

                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    onClick={() => setSelectedUrlType('wifi')}
                    className={`py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                      selectedUrlType === 'wifi'
                        ? 'bg-agri-500/20 text-agri-300 border border-agri-500/50 font-bold'
                        : 'bg-vault-850 text-vault-400 hover:text-slate-200 border border-vault-700'
                    }`}
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Local Wi-Fi IP</span>
                  </button>

                  <button
                    onClick={() => setSelectedUrlType('origin')}
                    className={`py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                      selectedUrlType === 'origin'
                        ? 'bg-agri-500/20 text-agri-300 border border-agri-500/50 font-bold'
                        : 'bg-vault-850 text-vault-400 hover:text-slate-200 border border-vault-700'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Current Host</span>
                  </button>
                </div>

                {/* Network IP Info Display */}
                {selectedUrlType === 'wifi' && primaryIp && (
                  <p className="text-[10px] text-agri-400 font-mono text-left bg-agri-950/40 p-1.5 rounded border border-agri-900 truncate">
                    LAN IP: {primaryIp}
                  </p>
                )}

                {/* Direct Link Copy Bar */}
                <div className="flex items-center gap-1 mt-2">
                  <div className="flex-1 bg-vault-900 border border-vault-800 rounded px-2.5 py-1.5 text-[10px] font-mono text-slate-300 truncate text-left">
                    {activeUrl}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1.5 bg-vault-800 hover:bg-vault-700 text-vault-200 rounded border border-vault-700 text-xs transition flex items-center gap-1 shrink-0"
                    title="Copy URL"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Installation Instructions & Capabilities */}
            <div className="md:col-span-7 space-y-4">

              {/* Platform Switcher Tabs */}
              <div className="flex border-b border-vault-800 gap-2">
                <button
                  onClick={() => setActivePlatformTab('android')}
                  className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                    activePlatformTab === 'android'
                      ? 'border-agri-500 text-agri-400'
                      : 'border-transparent text-vault-400 hover:text-slate-300'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Android Phones</span>
                </button>

                <button
                  onClick={() => setActivePlatformTab('ios')}
                  className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                    activePlatformTab === 'ios'
                      ? 'border-agri-500 text-agri-400'
                      : 'border-transparent text-vault-400 hover:text-slate-300'
                  }`}
                >
                  <Apple className="w-4 h-4 text-slate-200" />
                  <span>iPhone / iPad (iOS)</span>
                </button>

                <button
                  onClick={() => setActivePlatformTab('desktop')}
                  className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                    activePlatformTab === 'desktop'
                      ? 'border-agri-500 text-agri-400'
                      : 'border-transparent text-vault-400 hover:text-slate-300'
                  }`}
                >
                  <HardDriveDownload className="w-4 h-4 text-blue-400" />
                  <span>Offline App Bundle</span>
                </button>
              </div>

              {/* Tab 1: Android Instructions */}
              {activePlatformTab === 'android' && (
                <div className="space-y-3">
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-vault-950 border border-vault-800">
                      <span className="w-5 h-5 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                        1
                      </span>
                      <div>
                        <p className="font-semibold text-white">Scan the QR Code</p>
                        <p className="text-vault-400 text-[11px] mt-0.5">
                          Open your camera, point at the QR code on the left, and tap the link to open in Google Chrome.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-vault-950 border border-vault-800">
                      <span className="w-5 h-5 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                        2
                      </span>
                      <div>
                        <p className="font-semibold text-white">Tap "Install App" or "Add to Home screen"</p>
                        <p className="text-vault-400 text-[11px] mt-0.5">
                          A banner saying <strong>"Install AgriVault"</strong> will appear at the bottom. Or tap Chrome's three dots menu (⋮) and choose <strong>"Install App"</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-vault-950 border border-vault-800">
                      <span className="w-5 h-5 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                        3
                      </span>
                      <div>
                        <p className="font-semibold text-white">Launch Full-Screen App</p>
                        <p className="text-vault-400 text-[11px] mt-0.5">
                          AgriVault will install directly onto your home screen and app drawer. It launches instantly in full-screen mode with zero browser address bar and offline caching!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Apple iOS Instructions */}
              {activePlatformTab === 'ios' && (
                <div className="space-y-3">
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-vault-950 border border-vault-800">
                      <span className="w-5 h-5 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                        1
                      </span>
                      <div>
                        <p className="font-semibold text-white">Scan with iPhone Camera</p>
                        <p className="text-vault-400 text-[11px] mt-0.5">
                          Open the native Camera app on your iPhone or iPad, scan the QR code, and tap the notification banner to open in <strong>Safari</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-vault-950 border border-vault-800">
                      <span className="w-5 h-5 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                        2
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-white">
                          <span>Tap the Share Button</span>
                          <Share2 className="w-3.5 h-3.5 text-blue-400 inline" />
                        </div>
                        <p className="text-vault-400 text-[11px] mt-0.5">
                          In Safari's bottom toolbar, tap the <strong>Share</strong> button (the square icon with an upward-pointing arrow).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-vault-950 border border-vault-800">
                      <span className="w-5 h-5 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                        3
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-white">
                          <span>Select "Add to Home Screen"</span>
                          <PlusSquare className="w-3.5 h-3.5 text-agri-400 inline" />
                        </div>
                        <p className="text-vault-400 text-[11px] mt-0.5">
                          Scroll down the share sheet and tap <strong>"Add to Home Screen"</strong>, then tap <strong>"Add"</strong> in the top right corner.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Offline Standalone App Bundle */}
              {activePlatformTab === 'desktop' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-vault-950 border border-vault-800 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <HardDriveDownload className="w-4 h-4 text-agri-400" />
                      <span>Download Standalone Offline File</span>
                    </div>
                    <p className="text-[11px] text-vault-400 leading-relaxed">
                      AgriVault includes an ultra-portable, single-file HTML bundle. You can download this single HTML file onto your smartphone, laptop, or tablet and run the entire storage intelligence monitoring suite completely offline with zero server dependencies!
                    </p>
                    <div className="pt-2">
                      <a
                        href="/agrivault_single.html"
                        download="AgriVault-Mobile-Offline.html"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-agri-600 hover:bg-agri-500 text-white font-bold text-xs rounded-lg transition shadow-md"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Standalone HTML App (.html)</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* App Capabilities Badges */}
              <div className="pt-3 border-t border-vault-800">
                <p className="text-[11px] font-semibold text-vault-400 uppercase tracking-wider mb-2">
                  Mobile App Features & Capabilities
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-vault-950/60 border border-vault-800/80 flex items-center gap-2 text-slate-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-agri-400" />
                    <span>100% Offline Service Worker</span>
                  </div>
                  <div className="p-2 rounded bg-vault-950/60 border border-vault-800/80 flex items-center gap-2 text-slate-300">
                    <Smartphone className="w-3.5 h-3.5 text-agri-400" />
                    <span>Native Full-Screen App Icon</span>
                  </div>
                  <div className="p-2 rounded bg-vault-950/60 border border-vault-800/80 flex items-center gap-2 text-slate-300">
                    <Wifi className="w-3.5 h-3.5 text-agri-400" />
                    <span>Real-Time Local Wi-Fi Telemetry</span>
                  </div>
                  <div className="p-2 rounded bg-vault-950/60 border border-vault-800/80 flex items-center gap-2 text-slate-300">
                    <Layers className="w-3.5 h-3.5 text-agri-400" />
                    <span>AI Room & Node Planner Access</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-vault-950 border-t border-vault-800 flex items-center justify-between text-xs">
          <span className="text-vault-400 text-[11px]">
            AgriVault PWA Version 1.0.0 • Embedded Offline Telemetry Mesh
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
