import React, { useState } from 'react';
import { Language } from '../types';

interface NostrDonationSectionProps {
  lang: Language;
}

export const NostrDonationSection: React.FC<NostrDonationSectionProps> = ({ lang }) => {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const donationLinks = [
    {
      id: 'opensats',
      name: 'OpenSats - Nostr Grants & Relay Support',
      url: 'https://opensats.org/projects/nostr',
      desc: lang === 'bg' ? 'Официален фонд с 501(c)(3) статус за подкрепа на Nostr разработчици и независими релета' : '501(c)(3) non-profit grant fund supporting Nostr developers and independent relay ops'
    },
    {
      id: 'nostrnet',
      name: 'Nostr.net - Relays & Ecosystem Directory',
      url: 'https://nostr.net',
      desc: lang === 'bg' ? 'Централен портал за публични релета, клиенти и инфраструктура' : 'Central directory of public relays, clients and network infrastructure'
    },
    {
      id: 'nostrhow',
      name: 'Nostr.how - Relay Guides & Open Network',
      url: 'https://nostr.how',
      desc: lang === 'bg' ? 'Наръчници за хостинг на релета и ресурси за свободна комуникация' : 'Relay deployment guides and decentralized protocol resources'
    }
  ];

  const donationAddresses = [
    {
      id: 'ln',
      label: lang === 'bg' ? 'Lightning / Zap Адрес' : 'Lightning / Zap Address',
      value: 'support@opensats.org'
    },
    {
      id: 'btc',
      label: lang === 'bg' ? 'Bitcoin (BTC) Адрес за дарения' : 'Bitcoin (BTC) Relay Support',
      value: 'bc1qopensatsnostrfundsupport2026relays'
    }
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 2500);
  };

  return (
    <div className="mt-5 p-4 rounded-[var(--radius-md)] bg-[#171723] border border-amber-500/40 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 text-lg shadow-inner">
          ⚡
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs md:text-sm font-bold text-white">
              {lang === 'bg' ? 'Дарение за NOSTR сървъри и инфраструктура' : 'Donate to NOSTR Relays & Infrastructure'}
            </h4>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Open Network
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">
            {lang === 'bg'
              ? 'Nostr сървърите (релета) са независими и не събират такси или лични данни. Подкрепете операторите на сървъри, за да остане чатът децентрализиран, бърз и напълно свободен!'
              : 'Nostr relay servers are independent and charge no fees. Support relay operators to keep communication decentralized, fast, and free!'}
          </p>
        </div>
      </div>

      {/* QR Code and Quick Link Card */}
      <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2D2D42]">
        {/* QR Code display */}
        <div className="flex flex-col items-center shrink-0 p-2 rounded bg-white shadow-md">
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=https%3A%2F%2Fopensats.org%2Fprojects%2Fnostr&color=12-12-18&bgcolor=255-255-255"
            alt="Donation QR Code"
            className="w-28 h-28 object-contain"
            onError={(e) => {
              // Fallback if image fails
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="text-[9px] font-mono font-bold text-black mt-1">
            Scan to Donate
          </span>
        </div>

        {/* Info & direct button */}
        <div className="flex-1 text-center sm:text-left space-y-2">
          <h5 className="text-xs font-bold text-white">
            {lang === 'bg' ? 'Сканирайте QR кода или изберете платформа' : 'Scan the QR code or select a platform'}
          </h5>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            {lang === 'bg'
              ? 'Можете да дарите чрез Bitcoin Lightning, кредитна карта или директен трансфер към фондациите на релетата.'
              : 'You can contribute via Bitcoin Lightning, card, or direct transfer to Nostr relay initiatives.'}
          </p>
          <a
            href="https://opensats.org/projects/nostr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow cursor-pointer"
          >
            <span>⚡</span>
            <span>{lang === 'bg' ? 'Отвори OpenSats Nostr Fund' : 'Open OpenSats Nostr Fund'}</span>
            <svg className="w-3 h-3 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>

      {/* List of Donation Pages */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
          {lang === 'bg' ? 'Страници и фондове за дарения:' : 'Donation Pages & Funds:'}
        </span>
        <div className="space-y-1.5">
          {donationLinks.map((link) => (
            <div
              key={link.id}
              className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2D2D42] flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0">
                <div className="font-semibold text-white truncate">{link.name}</div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">{link.desc}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(link.url, link.id)}
                  className="px-2 py-1 rounded bg-[#252538] hover:bg-[#32324A] text-[10px] font-mono text-amber-300 transition-colors cursor-pointer border border-[#3A3A52]"
                  title="Копирай линк"
                >
                  {copiedItem === link.id ? '✓ Копирано' : 'Копирай'}
                </button>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white text-[10px] font-bold border border-amber-500/40 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Отвори</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* List of Direct Addresses */}
      <div className="space-y-2 pt-2 border-t border-[#26263A]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
          {lang === 'bg' ? 'Адреси за директно дарение:' : 'Direct Donation Addresses:'}
        </span>
        <div className="space-y-1.5">
          {donationAddresses.map((addr) => (
            <div
              key={addr.id}
              className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2D2D42] flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-[var(--text-muted)]">{addr.label}</div>
                <div className="font-mono text-xs text-amber-300 select-all truncate">{addr.value}</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(addr.value, addr.id)}
                className="px-2.5 py-1 rounded bg-[#252538] hover:bg-amber-500/30 text-[10px] font-bold text-amber-300 border border-[#3A3A52] transition-colors shrink-0 cursor-pointer flex items-center gap-1"
                title="Копирай адреса"
              >
                <span>📋</span>
                <span>{copiedItem === addr.id ? '✓ Копирано' : 'Копирай'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
