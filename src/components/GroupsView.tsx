import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UI_TRANSLATIONS, Language, ChatChannel, ChannelMessage, NostrIdentity, UserProfile, RoomJoinRequest } from '../types';
import { publishChannelMessageEvent, publishCreateChannel, publishUpdateChannel } from '../services/nostr';
import { EmojiPicker } from './EmojiPicker';
import { uploadMediaFile, normalizeMediaUrl } from '../services/mediaUpload';
import { getEffectiveAvatar } from '../services/avatarPresets';
import { useChatPreferences, CHAT_THEMES, getChatFontSizeClasses } from '../services/chatPreferences';

interface GroupsViewProps {
  lang: Language;
  identity: NostrIdentity;
  userName: string;
  channels: ChatChannel[];
  channelMessages: ChannelMessage[];
  activeChannelId: string | null;
  profiles?: UserProfile[];
  friends?: string[];
  onSelectChannel: (id: string | null) => void;
  onNewChannelCreated: (ch: ChatChannel) => void;
  onChannelUpdated?: (ch: ChatChannel) => void;
  onChannelMessageSent: (msg: ChannelMessage) => void;
  onStartChat?: (pubkey: string) => void;
  onToggleFriend?: (pubkey: string) => void;
  onOpenChatSettings?: () => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  lang,
  identity,
  userName,
  channels,
  channelMessages,
  activeChannelId,
  profiles,
  friends,
  onSelectChannel,
  onNewChannelCreated,
  onChannelUpdated,
  onChannelMessageSent,
  onStartChat,
  onToggleFriend,
  onOpenChatSettings
}) => {
  const t = UI_TRANSLATIONS[lang];
  const [chatPrefs] = useChatPreferences();
  const currentTheme = CHAT_THEMES[chatPrefs.theme] || CHAT_THEMES.neon;
  const fontSizeInfo = getChatFontSizeClasses(chatPrefs.fontSize);

  // Room participants list & modal
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');

  // Room search
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  // New room modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomAbout, setNewRoomAbout] = useState('');
  const [newRoomPicture, setNewRoomPicture] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit room modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRoomName, setEditRoomName] = useState('');
  const [editRoomAbout, setEditRoomAbout] = useState('');
  const [editRoomPicture, setEditRoomPicture] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingEditPhoto, setIsUploadingEditPhoto] = useState(false);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  // In-room message composer
  const [msgInput, setMsgInput] = useState('');
  const [mediaFileUrl, setMediaFileUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | undefined>();
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Filter channels by search with robust deduplication by ID
  const filteredChannels = useMemo(() => {
    const channelMap = new Map<string, ChatChannel>();
    for (const c of channels) {
      if (c && c.id && !channelMap.has(c.id)) {
        channelMap.set(c.id, c);
      }
    }
    const uniqueChannels = Array.from(channelMap.values());
    if (!roomSearchQuery.trim()) return uniqueChannels;
    const q = roomSearchQuery.toLowerCase();
    return uniqueChannels.filter(
      c => c.name.toLowerCase().includes(q) || (c.about || '').toLowerCase().includes(q)
    );
  }, [channels, roomSearchQuery]);

  // Active channel
  const activeChannel = useMemo(() => {
    return channels.find(c => c.id === activeChannelId) || null;
  }, [channels, activeChannelId]);

  // Join Requests Modal State
  const [showJoinRequestsModal, setShowJoinRequestsModal] = useState(false);

  // Manage Members Modal State
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Invite Subscribers Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [selectedInvitePubkeys, setSelectedInvitePubkeys] = useState<string[]>([]);

  // Creator of the channel
  const isCreator = useMemo(() => {
    if (!activeChannel) return false;
    return Boolean(
      (activeChannel.creatorPubkey && activeChannel.creatorPubkey === identity.pubKeyHex) ||
      (!activeChannel.creatorPubkey)
    );
  }, [activeChannel, identity.pubKeyHex]);

  // Admin rights
  const isChannelAdmin = isCreator;

  // Member of the channel
  const isMember = useMemo(() => {
    if (!activeChannel) return false;
    if (isCreator) return true;
    if (activeChannel.members && activeChannel.members.includes(identity.pubKeyHex)) return true;
    if (!activeChannel.creatorPubkey && (!activeChannel.members || activeChannel.members.length === 0)) return true;
    return false;
  }, [activeChannel, isCreator, identity.pubKeyHex]);

  // Has current user requested to join?
  const hasRequestedToJoin = useMemo(() => {
    if (!activeChannel || !activeChannel.pendingRequests) return false;
    return activeChannel.pendingRequests.some(r => r.pubkey === identity.pubKeyHex);
  }, [activeChannel, identity.pubKeyHex]);

  // Removed participants state per room (persisted locally)
  const [removedParticipantsByRoom, setRemovedParticipantsByRoom] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem('nostr_removed_room_participants');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [participantToast, setParticipantToast] = useState<string | null>(null);

  // Messages in active channel (filtering out messages from removed participants)
  const activeMessages = useMemo(() => {
    if (!activeChannelId) return [];
    const removed = removedParticipantsByRoom[activeChannelId] || [];
    return channelMessages.filter(
      m => m.channelId === activeChannelId && !removed.includes(m.fromPubkey)
    );
  }, [channelMessages, activeChannelId, removedParticipantsByRoom]);

  // Dynamic Room Participants List
  const roomParticipants = useMemo(() => {
    if (!activeChannel) return [];
    const removedInThisRoom = removedParticipantsByRoom[activeChannel.id] || [];

    const map = new Map<string, {
      pubkey: string;
      name: string;
      avatarUrl: string;
      age?: number;
      location?: string;
      isMe: boolean;
      isFriend: boolean;
      lastActive?: number;
    }>();

    // 1. Current user
    const myProf = profiles?.find(p => p.pubkey === identity.pubKeyHex);
    map.set(identity.pubKeyHex, {
      pubkey: identity.pubKeyHex,
      name: myProf?.name || userName || 'Ти (You)',
      avatarUrl: getEffectiveAvatar(myProf),
      age: myProf?.age,
      location: myProf?.location,
      isMe: true,
      isFriend: false,
      lastActive: Date.now()
    });

    // 2. Active senders in this room
    activeMessages.forEach((msg) => {
      const pProf = profiles?.find(p => p.pubkey === msg.fromPubkey);
      const isFriend = Boolean(friends?.includes(msg.fromPubkey));
      const existing = map.get(msg.fromPubkey);

      if (!existing) {
        map.set(msg.fromPubkey, {
          pubkey: msg.fromPubkey,
          name: pProf?.name || msg.authorName || `Anon_${msg.fromPubkey.slice(0, 6)}`,
          avatarUrl: getEffectiveAvatar(pProf),
          age: pProf?.age,
          location: pProf?.location,
          isMe: msg.fromPubkey === identity.pubKeyHex,
          isFriend,
          lastActive: msg.timestamp
        });
      } else if (msg.timestamp > (existing.lastActive || 0)) {
        existing.lastActive = msg.timestamp;
      }
    });

    // 3. Known network profiles
    if (profiles) {
      profiles.forEach((p) => {
        if (!map.has(p.pubkey)) {
          map.set(p.pubkey, {
            pubkey: p.pubkey,
            name: p.name,
            avatarUrl: getEffectiveAvatar(p),
            age: p.age,
            location: p.location,
            isMe: p.pubkey === identity.pubKeyHex,
            isFriend: Boolean(friends?.includes(p.pubkey)),
            lastActive: p.updatedAt
          });
        }
      });
    }

    return Array.from(map.values()).filter(p => !removedInThisRoom.includes(p.pubkey));
  }, [activeChannel, activeMessages, identity.pubKeyHex, userName, profiles, friends, removedParticipantsByRoom]);

  const filteredParticipants = useMemo(() => {
    if (!participantSearch.trim()) return roomParticipants;
    const q = participantSearch.toLowerCase();
    return roomParticipants.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.location && p.location.toLowerCase().includes(q))
    );
  }, [roomParticipants, participantSearch]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  // Remove participant from room
  const handleRemoveParticipantFromRoom = (pubkey: string, name: string) => {
    if (!activeChannel) return;

    setRemovedParticipantsByRoom(prev => {
      const current = prev[activeChannel.id] || [];
      if (current.includes(pubkey)) return prev;
      const updated = {
        ...prev,
        [activeChannel.id]: [...current, pubkey]
      };
      try {
        localStorage.setItem('nostr_removed_room_participants', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (activeChannel.members?.includes(pubkey)) {
      const updatedMembers = activeChannel.members.filter(p => p !== pubkey);
      const updatedChannel = {
        ...activeChannel,
        members: updatedMembers,
        participantCount: Math.max(1, (activeChannel.participantCount || 2) - 1)
      };
      onChannelUpdated?.(updatedChannel);
    }

    setParticipantToast(`🚫 ${name}: ${t.PARTICIPANT_REMOVED}`);
    setTimeout(() => {
      setParticipantToast(null);
    }, 3500);
  };

  // 1. Send join request
  const handleSendJoinRequest = () => {
    if (!activeChannel) return;
    const myProf = profiles?.find(p => p.pubkey === identity.pubKeyHex);
    const newReq: RoomJoinRequest = {
      pubkey: identity.pubKeyHex,
      name: myProf?.name || userName || 'Anon',
      avatarUrl: getEffectiveAvatar(myProf),
      timestamp: Date.now()
    };
    const currentRequests = activeChannel.pendingRequests || [];
    if (currentRequests.some(r => r.pubkey === identity.pubKeyHex)) return;
    const updatedChannel: ChatChannel = {
      ...activeChannel,
      pendingRequests: [...currentRequests, newReq]
    };
    onChannelUpdated?.(updatedChannel);
    setParticipantToast(t.REQUEST_SENT);
    setTimeout(() => setParticipantToast(null), 3500);
  };

  // 2. Cancel / withdraw join request
  const handleCancelJoinRequest = () => {
    if (!activeChannel) return;
    const updatedChannel: ChatChannel = {
      ...activeChannel,
      pendingRequests: (activeChannel.pendingRequests || []).filter(r => r.pubkey !== identity.pubKeyHex)
    };
    onChannelUpdated?.(updatedChannel);
    setParticipantToast(lang === 'bg' ? 'Заявката беше оттеглена' : 'Request withdrawn');
    setTimeout(() => setParticipantToast(null), 3000);
  };

  // 3. Approve join request
  const handleApproveRequest = (req: RoomJoinRequest) => {
    if (!activeChannel) return;
    const currentMembers = activeChannel.members || [];
    const updatedMembers = currentMembers.includes(req.pubkey) ? currentMembers : [...currentMembers, req.pubkey];
    const updatedRequests = (activeChannel.pendingRequests || []).filter(r => r.pubkey !== req.pubkey);
    const updatedChannel: ChatChannel = {
      ...activeChannel,
      members: updatedMembers,
      pendingRequests: updatedRequests,
      participantCount: (activeChannel.participantCount || 1) + 1
    };
    onChannelUpdated?.(updatedChannel);
    setParticipantToast(`✓ ${req.name}: ${t.APPROVED_TOAST}`);
    setTimeout(() => setParticipantToast(null), 3500);
  };

  // 4. Decline join request
  const handleDeclineRequest = (pubkey: string, name: string) => {
    if (!activeChannel) return;
    const updatedRequests = (activeChannel.pendingRequests || []).filter(r => r.pubkey !== pubkey);
    const updatedChannel: ChatChannel = {
      ...activeChannel,
      pendingRequests: updatedRequests
    };
    onChannelUpdated?.(updatedChannel);
    setParticipantToast(`✕ ${name}: ${t.DECLINED_TOAST}`);
    setTimeout(() => setParticipantToast(null), 3500);
  };

  // 5. Directly remove member
  const handleRemoveMember = (pubkey: string, name: string) => {
    if (!activeChannel) return;
    const updatedMembers = (activeChannel.members || []).filter(p => p !== pubkey);
    const updatedChannel: ChatChannel = {
      ...activeChannel,
      members: updatedMembers,
      participantCount: Math.max(1, (activeChannel.participantCount || 2) - 1)
    };
    onChannelUpdated?.(updatedChannel);
    setParticipantToast(`🚫 ${name}: ${t.PARTICIPANT_REMOVED}`);
    setTimeout(() => setParticipantToast(null), 3500);
  };

  // 6. Directly add member
  const handleDirectAddMember = (pubkey: string, name: string) => {
    if (!activeChannel) return;
    const currentMembers = activeChannel.members || [];
    if (currentMembers.includes(pubkey)) return;
    const updatedChannel: ChatChannel = {
      ...activeChannel,
      members: [...currentMembers, pubkey],
      participantCount: (activeChannel.participantCount || 1) + 1
    };
    onChannelUpdated?.(updatedChannel);
    setParticipantToast(`✓ ${name}: ${t.APPROVED_TOAST}`);
    setTimeout(() => setParticipantToast(null), 3500);
  };

  // 7. Send invitations to one or more subscribers
  const handleSendInvitations = () => {
    if (!activeChannel || selectedInvitePubkeys.length === 0) return;
    const currentMembers = activeChannel.members || [];
    const newMembers = [...currentMembers];
    selectedInvitePubkeys.forEach(pk => {
      if (!newMembers.includes(pk)) {
        newMembers.push(pk);
      }
    });
    const updatedChannel: ChatChannel = {
      ...activeChannel,
      members: newMembers,
      invitedPubkeys: [...(activeChannel.invitedPubkeys || []), ...selectedInvitePubkeys],
      participantCount: Math.max(activeChannel.participantCount || 1, newMembers.length)
    };
    onChannelUpdated?.(updatedChannel);
    setParticipantToast(`📨 ${t.INVITATION_SENT} (${selectedInvitePubkeys.length})`);
    setSelectedInvitePubkeys([]);
    setShowInviteModal(false);
    setTimeout(() => setParticipantToast(null), 3500);
  };

  const handleOpenEditModal = () => {
    if (!activeChannel) return;
    setEditRoomName(activeChannel.name);
    setEditRoomAbout(activeChannel.about || '');
    setEditRoomPicture(activeChannel.picture || '');
    setShowEditModal(true);
  };

  const handleSaveEditChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannel || !editRoomName.trim()) return;

    setIsEditing(true);
    try {
      const updated = await publishUpdateChannel(
        identity,
        activeChannel.id,
        editRoomName.trim(),
        editRoomAbout.trim(),
        editRoomPicture.trim() || undefined
      );
      if (onChannelUpdated) {
        onChannelUpdated(updated);
      }
      setShowEditModal(false);
    } catch (err) {
      console.error('Error updating channel:', err);
    } finally {
      setIsEditing(false);
    }
  };

  // Create Channel Handler
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    setIsCreating(true);
    try {
      const channel = await publishCreateChannel(
        identity,
        newRoomName.trim(),
        newRoomAbout.trim(),
        newRoomPicture.trim() || undefined
      );
      onNewChannelCreated(channel);
      onSelectChannel(channel.id);
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomAbout('');
      setNewRoomPicture('');
    } catch (err) {
      console.error('Error creating channel:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // Send Message in Channel Handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannelId) return;
    if (!msgInput.trim() && !mediaFileUrl) return;

    setIsSending(true);
    try {
      const msg = await publishChannelMessageEvent(
        identity,
        userName || 'Nostr Anon',
        activeChannelId,
        msgInput.trim(),
        mediaFileUrl || undefined,
        mediaType
      );
      onChannelMessageSent(msg);
      setMsgInput('');
      if (textInputRef.current) {
        textInputRef.current.style.height = 'auto';
      }
      setMediaFileUrl(null);
      setMediaType(undefined);
    } catch (err) {
      console.error('Error publishing channel message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] min-h-[500px] flex rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#262633] overflow-hidden shadow-xl">
      {/* Channels List (Left) */}
      <div
        className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-[#262633] bg-[var(--bg-main)]/50 ${
          activeChannelId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Search & Create Channel Button */}
        <div className="p-3 border-b border-[#262633] bg-[var(--bg-surface)] space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              {t.MODAL_GROUPS_TITLE}
            </h3>
            <button
              id="btn-open-create-room"
              onClick={() => setShowCreateModal(true)}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-[11px] font-bold flex items-center gap-1 transition-colors shadow"
            >
              <span>+</span>
              <span>{t.NEW_ROOM}</span>
            </button>
          </div>

          <div className="relative">
            <input
              id="search-rooms-input"
              type="text"
              value={roomSearchQuery}
              onChange={(e) => setRoomSearchQuery(e.target.value)}
              placeholder={t.LABEL_SEARCH_ROOMS}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
            />
            <svg className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {/* Channel Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#20202C]">
          {filteredChannels.map((channel) => {
            const isSelected = activeChannelId === channel.id;
            const picture = channel.picture || 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=100';

            return (
              <div
                key={channel.id}
                id={`room-item-${channel.id}`}
                onClick={() => onSelectChannel(channel.id)}
                className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-[var(--bg-surface-hover)] border-l-2 border-[var(--secondary)]' : 'hover:bg-[#1E1E28]'
                }`}
              >
                <img
                  src={picture}
                  alt={channel.name}
                  className="w-11 h-11 rounded-[var(--radius-sm)] object-cover border border-[#3A3A4E] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-white truncate">
                      {channel.name}
                    </h4>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Join Requests badge for creator */}
                      {((channel.creatorPubkey && channel.creatorPubkey === identity.pubKeyHex) || !channel.creatorPubkey) && (channel.pendingRequests?.length || 0) > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-bold animate-pulse" title={t.JOIN_REQUESTS}>
                          🔔 {channel.pendingRequests?.length}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        👥 {channel.participantCount || 1}
                      </span>
                    </div>
                  </div>
                  {/* Status badges */}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {((channel.creatorPubkey && channel.creatorPubkey === identity.pubKeyHex) || !channel.creatorPubkey) ? (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">
                        👑 {t.CREATOR_BADGE}
                      </span>
                    ) : channel.members?.includes(identity.pubKeyHex) ? (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                        ✓ {t.JOINED_STATUS}
                      </span>
                    ) : channel.pendingRequests?.some(r => r.pubkey === identity.pubKeyHex) ? (
                      <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold border border-sky-500/30">
                        ⏳ {t.MEMBERSHIP_PENDING}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-[#2A2A3A] text-[var(--text-muted)] text-[9px] font-medium border border-[#3A3A4A]">
                        🔒 Достъп с искане
                      </span>
                    )}
                  </div>
                  {channel.about && (
                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-1 leading-tight">
                      {channel.about}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Channel Chat Area (Right) */}
      {activeChannel ? (
        <div className="flex-1 flex flex-col bg-[var(--bg-surface)] min-w-0 w-full overflow-hidden">
          {/* Header */}
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[#262633] flex items-center justify-between bg-[var(--bg-main)]/70 gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                onClick={() => onSelectChannel(null)}
                className="md:hidden p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-white shrink-0 cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              <img
                src={activeChannel.picture || 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=100'}
                alt={activeChannel.name}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-[var(--radius-sm)] object-cover border border-[#3A3A4E] shrink-0"
              />

              <div className="min-w-0 flex-1">
                <h3 className="text-xs md:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                  <span className="truncate">{activeChannel.name}</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-[#2D2D3E] text-[var(--text-muted)] font-mono shrink-0">
                    NIP-28
                  </span>
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] truncate max-w-[140px] sm:max-w-sm">
                  {activeChannel.about || t.MODAL_GROUPS_TITLE}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-nowrap">
              {/* Creator: Join Requests Button */}
              {isCreator && (activeChannel.pendingRequests?.length || 0) > 0 && (
                <button
                  type="button"
                  id="btn-room-join-requests"
                  onClick={() => setShowJoinRequestsModal(true)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-[var(--radius-sm)] bg-amber-500 hover:bg-amber-400 text-black shadow transition-all cursor-pointer animate-pulse shrink-0"
                  title={t.JOIN_REQUESTS}
                >
                  <span>🔔</span>
                  <span className="hidden sm:inline">{t.JOIN_REQUESTS}: </span>
                  <span>{activeChannel.pendingRequests?.length}</span>
                </button>
              )}

              {/* Creator: Invite Subscribers Button */}
              {isCreator && (
                <button
                  type="button"
                  id="btn-invite-members"
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-[var(--radius-sm)] bg-[#20202E] hover:bg-[#2B2B3D] text-white border border-[#3A3A4E] hover:border-[var(--primary)] transition-colors cursor-pointer shadow-sm shrink-0"
                  title={t.INVITE_MEMBERS}
                >
                  <span>📨</span>
                  <span className="hidden sm:inline">{t.INVITE_MEMBERS}</span>
                </button>
              )}

              {/* Creator: Manage Members List */}
              {isCreator && (
                <button
                  type="button"
                  id="btn-manage-members"
                  onClick={() => setShowManageMembersModal(true)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-[var(--radius-sm)] bg-[#20202E] hover:bg-[#2B2B3D] text-white border border-[#3A3A4E] hover:border-[var(--primary)] transition-colors cursor-pointer shadow-sm shrink-0"
                  title={t.MANAGE_MEMBERS}
                >
                  <span>⚙️</span>
                  <span className="hidden sm:inline">{t.MANAGE_MEMBERS}</span>
                </button>
              )}

              {/* Edit Room */}
              {isChannelAdmin && (
                <button
                  id="btn-edit-room"
                  type="button"
                  onClick={handleOpenEditModal}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-[var(--radius-sm)] bg-[#2A2A3B] hover:bg-[#343448] text-white border border-[#3E3E52] transition-colors cursor-pointer shrink-0"
                  title={t.EDIT_ROOM}
                >
                  <svg className="w-3.5 h-3.5 text-[var(--secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span className="hidden sm:inline">{t.EDIT_ROOM}</span>
                </button>
              )}

              {/* Room Participants */}
              <button
                id="btn-room-participants"
                type="button"
                onClick={() => setShowParticipantsModal(true)}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-[var(--radius-sm)] bg-[#20202E] hover:bg-[#2B2B3D] text-white border border-[#3A3A4E] hover:border-[var(--primary)] transition-colors cursor-pointer shadow-sm shrink-0"
                title={t.PARTICIPANTS_LIST}
              >
                <span>👥</span>
                <span className="font-mono text-[10px] sm:text-[11px]">{roomParticipants.length}</span>
              </button>

              {/* Direct Chat Settings Button */}
              {onOpenChatSettings && (
                <button
                  type="button"
                  id="btn-room-chat-settings"
                  onClick={onOpenChatSettings}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-[var(--radius-sm)] bg-[#20202E] hover:bg-[#2B2B3D] text-white border border-[#3A3A4E] hover:border-[var(--primary)] transition-colors cursor-pointer shadow-sm shrink-0"
                  title={lang === 'bg' ? 'Настройки на чата (Цветове, звуци, шрифт)' : 'Chat Settings'}
                >
                  <span>💬⚙️</span>
                  <span className="hidden xl:inline">{lang === 'bg' ? 'Настройки' : 'Settings'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Pending Join Requests Banner for Creator */}
          {isCreator && (activeChannel.pendingRequests?.length || 0) > 0 && (
            <div className="mx-4 mt-3 p-3 rounded-[var(--radius-sm)] bg-amber-500/15 border border-amber-500/40 flex items-center justify-between text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <span className="text-base animate-bounce">🔔</span>
                <span className="font-semibold">
                  {lang === 'bg'
                    ? `Имате ${activeChannel.pendingRequests?.length} чакащи сигнал-искания за присъединяване!`
                    : `You have ${activeChannel.pendingRequests?.length} pending join requests!`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinRequestsModal(true)}
                className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] transition-colors cursor-pointer shadow"
              >
                {lang === 'bg' ? 'Прегледай' : 'Review'}
              </button>
            </div>
          )}

          {/* Messages Feed */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${currentTheme.chatBgClass}`}>
            {activeMessages.length === 0 ? (
              <div className="py-16 text-center text-xs text-[var(--text-muted)]">
                {t.NO_MESSAGES}
              </div>
            ) : (
              activeMessages.map((msg) => {
                const isMe = msg.fromPubkey === identity.pubKeyHex;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] text-[var(--text-muted)] font-mono mb-0.5 px-1">
                      {isMe ? 'Ти (You)' : msg.authorName}
                    </span>
                    <div
                      className={`max-w-[85%] sm:max-w-md rounded-[var(--radius-md)] p-3 shadow-md ${
                        isMe
                          ? `${currentTheme.sentBubbleClass} rounded-br-none`
                          : `${currentTheme.receivedBubbleClass} rounded-bl-none`
                      }`}
                    >
                      {/* Media Display */}
                      {msg.mediaUrl && (
                        <div className="mb-2 rounded-[var(--radius-sm)] overflow-hidden bg-black/30 border border-white/10">
                          {msg.mediaType === 'video' ? (
                            <video src={msg.mediaUrl} controls className="max-h-60 w-full object-cover" />
                          ) : (
                            <img src={msg.mediaUrl} alt="Shared" className="max-h-60 w-full object-cover" />
                          )}
                        </div>
                      )}

                      <p
                        className={`${fontSizeInfo.messageText} whitespace-pre-wrap break-words break-all`}
                        style={fontSizeInfo.fontSizeStyle}
                      >
                        {msg.content}
                      </p>

                      <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-white/60">
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Uploading indicator */}
          {isUploadingMedia && (
            <div className="px-4 py-2 bg-[var(--primary)]/20 border-t border-[var(--primary)]/40 text-xs text-white flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>{t.UPLOADING_ONLINE}</span>
            </div>
          )}

          {/* Attachment Preview */}
          {mediaFileUrl && (
            <div className="p-3 bg-[var(--bg-main)] border-t border-[#262633] flex items-center justify-between">
              <div className="flex items-center gap-3">
                {mediaType === 'video' ? (
                  <video src={mediaFileUrl} className="w-14 h-14 object-cover rounded border border-[#3A3A4E]" />
                ) : (
                  <img src={mediaFileUrl} alt="Preview" className="w-14 h-14 object-cover rounded border border-[#3A3A4E]" />
                )}
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-white font-medium">
                    <span>{mediaType === 'video' ? 'Прикачено видео' : 'Прикачена снимка'}</span>
                    <span className="px-1.5 py-0.5 rounded-[var(--radius-full)] bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                      ✓ {t.ONLINE_STORED}
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

          {/* Channel Input Form OR Request to Join Card */}
          {!isMember ? (
            <div className="p-5 bg-[var(--bg-main)] border-t border-[#262633] flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg border border-amber-500/30">
                🔒
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="text-xs font-bold text-white">
                  {lang === 'bg' ? 'Тази стая изисква одобрение от създателя' : 'This room requires creator approval to join'}
                </h4>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {hasRequestedToJoin
                    ? (lang === 'bg'
                        ? 'Вашето сигнал-искане е изпратено на създателя на стаята и очаква одобрение.'
                        : 'Your join request was sent to the room creator and is awaiting review.')
                    : (lang === 'bg'
                        ? 'Изпратете сигнал-искане до създателя, за да бъдете добавени и да общувате в тази стая.'
                        : 'Send a request to the room creator to be added and participate in this chat.')}
                </p>
              </div>
              {hasRequestedToJoin ? (
                <button
                  type="button"
                  onClick={handleCancelJoinRequest}
                  className="px-4 py-2 rounded-[var(--radius-sm)] bg-[#2B2B3A] hover:bg-rose-900/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors cursor-pointer"
                >
                  ✕ {lang === 'bg' ? 'Оттегли сигнал-искането' : 'Withdraw request'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSendJoinRequest}
                  className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-2"
                >
                  <span>📤</span>
                  <span>{t.REQUEST_TO_JOIN}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="relative p-3 bg-[var(--bg-main)] border-t border-[#262633]">
              {showEmojiPicker && (
                <div className="absolute bottom-full left-3 mb-2 z-50">
                  <EmojiPicker
                    lang={lang}
                    onSelectEmoji={(emoji) => {
                      setMsgInput(prev => prev + emoji);
                      textInputRef.current?.focus();
                    }}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-end gap-1 sm:gap-2 w-full min-w-0">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  title={t.ATTACH_PHOTO}
                  className="p-1.5 sm:p-2 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer shrink-0"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  title={t.ATTACH_VIDEO}
                  className="p-1.5 sm:p-2 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer shrink-0"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m22 8-6 4 6 4V8Z" />
                    <rect width="14" height="12" x="2" y="6" rx="2" />
                  </svg>
                </button>

                {/* Emoji Picker toggle button */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(prev => !prev)}
                  title={t.EMOJIS}
                  className={`p-1.5 sm:p-2 rounded-[var(--radius-sm)] transition-colors text-sm sm:text-base flex items-center justify-center cursor-pointer shrink-0 ${
                    showEmojiPicker
                      ? 'bg-[var(--primary)]/20 text-white'
                      : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  😊
                </button>

                {/* Hidden file inputs with online upload */}
                <input
                  type="file"
                  ref={photoInputRef}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 20 * 1024 * 1024) {
                      alert(t.MEDIA_TOO_LARGE);
                      return;
                    }
                    setIsUploadingMedia(true);
                    try {
                      const res = await uploadMediaFile(file);
                      setMediaFileUrl(normalizeMediaUrl(res.url));
                      setMediaType('photo');
                    } catch (err) {
                      console.error('Photo upload error:', err);
                    } finally {
                      setIsUploadingMedia(false);
                      if (photoInputRef.current) photoInputRef.current.value = '';
                    }
                  }}
                  accept="image/*"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 25 * 1024 * 1024) {
                      alert(t.MEDIA_TOO_LARGE);
                      return;
                    }
                    setIsUploadingMedia(true);
                    try {
                      const res = await uploadMediaFile(file);
                      setMediaFileUrl(normalizeMediaUrl(res.url));
                      setMediaType('video');
                    } catch (err) {
                      console.error('Video upload error:', err);
                    } finally {
                      setIsUploadingMedia(false);
                      if (videoInputRef.current) videoInputRef.current.value = '';
                    }
                  }}
                  accept="video/*"
                  className="hidden"
                />

                {/* Auto-expanding Textarea for Channel Message */}
                <textarea
                  ref={textInputRef}
                  id="input-channel-msg"
                  rows={1}
                  value={msgInput}
                  onChange={(e) => {
                    setMsgInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder={lang === 'bg' ? 'Напиши съобщение в стаята...' : 'Type a message in the room...'}
                  style={fontSizeInfo.fontSizeStyle}
                  className={`flex-1 min-w-0 px-3 py-2 ${fontSizeInfo.inputText} rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)] transition-all resize-none max-h-32 overflow-y-auto leading-snug`}
                />

                <button
                  type="submit"
                  id="btn-send-channel-msg"
                  title={t.SEND_MESSAGE}
                  disabled={isSending || isUploadingMedia || (!msgInput.trim() && !mediaFileUrl)}
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
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-main)]/30">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] border border-[#2B2B38] flex items-center justify-center text-[var(--secondary)] mb-4 shadow-lg">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white mb-1">
            {lang === 'bg' ? 'Избери или създай стая по интереси' : 'Select or create an interest room'}
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-xs">
            {t.MODAL_GROUPS_TITLE} • NIP-28 Decentralized Channels
          </p>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333345] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">
                {t.NEW_ROOM} (NIP-28)
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  {t.ROOM_NAME} *
                </label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="напр. София Свободен Чат"
                  className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  {t.ROOM_ABOUT}
                </label>
                <textarea
                  rows={2}
                  value={newRoomAbout}
                  onChange={(e) => setNewRoomAbout(e.target.value)}
                  placeholder="Тема, правила или описание на групата..."
                  className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Снимка на стаята (URL)
                </label>
                <input
                  type="url"
                  value={newRoomPicture}
                  onChange={(e) => setNewRoomPicture(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-hover)] text-xs text-white"
                >
                  {t.CLOSE}
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newRoomName.trim()}
                  className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold disabled:opacity-40"
                >
                  {t.CREATE_ROOM_BTN}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Room Modal (Admin Only) */}
      {showEditModal && activeChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333345] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {t.EDIT_ROOM_TITLE}
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--secondary)]/20 text-[var(--secondary)] font-bold">
                  {t.ADMIN_BADGE}
                </span>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  {t.ROOM_NAME} *
                </label>
                <input
                  type="text"
                  required
                  value={editRoomName}
                  onChange={(e) => setEditRoomName(e.target.value)}
                  placeholder="Име на стаята..."
                  className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  {t.ROOM_ABOUT}
                </label>
                <textarea
                  rows={2}
                  value={editRoomAbout}
                  onChange={(e) => setEditRoomAbout(e.target.value)}
                  placeholder="Тема, правила или описание на групата..."
                  className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-white">
                    {t.ROOM_PICTURE} (URL или качване)
                  </label>
                  <button
                    type="button"
                    onClick={() => editPhotoInputRef.current?.click()}
                    disabled={isUploadingEditPhoto}
                    className="text-[11px] text-[var(--secondary)] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>{isUploadingEditPhoto ? t.UPLOADING_ONLINE : 'Качи файл'}</span>
                  </button>
                </div>

                <input
                  type="file"
                  ref={editPhotoInputRef}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploadingEditPhoto(true);
                    try {
                      const res = await uploadMediaFile(file);
                      setEditRoomPicture(normalizeMediaUrl(res.url));
                    } catch (err) {
                      console.error('Error uploading room picture:', err);
                    } finally {
                      setIsUploadingEditPhoto(false);
                      if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
                    }
                  }}
                  accept="image/*"
                  className="hidden"
                />

                <input
                  type="url"
                  value={editRoomPicture}
                  onChange={(e) => setEditRoomPicture(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
                />

                {editRoomPicture && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={editRoomPicture}
                      alt="Room Preview"
                      className="w-12 h-12 rounded-[var(--radius-sm)] object-cover border border-[#3A3A4E]"
                    />
                    <span className="text-[11px] text-green-400 font-mono">
                      ✓ {t.ONLINE_STORED}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-hover)] text-xs text-white"
                >
                  {t.CLOSE}
                </button>
                <button
                  type="submit"
                  disabled={isEditing || isUploadingEditPhoto || !editRoomName.trim()}
                  className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold disabled:opacity-40"
                >
                  {isEditing ? 'Запазване...' : t.SAVE_ROOM_BTN}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Participants Modal */}
      {showParticipantsModal && activeChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333345] p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3D]">
              <div className="flex items-center gap-2">
                <span className="text-lg">👥</span>
                <h3 className="text-sm font-bold text-white">
                  {t.ROOM_PARTICIPANTS_TITLE} ({filteredParticipants.length})
                </h3>
              </div>
              <button
                onClick={() => setShowParticipantsModal(false)}
                className="text-[var(--text-muted)] hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-3">
              {participantToast && (
                <div className="mb-2.5 p-2 rounded-[var(--radius-sm)] bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center justify-between">
                  <span>{participantToast}</span>
                  <button
                    type="button"
                    onClick={() => setParticipantToast(null)}
                    className="text-rose-300 hover:text-white ml-2 text-xs cursor-pointer"
                    title="Затвори известието"
                  >
                    ✕
                  </button>
                </div>
              )}
              <input
                type="text"
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder={t.SEARCH_PARTICIPANTS}
                className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredParticipants.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                  Няма намерени участници
                </div>
              ) : (
                filteredParticipants.map((p) => (
                  <div
                    key={p.pubkey}
                    className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2D2D3D] hover:border-[#3D3D52] flex items-center justify-between transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={p.avatarUrl}
                          alt={p.name}
                          className="w-10 h-10 rounded-full object-cover border border-[#3D3D52]"
                        />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--status-online)] border-2 border-[var(--bg-main)]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-white truncate">
                            {p.name}
                          </h4>
                          {p.isMe && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--primary)]/20 text-[var(--primary-hover)] font-bold">
                              {t.YOU}
                            </span>
                          )}
                          {!p.isMe && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                              {t.IN_ROOM}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-2 mt-0.5">
                          {p.age && <span>{p.age} г.</span>}
                          {p.location && <span>• {p.location}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!p.isMe && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setShowParticipantsModal(false);
                              onStartChat?.(p.pubkey);
                            }}
                            className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            title={t.START_CHAT}
                          >
                            <span>💬</span>
                            <span>{t.START_CHAT}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onToggleFriend?.(p.pubkey)}
                            className={`px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                              p.isFriend
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                                : 'bg-[var(--bg-surface-hover)] text-white/90 border-[#3D3D52] hover:bg-[#343448]'
                            }`}
                            title={p.isFriend ? t.REMOVE_FRIEND : t.ADD_FRIEND}
                          >
                            <span>{p.isFriend ? '★' : '+'}</span>
                            <span>{p.isFriend ? t.FRIEND : t.ADD_FRIEND}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveParticipantFromRoom(p.pubkey, p.name)}
                            className="px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold border bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                            title={`${t.REMOVE_FROM_ROOM} (${p.name})`}
                            aria-label={`${t.REMOVE_FROM_ROOM}: ${p.name}`}
                          >
                            <span>🚫</span>
                            <span>{t.REMOVE_FROM_ROOM}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 mt-2 border-t border-[#2C2C3D] flex justify-end">
              <button
                type="button"
                onClick={() => setShowParticipantsModal(false)}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-hover)] hover:bg-[#323242] text-xs font-semibold text-white cursor-pointer"
              >
                {t.CLOSE}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── 1. Join Requests Modal (Approve / Decline) ──────────────── */}
      {showJoinRequestsModal && activeChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-amber-500/40 p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3D]">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔔</span>
                <h3 className="text-sm font-bold text-white">
                  {t.JOIN_REQUESTS} ({activeChannel.pendingRequests?.length || 0})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinRequestsModal(false)}
                className="text-[var(--text-muted)] hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
              {(!activeChannel.pendingRequests || activeChannel.pendingRequests.length === 0) ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                  {t.NO_JOIN_REQUESTS}
                </div>
              ) : (
                activeChannel.pendingRequests.map((req) => (
                  <div
                    key={req.pubkey}
                    className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2D2D3D] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={req.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={req.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#3D3D52] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate">{req.name}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">
                          {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproveRequest(req)}
                        className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow"
                      >
                        <span>✓</span>
                        <span>{t.APPROVE}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeclineRequest(req.pubkey, req.name)}
                        className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[#252535] hover:bg-rose-900/40 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>✕</span>
                        <span>{t.DECLINE}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[#2C2C3D] flex justify-end">
              <button
                type="button"
                onClick={() => setShowJoinRequestsModal(false)}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-hover)] text-xs text-white cursor-pointer"
              >
                {t.CLOSE}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── 2. Manage Members Modal (Add / Remove) ──────────────── */}
      {showManageMembersModal && activeChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333345] p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3D]">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚙️</span>
                <h3 className="text-sm font-bold text-white">
                  {t.MANAGE_MEMBERS} ({activeChannel.members?.length || 1})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManageMembersModal(false)}
                className="text-[var(--text-muted)] hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Direct Add Member Input */}
            <div className="py-3 border-b border-[#2A2A3A] space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                {t.ADD_MEMBER_DIRECTLY}
              </span>
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                placeholder="Търси абонат по име за директно добавяне..."
                className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
              />
              {memberSearchQuery.trim() && (
                <div className="max-h-36 overflow-y-auto space-y-1 bg-[var(--bg-main)] p-2 rounded border border-[#2D2D40]">
                  {profiles
                    ?.filter(p => p.name.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                    .map(p => {
                      const alreadyIn = activeChannel.members?.includes(p.pubkey) || p.pubkey === identity.pubKeyHex;
                      return (
                        <div key={p.pubkey} className="flex items-center justify-between p-1.5 hover:bg-[#252538] rounded text-xs">
                          <span className="text-white font-medium truncate">{p.name}</span>
                          {alreadyIn ? (
                            <span className="text-[10px] text-emerald-400 font-bold">✓ {t.ALREADY_MEMBER}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                handleDirectAddMember(p.pubkey, p.name);
                                setMemberSearchQuery('');
                              }}
                              className="px-2 py-0.5 rounded bg-[var(--primary)] text-white text-[10px] font-bold cursor-pointer"
                            >
                              + Добави
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Current Members List */}
            <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                {t.MEMBERS_COUNT}:
              </span>
              {/* Creator row */}
              <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-amber-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-500/50">
                    <img src={getEffectiveAvatar(profiles?.find(prof => prof.pubkey === identity.pubKeyHex))} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-white">
                      {userName || 'Ти (You)'}
                    </div>
                    <span className="text-[9px] text-amber-300 font-bold">👑 {t.CREATOR_BADGE}</span>
                  </div>
                </div>
              </div>

              {/* Added members */}
              {activeChannel.members?.filter(pk => pk !== identity.pubKeyHex).map(pk => {
                const p = profiles?.find(prof => prof.pubkey === pk);
                const name = p?.name || `Абонат_${pk.slice(0, 6)}`;
                return (
                  <div key={pk} className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#2D2D3D] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-[#3E3E52]">
                        <img src={getEffectiveAvatar(p)} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="font-bold text-xs text-white truncate">{name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(pk, name)}
                      className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      ✕ {lang === 'bg' ? 'Премахни' : 'Remove'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#2C2C3D] flex justify-end">
              <button
                type="button"
                onClick={() => setShowManageMembersModal(false)}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-hover)] text-xs text-white cursor-pointer"
              >
                {t.CLOSE}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── 3. Invite Subscribers Modal ──────────────── */}
      {showInviteModal && activeChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[#333348] p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C3D]">
              <div className="flex items-center gap-2">
                <span className="text-lg">📨</span>
                <h3 className="text-sm font-bold text-white">
                  {t.INVITE_MEMBERS}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-[var(--text-muted)] hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-2.5 space-y-2">
              <input
                type="text"
                value={inviteSearchQuery}
                onChange={(e) => setInviteSearchQuery(e.target.value)}
                placeholder="Търси абонати по име или град..."
                className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-sm)] bg-[var(--bg-main)] border border-[#333345] text-white focus:outline-none focus:border-[var(--primary)]"
              />
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>{lang === 'bg' ? 'Изберете абонати за изпращане на покана' : 'Select subscribers to invite'}:</span>
                <button
                  type="button"
                  onClick={() => {
                    const available = (profiles || [])
                      .filter(p => p.pubkey !== identity.pubKeyHex)
                      .map(p => p.pubkey);
                    setSelectedInvitePubkeys(available);
                  }}
                  className="text-[var(--primary-hover)] hover:underline font-bold"
                >
                  {lang === 'bg' ? 'Избери всички' : 'Select All'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 py-1">
              {profiles
                ?.filter(p => p.pubkey !== identity.pubKeyHex)
                .filter(p => !inviteSearchQuery.trim() || p.name.toLowerCase().includes(inviteSearchQuery.toLowerCase()))
                .map((p) => {
                  const isChecked = selectedInvitePubkeys.includes(p.pubkey);
                  const isAlreadyMember = activeChannel.members?.includes(p.pubkey);

                  return (
                    <label
                      key={p.pubkey}
                      className={`p-2.5 rounded-[var(--radius-sm)] border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-[var(--primary)]/15 border-[var(--primary)]/50'
                          : 'bg-[var(--bg-main)] border-[#2E2E42] hover:border-[#3D3D55]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedInvitePubkeys(prev => [...prev, p.pubkey]);
                            } else {
                              setSelectedInvitePubkeys(prev => prev.filter(k => k !== p.pubkey));
                            }
                          }}
                          className="w-4 h-4 rounded text-[var(--primary)] bg-[#2B2B38] border-gray-600 focus:ring-0 cursor-pointer"
                        />
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-[#3D3D52] shrink-0">
                          <img src={getEffectiveAvatar(p)} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-white truncate">{p.name}</div>
                          {p.location && (
                            <div className="text-[10px] text-[var(--text-muted)] truncate">{p.location}</div>
                          )}
                        </div>
                      </div>

                      {isAlreadyMember && (
                        <span className="text-[10px] text-emerald-400 font-bold shrink-0">
                          ✓ {t.ALREADY_MEMBER}
                        </span>
                      )}
                    </label>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-[#2C2C3D] flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-mono">
                {lang === 'bg' ? 'Избрани' : 'Selected'}: {selectedInvitePubkeys.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-[#252535] text-xs text-white cursor-pointer"
                >
                  {t.CANCEL_ACTION}
                </button>
                <button
                  type="button"
                  disabled={selectedInvitePubkeys.length === 0}
                  onClick={handleSendInvitations}
                  className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all shadow disabled:opacity-40 cursor-pointer"
                >
                  <span>{t.INVITE_BTN}</span>
                  {selectedInvitePubkeys.length > 0 && <span> ({selectedInvitePubkeys.length})</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
