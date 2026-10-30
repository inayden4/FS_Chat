import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  UI_TRANSLATIONS,
  Language,
  NostrIdentity,
  UserProfile,
  DirectMessage,
  ChannelMessage,
  ChatChannel
} from './types';
import * as db from './services/db';
import {
  INITIAL_PROFILES,
  INITIAL_CHANNELS,
  INITIAL_ROOM_MESSAGES,
  performIncrementalSync,
  createFreshIdentity,
  ensure64Hex
} from './services/nostr';
import {
  getChatPreferences,
  useChatPreferences,
  applyThemeToDocument,
  triggerTextMessageSound,
  triggerVoiceMessageSound,
  triggerJoinRequestSound,
  triggerReminderAlertSound
} from './services/chatPreferences';
import { Header } from './components/Header';
import { MobileHeaderNav } from './components/MobileHeaderNav';
import { ChatSettingsModal } from './components/ChatSettingsModal';
import { SecurityWarningModal } from './components/SecurityWarningModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { DatingView } from './components/DatingView';
import { ChatsView } from './components/ChatsView';
import { GroupsView } from './components/GroupsView';
import { SettingsView } from './components/SettingsView';

type TabType = 'dating' | 'chats' | 'groups' | 'settings';

export default function App() {
  // 1. Language state
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('nostr_lang') as Language) || 'bg';
  });

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('nostr_lang', newLang);
  };

  const t = UI_TRANSLATIONS[lang];

  // Global Chat Theme synchronization across the entire app interface
  const [chatPrefs] = useChatPreferences();
  useEffect(() => {
    applyThemeToDocument(chatPrefs.theme);
  }, [chatPrefs.theme]);

  // Synchronize browser document title with localized app name
  useEffect(() => {
    document.title = t.APP_TITLE;
  }, [t.APP_TITLE]);

  // 2. Identity & Profile state
  const [identity, setIdentity] = useState<NostrIdentity | null>(null);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showChatSettingsModal, setShowChatSettingsModal] = useState<boolean>(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState<boolean>(false);

  // 3. Navigation Tab state
  const [activeTab, setActiveTab] = useState<TabType>('dating');
  const [activeChatPubkey, setActiveChatPubkey] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  // Desktop header auto-hide on scroll & reveal on top hover
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolledDown(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 4. Data states
  const [profiles, setProfiles] = useState<UserProfile[]>(INITIAL_PROFILES);
  const [savedAccounts, setSavedAccounts] = useState<db.SavedAccount[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>(INITIAL_CHANNELS);
  const [channelMessages, setChannelMessages] = useState<ChannelMessage[]>([]);

  // 5. Sync State
  const [isSynced, setIsSynced] = useState<boolean>(false);

  // Initial Local-First Load (<0.01s instant UI bootstrap)
  useEffect(() => {
    async function initLocalFirst() {
      // Load Identity
      let currentId = await db.loadIdentity();
      if (!currentId) {
        // Auto-generate fresh cypherpunk identity for instant frictionless testing
        currentId = createFreshIdentity();
        await db.saveIdentity(currentId);
      }
      setIdentity(currentId);

      // Load Profile
      let prof = await db.loadMyProfile(currentId.pubKeyHex);
      if (!prof) {
        prof = {
          pubkey: currentId.pubKeyHex,
          name: `Anon_${currentId.npub.slice(-4)}`,
          age: 26,
          location: 'София / Sofia',
          bio: 'Свободен потребител в Nostr мрежата.',
          updatedAt: Date.now()
        };
        await db.saveMyProfile(prof);
      }
      setMyProfile(prof);

      // Load Friends, Blocked, Hidden
      const [savedFriends, savedBlocked, savedHidden] = await Promise.all([
        db.getFriends(),
        db.getBlocked(),
        db.getHidden()
      ]);
      setFriends(savedFriends);
      setBlocked(savedBlocked);
      setHidden(savedHidden);

      // Purge any legacy demo mock profiles from IndexedDB cache
      const demoPubkeys = [
        'e1e0a8950f1a938472918239018230918230918230918230918234a001',
        'b1c709910fd172837492837492837492837492837492837492837b0002',
        'c0a9a89a81a892374982374982374982374982374982374982374c0003',
        'd1e51001a1e992837492837492837492837492837492837492837d0004',
        'e281571a08b989237498237498237498237498237498237498237e0005'
      ];
      for (const dpk of demoPubkeys) {
        try {
          await db.deleteProfile(dpk);
        } catch {}
      }

      // Load Cached Profiles (Clean: Only genuine user-created / discovered profiles)
      const cachedProfiles = await db.getAllProfiles();
      const realProfiles = cachedProfiles.filter(p => !demoPubkeys.includes(p.pubkey) && p.pubkey !== currentId.pubKeyHex);
      setProfiles(realProfiles);

      // Load Direct Messages (Clean: filter out any legacy demo DMs)
      const dms = await db.getDirectMessages();
      const cleanDms = dms.filter(d => !demoPubkeys.includes(d.fromPubkey) && !demoPubkeys.includes(d.toPubkey) && !demoPubkeys.includes(d.chatWithPubkey));
      setDirectMessages(cleanDms);

      // Load Channels (Clean: filter out any legacy demo default rooms)
      const demoChannelIdentifiers = [
        'room-free-dating-bg',
        'room-night-sofia',
        'room-cyber-singles',
        'room-kink-casual',
        ensure64Hex('room-free-dating-bg'),
        ensure64Hex('room-night-sofia'),
        ensure64Hex('room-cyber-singles'),
        ensure64Hex('room-kink-casual')
      ];

      const dbChannels = await db.getAllChannels();
      const channelMap = new Map<string, ChatChannel>();
      for (const ch of dbChannels) {
        if (demoChannelIdentifiers.includes(ch.id) || demoChannelIdentifiers.includes(ensure64Hex(ch.id))) {
          // Delete old demo room from indexedDB
          await db.deleteChannel(ch.id);
          continue;
        }
        const validId = ensure64Hex(ch.id);
        if (validId !== ch.id) {
          await db.deleteChannel(ch.id);
          const updated = { ...ch, id: validId };
          await db.saveChannel(updated);
          if (!channelMap.has(validId)) {
            channelMap.set(validId, updated);
          }
        } else {
          if (!channelMap.has(ch.id)) {
            channelMap.set(ch.id, ch);
          }
        }
      }
      setChannels(Array.from(channelMap.values()));

      // Load Channel Messages for active genuine channels only
      let allCm: ChannelMessage[] = [];
      for (const ch of Array.from(channelMap.values())) {
        const msgs = await db.getChannelMessages(ch.id);
        allCm = allCm.concat(msgs);
      }
      setChannelMessages(allCm);

      // Load Saved Accounts Vault
      const accounts = await db.getSavedAccounts();
      setSavedAccounts(accounts);

      // Trigger background incremental sync with relays
      triggerRelaySync(currentId);
    }

    initLocalFirst();
  }, []);

  // Background sync helper
  const triggerRelaySync = useCallback(async (currentIdentity: NostrIdentity) => {
    setIsSynced(false);
    try {
      await performIncrementalSync(currentIdentity, undefined, (synced) => {
        setIsSynced(synced);
      });
      // Refresh local DMs
      const dms = await db.getDirectMessages();
      setDirectMessages(dms);
    } catch {
      setIsSynced(true);
    }
  }, []);

  // 6. Sound notifications & unread tracking
  const isInitialLoadDone = useRef(false);
  const prevDmCountRef = useRef(0);
  const prevCmCountRef = useRef(0);
  const prevJoinReqCountRef = useRef(0);

  // Mark active chat as read
  useEffect(() => {
    if (activeChatPubkey) {
      try {
        const raw = localStorage.getItem('nostr_chat_read_times');
        const map = raw ? JSON.parse(raw) : {};
        map[activeChatPubkey] = Date.now();
        localStorage.setItem('nostr_chat_read_times', JSON.stringify(map));
      } catch {}
    }
  }, [activeChatPubkey, directMessages]);

  // Unread messages count
  const unreadCount = useMemo(() => {
    if (!identity) return 0;
    let count = 0;
    let readTimes: Record<string, number> = {};
    try {
      const raw = localStorage.getItem('nostr_chat_read_times');
      if (raw) readTimes = JSON.parse(raw);
    } catch {}

    const counterpartLatest = new Map<string, number>();
    for (const dm of directMessages) {
      if (dm.fromPubkey === identity.pubKeyHex) continue; // outgoing
      if (blocked.includes(dm.fromPubkey)) continue;
      const latest = counterpartLatest.get(dm.fromPubkey) || 0;
      if (dm.timestamp > latest) {
        counterpartLatest.set(dm.fromPubkey, dm.timestamp);
      }
    }

    counterpartLatest.forEach((lastTimestamp, pubkey) => {
      if (activeTab === 'chats' && activeChatPubkey === pubkey) return;
      const readAt = readTimes[pubkey] || 0;
      if (lastTimestamp > readAt) {
        count++;
      }
    });

    return count;
  }, [directMessages, identity, blocked, activeTab, activeChatPubkey]);

  // Pending room join requests count (as creator)
  const pendingRequestsCount = useMemo(() => {
    if (!identity) return 0;
    return channels.reduce((acc, ch) => {
      if (ch.creatorPubkey === identity.pubKeyHex && ch.pendingRequests) {
        return acc + ch.pendingRequests.length;
      }
      return acc;
    }, 0);
  }, [channels, identity]);

  // Unaccepted invitations to rooms
  const unacceptedInvitesCount = useMemo(() => {
    if (!identity) return 0;
    return channels.reduce((acc, ch) => {
      const isInvited = ch.invitedPubkeys?.includes(identity.pubKeyHex);
      const isMember = ch.members?.includes(identity.pubKeyHex);
      const isCreator = ch.creatorPubkey === identity.pubKeyHex;
      if (isInvited && !isMember && !isCreator) {
        return acc + 1;
      }
      return acc;
    }, 0);
  }, [channels, identity]);

  // Sound triggers on incoming messages/requests
  useEffect(() => {
    if (!isInitialLoadDone.current) {
      if (directMessages.length > 0 || channelMessages.length > 0 || channels.length > 0) {
        isInitialLoadDone.current = true;
        prevDmCountRef.current = directMessages.length;
        prevCmCountRef.current = channelMessages.length;
        prevJoinReqCountRef.current = pendingRequestsCount;
      }
      return;
    }

    // Direct Messages sound check
    if (directMessages.length > prevDmCountRef.current) {
      const newDms = directMessages.slice(prevDmCountRef.current);
      const incoming = newDms.filter(d => !d.isOutgoing && d.fromPubkey !== identity?.pubKeyHex);
      if (incoming.length > 0) {
        const last = incoming[incoming.length - 1];
        const isVoice = last.mediaType === 'audio' ||
          (last.content && (last.content.includes('[voice]') || last.content.includes('🎙️'))) ||
          Boolean(last.mediaUrl && /\.(mp3|wav|ogg|m4a|webm)($|\?)/i.test(last.mediaUrl));
        if (isVoice) {
          triggerVoiceMessageSound();
        } else {
          triggerTextMessageSound();
        }
      }
    }
    prevDmCountRef.current = directMessages.length;

    // Channel Messages sound check
    if (channelMessages.length > prevCmCountRef.current) {
      const newCms = channelMessages.slice(prevCmCountRef.current);
      const incomingCms = newCms.filter(c => c.fromPubkey !== identity?.pubKeyHex);
      if (incomingCms.length > 0) {
        const last = incomingCms[incomingCms.length - 1];
        const isVoice = (last.content && (last.content.includes('[voice]') || last.content.includes('🎙️'))) ||
          Boolean(last.mediaUrl && /\.(mp3|wav|ogg|m4a|webm)($|\?)/i.test(last.mediaUrl));
        if (isVoice) {
          triggerVoiceMessageSound();
        } else {
          triggerTextMessageSound();
        }
      }
    }
    prevCmCountRef.current = channelMessages.length;

    // Join requests sound check
    if (pendingRequestsCount > prevJoinReqCountRef.current) {
      triggerJoinRequestSound();
    }
    prevJoinReqCountRef.current = pendingRequestsCount;
  }, [directMessages, channelMessages, pendingRequestsCount, identity]);

  // Periodic Reminder Alert Loop
  useEffect(() => {
    const totalPending = unreadCount + pendingRequestsCount + unacceptedInvitesCount;
    if (totalPending <= 0) return;

    const checkAndRemind = () => {
      const prefs = getChatPreferences();
      if (prefs.sounds.reminderEnabled && prefs.sounds.reminderAlertSound) {
        triggerReminderAlertSound();
      }
    };

    const prefs = getChatPreferences();
    const intervalMinutes = Math.max(1, prefs.sounds.reminderIntervalMinutes || 3);
    const intervalMs = intervalMinutes * 60 * 1000;

    const timer = setInterval(checkAndRemind, intervalMs);
    return () => clearInterval(timer);
  }, [unreadCount, pendingRequestsCount, unacceptedInvitesCount]);

  // Start Chat from profile card
  const handleStartChat = (pubkey: string) => {
    setActiveChatPubkey(pubkey);
    setActiveTab('chats');
  };

  // Toggle Friend handler
  const handleToggleFriend = async (pubkey: string) => {
    await db.toggleFriend(pubkey);
    const updated = await db.getFriends();
    setFriends(updated);
  };

  // Toggle Block handler
  const handleToggleBlock = async (pubkey: string) => {
    await db.toggleBlocked(pubkey);
    const updated = await db.getBlocked();
    setBlocked(updated);
  };

  // Toggle Hide handler
  const handleToggleHide = async (pubkey: string) => {
    await db.toggleHidden(pubkey);
    const updated = await db.getHidden();
    setHidden(updated);
  };

  // Message sent callback
  const handleDirectMessageSent = (dm: DirectMessage) => {
    setDirectMessages(prev => [...prev, dm]);
  };

  // Message deleted callback
  const handleDirectMessageDeleted = (id: string) => {
    setDirectMessages(prev => prev.filter(m => m.id !== id));
  };

  // Message updated callback
  const handleDirectMessageUpdated = (updatedDm: DirectMessage) => {
    setDirectMessages(prev => prev.map(m => m.id === updatedDm.id ? updatedDm : m));
  };

  // Channel message sent callback
  const handleChannelMessageSent = (cm: ChannelMessage) => {
    setChannelMessages(prev => [...prev, cm]);
  };

  // Channel message deleted callback
  const handleChannelMessageDeleted = (id: string) => {
    setChannelMessages(prev => prev.filter(m => m.id !== id));
  };

  // Channel message updated callback
  const handleChannelMessageUpdated = (updatedCm: ChannelMessage) => {
    setChannelMessages(prev => prev.map(m => m.id === updatedCm.id ? updatedCm : m));
  };

  // New Channel created callback
  const handleNewChannelCreated = (ch: ChatChannel) => {
    setChannels(prev => {
      if (prev.some(c => c.id === ch.id)) {
        return prev.map(c => c.id === ch.id ? ch : c);
      }
      return [ch, ...prev];
    });
  };

  // Channel updated callback
  const handleChannelUpdated = (updated: ChatChannel) => {
    setChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  // Switch to another saved account
  const handleSwitchAccount = async (targetIdentity: NostrIdentity) => {
    await db.saveIdentity(targetIdentity);
    setIdentity(targetIdentity);
    let prof = await db.loadMyProfile(targetIdentity.pubKeyHex);
    if (!prof) {
      prof = {
        pubkey: targetIdentity.pubKeyHex,
        name: `Anon_${targetIdentity.npub.slice(-4)}`,
        age: 26,
        location: 'София / Sofia',
        bio: 'Свободен потребител в Nostr мрежата.',
        updatedAt: Date.now()
      };
      await db.saveMyProfile(prof);
    }
    setMyProfile(prof);
    const updatedAccounts = await db.getSavedAccounts();
    setSavedAccounts(updatedAccounts);
    triggerRelaySync(targetIdentity);
  };

  // Quick Logout
  const handleQuickLogout = async () => {
    if (window.confirm(t.LOGOUT_CONFIRM)) {
      await db.clearIdentity();
      setIdentity(null);
      setMyProfile(null);
      setShowAuthModal(true);
    }
  };

  // Logout & Reset
  const handleLogout = async () => {
    await db.clearIdentity();
    const fresh = createFreshIdentity();
    await db.saveIdentity(fresh);
    setIdentity(fresh);
    const freshProfile = {
      pubkey: fresh.pubKeyHex,
      name: `Anon_${fresh.npub.slice(-4)}`,
      age: 25,
      location: 'София / Sofia',
      updatedAt: Date.now()
    };
    await db.saveMyProfile(freshProfile);
    setMyProfile(freshProfile);
    const updatedAccounts = await db.getSavedAccounts();
    setSavedAccounts(updatedAccounts);
    setActiveTab('dating');
  };

  // Delete saved account from device
  const handleDeleteSavedAccount = async (pubkey: string) => {
    await db.removeSavedAccount(pubkey);
    const updated = await db.getSavedAccounts();
    setSavedAccounts(updated);
  };

  // Directly create a new profile automatically
  const handleCreateNewProfileDirect = async () => {
    const fresh = createFreshIdentity();
    await db.saveIdentity(fresh);
    setIdentity(fresh);
    const freshProfile = {
      pubkey: fresh.pubKeyHex,
      name: `Anon_${fresh.npub.slice(-4)}`,
      age: 25,
      location: 'София / Sofia',
      bio: 'Свободен потребител в Nostr мрежата.',
      updatedAt: Date.now()
    };
    await db.saveMyProfile(freshProfile);
    setMyProfile(freshProfile);
    const updatedAccounts = await db.getSavedAccounts();
    setSavedAccounts(updatedAccounts);
    triggerRelaySync(fresh);
    setActiveTab('dating');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] font-[var(--font-family)]">
      {/* 1. Mobile Header & Nav (Row 1: Logo+Title+Menu, Row 2: Lang+Profile, Row 3: Big Nav Icons) */}
      <MobileHeaderNav
        lang={lang}
        onLanguageChange={handleLanguageChange}
        identity={identity}
        myProfile={myProfile}
        savedAccounts={savedAccounts}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasUnreadChats={directMessages.length > 0}
        unreadCount={unreadCount}
        pendingRequestsCount={pendingRequestsCount}
        unacceptedInvitesCount={unacceptedInvitesCount}
        onOpenKeysAndBackups={() => setShowAuthModal(true)}
        onOpenChatSettings={() => setShowChatSettingsModal(true)}
        onOpenHowItWorks={() => setShowHowItWorksModal(true)}
        onOpenProfileSettings={() => setActiveTab('settings')}
        onSwitchAccount={handleSwitchAccount}
        onNewProfile={handleCreateNewProfileDirect}
        onDeleteSavedAccount={handleDeleteSavedAccount}
        onLogout={handleLogout}
      />

      {/* 2 & 3. Combined Desktop Header & Navigation (Connected as one block, auto-hides on scroll, reveals on top hover) */}
      <div className="hidden md:block">
        {/* Top hover sensor zone (when header is hidden, moving mouse to top-most 16px reveals it) */}
        <div
          className="fixed top-0 left-0 right-0 h-4 z-50 pointer-events-auto cursor-pointer"
          onMouseEnter={() => setIsHeaderHovered(true)}
        />

        {/* Small subtle reveal handle when header is scrolled away */}
        {isScrolledDown && !isHeaderHovered && (
          <button
            type="button"
            onClick={() => setIsHeaderHovered(true)}
            onMouseEnter={() => setIsHeaderHovered(true)}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-40 px-3 py-1 rounded-b-md bg-[#1B1B28]/95 hover:bg-[var(--primary)] text-[10px] font-bold text-white/80 hover:text-white transition-all shadow-lg border-b border-x border-[#3A3A4E] flex items-center gap-1.5 cursor-pointer select-none"
            title={lang === 'bg' ? 'Посочи или кликни тук за менюто и стаите' : 'Hover or click to show menu'}
          >
            <span>▼</span>
            <span>{lang === 'bg' ? 'Меню и Стаи' : 'Menu & Rooms'}</span>
          </button>
        )}

        {/* Unified Desktop Header & Tabs Bar */}
        <div
          className={`w-full z-40 transition-all duration-300 ${
            isScrolledDown
              ? `fixed top-0 left-0 right-0 shadow-2xl backdrop-blur-md ${
                  isHeaderHovered
                    ? 'translate-y-0 opacity-100 pointer-events-auto'
                    : '-translate-y-full opacity-0 pointer-events-none'
                }`
              : 'relative'
          }`}
          onMouseEnter={() => setIsHeaderHovered(true)}
          onMouseLeave={() => setIsHeaderHovered(false)}
        >
          {/* Row 1: Desktop Header */}
          <Header
            lang={lang}
            onLanguageChange={handleLanguageChange}
            isSynced={isSynced}
            identity={identity}
            myProfile={myProfile}
            savedAccounts={savedAccounts}
            onOpenIdentityModal={() => setShowAuthModal(true)}
            onOpenChatSettings={() => setShowChatSettingsModal(true)}
            onOpenHowItWorks={() => setShowHowItWorksModal(true)}
            onSwitchAccount={handleSwitchAccount}
            onNewProfile={handleCreateNewProfileDirect}
            onDeleteSavedAccount={handleDeleteSavedAccount}
            onQuickLogout={handleQuickLogout}
          />

          {/* Row 2: Desktop Navigation Tab Bar (Connected directly below Row 1, not floating independently) */}
          <div className="w-full bg-[var(--bg-surface)] border-b border-[#23232F]">
            <div className="max-w-7xl mx-auto px-4 flex items-center justify-between overflow-x-auto no-scrollbar">
              <nav className="flex space-x-1 sm:space-x-4 py-2">
                {/* TAB_DATING */}
                <button
                  id="tab-btn-dating"
                  onClick={() => setActiveTab('dating')}
                  title="Запознанства, разглеждане на профили и харесване"
                  aria-label={t.TAB_DATING}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-sm)] text-xs md:text-sm font-bold transition-all cursor-pointer ${
                    activeTab === 'dating'
                      ? 'bg-[var(--primary)] text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  <span>{t.TAB_DATING}</span>
                </button>

                {/* TAB_CHATS */}
                <button
                  id="tab-btn-chats"
                  onClick={() => setActiveTab('chats')}
                  title="Директни криптирани лични чатове (DMs)"
                  aria-label={t.TAB_CHATS}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-sm)] text-xs md:text-sm font-bold transition-all relative cursor-pointer ${
                    activeTab === 'chats'
                      ? 'bg-[var(--primary)] text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{t.TAB_CHATS}</span>
                  {unreadCount > 0 ? (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : directMessages.length > 0 ? (
                    <span className="w-2 h-2 rounded-full bg-[var(--secondary)] absolute top-2 right-1.5" />
                  ) : null}
                </button>

                {/* TAB_GROUPS */}
                <button
                  id="tab-btn-groups"
                  onClick={() => setActiveTab('groups')}
                  title="Тематични Nostr стаи и групови чатове"
                  aria-label={t.TAB_GROUPS}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-sm)] text-xs md:text-sm font-bold transition-all relative cursor-pointer ${
                    activeTab === 'groups'
                      ? 'bg-[var(--primary)] text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>{t.TAB_GROUPS}</span>
                  {(pendingRequestsCount + unacceptedInvitesCount > 0) && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center animate-bounce">
                      {pendingRequestsCount + unacceptedInvitesCount}
                    </span>
                  )}
                </button>

                {/* TAB_SETTINGS */}
                <button
                  id="tab-btn-settings"
                  onClick={() => setActiveTab('settings')}
                  title="Управление на профил, ключове и автоматичен бекъп"
                  aria-label={t.TAB_SETTINGS}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-sm)] text-xs md:text-sm font-bold transition-all cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-[var(--primary)] text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>{t.TAB_SETTINGS}</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-1.5 sm:p-4 md:p-6 min-w-0 overflow-x-hidden">
        {activeTab === 'dating' && (
          <DatingView
            lang={lang}
            profiles={profiles}
            friends={friends}
            blocked={blocked}
            hidden={hidden}
            onStartChat={handleStartChat}
            onToggleFriend={handleToggleFriend}
            onToggleBlock={handleToggleBlock}
            onToggleHide={handleToggleHide}
          />
        )}

        {activeTab === 'chats' && identity && (
          <ChatsView
            lang={lang}
            identity={identity}
            profiles={profiles}
            friends={friends}
            blocked={blocked}
            directMessages={directMessages}
            activeChatPubkey={activeChatPubkey}
            onSelectChat={setActiveChatPubkey}
            onToggleFriend={handleToggleFriend}
            onToggleBlock={handleToggleBlock}
            onMessageSent={handleDirectMessageSent}
            onMessageDeleted={handleDirectMessageDeleted}
            onMessageUpdated={handleDirectMessageUpdated}
            onOpenChatSettings={() => setShowChatSettingsModal(true)}
          />
        )}

        {activeTab === 'groups' && identity && (
          <GroupsView
            lang={lang}
            identity={identity}
            userName={myProfile?.name || 'Anon'}
            channels={channels}
            channelMessages={channelMessages}
            activeChannelId={activeChannelId}
            profiles={profiles}
            friends={friends}
            onSelectChannel={setActiveChannelId}
            onNewChannelCreated={handleNewChannelCreated}
            onChannelUpdated={handleChannelUpdated}
            onChannelMessageSent={handleChannelMessageSent}
            onChannelMessageDeleted={handleChannelMessageDeleted}
            onChannelMessageUpdated={handleChannelMessageUpdated}
            onStartChat={(pubkey) => {
              setActiveChatPubkey(pubkey);
              setActiveTab('chats');
            }}
            onToggleFriend={handleToggleFriend}
            onOpenChatSettings={() => setShowChatSettingsModal(true)}
          />
        )}

        {activeTab === 'settings' && identity && myProfile && (
          <SettingsView
            lang={lang}
            identity={identity}
            profile={myProfile}
            blockedPubkeys={blocked}
            hiddenPubkeys={hidden}
            onClose={() => setActiveTab('dating')}
            onProfileUpdated={(updated) => {
              setMyProfile(updated);
              setProfiles(prev => {
                const idx = prev.findIndex(p => p.pubkey === updated.pubkey);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updated;
                  return next;
                }
                return [updated, ...prev];
              });
            }}
            onUnblock={handleToggleBlock}
            onUnhide={handleToggleHide}
            onOpenHowItWorks={() => setShowHowItWorksModal(true)}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* 4. Chat Settings Modal */}
      <ChatSettingsModal
        lang={lang}
        isOpen={showChatSettingsModal}
        onClose={() => setShowChatSettingsModal(false)}
        blockedCount={blocked.length}
        onOpenBlockedUsers={() => setActiveTab('settings')}
        onHistoryCleared={async () => {
          const dms = await db.getDirectMessages();
          setDirectMessages(dms);
        }}
        onOpenHowItWorks={() => setShowHowItWorksModal(true)}
        unreadCount={unreadCount}
        pendingRequestsCount={pendingRequestsCount}
        unacceptedInvitesCount={unacceptedInvitesCount}
      />

      {/* 5. Security Warning & Key Login Modal */}
      <SecurityWarningModal
        lang={lang}
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onIdentityEstablished={(id) => {
          setIdentity(id);
          db.loadMyProfile(id.pubKeyHex).then(p => {
            if (p) setMyProfile(p);
          });
          db.getSavedAccounts().then(accs => setSavedAccounts(accs));
          triggerRelaySync(id);
        }}
        currentIdentity={identity}
        onLogout={handleLogout}
      />

      {/* 6. Educational Panel: How This Chat Works Modal */}
      <HowItWorksModal
        lang={lang}
        isOpen={showHowItWorksModal}
        onClose={() => setShowHowItWorksModal(false)}
        onOpenKeysModal={() => setShowAuthModal(true)}
      />
    </div>
  );
}
