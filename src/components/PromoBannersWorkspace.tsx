import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Image as ImageIcon,
  Smartphone,
  Layers,
  AlertCircle,
  Loader2,
  Zap,
  Upload,
  EyeOff,
  RotateCcw
} from 'lucide-react';
import { Tenant, PromoBanner } from '../types';
import {
  savePromoBannerToFirestore,
  deletePromoBannerFromFirestore,
  subscribeToTenantPromoBanners,
  saveTenantToFirestore
} from '../lib/firebaseService';

interface PromoBannersWorkspaceProps {
  tenant: Tenant;
  onToast: (msg: string) => void;
  onUpdateTenant?: (updatedTenant: Tenant) => void;
}

// Imagens padrão de alta resolução prontas para lava-jato e estética automotiva
const PRESET_BANNER_IMAGES = [
  {
    label: 'Vitrificação & Brilho Espelhado',
    url: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=1200&q=80'
  },
  {
    label: 'Lavagem Detalhada & Cera Carnaúba',
    url: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=1200&q=80'
  },
  {
    label: 'Ducha Ecológica & Pretinho nas Rodas',
    url: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=1200&q=80'
  },
  {
    label: 'Higienização de Bancos & Interior',
    url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1200&q=80'
  },
  {
    label: 'Troca de Óleo & Lubrificação',
    url: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1200&q=80'
  },
  {
    label: 'Polimento Técnico & Proteção',
    url: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80'
  }
];

const PRESET_TAGS = [
  '🔥 Oferta da Semana',
  '⭐ Lançamento Premium',
  '⚡ Promoção Relâmpago',
  '💎 Combo Especial',
  '🎁 Brinde Exclusivo',
  '🎉 Desconto no App'
];

export const PromoBannersWorkspace: React.FC<PromoBannersWorkspaceProps> = ({
  tenant,
  onToast,
  onUpdateTenant
}) => {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PromoBanner | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estados de exclusão in-app (sem window.confirm para funcionar em PWA/iframe)
  const [bannerToDelete, setBannerToDelete] = useState<PromoBanner | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isTogglingDefaultBanners, setIsTogglingDefaultBanners] = useState(false);

  // Estados de upload de imagem do PC ou celular
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Form states
  const [tag, setTag] = useState(PRESET_TAGS[0]);
  const [customTag, setCustomTag] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageUrl, setImageUrl] = useState(PRESET_BANNER_IMAGES[0].url);
  const [serviceName, setServiceName] = useState('');
  const [discountPrice, setDiscountPrice] = useState<string>('');
  const [originalPrice, setOriginalPrice] = useState<string>('');
  const [badgeText, setBadgeText] = useState('20% OFF');
  const [isActive, setIsActive] = useState(true);

  const isUploadedDataUrl = imageUrl.startsWith('data:image/');

  // 1. Escuta em tempo real os banners da empresa no Firestore
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToTenantPromoBanners(tenant.id, (remoteBanners) => {
      setBanners(remoteBanners);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tenant.id]);

  // Upload e compressão otimizada de imagem do PC ou Celular (para caber com folga no Firestore e carregar rápido)
  const handleBannerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reseta o input para permitir reenviar o mesmo arquivo se desejar
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setUploadError('Selecione um arquivo de imagem válido (JPG, PNG, WebP ou SVG).');
      return;
    }

    setIsProcessingUpload(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) {
        setIsProcessingUpload(false);
        setUploadError('Não foi possível ler a imagem selecionada.');
        return;
      }

      if (file.type.includes('svg')) {
        if (result.length > 750000) {
          setIsProcessingUpload(false);
          setUploadError('Arquivo SVG muito grande. Escolha uma imagem menor.');
          return;
        }
        setImageUrl(result);
        setIsProcessingUpload(false);
        onToast('📸 Imagem SVG carregada do dispositivo com sucesso!');
        return;
      }

      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 675;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width = (width * MAX_HEIGHT) / height;
          height = MAX_HEIGHT;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          setImageUrl(result);
          setIsProcessingUpload(false);
          onToast('📸 Foto carregada com sucesso!');
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Compressão progressiva para garantir que caiba confortavelmente no limite de 1MB do Firestore
        let compressed = canvas.toDataURL('image/jpeg', 0.82);
        if (compressed.length > 700000) {
          compressed = canvas.toDataURL('image/jpeg', 0.68);
        }
        if (compressed.length > 700000) {
          compressed = canvas.toDataURL('image/jpeg', 0.52);
        }

        setImageUrl(compressed);
        setIsProcessingUpload(false);
        onToast('📸 Imagem do dispositivo otimizada e carregada para o banner!');
      };

      img.onerror = () => {
        setIsProcessingUpload(false);
        setUploadError('Não foi possível processar esta imagem. Tente JPG ou PNG.');
      };

      img.src = result;
    };

    reader.onerror = () => {
      setIsProcessingUpload(false);
      setUploadError('Erro ao ler arquivo selecionado.');
    };

    reader.readAsDataURL(file);
  };

  const handleOpenNewModal = () => {
    setEditingBanner(null);
    setTag(PRESET_TAGS[0]);
    setCustomTag('');
    setTitle('');
    setSubtitle('');
    setImageUrl(PRESET_BANNER_IMAGES[0].url);
    setServiceName('');
    setDiscountPrice('');
    setOriginalPrice('');
    setBadgeText('20% OFF');
    setIsActive(true);
    setUploadError(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (banner: PromoBanner) => {
    setEditingBanner(banner);
    if (PRESET_TAGS.includes(banner.tag)) {
      setTag(banner.tag);
      setCustomTag('');
    } else {
      setTag('Outra');
      setCustomTag(banner.tag);
    }
    setTitle(banner.title);
    setSubtitle(banner.subtitle);
    setImageUrl(banner.image);
    setServiceName(banner.serviceName || '');
    setDiscountPrice(banner.discountPrice ? String(banner.discountPrice) : '');
    setOriginalPrice(banner.originalPrice ? String(banner.originalPrice) : '');
    setBadgeText(banner.badge || '');
    setIsActive(banner.active !== false);
    setUploadError(null);
    setShowModal(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subtitle.trim() || !imageUrl.trim()) {
      onToast('Por favor, preencha o título, descrição e imagem do banner.');
      return;
    }

    setIsSaving(true);
    try {
      const finalTag = tag === 'Outra' ? (customTag.trim() || '🔥 Oferta Especial') : tag;
      const bannerId = editingBanner?.id || `banner-${Date.now()}`;

      const payload: PromoBanner = {
        id: bannerId,
        tenantId: tenant.id,
        tag: finalTag,
        title: title.trim(),
        subtitle: subtitle.trim(),
        image: imageUrl.trim(),
        serviceName: serviceName.trim() || undefined,
        discountPrice: discountPrice ? parseFloat(discountPrice.replace(',', '.')) : undefined,
        originalPrice: originalPrice ? parseFloat(originalPrice.replace(',', '.')) : undefined,
        badge: badgeText.trim() || undefined,
        active: isActive,
        createdAt: editingBanner?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const success = await savePromoBannerToFirestore(tenant.id, payload);
      if (success) {
        onToast(
          editingBanner
            ? 'Banner promocional atualizado com sucesso!'
            : '🎉 Novo banner promocional publicado no aplicativo dos clientes!'
        );
        setShowModal(false);
      } else {
        onToast('Erro ao salvar o banner. Verifique o tamanho da imagem e tente novamente.');
      }
    } catch (err) {
      console.error(err);
      onToast('Falha na conexão com o banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteBanner = async () => {
    if (!bannerToDelete) return;
    setIsDeleting(true);
    try {
      const success = await deletePromoBannerFromFirestore(tenant.id, bannerToDelete.id);
      if (success) {
        setBanners((prev) => prev.filter((b) => b.id !== bannerToDelete.id));
        if (editingBanner?.id === bannerToDelete.id) {
          setShowModal(false);
          setEditingBanner(null);
        }
        onToast('🗑️ Banner excluído e removido do celular dos clientes!');
      } else {
        onToast('Erro ao excluir banner. Tente novamente.');
      }
    } finally {
      setIsDeleting(false);
      setBannerToDelete(null);
    }
  };

  const handleConfirmDeleteAllBanners = async () => {
    if (banners.length === 0) {
      setShowDeleteAllModal(false);
      return;
    }
    setIsDeleting(true);
    try {
      await Promise.all(
        banners.map((b) => deletePromoBannerFromFirestore(tenant.id, b.id))
      );
      setBanners([]);
      // Opcionalmente também oculta os banners padrão para manter o celular limpo caso desejado
      const updatedTenant: Tenant = { ...tenant, hideDefaultBanners: true };
      await saveTenantToFirestore(updatedTenant).catch(() => {});
      onUpdateTenant?.(updatedTenant);
      onToast('🗑️ Todos os banners foram excluídos! Celular do cliente limpo.');
    } catch (err) {
      console.error(err);
      onToast('Erro ao excluir todos os banners.');
    } finally {
      setIsDeleting(false);
      setShowDeleteAllModal(false);
    }
  };

  const handleToggleHideDefaultBanners = async (hide: boolean) => {
    setIsTogglingDefaultBanners(true);
    try {
      const updatedTenant: Tenant = {
        ...tenant,
        hideDefaultBanners: hide
      };
      await saveTenantToFirestore(updatedTenant);
      onUpdateTenant?.(updatedTenant);
      onToast(
        hide
          ? '🗑️ Banners padrão ocultados! Tela inicial do cliente limpa.'
          : '✨ Banners padrão do sistema reativados no app do cliente.'
      );
    } catch (err) {
      console.error(err);
      onToast('Erro ao atualizar visibilidade dos banners padrão.');
    } finally {
      setIsTogglingDefaultBanners(false);
    }
  };

  const handleToggleActive = async (banner: PromoBanner) => {
    const updated = { ...banner, active: !banner.active };
    await savePromoBannerToFirestore(tenant.id, updated);
    onToast(updated.active ? 'Banner ativado no aplicativo!' : 'Banner pausado (oculto no app).');
  };

  return (
    <div className="space-y-6">

      {/* 1. Header Hero Banner */}
      <div className="bg-gradient-to-r from-pink-950/40 via-slate-900 to-purple-950/30 border border-pink-500/30 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-pink-600/20 text-pink-400 border border-pink-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-pink-600/20">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Banners Promocionais do Aplicativo
                </h2>
                <span className="bg-pink-500/20 text-pink-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-pink-500/30">
                  MARKETING AO VIVO
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Crie banners enviando fotos direto do seu PC ou celular, ou escolha imagens prontas. Exclua banners antigos na lixeira quando quiser para manter a tela do cliente sempre limpa.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {banners.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(true)}
                className="px-4 py-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                title="Excluir todos os banners do aplicativo"
              >
                <Trash2 className="w-4 h-4" />
                <span>Limpar Banners</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenNewModal}
              className="px-5 py-3.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition shadow-lg shadow-pink-600/30 cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Banner Promocional</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Lista de Banners Ativos e Publicados */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-pink-400" />
            Banners no Aplicativo ({banners.length})
          </h3>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {tenant.hideDefaultBanners && banners.length === 0 && (
              <button
                type="button"
                disabled={isTogglingDefaultBanners}
                onClick={() => handleToggleHideDefaultBanners(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Restaurar Banners Padrão</span>
              </button>
            )}
            <span>Use a lixeira para remover banners antigos do celular</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 bg-[#0f172a] rounded-2xl border border-slate-800 text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-pink-400" />
            <span className="text-xs">Carregando banners da nuvem...</span>
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center py-12 px-6 bg-[#0f172a] rounded-2xl border border-slate-800 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-pink-500/10 text-pink-400 mx-auto flex items-center justify-center border border-pink-500/20">
              {tenant.hideDefaultBanners ? <EyeOff className="w-8 h-8 text-slate-400" /> : <Sparkles className="w-8 h-8" />}
            </div>
            <div>
              <h4 className="text-base font-bold text-white">
                {tenant.hideDefaultBanners
                  ? 'Nenhum banner sendo exibido no celular do cliente'
                  : 'Nenhum banner promocional personalizado ainda'}
              </h4>
              <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1">
                {tenant.hideDefaultBanners
                  ? 'Os banners padrão também foram removidos para deixar o aplicativo do cliente mais limpo. Você pode publicar um novo banner com sua própria foto ou restaurar os banners padrão.'
                  : 'Atualmente o aplicativo dos clientes exibe os 3 banners padrão do sistema. Crie um banner com foto do seu PC/celular ou remova os banners padrão para não poluir o app.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleOpenNewModal}
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-2 cursor-pointer shadow-md shadow-pink-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Banner com Foto Própria</span>
              </button>

              {!tenant.hideDefaultBanners ? (
                <button
                  type="button"
                  disabled={isTogglingDefaultBanners}
                  onClick={() => handleToggleHideDefaultBanners(true)}
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl transition inline-flex items-center gap-2 cursor-pointer"
                >
                  {isTogglingDefaultBanners ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Remover Banners Padrão do Celular</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isTogglingDefaultBanners}
                  onClick={() => handleToggleHideDefaultBanners(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-cyan-400" />
                  <span>Restaurar Banners Padrão</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className={`bg-[#0f172a] border rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between transition-all duration-200 ${
                  banner.active
                    ? 'border-slate-800 hover:border-pink-500/40'
                    : 'border-slate-800/50 opacity-70'
                }`}
              >
                {/* Imagem do Banner com Tag e Preço */}
                <div className="relative h-44 w-full bg-slate-900 overflow-hidden group">
                  <img
                    src={banner.image}
                    alt={banner.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  {/* Tag superior */}
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 text-pink-300 backdrop-blur-md border border-pink-500/30 flex items-center gap-1 shadow-md">
                      {banner.tag}
                    </span>
                  </div>

                  {/* Badge de Desconto / Preço + Lixeira rápida */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {(banner.badge || banner.discountPrice) && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-pink-600 text-white shadow-lg shadow-pink-600/30">
                        {banner.discountPrice ? `R$ ${banner.discountPrice.toFixed(2)}` : banner.badge}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setBannerToDelete(banner)}
                      className="w-8 h-8 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition cursor-pointer border border-rose-400/40"
                      title="Excluir banner do celular dos clientes"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Título & Descrição sobre a imagem */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <h4 className="text-sm font-extrabold text-white leading-tight line-clamp-1 drop-shadow-md">
                      {banner.title}
                    </h4>
                    <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 drop-shadow">
                      {banner.subtitle}
                    </p>
                  </div>
                </div>

                {/* Detalhes & Barra de Ações */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Status no App:</span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(banner)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                        banner.active
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {banner.active ? '● Ativo no App' : '○ Pausado'}
                    </button>
                  </div>

                  {banner.serviceName && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-[#020617] px-2.5 py-1.5 rounded-lg border border-slate-800">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Serviço: <strong className="text-slate-200">{banner.serviceName}</strong></span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(banner)}
                      className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBannerToDelete(banner)}
                      className="py-2 px-3.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border border-rose-500/30"
                      title="Excluir banner"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Modal de Criação / Edição do Banner */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">

            {/* Header Modal */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-pink-600/20 text-pink-400 flex items-center justify-center border border-pink-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingBanner ? 'Editar Banner Promocional' : 'Novo Banner Promocional'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Envie foto do PC/celular ou escolha uma imagem pronta para publicar no app
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveBanner} className="p-5 space-y-4">

              {/* Etiqueta / Tag da Promoção */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Etiqueta de Destaque</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESET_TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setTag(t); setCustomTag(''); }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-left truncate transition cursor-pointer ${
                        tag === t
                          ? 'bg-pink-600 text-white border-pink-500 shadow-md shadow-pink-600/20'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Título da Promoção */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Título da Oferta *</label>
                <input
                  type="text"
                  placeholder="Ex: Combo Vitrificação + Higienização de Couro"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full bg-[#020617] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Subtítulo / Descrição */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Descrição / Chamada para Ação *</label>
                <textarea
                  placeholder="Ex: Ganhe 20% OFF agendando de terça a quinta-feira pelo aplicativo!"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  rows={2}
                  required
                  className="w-full bg-[#020617] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>

              {/* Preços e Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Preço Promocional (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 120.00"
                    value={discountPrice}
                    onChange={(e) => setDiscountPrice(e.target.value)}
                    className="w-full bg-[#020617] border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Preço Original (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 150.00"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    className="w-full bg-[#020617] border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Selo / Badge</label>
                  <input
                    type="text"
                    placeholder="Ex: 20% OFF"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    className="w-full bg-[#020617] border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-pink-500 font-bold"
                  />
                </div>
              </div>

              {/* Serviço Vinculado (Opcional) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  Nome do Serviço Vinculado (Opcional - seleciona direto no agendamento)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Lavagem Detalhada + Cera Carnaúba"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full bg-[#020617] border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Escolha da Imagem (Upload do PC/Celular, Presets ou URL personalizada) */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Imagem do Banner</span>
                  <span className="text-[10px] text-pink-400 font-normal">Upload do dispositivo, prontas ou URL</span>
                </label>

                {/* Input oculto compatível com PC e Celular (Galeria ou Câmera) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerFileUpload}
                  className="hidden"
                />

                {/* Botão / Área de Upload do PC ou Celular */}
                <div className="bg-[#020617] border border-dashed border-pink-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400 flex items-center justify-center shrink-0">
                      {isProcessingUpload ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {isUploadedDataUrl
                          ? 'Foto do seu dispositivo carregada!'
                          : 'Enviar foto do PC ou Celular'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        JPG, PNG ou WebP · Redimensionada e comprimida automaticamente para o app
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isUploadedDataUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl(PRESET_BANNER_IMAGES[0].url)}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="Remover imagem enviada e voltar para padrão"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Remover</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isProcessingUpload}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-pink-600/20"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{isUploadedDataUrl ? 'Trocar Foto' : 'Escolher Arquivo'}</span>
                    </button>
                  </div>
                </div>

                {uploadError && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 text-[11px] text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Imagens Pré-Definidas */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-400 font-semibold block">
                    Ou selecione uma imagem pré-definida:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PRESET_BANNER_IMAGES.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setUploadError(null);
                          setImageUrl(img.url);
                        }}
                        className={`relative h-16 rounded-xl overflow-hidden border transition cursor-pointer text-left group ${
                          imageUrl === img.url
                            ? 'border-pink-500 ring-2 ring-pink-500/40'
                            : 'border-slate-800 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 flex items-end p-1.5">
                          <span className="text-[9px] font-bold text-white line-clamp-1">{img.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* URL Externa Opcional */}
                {!isUploadedDataUrl && (
                  <div className="pt-0.5">
                    <input
                      type="url"
                      placeholder="Ou cole a URL de uma imagem personalizada (https://...)"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full bg-[#020617] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-pink-500 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Preview ao Vivo */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-pink-400" />
                  Pré-visualização ao vivo como ficará no celular do cliente:
                </span>

                <div className="relative h-44 rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-950">
                  <img src={imageUrl || PRESET_BANNER_IMAGES[0].url} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 text-pink-300 backdrop-blur-md border border-pink-500/30">
                      {tag === 'Outra' ? (customTag || 'Oferta') : tag}
                    </span>
                  </div>

                  {(badgeText || discountPrice) && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-pink-600 text-white shadow-lg">
                        {discountPrice ? `R$ ${parseFloat(discountPrice || '0').toFixed(2)}` : badgeText}
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h5 className="text-sm font-extrabold leading-tight drop-shadow-md">
                      {title || 'Título da sua oferta incrível'}
                    </h5>
                    <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">
                      {subtitle || 'Descrição da promoção que chamará a atenção do cliente'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <div>
                  {editingBanner && (
                    <button
                      type="button"
                      onClick={() => setBannerToDelete(editingBanner)}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Excluir Banner</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving || isProcessingUpload}
                    className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs sm:text-sm font-black rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg shadow-pink-600/30 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Publicando no App...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{editingBanner ? 'Salvar Alterações' : 'Publicar no Aplicativo'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 4. Modal de Confirmação de Exclusão Individual (In-App, compatível com Mobile/iFrame) */}
      {bannerToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Banner Promocional?</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  O banner <strong className="text-slate-200">"{bannerToDelete.title}"</strong> será removido permanentemente e deixará de aparecer no celular dos clientes imediatamente.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setBannerToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteBanner}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Sim, Excluir Banner</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal de Confirmação para Limpar Todos os Banners */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Todos os Banners?</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Todos os <strong>{banners.length} banner(s)</strong> publicados serão apagados e os banners padrão ficarão ocultos para deixar o aplicativo do cliente 100% limpo.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteAllBanners}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Limpar Tudo</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
