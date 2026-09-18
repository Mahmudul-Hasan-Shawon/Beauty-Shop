import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const STORE = {
  name: 'Petal & Rose',
  phone: '+880 1874 460244',
  email: 'hello@petalrose.com',
  address: 'Level 3, House 12, Road 5, Gulshan 1, Dhaka 1212, Bangladesh'
};

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const PAGES = {
  privacy: {
    eyebrow: 'Privacy Policy',
    title: 'Privacy Policy',
    lede: 'How Petal & Rose collects, uses, and protects the information you share with us.',
    lastUpdated: 'September 14, 2026',
    sections: [
      {
        heading: 'Introduction',
        content: [
          `${STORE.name} is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, place an order, subscribe to our newsletter, or contact our support team.`,
          'Please read this policy carefully. If you do not agree with the terms of this Privacy Policy, please do not use our website.'
        ]
      },
      {
        heading: 'Information We Collect',
        content: [
          'We collect information that you provide directly to us, including your name, phone number, delivery address, email address, and the order details you submit at checkout. We may also collect your skincare preferences when you answer our routine-finder quiz or contact our care team.',
          'We automatically collect certain data when you visit our website, such as your IP address, browser type, pages viewed, links clicked, and how long you spend on each page. This data is collected through cookies and similar technologies to help us improve your shopping experience.'
        ]
      },
      {
        heading: 'How We Use Your Information',
        content: [
          'We use the information we collect to process and deliver your orders, confirm orders by phone, handle returns and refunds, respond to your questions, share order updates, and provide a personalised shopping experience.',
          'We also use it to analyse website usage, prevent fraud and unauthorised activity, and — only with your consent — send you marketing updates about new arrivals, restocks, and offers. You can opt out at any time.'
        ]
      },
      {
        heading: 'Information Sharing',
        content: [
          'We never sell your personal information. We may share your details with trusted courier partners (including DABS) to deliver your order, and with service providers who help us operate our website and process payments, provided those parties agree to keep your information confidential.',
          'We may also disclose your information when required by law, or to protect our rights, property, or safety, and the safety of our customers.'
        ]
      },
      {
        heading: 'Cookies and Tracking Technologies',
        content: [
          'Our website uses cookies to save your shopping cart, remember your preferences, and understand how you browse so we can keep improving the store.',
          'You can disable cookies through your browser settings at any time. Doing so may affect some features, such as remembering items in your cart.'
        ]
      },
      {
        heading: 'Payments and Data Security',
        content: [
          'We offer Cash on Delivery (COD) across Bangladesh. When you pay online via bKash, Nagad, or card services, payment details are handled directly by the payment provider through secure, encrypted connections — we do not store your card numbers or PINs on our servers.',
          'We implement appropriate technical and organisational measures to protect your personal information. However, no method of transmission over the internet is 100% secure, so we cannot guarantee absolute security.'
        ]
      },
      {
        heading: 'Your Rights',
        content: [
          `You may request access to, correction of, or deletion of your personal information at any time. To exercise any of these rights, please contact us at ${STORE.email} or ${STORE.phone}.`
        ]
      },
      {
        heading: 'Third-Party Links',
        content: [
          'Our website may contain links to third-party websites, including brand websites and social media pages. We are not responsible for the privacy practices of these sites, and we encourage you to read the privacy policy of every website you visit.'
        ]
      },
      {
        heading: "Children's Privacy",
        content: [
          'Our products and services are intended for adults. We do not knowingly collect personal information from children. If we become aware that we have collected personal information from a child, we will take steps to delete it.'
        ]
      },
      {
        heading: 'Changes to This Policy',
        content: [
          'We may update this Privacy Policy from time to time. We will post any changes on this page and update the "Last Updated" date. Your continued use of the website after any changes constitutes acceptance of the updated policy.'
        ]
      },
      {
        heading: 'Contact Us',
        content: [
          `If you have any questions about this Privacy Policy, please contact us at ${STORE.name}, ${STORE.address}, by phone at ${STORE.phone}, or by email at ${STORE.email}.`
        ]
      }
    ]
  },
  terms: {
    eyebrow: 'Terms & Conditions',
    title: 'Terms & Conditions',
    lede: 'The terms that govern your use of our website and your purchases from Petal & Rose.',
    lastUpdated: 'September 14, 2026',
    sections: [
      {
        heading: 'Acceptance of Terms',
        content: [
          `By accessing or using the website and services provided by ${STORE.name}, you agree to be bound by these Terms & Conditions. If you do not agree to these terms, please do not use our website or place an order.`
        ]
      },
      {
        heading: 'Products and Authenticity',
        content: [
          'We sell genuine Korean and global beauty products sourced from authorised distributors and verified suppliers. Every product is inspected before it is shipped to ensure authenticity, freshness, and proper storage.',
          'Product images are representative. Minor differences may occur due to packaging updates or batch variations from manufacturers.'
        ]
      },
      {
        heading: 'Pricing and Payment',
        content: [
          'All prices are in Bangladeshi Taka (BDT) and are inclusive of applicable taxes unless stated otherwise. We reserve the right to change prices at any time without prior notice; the price shown at checkout is the price you pay.',
          'We accept Cash on Delivery (COD), bKash, Nagad, and other listed payment methods. Your order may be confirmed by phone before dispatch.'
        ]
      },
      {
        heading: 'Placing an Order',
        content: [
          'When you place an order, you agree to provide accurate and complete delivery details, including a valid phone number and correct address. Orders are reviewed and confirmed by our team before shipping.',
          'We reserve the right to cancel or refuse orders at our discretion, for example if a product is out of stock or we suspect fraudulent activity. We will notify you and refund any amount paid.'
        ]
      },
      {
        heading: 'Shipping and Delivery',
        content: [
          'Inside Dhaka, delivery takes 1–2 working days and costs 60 TK. Outside Dhaka, delivery takes 2–4 working days and costs 120 TK. Orders placed before 3 PM usually ship the same day.',
          'Delivery is free when your order value reaches the free-delivery threshold shown at checkout. Delivery times are estimates and may be affected by holidays, weather, or courier delays.',
          'You can track your order anytime from the Track Order page using your Order ID or phone number.'
        ]
      },
      {
        heading: 'Returns and Refunds',
        content: [
          'Unopened, unused products may be returned within 7 days of delivery. To arrange a return or exchange, please contact our support team with your Order ID.',
          'Refunds for prepaid orders are processed to your original payment method within 3–5 working days of the returned item being received and inspected.'
        ]
      },
      {
        heading: 'Intellectual Property',
        content: [
          'All content on this website, including text, graphics, logos, images, and software, is the property of Petal & Rose or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or use this content without our prior written permission.',
          'All product names, logos, and brands are property of their respective owners and are used for identification purposes only.'
        ]
      },
      {
        heading: 'User Conduct',
        content: [
          'You agree not to use our website for any unlawful purpose, to misrepresent your identity, to attempt to gain unauthorised access to our systems, or to interfere with the normal operation of the website.',
          'Reviews and messages you post must be honest, respectful, and not violate the rights of others. We may remove content that breaches these terms.'
        ]
      },
      {
        heading: 'Disclaimer of Warranties',
        content: [
          'We strive to provide authentic, high-quality products and accurate information. However, we make no warranties or representations about the accuracy, completeness, or reliability of the content on our website.',
          'Skincare products affect people differently. Always read the ingredient list and patch-test new products. We do not provide medical advice, and results may vary from person to person.'
        ]
      },
      {
        heading: 'Limitation of Liability',
        content: [
          `To the maximum extent permitted by law, ${STORE.name} shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of, or inability to use, our website or products.`,
          'Our total liability for any claim arising from a purchase shall not exceed the amount you paid for the product in question.'
        ]
      },
      {
        heading: 'Indemnification',
        content: [
          `You agree to indemnify, defend, and hold harmless ${STORE.name}, its owners, employees, and agents from any claims, liabilities, damages, and expenses arising from your use of our website, your violation of these terms, or your misuse of any product.`
        ]
      },
      {
        heading: 'Governing Law',
        content: [
          'These Terms & Conditions are governed by the laws of the People\'s Republic of Bangladesh. Any disputes shall be resolved in the courts of Dhaka, Bangladesh.'
        ]
      },
      {
        heading: 'Changes to These Terms',
        content: [
          'We reserve the right to update these Terms & Conditions at any time. Changes will be posted on this page with an updated date. Your continued use of our website and services after any changes constitutes acceptance of the revised terms.'
        ]
      },
      {
        heading: 'Contact Us',
        content: [
          `If you have any questions about these Terms & Conditions, please contact us by phone at ${STORE.phone}, by email at ${STORE.email}, or through our contact page.`
        ]
      }
    ]
  }
};

export default function LegalPage({ type }) {
  const page = PAGES[type] || PAGES.privacy;
  const prefix = type === 'terms' ? 'terms' : 'privacy';
  const bodyRef = useRef(null);
  const listRef = useRef(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll('[data-legal-sec]'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number(e.target.dataset.index) || 0);
        }
      },
      { rootMargin: '-20% 0px -65% 0px' }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [page.sections.length]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const link = el.querySelector(`li:nth-child(${active + 1})`);
    if (link) link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active]);

  const jump = (i) => {
    const el = document.getElementById(`${prefix}-${slugify(page.sections[i].heading)}`);
    if (!el) return;
    const go = () => el.scrollIntoView({ behavior: 'smooth' });
    if (open) { setOpen(false); setTimeout(go, 320); } else go();
  };

  const current = page.sections[active]?.heading || '';

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <div className="legal-hero">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / {page.eyebrow}
        </div>
        <div className="eyebrow">{page.eyebrow}</div>
        <h1>{page.title}</h1>
        <p className="legal-lede">{page.lede}</p>
        <p className="legal-updated">Last updated {page.lastUpdated}</p>
      </div>

      <div className="legal-layout">
        <aside className="legal-toc" aria-label="On this page">
          <p className="legal-toc-title">In this document</p>
          <nav>
            <ul>
              {page.sections.map((s, i) => (
                <li key={s.heading}>
                  <a
                    href={`#${prefix}-${slugify(s.heading)}`}
                    onClick={(e) => { e.preventDefault(); jump(i); }}
                    className={active === i ? 'on' : ''}
                  >
                    <span className="legal-num">{String(i + 1).padStart(2, '0')}</span>
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0">
          <div className={`legal-mtoc ${open ? 'open' : ''}`}>
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
              <span className="legal-mtoc-head">
                <span className="legal-mtoc-label">Table of Contents</span>
                <span className="legal-mtoc-cur">{current || 'Jump to a section'}</span>
              </span>
              <i className={`fa-solid fa-chevron-down ${open ? 'up' : ''}`} />
            </button>
            <div className={`legal-mtoc-body ${open ? 'open' : ''}`}>
              <nav ref={listRef}>
                <ul>
                  {page.sections.map((s, i) => (
                    <li key={s.heading}>
                      <a
                        href={`#${prefix}-${slugify(s.heading)}`}
                        onClick={(e) => { e.preventDefault(); jump(i); }}
                        className={active === i ? 'on' : ''}
                      >
                        <span className="legal-num">{String(i + 1).padStart(2, '0')}</span>
                        {s.heading}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>

          <div ref={bodyRef}>
            {page.sections.map((s, i) => (
              <section
                key={s.heading}
                id={`${prefix}-${slugify(s.heading)}`}
                data-legal-sec
                data-index={i}
                className="legal-sec"
                aria-label={`${page.eyebrow}: ${s.heading}`}
              >
                <h2>{s.heading}</h2>
                <div className="legal-body">
                  {s.content.map((p, mi) => <p key={mi}>{p}</p>)}
                </div>
              </section>
            ))}
          </div>

          <p className="legal-foot">
            {STORE.name} — {STORE.address}
          </p>
        </div>
      </div>
    </div>
  );
}