/**
 * FS_Chat - Decentralized & Encrypted Chat Types & Configurations
 */

export type Language = 'bg' | 'en';

export const UI_TRANSLATIONS = {
  bg: {
    APP_TITLE: "Намери Секс",
    SECURITY_WARNING_TITLE: "КРИТИЧНО ПРЕДУПРЕЖДЕНИЕ ЗА СИГУРНОСТ",
    SECURITY_WARNING_TEXT: "Твоят частен ключ е твоята единствена самоличност. НЕ ГО СПОДЕЛЯЙ С НИКОГО! Запиши го на лист хартия или външна флашка. Загубен ключ = загубен профил завинаги!",
    BTN_QUICK_START: "Бърз старт (Нов профил)",
    BTN_LOGIN_KEY: "Вход с ключ (nsec)",
    BTN_LOAD_KEY_FILE: "Зареди ключ от файл",
    BTN_RESTORE_BACKUP: "Възстанови от архив (.json)",
    TAB_DATING: "Запознанства",
    TAB_CHATS: "Разговори",
    TAB_GROUPS: "Стаи / Групи",
    TAB_SETTINGS: "Профил",
    FILTER_LOCATION: "Град / Локация",
    FILTER_GENDER: "Търся (Пол)",
    FILTER_AGE: "Възраст",
    MODAL_INTERESTS_TITLE: "Интереси и наклонности",
    MODAL_GROUPS_TITLE: "Групи по интереси",
    BTN_START_CHAT: "Започни чат",
    BTN_ADD_FRIEND: "Добави в приятели",
    BTN_REMOVE_FRIEND: "Премахни от приятели",
    BTN_BLOCK: "Блокирай",
    BTN_HIDE: "Скрий профил",
    SYNC_STATUS_OK: "✓ Всичко е синхронизирано (100%)",
    SYNC_STATUS_PROGRESS: "Синхронизиране...",
    LABEL_SEARCH_CHAT: "Търсене на дума...",
    LABEL_SEARCH_ROOMS: "Търсене на стая/група...",
    ABOUT_NOSTR_TITLE: "Как работи тази система?",
    ABOUT_NOSTR_TEXT: "Това приложение е децентрализирано. Няма главен сървър и шеф. Комуникацията се предава през криптирани NOSTR релета, поддържани от доброволци.",
    DONATION_TITLE: "Подкрепи мрежата",
    DONATION_TEXT: "Приложението съществува благодарение на NOSTR общността. Можеш да подкрепиш доброволците с Биткойн / Lightning.",
    
    // Допълнителни системни текстове за пълен и качествен UI
    ALL: "Всички",
    SAVE_PROFILE: "Запази промените",
    PROFILE_SAVED: "Профилът е запазен локално и публикуван в NOSTR!",
    REQUIRED_FIELD: "Задължително поле",
    EXPORT_BACKUP: "Експорт на пълен архив (backup.json)",
    IMPORT_BACKUP: "Импорт на архив (backup.json)",
    KEYS_MANAGEMENT: "Управление на криптографски ключове",
    PUBLIC_KEY: "Публичен ключ (npub)",
    PRIVATE_KEY: "Частен ключ (nsec)",
    COPY_KEY: "Копирай",
    COPIED: "Копирано!",
    DOWNLOAD_KEY: "Свали ключа като файл",
    RELAY_STATUS: "NOSTR Релета",
    ACTIVE_RELAYS: "Активни връзки към доброволчески сървъри",
    ADD_RELAY: "Добави реле",
    SEND_MESSAGE: "Изпрати",
    TYPE_MESSAGE: "Напиши тайно съобщение (NIP-04 E2EE)...",
    ATTACH_PHOTO: "Снимка",
    ATTACH_VIDEO: "Видео (до 20MB)",
    MEDIA_GALLERY: "Медия галерия",
    JUMP_TO_DATE: "Скок по дата",
    NO_MESSAGES: "Няма съобщения все още. Напиши първото съобщение!",
    ENCRYPTED_NOTE: "Криптирано от край до край с твоя и неговия Nostr ключ.",
    ONLINE_NOW: "На линия",
    NEW_ROOM: "Нова стая / група",
    ROOM_NAME: "Име на стаята",
    ROOM_ABOUT: "Описание",
    CREATE_ROOM_BTN: "Създай стая (NIP-28)",
    PARTICIPANTS: "Участници",
    LEAVE_ROOM: "Затвори стаята",
    BACK: "Назад",
    INSTALL_PWA: "Инсталирай приложението",
    INSTALL_APP: "Инсталирай приложението",
    INSTALL_IOS_GUIDE: "Инсталиране на iPhone/iPad",
    IOS_INSTALL_INSTRUCTION: "За инсталация: Натиснете бутона 'Сподели' (Share) в браузъра и изберете 'Добавяне към началния екран' (Add to Home Screen)",
    IOS_STEP_1: "1. Натисни бутона за споделяне (Share) в Safari.",
    IOS_STEP_2: "2. Избери 'Add to Home Screen' (Добави към началния екран).",
    CLOSE: "Затвори",
    LOGOUT_CLEAR: "Изход и изчистване на локалните ключове",
    CONFIRM_LOGOUT: "Сигурен ли си? Увери се, че си запазил своя nsec ключ!",
    BLOCKED_USERS: "Блокирани профили",
    HIDDEN_USERS: "Скрити профили",
    UNBLOCK: "Отблокирай",
    UNHIDE: "Покажи отново",
    NO_PROFILES_FOUND: "Няма намерени профили според избраните филтри.",
    MEDIA_TOO_LARGE: "Файлът надвишава лимита от 20MB.",
    INVALID_NSEC: "Невалиден nsec или шестнадесетичен частен ключ!",
    CLEAR_SEARCH: "Изчисти търсенето",
    EMOJIS: "Емотикони",
    UPLOAD_PHOTO_DEVICE: "Качи снимка от устройството (Онлайн хостинг)",
    UPLOAD_VIDEO_DEVICE: "Качи видео от устройството (Онлайн хостинг)",
    UPLOADING_ONLINE: "Качване онлайн...",
    ONLINE_STORED: "Съхранено онлайн",
    REMOVE_MEDIA: "Премахни",
    EDIT_ROOM: "Редактирай стая",
    EDIT_ROOM_TITLE: "Редакция на стая (Администратор)",
    SAVE_ROOM_BTN: "Запази промените (NIP-28)",
    ROOM_PICTURE: "Снимка на стаята",
    ROOM_UPDATED: "Стаята е обновена успешно!",
    ADMIN_BADGE: "Администратор",
    PARTICIPANTS_LIST: "Списък с участници",
    ROOM_PARTICIPANTS_TITLE: "Всички участници в стаята",
    YOU: "Ти (You)",
    IN_ROOM: "В стаята",
    SEARCH_PARTICIPANTS: "Търси участник...",
    AUTO_BACKUP_TITLE: "Автоматичен локален бекъп (на устройството)",
    AUTO_BACKUP_DESC: "При всяка промяна (съобщения, профил, ключове) данните се записват автоматично на момента във ваша локална папка.",
    SELECT_BACKUP_FOLDER: "Избери папка за бекъп",
    CHANGE_BACKUP_FOLDER: "Промени папка",
    DISCONNECT_BACKUP_FOLDER: "Премахни папка",
    BACKUP_FOLDER_LABEL: "Избрана локална папка",
    NO_FOLDER_SELECTED: "Не е избрана папка (записва се в браузъра)",
    LAST_AUTO_BACKUP: "Последен автоматичен запис",
    AUTO_BACKUP_ACTIVE: "Активен (запис на момента)",
    BACKUP_NOW: "Запази бекъп сега",
    BROWSER_NOT_SUPPORTED_DIR: "Вашият браузър не поддържа директен избор на папка (използва се вътрешен локален бекъп и ръчен експорт).",
    BACKUP_SAVED_SUCCESS: "Бекъпът беше записан успешно на устройството!",
    REMOVE_FROM_ROOM: "Премахни от стаята",
    CONFIRM_REMOVE_FROM_ROOM: "Сигурни ли сте, че искате да премахнете този участник от стаята?",
    PARTICIPANT_REMOVED: "Участникът беше премахнат от стаята!",
    QUICK_LOGOUT: "Изход",
    SWITCH_PROFILE: "Смяна на профил",
    SAVED_PROFILES: "Запазени профили",
    CURRENT_PROFILE: "Текущ профил",
    ADD_OR_CREATE_PROFILE: "+ Нов / Друг профил",
    LOGOUT_CONFIRM: "Сигурни ли сте, че искате да излезете от текущия профил? Данните са безопасно запазени.",
    BACKUP_DOWNLOAD_FALLBACK: "Свали бекъп на устройството (.json)",
    BACKUP_FILE_DOWNLOADED: "Бекъп файлът беше свален успешно на устройството ви!",
    GALLERY_SPECS_NOTE: "Желателно е снимките да бъдат до 20 MB и с резолюция 2160 × 2700 px (4K).",
    AVATAR_HEADER_TITLE: "Заглавна снимка (Аватар) на профила",
    AVATAR_HEADER_DESC: "Това изображение е вашата визитка и се показва в профила, чатовете и при търсене. Ако не качите своя снимка, автоматично се поставя аватар според посочените пол и възраст.",
    AVATAR_AUTO_BADGE: "Автоматичен аватар (по подразбиране според пол и възраст)",
    AVATAR_CUSTOM_BADGE: "Зададен потребителски аватар",
    AVATAR_CHOOSE_PRESET: "Избери аватар от наличната галерия",
    AVATAR_PRESETS_ALL: "Всички аватари",
    AVATAR_PRESETS_MALE: "Мъже (14 - 60г.)",
    AVATAR_PRESETS_FEMALE: "Жени (14 - 60г.)",
    AVATAR_UPLOAD_BTN: "Качи нова заглавна снимка от устройството",
    AVATAR_RESET_DEFAULT: "Върни автоматичен аватар",
    AVATAR_URL_INPUT_LABEL: "Или въведи линк към заглавна снимка (URL):",
    EDIT_MESSAGE: "Редактирай",
    SAVE_MESSAGE: "Запази",
    CANCEL_ACTION: "Отказ",
    DELETE_MESSAGE: "Изтрий съобщението",
    DELETE_MEDIA: "Изтрий медия",
    CLEAR_TEXT: "Изтрий само текста",
    CONFIRM_DELETE_MSG: "Сигурни ли сте, че искате да изтриете това съобщение?",
    CONFIRM_DELETE_MEDIA: "Сигурни ли сте, че искате да изтриете тази медия (снимка, видео или аудио съобщение)?",
    CONFIRM_CLEAR_TEXT: "Сигурни ли сте, че искате да изтриете текста от това съобщение?",
    EDITED_BADGE: "редактирано",
    DATE_FROM: "От дата",
    DATE_TO: "До дата",
    DATE_RANGE: "Период от дата до дата",
    FILTER_TODAY: "Днес",
    FILTER_ALL_DATES: "Всички",
    CLEAR_DATE_FILTER: "Изчисти датния филтър",
    ZOOM_ORIGINAL: "100% Оригинален размер",
    REQUEST_TO_JOIN: "Изпрати заявка за присъединяване",
    REQUEST_SENT: "Заявката за присъединяване е изпратена!",
    REQUEST_ALREADY_SENT: "Вече сте изпратили заявка за тази стая",
    MEMBERSHIP_PENDING: "Чака одобрение от създателя",
    JOIN_REQUESTS: "Заявки за присъединяване",
    NO_JOIN_REQUESTS: "Няма чакащи заявки",
    APPROVE: "Одобри",
    DECLINE: "Откажи",
    APPROVED_TOAST: "Потребителят е добавен към стаята!",
    DECLINED_TOAST: "Заявката беше отказана",
    MANAGE_MEMBERS: "Управление на абонатите",
    INVITE_MEMBERS: "Покани абонат / абонати",
    INVITE_BTN: "Покани",
    INVITATION_SENT: "Поканата беше изпратена успешно!",
    ALREADY_MEMBER: "Вече е член",
    SELECT_TO_INVITE: "Избери абонати за покана",
    ADD_MEMBER_DIRECTLY: "Добави директно",
    JOINED_STATUS: "Приет",
    CREATOR_BADGE: "Създател",
    MEMBERS_COUNT: "Членове"
  },
  en: {
    APP_TITLE: "FS_Chat",
    SECURITY_WARNING_TITLE: "CRITICAL SECURITY WARNING",
    SECURITY_WARNING_TEXT: "Your private key is your ONLY identity. DO NOT SHARE IT! Save it to paper or USB. Lost key = lost profile forever!",
    BTN_QUICK_START: "Quick Start (New Identity)",
    BTN_LOGIN_KEY: "Login with Key (nsec)",
    BTN_LOAD_KEY_FILE: "Load Key from File",
    BTN_RESTORE_BACKUP: "Restore Backup (.json)",
    TAB_DATING: "Dating",
    TAB_CHATS: "Direct Chats",
    TAB_GROUPS: "Rooms / Groups",
    TAB_SETTINGS: "Profile",
    FILTER_LOCATION: "City / Location",
    FILTER_GENDER: "Seeking",
    FILTER_AGE: "Age",
    MODAL_INTERESTS_TITLE: "Interests & Traits",
    MODAL_GROUPS_TITLE: "Interest Groups",
    BTN_START_CHAT: "Start Chat",
    BTN_ADD_FRIEND: "Add Friend",
    BTN_REMOVE_FRIEND: "Remove Friend",
    BTN_BLOCK: "Block",
    BTN_HIDE: "Hide Profile",
    SYNC_STATUS_OK: "✓ All synced (100%)",
    SYNC_STATUS_PROGRESS: "Syncing...",
    LABEL_SEARCH_CHAT: "Search in chat...",
    LABEL_SEARCH_ROOMS: "Search room/group...",
    ABOUT_NOSTR_TITLE: "How does this system work?",
    ABOUT_NOSTR_TEXT: "This app is decentralized. No central server. Messages travel end-to-end encrypted across volunteer NOSTR relays.",
    DONATION_TITLE: "Support the Network",
    DONATION_TEXT: "This app runs thanks to the NOSTR community. Support volunteers via Bitcoin / Lightning.",
    
    // Additional system keys
    ALL: "All",
    SAVE_PROFILE: "Save Changes",
    PROFILE_SAVED: "Profile saved locally & published to NOSTR!",
    REQUIRED_FIELD: "Required field",
    EXPORT_BACKUP: "Export Full Backup (backup.json)",
    IMPORT_BACKUP: "Import Backup (backup.json)",
    KEYS_MANAGEMENT: "Cryptographic Keys Management",
    PUBLIC_KEY: "Public Key (npub)",
    PRIVATE_KEY: "Private Key (nsec)",
    COPY_KEY: "Copy",
    COPIED: "Copied!",
    DOWNLOAD_KEY: "Download Key File",
    RELAY_STATUS: "NOSTR Relays",
    ACTIVE_RELAYS: "Active connections to volunteer servers",
    ADD_RELAY: "Add Relay",
    SEND_MESSAGE: "Send",
    TYPE_MESSAGE: "Type a secret message (NIP-04 E2EE)...",
    ATTACH_PHOTO: "Photo",
    ATTACH_VIDEO: "Video (up to 20MB)",
    MEDIA_GALLERY: "Media Gallery",
    JUMP_TO_DATE: "Jump to Date",
    NO_MESSAGES: "No messages yet. Send the first message!",
    ENCRYPTED_NOTE: "End-to-end encrypted with your & recipient's Nostr key.",
    ONLINE_NOW: "Online",
    NEW_ROOM: "New Room / Group",
    ROOM_NAME: "Room Name",
    ROOM_ABOUT: "Description",
    CREATE_ROOM_BTN: "Create Room (NIP-28)",
    PARTICIPANTS: "Participants",
    LEAVE_ROOM: "Leave Room",
    BACK: "Back",
    INSTALL_PWA: "Install App",
    INSTALL_APP: "Install App",
    INSTALL_IOS_GUIDE: "Install on iPhone/iPad",
    IOS_INSTALL_INSTRUCTION: "To install: Tap the 'Share' button in your browser and select 'Add to Home Screen'",
    IOS_STEP_1: "1. Tap the Share button in Safari.",
    IOS_STEP_2: "2. Scroll down and tap 'Add to Home Screen'.",
    CLOSE: "Close",
    LOGOUT_CLEAR: "Logout & Wipe Local Keys",
    CONFIRM_LOGOUT: "Are you sure? Ensure you have saved your nsec key!",
    BLOCKED_USERS: "Blocked Profiles",
    HIDDEN_USERS: "Hidden Profiles",
    UNBLOCK: "Unblock",
    UNHIDE: "Unhide",
    NO_PROFILES_FOUND: "No profiles found matching current filters.",
    MEDIA_TOO_LARGE: "File exceeds 20MB limit.",
    INVALID_NSEC: "Invalid nsec or hex private key!",
    CLEAR_SEARCH: "Clear Search",
    EMOJIS: "Emojis",
    UPLOAD_PHOTO_DEVICE: "Upload Photo from Device (Online Hosting)",
    UPLOAD_VIDEO_DEVICE: "Upload Video from Device (Online Hosting)",
    UPLOADING_ONLINE: "Uploading online...",
    ONLINE_STORED: "Stored Online",
    REMOVE_MEDIA: "Remove",
    EDIT_ROOM: "Edit Room",
    EDIT_ROOM_TITLE: "Edit Room (Administrator)",
    SAVE_ROOM_BTN: "Save Changes (NIP-28)",
    ROOM_PICTURE: "Room Picture",
    ROOM_UPDATED: "Room updated successfully!",
    ADMIN_BADGE: "Admin",
    PARTICIPANTS_LIST: "Participants List",
    ROOM_PARTICIPANTS_TITLE: "All Room Participants",
    YOU: "You",
    IN_ROOM: "In room",
    SEARCH_PARTICIPANTS: "Search participant...",
    AUTO_BACKUP_TITLE: "Automatic Local Backup (On Device)",
    AUTO_BACKUP_DESC: "On every change (messages, profile, keys) your data is instantly backed up to your selected local folder.",
    SELECT_BACKUP_FOLDER: "Select Backup Folder",
    CHANGE_BACKUP_FOLDER: "Change Folder",
    DISCONNECT_BACKUP_FOLDER: "Disconnect Folder",
    BACKUP_FOLDER_LABEL: "Selected Local Folder",
    NO_FOLDER_SELECTED: "No folder selected (backed up inside browser storage)",
    LAST_AUTO_BACKUP: "Last automatic backup",
    AUTO_BACKUP_ACTIVE: "Active (instant on every change)",
    BACKUP_NOW: "Backup Now",
    BROWSER_NOT_SUPPORTED_DIR: "Your browser does not support folder picker (using internal storage and manual export).",
    BACKUP_SAVED_SUCCESS: "Backup saved successfully to device!",
    REMOVE_FROM_ROOM: "Remove from room",
    CONFIRM_REMOVE_FROM_ROOM: "Are you sure you want to remove this participant from the room?",
    PARTICIPANT_REMOVED: "Participant was removed from the room!",
    QUICK_LOGOUT: "Logout",
    SWITCH_PROFILE: "Switch Profile",
    SAVED_PROFILES: "Saved Profiles",
    CURRENT_PROFILE: "Current Profile",
    ADD_OR_CREATE_PROFILE: "+ New / Another Profile",
    LOGOUT_CONFIRM: "Are you sure you want to log out of the current profile? Your data is safely stored locally.",
    BACKUP_DOWNLOAD_FALLBACK: "Download Backup to Device (.json)",
    BACKUP_FILE_DOWNLOADED: "Backup file downloaded successfully to your device!",
    GALLERY_SPECS_NOTE: "Recommended: photos up to 20 MB and resolution 2160 × 2700 px (4K).",
    AVATAR_HEADER_TITLE: "Profile Avatar / Header Picture",
    AVATAR_HEADER_DESC: "This image represents you in search, chats, and your profile. If you don't provide one, an automatic avatar matching your gender and age is used.",
    AVATAR_AUTO_BADGE: "Automatic Avatar (default by gender & age)",
    AVATAR_CUSTOM_BADGE: "Custom Profile Avatar",
    AVATAR_CHOOSE_PRESET: "Choose from preset avatars gallery",
    AVATAR_PRESETS_ALL: "All Avatars",
    AVATAR_PRESETS_MALE: "Men (14 - 60 yrs)",
    AVATAR_PRESETS_FEMALE: "Women (14 - 60 yrs)",
    AVATAR_UPLOAD_BTN: "Upload Avatar from Device",
    AVATAR_RESET_DEFAULT: "Reset to Automatic Avatar",
    AVATAR_URL_INPUT_LABEL: "Or enter avatar link (URL):",
    EDIT_MESSAGE: "Edit",
    SAVE_MESSAGE: "Save",
    CANCEL_ACTION: "Cancel",
    DELETE_MESSAGE: "Delete Message",
    DELETE_MEDIA: "Delete Media",
    CLEAR_TEXT: "Clear Text Only",
    CONFIRM_DELETE_MSG: "Are you sure you want to delete this message?",
    CONFIRM_DELETE_MEDIA: "Are you sure you want to delete this media (photo, video or audio message)?",
    CONFIRM_CLEAR_TEXT: "Are you sure you want to delete the text from this message?",
    EDITED_BADGE: "edited",
    DATE_FROM: "From date",
    DATE_TO: "To date",
    DATE_RANGE: "Date range (From - To)",
    FILTER_TODAY: "Today",
    FILTER_ALL_DATES: "All",
    CLEAR_DATE_FILTER: "Clear date filter",
    ZOOM_ORIGINAL: "100% Original Size",
    REQUEST_TO_JOIN: "Request to Join Room",
    REQUEST_SENT: "Join request sent successfully!",
    REQUEST_ALREADY_SENT: "You have already sent a request for this room",
    MEMBERSHIP_PENDING: "Pending approval from creator",
    JOIN_REQUESTS: "Join Requests",
    NO_JOIN_REQUESTS: "No pending requests",
    APPROVE: "Approve",
    DECLINE: "Decline",
    APPROVED_TOAST: "User was approved and added to room!",
    DECLINED_TOAST: "Join request was declined",
    MANAGE_MEMBERS: "Manage Members",
    INVITE_MEMBERS: "Invite Member(s)",
    INVITE_BTN: "Invite",
    INVITATION_SENT: "Invitation sent successfully!",
    ALREADY_MEMBER: "Already a member",
    SELECT_TO_INVITE: "Select members to invite",
    ADD_MEMBER_DIRECTLY: "Add Directly",
    JOINED_STATUS: "Joined",
    CREATOR_BADGE: "Creator",
    MEMBERS_COUNT: "Members"
  }
};

export interface ProfileFieldConfig {
  id: string;
  labelBg: string;
  labelEn: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'media_photos' | 'media_video';
  required: boolean;
  options?: string[];
  maxLength?: number;
}

export const PROFILE_FIELDS_CONFIG: ProfileFieldConfig[] = [
  // ЗАДЪЛЖИТЕЛНИ:
  { id: "name", labelBg: "Име / Псевдоним", labelEn: "Name / Nickname", type: "text", required: true },
  { id: "age", labelBg: "Възраст", labelEn: "Age", type: "number", required: true },
  { id: "location", labelBg: "Град / Локация", labelEn: "City / Location", type: "text", required: true },
  
  // ДОПЪЛНИТЕЛНИ (Лесни за промяна/триене/добавяне):
  { id: "gender", labelBg: "Моят пол", labelEn: "My Gender", type: "select", options: ["Мъж / Male", "Жена / Female", "Друго / Other"], required: false },
  { id: "Orientation", labelBg: "Ориентация", labelEn: "Orientation", type: "select", options: ["Хетеросексуален / Heterosexual", "Гей / Gay", "Лесбийка / Lesbian", "Бисекс / Bisex", "Трансексуал / Transsexual", "Джендер / Gender", "Друго / Other"], required: false },
  { id: "seeking", labelBg: "Търся", labelEn: "Seeking", type: "select", options: ["Жена / Female", "Мъж / Male", "Мъж+Жена / Male+Female", "Двойки / Doubles", "Семейства / Families", "Групи / Groups", "Всички / All"], required: false },
  { id: "bio", labelBg: "За мен (кратко)", labelEn: "About Me", type: "textarea", maxLength: 300, required: false },
  { id: "interests", labelBg: "Интереси / Какво е тръпка за мен (разделени със запетая)", labelEn: "Interests / What Excites Me (comma separated)", type: "text", required: false },
  { id: "photos", labelBg: "Снимки (URLs)", labelEn: "Photos (URLs)", type: "media_photos", required: false },
  { id: "video", labelBg: "Видео-визитка (до 20MB, URL)", labelEn: "Video Clip (max 20MB, URL)", type: "media_video", required: false }
];

export interface NostrIdentity {
  privKeyHex: string; // 64 hex chars
  pubKeyHex: string;  // 64 hex chars
  nsec: string;       // bech32 nsec1...
  npub: string;       // bech32 npub1...
  createdAt: number;
}

export interface UserProfile {
  pubkey: string;
  name: string;
  age: number;
  location: string;
  gender?: string;
  Orientation?: string;
  seeking?: string;
  bio?: string;
  interests?: string | string[];
  photos?: string[];
  video?: string;
  avatarUrl?: string;
  updatedAt: number;
}

export function parseInterestsList(interests?: string | string[] | any): string[] {
  if (!interests) return [];
  if (Array.isArray(interests)) {
    return interests
      .map(item => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
      .filter(item => item.length > 0);
  }
  if (typeof interests === 'string') {
    return interests
      .split(/[,;\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
  return [];
}

export interface DirectMessage {
  id: string;
  chatWithPubkey: string;
  fromPubkey: string;
  toPubkey: string;
  content: string; // Decrypted content in memory/db
  rawCiphertext?: string;
  timestamp: number;
  mediaUrl?: string;
  mediaType?: 'photo' | 'video' | 'audio';
  duration?: number; // Duration in seconds for voice notes
  isOutgoing: boolean;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  fromPubkey: string;
  authorName: string;
  content: string;
  timestamp: number;
  mediaUrl?: string;
  mediaType?: 'photo' | 'video' | 'audio';
  duration?: number;
}

export interface RoomJoinRequest {
  pubkey: string;
  name: string;
  avatarUrl?: string;
  timestamp: number;
}

export interface ChatChannel {
  id: string;
  name: string;
  about?: string;
  picture?: string;
  creatorPubkey?: string;
  createdAt: number;
  participantCount?: number;
  members?: string[]; // Approved member pubkeys
  pendingRequests?: RoomJoinRequest[]; // Requested pubkeys waiting for approval
  invitedPubkeys?: string[]; // Pubkeys invited by the creator
}

export interface RelayInfo {
  url: string;
  status: 'connected' | 'connecting' | 'error';
  lastPingMs?: number;
}

export interface AppBackupData {
  version: number;
  exportedAt: string;
  identity: NostrIdentity;
  profile: UserProfile;
  friends: string[];
  blocked: string[];
  hidden: string[];
  directMessages: DirectMessage[];
  channelMessages: ChannelMessage[];
  channels: ChatChannel[];
}
