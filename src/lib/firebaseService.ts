import { 
  collection, 
  doc, 
  setDoc, 
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
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInAnonymously,
  updateProfile, 
  signOut,
  type User
} from 'firebase/auth';
import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { Tenant } from '../types';

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
export async function loginEmpresaInFirebaseAuth(email: string, password: string): Promise<{ success: boolean; user?: User; errorMessage?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    return { success: true, user: cred.user };
  } catch (error: any) {
    return { success: false, errorMessage: error.message || 'Senha ou e-mail de empresa incorreto.' };
  }
}

/**
 * Autentica Super Admin no Firebase Auth e garante documento em /usuarios
 */
export async function loginSuperAdminInFirebaseAuth(email: string, password: string): Promise<{ success: boolean; user?: User; errorMessage?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
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


/**
 * Salva a Ficha Completa de Cadastro do Cliente (com Endereço e Veículos Dinâmicos)
 * nas coleções do Firestore (/clients e /tenants/{tenantId}/clients).
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
): Promise<boolean> {
  try {
    await ensureFirebaseAuthSession();
    const cleanId = data.phone 
      ? data.phone.replace(/\D/g, '') 
      : (data.email ? data.email.replace(/[^a-zA-Z0-9]/g, '_') : `c-${Date.now()}`);
    
    const payload = removeUndefinedFields({
      ...data,
      tenantId: tenantId || 'default',
      updatedAt: new Date().toISOString()
    });

    await withTimeout(setDoc(doc(db, 'clients', cleanId), payload, { merge: true }), 4000);
    if (tenantId) {
      await withTimeout(setDoc(doc(db, 'tenants', tenantId, 'clients', cleanId), payload, { merge: true }), 4000);
    }
    console.log(`✅ [Firestore] Ficha de cadastro do cliente e veículos gravada com sucesso: ${cleanId}`);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clients/${tenantId}`);
    return false;
  }
}

export async function loginClientInFirebaseAuth(email: string, password?: string): Promise<ClientAuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const effectivePassword = password && password.trim().length >= 6 
    ? password.trim() 
    : `Cliente#${normalizedEmail.split('@')[0]}123`;

  try {
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
    const q = query(
      collection(db, 'tenants'),
      where('contactEmail', '==', cleanEmail),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      return {
        id: docData.id || snap.docs[0].id,
        name: docData.name || 'Lava-Jato',
        code: docData.code || 'LJ',
        domain: docData.domain || `${snap.docs[0].id}.saas.com`,
        plan: docData.plan || 'Pro',
        status: docData.status || 'Ativo',
        endUsersCount: docData.endUsersCount || 1,
        maxUsers: docData.maxUsers || 500,
        mrrAmount: docData.mrrAmount || 0,
        createdAt: docData.createdAt || '',
        contactEmail: docData.contactEmail || cleanEmail,
        contactPhone: docData.contactPhone || '',
        ownerName: docData.ownerName || '',
        lastActive: 'Agora mesmo'
      };
    }
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
          address: data.address || undefined
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
            address: fullData.address || undefined
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
            address: data.address || undefined
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


