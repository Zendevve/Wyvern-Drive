import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFileStore } from '../stores/fileStore'
import { Lock, Zap, Loader2, Link as LinkIcon, Key, Plus, Minus, ArrowUpRight, Eye, EyeOff, Shield } from 'lucide-react'

const SAVED_WEBHOOKS_KEY = 'wyvern-saved-webhooks'

export function SetupScreen() {
  const { setWebhookUrls, setEncryptionPassword, isLoading } = useFileStore()
  const [webhooks, setWebhooks] = useState<string[]>([''])
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [useEncryption, setUseEncryption] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(SAVED_WEBHOOKS_KEY)
    if (saved) {
      try {
        const savedWebhooks = JSON.parse(saved)
        if (Array.isArray(savedWebhooks) && savedWebhooks.length > 0) {
          setWebhooks(savedWebhooks)
        }
      } catch {
        // Ignore
      }
    }
  }, [])

  const addWebhook = () => setWebhooks([...webhooks, ''])
  const removeWebhook = (index: number) => {
    if (webhooks.length > 1) setWebhooks(webhooks.filter((_, i) => i !== index))
  }
  const updateWebhook = (index: number, value: string) => {
    setWebhooks(webhooks.map((w, i) => i === index ? value : w))
  }

  const validWebhooks = webhooks.filter(w => w.trim().startsWith('https://discord.com/api/webhooks/'))
  const canSubmit = validWebhooks.length > 0 && (!useEncryption || password.length >= 8)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    localStorage.setItem(SAVED_WEBHOOKS_KEY, JSON.stringify(validWebhooks))
    if (useEncryption && password) setEncryptionPassword(password)
    setWebhookUrls(validWebhooks)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6">
      {/* Subtle Grid Background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }}>
      </div>

      {/* Gradient Orb */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-gradient-to-b from-white/[0.02] to-transparent blur-3xl pointer-events-none z-0"></div>

      {/* Prismatic Blur */}
      <div className="fixed top-[20%] right-[30%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full opacity-20 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-white font-medium mb-12 justify-center">
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <Lock size={16} />
          </div>
          <span className="text-lg font-[Playfair_Display] tracking-tight">Wyvern</span>
        </Link>

        {/* Card */}
        <div className="bg-[#141418] border border-white/5 rounded-2xl p-8 relative overflow-hidden">
          {/* Subtle top sheen */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-[Playfair_Display] text-white mb-2">Connect Drive</h1>
            <p className="text-white/40 text-sm">
              Wyvern Drive uses a "Bring Your Own Storage" model.<br />
              Your files live in your private Discord channel, secure and free forever.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Webhook Inputs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wider">
                  <LinkIcon size={12} /> Webhook URLs
                </label>
                <a
                  href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                >
                  How to get a URL?
                </a>
              </div>

              <div className="bg-white/[0.03] rounded-lg p-3 text-xs text-white/40 border border-white/[0.05] mb-2">
                1. Create a <strong>private</strong> Discord channel.<br />
                2. Go to Edit Channel &gt; Integrations &gt; Webhooks.<br />
                3. Create a new Webhook and copy the URL.
              </div>

              <div className="space-y-2">
                {webhooks.map((webhook, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="password"
                      value={webhook}
                      onChange={(e) => updateWebhook(index, e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="flex-1 px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-colors"
                    />
                    {webhooks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWebhook(index)}
                        className="p-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white/30 hover:text-white/60 hover:border-white/15 transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addWebhook}
                className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                <Plus size={12} /> Add another webhook (for speed)
              </button>

              {/* Webhook Status */}
              <div className="flex items-center gap-2 text-xs text-white/30">
                <Zap size={10} className={validWebhooks.length >= 3 ? 'text-emerald-400' : ''} />
                <span>
                  {validWebhooks.length === 0
                    ? 'Paste your Webhook URL above'
                    : validWebhooks.length < 3
                      ? `${validWebhooks.length} webhook${validWebhooks.length > 1 ? 's' : ''} added (add 3 for max speed)`
                      : `${validWebhooks.length} webhooks — Turbo Mode Active`
                  }
                </span>
              </div>
            </div>

            {/* Encryption Toggle */}
            <label className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-lg cursor-pointer hover:border-white/10 transition-colors">
              <input
                type="checkbox"
                checked={useEncryption}
                onChange={(e) => setUseEncryption(e.target.checked)}
                className="w-4 h-4 accent-white rounded"
              />
              <div className="flex-1">
                <div className="text-sm text-white/80">Enable encryption</div>
                <div className="text-xs text-white/30">Encrypt files with a master password</div>
              </div>
              <Shield size={16} className={useEncryption ? 'text-white/60' : 'text-white/20'} />
            </label>

            {/* Password Field */}
            {useEncryption && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wider">
                  <Key size={12} /> Master Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    className="w-full px-4 py-3 pr-12 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit || isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white text-[#0a0a0c] rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Connecting...
                </>
              ) : (
                <>
                  Connect to Wyvern <ArrowUpRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Back to home */}
        <div className="text-center mt-8">
          <Link to="/" className="text-white/40 text-sm hover:text-white/60 transition-colors inline-flex items-center gap-1">
            Back to home <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  )
}
