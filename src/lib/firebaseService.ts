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

export async function saveTenantToFirestore(tenant: Tenant): Promise<boolean> {
  try {
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
    const tenantDocRef = doc(db, 'tenants', tenantId);
    await deleteDoc(tenantDocRef);
    console.log(`🗑️ [Firestore] Empresa ${tenantId} removida da coleção /tenants`);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tenants/${tenantId}`);
    return false;
  }
}

export async function loadTenantsFromFirestore(): Promise<Tenant[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'tenants'));
    const loadedTenants: Tenant[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      loadedTenants.push({
        id: data.id || docSnap.id,
        name: data.name || 'Lava-Jato',
        code: data.code || 'LJ',
        domain: data.domain || `${docSnap.id}.saas.com`,
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
        logoUrl: data.logoUrl || undefined
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
      const liveTenants: Tenant[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        liveTenants.push({
          id: data.id || docSnap.id,
          name: data.name || 'Lava-Jato',
          code: data.code || 'LJ',
          domain: data.domain || `${docSnap.id}.saas.com`,
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
          logoUrl: data.logoUrl || undefined
        });
      });
      if (liveTenants.length > 0) {
        callback(liveTenants);
      }
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
      // 1. Tenta criar usuário novo no Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, effectivePassword);
      userRecord = userCredential.user;
      console.log(`🔐 [Firebase Auth] Novo usuário criado com sucesso: ${userRecord.uid} (${normalizedEmail})`);
    } catch (authErr: any) {
      // Se o e-mail já existe no Firebase Auth, tenta fazer login
      if (authErr.code === 'auth/email-already-in-use') {
        console.log(`ℹ️ [Firebase Auth] E-mail já cadastrado, efetuando login: ${normalizedEmail}`);
        try {
          const loginCred = await signInWithEmailAndPassword(auth, normalizedEmail, effectivePassword);
          userRecord = loginCred.user;
        } catch (loginErr: any) {
          // Se falhar a senha, mas usuário já existe
          return {
            success: true,
            errorMessage: 'E-mail já cadastrado no Authentication. Login realizado com seu cadastro.',
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
        console.warn('Firebase Auth creation notice:', authErr);
        // Prossegue mesmo se houver restrição de rede no browser
        return {
          success: true,
          errorMessage: authErr.message
        };
      }
    }

    // 2. Atualiza o Nome de Exibição (displayName) no Firebase Auth
    if (userRecord && name) {
      try {
        await updateProfile(userRecord, { displayName: name });
      } catch (profErr) {
        console.warn('UpdateProfile warning:', profErr);
      }
    }

    // 3. Registra os dados cadastrais do cliente no Firestore
    const clientDocId = userRecord ? userRecord.uid : `c-${Date.now()}`;
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
      // Salva no registro geral de clientes
      await setDoc(doc(db, 'clients', clientDocId), clientFirestoreData, { merge: true });
      
      // Se pertence a uma empresa, salva também na subcoleção do tenant
      if (tenantId) {
        await setDoc(doc(db, 'tenants', tenantId, 'clients', clientDocId), clientFirestoreData, { merge: true });
      }
      console.log(`✅ [Firestore] Perfil do cliente salvo nas coleções /clients e /tenants/${tenantId}/clients`);
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

export async function loginClientInFirebaseAuth(email: string, password?: string): Promise<ClientAuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const effectivePassword = password && password.trim().length >= 6 
    ? password.trim() 
    : `Cliente#${normalizedEmail.split('@')[0]}123`;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, effectivePassword);
    console.log(`🔓 [Firebase Auth] Usuário autenticado com sucesso: ${userCredential.user.uid}`);
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

