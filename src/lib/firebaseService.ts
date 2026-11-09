import { 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp,
  query,
  where,
  limit
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInAnonymously,
  sendPasswordResetEmail,
  updateProfile, 
  signOut,
  setPersistence,
  browserSessionPersistence,
  getAuth,
  type User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { Tenant, OilProductItem, OilChangeRecord, CashTransaction, CashRegisterSession, SaleProductItem, CounterSaleRecord, PromoBanner, LevaETrazRequest, LevaETrazStatus } from '../types';
import { sendTotemPushNotification } from './pushNotificationService';

/**
 * =================================================================
 * 1. GESTÃO DE EMPRESAS (TENANTS) NO BANCO DE DADOS (FIRESTORE)
 * Cria coleção 'tenants' e documentos no banco ao cadastrar uma empresa.
 * =================================================================
 */

/**
 * Remove recursivamente todas as propriedades com valor 'undefined'
 * para evitar o erro do Firestore: "Unsupported field value: undefined"
 */
export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)) as any;
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date) {
      return obj.toISOString() as any;
    }
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined) {
        clean[key] = typeof value === 'object' && value !== null 
          ? removeUndefinedFields(value) 
          : value;
      }
    }
    return clean as T;
  }
  return obj;
}

/**
 * Helper para executar promessas com tempo limite máximo para evitar
 * travamentos infinitos no celular ou navegador (ex: "finalizando...")
 */
export async function withTimeout<T>(promise: Promise<T>, ms = 6000, fallbackValue?: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      if (fallbackValue !== undefined) {
        resolve(fallbackValue);
      } else {
        reject(new Error(`Operação excedeu o tempo limite (${ms}ms)`));
      }
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Calcula o slug limpo e legível da empresa (ex: box1000lavajatoelubrificacao)
 * eliminando acentos, espaços e evitando IDs brutos como t-234764912345
 */
export function computeTenantSlug(name: string, fallbackId: string): string {
  const clean = (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  return clean || fallbackId;
}

/**
 * Obtém a sessão de autenticação ativa no Firebase Auth.
 * Não força login automático falso de usuário antigo para não travar dispositivos móveis.
 */
export async function ensureFirebaseAuthSession(): Promise<User | null> {
  return auth.currentUser;
}


export async function saveTenantToFirestore(tenant: Tenant): Promise<boolean> {
  try {
    // 🔐 Garante que existe um usuário autenticado no Firebase Auth para autorizar a escrita no Firestore
    await ensureFirebaseAuthSession();

    const tenantDocRef = doc(db, 'tenants', tenant.id);
    
    // Trata e limpa o endereço para que nenhum subcampo seja 'undefined'
    let cleanAddress: Record<string, string> | null = null;
    if (tenant.address) {
      cleanAddress = {
        cep: tenant.address.cep ? String(tenant.address.cep).trim() : '',
        street: tenant.address.street ? String(tenant.address.street).trim() : '',
        number: tenant.address.number ? String(tenant.address.number).trim() : '',
        complement: tenant.address.complement ? String(tenant.address.complement).trim() : '',
        neighborhood: tenant.address.neighborhood ? String(tenant.address.neighborhood).trim() : '',
        city: tenant.address.city ? String(tenant.address.city).trim() : '',
        state: tenant.address.state ? String(tenant.address.state).trim() : ''
      };
    }

    // Converte dados do Tenant para o formato Firestore
    const rawTenantData = {
      id: tenant.id,
      name: tenant.name || '',
      code: tenant.code || (tenant.name ? tenant.name.slice(0, 2).toUpperCase() : 'LJ'),
      domain: tenant.domain || '',
      plan: tenant.plan || 'Pro',
      status: tenant.status || 'Ativo',
      endUsersCount: tenant.endUsersCount ?? 1,
      maxUsers: tenant.maxUsers ?? 500,
      mrrAmount: tenant.mrrAmount ?? 0,
      createdAt: tenant.createdAt || new Date().toLocaleDateString('pt-BR'),
      contactEmail: tenant.contactEmail || '',
      contactPhone: tenant.contactPhone || '',
      ownerName: tenant.ownerName || tenant.name || '',
      lastActive: tenant.lastActive || 'Agora mesmo',
      razaoSocial: tenant.razaoSocial || '',
      nomeFantasia: tenant.nomeFantasia || tenant.name || '',
      cnpj: tenant.cnpj || '',
      inscricaoEstadual: tenant.inscricaoEstadual || '',
      address: cleanAddress,
      logoUrl: tenant.logoUrl || '',
      notes: tenant.notes || '',
      tempPassword: tenant.tempPassword || '',
      syncedAt: new Date().toISOString()
    };

    const tenantData = removeUndefinedFields(rawTenantData);

    await setDoc(tenantDocRef, tenantData, { merge: true });

    // 🏢 Salva também na coleção 'empresas' com slug normalizado para consulta direta do PWA e QR Code
    try {
      const slug = (tenant.domain ? tenant.domain.split('.')[0] : tenant.name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '') || tenant.id;

      const empresaDocRef = doc(db, 'empresas', tenant.id);
      await setDoc(empresaDocRef, removeUndefinedFields({
        id: tenant.id,
        nome: tenant.name || '',
        slug: slug,
        domain: tenant.domain || '',
        logoUrl: tenant.logoUrl || '',
        contactPhone: tenant.contactPhone || '',
        contactEmail: tenant.contactEmail || '',
        plan: tenant.plan || 'Pro',
        createdAt: new Date().toISOString()
      }), { merge: true });
    } catch (empresaErr) {
      console.warn('Registro na coleção empresas (PWA):', empresaErr);
    }

    // Cria também a estrutura de subcoleções iniciais recomendadas no Firestore
    try {
      const configDocRef = doc(db, 'tenants', tenant.id, 'config', 'general');
      await setDoc(configDocRef, removeUndefinedFields({
        tenantId: tenant.id,
        businessName: tenant.name || '',
        currency: 'BRL',
        notificationWhatsapp: true,
        createdAt: new Date().toISOString()
      }), { merge: true });
    } catch (subErr) {
      console.warn('Subcoleção inicial config gravada:', subErr);
    }

    console.log(`✅ [Firestore] Empresa "${tenant.name}" (${tenant.id}) registrada na coleção /tenants`);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tenants/${tenant.id}`);
    console.error('Erro ao salvar empresa no Firestore:', error);
    return false;
  }
}

export async function deleteTenantFromFirestore(tenantId: string): Promise<boolean> {
  try {
    // 1. Registra no tombstone local para nunca ressuscitar no navegador
    try {
      const rawDeleted = localStorage.getItem('saas_deleted_tenant_ids');
      const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
      if (!deletedList.includes(tenantId)) {
        deletedList.push(tenantId);
        localStorage.setItem('saas_deleted_tenant_ids', JSON.stringify(deletedList));
      }
    } catch {}

    // 2. Limpa todos os caches de localStorage deste tenant
    try {
      localStorage.removeItem(`saas_tenant_washes_${tenantId}`);
      localStorage.removeItem(`saas_tenant_appointments_${tenantId}`);
      localStorage.removeItem(`saas_tenant_wash_history_${tenantId}`);
      localStorage.removeItem(`saas_tenant_staff_${tenantId}`);
      localStorage.removeItem(`saas_tenant_products_${tenantId}`);

      const rawMap = localStorage.getItem('saas_company_email_map');
      if (rawMap) {
        const map: Record<string, any> = JSON.parse(rawMap);
        Object.keys(map).forEach(email => {
          if (map[email]?.tenantId === tenantId) delete map[email];
        });
        localStorage.setItem('saas_company_email_map', JSON.stringify(map));
      }

      const rawTenants = localStorage.getItem('saas_master_tenants');
      if (rawTenants) {
        const list: Tenant[] = JSON.parse(rawTenants);
        const filtered = list.filter(t => t.id !== tenantId);
        localStorage.setItem('saas_master_tenants', JSON.stringify(filtered));
      }
    } catch {}

    // 3. Remove do Firestore /tenants/{tenantId}
    const tenantDocRef = doc(db, 'tenants', tenantId);
    await deleteDoc(tenantDocRef);
    
    // 4. Remove também da coleção /empresas/{tenantId}
    try {
      await deleteDoc(doc(db, 'empresas', tenantId));
    } catch {}

    // 5. Remove qualquer usuário da coleção /usuarios associado a este tenant
    try {
      const qUsers = query(collection(db, 'usuarios'), where('tenantId', '==', tenantId));
      const userSnaps = await getDocs(qUsers);
      for (const uDoc of userSnaps.docs) {
        await deleteDoc(uDoc.ref);
      }
    } catch {}

    // 6. Registra na coleção de sistema no Firestore para sincronizar exclusão com outros computadores/celulares
    try {
      await setDoc(doc(db, 'system', 'deleted_tenants'), {
        lastDeletedId: tenantId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch {}
    
    console.log(`🗑️ [Firestore] Empresa ${tenantId} removida em definitivo de todas as coleções.`);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tenants/${tenantId}`);
    return false;
  }
}

/**
 * Exclui em definitivo todas as empresas fictícias/de demonstração do Firestore
 * (t-101 a t-108 e t-autoclean) das coleções /tenants e /empresas, e limpa o localStorage.
 */
export async function deleteDemoTenantsFromFirestore(): Promise<{ deletedCount: number }> {
  const demoIds = ['t-101', 't-102', 't-103', 't-104', 't-105', 't-106', 't-107', 't-108', 't-autoclean'];
  let deletedCount = 0;

  for (const id of demoIds) {
    try {
      await deleteDoc(doc(db, 'tenants', id));
      deletedCount++;
    } catch {}
    try {
      await deleteDoc(doc(db, 'empresas', id));
    } catch {}
  }

  // Limpa também as empresas demo do cache do localStorage do navegador
  try {
    const raw = localStorage.getItem('saas_master_tenants');
    if (raw) {
      const list: Tenant[] = JSON.parse(raw);
      const filtered = list.filter(t => !demoIds.includes(t.id) && !t.id.startsWith('t-10'));
      localStorage.setItem('saas_master_tenants', JSON.stringify(filtered));
    }
    const rawDeleted = localStorage.getItem('saas_deleted_tenant_ids');
    const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
    demoIds.forEach(id => {
      if (!deletedList.includes(id)) deletedList.push(id);
    });
    localStorage.setItem('saas_deleted_tenant_ids', JSON.stringify(deletedList));
  } catch {}

  console.log(`🧹 [Firestore] ${deletedCount} empresas fictícias/demo foram removidas em definitivo.`);
  return { deletedCount };
}

/**
 * Sincroniza em lote todas as empresas cadastradas no LocalStorage com as coleções
 * /tenants e /empresas do Firestore. Útil para quando o banco foi conectado posteriormente
 * ou quando ocorreram falhas temporárias de rede/permissão.
 */
export async function syncAllLocalTenantsToFirestore(tenants: Tenant[]): Promise<{
  successCount: number;
  errorCount: number;
  lastError: string | null;
}> {
  await ensureFirebaseAuthSession();
  let successCount = 0;
  let errorCount = 0;
  let lastError: string | null = null;

  for (const tenant of tenants) {
    try {
      const ok = await saveTenantToFirestore(tenant);
      if (ok) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (e: any) {
      errorCount++;
      lastError = e?.message || String(e);
    }
  }

  return { successCount, errorCount, lastError };
}

export async function loadTenantsFromFirestore(): Promise<Tenant[]> {
  try {
    const rawDeleted = typeof window !== 'undefined' ? localStorage.getItem('saas_deleted_tenant_ids') : null;
    const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];

    const querySnapshot = await getDocs(collection(db, 'tenants'));
    const loadedTenants: Tenant[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const id = data.id || docSnap.id;
      
      // Auto-purge se for demo ou estiver na lista de deletados
      if (id === 't-autoclean' || id.startsWith('t-10') || deletedList.includes(id)) {
        deleteDoc(docSnap.ref).catch(() => {});
        return;
      }

      const companyName = data.name || data.nomeFantasia || data.razaoSocial || 'Lava-Jato';
      const cleanSlug = computeTenantSlug(companyName, docSnap.id);
      const cleanDomain = (data.domain && !data.domain.toLowerCase().startsWith('t-'))
        ? data.domain
        : `${cleanSlug}.saas.com`;

      loadedTenants.push({
        id,
        name: companyName,
        code: data.code || 'LJ',
        domain: cleanDomain,
        plan: data.plan || 'Pro',
        status: data.status || 'Ativo',
        endUsersCount: data.endUsersCount || 1,
        maxUsers: data.maxUsers || 500,
        mrrAmount: data.mrrAmount || 0,
        createdAt: data.createdAt || new Date().toLocaleDateString('pt-BR'),
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone || '',
        ownerName: data.ownerName || '',
        lastActive: data.lastActive || 'Agora mesmo',
        razaoSocial: data.razaoSocial || undefined,
        nomeFantasia: data.nomeFantasia || undefined,
        cnpj: data.cnpj || undefined,
        inscricaoEstadual: data.inscricaoEstadual || undefined,
        address: data.address || undefined,
        logoUrl: data.logoUrl || undefined,
        tempPassword: data.tempPassword || undefined,
        isLifetime: data.isLifetime || data.plan === 'Vitalicio' || undefined,
        purchaseAmount: data.purchaseAmount || (data.plan === 'Vitalicio' ? 4000 : undefined)
      });
    });
    return loadedTenants;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'tenants');
    return [];
  }
}

export function subscribeToTenantsFirestore(callback: (tenants: Tenant[]) => void): () => void {
  try {
    const unsubscribe = onSnapshot(collection(db, 'tenants'), (snapshot) => {
      const rawDeleted = typeof window !== 'undefined' ? localStorage.getItem('saas_deleted_tenant_ids') : null;
      const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];

      const liveTenants: Tenant[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = data.id || docSnap.id;

        // Auto-purge definitivo: se for t-autoclean, demo t-10 ou deletado pelo usuário, apaga da nuvem e ignora
        if (id === 't-autoclean' || id.startsWith('t-10') || deletedList.includes(id)) {
          deleteDoc(docSnap.ref).catch(() => {});
          try {
            deleteDoc(doc(db, 'empresas', id)).catch(() => {});
          } catch {}
          return;
        }

        const companyName = data.name || data.nomeFantasia || data.razaoSocial || 'Lava-Jato';
        const cleanSlug = computeTenantSlug(companyName, docSnap.id);
        const cleanDomain = (data.domain && !data.domain.toLowerCase().startsWith('t-'))
          ? data.domain
          : `${cleanSlug}.saas.com`;

        liveTenants.push({
          id,
          name: companyName,
          code: data.code || 'LJ',
          domain: cleanDomain,
          plan: data.plan || 'Pro',
          status: data.status || 'Ativo',
          endUsersCount: data.endUsersCount || 1,
          maxUsers: data.maxUsers || 500,
          mrrAmount: data.mrrAmount || 0,
          createdAt: data.createdAt || new Date().toLocaleDateString('pt-BR'),
          contactEmail: data.contactEmail || '',
          contactPhone: data.contactPhone || '',
          ownerName: data.ownerName || '',
          lastActive: data.lastActive || 'Agora mesmo',
          razaoSocial: data.razaoSocial || undefined,
          nomeFantasia: data.nomeFantasia || undefined,
          cnpj: data.cnpj || undefined,
          inscricaoEstadual: data.inscricaoEstadual || undefined,
          address: data.address || undefined,
          logoUrl: data.logoUrl || undefined,
          tempPassword: data.tempPassword || undefined,
          isLifetime: data.isLifetime || data.plan === 'Vitalicio' || undefined,
          purchaseAmount: data.purchaseAmount || (data.plan === 'Vitalicio' ? 4000 : undefined)
        });
      });
      // Notifica sempre os ouvintes com a lista em tempo real atualizada
      callback(liveTenants);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'tenants');
    });
    return unsubscribe;
  } catch (err) {
    console.warn('Subscription to tenants error:', err);
    return () => {};
  }
}

/**
 * =================================================================
 * 2. GESTÃO DE CLIENTES NO FIREBASE AUTHENTICATION & FIRESTORE
 * Cria o usuário no Firebase Authentication ao se cadastrar.
 * =================================================================
 */

export interface ClientAuthResult {
  success: boolean;
  user?: User;
  errorMessage?: string;
  isExistingUser?: boolean;
}

export async function registerClientInFirebaseAuth(params: {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  tenantId?: string;
}): Promise<ClientAuthResult> {
  const { name, email, password, phone, tenantId } = params;

  const normalizedEmail = email.trim().toLowerCase();
  // Se não foi informada uma senha, usa uma senha padrão segura baseada na conta
  const effectivePassword = password && password.trim().length >= 6 
    ? password.trim() 
    : `Cliente#${normalizedEmail.split('@')[0]}123`;

  try {
    if (typeof window !== 'undefined') {
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (_) {}
    }
    let userRecord: User;

    try {
      // 1. Tenta criar usuário novo no Firebase Authentication com timeout seguro de 6s
      const userCredential = await withTimeout(
        createUserWithEmailAndPassword(auth, normalizedEmail, effectivePassword),
        6000
      );
      userRecord = userCredential.user;
      console.log(`🔐 [Firebase Auth] Novo usuário criado com sucesso: ${userRecord.uid} (${normalizedEmail})`);
    } catch (authErr: any) {
      // Se o e-mail já existe no Firebase Auth, tenta fazer login
      if (authErr.code === 'auth/email-already-in-use') {
        console.log(`ℹ️ [Firebase Auth] E-mail já cadastrado, efetuando login: ${normalizedEmail}`);
        try {
          const loginCred = await withTimeout(
            signInWithEmailAndPassword(auth, normalizedEmail, effectivePassword),
            6000
          );
          userRecord = loginCred.user;
        } catch (loginErr: any) {
          // Se falhar a senha, mas usuário já existe, prossegue com os dados cadastrais
          return {
            success: true,
            errorMessage: 'E-mail já cadastrado. Cadastro atualizado no lava-jato.',
            isExistingUser: true
          };
        }
      } else if (authErr.code === 'auth/invalid-email') {
        return {
          success: false,
          errorMessage: 'Formato de e-mail inválido.'
        };
      } else if (authErr.code === 'auth/weak-password') {
        return {
          success: false,
          errorMessage: 'A senha deve ter pelo menos 6 caracteres.'
        };
      } else {
        console.warn('Firebase Auth creation notice (prosseguindo de modo resiliente):', authErr);
        // Cria um fallback de identificação para não travar a experiência do usuário em navegadores móveis
        return {
          success: true,
          errorMessage: authErr.message
        };
      }
    }

    const clientDocId = userRecord ? userRecord.uid : `c-${Date.now()}`;

    // 👤 2. Grava PRIMEIRO na coleção oficial 'usuarios' para que a checagem de sessão no App.tsx não deslogue o usuário
    try {
      await withTimeout(
        setDoc(doc(db, 'usuarios', clientDocId), {
          uid: clientDocId,
          nome: name || 'Cliente',
          email: normalizedEmail,
          telefone: phone || '',
          role: 'cliente',
          tenantId: tenantId || 'autoclean',
          empresaId: tenantId || 'autoclean',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true }),
        4000
      );
    } catch (uErr) {
      console.warn('Gravação em /usuarios notice:', uErr);
    }

    // 3. Atualiza o Nome de Exibição (displayName) no Firebase Auth em segundo plano
    if (userRecord && name) {
      try {
        updateProfile(userRecord, { displayName: name }).catch(() => {});
      } catch (_) {}
    }

    // 4. Registra os dados cadastrais do cliente no Firestore
    const clientFirestoreData = removeUndefinedFields({
      uid: clientDocId,
      name: name || '',
      email: normalizedEmail,
      phone: phone || '',
      tenantId: tenantId || 'autoclean',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    try {
      // Salva no registro geral de clientes com timeout
      await withTimeout(
        setDoc(doc(db, 'clients', clientDocId), clientFirestoreData, { merge: true }),
        4000
      );
      
      // Se pertence a uma empresa, salva também na subcoleção do tenant
      if (tenantId) {
        await withTimeout(
          setDoc(doc(db, 'tenants', tenantId, 'clients', clientDocId), clientFirestoreData, { merge: true }),
          4000
        );
      }

      console.log(`✅ [Firestore] Perfil do cliente salvo nas coleções /clients e /usuarios/${clientDocId}`);
    } catch (dbErr) {
      handleFirestoreError(dbErr, OperationType.CREATE, `clients/${clientDocId}`);
    }

    return {
      success: true,
      user: userRecord
    };
  } catch (error: any) {
    console.error('Erro no registro do cliente no Firebase Auth:', error);
    return {
      success: false,
      errorMessage: error.message || 'Erro ao conectar ao Firebase Authentication.'
    };
  }
}

export interface TotemRegistrationParams {
  name: string;
  email: string;
  phone: string;
  password?: string;
  tenantId: string;
  vehicle: {
    tipo?: 'Carro' | 'Moto' | 'SUV' | 'Picape';
    marca?: string;
    modelo: string;
    cor?: string;
    placa: string;
    ano?: string;
  };
}

export interface TotemRegistrationResult {
  success: boolean;
  clientUid: string;
  errorMessage?: string;
  isExistingUser?: boolean;
}

/**
 * 📱 Cadastro de Cliente no Totem (Autoatendimento Tablet)
 * Registra o usuário no Firebase Auth sem deslogar ou alterar a sessão ativa do tablet/totem,
 * salva os dados cadastrais em /usuarios, /clientes e na subcoleção do lava-jato.
 */
export async function registerClientFromTotem(params: TotemRegistrationParams): Promise<TotemRegistrationResult> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const effectivePassword = params.password && params.password.trim().length >= 6
    ? params.password.trim()
    : `Cliente#${normalizedEmail.split('@')[0]}123`;
  
  let clientUid = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let isExisting = false;

  // 1. Cria credenciais de acesso no Firebase Auth usando uma instância secundária isolada
  // (Isso impede que o totem seja deslogado ou que a sessão do tablet mude para o cliente!)
  try {
    const secondaryAppName = 'WashAutoTotemAuthApp';
    let secondaryApp = getApps().find(a => a.name === secondaryAppName);
    if (!secondaryApp) {
      secondaryApp = initializeApp({
        apiKey: firebaseConfig.apiKey || 'AIzaSyBkoQseuHZuIZDKFTRtpgqOlI7BCVP95yY',
        authDomain: firebaseConfig.authDomain || 'meulavajatogestaoparalavajato.firebaseapp.com',
        projectId: firebaseConfig.projectId || 'meulavajatogestaoparalavajato',
        storageBucket: firebaseConfig.storageBucket || 'meulavajatogestaoparalavajato.firebasestorage.app',
        messagingSenderId: firebaseConfig.messagingSenderId || '372328060896',
        appId: firebaseConfig.appId || '1:372328060896:web:596b7467604aba2a78bd85'
      }, secondaryAppName);
    }
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await withTimeout(
        createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, effectivePassword),
        6000
      );
      if (cred && cred.user) {
        clientUid = cred.user.uid;
        updateProfile(cred.user, { displayName: params.name }).catch(() => {});
        await signOut(secondaryAuth);
      }
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-in-use') {
        isExisting = true;
        try {
          const loginCred = await withTimeout(
            signInWithEmailAndPassword(secondaryAuth, normalizedEmail, effectivePassword),
            6000
          );
          if (loginCred && loginCred.user) {
            clientUid = loginCred.user.uid;
            await signOut(secondaryAuth);
          }
        } catch (_) {
          // Mantém clientUid gerado
        }
      } else {
        console.warn('[Totem] Aviso ao registrar no Auth secundário:', authErr);
      }
    }
  } catch (secErr) {
    console.warn('[Totem] Erro no app secundário Auth:', secErr);
  }

  // 2. Grava na coleção 'usuarios' para permitir login no app mobile
  try {
    const userPayload = removeUndefinedFields({
      uid: clientUid,
      nome: params.name,
      email: normalizedEmail,
      telefone: params.phone || '',
      role: 'cliente',
      tenantId: params.tenantId,
      empresaId: params.tenantId,
      origem: 'totem',
      veiculos: [{
        tipo: params.vehicle.tipo || 'Carro',
        marca: params.vehicle.marca || '',
        modelo: params.vehicle.modelo || '',
        cor: params.vehicle.cor || '',
        placa: (params.vehicle.placa || '').toUpperCase().trim(),
        ano: params.vehicle.ano || new Date().getFullYear().toString()
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await withTimeout(setDoc(doc(db, 'usuarios', clientUid), userPayload, { merge: true }), 5000);
  } catch (uErr) {
    console.warn('[Totem] Erro ao gravar em /usuarios:', uErr);
  }

  // 3. Grava na coleção 'clientes' (utilizada pela visualização de clientes do lava-jato)
  try {
    const cleanTId = cleanDocId(params.tenantId);
    const totemClientPayload = removeUndefinedFields({
      id: clientUid,
      nomeCompleto: params.name,
      telefone: params.phone || '',
      email: normalizedEmail,
      empresa: params.tenantId,
      tenantId: params.tenantId,
      empresaId: params.tenantId,
      origem: 'Totem de Autoatendimento',
      veiculos: [{
        tipo: params.vehicle.tipo || 'Carro',
        marca: params.vehicle.marca || '',
        modelo: params.vehicle.modelo || '',
        cor: params.vehicle.cor || '',
        placa: (params.vehicle.placa || '').toUpperCase().trim(),
        ano: params.vehicle.ano || new Date().getFullYear().toString()
      }],
      cep: '',
      endereco: '',
      bairro: '',
      cidade: '',
      estado: '',
      dataCadastro: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await withTimeout(
      setDoc(doc(db, 'clientes', clientUid), totemClientPayload, { merge: true }),
      5000
    );

    // Salva também na subcoleção do tenant para consulta garantida
    await withTimeout(
      setDoc(doc(db, 'tenants', cleanTId, 'clients', clientUid), totemClientPayload, { merge: true }),
      5000
    );
  } catch (cErr) {
    console.warn('[Totem] Erro ao adicionar em /clientes:', cErr);
  }

  // 4. Grava na subcoleção do tenant /tenants/{tenantId}/clients/{clientUid}
  try {
    const cleanTId = cleanDocId(params.tenantId);
    await withTimeout(
      setDoc(doc(db, 'tenants', cleanTId, 'clients', clientUid), removeUndefinedFields({
        uid: clientUid,
        id: clientUid,
        name: params.name,
        nomeCompleto: params.name,
        email: normalizedEmail,
        phone: params.phone,
        telefone: params.phone,
        vehicle: params.vehicle,
        veiculos: [{
          tipo: params.vehicle.tipo || 'Carro',
          marca: params.vehicle.marca || '',
          modelo: params.vehicle.modelo || '',
          cor: params.vehicle.cor || '',
          placa: (params.vehicle.placa || '').toUpperCase().trim(),
          ano: params.vehicle.ano || new Date().getFullYear().toString()
        }],
        tenantId: params.tenantId,
        empresa: params.tenantId,
        empresaId: params.tenantId,
        origem: 'Totem de Autoatendimento',
        dataCadastro: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }), { merge: true }),
      5000
    );
  } catch (tErr) {
    console.warn('[Totem] Erro ao gravar subcoleção /tenants/clients:', tErr);
  }

  // 5. Salva mapeamento de e-mail para auto-login e vínculo rápido
  saveClientEmailMapping(normalizedEmail, params.tenantId, params.tenantId, params.name);

  // 6. Armazena no cache local do tenant para sincronização imediata
  try {
    const key = `saas_totem_clients_${params.tenantId}`;
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    const newRecord = {
      id: clientUid,
      name: params.name,
      email: normalizedEmail,
      phone: params.phone,
      vehicle: params.vehicle,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify([newRecord, ...list.filter((x: any) => x.email !== normalizedEmail)]));
    window.dispatchEvent(new Event('storage'));
  } catch {}

  // 7. 🚀 Dispara Notificação Push em Segundo Plano (alerta no navegador mesmo com a aba fechada)
  try {
    sendTotemPushNotification({
      tenantId: params.tenantId,
      clientName: params.name,
      phone: params.phone,
      vehicle: `${params.vehicle.modelo || ''} (${(params.vehicle.placa || '').toUpperCase()})`,
      plate: (params.vehicle.placa || '').toUpperCase()
    }).catch(pushErr => console.warn('[Totem Push Trigger] Falha assíncrona ao despachar:', pushErr));
  } catch (pushErr) {
    console.warn('[Totem Push Trigger notice]:', pushErr);
  }

  return {
    success: true,
    clientUid,
    isExistingUser: isExisting
  };
}

/**
 * =================================================================
 * 3. GESTÃO DE USUÁRIOS NO FIRESTORE (/usuarios)
 * Sincronização direta na nuvem para fim do isolamento entre dispositivos.
 * =================================================================
 */

export async function saveUsuarioFirestore(uid: string, data: any): Promise<void> {
  try {
    const payload = removeUndefinedFields({
      uid,
      ...data,
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'usuarios', uid), payload, { merge: true });
    console.log(`✅ [Firestore] Documento /usuarios/${uid} atualizado com sucesso.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `usuarios/${uid}`);
  }
}

export async function getUsuarioFirestore(uid: string): Promise<any | null> {
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `usuarios/${uid}`);
    return null;
  }
}

export async function deleteUsuarioFirestore(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'usuarios', uid));
    console.log(`🗑️ [Firestore] Documento /usuarios/${uid} excluído.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `usuarios/${uid}`);
  }
}

/**
 * Cadastra e autentica Empresa (Lava-Jato) no Firebase Auth e no Firestore (/usuarios e /tenants)
 */
export async function registerEmpresaInFirebaseAuth(params: {
  tenant: Tenant;
  email: string;
  password?: string;
  name?: string;
}): Promise<{ success: boolean; user?: User; errorMessage?: string }> {
  const { tenant, email, password, name } = params;
  const normalizedEmail = email.trim().toLowerCase();
  const effectivePassword = password && password.trim().length >= 6 
    ? password.trim() 
    : 'Admin@' + (tenant.code || 'LJ') + '123456';

  try {
    if (typeof window !== 'undefined') {
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (_) {}
    }
    let userRecord: User;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, effectivePassword);
      userRecord = userCredential.user;
      console.log(`🔐 [Firebase Auth] Conta de Empresa criada: ${userRecord.uid} (${normalizedEmail})`);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        const loginCred = await signInWithEmailAndPassword(auth, normalizedEmail, effectivePassword);
        userRecord = loginCred.user;
      } else {
        throw err;
      }
    }

    if (userRecord && (name || tenant.name)) {
      try {
        await updateProfile(userRecord, { displayName: name || tenant.name });
      } catch (_) {}
    }

    // Salva empresa no Firestore /tenants
    await saveTenantToFirestore(tenant);

    // Salva perfil na coleção oficial /usuarios para verificação de sessão e Dashboard
    await setDoc(doc(db, 'usuarios', userRecord.uid), {
      uid: userRecord.uid,
      nome: name || tenant.ownerName || tenant.name,
      email: normalizedEmail,
      role: 'empresa',
      tenantId: tenant.id,
      empresaId: tenant.id,
      empresaNome: tenant.name,
      empresa: tenant,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`✅ [Firestore] Empresa registrada no Auth e /usuarios/${userRecord.uid}`);
    return { success: true, user: userRecord };
  } catch (error: any) {
    console.error('Erro ao registrar empresa no Firebase Auth:', error);
    return { success: false, errorMessage: error.message || 'Falha ao registrar empresa.' };
  }
}

/**
 * Autentica Empresa (Lava-Jato) no Firebase Auth e sincroniza com /usuarios
 */
export async function loginEmpresaInFirebaseAuth(
  email: string,
  password: string
): Promise<{
  success: boolean;
  user?: User;
  tenant?: Tenant;
  errorMessage?: string;
  isTempPasswordMatch?: boolean;
}> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();

  // 1. Tenta autenticação direta no Firebase Auth com persistência por guia
  try {
    if (typeof window !== 'undefined') {
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (_) {}
    }
    const cred = await signInWithEmailAndPassword(auth, normalizedEmail, trimmedPassword);
    
    // Garante que o documento /usuarios/{uid} está preenchido
    try {
      const uDocRef = doc(db, 'usuarios', cred.user.uid);
      const uSnap = await getDoc(uDocRef);
      if (!uSnap.exists()) {
        const tenant = await findTenantByCompanyEmailFirestore(normalizedEmail);
        if (tenant) {
          await setDoc(uDocRef, {
            uid: cred.user.uid,
            nome: tenant.ownerName || tenant.name,
            email: normalizedEmail,
            role: 'empresa',
            tenantId: tenant.id,
            empresaId: tenant.id,
            empresaNome: tenant.name,
            empresa: tenant,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      }
    } catch (_) {}

    return { success: true, user: cred.user };
  } catch (error: any) {
    console.log('[Auth Empresa] Falha inicial Firebase Auth:', error.code);

    // 2. Busca a empresa correspondente no Firestore /tenants
    let matchedTenant: Tenant | null = null;
    try {
      matchedTenant = await findTenantByCompanyEmailFirestore(normalizedEmail);
    } catch (e) {
      console.warn('[Auth Empresa] Erro ao buscar empresa no Firestore:', e);
    }

    // Se não encontrou no Firestore, busca no cache local
    if (!matchedTenant && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('saas_master_tenants');
        if (raw) {
          const list: Tenant[] = JSON.parse(raw);
          matchedTenant = list.find(t => 
            (t.contactEmail && t.contactEmail.trim().toLowerCase() === normalizedEmail) ||
            (t.domain && normalizedEmail.includes(t.domain.replace('.saas.com', '')))
          ) || null;
        }
      } catch (_) {}
    }

    if (matchedTenant) {
      const storedCustomPwd = typeof localStorage !== 'undefined'
        ? localStorage.getItem(`saas_tenant_custom_password_${matchedTenant.id}`)
        : null;
      
      const expectedPwd = matchedTenant.tempPassword || storedCustomPwd || `Auto#${(matchedTenant.code || 'LJ').toUpperCase()}123`;

      // Verifica se a senha digitada confere com a senha da empresa cadastrada no Firestore ou local
      if (trimmedPassword === expectedPwd || trimmedPassword === matchedTenant.tempPassword || trimmedPassword === storedCustomPwd) {
        console.log(`✅ [Auth Empresa] Senha confirmada com a ficha da empresa: ${matchedTenant.name}`);

        // Tenta sincronizar criando a conta no Firebase Auth com esta senha para os próximos logins
        try {
          const newCred = await createUserWithEmailAndPassword(auth, normalizedEmail, trimmedPassword);
          await setDoc(doc(db, 'usuarios', newCred.user.uid), {
            uid: newCred.user.uid,
            nome: matchedTenant.ownerName || matchedTenant.name,
            email: normalizedEmail,
            role: 'empresa',
            tenantId: matchedTenant.id,
            empresaId: matchedTenant.id,
            empresaNome: matchedTenant.name,
            empresa: matchedTenant,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          return { success: true, user: newCred.user, tenant: matchedTenant, isTempPasswordMatch: true };
        } catch (createErr: any) {
          console.log('[Auth Empresa] Conta já existe no Auth ou sincronização paralela:', createErr.code);
          return { success: true, tenant: matchedTenant, isTempPasswordMatch: true };
        }
      }
    }

    // Se a senha não conferiu:
    let msg = 'E-mail corporativo ou senha incorretos.';
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
      msg = 'E-mail corporativo ou senha incorretos. Verifique os dados digitados ou use a recuperação de senha.';
    } else if (error.code === 'auth/invalid-email') {
      msg = 'Formato de e-mail inválido.';
    } else if (error.code === 'auth/too-many-requests') {
      msg = 'Muitas tentativas sem sucesso. Aguarde alguns instantes por segurança.';
    }

    return { success: false, errorMessage: msg };
  }
}

/**
 * Autentica Super Admin no Firebase Auth e garante documento em /usuarios
 */
export async function loginSuperAdminInFirebaseAuth(email: string, password: string): Promise<{ success: boolean; user?: User; errorMessage?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    if (typeof window !== 'undefined') {
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (_) {}
    }
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      } else {
        throw err;
      }
    }

    await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
      uid: userCredential.user.uid,
      nome: 'Super Admin',
      email: normalizedEmail,
      role: 'admin',
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return { success: true, user: userCredential.user };
  } catch (error: any) {
    return { success: false, errorMessage: error.message || 'Falha ao autenticar Super Admin.' };
  }
}


export interface ClientSaveResult {
  success: boolean;
  docId?: string;
  error?: string;
}

/**
 * Salva a Ficha Completa de Cadastro do Cliente (com Endereço e Veículos Dinâmicos)
 * nas coleções do Firestore (/clients, /clientes e /tenants/{tenantId}/clients).
 * Executa as escritas em paralelo e aguarda a confirmação da nuvem com timeout resiliente.
 */
export async function saveClientFullRegistration(
  tenantId: string, 
  data: {
    name: string;
    email?: string;
    phone?: string;
    cep?: string;
    address?: string;
    neighborhood?: string;
    city?: string;
    stateUf?: string;
    vehicles?: any[];
  }
): Promise<ClientSaveResult> {
  try {
    const cleanPhoneDigits = (data.phone || '').replace(/\D/g, '');
    const cleanId = cleanPhoneDigits && cleanPhoneDigits.length >= 8
      ? cleanPhoneDigits
      : (data.email ? data.email.toLowerCase().replace(/[^a-z0-9]/g, '_') : `c-${Date.now()}`);
    
    const payload = removeUndefinedFields({
      ...data,
      id: cleanId,
      tenantId: tenantId || 'default',
      updatedAt: new Date().toISOString()
    });

    // Formato compatível com a tela de Clientes da Empresa (/clientes)
    const clienteWorkspacePayload = removeUndefinedFields({
      id: cleanId,
      empresa: tenantId || 'default',
      tenantId: tenantId || 'default',
      empresaId: tenantId || 'default',
      nomeCompleto: data.name,
      email: data.email || '',
      telefone: data.phone || '',
      cep: data.cep || '',
      endereco: data.address || '',
      bairro: data.neighborhood || '',
      cidade: data.city || '',
      estado: data.stateUf || '',
      origem: 'Aplicativo / PWA',
      veiculos: Array.isArray(data.vehicles) && data.vehicles.length > 0 ? data.vehicles.map(v => ({
        tipo: v.type ? (String(v.type).toLowerCase() === 'moto' ? 'Moto' : 'Carro') : 'Carro',
        marca: v.brand || '',
        modelo: v.model || '',
        cor: v.color || '',
        ano: v.year || '',
        placa: (v.plate || '').toUpperCase()
      })) : [],
      dataCadastro: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const cleanTId = cleanDocId(tenantId || 'default');

    // Agrupa todas as escritas no Firestore em paralelo
    const writes: Promise<any>[] = [
      setDoc(doc(db, 'clients', cleanId), payload, { merge: true }),
      setDoc(doc(db, 'clientes', cleanId), clienteWorkspacePayload, { merge: true })
    ];

    if (tenantId) {
      writes.push(setDoc(doc(db, 'tenants', cleanTId, 'clients', cleanId), clienteWorkspacePayload, { merge: true }));
    }

    // Se houver usuário autenticado no Firebase Auth, garante a ficha em /usuarios
    if (auth.currentUser?.uid) {
      writes.push(
        setDoc(doc(db, 'usuarios', auth.currentUser.uid), removeUndefinedFields({
          uid: auth.currentUser.uid,
          nome: data.name,
          email: (data.email || auth.currentUser.email || '').toLowerCase().trim(),
          telefone: data.phone || '',
          role: 'cliente',
          tenantId: tenantId || 'default',
          empresaId: tenantId || 'default',
          clientInfo: payload,
          updatedAt: new Date().toISOString()
        }), { merge: true })
      );
    }

    // Aguarda confirmação de escrita de todas as coleções com timeout resiliente
    await withTimeout(Promise.all(writes), 6500);
    console.log(`✅ [Firestore] Ficha de cadastro do cliente e veículos confirmada nas coleções: ${cleanId}`);
    return { success: true, docId: cleanId };

  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `clients/${tenantId}`);
    console.warn('Aviso de timeout ou conectividade na escrita do Firestore:', err);
    return { 
      success: false, 
      error: err?.message || 'A conexão com o banco de dados expirou ao confirmar o cadastro.' 
    };
  }
}

export async function loginClientInFirebaseAuth(email: string, password?: string): Promise<ClientAuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const effectivePassword = password && password.trim().length >= 6 
    ? password.trim() 
    : `Cliente#${normalizedEmail.split('@')[0]}123`;

  try {
    if (typeof window !== 'undefined') {
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (_) {}
    }
    const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, effectivePassword);
    console.log(`🔓 [Firebase Auth] Usuário autenticado com sucesso: ${userCredential.user.uid}`);

    // Garante sincronização em /usuarios caso ainda não conste
    try {
      const uDoc = await getDoc(doc(db, 'usuarios', userCredential.user.uid));
      if (!uDoc.exists()) {
        await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
          uid: userCredential.user.uid,
          nome: userCredential.user.displayName || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          role: 'cliente',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (_) {}

    return {
      success: true,
      user: userCredential.user
    };

  } catch (error: any) {
    // Se o usuário não foi encontrado, tenta criar automaticamente para comodidade
    if (error.code === 'auth/user-not-found') {
      return await registerClientInFirebaseAuth({
        name: normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password: effectivePassword
      });
    }
    return {
      success: false,
      errorMessage: error.message || 'Falha ao autenticar.'
    };
  }
}

export async function logoutFirebaseAuth(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('SignOut error:', err);
  }
}

/**
 * =================================================================
 * 4.1 SISTEMA DE RECUPERAÇÃO DE SENHA (EMPRESAS & CLIENTES)
 * Envia e-mail oficial de redefinição pelo Firebase Authentication e
 * gera senha temporária de emergência para donos de lava-jato.
 * =================================================================
 */

export interface PasswordRecoveryResult {
  success: boolean;
  emailSent: boolean;
  message: string;
  userType: 'cliente' | 'empresa' | 'admin';
  tenant?: Tenant | null;
  tenantName?: string;
  tempPassword?: string;
  tempPasswordGenerated?: string;
}

export async function sendUserPasswordResetEmail(email: string): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { success: false, message: 'Por favor, informe um endereço de e-mail válido.' };
  }
  try {
    await withTimeout(sendPasswordResetEmail(auth, normalizedEmail), 7000);
    return {
      success: true,
      message: `Link oficial de redefinição de senha enviado para ${normalizedEmail}. Verifique sua caixa de entrada e pasta de spam.`
    };
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      return { success: false, message: 'Nenhuma conta cadastrada encontrada com este e-mail no Firebase Auth.' };
    }
    if (err.code === 'auth/invalid-email') {
      return { success: false, message: 'Formato de e-mail inválido.' };
    }
    if (err.code === 'auth/too-many-requests') {
      return { success: false, message: 'Muitas solicitações recentes. Aguarde alguns instantes antes de tentar novamente.' };
    }
    return { success: false, message: err.message || 'Falha ao enviar e-mail de redefinição.' };
  }
}

export async function requestPasswordRecovery(
  email: string,
  userType: 'cliente' | 'empresa' | 'admin'
): Promise<PasswordRecoveryResult> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return {
      success: false,
      emailSent: false,
      message: 'Por favor, informe um endereço de e-mail válido.',
      userType
    };
  }

  let emailSent = false;
  let authErrorMessage: string | null = null;

  // 1. Dispara o e-mail oficial de redefinição via Firebase Authentication
  try {
    await withTimeout(sendPasswordResetEmail(auth, normalizedEmail), 7000);
    emailSent = true;
    console.log(`✉️ [Firebase Auth] E-mail de recuperação enviado para: ${normalizedEmail}`);
  } catch (authErr: any) {
    console.warn('[Firebase Auth] Aviso ao enviar e-mail de redefinição inicial:', authErr);
    if (authErr.code === 'auth/user-not-found') {
      authErrorMessage = 'Conta não localizada diretamente no Firebase Auth.';
    } else if (authErr.code === 'auth/invalid-email') {
      return {
        success: false,
        emailSent: false,
        message: 'O formato do e-mail é inválido. Por favor, verifique a digitação.',
        userType
      };
    } else if (authErr.code === 'auth/too-many-requests') {
      return {
        success: false,
        emailSent: false,
        message: 'Muitas solicitações recentes. Por segurança, aguarde alguns instantes antes de tentar novamente.',
        userType
      };
    } else {
      authErrorMessage = authErr.message || 'Falha ao despachar solicitação para o servidor de e-mail.';
    }
  }

  // 2. Fluxo para DONO DA EMPRESA (LAVA-JATO)
  if (userType === 'empresa') {
    let matchedTenant: Tenant | null = null;

    // Busca nas empresas locais em memória / localStorage
    try {
      const rawTenants = typeof localStorage !== 'undefined' ? localStorage.getItem('saas_master_tenants') : null;
      if (rawTenants) {
        const list: Tenant[] = JSON.parse(rawTenants);
        matchedTenant = list.find(t => 
          (t.contactEmail && t.contactEmail.trim().toLowerCase() === normalizedEmail) ||
          (t.domain && normalizedEmail.endsWith(`@${t.domain.replace('.saas.com', '')}.com`))
        ) || null;
      }
    } catch (_) {}

    // Busca no Firestore se ainda não localizou
    if (!matchedTenant) {
      try {
        const snap = await findTenantByCompanyEmailFirestore(normalizedEmail);
        if (snap) matchedTenant = snap;
      } catch (_) {}
    }

    if (matchedTenant) {
      // Gera nova senha temporária de emergência para acesso imediato sem travar o gestor
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const newTempPassword = `Auto#${(matchedTenant.code || 'LJ').toUpperCase()}${randomDigits}`;
      
      const updatedTenant: Tenant = {
        ...matchedTenant,
        tempPassword: newTempPassword
      };

      try {
        await saveTenantToFirestore(updatedTenant);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`saas_tenant_custom_password_${matchedTenant.id}`, newTempPassword);
          const rawTenants = localStorage.getItem('saas_master_tenants');
          if (rawTenants) {
            const list: Tenant[] = JSON.parse(rawTenants);
            const updatedList = list.map(t => t.id === matchedTenant!.id ? updatedTenant : t);
            localStorage.setItem('saas_master_tenants', JSON.stringify(updatedList));
          }
        }
      } catch (saveErr) {
        console.warn('Erro ao atualizar senha temporária no Firestore:', saveErr);
      }

      // Se o e-mail ainda não foi enviado porque a conta não existia no Firebase Auth,
      // sincroniza no Auth e dispara sendPasswordResetEmail
      if (!emailSent) {
        try {
          await createUserWithEmailAndPassword(auth, normalizedEmail, newTempPassword);
          await sendPasswordResetEmail(auth, normalizedEmail);
          emailSent = true;
          console.log(`✉️ [Firebase Auth] Conta provisionada e link de redefinição enviado para: ${normalizedEmail}`);
        } catch (subErr) {
          console.log('Sincronização de usuário no Firebase Auth notice:', subErr);
        }
      }

      const tenantDisplayName = matchedTenant.nomeFantasia || matchedTenant.name || 'Lava-Jato';

      return {
        success: true,
        emailSent,
        message: emailSent
          ? `Link oficial de redefinição enviado para ${normalizedEmail}! Abra seu e-mail para cadastrar sua nova senha. Você também pode usar a senha temporária abaixo para entrar agora.`
          : `Empresa "${tenantDisplayName}" localizada! Geramos uma nova senha temporária para seu login imediato.`,
        userType: 'empresa',
        tenant: updatedTenant,
        tenantName: tenantDisplayName,
        tempPassword: newTempPassword,
        tempPasswordGenerated: newTempPassword
      };
    }

    if (emailSent) {
      return {
        success: true,
        emailSent: true,
        message: `Enviamos o link oficial de redefinição de senha para ${normalizedEmail}. Acesse seu e-mail para criar uma nova senha.`,
        userType: 'empresa'
      };
    }

    return {
      success: false,
      emailSent: false,
      message: 'Nenhum Lava-Jato / Empresa cadastrado com este e-mail corporativo. Verifique a digitação ou cadastre sua empresa.',
      userType: 'empresa'
    };
  }

  // 3. Fluxo para CLIENTE
  if (userType === 'cliente') {
    if (emailSent) {
      return {
        success: true,
        emailSent: true,
        message: `Enviamos o link de redefinição de senha para ${normalizedEmail}. Abra sua caixa de entrada (ou pasta de spam) e clique no link para definir sua nova senha.`,
        userType: 'cliente'
      };
    }

    // Se falhou no Auth inicial, verifica se o cliente possui ficha cadastral no Firestore
    let clientFound = false;
    try {
      const q = query(collection(db, 'clients'), where('email', '==', normalizedEmail), limit(1));
      const snaps = await getDocs(q);
      if (!snaps.empty) {
        clientFound = true;
      } else {
        const qClientes = query(collection(db, 'clientes'), where('email', '==', normalizedEmail), limit(1));
        const snapsClientes = await getDocs(qClientes);
        if (!snapsClientes.empty) clientFound = true;
      }
    } catch (_) {}

    if (clientFound) {
      try {
        const fallbackPwd = `Cli#${Math.random().toString(36).substring(2, 8)}789!`;
        await createUserWithEmailAndPassword(auth, normalizedEmail, fallbackPwd);
        await sendPasswordResetEmail(auth, normalizedEmail);
        emailSent = true;
        return {
          success: true,
          emailSent: true,
          message: `Cadastro de cliente localizado! Enviamos o link oficial de redefinição de senha para ${normalizedEmail}. Abra sua caixa de entrada (ou pasta de spam) para definir sua nova senha.`,
          userType: 'cliente'
        };
      } catch (authCreateErr: any) {
        console.warn('Erro ao criar usuário cliente no Firebase Auth:', authCreateErr);
      }
    }

    return {
      success: false,
      emailSent: false,
      message: authErrorMessage || 'Nenhuma conta de cliente foi encontrada com este e-mail. Verifique o endereço digitado ou realize um novo cadastro no lava-jato.',
      userType: 'cliente'
    };
  }

  // 4. Fluxo para SUPER ADMIN
  if (userType === 'admin') {
    if (emailSent) {
      return {
        success: true,
        emailSent: true,
        message: `Instruções de recuperação enviadas para o e-mail Master (${normalizedEmail}). Verifique sua caixa de entrada.`,
        userType: 'admin'
      };
    }
    return {
      success: false,
      emailSent: false,
      message: authErrorMessage || 'Não foi possível enviar a recuperação para o Super Admin.',
      userType: 'admin'
    };
  }

  return {
    success: emailSent,
    emailSent,
    message: emailSent ? `Link de recuperação enviado para ${normalizedEmail}.` : (authErrorMessage || 'Falha ao processar solicitação.'),
    userType
  };
}

/**
 * =================================================================
 * 5. ASSOCIAÇÃO AUTOMÁTICA DE E-MAILS (EMPRESAS & CLIENTES)
 * Vincula e-mail corporativo ao subdomínio da empresa e o e-mail do
 * cliente ao lava-jato em que ele foi cadastrado.
 * =================================================================
 */

export interface EmailMapping {
  email: string;
  tenantId: string;
  subdomain: string;
  tenantName: string;
  type: 'empresa' | 'cliente';
  updatedAt: string;
}

export function saveCompanyEmailMapping(email: string, tenant: Tenant): void {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    const raw = localStorage.getItem('saas_company_email_map');
    const map: Record<string, EmailMapping> = raw ? JSON.parse(raw) : {};
    const slug = (tenant.domain || '').toLowerCase().replace('.saas.com', '').replace('.seusaas.com', '').replace(/[^a-z0-9-]/g, '').trim() || tenant.id;
    map[cleanEmail] = {
      email: cleanEmail,
      tenantId: tenant.id,
      subdomain: slug,
      tenantName: tenant.name || 'Empresa',
      type: 'empresa',
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('saas_company_email_map', JSON.stringify(map));
  } catch (e) {
    console.warn('saveCompanyEmailMapping error:', e);
  }
}

export function saveClientEmailMapping(email: string, tenantId: string, subdomain: string, tenantName: string): void {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    const raw = localStorage.getItem('saas_client_tenant_map');
    const map: Record<string, EmailMapping> = raw ? JSON.parse(raw) : {};
    const cleanSub = (subdomain || '').toLowerCase().replace('.saas.com', '').replace(/[^a-z0-9-]/g, '').trim();
    map[cleanEmail] = {
      email: cleanEmail,
      tenantId,
      subdomain: cleanSub || 'autoclean',
      tenantName: tenantName || 'Lava-Jato',
      type: 'cliente',
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('saas_client_tenant_map', JSON.stringify(map));
  } catch (e) {
    console.warn('saveClientEmailMapping error:', e);
  }
}

export function getCompanyEmailMapping(email: string): EmailMapping | null {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;
    const raw = localStorage.getItem('saas_company_email_map');
    if (!raw) return null;
    const map: Record<string, EmailMapping> = JSON.parse(raw);
    return map[cleanEmail] || null;
  } catch (e) {
    return null;
  }
}

export function getClientEmailMapping(email: string): EmailMapping | null {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;
    
    // 1. Tenta mapa direto de clientes
    const raw = localStorage.getItem('saas_client_tenant_map');
    if (raw) {
      const map: Record<string, EmailMapping> = JSON.parse(raw);
      if (map[cleanEmail]) return map[cleanEmail];
    }
    
    // 2. Tenta varrer os perfis locais saas_client_profile_[tenantId]
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('saas_client_profile_')) {
        try {
          const profile = JSON.parse(localStorage.getItem(key) || '{}');
          if (profile.email && profile.email.trim().toLowerCase() === cleanEmail) {
            const tenantId = key.replace('saas_client_profile_', '');
            return {
              email: cleanEmail,
              tenantId,
              subdomain: '',
              tenantName: '',
              type: 'cliente',
              updatedAt: new Date().toISOString()
            };
          }
        } catch (_) {}
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function findTenantByCompanyEmailFirestore(email: string): Promise<Tenant | null> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    // 1. Busca direta por contactEmail
    const q = query(
      collection(db, 'tenants'),
      where('contactEmail', '==', cleanEmail),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const docData = docSnap.data();
      const compName = docData.name || docData.nomeFantasia || docData.razaoSocial || 'Lava-Jato';
      const cleanSlug = computeTenantSlug(compName, docSnap.id);
      return {
        id: docData.id || docSnap.id,
        name: compName,
        code: docData.code || 'LJ',
        domain: (docData.domain && !docData.domain.toLowerCase().startsWith('t-')) ? docData.domain : `${cleanSlug}.saas.com`,
        plan: docData.plan || 'Pro',
        status: docData.status || 'Ativo',
        endUsersCount: docData.endUsersCount ?? 1,
        maxUsers: docData.maxUsers ?? 500,
        mrrAmount: docData.mrrAmount ?? 0,
        createdAt: docData.createdAt || '',
        contactEmail: docData.contactEmail || cleanEmail,
        contactPhone: docData.contactPhone || '',
        ownerName: docData.ownerName || '',
        lastActive: 'Agora mesmo',
        logoUrl: docData.logoUrl || undefined,
        address: docData.address || undefined,
        tempPassword: docData.tempPassword || undefined,
        nomeFantasia: docData.nomeFantasia || undefined,
        razaoSocial: docData.razaoSocial || undefined,
        cnpj: docData.cnpj || undefined,
        inscricaoEstadual: docData.inscricaoEstadual || undefined
      };
    }

    // 2. Fallback: Varre tenants caso o e-mail esteja salvo em outro campo ou com casing diferente
    try {
      const allTenantsSnap = await getDocs(collection(db, 'tenants'));
      for (const dSnap of allTenantsSnap.docs) {
        const d = dSnap.data();
        const candEmail = (d.contactEmail || d.email || d.ownerEmail || '').trim().toLowerCase();
        if (candEmail && candEmail === cleanEmail) {
          const compName = d.name || d.nomeFantasia || d.razaoSocial || 'Lava-Jato';
          const cleanSlug = computeTenantSlug(compName, dSnap.id);
          return {
            id: d.id || dSnap.id,
            name: compName,
            code: d.code || 'LJ',
            domain: (d.domain && !d.domain.toLowerCase().startsWith('t-')) ? d.domain : `${cleanSlug}.saas.com`,
            plan: d.plan || 'Pro',
            status: d.status || 'Ativo',
            endUsersCount: d.endUsersCount ?? 1,
            maxUsers: d.maxUsers ?? 500,
            mrrAmount: d.mrrAmount ?? 0,
            createdAt: d.createdAt || '',
            contactEmail: d.contactEmail || cleanEmail,
            contactPhone: d.contactPhone || '',
            ownerName: d.ownerName || '',
            lastActive: 'Agora mesmo',
            logoUrl: d.logoUrl || undefined,
            address: d.address || undefined,
            tempPassword: d.tempPassword || undefined,
            nomeFantasia: d.nomeFantasia || undefined,
            razaoSocial: d.razaoSocial || undefined,
            cnpj: d.cnpj || undefined,
            inscricaoEstadual: d.inscricaoEstadual || undefined
          };
        }
      }
    } catch (_) {}

    return null;
  } catch (e) {
    console.warn('findTenantByCompanyEmailFirestore error:', e);
    return null;
  }
}

export async function findTenantIdByClientEmailFirestore(email: string): Promise<{ tenantId: string; clientName?: string } | null> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;
    const q = query(
      collection(db, 'clients'),
      where('email', '==', cleanEmail),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      if (docData.tenantId) {
        return {
          tenantId: docData.tenantId,
          clientName: docData.name
        };
      }
    }
    return null;
  } catch (e) {
    console.warn('findTenantIdByClientEmailFirestore error:', e);
    return null;
  }
}

/**
 * =================================================================
 * 6. SINCRONIZAÇÃO EM TEMPO REAL ENTRE CELULAR E COMPUTADOR
 * Coleções no Firestore:
 * - /tenants/{tenantId}/appointments/{appointmentId}
 * - /tenants/{tenantId}/washItems/{washItemId}
 * - /tenants/{tenantId}/washHistory/{historyId}
 * - /tenants/{tenantId}/redemptions/{redemptionId}
 * - /tenants/{tenantId}/fidelityPoints/{clientKey}
 * - /tenants/{tenantId}/clients/{clientId}
 * =================================================================
 */

// Helper para normalizar ID
function cleanDocId(id: string): string {
  if (!id) return `doc-${Date.now()}`;
  return String(id).trim().replace(/[^a-zA-Z0-9_\-.:@]/g, '_') || `doc-${Date.now()}`;
}

/**
 * Busca inquilino (Tenant) diretamente no Firestore por ID, slug ou código.
 * Essencial para inicializar imediatamente o dispositivo móvel com a mesma empresa do computador.
 */
export async function getTenantByIdOrSlugFirestore(idOrSlug: string): Promise<Tenant | null> {
  try {
    await ensureFirebaseAuthSession();
    const raw = String(idOrSlug || '').trim();
    if (!raw) return null;
    const cleanId = cleanDocId(raw);
    const cleanSlug = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');

    const rawDeleted = typeof window !== 'undefined' ? localStorage.getItem('saas_deleted_tenant_ids') : null;
    const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
    if (cleanId === 't-autoclean' || cleanId.startsWith('t-10') || deletedList.includes(cleanId) || deletedList.includes(cleanSlug)) {
      return null;
    }

    // 0. Tenta busca imediata no cache local de empresas (ultra-rápido, sem delay de rede)
    if (typeof window !== 'undefined') {
      try {
        const rawLocal = localStorage.getItem('saas_master_tenants');
        if (rawLocal) {
          const localList: Tenant[] = JSON.parse(rawLocal);
          const foundLocal = localList.find(t => {
            if (t.id === 't-autoclean' || t.id.startsWith('t-10') || deletedList.includes(t.id)) return false;
            const tCleanId = t.id.toLowerCase().replace(/[^a-z0-9]/g, '');
            const tSlug = (t.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const tNormName = (t.nomeFantasia || t.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            return (
              tCleanId === cleanId ||
              tCleanId === cleanSlug ||
              (cleanSlug && (tSlug === cleanSlug || tNormName === cleanSlug || tNormName.includes(cleanSlug) || cleanSlug.includes(tNormName)))
            );
          });
          if (foundLocal) {
            return foundLocal;
          }
        }
      } catch (_) {}
    }

    // 1. Tenta buscar direto pelo ID do tenant em /tenants/{cleanId}
    try {
      const directDoc = await getDoc(doc(db, 'tenants', cleanId));
      if (directDoc.exists()) {
        const data = directDoc.data();
        const compName = data.name || data.nome || 'Lava-Jato';
        const derivedSlug = computeTenantSlug(compName, directDoc.id);
        return {
          id: directDoc.id,
          name: compName,
          code: data.code || 'LJ',
          domain: (data.domain && !data.domain.toLowerCase().startsWith('t-')) ? data.domain : `${derivedSlug}.saas.com`,
          plan: data.plan || 'Pro',
          status: data.status || 'Ativo',
          endUsersCount: data.endUsersCount ?? 1,
          maxUsers: data.maxUsers ?? 500,
          mrrAmount: data.mrrAmount ?? 0,
          createdAt: data.createdAt || new Date().toLocaleDateString('pt-BR'),
          contactEmail: data.contactEmail || '',
          contactPhone: data.contactPhone || '',
          ownerName: data.ownerName || '',
          lastActive: data.lastActive || 'Agora mesmo',
          logoUrl: data.logoUrl || undefined,
          address: data.address || undefined,
          tempPassword: data.tempPassword || undefined
        };
      }
    } catch (_) {}

    // 2. Tenta buscar pelo slug na coleção /empresas
    if (cleanSlug) {
      try {
        const qEmpresas = query(collection(db, 'empresas'), where('slug', '==', cleanSlug), limit(1));
        const empSnap = await getDocs(qEmpresas);
        if (!empSnap.empty) {
          const empDoc = empSnap.docs[0];
          const data = empDoc.data();
          let fullData = data;
          try {
            const fullDoc = await getDoc(doc(db, 'tenants', empDoc.id));
            if (fullDoc.exists()) fullData = fullDoc.data();
          } catch (_) {}
          const compName = fullData.name || fullData.nome || data.nome || 'Lava-Jato';
          return {
            id: empDoc.id,
            name: compName,
            code: fullData.code || 'LJ',
            domain: (fullData.domain && !fullData.domain.toLowerCase().startsWith('t-')) ? fullData.domain : `${cleanSlug}.saas.com`,
            plan: fullData.plan || 'Pro',
            status: fullData.status || 'Ativo',
            endUsersCount: fullData.endUsersCount ?? 1,
            maxUsers: fullData.maxUsers ?? 500,
            mrrAmount: fullData.mrrAmount ?? 0,
            createdAt: fullData.createdAt || new Date().toLocaleDateString('pt-BR'),
            contactEmail: fullData.contactEmail || '',
            contactPhone: fullData.contactPhone || '',
            ownerName: fullData.ownerName || '',
            lastActive: fullData.lastActive || 'Agora mesmo',
            logoUrl: fullData.logoUrl || data.logoUrl || undefined,
            address: fullData.address || undefined,
            tempPassword: fullData.tempPassword || data.tempPassword || undefined
          };
        }
      } catch (_) {}

      // 2.1 Tenta buscar pelo domínio exato em /tenants
      try {
        const qDom = query(collection(db, 'tenants'), where('domain', '==', `${cleanSlug}.saas.com`), limit(1));
        const domSnap = await getDocs(qDom);
        if (!domSnap.empty) {
          const dDoc = domSnap.docs[0];
          const data = dDoc.data();
          return {
            id: dDoc.id,
            name: data.name || 'Lava-Jato',
            code: data.code || 'LJ',
            domain: data.domain || `${cleanSlug}.saas.com`,
            plan: data.plan || 'Pro',
            status: data.status || 'Ativo',
            endUsersCount: data.endUsersCount ?? 1,
            maxUsers: data.maxUsers ?? 500,
            mrrAmount: data.mrrAmount ?? 0,
            createdAt: data.createdAt || new Date().toLocaleDateString('pt-BR'),
            contactEmail: data.contactEmail || '',
            contactPhone: data.contactPhone || '',
            ownerName: data.ownerName || '',
            lastActive: data.lastActive || 'Agora mesmo',
            logoUrl: data.logoUrl || undefined,
            address: data.address || undefined,
            tempPassword: data.tempPassword || undefined
          };
        }
      } catch (_) {}
    }

    // 3. Tenta buscar pelo código em /tenants (ex: AC, LJ)
    try {
      const qCode = query(collection(db, 'tenants'), where('code', '==', raw.toUpperCase()), limit(1));
      const codeSnap = await getDocs(qCode);
      if (!codeSnap.empty) {
        const cDoc = codeSnap.docs[0];
        const data = cDoc.data();
        const compName = data.name || 'Lava-Jato';
        const derivedSlug = computeTenantSlug(compName, cDoc.id);
        return {
          id: cDoc.id,
          name: compName,
          code: data.code || raw.toUpperCase(),
          domain: (data.domain && !data.domain.toLowerCase().startsWith('t-')) ? data.domain : `${derivedSlug}.saas.com`,
          plan: data.plan || 'Pro',
          status: data.status || 'Ativo',
          endUsersCount: data.endUsersCount ?? 1,
          maxUsers: data.maxUsers ?? 500,
          mrrAmount: data.mrrAmount ?? 0,
          createdAt: data.createdAt || new Date().toLocaleDateString('pt-BR'),
          contactEmail: data.contactEmail || '',
          contactPhone: data.contactPhone || '',
          ownerName: data.ownerName || '',
          lastActive: data.lastActive || 'Agora mesmo',
          logoUrl: data.logoUrl || undefined,
          address: data.address || undefined
        };
      }
    } catch (_) {}

    return null;
  } catch (err) {
    console.warn('getTenantByIdOrSlugFirestore error:', err);
    return null;
  }
}

// ================= 6.1 AGENDAMENTOS EM TEMPO REAL =================
export async function saveAppointmentToFirestore(tenantId: string, appointment: any): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const appId = cleanDocId(appointment.id || `app-${Date.now()}`);
    const docRef = doc(db, 'tenants', cleanTId, 'appointments', appId);
    const payload = removeUndefinedFields({
      ...appointment,
      id: appId,
      tenantId: cleanTId,
      updatedAt: new Date().toISOString()
    });
    await setDoc(docRef, payload, { merge: true });

    // Salva também na raiz para indexação direta caso necessário
    try {
      await setDoc(doc(db, 'appointments', appId), payload, { merge: true });
    } catch (_) {}

    // 🚗 Garante também que o cliente do agendamento conste no cadastro oficial de clientes deste lava-jato (/clientes e /tenants/{tenantId}/clients)
    if (appointment.clientName && appointment.clientName.trim()) {
      try {
        const clientPhoneDigits = (appointment.clientPhone || '').replace(/\D/g, '');
        const clientEmailClean = (appointment.clientEmail || '').trim().toLowerCase();
        const clientCleanId = clientPhoneDigits && clientPhoneDigits.length >= 8
          ? clientPhoneDigits
          : (clientEmailClean ? clientEmailClean.replace(/[^a-z0-9]/g, '_') : `c-${cleanDocId(appointment.clientName)}`);

        const vehicleItem = (appointment.plate || appointment.vehicle) ? [{
          tipo: 'Carro' as const,
          marca: appointment.vehicle ? appointment.vehicle.split(' ')[0] : 'Geral',
          modelo: appointment.vehicle || 'Veículo',
          cor: '',
          ano: '',
          placa: (appointment.plate || '').toUpperCase().trim()
        }] : [];

        const clientDocPayload = removeUndefinedFields({
          id: clientCleanId,
          nomeCompleto: appointment.clientName.trim(),
          telefone: appointment.clientPhone || '',
          email: clientEmailClean,
          empresa: cleanTId,
          tenantId: cleanTId,
          empresaId: cleanTId,
          origem: 'Agendamento Online',
          veiculos: vehicleItem,
          cep: '',
          endereco: appointment.addressSummary || '',
          bairro: '',
          cidade: '',
          estado: '',
          dataCadastro: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await setDoc(doc(db, 'clientes', clientCleanId), clientDocPayload, { merge: true });
        await setDoc(doc(db, 'tenants', cleanTId, 'clients', clientCleanId), clientDocPayload, { merge: true });
        console.log(`👤 [Cliente Sync] Cliente "${appointment.clientName}" integrado à Gestão de Clientes do lava-jato ${cleanTId}`);
      } catch (clientSyncErr) {
        console.warn('Aviso ao sincronizar ficha de cliente do agendamento:', clientSyncErr);
      }
    }

    console.log(`📡 [RealTime Sync] Agendamento ${appId} salvo no Firestore para o lava-jato ${cleanTId}`);
    return true;
  } catch (err) {
    console.error('saveAppointmentToFirestore error:', err);
    return false;
  }
}

export async function updateAppointmentStatusInFirestore(
  tenantId: string, 
  appointmentId: string, 
  status: string,
  extra: Record<string, any> = {}
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const appId = cleanDocId(appointmentId);
    const docRef = doc(db, 'tenants', cleanTId, 'appointments', appId);
    await updateDoc(docRef, removeUndefinedFields({
      status,
      ...extra,
      updatedAt: new Date().toISOString()
    }));
    return true;
  } catch (err) {
    console.error('updateAppointmentStatusInFirestore error:', err);
    return false;
  }
}

export async function updateAppointmentReminderInFirestore(
  tenantId: string,
  appointmentId: string,
  reminderData: {
    reminder24hSent?: boolean;
    reminder24hSentAt?: string;
    reminderChannel?: 'whatsapp' | 'email' | 'ambos';
    reminderNotes?: string;
    reminder24hScheduledAt?: string;
  }
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const appId = cleanDocId(appointmentId);
    const docRef = doc(db, 'tenants', cleanTId, 'appointments', appId);
    const payload = removeUndefinedFields({
      ...reminderData,
      updatedAt: new Date().toISOString()
    });
    await updateDoc(docRef, payload);
    try {
      await updateDoc(doc(db, 'appointments', appId), payload);
    } catch (_) {}
    return true;
  } catch (err) {
    console.error('updateAppointmentReminderInFirestore error:', err);
    return false;
  }
}

export async function deleteAppointmentFromFirestore(tenantId: string, appointmentId: string): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const appId = cleanDocId(appointmentId);
    const docRef = doc(db, 'tenants', cleanTId, 'appointments', appId);
    await deleteDoc(docRef);

    // Remove também da raiz caso tenha sido gravado lá
    try {
      await deleteDoc(doc(db, 'appointments', appId));
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('deleteAppointmentFromFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantAppointments(
  tenantId: string, 
  callback: (appointments: any[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'appointments');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      // Ordena por dateTime decrescente ou mais recente
      items.sort((a, b) => {
        const timeA = a.updatedAt || a.dateTime || '';
        const timeB = b.updatedAt || b.dateTime || '';
        return String(timeB).localeCompare(String(timeA));
      });
      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantAppointments snapshot error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantAppointments init error:', err);
    return () => {};
  }
}

export async function syncAllLocalAppointmentsToFirestore(tenantId: string, appointments: any[]): Promise<void> {
  if (!appointments || appointments.length === 0) return;
  for (const app of appointments) {
    if (app && app.id && !app.id.startsWith('app-init-')) {
      await saveAppointmentToFirestore(tenantId, app);
    }
  }
}

// ================= 6.2 ITENS DE LAVAGEM / FILA DO PÁTIO EM TEMPO REAL =================
export async function saveWashItemToFirestore(tenantId: string, washItem: any): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const washId = cleanDocId(washItem.id || `w-${Date.now()}`);
    const docRef = doc(db, 'tenants', cleanTId, 'washItems', washId);
    const payload = removeUndefinedFields({
      ...washItem,
      id: washId,
      tenantId: cleanTId,
      updatedAt: new Date().toISOString()
    });
    await setDoc(docRef, payload, { merge: true });
    console.log(`📡 [RealTime Sync] Veículo ${washItem.plate || washId} salvo no pátio do Firestore`);
    return true;
  } catch (err) {
    console.error('saveWashItemToFirestore error:', err);
    return false;
  }
}

export async function updateWashItemStatusInFirestore(
  tenantId: string, 
  washItemId: string, 
  status: string,
  extra: Record<string, any> = {}
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const washId = cleanDocId(washItemId);
    const docRef = doc(db, 'tenants', cleanTId, 'washItems', washId);
    await updateDoc(docRef, removeUndefinedFields({
      status,
      ...extra,
      updatedAt: new Date().toISOString()
    }));
    return true;
  } catch (err) {
    console.error('updateWashItemStatusInFirestore error:', err);
    return false;
  }
}

export async function deleteWashItemFromFirestore(tenantId: string, washItemId: string): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const washId = cleanDocId(washItemId);
    const docRef = doc(db, 'tenants', cleanTId, 'washItems', washId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('deleteWashItemFromFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantWashItems(
  tenantId: string, 
  callback: (washItems: any[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'washItems');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantWashItems snapshot error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantWashItems init error:', err);
    return () => {};
  }
}

export async function syncAllLocalWashesToFirestore(tenantId: string, washes: any[]): Promise<void> {
  if (!washes || washes.length === 0) return;
  for (const w of washes) {
    if (w && w.id && !w.id.startsWith('w-from-app-init-') && !w.id.startsWith('wh-')) {
      await saveWashItemToFirestore(tenantId, w);
    }
  }
}

// ================= 6.3 HISTÓRICO DE LAVAGENS EM TEMPO REAL =================
export async function saveWashHistoryToFirestore(tenantId: string, record: any): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const histId = cleanDocId(record.id || `wh-${Date.now()}`);
    const docRef = doc(db, 'tenants', cleanTId, 'washHistory', histId);
    const payload = removeUndefinedFields({
      ...record,
      id: histId,
      tenantId: cleanTId,
      updatedAt: new Date().toISOString()
    });
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.error('saveWashHistoryToFirestore error:', err);
    return false;
  }
}

export async function deleteWashHistoryFromFirestore(tenantId: string, historyId: string): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanHId = cleanDocId(historyId);
    await deleteDoc(doc(db, 'tenants', cleanTId, 'washHistory', cleanHId));
    return true;
  } catch (err) {
    console.error('deleteWashHistoryFromFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantWashHistory(
  tenantId: string, 
  callback: (records: any[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'washHistory');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      items.sort((a, b) => String(b.date || b.updatedAt || '').localeCompare(String(a.date || a.updatedAt || '')));
      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantWashHistory snapshot error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantWashHistory init error:', err);
    return () => {};
  }
}

// ================= 6.4 RESGATES DE FIDELIDADE EM TEMPO REAL =================
export async function saveFidelityRedemptionToFirestore(tenantId: string, redemption: any): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const redId = cleanDocId(redemption.id || `red-${Date.now()}`);
    const docRef = doc(db, 'tenants', cleanTId, 'redemptions', redId);
    const payload = removeUndefinedFields({
      ...redemption,
      id: redId,
      tenantId: cleanTId,
      status: redemption.status || 'pending',
      requestedAt: redemption.requestedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await setDoc(docRef, payload, { merge: true });
    console.log(`🎁 [RealTime Sync] Resgate de fidelidade ${redId} solicitado`);
    return true;
  } catch (err) {
    console.error('saveFidelityRedemptionToFirestore error:', err);
    return false;
  }
}

export async function updateFidelityRedemptionInFirestore(
  tenantId: string, 
  redemptionId: string, 
  status: 'pending' | 'approved' | 'rejected' | 'used'
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const redId = cleanDocId(redemptionId);
    const docRef = doc(db, 'tenants', cleanTId, 'redemptions', redId);
    await updateDoc(docRef, removeUndefinedFields({
      status,
      updatedAt: new Date().toISOString()
    }));
    return true;
  } catch (err) {
    console.error('updateFidelityRedemptionInFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantRedemptions(
  tenantId: string, 
  callback: (redemptions: any[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'redemptions');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantRedemptions snapshot error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantRedemptions init error:', err);
    return () => {};
  }
}

// ================= 6.5 PONTOS DE FIDELIDADE EM TEMPO REAL =================
export async function saveFidelityPointsToFirestore(
  tenantId: string, 
  clientKey: string, 
  points: number
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanKey = cleanDocId(clientKey);
    const docRef = doc(db, 'tenants', cleanTId, 'fidelityPoints', cleanKey);
    await setDoc(docRef, removeUndefinedFields({
      points,
      clientKey: cleanKey,
      updatedAt: new Date().toISOString()
    }), { merge: true });
    return true;
  } catch (err) {
    console.error('saveFidelityPointsToFirestore error:', err);
    return false;
  }
}

export function subscribeToFidelityPoints(
  tenantId: string, 
  clientKey: string, 
  callback: (points: number) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const cleanKey = cleanDocId(clientKey);
    const docRef = doc(db, 'tenants', cleanTId, 'fidelityPoints', cleanKey);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback(Number(data.points || 0));
      }
    }, (err) => {
      console.warn('subscribeToFidelityPoints snapshot error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToFidelityPoints init error:', err);
    return () => {};
  }
}

// ================= 6.6 CLIENTES DA EMPRESA EM TEMPO REAL =================
export function subscribeToTenantClients(
  tenantId: string, 
  callback: (clients: any[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'clients');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantClients snapshot error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantClients init error:', err);
    return () => {};
  }
}

// ================= 7. TROCA DE ÓLEO & ESTOQUE DE LUBRIFICANTES =================
export async function saveOilProductToFirestore(tenantId: string, product: OilProductItem): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanPId = cleanDocId(product.id);
    const docRef = doc(db, 'tenants', cleanTId, 'oil_products', cleanPId);
    await setDoc(docRef, removeUndefinedFields({
      ...product,
      tenantId: cleanTId,
      updatedAt: new Date().toISOString()
    }), { merge: true });
    return true;
  } catch (err) {
    console.error('saveOilProductToFirestore error:', err);
    return false;
  }
}

export async function deleteOilProductFromFirestore(tenantId: string, productId: string): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanPId = cleanDocId(productId);
    await deleteDoc(doc(db, 'tenants', cleanTId, 'oil_products', cleanPId));
    return true;
  } catch (err) {
    console.error('deleteOilProductFromFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantOilProducts(
  tenantId: string, 
  callback: (products: OilProductItem[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'oil_products');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: OilProductItem[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as OilProductItem);
      });
      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantOilProducts error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantOilProducts init error:', err);
    return () => {};
  }
}

export async function saveOilChangeToFirestore(tenantId: string, oilChange: OilChangeRecord): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanCId = cleanDocId(oilChange.id);
    const docRef = doc(db, 'tenants', cleanTId, 'oil_changes', cleanCId);
    await setDoc(docRef, removeUndefinedFields({
      ...oilChange,
      tenantId: cleanTId,
      createdAt: oilChange.createdAt || new Date().toISOString()
    }), { merge: true });
    return true;
  } catch (err) {
    console.error('saveOilChangeToFirestore error:', err);
    return false;
  }
}

export async function deleteOilChangeFromFirestore(tenantId: string, oilChangeId: string): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanCId = cleanDocId(oilChangeId);
    await deleteDoc(doc(db, 'tenants', cleanTId, 'oil_changes', cleanCId));
    return true;
  } catch (err) {
    console.error('deleteOilChangeFromFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantOilChanges(
  tenantId: string, 
  callback: (records: OilChangeRecord[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'oil_changes');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: OilChangeRecord[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as OilChangeRecord);
      });
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantOilChanges error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantOilChanges init error:', err);
    return () => {};
  }
}

/**
 * =================================================================
 * 8. TRANSMISSÃO DE NOTIFICAÇÃO SAAS ROOT (BOX 1000 & TENANTS)
 * Permite que a administração envie alertas operacionais, manutenções
 * ou comunicados prioritários em tempo real para os usuários de Box 1000.
 * =================================================================
 */
export interface BroadcastNotification {
  id: string;
  tenantId: string;
  tenantName: string;
  message: string;
  urgency: 'info' | 'alerta' | 'urgente';
  sender: string;
  createdAt: string;
  active: boolean;
}

export async function sendBroadcastNotificationFirestore(params: {
  tenantId: string;
  tenantName: string;
  message: string;
  urgency?: 'info' | 'alerta' | 'urgente';
  sender?: string;
}): Promise<BroadcastNotification> {
  const notifId = `notif-${Date.now()}`;
  const cleanTId = cleanDocId(params.tenantId);
  const payload: BroadcastNotification = {
    id: notifId,
    tenantId: params.tenantId,
    tenantName: params.tenantName,
    message: params.message.trim(),
    urgency: params.urgency || 'info',
    sender: params.sender || 'SaaS Root Admin',
    createdAt: new Date().toISOString(),
    active: true
  };

  try {
    await ensureFirebaseAuthSession();
    // 1. Grava no documento ativo de config do tenant para snapshot em tempo real
    await setDoc(doc(db, 'tenants', cleanTId, 'config', 'broadcastNotification'), payload);
    // 2. Grava no histórico de notificações do tenant
    await setDoc(doc(db, 'tenants', cleanTId, 'broadcastNotifications', notifId), payload);
    console.log(`📢 [Broadcast] Notificação transmitida para ${params.tenantName} (${cleanTId})`);
  } catch (err) {
    console.warn('sendBroadcastNotificationFirestore notice:', err);
  }

  // Redundância local imediata
  try {
    localStorage.setItem(`saas_broadcast_${cleanTId}`, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('saas_broadcast_notification', { detail: payload }));
  } catch (_) {}

  return payload;
}

export function subscribeToTenantBroadcastNotification(
  tenantId: string,
  callback: (notification: BroadcastNotification | null) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const docRef = doc(db, 'tenants', cleanTId, 'config', 'broadcastNotification');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as BroadcastNotification;
        if (data && data.active) {
          callback(data);
          return;
        }
      }
      callback(null);
    }, (err) => {
      console.warn('subscribeToTenantBroadcastNotification notice:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantBroadcastNotification init error:', err);
    return () => {};
  }
}

export async function dismissBroadcastNotificationFirestore(
  tenantId: string,
  notificationId: string
): Promise<void> {
  try {
    const cleanTId = cleanDocId(tenantId);
    await setDoc(doc(db, 'tenants', cleanTId, 'config', 'broadcastNotification'), {
      active: false,
      dismissedAt: new Date().toISOString(),
      dismissedNotificationId: notificationId
    }, { merge: true });
    try {
      localStorage.removeItem(`saas_broadcast_${cleanTId}`);
      window.dispatchEvent(new CustomEvent('saas_broadcast_notification', { detail: null }));
    } catch (_) {}
  } catch (err) {
    console.warn('dismissBroadcastNotificationFirestore error:', err);
  }
}

/**
 * =================================================================
 * 9. CONTROLE DE CAIXA & FLUXO DE CAIXA (ENTRADA & SAÍDA) NO FIRESTORE
 * Sincronização em tempo real de vendas, entradas avulsas, sangrias,
 * despesas operacionais e fechamento de caixa do lava-jato.
 * =================================================================
 */

export async function saveCashTransactionToFirestore(
  tenantId: string, 
  transaction: CashTransaction
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanId = cleanDocId(transaction.id || `cash-${Date.now()}`);
    const dataToSave = removeUndefinedFields({
      ...transaction,
      id: cleanId,
      tenantId: cleanTId,
      updatedAt: new Date().toISOString()
    });

    await setDoc(doc(db, 'tenants', cleanTId, 'cash_transactions', cleanId), dataToSave, { merge: true });

    // Salva fallback local
    try {
      const storageKey = `saas_tenant_cash_transactions_${cleanTId}`;
      const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const filtered = local.filter((t: any) => t.id !== cleanId);
      localStorage.setItem(storageKey, JSON.stringify([dataToSave, ...filtered]));
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('saveCashTransactionToFirestore error:', err);
    return false;
  }
}

export async function deleteCashTransactionFromFirestore(
  tenantId: string, 
  transactionId: string
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanId = cleanDocId(transactionId);
    await deleteDoc(doc(db, 'tenants', cleanTId, 'cash_transactions', cleanId));

    try {
      const storageKey = `saas_tenant_cash_transactions_${cleanTId}`;
      const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const filtered = local.filter((t: any) => t.id !== cleanId);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('deleteCashTransactionFromFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantCashTransactions(
  tenantId: string,
  callback: (transactions: CashTransaction[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'cash_transactions');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: CashTransaction[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as CashTransaction);
      });
      items.sort((a, b) => new Date(b.createdAt || `${b.date}T${b.time || '00:00'}`).getTime() - new Date(a.createdAt || `${a.date}T${a.time || '00:00'}`).getTime());
      
      // Atualiza fallback local
      try {
        localStorage.setItem(`saas_tenant_cash_transactions_${cleanTId}`, JSON.stringify(items));
      } catch (_) {}

      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantCashTransactions error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantCashTransactions init error:', err);
    return () => {};
  }
}

export async function saveCashRegisterSessionToFirestore(
  tenantId: string,
  session: CashRegisterSession
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const dataToSave = removeUndefinedFields({
      ...session,
      tenantId: cleanTId,
      updatedAt: new Date().toISOString()
    });

    await setDoc(doc(db, 'tenants', cleanTId, 'config', 'cash_register'), dataToSave, { merge: true });

    try {
      localStorage.setItem(`saas_tenant_cash_register_${cleanTId}`, JSON.stringify(dataToSave));
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('saveCashRegisterSessionToFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantCashRegisterSession(
  tenantId: string,
  callback: (session: CashRegisterSession | null) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const docRef = doc(db, 'tenants', cleanTId, 'config', 'cash_register');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as CashRegisterSession;
        callback(data);
        try {
          localStorage.setItem(`saas_tenant_cash_register_${cleanTId}`, JSON.stringify(data));
        } catch (_) {}
      } else {
        callback(null);
      }
    }, (err) => {
      console.warn('subscribeToTenantCashRegisterSession error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantCashRegisterSession init error:', err);
    return () => {};
  }
}

/**
 * =================================================================
 * 10. PRODUTOS DE VENDA & PDV BALCÃO NO FIRESTORE
 * Separação dos produtos de venda direta aos clientes dos insumos internos,
 * com baixa de estoque automática e integração ao caixa.
 * =================================================================
 */

export async function saveSaleProductToFirestore(
  tenantId: string,
  product: SaleProductItem
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanPId = cleanDocId(product.id || `sprod-${Date.now()}`);
    const dataToSave = removeUndefinedFields({
      ...product,
      id: cleanPId,
      tenantId: cleanTId,
      updatedAt: new Date().toISOString()
    });

    await setDoc(doc(db, 'tenants', cleanTId, 'sale_products', cleanPId), dataToSave, { merge: true });

    try {
      const storageKey = `saas_tenant_sale_products_${cleanTId}`;
      const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const filtered = local.filter((p: any) => p.id !== cleanPId);
      localStorage.setItem(storageKey, JSON.stringify([dataToSave, ...filtered]));
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('saveSaleProductToFirestore error:', err);
    return false;
  }
}

export async function deleteSaleProductFromFirestore(
  tenantId: string,
  productId: string
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanPId = cleanDocId(productId);
    await deleteDoc(doc(db, 'tenants', cleanTId, 'sale_products', cleanPId));

    try {
      const storageKey = `saas_tenant_sale_products_${cleanTId}`;
      const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const filtered = local.filter((p: any) => p.id !== cleanPId);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('deleteSaleProductFromFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantSaleProducts(
  tenantId: string,
  callback: (products: SaleProductItem[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'sale_products');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: SaleProductItem[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as SaleProductItem);
      });
      items.sort((a, b) => a.name.localeCompare(b.name));

      try {
        localStorage.setItem(`saas_tenant_sale_products_${cleanTId}`, JSON.stringify(items));
      } catch (_) {}

      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantSaleProducts error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantSaleProducts init error:', err);
    return () => {};
  }
}

export async function saveCounterSaleToFirestore(
  tenantId: string,
  sale: CounterSaleRecord
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanSId = cleanDocId(sale.id || `sale-${Date.now()}`);
    const dataToSave = removeUndefinedFields({
      ...sale,
      id: cleanSId,
      tenantId: cleanTId,
      createdAt: sale.createdAt || new Date().toISOString()
    });

    await setDoc(doc(db, 'tenants', cleanTId, 'counter_sales', cleanSId), dataToSave, { merge: true });

    // Registra a transação financeira no fluxo operacional APENAS se explicitamente solicitado
    // (Por padrão, as vendas de balcão possuem seu próprio controle financeiro separado)
    if (sale.integrateWithOperationalCash) {
      const cashEntry: CashTransaction = {
        id: `cash-sale-${cleanSId}`,
        tenantId: cleanTId,
        type: 'entrada',
        category: 'venda_balcao',
        categoryLabel: 'Venda de Balcão (Loja)',
        description: `Venda #${sale.saleNumber || cleanSId.slice(-4)}: ${sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`,
        amount: sale.totalAmount,
        paymentMethod: sale.paymentMethod,
        date: sale.date,
        time: sale.time,
        operator: sale.operator,
        referenceId: cleanSId,
        recipientOrClient: sale.clientName || 'Cliente Balcão',
        notes: sale.notes,
        createdAt: sale.createdAt || new Date().toISOString()
      };
      await saveCashTransactionToFirestore(cleanTId, cashEntry);
    }

    // Salva fallback local
    try {
      const storageKey = `saas_tenant_counter_sales_${cleanTId}`;
      const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const filtered = local.filter((s: any) => s.id !== cleanSId);
      localStorage.setItem(storageKey, JSON.stringify([dataToSave, ...filtered]));
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('saveCounterSaleToFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantCounterSales(
  tenantId: string,
  callback: (sales: CounterSaleRecord[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'counter_sales');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: CounterSaleRecord[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as CounterSaleRecord);
      });
      items.sort((a, b) => new Date(b.createdAt || `${b.date}T${b.time}`).getTime() - new Date(a.createdAt || `${a.date}T${a.time}`).getTime());

      try {
        localStorage.setItem(`saas_tenant_counter_sales_${cleanTId}`, JSON.stringify(items));
      } catch (_) {}

      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantCounterSales error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantCounterSales init error:', err);
    return () => {};
  }
}

/**
 * =================================================================
 * 11. BANNERS PROMOCIONAIS PARA O APLICATIVO DO CLIENTE
 * Permite ao lava-jato criar ofertas, promoções e comunicados visuais
 * com foto, desconto e botão direto para agendar no app do cliente.
 * =================================================================
 */

export async function savePromoBannerToFirestore(
  tenantId: string,
  banner: PromoBanner
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanBId = cleanDocId(banner.id || `banner-${Date.now()}`);
    const dataToSave = removeUndefinedFields({
      ...banner,
      id: cleanBId,
      tenantId: cleanTId,
      updatedAt: new Date().toISOString()
    });

    await setDoc(doc(db, 'tenants', cleanTId, 'promo_banners', cleanBId), dataToSave, { merge: true });

    // Fallback local imediato
    try {
      const storageKey = `saas_tenant_promo_banners_${cleanTId}`;
      const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const filtered = local.filter((b: any) => b.id !== cleanBId);
      localStorage.setItem(storageKey, JSON.stringify([dataToSave, ...filtered]));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('saas_promo_banner_updated', { detail: dataToSave }));
    } catch (_) {}

    console.log(`📢 [Banners] Banner promocional "${banner.title}" salvo para o tenant ${cleanTId}`);
    return true;
  } catch (err) {
    console.error('savePromoBannerToFirestore error:', err);
    return false;
  }
}

export async function deletePromoBannerFromFirestore(
  tenantId: string,
  bannerId: string
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanTId = cleanDocId(tenantId);
    const cleanBId = cleanDocId(bannerId);
    await deleteDoc(doc(db, 'tenants', cleanTId, 'promo_banners', cleanBId));

    try {
      const storageKey = `saas_tenant_promo_banners_${cleanTId}`;
      const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const filtered = local.filter((b: any) => b.id !== cleanBId);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('saas_promo_banner_deleted', { detail: cleanBId }));
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('deletePromoBannerFromFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantPromoBanners(
  tenantId: string,
  callback: (banners: PromoBanner[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'promo_banners');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: PromoBanner[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as PromoBanner);
      });
      // Ordena por ordem ou mais recentes
      items.sort((a, b) => {
        if (typeof a.order === 'number' && typeof b.order === 'number') {
          return a.order - b.order;
        }
        return new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime();
      });

      try {
        localStorage.setItem(`saas_tenant_promo_banners_${cleanTId}`, JSON.stringify(items));
      } catch (_) {}

      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantPromoBanners error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantPromoBanners init error:', err);
    return () => {};
  }
}

/**
 * =================================================================
 * 19. SISTEMA DE LEVA E TRAZ (VALET PICK-UP & DELIVERY)
 * Gerenciamento de solicitações de leva e traz, acompanhamento e status.
 * =================================================================
 */

export async function saveLevaETrazRequest(request: LevaETrazRequest): Promise<boolean> {
  try {
    const cleanTId = cleanDocId(request.tenantId);
    const cleanRId = cleanDocId(request.id);
    const docRef = doc(db, 'tenants', cleanTId, 'leva_e_traz', cleanRId);
    const cleanedData = removeUndefinedFields({
      ...request,
      updatedAt: new Date().toISOString()
    });

    await setDoc(docRef, cleanedData, { merge: true });

    // LocalStorage fallback cache
    try {
      const storageKey = `saas_tenant_leva_e_traz_${cleanTId}`;
      const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const index = local.findIndex((item: any) => item.id === cleanRId);
      if (index >= 0) {
        local[index] = cleanedData;
      } else {
        local.unshift(cleanedData);
      }
      localStorage.setItem(storageKey, JSON.stringify(local));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('saas_leva_e_traz_updated', { detail: cleanedData }));
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('saveLevaETrazRequest error:', err);
    // Offline / Local fallback
    try {
      const cleanTId = cleanDocId(request.tenantId);
      const storageKey = `saas_tenant_leva_e_traz_${cleanTId}`;
      const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const index = local.findIndex((item: any) => item.id === request.id);
      if (index >= 0) {
        local[index] = request;
      } else {
        local.unshift(request);
      }
      localStorage.setItem(storageKey, JSON.stringify(local));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('saas_leva_e_traz_updated', { detail: request }));
    } catch (_) {}
    return false;
  }
}

export async function updateLevaETrazStatusInFirestore(
  tenantId: string,
  requestId: string,
  status: LevaETrazStatus,
  updateData?: Partial<LevaETrazRequest>
): Promise<boolean> {
  try {
    const cleanTId = cleanDocId(tenantId);
    const cleanRId = cleanDocId(requestId);
    const docRef = doc(db, 'tenants', cleanTId, 'leva_e_traz', cleanRId);

    const docSnap = await getDoc(docRef);
    const existingData = docSnap.exists() ? (docSnap.data() as LevaETrazRequest) : null;
    const history = existingData?.statusHistory || [];
    history.push({
      status,
      timestamp: new Date().toISOString(),
      note: updateData?.notes
    });

    const payload: Partial<LevaETrazRequest> = {
      ...updateData,
      status,
      statusHistory: history,
      updatedAt: new Date().toISOString()
    };

    const cleanedPayload = removeUndefinedFields(payload);
    await updateDoc(docRef, cleanedPayload);

    // Sync localStorage
    try {
      const storageKey = `saas_tenant_leva_e_traz_${cleanTId}`;
      const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const index = local.findIndex((item: any) => item.id === cleanRId);
      if (index >= 0) {
        local[index] = { ...local[index], ...cleanedPayload };
        localStorage.setItem(storageKey, JSON.stringify(local));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('saas_leva_e_traz_updated', { detail: local[index] }));
      }
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('updateLevaETrazStatusInFirestore error:', err);
    return false;
  }
}

export async function deleteLevaETrazRequestFromFirestore(
  tenantId: string,
  requestId: string
): Promise<boolean> {
  try {
    const cleanTId = cleanDocId(tenantId);
    const cleanRId = cleanDocId(requestId);
    const docRef = doc(db, 'tenants', cleanTId, 'leva_e_traz', cleanRId);
    await deleteDoc(docRef);

    try {
      const storageKey = `saas_tenant_leva_e_traz_${cleanTId}`;
      const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const filtered = local.filter((item: any) => item.id !== cleanRId);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('saas_leva_e_traz_deleted', { detail: cleanRId }));
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('deleteLevaETrazRequestFromFirestore error:', err);
    return false;
  }
}

export function subscribeToTenantLevaETraz(
  tenantId: string,
  callback: (items: LevaETrazRequest[]) => void
): () => void {
  try {
    const cleanTId = cleanDocId(tenantId);
    const colRef = collection(db, 'tenants', cleanTId, 'leva_e_traz');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items: LevaETrazRequest[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as LevaETrazRequest);
      });

      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      try {
        localStorage.setItem(`saas_tenant_leva_e_traz_${cleanTId}`, JSON.stringify(items));
      } catch (_) {}

      callback(items);
    }, (err) => {
      console.warn('subscribeToTenantLevaETraz error:', err);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToTenantLevaETraz init error:', err);
    return () => {};
  }
}
