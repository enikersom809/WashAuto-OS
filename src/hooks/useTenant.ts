import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  limit, 
  getDocs, 
  DocumentData 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TenantData {
  id: string;
  nome: string;
  slug: string;
  domain?: string;
  logoUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  plan?: string;
  [key: string]: any;
}

interface UseTenantReturn {
  tenant: TenantData | null;
  loading: boolean;
  error: string | null;
  refreshTenant: () => Promise<void>;
  clearTenant: () => void;
}

const LOCAL_STORAGE_KEY = 'tenant_current';

/**
 * Custom Hook: useTenant
 * Gerencia a inicialização inteligente do inquilino (Tenant) para PWA Multi-tenant.
 * 
 * @param urlSlug - O slug extraído dos parâmetros de rota (ex: :slug) ou query params.
 */
export function useTenant(urlSlug: string | undefined): UseTenantReturn {
  const [tenant, setTenant] = useState<TenantData | null>(() => {
    // Inicialização síncrona do cache local para evitar layout shift
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          return JSON.parse(cached) as TenantData;
        }
      } catch (e) {
        console.warn('Falha ao restaurar inquilino do LocalStorage:', e);
      }
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenant = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // CENÁRIO A: Existe um slug na URL (ex: cliente escaneou o QR Code /estetica-automotiva-mario)
      if (urlSlug && urlSlug.trim().length > 0) {
        const cleanSlug = urlSlug.trim().toLowerCase();

        // 1. Consulta no Firestore na coleção 'empresas' usando Firebase Web SDK v11
        const empresasRef = collection(db, 'empresas');
        const q = query(empresasRef, where('slug', '==', cleanSlug), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          const data = docSnap.data() as DocumentData;

          const loadedTenant: TenantData = {
            id: docSnap.id,
            nome: data.nome || data.name || 'Lava-Jato',
            slug: data.slug || cleanSlug,
            domain: data.domain || `${cleanSlug}.saas.com`,
            logoUrl: data.logoUrl,
            contactPhone: data.contactPhone || data.phone,
            contactEmail: data.contactEmail || data.email,
            plan: data.plan || 'Pro',
            ...data
          };

          // Persiste no LocalStorage para visitas futuras do PWA
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loadedTenant));
          setTenant(loadedTenant);
        } else {
          // Fallback: Tenta também na coleção 'tenants' (caso cadastrado como tenants)
          const fallbackRef = collection(db, 'tenants');
          const qFallback = query(fallbackRef, where('code', '==', cleanSlug.toUpperCase()), limit(1));
          const fallbackSnapshot = await getDocs(qFallback);

          if (!fallbackSnapshot.empty) {
            const docSnap = fallbackSnapshot.docs[0];
            const data = docSnap.data();
            const fallbackTenant: TenantData = {
              id: docSnap.id,
              nome: data.nome || data.name || 'Lava-Jato',
              slug: cleanSlug,
              ...data
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fallbackTenant));
            setTenant(fallbackTenant);
          } else {
            // Slug não encontrado no banco
            setError(`Nenhum lava-jato encontrado para o endereço "/${cleanSlug}".`);
            // Não sobrescreve o cache existente caso o usuário tenha digitado um slug inválido por engano
          }
        }
      } 
      // CENÁRIO B: NÃO existe slug na URL (rota raiz / ou cliente acessando o PWA direto da tela inicial do celular)
      else {
        const savedTenantJson = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedTenantJson) {
          try {
            const parsedTenant = JSON.parse(savedTenantJson) as TenantData;
            setTenant(parsedTenant);
          } catch (parseError) {
            console.error('Erro ao interpretar dados do inquilino salvo:', parseError);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setTenant(null);
          }
        } else {
          // Nenhum inquilino prévio no dispositivo
          setTenant(null);
        }
      }
    } catch (err: any) {
      console.error('Erro ao inicializar inquilino no Firestore:', err);
      setError(err.message || 'Erro ao carregar dados do lava-jato.');
    } finally {
      setLoading(false);
    }
  }, [urlSlug]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  const clearTenant = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setTenant(null);
  }, []);

  return {
    tenant,
    loading,
    error,
    refreshTenant: fetchTenant,
    clearTenant
  };
}
