/**
 * Model Selector Component
 * Allows users to select between OpenAI, Anthropic, and Gemini models
 */

import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface ModelOption {
  provider: 'openai' | 'anthropic' | 'gemini';
  id: string;
  name: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // OpenAI Models
  { provider: 'openai', id: 'gpt-4o', name: 'GPT-4o' },
  { provider: 'openai', id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { provider: 'openai', id: 'gpt-4', name: 'GPT-4' },
  { provider: 'openai', id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  
  // Anthropic Models
  { provider: 'anthropic', id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { provider: 'anthropic', id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  { provider: 'anthropic', id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
  { provider: 'anthropic', id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
  
  // Gemini Models
  { provider: 'gemini', id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
  { provider: 'gemini', id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { provider: 'gemini', id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
];

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedModelData = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

  const groupedModels = AVAILABLE_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, ModelOption[]>);

  const providerLabels: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google',
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 px-3 py-2 text-sm bg-gray-50 dark:bg-darkBg-secondary hover:bg-gray-100 dark:hover:bg-darkBg-tertiary border border-gray-200 dark:border-darkBg-secondary rounded-lg transition text-gray-700 dark:text-darkText-secondary"
        title={`Selected: ${selectedModelData.name}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-500 dark:text-darkText-tertiary truncate">
            {providerLabels[selectedModelData.provider]}
          </span>
          <span className="truncate font-medium">{selectedModelData.name}</span>
        </div>
        <ChevronDown 
          size={16} 
          className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mb-2 z-20 bg-white dark:bg-darkBg-primary border border-gray-200 dark:border-darkBg-secondary rounded-lg shadow-lg max-h-80 overflow-auto min-w-[200px]">
            {Object.entries(groupedModels).map(([provider, models]) => (
              <div key={provider} className="border-b border-gray-200 dark:border-darkBg-secondary last:border-b-0">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-darkText-tertiary bg-gray-50 dark:bg-darkBg-secondary sticky top-0">
                  {providerLabels[provider]}
                </div>
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model.id);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-darkBg-secondary transition text-left"
                  >
                    <span className="text-gray-900 dark:text-darkText-primary">{model.name}</span>
                    {selectedModel === model.id && (
                      <Check size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

