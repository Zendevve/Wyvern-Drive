import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  Infinity as InfinityIcon,
  UserCheck,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Sparkles,
  Key,
  Radio,
} from 'lucide-react';
import { AppSettings, WebhookInfo } from '../types';
import { api } from '../services/api';

interface OnboardingWizardProps {
  onComplete: (settings: AppSettings) => void;
  onCancel?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<number>(1);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [masterKey, setMasterKey] = useState<string>('wyvern-vault-' + Math.random().toString(36).slice(2, 10));
  const [encryptionEnabled, setEncryptionEnabled] = useState<boolean>(true);
  const [testingWebhook, setTestingWebhook] = useState<boolean>(false);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const testWebhook = async () => {
    if (!webhookUrl.trim()) {
      setValidationError('Please enter your Discord Webhook URL');
      return;
    }
    setTestingWebhook(true);
    setValidationError(null);
    try {
      const info = await api.validateWebhook(webhookUrl.trim());
      setWebhookInfo(info);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to Discord Webhook. Verify the URL.';
      setValidationError(message);
      setWebhookInfo(null);
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleFinish = async () => {
    const newSettings: AppSettings = {
      webhook_url: webhookUrl.trim(),
      webhook_name: webhookInfo?.name || 'Discord Storage Vault',
      channel_id: webhookInfo?.channel_id || '',
      guild_id: webhookInfo?.guild_id || '',
      master_key: masterKey,
      encryption_enabled: encryptionEnabled,
      chunk_size_bytes: 18 * 1024 * 1024, // 18MB
      max_concurrency: 4,
      auto_launch_server: true,
      server_port: 49152,
      theme: 'dark',
      download_directory: '',
      setup_completed: true,
    };

    await api.saveSettings(newSettings);
    onComplete(newSettings);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-base/95 backdrop-blur-xl p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-obsidian-card border border-obsidian-border rounded-2xl shadow-2xl p-8 relative flex flex-col justify-between min-h-[580px]">
        {/* Glow backdrop accent */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-wyvern-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-accent-cyan/10 rounded-full blur-3xl pointer-events-none" />

        {/* Step Indicator */}
        <div className="flex items-center justify-between pb-6 border-b border-obsidian-border/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-wyvern-600 to-accent-cyan flex items-center justify-center shadow-glow-blurple p-1">
              <img src="/icon.png" alt="Wyvern Emblem" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">WYVERN DRIVE ONBOARDING</h2>
              <p className="text-xs text-slate-400">Step {step} of 4</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-7 h-1.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? 'bg-wyvern-500 w-10 shadow-glow-blurple'
                    : i < step
                    ? 'bg-emerald-500'
                    : 'bg-obsidian-border'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="py-6 flex-1 flex flex-col justify-center">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Welcome to <span className="text-gradient-accent">Wyvern Drive</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Next-generation AAA cloud drive powered by your private Discord storage webhook.
                </p>
              </div>

              {/* 5 Pillar Features */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="glass-panel p-3 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Free Forever</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    No subscriptions or ads. 100% open storage protocol.
                  </p>
                </div>

                <div className="glass-panel p-3 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-cyan">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Ultra Fast</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Parallel chunking pipelines with Discord CDN speed.
                  </p>
                </div>

                <div className="glass-panel p-3 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-wyvern-400">
                    <InfinityIcon className="w-3.5 h-3.5" />
                    <span>Unlimited Space</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Store as many gigabytes or terabytes as you want.
                  </p>
                </div>

                <div className="glass-panel p-3 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-violet">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Zero Sign-Up</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    All tied cleanly to your Discord channel webhook.
                  </p>
                </div>

                <div className="glass-panel p-3 rounded-xl space-y-1 col-span-2 sm:col-span-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Client-Side AES-256-GCM</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Your files are encrypted before leaving your machine. Discord only sees ciphertext.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white">How to Get Your Discord Webhook</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Follow these 4 simple steps in your Discord desktop or web client:
                </p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-start gap-3 p-3 bg-obsidian-elevated/70 border border-obsidian-border rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-wyvern-500/20 text-wyvern-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                    1
                  </span>
                  <div>
                    <span className="font-semibold text-white">Create a Private Discord Server</span>
                    <p className="text-slate-400 text-[11px]">
                      Click the "+" icon on Discord to add a server. Name it "My Vault" and keep it private.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-obsidian-elevated/70 border border-obsidian-border rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-wyvern-500/20 text-wyvern-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                    2
                  </span>
                  <div>
                    <span className="font-semibold text-white">Open Server Settings → Integrations</span>
                    <p className="text-slate-400 text-[11px]">
                      Select the server settings gear icon in top left, navigate to Integrations.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-obsidian-elevated/70 border border-obsidian-border rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-wyvern-500/20 text-wyvern-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                    3
                  </span>
                  <div>
                    <span className="font-semibold text-white">Create Webhook & Copy URL</span>
                    <p className="text-slate-400 text-[11px]">
                      Click "Create Webhook", pick any text channel, and press "Copy Webhook URL".
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-white">Paste Your Discord Webhook URL</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  This webhook is your storage access key. Keep it confidential.
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="password"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/1234567890/abc123xyz..."
                    className="w-full px-4 py-2.5 bg-obsidian-elevated border border-obsidian-border rounded-xl text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-wyvern-500 focus:ring-1 focus:ring-wyvern-500/40"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={testWebhook}
                    disabled={testingWebhook || !webhookUrl}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-obsidian-elevated hover:bg-obsidian-hover border border-obsidian-border hover:border-wyvern-500/50 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {testingWebhook ? (
                      <>
                        <Radio className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing Connection...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-accent-cyan" />
                        <span>Test Webhook</span>
                      </>
                    )}
                  </button>
                </div>

                {webhookInfo && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{webhookInfo.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            ONLINE
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Connected to Discord Channel ID: {webhookInfo.channel_id}
                        </p>
                      </div>
                    </div>
                    {webhookInfo.latency_ms && (
                      <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                        {webhookInfo.latency_ms}ms ping
                      </span>
                    )}
                  </div>
                )}

                {validationError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                    <span>{validationError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-white">Client-Side AES-256 Encryption</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Protect your cloud storage with military-grade AES-256-GCM encryption.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-obsidian-elevated border border-obsidian-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-wyvern-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Enable AES-256-GCM Encryption</div>
                      <p className="text-[11px] text-slate-400">Encrypt every chunk with unique 12-byte nonces</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={encryptionEnabled}
                    onChange={(e) => setEncryptionEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-wyvern-500 bg-obsidian-base border-obsidian-border focus:ring-wyvern-500"
                  />
                </div>

                {encryptionEnabled && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                      <span>Vault Master Passphrase / Encryption Key</span>
                      <button
                        onClick={() =>
                          setMasterKey('wyvern-key-' + Math.random().toString(36).slice(2, 14) + '-' + Math.random().toString(36).slice(2, 8))
                        }
                        className="text-[11px] text-wyvern-400 hover:text-wyvern-300"
                      >
                        Generate Secure Key
                      </button>
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={masterKey}
                        onChange={(e) => setMasterKey(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-obsidian-elevated border border-obsidian-border rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-wyvern-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Argon2id key derivation is applied automatically to hash this key into a 32-byte cipher block.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="pt-6 border-t border-obsidian-border flex items-center justify-between">
          <div>
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-obsidian-elevated hover:bg-obsidian-hover border border-obsidian-border transition-colors"
              >
                Back
              </button>
            ) : onCancel ? (
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
              >
                Skip for now
              </button>
            ) : null}
          </div>

          <div>
            {step < 4 ? (
              <button
                onClick={() => {
                  if (step === 3 && !webhookUrl) {
                    setValidationError('Please enter a webhook URL first');
                    return;
                  }
                  setStep((s) => s + 1);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-wyvern-600 hover:bg-wyvern-500 shadow-glow-blurple transition-all"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-glow-emerald transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Launch Wyvern Drive</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
