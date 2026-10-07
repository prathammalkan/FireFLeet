'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Scale } from 'lucide-react';
import { Navigation } from '@/components/ui/Navigation';

export default function LegalLicenses() {
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
            <Scale className="w-6 h-6 text-[#f97316]" />
            <h1 className="text-xl font-black text-white">Licenses & Legal</h1>
          </div>
        </header>

        <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl p-5 space-y-6">
          <p className="text-sm text-[#9ca3af] leading-relaxed">
            Last updated: October 2026
          </p>

          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Open Source Licenses</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              FireFleet is built using various open source technologies. Most dependencies, including React, Next.js, and Tailwind CSS, are licensed under the MIT License. We are grateful to the open source community for their contributions.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. Regulatory Compliance Overview</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              We strive to maintain compliance with relevant digital data protection laws, including the Indian Information Technology Act, 2000, and the Digital Personal Data Protection Act, 2023. Our data practices are designed to ensure user privacy and security.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. Data Processing Agreement Summary</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              When using third-party subprocessors like Supabase and Vercel, data processing is governed by strict agreements that ensure they only process data in accordance with our instructions and maintain appropriate security measures.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Grievance Officer</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed">
              In accordance with the Information Technology Act, 2000 and rules made there under (including Rule 5(9)), the name and contact details of the Grievance Officer are provided below:
              <br/><br/>
              <strong>Email:</strong> <a href="mailto:firefleet.app@gmail.com" className="text-[#f97316]">firefleet.app@gmail.com</a><br/>
              <strong>Note:</strong> Please include "Grievance Officer" in the subject line of your email for prompt attention to your concerns.
            </p>
          </section>
        </div>
      </div>
      <Navigation />
    </div>
  );
}
