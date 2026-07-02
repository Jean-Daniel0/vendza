import React, { useState, useEffect } from 'react';
import { Send, Image, RefreshCw, MessageSquare, Clock, ArrowLeft, Ticket, ShieldCheck, Mail, AlertCircle, CheckCheck } from 'lucide-react';
import { Message, UserProfile, Product, Order } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface InboxViewProps {
  messages: Message[];
  user: UserProfile | null;
  onSendMessage: (text: string, recipientId: string, image?: string, orderId?: string, productId?: string) => void;
  onMarkMessagesAsRead?: (senderId: string) => void;
  products: Product[];
  orders: Order[];
  initialRecipientId?: string | null;
  initialRecipientNom?: string | null;
  initialProductId?: string | null;
}

const formatMessageTime = (timeStr: string, createdAtStr?: string) => {
  if (!createdAtStr) return timeStr;
  try {
    const d = new Date(createdAtStr);
    if (isNaN(d.getTime())) return timeStr;
    const now = new Date();
    
    const isSameDay = d.getDate() === now.getDate() &&
                      d.getMonth() === now.getMonth() &&
                      d.getFullYear() === now.getFullYear();
                      
    const timeFormatted = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    if (isSameDay) {
      return `Aujourd'hui, ${timeFormatted}`;
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.getDate() === yesterday.getDate() &&
                        d.getMonth() === yesterday.getMonth() &&
                        d.getFullYear() === yesterday.getFullYear();
                        
    if (isYesterday) {
      return `Hier, ${timeFormatted}`;
    }
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `Le ${day}/${month} à ${timeFormatted}`;
  } catch (e) {
    return timeStr;
  }
};

export const InboxView: React.FC<InboxViewProps> = ({
  messages,
  user,
  onSendMessage,
  onMarkMessagesAsRead,
  products,
  orders,
  initialRecipientId,
  initialRecipientNom,
  initialProductId
}) => {
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(initialRecipientId || '99999999-9999-4999-9999-999999999999');
  const [selectedRecipientNom, setSelectedRecipientNom] = useState<string>(initialRecipientNom || 'Vendza');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(initialProductId || null);
  const [typedMessage, setTypedMessage] = useState<string>('');
  const [contacts, setContacts] = useState<{ id: string; nom: string; type: string; subtitle: string; productId?: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  
  // Tab-filter: 'all' = showing everything, 'system' = only Vendza official, 'chats' = customers & sellers
  const [activeTab, setActiveTab] = useState<'all' | 'system' | 'chats'>('all');
  
  // Tracks if we are "inside" a full-screen/dedicated page conversation
  const [isChatOpen, setIsChatOpen] = useState<boolean>(!!initialRecipientId);

  useEffect(() => {
    if (initialRecipientId) {
      setSelectedRecipientId(initialRecipientId);
      setIsChatOpen(true);
    }
    if (initialRecipientNom) {
      setSelectedRecipientNom(initialRecipientNom);
    }
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    }
  }, [initialRecipientId, initialRecipientNom, initialProductId]);

  // Mark incoming messages as read instantly when active chat conversation is open
  useEffect(() => {
    if (user && selectedRecipientId && onMarkMessagesAsRead && isChatOpen) {
      const hasUnread = messages.some(m => m.senderId === selectedRecipientId && m.recipientId === user.id && m.isRead !== true);
      if (hasUnread) {
        onMarkMessagesAsRead(selectedRecipientId);
      }
    }
  }, [messages, selectedRecipientId, user, onMarkMessagesAsRead, isChatOpen]);

  useEffect(() => {
    if (!user) return;

    if (!isSupabaseConfigured || !supabase) {
      setContacts([{ id: '99999999-9999-4999-9999-999999999999', nom: 'Vendza', type: 'system', subtitle: 'Notifications de sécurité' }]);
      return;
    }

    async function executeFetch() {
      const isVendor = user.userType === 'vendeur';
      let query = supabase
        .from('conversations')
        .select(`
          id,
          buyer_id,
          vendor_id,
          last_message_at,
          product_id,
          product:product_id (
            id,
            name,
            image_url
          )
        `);

      if (isVendor) {
        query = query.eq('vendor_id', user.id);
      } else {
        query = query.eq('buyer_id', user.id);
      }

      let convs: any[] = [];
      let error: any = null;

      try {
        const { data, error: fetchErr } = await query.order('last_message_at', { ascending: false });
        if (fetchErr) {
          throw fetchErr;
        }

        if (data && data.length > 0) {
          const partnerIds = data.map((c: any) => [c.buyer_id, c.vendor_id]).flat().filter(Boolean);
          const uniquePartnerIds = [...new Set(partnerIds)];
          
          let profilesMap: Record<string, any> = {};
          if (uniquePartnerIds.length > 0) {
            const { data: profiles, error: profErr } = await supabase
              .from('profiles')
              .select('id, prenom, nom, avatar_url, email')
              .in('id', uniquePartnerIds);
            
            if (profErr) {
              console.warn("Secondary profiles fetch failed in executeFetch:", profErr.message);
            } else if (profiles) {
              profiles.forEach((p: any) => {
                profilesMap[p.id] = p;
              });
            }
          }

          convs = data.map((c: any) => {
            const defaultProfile = {
              prenom: 'Utilisateur',
              nom: 'Vendza',
              avatar_url: null,
              email: ''
            };

            const buyerProf = c.buyer_id ? (profilesMap[c.buyer_id] || defaultProfile) : defaultProfile;
            const vendorProf = c.vendor_id ? (profilesMap[c.vendor_id] || defaultProfile) : defaultProfile;

            return {
              id: c.id,
              buyer_id: c.buyer_id,
              vendor_id: c.vendor_id,
              last_message_at: c.last_message_at,
              product_id: c.product_id,
              product: c.product,
              buyer: buyerProf,
              vendor: vendorProf
            };
          });
        }
      } catch (e: any) {
        console.error("Resilient executeFetch error:", e);
        error = e;
      }

      if (error) {
        throw error;
      }
      return convs;
    }

    async function fetchDatabaseSellers() {
      setIsRefreshing(true);
      let convs: any[] = [];
      let success = false;
      let lastError: any = null;
      
      const retryDelays = [0, 2000, 5000]; // Immediately, then wait 2s, then wait 5s

      for (let attempt = 0; attempt < retryDelays.length; attempt++) {
        try {
          if (retryDelays[attempt] > 0) {
            console.log(`[Inbox Retry] Waiting ${retryDelays[attempt] / 1000}s before retry attempt ${attempt}...`);
            await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
          }
          convs = await executeFetch();
          success = true;
          setLoadError(null);
          break;
        } catch (err: any) {
          console.warn(`[Inbox Fetch Attempt ${attempt + 1} Failed]:`, err?.message || err);
          lastError = err;
        }
      }

      setIsRefreshing(false);

      if (!success) {
        console.error("[Inbox Fetch Ultimate Failure]: All retries failed.", lastError);
        setLoadError("Impossible de synchroniser vos messages. Réessai en cours...");
        
        // Retain existing contacts list if any loaded successfully before (has more than just the system user)
        setContacts(prev => {
          if (prev && prev.length > 1) {
            return prev;
          }
          return [{ id: '99999999-9999-4999-9999-999999999999', nom: 'Vendza', type: 'system', subtitle: 'Notifications de sécurité' }];
        });
        return;
      }

      const isVendor = user.userType === 'vendeur';
      if (convs && convs.length > 0) {
        const dbMapped = convs.map((conv: any) => {
          const partner = isVendor ? conv.buyer : conv.vendor;
          const partnerId = isVendor ? conv.buyer_id : conv.vendor_id;
          const pId = conv.product_id || conv.product?.id || '';

          if (!partner) {
            return {
              id: partnerId || '',
              nom: 'Utilisateur Vendza',
              type: isVendor ? 'client' : 'vendeur',
              subtitle: conv.product?.name ? `Produit : ${conv.product.name}` : 'Discussion sécurisée',
              productId: pId
            };
          }

          const prenomStr = partner.prenom || '';
          const nomStr = partner.nom || '';
          const nomAffiche = prenomStr 
            ? `${prenomStr} ${nomStr}`.trim() 
            : partner.email || 'Utilisateur Vendza';

          const subtitle = conv.product?.name 
            ? `Produit : ${conv.product.name}` 
            : (isVendor ? 'Acheteur de confiance' : 'Marchand Partenaire');

          return {
            id: partnerId || partner.id || '',
            nom: nomAffiche,
            type: isVendor ? 'client' : 'vendeur',
            subtitle: subtitle,
            productId: pId
          };
        }).filter((c: any) => c.id && c.id !== user.id);

        const unique = dbMapped.filter((item, index, self) => 
          index === self.findIndex((t) => t.id === item.id)
        );

        const withSystem = [
          { id: '99999999-9999-4999-9999-999999999999', nom: 'Vendza', type: 'system', subtitle: 'Alertes de livraison & séquestre' },
          ...unique
        ];

        setContacts(withSystem);
        
        if (withSystem.length > 0 && !withSystem.some(c => c.id === selectedRecipientId)) {
          if (!initialRecipientId) {
            setSelectedRecipientId('99999999-9999-4999-9999-999999999999');
            setSelectedRecipientNom('Vendza');
          }
        }
      } else {
        // Fallback to Profiles if no existing conversations, so users can still see contacts to start a chat
        try {
          const { data: profiles, error: profErr } = await supabase
            .from('profiles')
            .select('*');

          if (!profErr && profiles && profiles.length > 0) {
            const mappedProfiles = profiles.map((p: any) => {
              const fullName = p.prenom ? `${p.prenom} ${p.nom}`.trim() : p.email || 'Utilisateur Vendza';
              const finalType = p.type || p.user_type || 'vendeur';
              return {
                id: p.id,
                nom: fullName,
                type: finalType,
                subtitle: finalType === 'vendeur' ? 'Marchand Partenaire' : 'Acheteur de confiance'
              };
            }).filter((p: any) => p.id !== user.id);

            const withSystem = [
              { id: '99999999-9999-4999-9999-999999999999', nom: 'Vendza', type: 'system', subtitle: 'Alertes de livraison & séquestre' },
              ...mappedProfiles
            ];

            setContacts(withSystem);
          } else {
            setLoadError("Impossible d'actualiser, réessai en cours...");
            setContacts(prev => prev.length > 1 ? prev : [{ id: '99999999-9999-4999-9999-999999999999', nom: 'Vendza', type: 'system', subtitle: 'Notifications de sécurité' }]);
            setSelectedRecipientId('99999999-9999-4999-9999-999999999999');
            setSelectedRecipientNom('Vendza');
          }
        } catch (e) {
          setLoadError("Impossible d'actualiser, réessai en cours...");
          setContacts(prev => prev.length > 1 ? prev : [{ id: '99999999-9999-4999-9999-999999999999', nom: 'Vendza', type: 'system', subtitle: 'Notifications de sécurité' }]);
        }
      }
    }

    fetchDatabaseSellers();
  }, [user, refreshTrigger]);

  // Realtime subscription to conversations updates in InboxView for instant dynamic lists
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user) return;

    console.log('[InboxView Realtime] Subscribing to conversations channel...');
    const convoChannel = supabase
      .channel('inbox-conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          console.log('[InboxView Realtime] Conversation table updated, refreshing contact list...', payload);
          setRefreshTrigger(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convoChannel);
    };
  }, [user, isSupabaseConfigured, supabase]);

  if (!user) return null;

  // Dynamically sort contacts so that the ones with the most recent messages appear first
  const sortedContacts = contacts.slice().sort((a, b) => {
    if (a.id === '99999999-9999-4999-9999-999999999999') return -1;
    if (b.id === '99999999-9999-4999-9999-999999999999') return 1;

    // Sort other contacts by last message timestamp
    const getContactLastTime = (contactId: string) => {
      const contactMsgs = messages.filter(m => 
        (m.senderId === contactId && m.recipientId === user?.id) ||
        (m.senderId === user?.id && m.recipientId === contactId)
      );
      if (contactMsgs.length === 0) return 0;
      const times = contactMsgs.map(m => {
        if (m.createdAt) return new Date(m.createdAt).getTime();
        return 0;
      });
      return Math.max(...times);
    };

    const timeA = getContactLastTime(a.id);
    const timeB = getContactLastTime(b.id);
    return timeB - timeA;
  });

  // Filter contacts by active category tab
  const filteredContacts = sortedContacts.filter(c => {
    if (activeTab === 'system') return c.id === '99999999-9999-4999-9999-999999999999';
    if (activeTab === 'chats') return c.id !== '99999999-9999-4999-9999-999999999999';
    return true; // 'all'
  });

  // Filter messages belonging to selected conversation
  const chatMessages = messages.filter(m => 
    (m.senderId === user.id && m.recipientId === selectedRecipientId) ||
    (m.senderId === selectedRecipientId && m.recipientId === user.id)
  );

  const handleSend = () => {
    if (!typedMessage.trim()) return;
    onSendMessage(typedMessage, selectedRecipientId, undefined, undefined, selectedProductId || undefined);
    setTypedMessage('');
  };

  const handleSendSimulateImage = () => {
    onSendMessage('Voici une capture d\'écran de la couleur choisie pour la livraison !', selectedRecipientId, '#e4e9f5', undefined, selectedProductId || undefined);
  };

  const handleShareOrderUuid = () => {
    const activeOrder = orders.find(o => o.clientId === user.id || o.clientId === selectedRecipientId);
    const orderUuid = activeOrder ? activeOrder.id : 'order-101-vendza-haiti';
    onSendMessage(`Voici l'ID de ma commande pour confirmer la préparation : ${orderUuid}`, selectedRecipientId, undefined, orderUuid, selectedProductId || undefined);
  };

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
        <div>
          <h1 className="font-serif text-lg font-bold text-slate-800 flex items-center gap-1.5">
            💬 Messagerie Sécurisée
          </h1>
          <p className="text-[10px] text-slate-500 font-medium font-sans">
            Échanges directs sous séquestre d'État garantis par Vendza
          </p>
        </div>
        <span className="text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Sync
        </span>
      </div>

      {!isChatOpen ? (
        /* Conversation list representation (Acts as index page) */
        <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
          {/* Sub Header tabs for System Notifications & Messages */}
          <div className="bg-slate-50/70 p-2.5 border-b border-slate-100 flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#0c1445] text-white shadow-3xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <Mail size={12} /> Tous ({contacts.length})
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'system'
                  ? 'bg-amber-500 text-white shadow-3xs'
                  : 'bg-amber-50/50 hover:bg-amber-50 border border-amber-200 text-amber-800'
              }`}
            >
              <ShieldCheck size={12} /> 📢 Alertes Vendza (System)
            </button>
            <button
              onClick={() => setActiveTab('chats')}
              className={`px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'chats'
                  ? 'bg-blue-600 text-white shadow-3xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <MessageSquare size={12} /> 💬 Messages Privés
            </button>
          </div>

          {loadError && (
            <div className="bg-rose-50 border-b border-rose-100 p-3 text-xs text-rose-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {loadError}
              </span>
              <button 
                onClick={() => setRefreshTrigger(prev => prev + 1)}
                className="text-[10px] font-bold bg-white text-rose-700 hover:bg-rose-100 px-2 py-1 rounded border border-rose-200 shadow-3xs cursor-pointer transition"
              >
                Réessayer
              </button>
            </div>
          )}

          {isRefreshing && (
            <div className="bg-slate-50 border-b border-slate-100 p-2 text-[10px] text-slate-500 flex items-center justify-center gap-1.5 font-sans">
              <span className="w-2 h-2 border border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              Actualisation en cours...
            </div>
          )}

          <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
            {filteredContacts.length > 0 ? (
              filteredContacts.map(contact => {
                const isSystem = contact.id === '99999999-9999-4999-9999-999999999999';
                const hasLastSystemMsg = messages.some(m => m.senderId === contact.id || m.recipientId === contact.id);
                const contactUnread = messages.filter(m => m.senderId === contact.id && m.recipientId === user.id && m.isRead !== true).length;

                return (
                  <div
                    key={contact.id}
                    onClick={() => {
                      setSelectedRecipientId(contact.id);
                      setSelectedRecipientNom(contact.nom);
                      setSelectedProductId(contact.productId || null);
                      setIsChatOpen(true);
                    }}
                    className={`p-4 flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                      isSystem 
                        ? 'bg-gradient-to-r from-amber-50/30 via-teal-50/15 to-transparent hover:from-amber-50/50 hover:via-teal-50/30 border-l-4 border-amber-500' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSystem ? (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-sm relative">
                          <ShieldCheck size={20} />
                          {contactUnread > 0 && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-ping" />
                          )}
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-extrabold text-sm flex items-center justify-center uppercase border border-slate-200 shadow-3xs">
                          {contact.nom[0] || 'U'}
                        </div>
                      )}
                      
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <h4 className={`text-xs sm:text-sm font-extrabold ${isSystem ? 'text-amber-900' : 'text-slate-800'}`}>
                            {contact.nom}
                          </h4>
                          {isSystem && (
                            <span className="text-[8px] bg-amber-100 text-amber-800 font-extrabold uppercase px-1.5 py-0.2 rounded-xs border border-amber-200">
                              Officiel
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-sans tracking-tight">
                          {contact.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {contactUnread > 0 ? (
                        <span className="h-5 px-1.5 min-w-5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-3xs animate-bounce animate-duration-1000">
                          {contactUnread}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                          <CheckCheck size={11} className="text-emerald-500" /> Lu
                        </span>
                      )}
                      <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider ${contactUnread > 0 ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-teal-50 border border-teal-200 text-teal-800'}`}>
                        {contactUnread > 0 ? 'Nouveau' : 'Ouvrir'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <p className="text-2xl">📭</p>
                <p className="text-xs font-bold text-slate-500">Aucune discussion trouvée dans cet onglet</p>
                <p className="text-[10px] text-slate-400">Vos messages de commandes et de chat s'afficheront ici.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Focused Active Conversation Box (Acts as dynamic full page view) */
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm flex flex-col h-[520px]">
          {/* Back Navigation Header */}
          <div className="p-3.5 bg-[#0c1445] text-white flex items-center justify-between border-b gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              {/* BACK BUTTON */}
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer flex items-center gap-1 border border-white/10"
                title="Retour à la messagerie"
              >
                <ArrowLeft size={14} />
                <span className="text-[10px] font-bold hidden sm:inline uppercase tracking-wider">Retour</span>
              </button>

              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs uppercase text-teal-300 border border-white/10">
                {selectedRecipientId === '99999999-9999-4999-9999-999999999999' ? 'V' : selectedRecipientNom[0]}
              </div>

              <div>
                <h4 className="text-xs font-bold leading-tight flex items-center gap-1.5">
                  {selectedRecipientNom}
                  {selectedRecipientId === '99999999-9999-4999-9999-999999999999' && (
                    <span className="bg-amber-400 text-[#0c1445] font-black text-[8px] tracking-widest uppercase px-1 py-0.2 rounded-xs">
                      Official
                    </span>
                  )}
                </h4>
                <p className="text-[9px] text-[#4fd1c5] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Canal Sécurisé Actif
                </p>
              </div>
            </div>

            <button
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 border border-white/5 cursor-pointer"
              title="Actualiser les messages"
            >
              <RefreshCw size={12} className={isRefreshing ? "animate-spin" : "animate-spin-slow"} />
            </button>
          </div>

          {/* Messages Feed thread list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 flex flex-col bg-slate-50/50">
            {chatMessages.length > 0 ? (
              chatMessages.map(m => {
                const isMe = m.senderId === user.id;
                const isSystem = m.senderId === '99999999-9999-4999-9999-999999999999';

                return (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-normal shadow-3xs relative ${
                      isMe 
                        ? 'self-end bg-gradient-to-br from-[#0c1445] to-[#1e3a8a] text-white rounded-br-none' 
                        : isSystem
                        ? 'self-start bg-amber-50 border border-amber-200 text-amber-950 font-sans rounded-bl-none shadow-sm'
                        : 'self-start bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                    }`}
                  >
                    {isSystem && (
                      <span className="text-[8px] font-black tracking-widest uppercase text-amber-800 block mb-1.5 border-b border-amber-200 pb-0.5">
                        🛡️ Notification Vendza
                      </span>
                    )}
                    <p className="font-medium whitespace-pre-wrap">{m.text}</p>
                    
                    {/* Simulated image preview */}
                    {m.image && (
                      <div className="w-full aspect-video rounded-xl mt-2 flex items-center justify-center font-bold text-[10px] uppercase border bg-white text-slate-500 shadow-2xs gap-1.5">
                        <Image size={15} className="text-slate-400 animate-pulse" />
                        <span>Preuve Livraison (Modèle Haïtien)</span>
                      </div>
                    )}

                    <span className={`block text-[8px] text-right mt-1.5 font-bold uppercase tracking-wider ${isMe ? 'text-slate-300' : 'text-slate-400'}`}>
                      {formatMessageTime(m.time, m.createdAt)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="my-auto text-center space-y-2 py-12 px-6">
                <span className="text-3xl block">💬</span>
                <p className="text-slate-500 text-xs font-bold">Aucun message pour le moment</p>
                <p className="text-[10px] text-slate-400 tracking-tight leading-relaxed max-w-sm mx-auto">
                  Utilisez la messagerie pour poser des questions, négocier des prix ou synchroniser la logistique de livraison en mains propres.
                </p>
              </div>
            )}
          </div>

          {/* Bottom input actions drawer */}
          {selectedRecipientId === '99999999-9999-4999-9999-999999999999' ? (
            <div className="p-3 bg-amber-50/30 border-t border-amber-100 text-center shrink-0">
              <p className="text-[10px] text-amber-800/80 leading-normal flex items-center justify-center gap-1 font-bold">
                ⚠️ Canal non répondeur : Vous ne pouvez pas envoyer de messages directs à ce robot système.
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-white border-t border-slate-100 space-y-2.5 shrink-0">
              {/* Quick shortcuts widgets */}
              <div className="flex gap-2 border-b border-slate-50 pb-2 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={handleShareOrderUuid}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg text-[9px] font-black tracking-wider uppercase text-blue-600 transition hover:bg-blue-100 cursor-pointer shrink-0"
                >
                  <Ticket size={11} /> Partager ID commande
                </button>
                
                <button
                  type="button"
                  onClick={handleSendSimulateImage}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-black tracking-wider uppercase text-slate-600 transition hover:bg-slate-100 cursor-pointer shrink-0"
                >
                  <Image size={11} /> Photo Preuve Livraison
                </button>
              </div>

              {/* Typing area */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Écrire votre message pour le chat..."
                  className="flex-1 py-2.5 px-3 text-xs bg-slate-50 hover:bg-slate-100/75 focus:bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-[#0c1445] font-sans"
                  value={typedMessage}
                  onChange={e => setTypedMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                
                <button
                  type="button"
                  onClick={handleSend}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white flex items-center justify-center transition cursor-pointer shadow-3xs aspect-square"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
