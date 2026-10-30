import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UI_TRANSLATIONS, Language, UserProfile, DirectMessage, NostrIdentity } from '../types';
import { publishDirectMessageEvent } from '../services/nostr';
import { MediaGalleryModal } from './MediaGalleryModal';
import { EmojiPicker } from './EmojiPicker';
import { uploadMediaFile, normalizeMediaUrl } from '../services/mediaUpload';
import { getEffectiveAvatar } from '../services/avatarPresets';
import { deleteDirectMessage, updateDirectMessage } from '../services/db';
import { ImageZoomModal } from './ImageZoomModal';
import { useChatPreferences, CHAT_THEMES, getChatFontSizeClasses } from '../services/chatPreferences';
import { VoiceChatBar } from './VoiceChatBar';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';

interface ChatsViewProps {
  lang: Language;
  identity: NostrIdentity;
  profiles: UserProfile[];
  friends: string[];
  blocked: string[];
  directMessages: DirectMessage[];
  activeChatPubkey: string | null;
  onSelectChat: (pubkey: string | null) => void;
  onToggleFriend: (pubkey: string) => void;
  onToggleBlock: (pubkey: string) => void;
  onMessageSent: (dm: DirectMessage) => void;
  onMessageDeleted?: (id: string) => void;
  onMessageUpdated?: (dm: DirectMessage) => void;
  onOpenChatSettings?: () => void;
}

export const ChatsView: React.FC<ChatsViewProps> = ({
  lang,
  identity,
  profiles,
  friends,
  blocked,
  directMessages,
  activeChatPubkey,
  onSelectChat,
  onToggleFriend,
  onToggleBlock,
  onMessageSent,
  onMessageDeleted,
  onMessageUpdated,
  onOpenChatSettings
}) => {
  const t = UI_TRANSLATIONS[lang];
  const [chatPrefs] = useChatPreferences();
  const currentTheme = CHAT_THEMES[chatPrefs.theme] || CHAT_THEMES.neon;
  const fontSizeInfo = getChatFontSizeClasses(chatPrefs.fontSize);

  // Chat conversation search
  const [chatSearchText, setChatSearchText] = useState('');
  // In-message search
  const [inMsgSearch, setInMsgSearch] = useState('');
  // Show/hide in-chat search and date rows (hidden by default)
  const [showChatSearch, setShowChatSearch] = useState(false);
  // Date Range state: From date - To date
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Left sidebar conversation date filter
  const [sidebarDateFilterOpen, setSidebarDateFilterOpen] = useState(false);
  const [sidebarDateFrom, setSidebarDateFrom] = useState('');
  const [sidebarDateTo, setSidebarDateTo] = useState('');
  // Message edit state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);
  // Zoom image lightbox state
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  // Message input state
  const [inputText, setInputText] = useState('');
  // Media attachment state
  const [mediaFileUrl, setMediaFileUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | undefined>();
  const [uploadError, setUploadError] = useState('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Emoji picker popup state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Media Gallery Modal
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const fileInputPhotoRef = useRef<HTMLInputElement>(null);
  const fileInputVideoRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Group direct messages by counterpart
  const conversations = useMemo(() => {
    const map = new Map<string, { lastMsg: DirectMessage; count: number }>();

    directMessages.forEach(dm => {
      const other = dm.chatWithPubkey || (dm.fromPubkey === identity.pubKeyHex ? dm.toPubkey : dm.fromPubkey);
      if (!other) return;
      if (blocked.includes(other)) return;

      const existing = map.get(other);
      if (!existing || dm.timestamp > existing.lastMsg.timestamp) {
        map.set(other, {
          lastMsg: dm,
          count: (existing?.count || 0) + 1
        });
      } else {
        existing.count += 1;
      }
    });

    // Also include any profile the user has opened
    if (activeChatPubkey && !map.has(activeChatPubkey)) {
      map.set(activeChatPubkey, {
        lastMsg: {
          id: 'placeholder',
          chatWithPubkey: activeChatPubkey,
          fromPubkey: '',
          toPubkey: activeChatPubkey,
          content: '',
          timestamp: Date.now(),
          isOutgoing: false
        },
        count: 0
      });
    }

    let result = Array.from(map.entries()).map(([pubkey, data]) => {
      const profile = profiles.find(p => p.pubkey === pubkey);
      return {
        pubkey,
        profile,
        lastMsg: data.lastMsg,
        count: data.count
      };
    }).sort((a, b) => b.lastMsg.timestamp - a.lastMsg.timestamp);

    // Sidebar text search filter
    if (chatSearchText.trim()) {
      const q = chatSearchText.toLowerCase();
      result = result.filter(c => 
        (c.profile?.name || '').toLowerCase().includes(q) ||
        c.pubkey.toLowerCase().includes(q) ||
        (c.lastMsg?.content || '').toLowerCase().includes(q)
      );
    }

    // Sidebar conversation date range filter
    if (sidebarDateFrom) {
      const fromTime = new Date(`${sidebarDateFrom}T00:00:00`).getTime();
      result = result.filter(c => c.lastMsg.timestamp >= fromTime);
    }
    if (sidebarDateTo) {
      const toTime = new Date(`${sidebarDateTo}T23:59:59.999`).getTime();
      result = result.filter(c => c.lastMsg.timestamp <= toTime);
    }

    return result;
  }, [directMessages, identity, blocked, profiles, activeChatPubkey, chatSearchText, sidebarDateFrom, sidebarDateTo]);

  // Active counterpart profile
  const activeProfile = useMemo(() => {
    if (!activeChatPubkey) return null;
    return profiles.find(p => p.pubkey === activeChatPubkey) || {
      pubkey: activeChatPubkey,
      name: `User_${activeChatPubkey.slice(-4)}`,
      age: 25,
      location: 'Nostr Network',
      updatedAt: Date.now()
    };
  }, [activeChatPubkey, profiles]);

  // Messages for active chat with text search & date range filter (От дата до дата)
  const activeMessages = useMemo(() => {
    if (!activeChatPubkey) return [];
    let msgs = directMessages.filter(
      dm => dm.chatWithPubkey === activeChatPubkey ||
            (dm.fromPubkey === activeChatPubkey && dm.toPubkey === identity.pubKeyHex) ||
            (dm.fromPubkey === identity.pubKeyHex && dm.toPubkey === activeChatPubkey)
    );

    // In-message search filter
    if (inMsgSearch.trim()) {
      const q = inMsgSearch.toLowerCase();
      msgs = msgs.filter(m => m.content.toLowerCase().includes(q));
    }

    // Date range filter: From date to date (от дата до дата)
    if (dateFrom) {
      const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
      msgs = msgs.filter(m => m.timestamp >= fromTime);
    }
    if (dateTo) {
      const toTime = new Date(`${dateTo}T23:59:59.999`).getTime();
      msgs = msgs.filter(m => m.timestamp <= toTime);
    }

    return msgs.sort((a, b) => a.timestamp - b.timestamp);
  }, [directMessages, activeChatPubkey, identity, inMsgSearch, dateFrom, dateTo]);

  // In-app Delete Confirmation state
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmBtnText: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Delete entire direct message (or room message)
  const handleDeleteMessage = (msgId: string) => {
    setDeleteConfirmState({
      isOpen: true,
      title: t.DELETE_MESSAGE,
      description: t.CONFIRM_DELETE_MSG,
      confirmBtnText: lang === 'bg' ? 'Изтрий съобщението' : 'Delete Message',
      onConfirm: async () => {
        try {
          await deleteDirectMessage(msgId);
        } catch (e) {
          console.warn('Error deleting message from DB:', e);
        }
        if (onMessageDeleted) {
          onMessageDeleted(msgId);
        }
        setDeleteConfirmState(null);
      }
    });
  };

  // Delete media (photo, video, or voice audio message) from message
  const handleDeleteMedia = (msg: DirectMessage) => {
    const isAudio = msg.mediaType === 'audio' || /\.(webm|ogg|mp3|wav|m4a|aac)$/i.test(msg.mediaUrl || '') || (msg.mediaUrl || '').startsWith('data:audio/');
    const isVideo = msg.mediaType === 'video';
    const mediaLabel = isAudio
      ? (lang === 'bg' ? 'гласовото съобщение' : 'voice note')
      : isVideo
        ? (lang === 'bg' ? 'видеото' : 'video')
        : (lang === 'bg' ? 'снимката' : 'photo');

    setDeleteConfirmState({
      isOpen: true,
      title: `${t.DELETE_MEDIA} (${mediaLabel})`,
      description: lang === 'bg'
        ? `Сигурни ли сте, че искате да изтриете ${mediaLabel} от това съобщение?`
        : `Are you sure you want to delete the ${mediaLabel} from this message?`,
      confirmBtnText: lang === 'bg' ? 'Изтрий медията' : 'Delete Media',
      onConfirm: async () => {
        if (!msg.content || !msg.content.trim() || msg.content === '🎙️ Гласово съобщение' || msg.content === '🎙️ Voice note') {
          // If message only had media and no other text, deleting media deletes whole message
          try {
            await deleteDirectMessage(msg.id);
          } catch (e) {
            console.warn('Error deleting message from DB:', e);
          }
          if (onMessageDeleted) {
            onMessageDeleted(msg.id);
          }
        } else {
          // Message has custom text: strip media but preserve text
          const updated: DirectMessage = {
            ...msg,
            mediaUrl: undefined,
            mediaType: undefined,
            duration: undefined
          };
          try {
            await updateDirectMessage(updated);
          } catch (e) {
            console.warn('Error updating message in DB:', e);
          }
          if (onMessageUpdated) {
            onMessageUpdated(updated);
          }
        }
        setDeleteConfirmState(null);
      }
    });
  };

  // Clear / Delete text from message
  const handleClearText = (msg: DirectMessage) => {
    setDeleteConfirmState({
      isOpen: true,
      title: t.CLEAR_TEXT,
      description: t.CONFIRM_CLEAR_TEXT,
      confirmBtnText: lang === 'bg' ? 'Изтрий текста' : 'Delete Text',
      onConfirm: async () => {
        if (!msg.mediaUrl) {
          // If no media attached, clearing text deletes the message entirely
          try {
            await deleteDirectMessage(msg.id);
          } catch (e) {
            console.warn('Error deleting message from DB:', e);
          }
          if (onMessageDeleted) {
            onMessageDeleted(msg.id);
          }
        } else {
          // Keep attached media, empty text content
          const updated: DirectMessage = {
            ...msg,
            content: ''
          };
          try {
            await updateDirectMessage(updated);
          } catch (e) {
            console.warn('Error updating message in DB:', e);
          }
          if (onMessageUpdated) {
            onMessageUpdated(updated);
          }
        }
        setDeleteConfirmState(null);
      }
    });
  };

  // Start editing message text
  const handleStartEdit = (msg: DirectMessage) => {
    setEditingMsgId(msg.id);
    setEditingText(msg.content || '');
  };

  // Save edited message text
  const handleSaveEdit = async (msg: DirectMessage) => {
    const trimmed = editingText.trim();
    if (!trimmed && !msg.mediaUrl) {
      // User emptied the text and there's no media -> delete message
      try {
        await deleteDirectMessage(msg.id);
      } catch (e) {
        console.warn('Error deleting message from DB:', e);
      }
      if (onMessageDeleted) {
        onMessageDeleted(msg.id);
      }
      setEditingMsgId(null);
      setEditingText('');
      return;
    }
    const updated: DirectMessage = {
      ...msg,
      content: trimmed
    };
    try {
      await updateDirectMessage(updated);
    } catch (e) {
      console.warn('Error updating edited DM in DB:', e);
    }
    if (onMessageUpdated) {
      onMessageUpdated(updated);
    }
    setEditingMsgId(null);
    setEditingText('');
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingMsgId(null);
    setEditingText('');
  };

  // Media items in active chat for the Gallery
  const chatMediaItems = useMemo(() => {
    if (!activeChatPubkey) return [];
    return directMessages
      .filter(dm => (dm.chatWithPubkey === activeChatPubkey || dm.fromPubkey === activeChatPubkey) && dm.mediaUrl)
      .map(dm => ({
        url: dm.mediaUrl!,
        type: (dm.mediaType || 'photo') as 'photo' | 'video',
        caption: dm.content,
        sender: dm.fromPubkey === identity.pubKeyHex ? 'You' : (activeProfile?.name || 'Them')
      }));
  }, [directMessages, activeChatPubkey, identity, activeProfile]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  // Handle Photo attachment and online upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setUploadError(t.MEDIA_TOO_LARGE);
      return;
    }

    setUploadError('');
    setIsUploadingMedia(true);
    try {
      const result = await uploadMediaFile(file);
      setMediaFileUrl(normalizeMediaUrl(result.url));
      setMediaType('photo');
    } catch (err) {
      console.error('Photo upload failed:', err);
      setUploadError(lang === 'bg' ? 'Грешка при качване на снимката' : 'Failed to upload photo');
    } finally {
      setIsUploadingMedia(false);
      // Reset input value so same file can be chosen again if needed
      if (fileInputPhotoRef.current) fileInputPhotoRef.current.value = '';
    }
  };

  // Handle Video attachment and online upload
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setUploadError(t.MEDIA_TOO_LARGE);
      return;
    }

    setUploadError('');
    setIsUploadingMedia(true);
    try {
      const result = await uploadMediaFile(file);
      setMediaFileUrl(normalizeMediaUrl(result.url));
      setMediaType('video');
    } catch (err) {
      console.error('Video upload failed:', err);
      setUploadError(lang === 'bg' ? 'Грешка при качване на видеото' : 'Failed to upload video');
    } finally {
      setIsUploadingMedia(false);
      if (fileInputVideoRef.current) fileInputVideoRef.current.value = '';
    }
  };

  // Send message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChatPubkey) return;
    if (!inputText.trim() && !mediaFileUrl) return;

    setIsSending(true);
    try {
      const dm = await publishDirectMessageEvent(
        identity,
        activeChatPubkey,
        inputText.trim(),
        mediaFileUrl || undefined,
        mediaType
      );
      onMessageSent(dm);
      setInputText('');
      if (textInputRef.current) {
        textInputRef.current.style.height = 'auto';
      }
      setMediaFileUrl(null);
      setMediaType(undefined);
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Failed sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Send persistent voice note handler
  const handleSendVoiceNote = async (audioBlob: Blob, durationSec: number) => {
    if (!activeChatPubkey) return;
    setIsSending(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const audioDataUrl = reader.result as string;
          const dm = await publishDirectMessageEvent(
            identity,
            activeChatPubkey,
            lang === 'bg' ? '🎙️ Гласово съобщение' : '🎙️ Voice message',
            audioDataUrl,
            'audio'
          );
          dm.duration = durationSec;
          onMessageSent(dm);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        } catch (e) {
          console.warn('Error publishing voice note:', e);
        } finally {
          setIsSending(false);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (err) {
      console.error('Failed sending voice note:', err);
      setIsSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] min-h-[500px] flex rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#262633] overflow-hidden shadow-xl">
      {/* Left Column: Conversations List */}
      <div
        className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-[#262633] bg-[var(--bg-main)]/50 ${
          activeChatPubkey ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Search bar with date range toggle */}
        <div className="p-3 border-b border-[#262633] bg-[var(--bg-surface)] space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={chatSearchText}
                onChange={(e) => setChatSearchText(e.target.value)}
                placeholder={t.LABEL_SEARCH_CHAT}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
              />
              <svg className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <button
              type="button"
              onClick={() => setSidebarDateFilterOpen(prev => !prev)}
              className={`p-1.5 rounded-[var(--radius-sm)] border text-xs cursor-pointer transition-colors ${
                sidebarDateFrom || sidebarDateTo || sidebarDateFilterOpen
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-[var(--bg-main)] border-[#333345] text-[var(--text-muted)] hover:text-white'
              }`}
              title={t.DATE_RANGE}
              aria-label={t.DATE_RANGE}
            >
              📅
            </button>
            {onOpenChatSettings && (
              <button
                type="button"
                id="btn-sidebar-chat-settings"
                onClick={onOpenChatSettings}
                className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] hover:bg-[#323244] border border-[#333345] text-white text-xs cursor-pointer transition-colors shrink-0"
                title={lang === 'bg' ? 'Настройки на чата (Цветове, звуци, шрифт)' : 'Chat Settings'}
                aria-label="Chat Settings"
              >
                ⚙️
              </button>
            )}
          </div>

          {/* Sidebar Date Range Filter (от дата до дата) */}
          {sidebarDateFilterOpen && (
            <div className="p-2 rounded bg-[var(--bg-main)] border border-[#333345] space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-semibold uppercase">
                <span>{t.DATE_RANGE}</span>
                {(sidebarDateFrom || sidebarDateTo) && (
                  <button
                    onClick={() => {
                      setSidebarDateFrom('');
                      setSidebarDateTo('');
                    }}
                    className="text-rose-400 hover:underline cursor-pointer"
                  >
                    {t.CLEAR_DATE_FILTER}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <span className="text-[9px] text-[var(--text-muted)] block">{t.DATE_FROM}</span>
                  <input
                    type="date"
                    value={sidebarDateFrom}
                    onChange={(e) => setSidebarDateFrom(e.target.value)}
                    className="w-full px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[#3A3A4E] text-[10px] text-white"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-[var(--text-muted)] block">{t.DATE_TO}</span>
                  <input
                    type="date"
                    value={sidebarDateTo}
                    onChange={(e) => setSidebarDateTo(e.target.value)}
                    className="w-full px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[#3A3A4E] text-[10px] text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#262633]/60">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              {lang === 'bg' ? 'Няма активни разговори. Избери профил от Запознанства!' : 'No chats yet. Choose a profile from Dating!'}
            </div>
          ) : (
            conversations.map(({ pubkey, profile, lastMsg, count }) => {
              const isSelected = activeChatPubkey === pubkey;
              const isFriend = friends.includes(pubkey);
              const avatar = getEffectiveAvatar(profile);
              const name = profile?.name || `Nostr User ${pubkey.slice(0, 6)}`;

              return (
                <div
                  key={pubkey}
                  onClick={() => onSelectChat(pubkey)}
                  className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--primary)]/15 border-l-2 border-[var(--primary)]'
                      : 'hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={avatar}
                      alt={name}
                      className="w-11 h-11 rounded-full object-cover border border-[#333345]"
                    />
                    {isFriend && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--primary)] text-white text-[9px] flex items-center justify-center font-bold">
                        ★
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white truncate">{name}</h4>
                      {lastMsg && lastMsg.timestamp > 0 && (
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                      {lastMsg?.mediaUrl ? `📷 ${lastMsg.mediaType || 'Media'}` : (lastMsg?.content || (lang === 'bg' ? 'Няма съобщения' : 'No messages'))}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Active Chat View */}
      {activeChatPubkey && activeProfile ? (
        <div className="flex-1 flex flex-col bg-[var(--bg-surface)] min-w-0 w-full overflow-hidden">
          {/* Active Chat Header */}
          <div className="p-2.5 sm:p-3 border-b border-[#262633] flex items-center justify-between bg-[var(--bg-main)]/80 gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                onClick={() => onSelectChat(null)}
                title={lang === 'bg' ? 'Назад към списъка с разговори' : 'Back to conversations list'}
                aria-label={lang === 'bg' ? 'Назад към списъка с разговори' : 'Back to conversations list'}
                className="md:hidden p-1.5 rounded text-[var(--text-muted)] hover:text-white cursor-pointer shrink-0"
              >
                ←
              </button>

              <img
                src={getEffectiveAvatar(activeProfile)}
                alt={activeProfile.name}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-[#333345] shrink-0"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.onerror = null;
                  target.src = getEffectiveAvatar(activeProfile);
                }}
              />

              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                  <span className="truncate">{activeProfile.name}</span>
                  {friends.includes(activeChatPubkey) && (
                    <span className="text-[10px] text-amber-400 shrink-0">★</span>
                  )}
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] truncate font-mono flex items-center gap-1.5">
                  <span>{activeProfile.location || 'Nostr Private Chat'}</span>
                  <span
                    className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold border border-purple-500/30 flex items-center gap-1 shrink-0"
                    title={lang === 'bg' ? 'NIP-17 Gift Wrap: Релетата не знаят кой изпраща съобщението' : 'NIP-17 Gift Wrap: Sender & Recipient metadata concealed from relays'}
                  >
                    <span>🎁</span>
                    <span>NIP-17</span>
                  </span>
                  <span
                    className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-500/30 flex items-center gap-1 shrink-0"
                    title={lang === 'bg' ? 'Voice over Nostr Relays: Анонимен глас през релета без IP адрес' : 'VoNR: Anonymous voice over relays without IP exchange'}
                  >
                    <span>🎙️</span>
                    <span>VoNR (0% IP)</span>
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Media Gallery Button */}
              {chatMediaItems.length > 0 && (
                <button
                  id="btn-open-chat-gallery"
                  onClick={() => setIsGalleryOpen(true)}
                  className="p-1.5 sm:px-2.5 sm:py-1 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] hover:bg-[#333345] border border-[#333345] text-white text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                  title={`${t.MEDIA_GALLERY} (${chatMediaItems.length})`}
                  aria-label={`${t.MEDIA_GALLERY} (${chatMediaItems.length})`}
                >
                  <span>📷</span>
                  <span className="hidden sm:inline">{t.MEDIA_GALLERY}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">({chatMediaItems.length})</span>
                </button>
              )}

              {/* Friend Toggle */}
              <button
                onClick={() => onToggleFriend(activeChatPubkey)}
                className={`p-1.5 rounded-[var(--radius-sm)] text-xs border cursor-pointer ${
                  friends.includes(activeChatPubkey)
                    ? 'bg-[var(--primary)]/20 border-[var(--primary)] text-[var(--primary-hover)]'
                    : 'bg-[var(--bg-surface)] border-[#333345] text-[var(--text-muted)] hover:text-white'
                }`}
                title={friends.includes(activeChatPubkey) ? `${t.BTN_REMOVE_FRIEND} (${activeProfile.name})` : `${t.BTN_ADD_FRIEND} (${activeProfile.name})`}
                aria-label={friends.includes(activeChatPubkey) ? t.BTN_REMOVE_FRIEND : t.BTN_ADD_FRIEND}
              >
                ★
              </button>

              {/* Block Toggle */}
              <button
                onClick={() => onToggleBlock(activeChatPubkey)}
                className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#333345] text-[var(--text-muted)] hover:text-[var(--status-danger)] text-xs cursor-pointer"
                title={`${t.BTN_BLOCK} (${activeProfile.name})`}
                aria-label={`${t.BTN_BLOCK} (${activeProfile.name})`}
              >
                🚫
              </button>

              {/* In-chat Search Toggle Button */}
              <button
                type="button"
                id="btn-toggle-chat-search"
                onClick={() => setShowChatSearch(prev => !prev)}
                className={`p-1.5 sm:px-2.5 sm:py-1 rounded-[var(--radius-sm)] border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                  showChatSearch || (inMsgSearch || dateFrom || dateTo)
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow'
                    : 'bg-[var(--bg-surface)] hover:bg-[#343448] border-[#3A3A4E] text-[var(--text-muted)] hover:text-white'
                }`}
                title={lang === 'bg' ? 'Търсене в съобщенията и по дати' : 'Search messages & date filter'}
                aria-label="Toggle in-chat search"
              >
                <span>🔍</span>
                <span className="hidden xl:inline">{lang === 'bg' ? 'Търсене' : 'Search'}</span>
                {(inMsgSearch || dateFrom || dateTo) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>

              {/* Direct Chat Settings Button */}
              {onOpenChatSettings && (
                <button
                  type="button"
                  id="btn-active-chat-settings"
                  onClick={onOpenChatSettings}
                  className="p-1.5 sm:px-2 sm:py-1 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] hover:bg-[#343448] border border-[#3A3A4E] text-white text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 shrink-0"
                  title={lang === 'bg' ? 'Настройки на чата (Цветове, звуци, шрифт)' : 'Chat Settings'}
                >
                  <span>💬⚙️</span>
                  <span className="hidden xl:inline">{lang === 'bg' ? 'Настройки' : 'Settings'}</span>
                </button>
              )}
            </div>
          </div>

          {/* In-chat Search and Date range filter bar (скрити по подразбиране, видими при клик на Търсене) */}
          {showChatSearch && (
            <div className="px-3 py-2 border-b border-[#262633]/60 bg-[var(--bg-main)]/60 flex flex-wrap items-center justify-between gap-2 text-xs animate-in slide-in-from-top-2">
              {/* Text Search */}
              <div className="flex items-center gap-1.5 flex-1 min-w-[140px] max-w-xs">
                <input
                  type="text"
                  value={inMsgSearch}
                  onChange={(e) => setInMsgSearch(e.target.value)}
                  placeholder={lang === 'bg' ? 'Търси текст в съобщенията...' : 'Search in messages...'}
                  className="w-full px-2.5 py-1 rounded bg-[var(--bg-surface)] border border-[#333345] text-[11px] text-white focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Date range inputs: От дата - До дата */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase">{t.DATE_FROM}:</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[#333345] text-[11px] text-white focus:outline-none font-mono"
                    title={t.DATE_FROM}
                    aria-label={t.DATE_FROM}
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase">{t.DATE_TO}:</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[#333345] text-[11px] text-white focus:outline-none font-mono"
                    title={t.DATE_TO}
                    aria-label={t.DATE_TO}
                  />
                </div>

                {/* Quick Preset Buttons */}
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setDateFrom(today);
                    setDateTo(today);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-[#222230] hover:bg-[#323244] text-[var(--text-muted)] hover:text-white border border-[#333345] transition-colors cursor-pointer"
                  title={t.FILTER_TODAY}
                >
                  {t.FILTER_TODAY}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const to = new Date();
                    const from = new Date();
                    from.setDate(to.getDate() - 7);
                    setDateFrom(from.toISOString().split('T')[0]);
                    setDateTo(to.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-[#222230] hover:bg-[#323244] text-[var(--text-muted)] hover:text-white border border-[#333345] transition-colors cursor-pointer"
                  title={lang === 'bg' ? 'Последна седмица' : 'Last 7 days'}
                >
                  {lang === 'bg' ? 'Седмица' : '7 Days'}
                </button>

                {(inMsgSearch || dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setInMsgSearch('');
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                    title={t.CLEAR_DATE_FILTER}
                    aria-label={t.CLEAR_DATE_FILTER}
                  >
                    ✕ {t.CLEAR_DATE_FILTER}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Messages Feed */}
          <div className={`flex-1 p-4 overflow-y-auto space-y-4 ${currentTheme.chatBgClass}`}>
            {activeMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[var(--text-muted)] p-6">
                <span className="text-3xl mb-2">🔒</span>
                <p className="font-semibold text-white mb-1">
                  {dateFrom || dateTo || inMsgSearch
                    ? (lang === 'bg' ? 'Няма намерени съобщения в зададения период или филтър' : 'No messages found matching current filters')
                    : t.NO_MESSAGES}
                </p>
                <p className="max-w-xs">{t.ENCRYPTED_NOTE}</p>
              </div>
            ) : (
              activeMessages.map((msg) => {
                const isMine = msg.fromPubkey === identity.pubKeyHex;
                const isEditing = editingMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`group relative flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    {/* Click-to-reveal Action Bar: Displays message timestamp/date and Edit & Delete buttons */}
                    {activeActionMsgId === msg.id && !isEditing && (
                      <div
                        className={`flex items-center gap-1.5 mb-1.5 p-1 px-2 rounded-[var(--radius-sm)] bg-[#181826]/95 border border-[#3E3E56] shadow-xl backdrop-blur-md animate-in zoom-in-95 z-20 ${
                          isMine ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        {/* Message Date and Time Display */}
                        <div className="flex items-center gap-1.5 text-[10px] text-white/90 font-mono px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
                          <span>🕒</span>
                          <span>
                            {new Date(msg.timestamp).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}{' '}
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* 1. Редакция (Edit) - само за моите текстови съобщения */}
                        {isMine && msg.content && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(msg);
                              setActiveActionMsgId(null);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-[11px] font-bold cursor-pointer transition-all shadow active:scale-95"
                            title={t.EDIT_MESSAGE}
                            aria-label={t.EDIT_MESSAGE}
                          >
                            <span>✏️</span>
                            <span>{lang === 'bg' ? 'Редакция' : 'Edit'}</span>
                          </button>
                        )}

                        {/* 2. Изтриване на медията (снимка, видео или аудио) */}
                        {isMine && msg.mediaUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMedia(msg);
                              setActiveActionMsgId(null);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold cursor-pointer transition-all shadow active:scale-95"
                            title={t.DELETE_MEDIA}
                            aria-label={t.DELETE_MEDIA}
                          >
                            <span>
                              {msg.mediaType === 'audio' || /\.(webm|ogg|mp3|wav|m4a|aac)$/i.test(msg.mediaUrl) || msg.mediaUrl.startsWith('data:audio/')
                                ? '🎙️'
                                : msg.mediaType === 'video'
                                  ? '🎬'
                                  : '🖼️'}
                            </span>
                            <span>
                              {msg.mediaType === 'audio' || /\.(webm|ogg|mp3|wav|m4a|aac)$/i.test(msg.mediaUrl) || msg.mediaUrl.startsWith('data:audio/')
                                ? (lang === 'bg' ? 'Изтрий гласа' : 'Delete Voice')
                                : msg.mediaType === 'video'
                                  ? (lang === 'bg' ? 'Изтрий видео' : 'Delete Video')
                                  : (lang === 'bg' ? 'Изтрий снимка' : 'Delete Photo')}
                            </span>
                          </button>
                        )}

                        {/* 3. Изтриване (Delete) - само за моите съобщения */}
                        {isMine && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMessage(msg.id);
                              setActiveActionMsgId(null);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer transition-all shadow active:scale-95"
                            title={t.DELETE_MESSAGE}
                            aria-label={t.DELETE_MESSAGE}
                          >
                            <span>🗑️</span>
                            <span>{lang === 'bg' ? 'Изтриване' : 'Delete'}</span>
                          </button>
                        )}

                        {/* Close actions */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionMsgId(null);
                          }}
                          className="w-5 h-5 rounded hover:bg-white/10 text-white/70 hover:text-white text-xs flex items-center justify-center cursor-pointer transition-colors"
                          title={t.CLOSE}
                          aria-label={t.CLOSE}
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Message Bubble - Click to reveal date & options */}
                    <div
                      onClick={() => {
                        if (!isEditing) {
                          setActiveActionMsgId(prev => prev === msg.id ? null : msg.id);
                        }
                      }}
                      title={!isEditing ? (lang === 'bg' ? 'Кликни за показване на дата и опции' : 'Click for date & actions') : undefined}
                      className={`relative max-w-[85%] sm:max-w-[75%] rounded-[var(--radius-md)] p-3 shadow-md space-y-2 transition-all cursor-pointer ${
                        isMine
                          ? `${currentTheme.sentBubbleClass} rounded-br-none ${activeActionMsgId === msg.id ? 'ring-2 ring-white/60 shadow-lg scale-[1.01]' : 'hover:brightness-105'}`
                          : `${currentTheme.receivedBubbleClass} rounded-bl-none ${activeActionMsgId === msg.id ? 'ring-2 ring-white/60 shadow-lg scale-[1.01]' : 'hover:brightness-105'}`
                      }`}
                    >
                      {/* Attached Media (Audio Voice Message, Video, or Photo) */}
                      {msg.mediaUrl && (
                        <div className="relative group/media rounded overflow-hidden">
                          {/* Direct quick delete media button for my messages on the media container */}
                          {isMine && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMedia(msg);
                              }}
                              className="absolute top-1.5 right-1.5 z-20 px-2 py-0.5 rounded-[var(--radius-sm)] bg-black/80 hover:bg-rose-600 text-white text-[10px] font-bold shadow-lg border border-white/20 transition-all cursor-pointer flex items-center gap-1 backdrop-blur-md opacity-85 hover:opacity-100"
                              title={
                                msg.mediaType === 'audio' || /\.(webm|ogg|mp3|wav|m4a|aac)$/i.test(msg.mediaUrl) || msg.mediaUrl.startsWith('data:audio/')
                                  ? (lang === 'bg' ? 'Изтрий това гласово съобщение' : 'Delete this voice note')
                                  : msg.mediaType === 'video'
                                    ? (lang === 'bg' ? 'Изтрий това видео' : 'Delete this video')
                                    : (lang === 'bg' ? 'Изтрий тази снимка' : 'Delete this photo')
                              }
                            >
                              <span>🗑️</span>
                              <span className="hidden sm:inline">{lang === 'bg' ? 'Изтрий медия' : 'Delete media'}</span>
                            </button>
                          )}
                          {msg.mediaType === 'audio' || /\.(webm|ogg|mp3|wav|m4a|aac)$/i.test(msg.mediaUrl) || msg.mediaUrl.startsWith('data:audio/') ? (
                            <VoiceMessagePlayer
                              src={msg.mediaUrl}
                              duration={msg.duration}
                              isMine={isMine}
                            />
                          ) : msg.mediaType === 'video' ? (
                            <div className="relative bg-black/60 border border-white/10 rounded">
                              <video
                                src={normalizeMediaUrl(msg.mediaUrl)}
                                controls
                                className="max-h-64 rounded w-full bg-black"
                              />
                            </div>
                          ) : (
                            <div
                              className="relative cursor-pointer group/photo bg-black/60 border border-white/10 rounded overflow-hidden"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomImageUrl(normalizeMediaUrl(msg.mediaUrl!));
                              }}
                              title={lang === 'bg' ? 'Кликни за преглед в оригинален размер' : 'Click to view full original size'}
                            >
                              <img
                                src={normalizeMediaUrl(msg.mediaUrl)}
                                alt="Attached media"
                                className="max-h-64 rounded object-cover w-full group-hover/photo:scale-101 transition-transform"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.onerror = null;
                                  target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
                                }}
                              />
                              {/* Zoom Overlay Badge */}
                              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-[var(--radius-full)] bg-black/75 backdrop-blur-md text-[10px] text-white flex items-center gap-1.5 border border-white/20 shadow-lg">
                                <svg className="w-3.5 h-3.5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="11" cy="11" r="8" />
                                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                  <line x1="11" y1="8" x2="11" y2="14" />
                                  <line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                                <span className="font-medium">{lang === 'bg' ? 'Оригинален размер' : 'Original Size'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Text content OR Inline Edit Box */}
                      {isEditing ? (
                        <div className="space-y-2 pt-1 min-w-[220px]">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full p-2 text-xs rounded bg-[#13131D] text-white border border-white/30 focus:border-white focus:outline-none resize-none shadow-inner"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="w-7 h-7 rounded bg-black/50 hover:bg-black/80 text-white/90 hover:text-white transition-colors cursor-pointer flex items-center justify-center border border-white/20 shadow"
                              title={t.CANCEL_ACTION}
                              aria-label={t.CANCEL_ACTION}
                            >
                              <span className="text-sm font-bold">✕</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(msg)}
                              className="w-7 h-7 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer flex items-center justify-center shadow font-bold text-sm"
                              title={t.SAVE_MESSAGE}
                              aria-label={t.SAVE_MESSAGE}
                            >
                              <span>✓</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        msg.content && (
                          <p
                            className={`${fontSizeInfo.messageText} break-words break-all whitespace-pre-wrap`}
                            style={fontSizeInfo.fontSizeStyle}
                          >
                            {msg.content}
                          </p>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Uploading progress indicator */}
          {isUploadingMedia && (
            <div className="px-4 py-2 bg-[var(--primary)]/20 border-t border-[var(--primary)]/40 text-xs text-white flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>{t.UPLOADING_ONLINE}</span>
            </div>
          )}

          {/* Attachment Preview if selected */}
          {mediaFileUrl && (
            <div className="p-3 bg-[var(--bg-main)] border-t border-[#262633] flex items-center justify-between">
              <div className="flex items-center gap-3">
                {mediaType === 'video' ? (
                  <video src={mediaFileUrl} className="w-14 h-14 object-cover rounded border border-[#3A3A4E]" />
                ) : (
                  <img src={mediaFileUrl} alt="Preview" className="w-14 h-14 object-cover rounded border border-[#3A3A4E]" />
                )}
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-white font-medium flex-wrap">
                    <span>{mediaType === 'video' ? 'Прикачено видео' : 'Прикачена снимка'}</span>
                    <span className="px-1.5 py-0.5 rounded-[var(--radius-full)] bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30 flex items-center gap-1">
                      <span>✓</span>
                      <span>{t.ONLINE_STORED}</span>
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded-[var(--radius-full)] bg-purple-500/20 text-purple-300 text-[9px] font-bold border border-purple-500/30 flex items-center gap-1"
                      title={lang === 'bg' ? 'Локално са премахнати всички EXIF метаданни и GPS координати чрез Canvas' : 'EXIF & GPS metadata locally stripped'}
                    >
                      <span>🛡️</span>
                      <span>{lang === 'bg' ? 'EXIF изчистен (Без GPS)' : 'EXIF Stripped'}</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono truncate max-w-xs block">
                    {mediaFileUrl}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMediaFileUrl(null);
                  setMediaType(undefined);
                }}
                className="text-xs text-[var(--status-danger)] hover:underline flex items-center gap-1"
              >
                ✕ {t.REMOVE_MEDIA}
              </button>
            </div>
          )}

          {uploadError && (
            <div className="p-2 bg-[var(--status-danger)]/20 text-xs text-white text-center border-t border-[var(--status-danger)]/40">
              {uploadError}
            </div>
          )}

          {/* Message Composer Input Form & Voice over Nostr Bar */}
          <div className="relative p-3 bg-[var(--bg-main)] border-t border-[#262633] space-y-2">
            {/* Anonymous Voice over Nostr Relays Bar (Push-to-Talk, Spacebar, Touch, live filling up progress bar) */}
            <VoiceChatBar
              lang={lang}
              identity={identity}
              recipientPubkey={activeChatPubkey}
              recipientName={activeProfile.name}
              onSendVoiceNote={handleSendVoiceNote}
            />

            {/* Emoji Picker Dropdown Popup */}
            {showEmojiPicker && (
              <div className="absolute bottom-full left-3 mb-2 z-50">
                <EmojiPicker
                  lang={lang}
                  onSelectEmoji={(emoji) => {
                    setInputText(prev => prev + emoji);
                    textInputRef.current?.focus();
                  }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-end gap-1 sm:gap-2 w-full min-w-0">
              {/* Attach Photo button */}
              <button
                type="button"
                id="btn-attach-photo"
                onClick={() => fileInputPhotoRef.current?.click()}
                title={t.ATTACH_PHOTO}
                aria-label={t.ATTACH_PHOTO}
                className="p-1.5 sm:p-2 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </button>

              {/* Attach Video button */}
              <button
                type="button"
                id="btn-attach-video"
                onClick={() => fileInputVideoRef.current?.click()}
                title={t.ATTACH_VIDEO}
                aria-label={t.ATTACH_VIDEO}
                className="p-1.5 sm:p-2 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m22 8-6 4 6 4V8Z" />
                  <rect width="14" height="12" x="2" y="6" rx="2" />
                </svg>
              </button>

              {/* Emojis Button */}
              <button
                type="button"
                id="btn-toggle-chat-emojis"
                onClick={() => setShowEmojiPicker(prev => !prev)}
                title={t.EMOJIS}
                aria-label={t.EMOJIS}
                className={`p-1.5 sm:p-2 rounded-[var(--radius-sm)] transition-colors text-sm sm:text-base flex items-center justify-center cursor-pointer shrink-0 ${
                  showEmojiPicker
                    ? 'bg-[var(--primary)]/20 text-white'
                    : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                😊
              </button>

              {/* Hidden file inputs for local uploads */}
              <input
                type="file"
                ref={fileInputPhotoRef}
                onChange={handlePhotoUpload}
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="hidden"
              />
              <input
                type="file"
                ref={fileInputVideoRef}
                onChange={handleVideoUpload}
                accept="video/mp4,video/webm"
                className="hidden"
              />

              {/* Auto-expanding Textarea for Message */}
              <textarea
                ref={textInputRef}
                id="input-direct-message"
                rows={1}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={t.TYPE_MESSAGE}
                style={fontSizeInfo.fontSizeStyle}
                className={`flex-1 min-w-0 px-3 py-2 ${fontSizeInfo.inputText} rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)] transition-all resize-none max-h-32 overflow-y-auto leading-snug`}
              />

              {/* Send Button */}
              <button
                type="submit"
                id="btn-send-dm"
                title={t.SEND_MESSAGE}
                aria-label={t.SEND_MESSAGE}
                disabled={isSending || isUploadingMedia || (!inputText.trim() && !mediaFileUrl)}
                className="px-2.5 sm:px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-40 transition-colors shadow flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <span className="hidden sm:inline">{t.SEND_MESSAGE}</span>
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>

          {/* Media Gallery Modal */}
          <MediaGalleryModal
            lang={lang}
            isOpen={isGalleryOpen}
            onClose={() => setIsGalleryOpen(false)}
            mediaItems={chatMediaItems}
            title={`${t.MEDIA_GALLERY} - ${activeProfile.name}`}
          />

          {/* Image Zoom Modal for Chat Photos (100% Original full resolution) */}
          <ImageZoomModal
            isOpen={!!zoomImageUrl}
            onClose={() => setZoomImageUrl(null)}
            src={zoomImageUrl || ''}
            title={`${lang === 'bg' ? 'Снимка от чата' : 'Chat Photo'} - ${activeProfile.name}`}
            lang={lang}
          />
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-main)]/30">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] border border-[#2B2B38] flex items-center justify-center text-[var(--primary-hover)] mb-4 shadow-lg">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white mb-1">
            {lang === 'bg' ? 'Избери разговор отляво' : 'Select a conversation from the left'}
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-xs">
            {t.ENCRYPTED_NOTE}
          </p>
        </div>
      )}

      {/* Custom In-App Delete Confirmation Modal */}
      {deleteConfirmState?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-rose-500/40 p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white mb-1">
                  {deleteConfirmState.title}
                </h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {deleteConfirmState.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B2B38]">
              <button
                type="button"
                onClick={() => setDeleteConfirmState(null)}
                className="px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-[#252533] hover:bg-[#303042] text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                {t.CANCEL_ACTION}
              </button>
              <button
                type="button"
                onClick={() => deleteConfirmState.onConfirm()}
                className="px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-colors shadow cursor-pointer flex items-center gap-1"
              >
                <span>🗑️</span>
                <span>{deleteConfirmState.confirmBtnText}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
