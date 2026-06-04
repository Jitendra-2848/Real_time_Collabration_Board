import React, { createContext, useContext, useRef } from 'react';

type FeatureAPI = any;

type Registry = {
  register: (name: string, api: FeatureAPI) => void;
  unregister: (name: string) => void;
  get: (name: string) => FeatureAPI | undefined;
};

const FeatureContext = createContext<Registry | null>(null);

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mapRef = useRef(new Map<string, FeatureAPI>());

  const register = (name: string, api: FeatureAPI) => {
    mapRef.current.set(name, api);
  };

  const unregister = (name: string) => {
    mapRef.current.delete(name);
  };

  const get = (name: string) => mapRef.current.get(name);

  return (
    <FeatureContext.Provider value={{ register, unregister, get }}>
      {children}
    </FeatureContext.Provider>
  );
};

export function useFeatureRegistry() {
  const ctx = useContext(FeatureContext);
  if (!ctx) throw new Error('useFeatureRegistry must be used within FeatureProvider');
  return ctx;
}

export function useFeature<T = any>(name: string): T | undefined {
  const registry = useFeatureRegistry();
  return registry.get(name) as T | undefined;
}

export default FeatureContext;
