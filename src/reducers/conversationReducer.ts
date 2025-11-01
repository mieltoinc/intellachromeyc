import { ConversationWithStats } from "@/handlers/conversation.handler";

export interface ConversationState {
  conversations: ConversationWithStats[];
  loading: boolean;
  error: string | null;
  selectedConversationId: string | null;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  // Cursor pagination state
  nextCursor?: string;
  prevCursor?: string;
  hasMore: boolean;
  loadingMore: boolean;
}

export type ConversationAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONVERSATIONS'; payload: { conversations: ConversationWithStats[]; total: number; page: number; pages: number } }
  | { type: 'SET_CONVERSATIONS_CURSOR'; payload: { conversations: ConversationWithStats[]; total: number; nextCursor?: string; prevCursor?: string; hasMore: boolean } }
  | { type: 'APPEND_CONVERSATIONS'; payload: { conversations: ConversationWithStats[]; nextCursor?: string; hasMore: boolean } }
  | { type: 'PREPEND_CONVERSATIONS'; payload: { conversations: ConversationWithStats[]; prevCursor?: string; hasMore: boolean } }
  | { type: 'SET_LOADING_MORE'; payload: boolean }
  | { type: 'ADD_CONVERSATION'; payload: ConversationWithStats }
  | { type: 'UPDATE_CONVERSATION'; payload: ConversationWithStats }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'SELECT_CONVERSATION'; payload: string | null }
  | { type: 'CLEAR_ERROR' };

export const initialConversationState: ConversationState = {
  conversations: [],
  loading: false,
  error: null,
  selectedConversationId: null,
  totalCount: 0,
  currentPage: 1,
  totalPages: 1,
  nextCursor: undefined,
  prevCursor: undefined,
  hasMore: false,
  loadingMore: false,
};

export const conversationReducer = (
  state: ConversationState,
  action: ConversationAction
): ConversationState => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case 'SET_CONVERSATIONS':
      return {
        ...state,
        conversations: action.payload.conversations,
        totalCount: action.payload.total,
        currentPage: action.payload.page,
        totalPages: action.payload.pages,
        loading: false,
        error: null,
      };

    case 'SET_CONVERSATIONS_CURSOR':
      return {
        ...state,
        conversations: action.payload.conversations,
        totalCount: action.payload.total,
        nextCursor: action.payload.nextCursor,
        prevCursor: action.payload.prevCursor,
        hasMore: action.payload.hasMore,
        loading: false,
        loadingMore: false,
        error: null,
      };

    case 'APPEND_CONVERSATIONS':
      return {
        ...state,
        conversations: [...state.conversations, ...action.payload.conversations],
        nextCursor: action.payload.nextCursor,
        hasMore: action.payload.hasMore,
        loadingMore: false,
        error: null,
      };

    case 'PREPEND_CONVERSATIONS':
      return {
        ...state,
        conversations: [...action.payload.conversations, ...state.conversations],
        prevCursor: action.payload.prevCursor,
        hasMore: action.payload.hasMore,
        loadingMore: false,
        error: null,
      };

    case 'SET_LOADING_MORE':
      return {
        ...state,
        loadingMore: action.payload,
      };

    case 'ADD_CONVERSATION':
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
        totalCount: state.totalCount + 1,
      };

    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map(conversation =>
          conversation.id === action.payload.id ? action.payload : conversation
        ),
      };

    case 'DELETE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.filter(conversation => conversation.id !== action.payload),
        totalCount: state.totalCount - 1,
        selectedConversationId: state.selectedConversationId === action.payload ? null : state.selectedConversationId,
      };

    case 'SELECT_CONVERSATION':
      return {
        ...state,
        selectedConversationId: action.payload,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
};