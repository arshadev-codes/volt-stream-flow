import { useState, useEffect, useRef } from 'react';

const EULA_STORAGE_KEY = 'electrosoft_eula_accepted_v2';

const EULA_TEXT = `
IMPORTANT NOTICE
PLEASE READ THIS AGREEMENT CAREFULLY. BY INSTALLING, COPYING, OR USING THE SOFTWARE, YOU AGREE TO BE LEGALLY BOUND BY THIS AGREEMENT. IF YOU DO NOT AGREE TO THE TERMS, DO NOT INSTALL OR USE THE SOFTWARE.

THE SOFTWARE IS LICENSED, NOT SOLD. USE IS STRICTLY LIMITED TO AUTHORIZED PURPOSES. UNAUTHORIZED USE MAY CAUSE SERIOUS ELECTRICAL AND MECHANICAL HAZARDS.

1. DEFINITIONS
1.1 "Agreement" means this End User License Agreement, as may be updated or amended by Electrosoft Automation Pvt. Ltd. ("Electrosoft") from time to time.
1.2 "Software" means the proprietary computer program known as "ReactorX," including all executable code, object code, source code (to the extent provided), user documentation, help files, printed materials, electronic files, and any modifications, updates, upgrades, or enhancements provided by Electrosoft.
1.3 "Hardware" means the transformer testing systems manufactured, supplied, or commissioned by Electrosoft, including but not limited to Current Transformer (CT) Testing Systems, Potential Transformer (PT) Testing Systems, Distribution Transformer Testing Systems, Power Transformer Testing Systems, Generator Testing Systems, Switchgear Testing Systems, Breaker Testing Systems, and Reactor Testing systems, as may be updated, replaced, or expanded by Electrosoft.
1.4 "Licensee" means the individual or single legal entity who has lawfully obtained the Software from Electrosoft under this Agreement.
1.5 "Authorized Use" means the operation of the Software solely in conjunction with Hardware supplied or commissioned by Electrosoft.

2. GRANT OF LICENSE
2.1 License Grant. Subject to the terms and conditions of this Agreement, Electrosoft hereby grants the Licensee a limited, personal, perpetual, non-exclusive, non-transferable, non-sublicensable right to install and use one (1) copy of the Software solely for Authorized Use.
2.2 Scope of Use. The License is granted per user per installation. Separate licenses must be obtained for each additional user, installation, or workstation.
2.3 Restrictions. The Licensee shall not:
(a) install, use, or attempt to use the Software with any hardware system not manufactured, supplied, or commissioned by Electrosoft;
(b) copy, duplicate, reproduce, or distribute the Software, in whole or in part;
(c) sell, rent, lease, lend, sublicense, assign, convey, pledge, or otherwise transfer the Software or any rights hereunder;
(d) modify, adapt, translate, alter, enhance, or create derivative works of the Software;
(e) reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code or underlying algorithms of the Software;
(f) alter, bypass, disable, or interfere with any license management, usage control, or security mechanism embedded within the Software;
(g) transfer this License to any third party, whether by sale, merger, assignment, or otherwise;
(h) attempt to use the Software in connection with any unsafe, uncertified, or unauthorized equipment, as this may result in severe electrical, mechanical, or safety hazards.
2.4 No Transfer. The Licensee acknowledges and agrees that this License is strictly personal and non-transferable. Any purported transfer, assignment, or sublicensing of the Software is null and void and constitutes a material breach of this Agreement.
2.5 No Hosting. Licensee may not make the Software available via hosting, SaaS, cloud, or timesharing.
2.6 Audit Rights. Electrosoft reserves the right to audit Licensee's use of the Software to verify compliance.
2.7 Indemnification. Licensee agrees to indemnify, defend, and hold harmless Electrosoft from any claims arising out of misuse or unauthorized use.

4. MODIFICATIONS PROHIBITED
Only Electrosoft may modify, repair, or alter the Software or Hardware. Unauthorized modifications immediately void license rights and warranties.

5. INTELLECTUAL PROPERTY
The Software is licensed, not sold. Electrosoft retains all rights, title, and interest, including intellectual property rights, in and to the Software and any copies thereof. Ownership fully rests with Electrosoft. The Software contains trade secrets and proprietary know-how. Unauthorized disclosure or use may result in civil and criminal penalties.

6. DATA COLLECTION AND PRIVACY
6.1 The Licensee acknowledges and agrees that the Software may collect, transmit, and store limited technical data, including system performance metrics, usage logs, and diagnostic information.
6.2 Data collection is intended solely for the purpose of enhancing software functionality, improving safety, diagnosing issues, and supporting future development.
6.3 Electrosoft shall not use collected data to identify individuals, except as required for licensing, technical support, or as mandated by law.

7. SUPPORT, MAINTENANCE, AND REINSTALLATION
7.1 Support is not guaranteed unless separately contracted.
7.2 Updates may be provided at Electrosoft's discretion.
7.3 Reinstallation after deletion, corruption, or hardware replacement will be treated as a new service request and subject to charges.

8. EXPORT CONTROL COMPLIANCE
The Licensee acknowledges and agrees that the Software is subject to Indian and international export control laws and regulations. Licensee shall not export, re-export, transfer, or disclose the Software, in whole or in part, to any destination, person, entity, or end use prohibited by applicable export laws, without obtaining prior written authorization from the relevant governmental authorities.
Licensee further agrees not to use the Software for any purposes related to nuclear, chemical, or biological weapons, or in any manner prohibited by applicable law.

9. TERM AND TERMINATION
9.1 This Agreement shall remain in effect in perpetuity unless terminated in accordance with this Section.
9.2 Electrosoft may terminate this Agreement immediately and without notice if the Licensee:
(a) breaches any provision of this Agreement;
(b) engages in unauthorized copying, transfer, modification, or misuse of the Software;
(c) attempts to use the Software with unauthorized equipment.
9.3 Upon termination, the Licensee shall cease all use of the Software, uninstall it, and destroy all copies in its possession.

10. WARRANTY DISCLAIMER
THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ELECTROSOFT DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, RELIABILITY, OR ACCURACY.
ELECTROSOFT DOES NOT WARRANT THAT THE SOFTWARE WILL OPERATE WITHOUT INTERRUPTION, BE ERROR-FREE, OR MEET THE LICENSEE'S REQUIREMENTS.

11. LIMITATION OF LIABILITY
TO THE MAXIMUM EXTENT PERMITTED BY LAW, ELECTROSOFT SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES WHATSOEVER, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, LOSS OF DATA, BUSINESS INTERRUPTION, EQUIPMENT DAMAGE, OR PERSONAL INJURY, ARISING OUT OF OR IN CONNECTION WITH THE USE OR INABILITY TO USE THE SOFTWARE.
IN NO EVENT SHALL ELECTROSOFT'S TOTAL LIABILITY EXCEED THE LICENSE FEE PAID BY THE LICENSEE FOR THE SOFTWARE.

12. HAZARD DISCLAIMER
THE LICENSEE EXPRESSLY ACKNOWLEDGES THAT USE OF THE SOFTWARE WITH ANY NON-ELECTROSOFT EQUIPMENT OR IN AN UNAUTHORIZED MANNER MAY CAUSE SEVERE ELECTRICAL, MECHANICAL, OR SAFETY HAZARDS, INCLUDING BUT NOT LIMITED TO EQUIPMENT FAILURE, ELECTRICAL SHOCK, OR FIRE. THE LICENSEE ACCEPTS FULL RESPONSIBILITY FOR ENSURING SAFE AND AUTHORIZED USE.

13. GOVERNING LAW AND JURISDICTION
This Agreement shall be governed by and construed in accordance with the laws of India. The parties irrevocably agree that the courts of Thane and Mumbai, Maharashtra, India shall have exclusive jurisdiction to settle any dispute arising out of or in connection with this Agreement.

14. ADDITIONAL PROVISIONS
14.1 No Waiver. Failure to enforce any provision does not waive rights.
14.2 Survival. All provisions relating to ownership, liability limitations, disclaimers, export control, and restrictions survive termination.
14.3 Severability. Invalid provisions do not affect validity of others.
14.4 Notices. All legal notices to Electrosoft must be in writing and delivered to its registered office.
14.5 Headings. Section headings are for convenience only and have no legal effect.
14.6 Third-Party Rights. This Agreement does not create any rights in third parties.

15. ENTIRE AGREEMENT
This Agreement constitutes the full and exclusive statement of agreement between Electrosoft and the Licensee regarding the Software. It supersedes any prior agreements, understandings, or representations, whether oral or written.

ACKNOWLEDGEMENT
BY INSTALLING OR USING THE SOFTWARE, THE LICENSEE CONFIRMS THAT THEY HAVE READ THIS AGREEMENT, UNDERSTOOD ITS TERMS, AND AGREE TO BE LEGALLY BOUND.
`.trim();

// Text ko paragraphs mein todo aur headings detect karo (professional formatting ke liye)
function parseEulaSections(text: string) {
  const blocks = text.split(/\n\n+/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    const isHeading =
      /^\d+\.\s+[A-Z]/.test(trimmed) || // "1. DEFINITIONS"
      /^[A-Z\s,]+$/.test(trimmed.split('\n')[0]) && trimmed.split('\n')[0].length < 60;

    return { key: i, text: trimmed, isHeading };
  });
}

export function EulaGate({
  children,
  forceShow,
  onCloseForceShow,
}: {
  children: React.ReactNode;
  forceShow?: boolean;
  onCloseForceShow?: () => void;
}) {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(EULA_STORAGE_KEY);
    setAccepted(stored === 'true');
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const maxScroll = el.scrollHeight - el.clientHeight;
    const progress = maxScroll > 0 ? (el.scrollTop / maxScroll) * 100 : 100;
    setScrollProgress(Math.min(progress, 100));
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) {
      setScrolledToBottom(true);
    }
  };

  const canAgree = scrolledToBottom && checked;
  const isViewOnly = accepted && forceShow;

  const handleAgree = () => {
    if (!canAgree) return;
    localStorage.setItem(EULA_STORAGE_KEY, 'true');
    setAccepted(true);
  };

  const handleDecline = () => {
    setDeclined(true);
    setTimeout(() => window.close(), 1500);
  };

  if (accepted === null) return null;
  if (accepted && !forceShow) return <>{children}</>;

  if (declined) {
    return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          <p style={{ color: '#f87171', fontSize: 15, textAlign: 'center' }}>
            You must accept the license agreement to use this application.
            <br />
            Closing now…
          </p>
        </div>
      </div>
    );
  }

  const sections = parseEulaSections(EULA_TEXT);

  return (
    <>
      {accepted && forceShow && children}
      <div style={styles.overlay}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.logoBadge}>EN</div>
            <div>
              <div style={styles.brandLine}>ELECTROSOFT AUTOMATION PVT. LTD.</div>
              <h2 style={styles.title}>End User License Agreement</h2>
              <div style={styles.metaLine}>
                Software: <span style={styles.metaValue}>ReactorX</span> &nbsp;·&nbsp;
                Effective Date: <span style={styles.metaValue}>09 Sept 2026</span>
              </div>
            </div>
          </div>

          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${isViewOnly ? 100 : scrollProgress}%` }} />
          </div>

          <div ref={scrollRef} style={styles.scrollBox} onScroll={handleScroll}>
            {sections.map((s) =>
              s.isHeading ? (
                <div key={s.key} style={styles.sectionHeading}>
                  {s.text}
                </div>
              ) : (
                <p key={s.key} style={styles.paragraph}>
                  {s.text}
                </p>
              )
            )}
            <div style={styles.endMarker}>— END OF AGREEMENT —</div>
          </div>

          {isViewOnly ? (
            <div style={styles.buttonRow}>
              <button style={styles.agreeBtn} onClick={onCloseForceShow}>
                Close
              </button>
            </div>
          ) : (
            <>
              {!scrolledToBottom && (
                <div style={styles.scrollHint}>↓ Scroll to the end to continue</div>
              )}
              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  disabled={!scrolledToBottom}
                  style={styles.checkbox}
                />
                <span style={{ color: scrolledToBottom ? '#d1d5db' : '#52525b', fontSize: 13 }}>
                  I have read, understood, and agree to be legally bound by the terms of this Agreement.
                </span>
              </label>
              <div style={styles.buttonRow}>
                <button style={styles.declineBtn} onClick={handleDecline}>
                  Decline
                </button>
                <button
                  style={{
                    ...styles.agreeBtn,
                    opacity: canAgree ? 1 : 0.4,
                    cursor: canAgree ? 'pointer' : 'not-allowed',
                  }}
                  onClick={handleAgree}
                  disabled={!canAgree}
                >
                  I Agree & Continue
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(6, 6, 8, 0.97)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20,
  },
  card: {
    background: 'linear-gradient(180deg, #15171f 0%, #101218 100%)',
    border: '1px solid #2a2d3a',
    borderRadius: 14,
    padding: '28px 32px',
    width: '100%',
    maxWidth: 700,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: '1px solid #24262f',
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 10,
    background: '#f97316',
    color: '#0a0a0c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 15,
    flexShrink: 0,
  },
  brandLine: {
    color: '#f97316',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    marginBottom: 2,
  },
  title: {
    color: '#fff',
    fontSize: 19,
    fontWeight: 700,
    margin: '0 0 4px 0',
  },
  metaLine: {
    color: '#71717a',
    fontSize: 12,
  },
  metaValue: {
    color: '#a1a1aa',
    fontWeight: 600,
  },
  progressTrack: {
    height: 3,
    background: '#1f2029',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#f97316',
    transition: 'width 0.15s ease-out',
  },
  scrollBox: {
    overflowY: 'auto',
    flex: 1,
    background: '#0b0c10',
    border: '1px solid #22242e',
    borderRadius: 10,
    padding: '18px 20px',
    marginBottom: 12,
  },
  sectionHeading: {
    color: '#f97316',
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: '0.04em',
    marginTop: 18,
    marginBottom: 6,
  },
  paragraph: {
    color: '#b8bcc8',
    fontSize: 12.5,
    lineHeight: 1.7,
    margin: '0 0 10px 0',
    whiteSpace: 'pre-wrap',
  },
  endMarker: {
    textAlign: 'center',
    color: '#4b4d59',
    fontSize: 11,
    letterSpacing: '0.15em',
    marginTop: 20,
  },
  scrollHint: {
    textAlign: 'center',
    color: '#71717a',
    fontSize: 11.5,
    marginBottom: 10,
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 18,
    cursor: 'pointer',
  },
  checkbox: {
    marginTop: 2,
    width: 15,
    height: 15,
    accentColor: '#f97316',
    cursor: 'pointer',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
  },
  declineBtn: {
    padding: '10px 22px',
    borderRadius: 8,
    border: '1px solid #3f3f46',
    background: 'transparent',
    color: '#d1d5db',
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 500,
  },
  agreeBtn: {
    padding: '10px 22px',
    borderRadius: 8,
    border: 'none',
    background: '#f97316',
    color: '#0a0a0c',
    fontWeight: 700,
    fontSize: 13.5,
  },
};