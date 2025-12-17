import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Upload, Check, Loader2, ChevronDown, Lock, FileText, Image, Shield, Zap, Globe, Cpu, Database } from 'lucide-react'

// Layout Components
const Container = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`max-w-7xl mx-auto px-6 md:px-8 ${className}`}>{children}</div>
)

const Section = ({ children, className = "", id = "" }: { children: React.ReactNode; className?: string; id?: string }) => (
  <section id={id} className={`relative z-10 py-24 md:py-32 ${className}`}>{children}</section>
)

// UI Components
const ButtonPrimary = ({ children, to }: { children: React.ReactNode; to: string }) => (
  <Link
    to={to}
    className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#0A0A0B] rounded-full font-medium transition-all hover:bg-gray-100 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:-translate-y-0.5"
  >
    {children}
  </Link>
)



const FeatureCard = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="group p-8 rounded-2xl bg-[#141416] border border-[#2A2A2E] hover:border-white/10 transition-all hover:-translate-y-1">
    <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-6 text-white/80 group-hover:text-white transition-colors">
      <Icon size={24} strokeWidth={1.5} />
    </div>
    <h3 className="text-xl font-medium text-white mb-3">{title}</h3>
    <p className="text-[#71717A] leading-relaxed">{desc}</p>
  </div>
)

const StepCard = ({ num, title, desc }: { num: string, title: string, desc: string }) => (
  <div className="relative p-8 pt-12 rounded-2xl bg-[#141416] border border-[#2A2A2E]">
    <div className="absolute top-8 right-8 text-6xl font-[Playfair_Display] text-white/5 font-bold leading-none select-none">
      {num}
    </div>
    <h3 className="text-xl font-medium text-white mb-3 relative z-10">{title}</h3>
    <p className="text-[#71717A] leading-relaxed relative z-10">{desc}</p>
  </div>
)

// Main Component
export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const faqs = [
    { q: "Is this actually free?", a: "Yes. Use your own Discord server for storage. We provide the interface and encryption engine. No monthly fees." },
    { q: "How secure is 'Client-side Encrypted'?", a: "Extremely. Your files are encrypted with AES-256-GCM before they ever leave your device. We (Wyvern) cannot see them. Discord cannot see them." },
    { q: "What is the storage limit?", a: "Practically unlimited. Discord allows unlimited attachments. We split your large files into manageable chunks automatically." },
    { q: "Is there a file size limit?", a: "No. Upload 5GB, 10GB, or larger files. Our chunking engine handles it all in the background." }
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#71717A] font-sans selection:bg-white/20 selection:text-white overflow-x-hidden">

      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        {/* Subtle Rainbow Leaks */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full opacity-20"></div>
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-purple-500/10 blur-[100px] rounded-full opacity-20"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A0A0B]/80 backdrop-blur-md">
        <Container className="h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white font-[Playfair_Display] text-2xl font-bold tracking-tight">
            Wyvern <span className="text-white/20 font-sans font-light">/</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/signin" className="text-sm font-medium hover:text-white transition-colors hidden sm:block">
              Sign In
            </Link>
            <Link to="/signup" className="flex items-center gap-2 px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-all backdrop-blur-sm border border-white/10">
              Get Started
            </Link>
          </div>
        </Container>
      </nav>

      <main className="pt-20">

        {/* HERO SECTION */}
        <Section className="min-h-[90vh] flex items-center pt-20">
          <Container>
            <div className="grid lg:grid-cols-12 gap-16 items-center">

              {/* Left Content */}
              <div className="lg:col-span-5 space-y-8 relative z-20">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-white/50 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  v1.0 Now Live
                </div>

                <h1 className="text-6xl md:text-7xl lg:text-8xl font-[Playfair_Display] text-white leading-[0.9] tracking-tight">
                  Unlimited <br />
                  <span className="text-white/50">Storage.</span> <br />
                  Simplified.
                </h1>

                <p className="text-lg md:text-xl text-[#A1A1AA] max-w-md leading-relaxed">
                  Store, share, and encrypt your files without limits. Powered by your own Discord server. Zero monthly fees.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <ButtonPrimary to="/signup">
                    Start Storing <ArrowUpRight size={18} />
                  </ButtonPrimary>
                </div>
              </div>

              {/* Right Visual - Interactive Mockup */}
              <div className="lg:col-span-7 relative z-10 lg:pl-10">
                {/* Glow Effect behind mockup */}
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl opacity-50 rounded-full scale-90"></div>

                {/* Mockup Container */}
                <div className="relative bg-[#141416] border border-[#2A2A2E] rounded-2xl p-6 shadow-2xl backdrop-blur-sm">

                  {/* Fake UI Header */}
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                      </div>
                      <div className="h-8 px-4 flex items-center bg-[#0A0A0B] rounded-md border border-white/5 text-xs text-white/40 font-mono w-64">
                        wyvern://vault/encrypted-assets
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/20">
                      <Shield size={14} />
                      <span className="text-xs uppercase tracking-widest font-medium">AES-256</span>
                    </div>
                  </div>

                  {/* Drop Zone Visual */}
                  <div className="border border-dashed border-white/10 bg-white/[0.02] rounded-xl p-8 mb-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0A0A0B] border border-white/10 flex items-center justify-center shadow-lg">
                      <Upload size={24} className="text-white/60" />
                    </div>
                    <p className="text-white/80 font-medium mb-1">Drag & drop files to encrypt</p>
                    <p className="text-xs text-white/30">Supports any file type • Unlimited size</p>
                  </div>

                  {/* File List */}
                  <div className="space-y-3">
                    {/* Item 1 - Done */}
                    <div className="flex items-center gap-4 p-4 bg-[#0A0A0B] border border-white/5 rounded-xl hover:border-white/10 transition-colors group">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white text-sm font-medium">project_specs.pdf</span>
                          <span className="text-emerald-500 text-xs font-medium bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                            <Check size={10} /> Encrypted
                          </span>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 w-full"></div>
                        </div>
                      </div>
                    </div>

                    {/* Item 2 - Processing */}
                    <div className="flex items-center gap-4 p-4 bg-[#0A0A0B] border border-white/5 rounded-xl border-l-2 border-l-blue-500">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Image size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white text-sm font-medium">design_mockup_v2.png</span>
                          <span className="text-blue-400 text-xs font-medium flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" /> Encrypting...
                          </span>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 w-[65%] animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </Container>
        </Section>

        {/* FEATURES GRID */}
        <Section id="features" className="bg-[#0A0A0B]">
          <Container>
            <div className="mb-20">
              <h2 className="text-4xl md:text-5xl font-[Playfair_Display] text-white mb-6">Why Choose Wyvern?</h2>
              <p className="text-lg text-[#A1A1AA] max-w-xl">
                We've reimagined cloud storage from the ground up to be private, unlimited, and free forever.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={Database}
                title="Decentralized"
                desc="No central server holding your files. Your data lives on Discord's massive global CDN infrastructure."
              />
              <FeatureCard
                icon={Zap}
                title="Blazing Fast"
                desc="Max out your bandwidth with parallel chunked uploads. Experience speeds faster than typical free tiers."
              />
              <FeatureCard
                icon={Shield}
                title="End-to-End Encrypted"
                desc="Your files are encrypted with AES-256-GCM before upload. We literally cannot see your data."
              />
              <FeatureCard
                icon={Cpu}
                title="Browser Powered"
                desc="No heavy desktop apps to install. Our advanced web engine handles encryption and chunking locally."
              />
              <FeatureCard
                icon={Globe}
                title="Zero Fees"
                desc="Since you provide the storage backend (via Discord), there are no monthly storage costs. Ever."
              />
              <FeatureCard
                icon={Lock}
                title="Privacy First"
                desc="No tracking. No data mining. No ads. Just tools for you to manage your own digital life."
              />
            </div>
          </Container>
        </Section>

        {/* HOW IT WORKS */}
        <Section id="how">
          <Container>
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div>
                <h2 className="text-4xl md:text-5xl font-[Playfair_Display] text-white mb-8">How It Works</h2>
                <div className="space-y-6">
                  <StepCard
                    num="01"
                    title="Create Account"
                    desc="Sign up anonymously. We don't ask for credit cards or personal info."
                  />
                  <StepCard
                    num="02"
                    title="Connect Discord"
                    desc="Create a private server and grab a webhook URL. This becomes your storage vault."
                  />
                  <StepCard
                    num="03"
                    title="Start Uploading"
                    desc="Drag and drop files. We encrypt, chunk, and distribute them to your vault instantly."
                  />
                </div>
              </div>

              <div className="hidden lg:block relative h-[600px] bg-[#141416] rounded-2xl border border-[#2A2A2E] overflow-hidden group">
                {/* Abstract visual representing the flow - simplified for code */}
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <div className="w-32 h-32 rounded-full border border-white/10 flex items-center justify-center mb-8 mx-auto relative">
                    <div className="absolute inset-0 bg-white/5 rounded-full animate-ping opacity-20"></div>
                    <Lock size={48} className="text-white" />
                  </div>
                  <p className="text-white/40 font-[Playfair_Display] text-2xl">Secure Vault</p>
                </div>
              </div>
            </div>
          </Container>
        </Section>

        {/* FAQ */}
        <Section id="faq" className="bg-[#0A0A0B]">
          <Container className="max-w-3xl">
            <h2 className="text-4xl font-[Playfair_Display] text-white text-center mb-16">Frequently Asked</h2>
            <div className="divide-y divide-white/5 border-t border-b border-white/5">
              {faqs.map((faq, i) => (
                <div key={i} className="py-6 group">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between text-left focus:outline-none"
                  >
                    <span className="text-lg text-white/90 font-medium group-hover:text-white transition-colors">{faq.q}</span>
                    <ChevronDown size={20} className={`text-white/40 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-40 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                    <p className="text-[#A1A1AA] leading-relaxed pr-8 pb-2">{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </Section>

        {/* FINAL CTA */}
        <Section className="py-32">
          <Container>
            <div className="relative rounded-3xl bg-[#141416] border border-[#2A2A2E] p-12 md:p-24 text-center overflow-hidden">
              {/* Decorative Gradients */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              <div className="absolute bottom-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-white/5 blur-[100px] rounded-full pointing-events-none"></div>

              <div className="relative z-10 max-w-2xl mx-auto">
                <h2 className="text-5xl md:text-6xl font-[Playfair_Display] text-white mb-8">
                  Ready to Decentralize?
                </h2>
                <p className="text-xl text-[#A1A1AA] mb-12">
                  Join thousands of users reclaiming their data ownership. No credit card required.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <ButtonPrimary to="/signup">
                    Get Started Free <ArrowUpRight size={18} />
                  </ButtonPrimary>
                  <span className="text-sm text-white/30 hidden sm:inline">or</span>
                  <Link to="/signin" className="text-white hover:text-white/80 underline decoration-white/30 hover:decoration-white underline-offset-4 transition-all">
                    Sign in to existing account
                  </Link>
                </div>
              </div>
            </div>
          </Container>
        </Section>

      </main>

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/5 bg-[#050506]">
        <Container>
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-xl font-[Playfair_Display] font-bold text-white">Wyvern</span>
              <span className="text-xs text-white/40 px-2 py-0.5 rounded border border-white/10">BETA</span>
            </div>

            <div className="flex gap-8 text-sm text-[#71717A]">
              <a href="#" className="hover:text-white transition-colors">Twitter</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
              <a href="#" className="hover:text-white transition-colors">Discord</a>
            </div>

            <p className="text-xs text-[#52525B]">
              © 2024 Wyvern Drive. Open Source.
            </p>
          </div>
        </Container>
      </footer>

    </div>
  )
}
