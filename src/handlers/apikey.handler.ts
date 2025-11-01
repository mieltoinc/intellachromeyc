import { mieltoAPI } from "@/utils/api";

export interface ApiKeyCreate {
    label: string;
    status?: string;
    expires_at?: Date | null;
    permissions?: string[] | null;
    ip_whitelist?: string[] | null;
    collections?: string[] | null;
}

export interface ApiKeyUpdate {
    label?: string;
    status?: string;
    expires_at?: Date | null;
    permissions?: string[] | null;
    ip_whitelist?: string[] | null;
    collections?: string[] | null;
}

export interface ApiKeyRead {
    id: string;
    key: string;
    label: string;
    status: string;
    workspace_id: string;
    created_by?: string | null;
    secret?: string | null;
    last_used_at?: Date | null;
    expires_at?: Date | null;
    permissions?: string[] | null;
    ip_whitelist?: string[] | null;
    collections?: string[] | null;
    created_at: Date;
    updated_at: Date;
}

export interface PaginatedApiKeysResponse {
    data: ApiKeyRead[];
    total_count: number;
}

export const createApiKey = async (data: ApiKeyCreate): Promise<ApiKeyRead> => {
    const headers = await mieltoAPI.getHeaders();
    const baseUrl = await mieltoAPI.getBaseUrl();
    
    const response = await fetch(`${baseUrl}/api/v1/api-keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create API key: ${response.statusText} - ${errorText}`);
    }

    return response.json();
};

export const getApiKeys = async (): Promise<PaginatedApiKeysResponse> => {
    const headers = await mieltoAPI.getHeaders();
    const baseUrl = await mieltoAPI.getBaseUrl();
    
    const response = await fetch(`${baseUrl}/api/v1/api-keys`, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch API keys: ${response.statusText} - ${errorText}`);
    }

    return response.json();
};

export const getApiKey = async (apiKeyId: string): Promise<ApiKeyRead> => {
    const headers = await mieltoAPI.getHeaders();
    const baseUrl = await mieltoAPI.getBaseUrl();
    
    const response = await fetch(`${baseUrl}/api/v1/api-keys/${apiKeyId}`, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get API key: ${response.statusText} - ${errorText}`);
    }

    return response.json();
};

export const updateApiKey = async (apiKeyId: string, data: ApiKeyUpdate): Promise<ApiKeyRead> => {
    const headers = await mieltoAPI.getHeaders();
    const baseUrl = await mieltoAPI.getBaseUrl();
    
    const response = await fetch(`${baseUrl}/api/v1/api-keys/${apiKeyId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update API key: ${response.statusText} - ${errorText}`);
    }

    return response.json();
};

export const deleteApiKey = async (apiKeyId: string): Promise<void> => {
    const headers = await mieltoAPI.getHeaders();
    const baseUrl = await mieltoAPI.getBaseUrl();
    
    const response = await fetch(`${baseUrl}/api/v1/api-keys/${apiKeyId}`, {
        method: 'DELETE',
        headers,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete API key: ${response.statusText} - ${errorText}`);
    }
};

// Utility function to get the first active API key for auto-configuration
export const getFirstActiveApiKey = async (): Promise<ApiKeyRead | null> => {
    try {
        const response = await getApiKeys();
        const activeKeys = response.data.filter(key => key.status === 'active');
        return activeKeys.length > 0 ? activeKeys[0] : null;
    } catch (error) {
        console.error('Failed to fetch active API keys:', error);
        return null;
    }
};