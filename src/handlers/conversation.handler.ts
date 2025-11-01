import { mieltoAPI } from "@/utils/api";

export interface ConversationCreateRequest {
  title: string;
  is_public?: boolean;
  collections?: string[];
  meta_data?: Record<string, any>;
  settings?: Record<string, any>;
  owner_id?: string;
  user_id?: string;
  messages?: MessageCreateRequest[];
}

export interface ConversationUpdate {
  title?: string;
  summary?: string;
  status?: string;
  is_public?: boolean;
  collections?: string[];
  meta_data?: Record<string, any>;
  settings?: Record<string, any>;
  ended_at?: string;
  user_id?: string;
}

export interface ConversationRead {
  id: string;
  workspace_id: string;
  title?: string;
  summary?: string;
  status: string;
  is_public: boolean;
  collections?: string[];
  meta_data?: Record<string, any>;
  settings?: Record<string, any>;
  ended_at?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationWithStats extends ConversationRead {
  message_count?: number;
  last_message_at?: string;
  participants?: string[];
}

export interface MessageCreateRequest {
  content: string;
  role: 'user' | 'assistant' | 'system';
  meta_data?: Record<string, any>;
}

export interface GetConversationsResponse {
  data: ConversationWithStats[];
  total_count: number;
  has_more: boolean;
  next_cursor?: string;
  prev_cursor?: string;
}

export const listConversations = async (options?: {
  status?: string;
  is_public?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}): Promise<GetConversationsResponse> => {
  const headers = await mieltoAPI.getHeaders();
  
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.is_public !== undefined) params.append('is_public', options.is_public.toString());
  if (options?.search) params.append('search', options.search);
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.cursor) params.append('cursor', options.cursor);
  if (options?.direction) params.append('direction', options.direction);

  const queryString = params.toString();
  const url = queryString ? `/api/v1/conversations?${queryString}` : '/api/v1/conversations';

  const response = await fetch(`${await mieltoAPI.getBaseUrl()}${url}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list conversations: ${response.statusText} - ${errorText}`);
  }

  return response.json();
};

export const createConversation = async (
  data: ConversationCreateRequest, 
  apiKey?: string,
  collectionIds?: string[]
): Promise<ConversationRead> => {
  const headers = await mieltoAPI.getHeaders() as Record<string, string>;
  
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  
  if (collectionIds && collectionIds.length > 0) {
    headers['x-collection-ids'] = JSON.stringify(collectionIds);
  }

  const response = await fetch(`${await mieltoAPI.getBaseUrl()}/api/v1/conversations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create conversation: ${response.statusText} - ${errorText}`);
  }

  return response.json();
};

export const getConversation = async (conversationId: string): Promise<ConversationRead> => {
  const headers = await mieltoAPI.getHeaders();
  
  const response = await fetch(`${await mieltoAPI.getBaseUrl()}/api/v1/conversations/${conversationId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get conversation: ${response.statusText} - ${errorText}`);
  }

  return response.json();
};

export const updateConversation = async (conversationId: string, data: ConversationUpdate): Promise<ConversationRead> => {
  const headers = await mieltoAPI.getHeaders();
  
  const response = await fetch(`${await mieltoAPI.getBaseUrl()}/api/v1/conversations/${conversationId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update conversation: ${response.statusText} - ${errorText}`);
  }

  return response.json();
};

export const deleteConversation = async (conversationId: string): Promise<void> => {
  const headers = await mieltoAPI.getHeaders();
  
  const response = await fetch(`${await mieltoAPI.getBaseUrl()}/api/v1/conversations/${conversationId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete conversation: ${response.statusText} - ${errorText}`);
  }
};

export const getConversationWithMessages = async (conversationId: string) => {
  const headers = await mieltoAPI.getHeaders();
  
  const response = await fetch(`${await mieltoAPI.getBaseUrl()}/api/v1/conversations/${conversationId}/messages`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get conversation messages: ${response.statusText} - ${errorText}`);
  }

  return response.json();
};