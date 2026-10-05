'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield } from 'lucide-react';
import { Navigation } from '@/components/ui/Navigation';

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
    <div className="page-root bg-[#0a0a0f] min-h-screen text-white pb-[calc(env(safe-area-inset-bottom)+5rem)]">
      <div className="scroll-container pt-safe-top px-4 pb-8">
        <header className="flex items-center gap-3 mb-6 pt-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-[#9ca3af] hover:text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#f97316]" />
            <h1 className="text-xl font-black text-white">Privacy Policy</h1>
          </div>
        </header>

        <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-5 space-y-6">
          <p className="text-sm text-[#9ca3af] leading-relaxed">
            Last updated: October 2026
          </p>

          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Information We Collect</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              We collect information you provide directly to us when you use FireFleet. This includes your email address (for authentication), expense amounts, categories, budget information, and application preferences.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. How Data is Stored</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              Your data is stored securely using Supabase cloud infrastructure. All data is encrypted at rest. We do not sell your personal data to any third parties under any circumstances.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. Third-Party Services</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              We use trusted third-party services to operate our application, including Google OAuth for authentication, Supabase for database and backend services, and Vercel for hosting.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Your Rights</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              You have the right to access, modify, or delete your personal data. You can clear your local data via the Settings &gt; Reset Data option. For complete account deletion, please contact our support team.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">5. Cookies & Local Storage</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              We use local storage strictly for essential application functionality, such as storing authentication tokens and your UI theme preferences. We do not use tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">6. Data Retention</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              We retain your expense data for as long as your account is active. If you request account deletion, all associated financial and personal data will be permanently removed from our active servers within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">7. Children's Privacy</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              FireFleet is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">8. Indian IT Act 2000 & DPDP Act 2023 Compliance</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              This policy is published in accordance with the provisions of Rule 3(1) of the Information Technology (Intermediary Guidelines) Rules, 2011, under the Information Technology Act, 2000. We also comply with the Digital Personal Data Protection (DPDP) Act, 2023 regarding the processing of digital personal data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">9. Contact Us</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at:{' '}
              <a href="mailto:firefleet.app@gmail.com" className="text-[#f97316]">firefleet.app@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
      <Navigation />
    </div>
  );
}
