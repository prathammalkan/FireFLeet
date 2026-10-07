'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import { Navigation } from '@/components/ui/Navigation';

export default function TermsOfService() {
  const router = useRouter();
  const navBottom = 'calc(64px + env(safe-area-inset-bottom, 0px))';

  return (
    <div
      className="page-root overflow-y-auto scroll-container"
      style={{ paddingBottom: `calc(${navBottom} + 24px)` }}
    >
      <div
        className="px-5 pb-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-[#13131a] border border-[#1f1f2e] flex items-center justify-center text-[#9ca3af] active:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#f97316]" />
            <h1 className="text-xl font-black text-white">Terms of Service</h1>
          </div>
        </header>

        <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-5 space-y-6">
          <p className="text-sm text-[#9ca3af] leading-relaxed">
            Last updated: October 2026
          </p>

          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Acceptance of Terms</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              By accessing or using FireFleet, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. Description of Service</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              FireFleet is a personal expense tracking application. It is <strong>NOT</strong> a financial advisor, <strong>NOT</strong> a bank, and <strong>NOT</strong> a payment processor. The information provided by the app is for organizational and informational purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. User Responsibilities</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              You are responsible for maintaining the accuracy of the data you enter and for safeguarding your account credentials. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Intellectual Property</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              The FireFleet brand, UI design, graphics, and original content are the exclusive property of FireFleet and its licensors. You may not use our intellectual property without express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">5. Limitation of Liability</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              FireFleet is provided "as is". We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service. We do not provide financial advice.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">6. Termination</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              We reserve the right to suspend or terminate your account at any time for violations of these Terms of Service, without prior notice or liability.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">7. Governing Law & Jurisdiction</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              These terms shall be governed by and construed in accordance with the laws of India. Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the courts in India.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">8. Regulatory Compliance (India)</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              This document is an electronic record in terms of the Information Technology Act, 2000. 
              <br/><br/>
              <strong>RBI Disclaimer:</strong> FireFleet is NOT a bank, Non-Banking Financial Company (NBFC), or payment system operator. It does NOT hold, transfer, or process any monetary transactions. It is purely an expense tracking tool.
              <br/><br/>
              <strong>Payment Features:</strong> Any future payment features integrated into the app will comply with Reserve Bank of India (RBI) guidelines and applicable PPI/PA/PG regulations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">9. Changes to Terms</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify users of any material changes by updating the date at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">10. Contact Us</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              For any questions regarding these Terms, please contact us at:{' '}
              <a href="mailto:firefleet.app@gmail.com" className="text-[#f97316]">firefleet.app@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
      <Navigation />
    </div>
  );
}
