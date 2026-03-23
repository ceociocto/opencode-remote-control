/**
 * Weixin API types (based on @tencent-weixin/openclaw-weixin)
 */

// Message types
export const MessageItemType = {
  NONE: 0,
  TEXT: 1,
  IMAGE: 2,
  VOICE: 3,
  FILE: 4,
  VIDEO: 5,
} as const

export const MessageType = {
  NONE: 0,
  USER: 1,
  BOT: 2,
} as const

export const MessageState = {
  NEW: 0,
  GENERATING: 1,
  FINISH: 2,
} as const

// API types
export interface TextItem {
  text?: string
}

export interface CDNMedia {
  encrypt_query_param?: string
  aes_key?: string
  encrypt_type?: number
}

export interface ImageItem {
  media?: CDNMedia
  thumb_media?: CDNMedia
  aeskey?: string
  url?: string
  mid_size?: number
  thumb_size?: number
  thumb_height?: number
  thumb_width?: number
  hd_size?: number
}

export interface VoiceItem {
  media?: CDNMedia
  encode_type?: number
  bits_per_sample?: number
  sample_rate?: number
  playtime?: number
  text?: string
}

export interface FileItem {
  media?: CDNMedia
  file_name?: string
  md5?: string
  len?: string
}

export interface VideoItem {
  media?: CDNMedia
  video_size?: number
  play_length?: number
  video_md5?: string
  thumb_media?: CDNMedia
  thumb_size?: number
  thumb_height?: number
  thumb_width?: number
}

export interface RefMessage {
  message_item?: MessageItem
  title?: string
}

export interface MessageItem {
  type?: number
  create_time_ms?: number
  update_time_ms?: number
  is_completed?: boolean
  msg_id?: string
  ref_msg?: RefMessage
  text_item?: TextItem
  image_item?: ImageItem
  voice_item?: VoiceItem
  file_item?: FileItem
  video_item?: VideoItem
}

// Unified message
export interface WeixinMessage {
  seq?: number
  message_id?: number
  from_user_id?: string
  to_user_id?: string
  client_id?: string
  create_time_ms?: number
  update_time_ms?: number
  delete_time_ms?: number
  session_id?: string
  group_id?: string
  message_type?: number
  message_state?: number
  item_list?: MessageItem[]
  context_token?: string
}

// API request/response types
export interface GetUpdatesReq {
  sync_buf?: string
  get_updates_buf?: string
}

export interface GetUpdatesResp {
  ret?: number
  errcode?: number
  errmsg?: string
  msgs?: WeixinMessage[]
  sync_buf?: string
  get_updates_buf?: string
  longpolling_timeout_ms?: number
}

export interface SendMessageReq {
  msg?: WeixinMessage
}

export interface TypingStatus {
  TYPING: 1
  CANCEL: 2
}

export interface SendTypingReq {
  ilink_user_id?: string
  typing_ticket?: string
  status?: number
}

export interface SendTypingResp {
  ret?: number
  errmsg?: string
}

export interface GetConfigResp {
  ret?: number
  errmsg?: string
  typing_ticket?: string
}

// Login types
export interface QRCodeResponse {
  qrcode: string
  qrcode_img_content: string
}

export interface StatusResponse {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired'
  bot_token?: string
  ilink_bot_id?: string
  baseurl?: string
  ilink_user_id?: string
}

export interface WeixinCredentials {
  token: string
  baseUrl: string
  accountId: string
  userId?: string
  savedAt?: string
}

// Bot config
export interface WeixinBotConfig {
  baseUrl?: string
  cdnBaseUrl?: string
}

// Constants
export const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com'
export const CDN_BASE_URL = 'https://novac2c.cdn.weixin.qq.com/c2c'
