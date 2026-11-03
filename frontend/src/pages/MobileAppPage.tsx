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
  ShieldCheck,
  CheckCircle2,
  HardDriveDownload,
  Radio,
  ArrowRight
} from 'lucide-react';
import { api } from '../api/client';

export const MobileAppPage: React.FC = () => {
  const [networkIps, setNetworkIps] = useState<string[]>([]);
  const [primaryIp, setPrimaryIp] = useState<string>('');
  const [selectedUrlType, setSelectedUrlType] = useState<'wifi' | 'origin' | 'custom'>('wifi');
  const [customUrl, setCustomUrl] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [activePlatformTab, setActivePlatformTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [copied, setCopied] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

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
        console.warn('Network info error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getActiveUrl = (): string => {
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;

    if (selectedUrlType === 'wifi' && primaryIp) {
      return `${protocol}//${primaryIp}${port || ':4000'}`;
    }
    if (selectedUrlType === 'custom' && customUrl.trim()) {
      return customUrl.trim().startsWith('http') ? customUrl.trim() : `http://${customUrl.trim()}`;
    }
    return window.location.origin;
  };

  const activeUrl = getActiveUrl();

  useEffect(() => {
    QRCode.toDataURL(activeUrl, {
      width: 360,
      margin: 2,
      color: {
        dark: '#020617',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate QR Code:', err));
  }, [activeUrl]);

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
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-agri-400 text-xs font-bold uppercase tracking-wider mb-1">
          <Smartphone className="w-4 h-4" />
          <span>Mobile Progressive Web Application (PWA)</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Download AgriVault Mobile App & QR Code
        </h1>
        <p className="text-xs text-vault-400 mt-1 max-w-3xl leading-relaxed">
          Install AgriVault directly onto your Android, iPhone, iPad, or desktop computer. Scan the instant QR code below with your mobile phone camera to install the full native app with offline caching and live telemetry.
        </p>
      </div>

      {/* PWA Native Direct Install Banner */}
      {installPrompt && !isInstalled && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-agri-950 via-emerald-950/80 to-vault-900 border border-agri-500/50 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-agri-500/20 text-agri-400 flex items-center justify-center shrink-0 border border-agri-500/30">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Direct Installation Ready!</h3>
              <p className="text-xs text-vault-300 mt-0.5">
                Your current browser supports one-click Progressive Web App installation with full desktop / mobile system integration.
              </p>
            </div>
          </div>
          <button
            onClick={handleTriggerInstall}
            className="w-full md:w-auto px-5 py-2.5 bg-agri-500 hover:bg-agri-400 text-vault-950 font-black text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-2 shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Install AgriVault App Now</span>
          </button>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: QR Code & Connection Settings */}
        <div className="lg:col-span-5 bg-vault-900 border border-vault-800 rounded-2xl p-6 shadow-xl flex flex-col items-center text-center">
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-agri-500/15 text-agri-300 border border-agri-500/30 uppercase tracking-wider mb-4">
            Instant Phone QR Scanner
          </span>

          <div className="p-4 bg-white rounded-2xl shadow-2xl border-4 border-slate-300 relative group">
            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt="AgriVault Mobile Download QR"
                className="w-64 h-64 object-contain rounded-lg"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center text-slate-400">
                <QrCode className="w-12 h-12 animate-pulse" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-xl bg-vault-950 border-2 border-agri-400 flex items-center justify-center shadow-xl">
                <img src="/icons/logo.png" alt="AgriVault" className="w-8 h-8 object-contain" />
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs font-bold text-white flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-agri-400" />
            <span>Scan with Camera or Google Lens</span>
          </p>
          <p className="text-[11px] text-vault-400 mt-1 max-w-xs">
            Directly launches AgriVault in mobile full-screen mode on any iOS or Android phone.
          </p>

          {/* Network IP Target Controller */}
          <div className="w-full mt-6 pt-5 border-t border-vault-800 text-left space-y-3">
            <label className="text-xs font-bold text-slate-300 block">
              Network Target for Phone Connection:
            </label>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setSelectedUrlType('wifi')}
                className={`py-2 px-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                  selectedUrlType === 'wifi'
                    ? 'bg-agri-500/20 text-agri-300 border border-agri-500/50 font-bold'
                    : 'bg-vault-950 text-vault-400 hover:text-slate-200 border border-vault-800'
                }`}
              >
                <Wifi className="w-4 h-4" />
                <span>Wi-Fi LAN IP</span>
              </button>

              <button
                onClick={() => setSelectedUrlType('origin')}
                className={`py-2 px-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                  selectedUrlType === 'origin'
                    ? 'bg-agri-500/20 text-agri-300 border border-agri-500/50 font-bold'
                    : 'bg-vault-950 text-vault-400 hover:text-slate-200 border border-vault-800'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>Current Host</span>
              </button>
            </div>

            {selectedUrlType === 'wifi' && primaryIp && (
              <div className="p-2.5 rounded-lg bg-vault-950 border border-vault-800 text-xs">
                <span className="text-vault-400 block text-[10px] uppercase font-mono">Detected Local IP:</span>
                <span className="text-agri-300 font-mono font-bold text-sm">{primaryIp}</span>
                <p className="text-[10px] text-vault-500 mt-0.5">
                  Ensure phone is connected to the same Wi-Fi network.
                </p>
              </div>
            )}

            {/* URL Display with Copy Button */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={activeUrl}
                className="flex-1 bg-vault-950 border border-vault-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 truncate outline-none select-all"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 bg-vault-800 hover:bg-vault-700 text-slate-200 rounded-lg border border-vault-700 text-xs font-semibold transition flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Guided Installation Walkthrough */}
        <div className="lg:col-span-7 space-y-6">

          {/* Installation Platform Tabs */}
          <div className="bg-vault-900 border border-vault-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex border-b border-vault-800 gap-3 pb-3">
              <button
                onClick={() => setActivePlatformTab('android')}
                className={`pb-2 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  activePlatformTab === 'android'
                    ? 'border-agri-500 text-agri-400'
                    : 'border-transparent text-vault-400 hover:text-slate-300'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Android Installation</span>
              </button>

              <button
                onClick={() => setActivePlatformTab('ios')}
                className={`pb-2 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
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
                className={`pb-2 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  activePlatformTab === 'desktop'
                    ? 'border-agri-500 text-agri-400'
                    : 'border-transparent text-vault-400 hover:text-slate-300'
                }`}
              >
                <HardDriveDownload className="w-4 h-4 text-blue-400" />
                <span>Offline File Bundle</span>
              </button>
            </div>

            {/* Android Guide */}
            {activePlatformTab === 'android' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-vault-950 border border-vault-800">
                  <span className="w-6 h-6 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Scan the QR code with phone camera</h4>
                    <p className="text-[11px] text-vault-400 mt-0.5">
                      Open your Android camera or Google Lens, point it at the QR code, and tap the link to open in <strong>Google Chrome</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-vault-950 border border-vault-800">
                  <span className="w-6 h-6 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Tap "Install App" or "Add to Home screen"</h4>
                    <p className="text-[11px] text-vault-400 mt-0.5">
                      A prompt at the bottom of Chrome will appear saying <strong>"Install AgriVault"</strong>. If not visible, tap Chrome's three dots menu (⋮) in the top-right and select <strong>"Install App"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-vault-950 border border-vault-800">
                  <span className="w-6 h-6 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Instant Home Screen Launch</h4>
                    <p className="text-[11px] text-vault-400 mt-0.5">
                      AgriVault will be installed onto your home screen and launcher. It opens in pure standalone mode with full screen, dark theme, and offline sensor caching!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* iOS Guide */}
            {activePlatformTab === 'ios' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-vault-950 border border-vault-800">
                  <span className="w-6 h-6 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Scan QR code using iPhone Camera</h4>
                    <p className="text-[11px] text-vault-400 mt-0.5">
                      Open your iPhone Camera app, aim at the QR code, and tap the notification banner to open the page in <strong>Safari</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-vault-950 border border-vault-800">
                  <span className="w-6 h-6 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Tap the Safari Share Icon</span>
                      <Share2 className="w-3.5 h-3.5 text-blue-400 inline" />
                    </h4>
                    <p className="text-[11px] text-vault-400 mt-0.5">
                      At the bottom bar of Safari, tap the <strong>Share</strong> icon (the square with an arrow pointing up).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-vault-950 border border-vault-800">
                  <span className="w-6 h-6 rounded-full bg-agri-500/20 text-agri-400 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Select "Add to Home Screen"</span>
                      <PlusSquare className="w-3.5 h-3.5 text-agri-400 inline" />
                    </h4>
                    <p className="text-[11px] text-vault-400 mt-0.5">
                      Scroll down the list and tap <strong>"Add to Home Screen"</strong>, then tap <strong>"Add"</strong> in the top-right corner.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Offline Bundle Guide */}
            {activePlatformTab === 'desktop' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-vault-950 border border-vault-800 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <HardDriveDownload className="w-4 h-4 text-agri-400" />
                    <span>Self-Contained Standalone Single-File App</span>
                  </h4>
                  <p className="text-xs text-vault-400 leading-relaxed">
                    Download the pre-compiled, self-contained single-file HTML bundle. You can transfer this single file to any USB drive, tablet, or offline computer and run the complete AgriVault monitoring console completely offline without any node server or internet connection.
                  </p>
                  <div className="pt-1">
                    <a
                      href="/agrivault_single.html"
                      download="AgriVault-Standalone-App.html"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-agri-600 hover:bg-agri-500 text-white font-bold text-xs rounded-xl transition shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Offline HTML App (agrivault_single.html)</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-vault-900 border border-vault-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h5 className="text-xs font-bold text-white">Full Offline Cache</h5>
              <p className="text-[11px] text-vault-400 mt-1">
                Local storage mesh caches sensor graphs and rules even with zero internet.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-vault-900 border border-vault-800">
              <div className="w-8 h-8 rounded-lg bg-agri-500/10 text-agri-400 flex items-center justify-center mb-2">
                <Radio className="w-4 h-4" />
              </div>
              <h5 className="text-xs font-bold text-white">Live Real-Time Sync</h5>
              <p className="text-[11px] text-vault-400 mt-1">
                Sub-second WebSockets and MQTT telemetry straight to your smartphone.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-vault-900 border border-vault-800">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2">
                <Sparkles className="w-4 h-4" />
              </div>
              <h5 className="text-xs font-bold text-white">AI Room Planner</h5>
              <p className="text-[11px] text-vault-400 mt-1">
                Plan room sensor placement and crop safe ranges directly on mobile.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
