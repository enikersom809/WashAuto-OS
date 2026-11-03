import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  Check, 
  X, 
  Tag, 
  Image as ImageIcon, 
  DollarSign, 
  Smartphone, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ExternalLink,
  Flame,
  Star,
  Zap,
  Gift,
  ArrowRight
} from 'lucide-react';
import { Tenant, PromoBanner } from '../types';
import { 
  savePromoBannerToFirestore, 
  deletePromoBannerFromFirestore, 
  subscribeToTenantPromoBanners 
} from '../lib/firebaseService';

interface PromoBannersWorkspaceProps {
  tenant: Tenant;
  onToast: (msg: string) => void;
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
  onToast
}) => {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PromoBanner | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  // 1. Escuta em tempo real os banners da empresa no Firestore
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToTenantPromoBanners(tenant.id, (remoteBanners) => {
      setBanners(remoteBanners);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tenant.id]);

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
        onToast(editingBanner 
          ? 'Banner promocional atualizado com sucesso!' 
          : '🎉 Novo banner promocional publicado no aplicativo dos clientes!'
        );
        setShowModal(false);
      } else {
        onToast('Erro ao salvar o banner. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      onToast('Falha na conexão com o banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este banner promocional do aplicativo?')) {
      return;
    }
    const success = await deletePromoBannerFromFirestore(tenant.id, bannerId);
    if (success) {
      onToast('Banner removido do aplicativo com sucesso.');
    } else {
      onToast('Erro ao excluir banner.');
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
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Banners Promocionais do Aplicativo
                </h2>
                <span className="bg-pink-500/20 text-pink-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-pink-500/30">
                  MARKETING AO VIVO
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Crie e publique carrosséis de ofertas, descontos de combos e avisos promocionais que aparecem em destaque na tela inicial do celular de todos os seus clientes em tempo real.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenNewModal}
            className="px-5 py-3.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition shadow-lg shadow-pink-600/30 cursor-pointer active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Banner Promocional</span>
          </button>
        </div>
      </div>

      {/* 2. Lista de Banners Ativos e Publicados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-pink-400" />
            Banners Ativos no Aplicativo ({banners.length})
          </h3>
          <span className="text-xs text-slate-400">
            Arraste ou gerencie a visibilidade de cada oferta
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 bg-[#0f172a] rounded-2xl border border-slate-800 text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-pink-400" />
            <span className="text-xs">Carregando banners da nuvem...</span>
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center py-14 px-6 bg-[#0f172a] rounded-2xl border border-slate-800 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-pink-500/10 text-pink-400 mx-auto flex items-center justify-center border border-pink-500/20">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Nenhum banner promocional personalizado ainda</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                O aplicativo dos seus clientes está exibindo os banners padrão do sistema. Crie o primeiro banner com sua oferta da semana para atrair mais agendamentos!
              </p>
            </div>
            <button
              onClick={handleOpenNewModal}
              className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-2 cursor-pointer shadow-md shadow-pink-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Primeiro Banner</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {banners.map((banner) => (
              <div 
                key={banner.id}
                className={`bg-[#0f172a] border rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between transition-all duration-200 ${
                  banner.active 
                    ? 'border-slate-800 hover:border-pink-500/40' 
                    : 'border-slate-800/50 opacity-60'
                }`}
              >
                {/* Imagem do Banner com Tag e Preço */}
                <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
                  <img 
                    src={banner.image} 
                    alt={banner.title} 
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  
                  {/* Tag superior */}
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 text-pink-300 backdrop-blur-md border border-pink-500/30 flex items-center gap-1 shadow-md">
                      {banner.tag}
                    </span>
                  </div>

                  {/* Badge de Desconto / Preço */}
                  {(banner.badge || banner.discountPrice) && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-pink-600 text-white shadow-lg shadow-pink-600/30">
                        {banner.discountPrice ? `R$ ${banner.discountPrice.toFixed(2)}` : banner.badge}
                      </span>
                    </div>
                  )}

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
                      onClick={() => handleOpenEditModal(banner)}
                      className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => handleDeleteBanner(banner.id)}
                      className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border border-rose-500/20"
                      title="Excluir banner"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
                    Defina o título, imagem e o desconto para atrair seus clientes no app
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
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

              {/* Escolha da Imagem (Presets ou URL personalizada) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Imagem do Banner</span>
                  <span className="text-[10px] text-pink-400 font-normal">Presets automotivos em alta resolução</span>
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESET_BANNER_IMAGES.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setImageUrl(img.url)}
                      className={`relative h-16 rounded-xl overflow-hidden border transition cursor-pointer text-left group ${
                        imageUrl === img.url
                          ? 'border-pink-500 ring-2 ring-pink-500/40'
                          : 'border-slate-800 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-end p-1.5">
                        <span className="text-[9px] font-bold text-white line-clamp-1">{img.label}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <input
                    type="url"
                    placeholder="Ou cole a URL de uma imagem personalizada (https://...)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-[#020617] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-pink-500 font-mono"
                  />
                </div>
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
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
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

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
