import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const DraggableAny = Draggable as any;

// Contexto Global para Navegação (Perfil e Sair)
const NavigationContext = React.createContext<{ onLogout: () => void, onProfileClick: () => void } | null>(null);

const SUPABASE_URL = 'https://phjjccakzfwbytcbqvnh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8zEtiqLSMRF_gtsXLnpdLw_0_sPqE-t';

// Inicialização segura do Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Types ---

const useEscapeKey = (callback: () => void, dependencies: any[] = []) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        callback();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, dependencies);
};

type UserAccount = {
  id: string;
  name: string;
  email: string;
  congregation: string;
  phone: string;
  birth_date?: string;
  role: string;
  password: string;
  status: 'pending' | 'authorized' | 'denied' | 'disabled';
  isAdminUser?: boolean;
  isMasterAdmin?: boolean;
  canViewOthers?: boolean;
  canRegister?: boolean;
  canApprove?: boolean;
  canDeleteUser?: boolean;
  canEditProfiles?: boolean;
  canResetPasswords?: boolean;
  canManageLocations?: boolean;
  canEditCRR?: boolean;
  canReadOnlyMode?: boolean;
  canEnableDisableUsers?: boolean;
  canManageMessages?: boolean;
  canSendBulletins?: boolean;
  canChat?: boolean;
  canExportBackups?: boolean;
  managedUserEmails?: string[];
};

type Country = {
  id: string; // "01", "02", etc.
  name: string;
};

type State = {
  id: string;
  name: string;
  uf: string;
};

type CongregationRecord = {
  id: string; // "0001", "0002", etc.
  name: string;
  country_id: string;
  state_id: string;
  address: string;
  neighborhood: string;
  address_number: string;
  cep: string;
};

type Conductor = {
  id: string;
  name: string;
  country_id: string;
  state_id: string;
  congregation_id: string;
  birth_date: string;
  phone: string;
  email: string;
  role_code: 'S' | 'I' | 'R' | 'T' | 'TG';
  registry_number: string;
  created_at?: string;
  owner_email?: string;
};

type Instrument = {
  id: string;
  name: string;
  modality: 'Metal' | 'Palheta' | 'Cordas' | 'Outro';
  timbre: 'Sol' | 'Fá' | 'Dó';
  tuning: string;
  owner_email?: string;
};

type Musician = {
  id: string;
  name: string;
  voices: string[]; 
  instruments: string[]; 
  owner_email?: string;
};

type AttendanceRecord = {
  id: string;
  date: string;
  presentMusicianIds: string[];
  justifications?: Record<string, string>; // { musicianId: text }
  group?: 'Coral' | 'Orquestra' | 'Geral';
  owner_email?: string;
};

type HymnEntry = {
  id?: string;
  notebook: string;
  number: string;
  title: string;
  execution?: string;
  duration?: string; // Tempo no formato flexível
  conductor?: string;
  soloist?: string;
  keyboardist?: string;
  guitarist?: string;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  text: string;
  created_at: string;
  hidden_for_sender: boolean;
  hidden_for_receiver: boolean;
  is_edited?: boolean;
  deleted_for_everyone?: boolean;
  read_at?: string | null;
  status?: 'Ativa' | 'Desativada';
};

type MasterHymn = {
  id: string;
  notebook: string;
  number: string;
  title: string;
  owner_email?: string;
};

type BulletinMessage = {
  id: string;
  title: string;
  content: string; // HTML
  created_at: string;
  created_by: string; // email
};

type BulletinUserStatus = {
  id: string;
  message_id: string;
  user_id: string; // email
  status: 'pending' | 'read';
  show_again: boolean;
  viewed_at?: string;
};

type HymnListType = 'Normal130' | 'Normal200' | 'Oracao' | 'Especial200' | 'Festiva200' | 'Comunhao200' | 'NatalAnoNovo' | 'Outra';

type HymnList = {
  id: string;
  date: string;
  congregation: string;
  type: HymnListType;
  startTime?: string; // Horário de início (HH:MM)
  isDetailed?: boolean;
  owner_email?: string;
  sections: {
    hymnal: HymnEntry[];
    choir: HymnEntry[];
    contributions: HymnEntry[];
    communion?: HymnEntry[]; 
    message: HymnEntry[];
    finalization?: HymnEntry[];
    afterInitialPrayer?: HymnEntry[];
    choirAfterContributions?: HymnEntry[];
    afterIndividualPrayer?: HymnEntry[];
    [key: string]: HymnEntry[] | undefined;
  };
  sectionDurations?: {
    contributions?: string;
    message?: string;
  };
};

// --- Helpers de Persistência ---

const fetchData = async (table: string, localKey: string, ownerEmail?: string) => {
  const cacheKey = `${localKey}_${ownerEmail || 'all'}`;
  try {
    let query = supabase.from(table).select('*');
    if (ownerEmail && !['countries', 'states', 'congregations_admin', 'conductors'].includes(table)) {
      query = query.eq('owner_email', ownerEmail);
    }
    const { data, error } = await query;
    if (error) throw error;
    
    if (data && data.length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    }
    
    const local = localStorage.getItem(cacheKey);
    if (local) {
      const parsedLocal = JSON.parse(local);
      if (parsedLocal && parsedLocal.length > 0) {
        return parsedLocal;
      }
    }
  } catch (err) {
    console.warn(`Fallback para LocalStorage em ${table}:`, err);
  }
  
  const localFallback = localStorage.getItem(cacheKey);
  return localFallback ? JSON.parse(localFallback) : [];
};

const saveData = async (table: string, localKey: string, data: any, ownerEmail?: string) => {
  const cacheKey = `${localKey}_${ownerEmail || 'all'}`;
  const dataToStore = Array.isArray(data) ? data : [data];
  
  let dataToUpsert = dataToStore;
  if (ownerEmail && !['countries', 'states', 'congregations_admin', 'conductors'].includes(table)) {
    dataToUpsert = dataToStore.map(item => ({ ...item, owner_email: ownerEmail }));
  }
    
  localStorage.setItem(cacheKey, JSON.stringify(dataToStore));
  
  try {
    const { error } = await supabase.from(table).upsert(dataToUpsert);
    if (error) {
       console.error(`Erro Supabase em ${table}:`, error.message);
       alert(`Atenção: Os dados de ${table} foram salvos apenas localmente. Erro no Banco: ${error.message}`);
    }
  } catch (err) {
    console.error(`Erro crítico ao sincronizar ${table}:`, err);
  }
};

const deleteRow = async (table: string, localKey: string, id: string, updatedLocalData: any, ownerEmail?: string) => {
  const cacheKey = `${localKey}_${ownerEmail || 'all'}`;
  localStorage.setItem(cacheKey, JSON.stringify(updatedLocalData));
  try {
    await supabase.from(table).delete().eq('id', id);
  } catch (err) {
    console.error(`Erro ao deletar no Supabase em ${table}:`, err);
  }
};

const generateId = () => Math.random().toString(36).substr(2, 9);
const generateNumericPassword = () => Math.floor(100000 + Math.random() * 900000).toString();

const getBrasiliaYYYYMMDD = () => {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
};

const getBrasiliaISO = () => {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
};

const getBrasiliaDate = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
};

const calculateAge = (birthDate: string) => {
  if (!birthDate) return 0;
  const today = getBrasiliaDate();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const MEETING_TYPES: Record<string, string> = {
  Normal130: 'Reunião Normal (Até 1h30min)',
  Normal200: 'Reunião Normal (Até 2h)',
  Oracao: 'Reunião de Oração',
  Especial200: 'Reunião Especial (Até 2h)',
  Festiva200: 'Reunião Festiva (Até 2h)',
  Comunhao200: 'Reunião de Santa Comunhão',
  NatalAnoNovo: 'Natal / Ano Novo',
  Outra: 'Outra',
};

const ROLE_LABELS: Record<string, string> = {
  S: 'Regente da Sede',
  I: 'Regente Itinerante',
  R: 'Regente Regional',
  T: 'Regente Titular',
  TG: 'Regente Titular de Gênero'
};

const NOTEBOOKS: Record<string, string> = {
  "CS": "Coro da Sede", "GC": "Grande Coral", "SOLOS": "Caderno de Solos", 
  "S. ESP.": "Solos Especiais", "C. CAM.": "Coral de Câmara", "CJ": "Coral Jovem", 
  "CIJ": "Coral Infanto Juvenil", "CF": "Coral Feminino", "CM": "Coral Masculino", 
  "MÃES": "Especial Dia das Mães", "HC": "Hinos de Casamento", "H": "Hinos do Hinário", 
  "INST": "Instrumental", "O. CAM": "Orquestra de Câmara", "OV": "Orquestra de Violões", 
  "OC": "Orquestra do Coral", "OH": "Orquestra do Hinário", "OIJA": "Orquestra Infanto Juvenil", 
  "OJ": "Orquestra Jovem", "SC": "Solos Coral", "SE": "Solos Esp. + Orq.", "SEC": "Solos Esp. + Coral"
};

const downloadPDF = (elementId: string, filename: string, orientation: 'portrait' | 'landscape' = 'portrait') => {
  const element = document.getElementById(elementId);
  if (!element) return;
  // @ts-ignore
  if (typeof html2pdf === 'undefined') { window.print(); return; }
  const opt = {
    margin: 5, filename: filename, image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 3, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: orientation }
  };
  // @ts-ignore
  window.html2pdf().set(opt).from(element).save();
};

const downloadHTML = (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${filename}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f3f4f6; padding: 20px; }
        @media print { .no-print { display: none !important; } }
    </style>
</head>
<body>
    <div class="max-w-fit mx-auto">
        ${element.outerHTML}
    </div>
</body>
</html>`;
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const parseTimeToSeconds = (timeStr: string = ''): number => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const cleanStr = timeStr.trim();
  if (!cleanStr) return 0;
  
  const parts = cleanStr.split(':');
  if (parts.length === 1) {
    return (parseInt(parts[0]) || 0) * 60;
  } else if (parts.length === 2) {
    return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  } else if (parts.length >= 3) {
    return (parseInt(parts[0]) || 0) * 3600 + (parseInt(parts[1]) || 0) * 60 + (parseInt(parts[2]) || 0);
  }
  return 0;
};

const formatSecondsToClockTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatSecondsToDurationString = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min ${String(seconds).padStart(2, '0')}seg`;
};

// --- Componentes de Interface ---

const Layout = ({ children, title, onBack, onLogout: propLogout, isReadOnly, onProfileClick: propProfile, onExitImpersonation, widthClass = "max-w-5xl" }: { children?: React.ReactNode, title: string, onBack?: () => void, onLogout?: () => void, isReadOnly?: boolean, onProfileClick?: () => void, onExitImpersonation?: () => void, widthClass?: string }) => {
  const nav = React.useContext(NavigationContext);
  const onLogout = propLogout || nav?.onLogout;
  const onProfileClick = propProfile || nav?.onProfileClick;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {onExitImpersonation && (
        <div className="bg-amber-600 text-white p-2 text-center no-print shadow-inner animate-fade-in">
          <div className={`mx-auto flex items-center justify-center gap-4 text-[10px] sm:text-xs font-black uppercase tracking-widest ${widthClass}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            Ambiente de Visualização (Modo Leitura)
            <button 
              onClick={onExitImpersonation}
              className="bg-white text-amber-700 px-4 py-1.5 rounded-full font-black hover:bg-amber-50 transition-all shadow-md active:scale-95"
            >
              Sair e Voltar ao Admin
            </button>
          </div>
        </div>
      )}
      <header className="bg-indigo-700 text-white p-4 shadow-md no-print">
        <div className={`mx-auto flex items-center justify-between ${widthClass}`}>
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-1 hover:bg-indigo-600 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )}
            <h1 className="text-xl font-bold">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            {isReadOnly && <span className="bg-yellow-400 text-indigo-900 text-[10px] font-black px-2 py-0.5 rounded uppercase">Somente Leitura</span>}
            <div className="text-sm opacity-80 hidden sm:block">CORUS - Gestor de Corais Apostólicos</div>
            <div className="flex items-center gap-2">
              {onProfileClick && (
                <button onClick={onProfileClick} className="p-1 hover:bg-indigo-600 rounded" title="Meu Perfil">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </button>
              )}
              {onLogout && (
                <button onClick={onLogout} className="p-1 hover:bg-red-600 rounded" title="Sair">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className={`flex-1 mx-auto w-full p-4 ${widthClass}`}>
        {children}
      </main>
    </div>
  );
};

const MenuCard = ({ title, desc, icon, onClick }: any) => (
  <button onClick={onClick} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col items-center text-center gap-4 w-full h-full">
    <div className="text-indigo-600 bg-indigo-50 p-4 rounded-full">{icon}</div>
    <div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-gray-500 text-sm mt-1">{desc}</p>
    </div>
  </button>
);

const ConfirmationModal = ({ title, message, onConfirm, onCancel, confirmText = "Confirmar", confirmColor = "bg-indigo-600" }: any) => {
  useEscapeKey(onCancel, [onCancel]);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl p-8 w-full max-sm shadow-2xl text-center">
        <h3 className="text-xl font-black text-gray-900 uppercase mb-4 leading-tight">{title}</h3>
        <p className="text-gray-500 text-sm mb-8">{message}</p>
        <div className="flex gap-4">
          <button onClick={onConfirm} className={`flex-1 ${confirmColor} text-white py-3 rounded-xl font-black uppercase shadow-lg transition-all active:scale-95`}>{confirmText}</button>
          <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black uppercase hover:bg-gray-200 transition-all">Cancelar</button>
        </div>
      </div>
    </div>
  );
};

// --- Componentes Funcionais ---

const HomeScreen = ({ navigate, onLogout, isReadOnly, isAdmin, onProfileClick, onExitImpersonation }: any) => (
  <Layout title="Menu Principal" onLogout={onLogout} isReadOnly={isReadOnly} onProfileClick={onProfileClick} onExitImpersonation={onExitImpersonation}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
      {isAdmin && !onExitImpersonation && <MenuCard title="Painel Admin" desc="Gerenciar Usuários e Acessos" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} onClick={() => navigate('admin_menu')} />}
      <MenuCard title="Componentes" desc="Músicos e Instrumentos" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>} onClick={() => navigate('components')} />
      <MenuCard title="Presença" desc="Chamadas e Histórico" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg>} onClick={() => navigate('attendance')} />
      <MenuCard title="Biblioteca de Hinos" desc="Cadastro por Caderno" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>} onClick={() => navigate('hymns_library')} />
      <MenuCard title="Programações" desc="Geração de Listas" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>} onClick={() => navigate('programs')} />
      <MenuCard title="Meus Avisos" desc="Histórico de Avisos" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>} onClick={() => navigate('bulletin_history')} />
      <MenuCard title="Dados e Backup" desc="Exportar/Importar CSV e JSON" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>} onClick={() => navigate('data_management')} />
    </div>
  </Layout>
);

const DataManagementScreen = ({ onBackupJSON, isExportingJSON, onBackupCSV, isExportingCSV, onImportJSON, onImportCSV, goBack, isReadOnly, onExitImpersonation, canExportBackups }: any) => {
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvTarget, setCsvTarget] = useState('musicians');

  const handleJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportJSON(file);
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportCSV(file, csvTarget);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  return (
    <Layout title="Gerenciamento de Dados" onBack={goBack} onExitImpersonation={onExitImpersonation}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-8">
        {/* Export Section */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6 relative overflow-hidden">
          <h2 className="text-xl font-black text-indigo-900 uppercase tracking-widest border-b pb-4">Exportar Dados</h2>
          <p className="text-gray-500 text-sm italic">
            {canExportBackups ? "Baixe o backup completo do sistema (Acesso Master)." : "Baixe seus dados para backup ou uso em Excel."}
          </p>
          
          <button 
            onClick={onBackupJSON} 
            disabled={isExportingJSON}
            className="w-full flex items-center justify-between p-4 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-all active:scale-95 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>{isExportingJSON ? "Gerando JSON..." : canExportBackups ? "Backup Master (Sistema Completo)" : "Meu Backup (JSON)"}</span>
            </div>
            <span className="text-[10px] uppercase opacity-60">Recomendado</span>
          </button>

          <button 
            onClick={onBackupCSV} 
            disabled={isExportingCSV}
            className="w-full flex items-center justify-between p-4 bg-emerald-50 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>
              <span>{isExportingCSV ? "Gerando CSV..." : "Exportar para Excel (CSV)"}</span>
            </div>
          </button>
        </div>

        {/* Import Section */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-xl font-black text-indigo-900 uppercase tracking-widest border-b pb-4">Importar Dados</h2>
          <p className="text-gray-500 text-sm italic">Restaure um backup ou adicione novos registros.</p>

          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase text-gray-900 block mb-2">Restaurar de arquivo JSON</span>
              <button 
                onClick={() => jsonInputRef.current?.click()}
                disabled={isReadOnly}
                className="w-full flex items-center gap-3 p-4 border-2 border-dashed border-gray-200 rounded-xl font-bold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>Selecionar Backup (.json)</span>
              </button>
              <input ref={jsonInputRef} type="file" accept=".json" onChange={handleJsonFile} className="hidden" />
            </label>

            <div className="pt-4 border-t border-gray-50">
              <span className="text-[10px] font-black uppercase text-gray-900 block mb-2">Importar de planilha CSV</span>
              <div className="flex gap-2 mb-3">
                <select 
                  value={csvTarget} 
                  onChange={e => setCsvTarget(e.target.value)}
                  className="flex-1 border rounded-lg p-2 text-sm font-bold bg-gray-50"
                >
                  <option value="musicians">Músicos</option>
                  <option value="instruments">Instrumentos</option>
                  <option value="master_hymns">Bilbioteca de Hinos</option>
                </select>
                <button 
                  onClick={() => csvInputRef.current?.click()}
                  disabled={isReadOnly}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-gray-700 active:scale-95 disabled:opacity-50"
                >
                  Carregar CSV
                </button>
              </div>
              <input ref={csvInputRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
              <p className="text-[9px] text-gray-400 leading-relaxed">Nota: O CSV deve seguir o formato exato das colunas exportadas pelo sistema.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const ComponentsScreen = ({ navigate, goBack, onExitImpersonation }: any) => (
  <Layout title="Componentes" onBack={goBack} onExitImpersonation={onExitImpersonation}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
      <MenuCard title="Instrumentos" desc="Cadastro e consulta" icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>} onClick={() => navigate('instruments')} />
      <MenuCard title="Músicos" desc="Cadastro de integrantes" icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} onClick={() => navigate('musicians')} />
      <MenuCard title="Relatório" desc="Lista de integrantes (PDF)" icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>} onClick={() => navigate('musician_report_selection')} />
    </div>
  </Layout>
);

const MusicianReportSelectionScreen = ({ navigate, goBack, onExitImpersonation }: any) => {
  const [type, setType] = useState('Geral em Ordem Alfabética');
  const handleGenerate = () => {
    if (type === 'Geral em Ordem Alfabética') navigate('musicians_report');
    if (type === 'Por Voz') navigate('musicians_voice_report');
    if (type === 'Por Instrumento') navigate('musicians_instrument_report');
  };
  return (
    <Layout title="Opções de Relatório" onBack={goBack} onExitImpersonation={onExitImpersonation}>
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 max-w-md mx-auto mt-12 space-y-6">
        <div>
          <label className="block text-sm font-black text-gray-700 uppercase tracking-widest mb-4">Tipo de Relatório</label>
          <select className="w-full border-2 border-gray-100 rounded-lg p-3 text-lg font-medium focus:border-indigo-500 outline-none transition-colors" value={type} onChange={e => setType(e.target.value)}>
            <option value="Geral em Ordem Alfabética">Geral em Ordem Alfabética</option>
            <option value="Por Voz">Por Voz</option>
            <option value="Por Instrumento">Por Instrumento</option>
          </select>
        </div>
        <button onClick={handleGenerate} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">Visualizar Relatório</button>
      </div>
    </Layout>
  );
};

// --- Relatórios de Componentes ---

// --- Relatórios de Cadastros (Instrumentos e Músicos) ---

const InstrumentsReportScreen = ({ goBack, ownerEmail }: any) => {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  useEffect(() => { fetchData('instruments', 'gca_instruments', ownerEmail).then(setInstruments); }, [ownerEmail]);
  const sorted = [...instruments].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-gray-100 p-8 min-h-screen">
      <div className="max-w-[800px] mx-auto mb-4 flex justify-between no-print">
        <button onClick={goBack} className="bg-gray-600 text-white px-4 py-2 rounded">Voltar</button>
        <div className="flex gap-2">
          <button onClick={() => downloadHTML('instruments-report-view', `relatorio-instrumentos.html`)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Salvar HTML</button>
          <button onClick={() => downloadPDF('instruments-report-view', `relatorio-instrumentos.pdf`)} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Gerar PDF</button>
        </div>
      </div>
      <div id="instruments-report-view" className="bg-white p-12 shadow-2xl mx-auto max-w-[210mm] min-h-[297mm]">
        <div className="text-center border-b-2 border-double border-black pb-2 mb-4">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-black">Igreja Apostólica</h1>
          <h2 className="text-xl font-bold mt-1 bg-black text-white inline-block px-6 py-1 uppercase rounded-sm tracking-widest leading-none">Relatório de Instrumentos</h2>
          <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-black border-black border-t pt-2 italic text-center">Relação Geral de Instrumentos Cadastrados • Total: {instruments.length}</div>
        </div>
        <table className="w-full border-collapse">
            <thead>
                <tr className="bg-black text-white text-left uppercase font-black text-[9px]">
                    <th className="px-3 py-2 border border-gray-800">#</th>
                    <th className="px-3 py-2 border border-gray-800">Instrumento</th>
                    <th className="px-3 py-2 border border-gray-800">Modalidade</th>
                    <th className="px-3 py-2 border border-gray-800 text-center">Clave</th>
                    <th className="px-3 py-2 border border-gray-800 text-right">Afinação</th>
                </tr>
            </thead>
            <tbody>
                {sorted.map((i, idx) => (
                    <tr key={i.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2.5 text-[10px] text-black border border-gray-100">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-[10px] border border-gray-100 uppercase text-black">{i.name}</td>
                        <td className="px-3 py-2.5 text-[10px] text-black border border-gray-100 uppercase font-medium">{i.modality}</td>
                        <td className="px-3 py-2.5 text-center text-[10px] text-black border border-gray-100 uppercase font-bold">{i.timbre}</td>
                        <td className="px-3 py-2.5 text-right font-black text-[10px] border border-gray-100 text-black uppercase">
                            {i.tuning}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        
        {instruments.length === 0 && (
            <p className="text-center text-black py-12 italic uppercase font-bold text-xs tracking-widest">Nenhum instrumento cadastrado.</p>
        )}
      </div>
    </div>
  );
};

const MusiciansReportScreen = ({ goBack, ownerEmail }: any) => {
  const [musicians, setMusicians] = useState<Musician[]>([]);
  useEffect(() => { fetchData('musicians', 'gca_musicians', ownerEmail).then(setMusicians); }, [ownerEmail]);
  const sorted = [...musicians].sort((a, b) => a.name.localeCompare(b.name));
  
  return (
    <div className="bg-gray-100 p-8 min-h-screen">
      <div className="max-w-[800px] mx-auto mb-4 flex justify-between no-print">
        <button onClick={goBack} className="bg-gray-600 text-white px-4 py-2 rounded">Voltar</button>
        <div className="flex gap-2">
          <button onClick={() => downloadHTML('musician-report-alpha', `musicos-alfabetico.html`)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Salvar HTML</button>
          <button onClick={() => downloadPDF('musician-report-alpha', `musicos-alfabetico.pdf`)} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Gerar PDF</button>
        </div>
      </div>
      <div id="musician-report-alpha" className="bg-white p-12 shadow-2xl mx-auto max-w-[210mm] min-h-[297mm]">
        <div className="text-center border-b-2 border-double border-black pb-2 mb-4">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-black">Igreja Apostólica</h1>
          <h2 className="text-xl font-bold mt-1 bg-black text-white inline-block px-6 py-1 uppercase rounded-sm tracking-widest leading-none">Relação de Integrantes</h2>
          <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-black border-black border-t pt-2 italic">Ordem Alfabética • Total: {musicians.length} Integrantes</div>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-black text-white text-left uppercase font-black text-[10px]">
              <th className="px-4 py-2 border border-gray-800">Nome do Componente</th>
              <th className="px-4 py-2 border border-gray-800">Voz(es) / Instrumentos</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, idx) => (
              <tr key={m.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 font-black text-black uppercase text-xs border border-gray-100">{m.name}</td>
                <td className="px-4 py-3 text-[10px] font-bold text-black uppercase border border-gray-100 italic">
                  {m.voices.join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MusiciansVoiceReportScreen = ({ goBack, ownerEmail }: any) => {
  const [musicians, setMusicians] = useState<Musician[]>([]);
  useEffect(() => { fetchData('musicians', 'gca_musicians', ownerEmail).then(setMusicians); }, [ownerEmail]);
  const voices = ['Melodia', 'Contralto', 'Tenor', 'Baixo'];
  
  return (
    <div className="bg-gray-100 p-8 min-h-screen">
      <div className="max-w-[800px] mx-auto mb-4 flex justify-between no-print">
        <button onClick={goBack} className="bg-gray-600 text-white px-4 py-2 rounded">Voltar</button>
        <div className="flex gap-2">
          <button onClick={() => downloadHTML('musician-report-voice', `musicos-por-voz.html`)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Salvar HTML</button>
          <button onClick={() => downloadPDF('musician-report-voice', `musicos-por-voz.pdf`)} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Gerar PDF</button>
        </div>
      </div>
      <div id="musician-report-voice" className="bg-white p-12 shadow-2xl mx-auto max-w-[210mm] min-h-[297mm]">
        <div className="text-center border-b-2 border-double border-black pb-2 mb-4">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-black">Igreja Apostólica</h1>
          <h2 className="text-xl font-bold mt-1 bg-black text-white inline-block px-6 py-1 uppercase rounded-sm tracking-widest leading-none">Integrantes por Voz</h2>
          <div className="mt-2 text-xs font-bold uppercase italic text-black border-black border-t pt-2">Total: {musicians.length} Integrantes</div>
        </div>
        
        <div style={{ columns: '2', columnGap: '30px' }}>
          {voices.map(voice => {
            const members = musicians.filter(m => m.voices.includes(voice)).sort((a,b) => a.name.localeCompare(b.name));
            if (members.length === 0) return null;
            return (
              <div key={voice} className="mb-6 break-inside-avoid">
                <h3 className="bg-black text-white px-3 py-1 font-black uppercase text-[10px] mb-2 rounded-sm">{voice} ({members.length})</h3>
                <div className="space-y-1">
                  {members.map(m => (
                    <div key={m.id} className="text-[10px] font-bold text-black border-b border-gray-100 py-1 uppercase truncate">{m.name}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MusiciansInstrumentReportScreen = ({ goBack, ownerEmail }: any) => {
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  useEffect(() => { 
    fetchData('musicians', 'gca_musicians', ownerEmail).then(setMusicians);
    fetchData('instruments', 'gca_instruments', ownerEmail).then(setInstruments);
  }, [ownerEmail]);

  return (
    <div className="bg-gray-100 p-8 min-h-screen">
      <div className="max-w-[800px] mx-auto mb-4 flex justify-between no-print">
        <button onClick={goBack} className="bg-gray-600 text-white px-4 py-2 rounded">Voltar</button>
        <div className="flex gap-2">
          <button onClick={() => downloadHTML('musician-report-instrument', `musicos-por-instrumento.html`)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Salvar HTML</button>
          <button onClick={() => downloadPDF('musician-report-instrument', `musicos-por-instrumento.pdf`)} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Gerar PDF</button>
        </div>
      </div>
      <div id="musician-report-instrument" className="bg-white p-12 shadow-2xl mx-auto max-w-[210mm] min-h-[297mm]">
        <div className="text-center border-b-4 border-double border-indigo-900 pb-6 mb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-indigo-900">Igreja Apostólica</h1>
          <h2 className="text-xl font-bold mt-2 bg-indigo-900 text-white inline-block px-6 py-1 uppercase rounded-sm tracking-widest">Integrantes por Instrumento</h2>
          <div className="mt-4 text-xs font-bold uppercase italic text-gray-500 border-indigo-900 border-t pt-2">Total: {musicians.length} Integrantes</div>
        </div>

        <div style={{ columns: '2', columnGap: '30px' }}>
          {instruments.sort((a,b) => a.name.localeCompare(b.name)).map(inst => {
            const members = musicians.filter(m => m.instruments.includes(inst.id)).sort((a,b) => a.name.localeCompare(b.name));
            if (members.length === 0) return null;
            return (
              <div key={inst.id} className="mb-6 break-inside-avoid">
                <h3 className="bg-indigo-900 text-white px-3 py-1 font-black uppercase text-[10px] mb-2 rounded-sm">{inst.name} ({members.length})</h3>
                <div className="space-y-1">
                  {members.map(m => (
                    <div key={m.id} className="text-[10px] font-bold text-gray-700 border-b border-gray-100 py-1 uppercase truncate">{m.name}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Relatório de Presença ---

const AttendanceReportScreen = ({ goBack, ownerEmail, reportData }: any) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [musicians, setMusicians] = useState<Musician[]>([]);
  
  useEffect(() => {
    const load = async () => {
      const recs = await fetchData('attendance', 'gca_attendance', ownerEmail);
      const musics = await fetchData('musicians', 'gca_musicians', ownerEmail);
      
      const filtered = recs.filter((r: AttendanceRecord) => 
        r.date >= reportData.s && r.date <= reportData.e
      ).sort((a: any, b: any) => a.date.localeCompare(b.date));
      
      let finalMusicians = musics;
      if (reportData.g === 'Coral') {
        finalMusicians = musics.filter((m: Musician) => m.voices && m.voices.length > 0);
      } else if (reportData.g === 'Orquestra') {
        finalMusicians = musics.filter((m: Musician) => m.instruments && m.instruments.length > 0);
      }

      setRecords(filtered);
      setMusicians(finalMusicians);
    };
    load();
  }, [ownerEmail, reportData.s, reportData.e, reportData.g]);

  const sortedMusicians = [...musicians].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-gray-100 p-8 min-h-screen">
      <div className="max-w-[800px] mx-auto mb-4 flex justify-between no-print">
        <button onClick={goBack} className="bg-gray-600 text-white px-4 py-2 rounded">Voltar</button>
        <div className="flex gap-2">
          <button onClick={() => downloadHTML('attendance-report-view', `relatorio-presenca.html`)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Salvar HTML</button>
          <button onClick={() => downloadPDF('attendance-report-view', `relatorio-presenca.pdf`, 'landscape')} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Gerar PDF</button>
        </div>
      </div>
      <div id="attendance-report-view" className="bg-white p-10 shadow-2xl mx-auto max-w-[297mm] min-h-[210mm]">
        <div className="text-center border-b-2 border-double border-black pb-2 mb-4">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-black">Igreja Apostólica</h1>
          <h2 className="text-xl font-bold mt-1 bg-black text-white inline-block px-6 py-1 uppercase rounded-sm tracking-widest leading-none">Relatório de Presença</h2>
          <div className="mt-2 text-[10px] font-bold uppercase italic text-black border-black border-t pt-2 flex justify-between">
            <span>Período: {new Date(reportData.s + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(reportData.e + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
            <span>Grupo: {reportData.g || 'Geral'}</span>
            <span>Filtro: {reportData.t}</span>
          </div>
        </div>

        {records.length === 0 ? (
          <p className="text-center text-black py-12 italic uppercase font-bold text-xs tracking-widest">Nenhum registro encontrado neste período.</p>
        ) : (
          <div className="space-y-8">
            {records.map(r => {
              const presentIds = new Set(r.presentMusicianIds);
              const justifiedMap = r.justifications || {};
              const justifiedIds = new Set(Object.keys(justifiedMap));
              
              let filteredList: Musician[] = [];
              if (reportData.t === 'Todos') {
                filteredList = sortedMusicians;
              } else if (reportData.t === 'Somente Presentes') {
                filteredList = sortedMusicians.filter(m => presentIds.has(m.id));
              } else if (reportData.t === 'Somente Ausentes') {
                filteredList = sortedMusicians.filter(m => !presentIds.has(m.id) && !justifiedIds.has(m.id));
              } else if (reportData.t === 'Somente Justificadas') {
                filteredList = sortedMusicians.filter(m => justifiedIds.has(m.id) && !presentIds.has(m.id));
              }

              return (
                <div key={r.id} className="break-inside-avoid">
                  <h3 className="bg-black text-white px-4 py-1 font-black uppercase text-[10px] mb-2 inline-block rounded-sm tracking-widest leading-none">
                    {new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-black text-white text-[9px] font-black uppercase tracking-widest text-left">
                        <th className="px-3 py-1.5 border border-gray-800 w-1/3">Nome do Componente</th>
                        <th className="px-3 py-1.5 border border-gray-800 w-32 text-center">Status</th>
                        <th className="px-3 py-1.5 border border-gray-800">Justificativa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.map((m, idx) => {
                        const isPresent = presentIds.has(m.id);
                        const isJustified = justifiedIds.has(m.id);
                        const statusText = isPresent ? 'Presente' : isJustified ? 'Justificado' : 'Ausente';
                        const statusColor = isPresent ? 'text-black' : isJustified ? 'text-black' : 'text-black';
                        const justificationText = isJustified ? justifiedMap[m.id] : '-';

                        return (
                          <tr key={m.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                             <td className="px-3 py-2 border border-gray-100 font-bold text-black text-[10px] uppercase">{m.name}</td>
                             <td className="px-3 py-2 border border-gray-100 text-center">
                               <span className={`text-[9px] font-black uppercase ${statusColor}`}>{statusText}</span>
                             </td>
                             <td className="px-3 py-2 border border-gray-100 text-[10px] text-black italic">
                               {justificationText}
                             </td>
                          </tr>
                        );
                      })}
                      {filteredList.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-black italic text-sm">Nenhum músico encontrado para este filtro nesta data.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Relatório de Participação (%) ---

const AttendancePercentageReportScreen = ({ goBack, ownerEmail, reportData }: any) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [musicians, setMusicians] = useState<Musician[]>([]);
  
  useEffect(() => {
    const load = async () => {
      const recs = await fetchData('attendance', 'gca_attendance', ownerEmail);
      const musics = await fetchData('musicians', 'gca_musicians', ownerEmail);
      
      const filtered = recs.filter((r: AttendanceRecord) => 
        r.date >= reportData.s && r.date <= reportData.e
      );
      
      let finalMusicians = musics;
      if (reportData.g === 'Coral') {
        finalMusicians = musics.filter((m: Musician) => m.voices && m.voices.length > 0);
      } else if (reportData.g === 'Orquestra') {
        finalMusicians = musics.filter((m: Musician) => m.instruments && m.instruments.length > 0);
      }

      setRecords(filtered);
      setMusicians(finalMusicians);
    };
    load();
  }, [ownerEmail, reportData.s, reportData.e, reportData.g]);

  const sortedMusicians = [...musicians].sort((a, b) => a.name.localeCompare(b.name));
  const totalCallsInPeriod = records.length;

  return (
    <div className="bg-gray-100 p-8 min-h-screen">
      <div className="max-w-[800px] mx-auto mb-4 flex justify-between no-print">
        <button onClick={goBack} className="bg-gray-600 text-white px-4 py-2 rounded">Voltar</button>
        <div className="flex gap-2">
          <button onClick={() => downloadHTML('attendance-perc-view', `percentual-participacao.html`)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Salvar HTML</button>
          <button onClick={() => downloadPDF('attendance-perc-view', `percentual-participacao.pdf`)} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Gerar PDF</button>
        </div>
      </div>
      <div id="attendance-perc-view" className="bg-white p-12 shadow-2xl mx-auto max-w-[210mm] min-h-[297mm]">
        <div className="text-center border-b-4 border-double border-indigo-900 pb-6 mb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-indigo-900">Igreja Apostólica</h1>
          <h2 className="text-xl font-bold mt-2 bg-indigo-900 text-white inline-block px-6 py-1 uppercase rounded-sm tracking-widest">Participação Proporcional</h2>
          <div className="mt-4 text-[10px] font-bold uppercase italic text-gray-500 border-indigo-900 border-t pt-2 flex justify-between">
            <span>Período: {new Date(reportData.s + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(reportData.e + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
            <span>Grupo: {reportData.g || 'Geral'}</span>
            <span>Chamadas: {totalCallsInPeriod}</span>
          </div>
        </div>

        <table className="w-full border-collapse">
            <thead>
                <tr className="bg-indigo-900 text-white text-left uppercase font-black text-[9px]">
                    <th className="px-3 py-2 border border-indigo-800">Nome do Componente</th>
                    <th className="px-3 py-2 border border-indigo-800 text-center">Pres.</th>
                    <th className="px-3 py-2 border border-indigo-800 text-center">Just.</th>
                    <th className="px-3 py-2 border border-indigo-800 text-center">AUS.</th>
                    <th className="px-3 py-2 border border-indigo-800 text-right">Frequência</th>
                </tr>
            </thead>
            <tbody>
                {sortedMusicians.map((m, idx) => {
                    let presents = 0;
                    let justified = 0;
                    records.forEach(r => {
                        if (r.presentMusicianIds.includes(m.id)) presents++;
                        else if (r.justifications && r.justifications[m.id]) justified++;
                    });
                    
                    const absences = totalCallsInPeriod - (presents + justified);
                    const effectivePresence = presents + justified;
                    const percentage = totalCallsInPeriod > 0 ? (effectivePresence / totalCallsInPeriod) * 100 : 0;
                    const isBelowThreshold = percentage < 70;

                    return (
                        <tr key={m.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50/30'}>
                            <td className={`px-3 py-2.5 font-bold text-[10px] border border-gray-100 uppercase ${isBelowThreshold ? 'text-red-600' : 'text-gray-800'}`}>{m.name}</td>
                            <td className="px-3 py-2.5 text-center text-[10px] text-gray-600 border border-gray-100">{presents}</td>
                            <td className="px-3 py-2.5 text-center text-[10px] text-indigo-600 font-bold border border-gray-100">{justified}</td>
                            <td className={`px-3 py-2.5 text-center text-[10px] border border-gray-100 font-bold ${absences > 0 ? 'text-red-500' : 'text-gray-400'}`}>{absences}</td>
                            <td className={`px-3 py-2.5 text-right font-black text-[11px] border border-gray-100 ${isBelowThreshold ? 'text-red-600' : 'text-indigo-900'}`}>
                                {percentage.toFixed(1)}%
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        
        {totalCallsInPeriod === 0 && (
            <p className="text-center text-gray-400 py-12 italic uppercase font-bold text-xs tracking-widest">Nenhuma chamada registrada no período selecionado.</p>
        )}

        <div className="mt-12 text-[9px] text-gray-400 uppercase font-bold italic border-t pt-4">
            * Justificativas são contabilizadas como presença para fins de frequência.
            <br />
            * AUS. (Ausência) refere-se a faltas sem justificativa.
            <br />
            * Frequência (%) = (Presenças + Justificativas) / Total de Chamadas.
        </div>
      </div>
    </div>
  );
};

// --- Relatório de Caderno ---

const HymnNotebookReportScreen = ({ notebook, goBack, ownerEmail }: any) => {
  const [hymns, setHymns] = useState<MasterHymn[]>([]);
  useEffect(() => {
    fetchData('hymns_library', 'gca_hymns_library', ownerEmail).then(all => {
      setHymns(all.filter((h: any) => h.notebook === notebook.code));
    });
  }, [notebook.code, ownerEmail]);

  const sorted = [...hymns].sort((a, b) => {
    const n1 = parseInt(a.number);
    const n2 = parseInt(b.number);
    if (isNaN(n1) || isNaN(n2)) return a.number.localeCompare(b.number);
    return n1 - n2;
  });

  return (
    <div className="bg-gray-100 p-8 min-h-screen">
      <div className="max-w-[800px] mx-auto mb-4 flex justify-between no-print">
        <button onClick={goBack} className="bg-gray-600 text-white px-4 py-2 rounded">Voltar</button>
        <div className="flex gap-2">
          <button onClick={() => downloadHTML('hymn-notebook-report-view', `hinos-${notebook.code}.html`)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Salvar HTML</button>
          <button onClick={() => downloadPDF('hymn-notebook-report-view', `hinos-${notebook.code}.pdf`)} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Gerar PDF</button>
        </div>
      </div>
      <div id="hymn-notebook-report-view" className="bg-white p-12 shadow-2xl mx-auto max-w-[210mm] min-h-[297mm]">
        <div className="text-center border-b-2 border-double border-black pb-2 mb-4">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-black">Igreja Apostólica</h1>
          <h2 className="text-xl font-bold mt-1 bg-black text-white inline-block px-6 py-1 uppercase rounded-sm tracking-widest leading-none">Biblioteca de Hinos</h2>
          <div className="mt-2 text-[10px] font-bold uppercase italic text-black border-black border-t pt-2">
            Caderno: {notebook.code} - {notebook.name} • Total: {hymns.length} Hinos
          </div>
        </div>
        
        <div style={{ columns: '3', columnGap: '20px' }}>
          {sorted.map(h => (
            <div key={h.id} className="flex gap-2 items-center mb-1.5 break-inside-avoid border-b border-gray-100 pb-1 leading-none">
              <span className="font-black text-black w-8 text-sm">{h.number}</span>
              <span className="font-bold text-black uppercase text-[9px] flex-1 line-clamp-1">{h.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Relatórios do Módulo Admin Master ---

const AdminMasterReportView = ({ id, title, columns, data, goBack }: any) => (
  <div className="bg-gray-100 p-8 min-h-screen">
    <div className="max-w-[800px] mx-auto mb-4 flex justify-between no-print">
      <button onClick={goBack} className="bg-gray-600 text-white px-4 py-2 rounded">Voltar</button>
      <div className="flex gap-2">
        <button onClick={() => downloadHTML(id, `${id}.html`)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Salvar HTML</button>
        <button onClick={() => downloadPDF(id, `${id}.pdf`)} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Gerar PDF</button>
      </div>
    </div>
    <div id={id} className="bg-white p-12 shadow-2xl mx-auto max-w-[210mm] min-h-[297mm]">
      <div className="text-center border-b-2 border-double border-black pb-2 mb-4">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-black">Igreja Apostólica</h1>
        <h2 className="text-xl font-bold mt-1 bg-black text-white inline-block px-6 py-1 uppercase rounded-sm tracking-widest leading-none">{title}</h2>
        <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-black border-black border-t pt-2 italic">Sistema de Gestão Admin Master</div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-black text-white text-left uppercase font-black text-[10px]">
            {columns.map((col: any) => <th key={col.key} className="px-3 py-2 border border-gray-800">{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((item: any, idx: number) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {columns.map((col: any) => (
                <td key={col.key} className="px-3 py-2.5 text-[10px] font-bold text-black border border-gray-100 uppercase">
                  {item[col.key] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// --- Telas de Cadastros Admin (País, Estado, Congregação) ---

const AdminCountriesScreen = ({ goBack, navigate }: any) => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<{ type: 'save' | 'delete', data?: any } | null>(null);

  useEffect(() => { fetchData('countries', 'gca_countries').then(setCountries); }, []);

  useEscapeKey(() => {
    if (confirmingAction) {
      setConfirmingAction(null);
    } else if (showForm) {
      setShowForm(false);
      setEditingId(null);
    } else {
      goBack();
    }
  }, [confirmingAction, showForm, goBack]);

  const prepareSave = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmingAction({ type: 'save' });
  };

  const executeSave = async () => {
    let updated;
    if (editingId) {
      updated = countries.map(c => c.id === editingId ? { ...c, name: name.trim() } : c);
    } else {
      const maxId = countries.reduce((max, c) => Math.max(max, parseInt(c.id) || 0), 0);
      const newId = (maxId + 1).toString().padStart(2, '0');
      updated = [...countries, { id: newId, name: name.trim() }];
    }
    setCountries(updated);
    await saveData('countries', 'gca_countries', updated);
    setName('');
    setEditingId(null);
    setShowForm(false);
    setConfirmingAction(null);
  };

  const executeDelete = async () => {
    if (!confirmingAction?.data) return;
    const id = confirmingAction.data.id;
    const updated = countries.filter(c => c.id !== id);
    setCountries(updated);
    await deleteRow('countries', 'gca_countries', id, updated);
    setConfirmingAction(null);
  };

  return (
    <Layout title="Gerenciar Países" onBack={goBack}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-bold text-gray-700 uppercase">Países Cadastrados</h2>
        <div className="flex gap-2">
          <button onClick={() => navigate('admin_countries_report', countries)} className="bg-gray-100 text-indigo-600 px-4 py-2 rounded font-bold border border-indigo-200">Relatório</button>
          <button onClick={() => { setEditingId(null); setName(''); setShowForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Novo País</button>
        </div>
      </div>

      {confirmingAction?.type === 'save' && (
        <ConfirmationModal 
          title="Confirmar Registro" 
          message={editingId ? "Deseja concluir as edições para este país?" : "Deseja salvar este novo país no sistema?"}
          onConfirm={executeSave}
          onCancel={() => setConfirmingAction(null)}
        />
      )}

      {confirmingAction?.type === 'delete' && (
        <ConfirmationModal 
          title="Excluir País" 
          message={`Deseja excluir permanentemente o país "${confirmingAction.data.name}"?`}
          confirmText="Sim, Excluir"
          confirmColor="bg-red-600"
          onConfirm={executeDelete}
          onCancel={() => setConfirmingAction(null)}
        />
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-xl border mb-6 shadow-sm animate-slide-down">
          <h3 className="font-black text-xs uppercase text-indigo-900 mb-4">{editingId ? 'Editando País' : 'Cadastrando Novo País'}</h3>
          <form onSubmit={prepareSave} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Nome do País</label>
              <input required className="w-full border rounded p-2" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Brasil" />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button type="submit" className="flex-1 bg-green-600 text-white px-6 py-2 rounded font-bold">{editingId ? 'Salvar Alteração' : 'Gravar'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 text-gray-400">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {countries.map(c => (
          <div key={c.id} className="p-4 border-b last:border-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group hover:bg-indigo-50/30">
            <div className="flex items-center flex-1">
              <span className="font-mono bg-gray-50 px-2 py-1 rounded text-indigo-600 font-bold border">{c.id}</span>
              <span className="ml-4 font-bold text-gray-800 uppercase">{c.name}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setEditingId(c.id); setName(c.name); setShowForm(true); }} className="text-indigo-600 font-bold uppercase text-[10px] hover:underline">Editar</button>
              <button onClick={() => setConfirmingAction({ type: 'delete', data: c })} className="text-red-500 font-bold uppercase text-[10px] hover:underline">Excluir</button>
            </div>
          </div>
        ))}
        {countries.length === 0 && <p className="p-12 text-center text-gray-400 italic">Nenhum país cadastrado.</p>}
      </div>
    </Layout>
  );
};

const AdminStatesScreen = ({ goBack, navigate }: any) => {
  const [states, setStates] = useState<State[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', uf: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<{ type: 'save' | 'delete', data?: any } | null>(null);

  useEffect(() => { fetchData('states', 'gca_states').then(setStates); }, []);

  useEscapeKey(() => {
    if (confirmingAction) {
      setConfirmingAction(null);
    } else if (showForm) {
      setShowForm(false);
      setEditingId(null);
    } else {
      goBack();
    }
  }, [confirmingAction, showForm, goBack]);

  const prepareSave = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmingAction({ type: 'save' });
  };

  const executeSave = async () => {
    let updated;
    if (editingId) {
      updated = states.map(s => s.id === editingId ? { ...s, ...formData } : s);
    } else {
      const maxId = states.reduce((max, s) => Math.max(max, parseInt(s.id) || 0), 0);
      const newId = (maxId + 1).toString().padStart(2, '0');
      updated = [...states, { id: newId, ...formData }];
    }
    setStates(updated);
    await saveData('states', 'gca_states', updated);
    setFormData({ name: '', uf: '' });
    setEditingId(null);
    setShowForm(false);
    setConfirmingAction(null);
  };

  const executeDelete = async () => {
    if (!confirmingAction?.data) return;
    const id = confirmingAction.data.id;
    const updated = states.filter(s => s.id !== id);
    setStates(updated);
    await deleteRow('states', 'gca_states', id, updated);
    setConfirmingAction(null);
  };

  return (
    <Layout title="Gerenciar Estados" onBack={goBack}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-bold text-gray-700 uppercase">Estados Cadastrados</h2>
        <div className="flex gap-2">
          <button onClick={() => navigate('admin_states_report', states)} className="bg-gray-100 text-indigo-600 px-4 py-2 rounded font-bold border border-indigo-200">Relatório</button>
          <button onClick={() => { setEditingId(null); setFormData({name: '', uf: ''}); setShowForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Novo Estado</button>
        </div>
      </div>

      {confirmingAction?.type === 'save' && (
        <ConfirmationModal 
          title="Confirmar Registro" 
          message={editingId ? "Deseja concluir as edições para este estado?" : "Deseja salvar este novo estado no sistema?"}
          onConfirm={executeSave}
          onCancel={() => setConfirmingAction(null)}
        />
      )}

      {confirmingAction?.type === 'delete' && (
        <ConfirmationModal 
          title="Excluir Estado" 
          message={`Deseja excluir permanentemente o estado "${confirmingAction.data.name}"?`}
          confirmText="Sim, Excluir"
          confirmColor="bg-red-600"
          onConfirm={executeDelete}
          onCancel={() => setConfirmingAction(null)}
        />
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-xl border mb-6 shadow-sm animate-slide-down">
          <form onSubmit={prepareSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Nome do Estado</label>
              <input required className="w-full border rounded p-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: São Paulo" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">UF (Estado)</label>
              <input required className="w-full border rounded p-2 uppercase" maxLength={2} value={formData.uf} onChange={e => setFormData({...formData, uf: e.target.value.toUpperCase()})} placeholder="SP" />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 px-4 py-2">Cancelar</button>
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded font-bold">{editingId ? 'Salvar Edição' : 'Salvar'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {states.map(s => (
          <div key={s.id} className="p-4 border-b last:border-0 flex flex-col sm:flex-row gap-4 items-start sm:items-center group hover:bg-indigo-50/30">
            <div className="flex items-center flex-1 w-full">
              <span className="font-mono bg-gray-50 px-2 py-1 rounded text-indigo-600 font-bold border">{s.id}</span>
              <span className="flex-1 ml-4 font-bold text-gray-800 uppercase">{s.name}</span>
              <span className="text-gray-400 font-black text-sm uppercase">{s.uf}</span>
            </div>
            <div className="flex gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
              <button onClick={() => { setEditingId(s.id); setFormData({name: s.name, uf: s.uf}); setShowForm(true); }} className="text-indigo-600 font-bold uppercase text-[10px] hover:underline">Editar</button>
              <button onClick={() => setConfirmingAction({ type: 'delete', data: s })} className="text-red-500 font-bold uppercase text-[10px] hover:underline">Excluir</button>
            </div>
          </div>
        ))}
        {states.length === 0 && <p className="p-12 text-center text-gray-400 italic">Nenhum estado cadastrado.</p>}
      </div>
    </Layout>
  );
};

const AdminCongregationsScreen = ({ goBack, navigate }: any) => {
  const [congre, setCongre] = useState<CongregationRecord[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', country_id: '', state_id: '', address: '', neighborhood: '', address_number: '', cep: '', uf: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<{ type: 'save' | 'delete', data?: any } | null>(null);
  
  const [foundCountryName, setFoundCountryName] = useState('');
  const [foundStateName, setFoundStateName] = useState('');

  useEscapeKey(() => {
    if (confirmingAction) {
      setConfirmingAction(null);
    } else if (showForm) {
      setShowForm(false);
      setEditingId(null);
    } else {
      goBack();
    }
  }, [confirmingAction, showForm, goBack]);

  useEffect(() => { 
    fetchData('congregations_admin', 'gca_congregations_admin').then(data => {
      const sorted = data.sort((a: any, b: any) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
      setCongre(sorted);
    });
    fetchData('countries', 'gca_countries').then(setCountries);
    fetchData('states', 'gca_states').then(setStates);
  }, []);

  const handleCountryCodeChange = (code: string) => {
    setFormData({ ...formData, country_id: code });
    const found = countries.find(c => c.id === code);
    setFoundCountryName(found ? found.name : 'Não encontrado');
  };

  const handleStateCodeChange = (code: string) => {
    const found = states.find(s => s.id === code);
    setFormData({ 
      ...formData, 
      state_id: code,
      uf: found ? found.uf : formData.uf
    });
    setFoundStateName(found ? found.name : 'Não encontrado');
  };

  const prepareSave = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmingAction({ type: 'save' });
  };

  const executeSave = async () => {
    let updated;
    const fullName = `${formData.name}/${formData.uf.toUpperCase()}`;
    
    if (editingId) {
      updated = congre.map(c => c.id === editingId ? { ...c, ...formData, name: fullName } : c);
    } else {
      const maxId = congre.reduce((max, c) => Math.max(max, parseInt(c.id) || 0), 0);
      const newId = (maxId + 1).toString().padStart(4, '0');
      updated = [...congre, { id: newId, ...formData, name: fullName }];
    }
    const finalSorted = updated.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
    setCongre(finalSorted);
    await saveData('congregations_admin', 'gca_congregations_admin', finalSorted);
    setFormData({ name: '', country_id: '', state_id: '', address: '', neighborhood: '', address_number: '', cep: '', uf: '' });
    setFoundCountryName('');
    setFoundStateName('');
    setEditingId(null);
    setShowForm(false);
    setConfirmingAction(null);
  };

  const executeDelete = async () => {
    if (!confirmingAction?.data) return;
    const id = confirmingAction.data.id;
    const updated = congre.filter(c => c.id !== id);
    setCongre(updated);
    await deleteRow('congregations_admin', 'gca_congregations_admin', id, updated);
    setConfirmingAction(null);
  };

  const startEdit = (c: CongregationRecord) => {
    setEditingId(c.id);
    const nameParts = c.name.split('/');
    const uf = nameParts.length > 1 ? nameParts[1] : '';
    const nameOnly = nameParts[0].trim();
    setFormData({ name: nameOnly, country_id: c.country_id, state_id: c.state_id, address: c.address, neighborhood: c.neighborhood || '', address_number: c.address_number, cep: c.cep, uf });
    const co = countries.find(x => x.id === c.country_id);
    const st = states.find(x => x.id === c.state_id);
    setFoundCountryName(co ? co.name : '');
    setFoundStateName(st ? st.name : '');
    setShowForm(true);
  };

  const getReportData = () => {
    return congre.map(c => ({
      ...c,
      state: states.find(s => s.id === c.state_id)?.name || '-',
      uf: states.find(s => s.id === c.state_id)?.uf || '-',
      country: countries.find(co => co.id === c.country_id)?.name || '-'
    }));
  };

  return (
    <Layout title="Gerenciar Congregações" onBack={goBack}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-bold text-gray-700 uppercase">Congregações</h2>
        <div className="flex gap-2">
          <button onClick={() => navigate('admin_congregations_report', getReportData())} className="bg-gray-100 text-indigo-600 px-4 py-2 rounded font-bold border border-indigo-200">Relatório</button>
          <button onClick={() => { setEditingId(null); setShowForm(true); setFormData({ name: '', country_id: '', state_id: '', address: '', neighborhood: '', address_number: '', cep: '', uf: '' }); setFoundCountryName(''); setFoundStateName(''); }} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Nova Congregação</button>
        </div>
      </div>

      {confirmingAction?.type === 'save' && (
        <ConfirmationModal 
          title="Confirmar Registro" 
          message={editingId ? "Deseja concluir as edições para esta congregação?" : "Deseja salvar esta nova congregação no sistema?"}
          onConfirm={executeSave}
          onCancel={() => setConfirmingAction(null)}
        />
      )}

      {confirmingAction?.type === 'delete' && (
        <ConfirmationModal 
          title="Excluir Congregação" 
          message={`Deseja excluir permanentemente a congregação "${confirmingAction.data.name}"?`}
          confirmText="Sim, Excluir"
          confirmColor="bg-red-600"
          onConfirm={executeDelete}
          onCancel={() => setConfirmingAction(null)}
        />
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-xl border mb-6 shadow-sm animate-slide-down">
          <form onSubmit={prepareSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3">
              <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Nome da Congregação</label>
              <input required className="w-full border rounded p-3 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Sede Central, Bairro Novo..." />
            </div>
            
            <div>
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Cód. País</label>
              <div className="flex gap-2">
                <input required className="w-20 border rounded p-2 text-center" value={formData.country_id} onChange={e => handleCountryCodeChange(e.target.value)} placeholder="01" />
                <input readOnly className="flex-1 bg-gray-50 border rounded p-2 italic text-gray-500" value={foundCountryName} placeholder="Busca automática..." />
              </div>
            </div>

            <div>
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Cód. Estado</label>
              <div className="flex gap-2">
                <input required className="w-20 border rounded p-2 text-center" value={formData.state_id} onChange={e => handleStateCodeChange(e.target.value)} placeholder="01" />
                <input readOnly className="flex-1 bg-gray-50 border rounded p-2 italic text-gray-500" value={foundStateName} placeholder="Busca automática..." />
              </div>
            </div>

            <div>
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">UF (Estado)</label>
              <input readOnly title="Preenchido automaticamente pelo Cód. Estado" className="w-full border rounded p-2 text-center uppercase bg-gray-50 text-gray-500 font-black" maxLength={2} value={formData.uf} placeholder="--" />
            </div>

            <div>
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">CEP</label>
              <input required className="w-full border rounded p-2" value={formData.cep} onChange={e => setFormData({...formData, cep: e.target.value})} placeholder="00000-000" />
            </div>

            <div className="md:col-span-2">
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Endereço</label>
              <input required className="w-full border rounded p-2" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Rua, Avenida..." />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Nº</label>
              <input required className="w-full border rounded p-2" value={formData.address_number} onChange={e => setFormData({...formData, address_number: e.target.value})} placeholder="123" />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Bairro</label>
              <input required className="w-full border rounded p-2" value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} placeholder="Ex: Centro, Vila Maria..." />
            </div>

            <div className="lg:col-span-3 flex justify-end gap-2 mt-4 border-t pt-4">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 px-4 py-2">Cancelar</button>
              <button type="submit" className="bg-green-600 text-white px-8 py-2 rounded font-bold shadow-md">{editingId ? 'Confirmar Edição' : 'Salvar Congregação'}</button>
            </div>
          </form>
        </div>
      )}
      <div className="space-y-4">
        {congre.map(c => (
          <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center group hover:border-indigo-200 transition-colors gap-4">
            <div className="flex items-start gap-4 flex-1">
              <span className="font-mono bg-gray-50 px-2 py-1 rounded text-indigo-600 font-bold border text-sm">{c.id}</span>
              <div>
                <h3 className="font-black text-indigo-900 uppercase">{c.name}</h3>
                <p className="text-xs text-gray-500 mt-1 font-medium italic">
                  {c.address}, {c.address_number} • {states.find(s => s.id === c.state_id)?.name || 'Desconhecida'} / {countries.find(co => co.id === c.country_id)?.name || 'Desconhecido'}
                </p>
                <span className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded tracking-tighter mt-2 inline-block">CEP: {c.cep}</span>
              </div>
            </div>
            <div className="flex gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
              <button onClick={() => startEdit(c)} className="text-indigo-600 font-bold uppercase text-[10px] hover:underline">Editar</button>
              <button onClick={() => setConfirmingAction({ type: 'delete', data: c })} className="text-red-500 font-bold uppercase text-[10px] hover:underline">Excluir</button>
            </div>
          </div>
        ))}
        {congre.length === 0 && <p className="p-12 text-center text-gray-400 italic">Nenhuma congregação cadastrada.</p>}
      </div>
    </Layout>
  );
};

const AdminRegistrationsSummaryScreen = ({ navigate, goBack, currentUser }: any) => {
  return (
    <Layout title="Módulo de Cadastros" onBack={goBack}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <MenuCard 
          title="País" 
          desc="Gestão de Países de atuação" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>} 
          onClick={() => navigate('admin_countries')} 
        />
        <MenuCard 
          title="Estado" 
          desc="Gestão de Estados e CEPs" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>} 
          onClick={() => navigate('admin_states')} 
        />
        <MenuCard 
          title="Congregação" 
          desc="Vincular Países, Estados e Endereços" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} 
          onClick={() => navigate('admin_congregations')} 
        />
      </div>

      <div className="mt-12 flex justify-center">
        <button onClick={goBack} className="border-2 border-gray-200 text-gray-500 px-12 py-2 rounded-full font-bold hover:bg-gray-100 transition-colors uppercase text-xs">Voltar ao Painel</button>
      </div>
    </Layout>
  );
};

// --- Módulo CRR (Certificado de Registro de Regentes) ---

const AdminConductorCertificatesScreen = ({ navigate, goBack, currentUser }: any) => {
  const [conductors, setConductors] = useState<Conductor[]>([]);
  const [congregations, setCongregations] = useState<CongregationRecord[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState<Conductor | null>(null);

  const isMaster = currentUser.email === 'Admin' || currentUser.isMasterAdmin;
  const canRegister = isMaster || currentUser.canRegister;
  const canEdit = isMaster || currentUser.canEditCRR;

  useEffect(() => { 
    fetchData('conductors', 'gca_conductors').then(setConductors);
    fetchData('congregations_admin', 'gca_congregations_admin').then(setCongregations);
  }, []);

  useEscapeKey(() => {
    if (confirmingDelete) {
      setConfirmingDelete(null);
    } else {
      goBack();
    }
  }, [confirmingDelete, goBack]);

  const executeDelete = async () => {
    if (!confirmingDelete) return;
    const updated = conductors.filter(c => c.id !== confirmingDelete.id);
    setConductors(updated);
    await deleteRow('conductors', 'gca_conductors', confirmingDelete.id, updated);
    setConfirmingDelete(null);
  };

  return (
    <Layout title="CRR - Gestão de Regentes" onBack={goBack}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-bold text-gray-700 uppercase">Lista de Regentes</h2>
        <div className="flex gap-2">
          {canRegister && (
            <button onClick={() => navigate('admin_new_conductor')} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold shadow-md">Novo Registro</button>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmationModal 
          title="Excluir Registro" 
          message={`Deseja excluir permanentemente o regente "${confirmingDelete.name}" e revogar seu acesso?`}
          confirmText="Sim, Excluir"
          confirmColor="bg-red-600"
          onConfirm={executeDelete}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}

      <div className="space-y-4">
        {conductors.map(c => (
          <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group hover:border-indigo-200 transition-colors">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="bg-indigo-700 text-white px-2 py-0.5 rounded font-black text-xs">{c.registry_number}</span>
                <h3 className="font-black text-indigo-900 uppercase">{c.name}</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {ROLE_LABELS[c.role_code]} • {congregations.find(con => con.id === c.congregation_id)?.name || 'Local não identificado'}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => navigate('admin_crr_card', c)} className="flex-1 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-[10px] font-black uppercase border border-indigo-100">Emitir CRR</button>
              {canEdit && (
                <button onClick={() => navigate('admin_edit_conductor', c)} className="flex-1 bg-indigo-600 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase shadow-sm">Editar</button>
              )}
              {canRegister && (
                <button onClick={() => setConfirmingDelete(c)} className="bg-red-50 text-red-700 p-2 rounded text-[10px] font-black uppercase border border-red-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              )}
            </div>
          </div>
        ))}
        {conductors.length === 0 && <p className="p-12 text-center text-gray-400 italic">Nenhum regente registrado até o momento.</p>}
      </div>
    </Layout>
  );
};

const AdminConductorForm = ({ goBack, linkUserBeingApproved, conductorToEdit }: any) => {
  const isEditing = !!conductorToEdit;
  const [formData, setFormData] = useState({ 
    name: conductorToEdit?.name || linkUserBeingApproved?.name || '', 
    country_id: conductorToEdit?.country_id || '', 
    state_id: conductorToEdit?.state_id || '', 
    congregation_id: conductorToEdit?.congregation_id || '', 
    birth_date: conductorToEdit?.birth_date || linkUserBeingApproved?.birth_date || '', 
    phone: conductorToEdit?.phone || linkUserBeingApproved?.phone || '', 
    email: conductorToEdit?.email || linkUserBeingApproved?.email || '', 
    role_code: (conductorToEdit?.role_code || 'T') as any 
  });
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [congre, setCongre] = useState<CongregationRecord[]>([]);
  const [conductors, setConductors] = useState<Conductor[]>([]);
  
  const [foundNames, setFoundNames] = useState({ country: '', state: '', congre: '' });
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectorModal, setSelectorModal] = useState<{ type: 'country' | 'state' | 'congre', list: any[] } | null>(null);
  const [selectorSearch, setSelectorSearch] = useState('');

  useEscapeKey(() => {
    if (selectorModal) {
      setSelectorModal(null);
    } else if (showLinkModal) {
      setShowLinkModal(false);
    } else {
      goBack();
    }
  }, [selectorModal, showLinkModal, goBack]);

  useEffect(() => {
    fetchData('countries', 'gca_countries').then(setCountries);
    fetchData('states', 'gca_states').then(setStates);
    fetchData('congregations_admin', 'gca_congregations_admin').then(setCongre);
    fetchData('conductors', 'gca_conductors').then(setConductors);
    supabase.from('users').select('*').then(({ data }) => setUsers(data || []));
    
    if (isEditing) {
      // Forçar refresh dos nomes associados aos IDs
      const fetchNames = async () => {
        const [cList, sList, cgList] = await Promise.all([
          fetchData('countries', 'gca_countries'),
          fetchData('states', 'gca_states'),
          fetchData('congregations_admin', 'gca_congregations_admin')
        ]);
        const cn = cList.find((x: any) => x.id === formData.country_id)?.name || '';
        const sn = sList.find((x: any) => x.id === formData.state_id)?.name || '';
        const cgn = cgList.find((x: any) => x.id === formData.congregation_id)?.name || '';
        setFoundNames({ country: cn, state: sn, congre: cgn });
      };
      fetchNames();
    }
  }, [isEditing]);

  const lookup = (field: string, val: string) => {
    const nextNames = { ...foundNames };
    if (field === 'country_id') nextNames.country = countries.find(c => c.id === val)?.name || '';
    if (field === 'state_id') nextNames.state = states.find(s => s.id === val)?.name || '';
    if (field === 'congregation_id') nextNames.congre = congre.find(c => c.id === val)?.name || '';
    setFoundNames(nextNames);
    setFormData({ ...formData, [field]: val });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      executeRegistration();
    } else {
      setShowLinkModal(true);
    }
  };

  const executeRegistration = async (linkToUserId?: string) => {
    setIsSaving(true);
    setShowLinkModal(false);

    let regNum = conductorToEdit?.registry_number;
    let newId = conductorToEdit?.id || generateId();

    if (!isEditing) {
      const sameLoc = conductors.filter(c => c.country_id === formData.country_id && c.state_id === formData.state_id && c.congregation_id === formData.congregation_id);
      const counter = sameLoc.length + 1;
      regNum = `${formData.role_code}/${formData.country_id}${formData.state_id}${formData.congregation_id}-${counter}`;
    }

    const updatedConductor: Conductor = { 
      id: newId, 
      ...formData, 
      registry_number: regNum!, 
      created_at: conductorToEdit?.created_at || getBrasiliaISO() 
    };

    try {
      let updatedConductors;
      if (isEditing) {
        updatedConductors = conductors.map(c => c.id === newId ? updatedConductor : c);
      } else {
        updatedConductors = [...conductors, updatedConductor];
      }
      
      await saveData('conductors', 'gca_conductors', updatedConductors);
      
      if (!isEditing) {
        const userIdToLink = linkToUserId || linkUserBeingApproved?.id;

        if (userIdToLink) {
          const existingUser = users.find(u => u.id === userIdToLink);
          if (existingUser) {
            await supabase.from('users').update({ 
              name: formData.name,
              phone: formData.phone,
              role: ROLE_LABELS[formData.role_code],
              congregation: foundNames.congre || 'Sede',
              status: 'authorized'
            }).eq('id', userIdToLink);
          }
          setTempPassword('VINCULADO');
        } else {
          const password = generateNumericPassword();
          const newUser: UserAccount = {
            id: generateId(),
            name: formData.name,
            email: formData.email,
            congregation: foundNames.congre || 'Sede',
            phone: formData.phone,
            role: ROLE_LABELS[formData.role_code],
            password: password,
            status: 'authorized'
          };
          await saveData('users', 'gca_users', newUser);
          setTempPassword(password);
        }
      } else {
        const linkedUser = users.find(u => u.email === conductorToEdit.email);
        if (linkedUser) {
          await supabase.from('users').update({
            name: formData.name,
            phone: formData.phone,
            role: ROLE_LABELS[formData.role_code],
            congregation: foundNames.congre || 'Sede'
          }).eq('id', linkedUser.id);
        }
        goBack();
      }
    } catch (err) {
      alert("Erro ao salvar registro.");
    } finally {
      setIsSaving(false);
    }
  };

  if (tempPassword) {
    const isLinked = tempPassword === 'VINCULADO';
    return (
      <Layout title="Registro Concluído" onBack={goBack}>
        <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-2xl text-center border-t-8 border-green-500 animate-scale-up">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h3 className="text-2xl font-black text-gray-900 uppercase mb-2">Sucesso!</h3>
          <p className="text-gray-500 text-sm mb-8">
            {isLinked ? 'O regente foi registrado e vinculado ao usuário selecionado.' : 'O regente foi registrado e sua conta de acesso foi ativada automaticamente.'}
          </p>
          
          {!isLinked && (
            <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-200 mb-8">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Senha Provisória de Acesso</p>
              <p className="text-4xl font-black text-indigo-700 tracking-[10px]">{tempPassword}</p>
            </div>
          )}

          <button onClick={goBack} className="w-full bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-800 transition-all">Concluir e Voltar</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={isEditing ? "Editar Registro" : "Novo Registro de Regente"} onBack={goBack}>
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-3xl mx-auto animate-fade-in">
        <h3 className="text-xl font-black text-indigo-900 uppercase mb-6 tracking-tighter">{isEditing ? "Atualizar Dados do CRR" : "Inscrição de Regente Oficial"}</h3>
        
        {linkUserBeingApproved && !isEditing && (
          <div className="mb-8 bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-2xl p-6">
            <h4 className="text-xs font-black text-indigo-700 uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              Informações Auxiliares (Dados da Solicitação)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
              <div>
                <span className="text-[8px] font-black text-indigo-400 uppercase block">Nome Solicitado</span>
                <p className="text-xs font-bold text-indigo-900">{linkUserBeingApproved.name}</p>
              </div>
              <div>
                <span className="text-[8px] font-black text-indigo-400 uppercase block">E-mail Informado</span>
                <p className="text-xs font-bold text-indigo-900">{linkUserBeingApproved.email}</p>
              </div>
              <div>
                <span className="text-[8px] font-black text-indigo-400 uppercase block">WhatsApp</span>
                <p className="text-xs font-bold text-indigo-900">{linkUserBeingApproved.phone || 'Não informado'}</p>
              </div>
              <div>
                <span className="text-[8px] font-black text-indigo-400 uppercase block">Congregação</span>
                <p className="text-xs font-bold text-indigo-900">{linkUserBeingApproved.congregation}</p>
              </div>
              <div>
                <span className="text-[8px] font-black text-indigo-400 uppercase block">Cargo no Ministério</span>
                <p className="text-xs font-bold text-indigo-900">{linkUserBeingApproved.role}</p>
              </div>
              <div>
                <span className="text-[8px] font-black text-indigo-400 uppercase block">Data Nasc.</span>
                <p className="text-xs font-bold text-indigo-900">{linkUserBeingApproved.birth_date ? new Date(linkUserBeingApproved.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informada'}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Nome Completo</label>
            <input required className="w-full border rounded p-3 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: João da Silva" />
          </div>

          <div className="space-y-4">
            <div>
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">País (Cód)</label>
              <div className="flex gap-2">
                <div className="relative">
                  <input required className="w-16 border rounded p-2 text-center font-mono" value={formData.country_id} onChange={e => lookup('country_id', e.target.value)} placeholder="01" />
                  <button type="button" onClick={() => { setSelectorModal({ type: 'country', list: countries }); setSelectorSearch(''); }} className="absolute -right-2 -top-2 bg-indigo-600 text-white p-1 rounded-full shadow-sm hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </button>
                </div>
                <input readOnly className="flex-1 bg-gray-50 border rounded p-2 text-xs italic text-gray-400" value={foundNames.country} placeholder="Busca automática..." />
              </div>
            </div>
            <div>
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Estado (Cód)</label>
              <div className="flex gap-2">
                <div className="relative">
                  <input required className="w-16 border rounded p-2 text-center font-mono" value={formData.state_id} onChange={e => lookup('state_id', e.target.value)} placeholder="01" />
                  <button type="button" onClick={() => { setSelectorModal({ type: 'state', list: states }); setSelectorSearch(''); }} className="absolute -right-2 -top-2 bg-indigo-600 text-white p-1 rounded-full shadow-sm hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </button>
                </div>
                <input readOnly className="flex-1 bg-gray-50 border rounded p-2 text-xs italic text-gray-400" value={foundNames.state} placeholder="Busca automática..." />
              </div>
            </div>
            <div>
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Congregação (Cód)</label>
              <div className="flex gap-2">
                <div className="relative">
                  <input required className="w-20 border rounded p-2 text-center font-mono" value={formData.congregation_id} onChange={e => lookup('congregation_id', e.target.value)} placeholder="0001" />
                  <button type="button" onClick={() => { setSelectorModal({ type: 'congre', list: congre }); setSelectorSearch(''); }} className="absolute -right-2 -top-2 bg-indigo-600 text-white p-1 rounded-full shadow-sm hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </button>
                </div>
                <input readOnly className="flex-1 bg-gray-50 border rounded p-2 text-xs italic text-gray-400" value={foundNames.congre} placeholder="Busca automática..." />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Data de Nascimento</label>
              <div className="flex gap-3 items-center">
                <input required type="date" className="flex-1 border rounded p-2" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} />
                <div className="bg-indigo-50 px-3 py-2 rounded text-indigo-700 font-black text-xs text-center border border-indigo-100 min-w-[60px]">
                  {calculateAge(formData.birth_date)} <br/> ANOS
                </div>
              </div>
            </div>
            <div>
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Telefone</label>
              <input required className="w-full border rounded p-2" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(00) 00000-0000" />
            </div>
            <div>
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">E-mail</label>
              <input required type="email" className="w-full border rounded p-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@exemplo.com" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-2">Cargo Específico</label>
            <select required className="w-full border rounded p-3 font-bold bg-indigo-50 border-indigo-100" value={formData.role_code} onChange={e => setFormData({...formData, role_code: e.target.value as any})}>
              <option value="S">S - Regente da Sede</option>
              <option value="I">I - Regente Itinerante</option>
              <option value="R">R - Regente Regional</option>
              <option value="T">T - Regente Titular</option>
              <option value="TG">TG - Regente Titular de Gênero</option>
            </select>
          </div>

          <div className="md:col-span-2 flex gap-4 mt-4 pt-6 border-t">
            <button type="submit" disabled={isSaving} className={`flex-1 bg-indigo-700 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-indigo-100 transition-all active:scale-95 ${isSaving ? 'opacity-50' : 'hover:bg-indigo-800'}`}>
              {isSaving ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Concluir Registro')}
            </button>
            <button type="button" onClick={goBack} className="px-8 bg-gray-50 text-gray-400 font-bold uppercase text-[10px] rounded-xl hover:bg-gray-100">Cancelar</button>
          </div>
        </form>

        {showLinkModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
              <div className="p-8">
                <h3 className="text-xl font-black text-indigo-900 uppercase mb-2">Vincular Usuário?</h3>
                <p className="text-gray-500 text-sm mb-6">Deseja vincular este novo registro a um usuário já cadastrado no sistema ou gerar uma nova conta?</p>
                
                <div className="flex flex-col gap-3">
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <p className="text-[10px] font-black uppercase text-indigo-400 mb-3">Usuários sem CRR vinculado</p>
                    <input 
                      type="text" 
                      placeholder="Buscar por nome ou e-mail..." 
                      className="w-full border rounded-xl p-3 text-sm mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {users
                        .filter(u => u.email !== 'Admin' && !conductors.some(c => c.email === u.email))
                        .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(u => (
                          <label key={u.id} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedUserId === u.id ? 'border-indigo-600 bg-indigo-100/50' : 'border-transparent bg-white hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                              <input 
                                type="radio" 
                                name="linkUser" 
                                className="w-4 h-4 text-indigo-600" 
                                checked={selectedUserId === u.id}
                                onChange={() => setSelectedUserId(u.id)}
                              />
                              <div>
                                <p className="text-xs font-bold text-gray-900">{u.name}</p>
                                <p className="text-[10px] text-gray-400">{u.email}</p>
                              </div>
                            </div>
                            <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-50 px-2 py-1 rounded">{u.congregation}</span>
                          </label>
                        ))
                      }
                      {users.filter(u => u.email !== 'Admin' && !conductors.some(c => c.email === u.email)).length === 0 && (
                        <p className="text-center text-xs text-gray-400 py-4 italic">Nenhum usuário disponível para vínculo.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button 
                      onClick={() => executeRegistration(selectedUserId || undefined)}
                      disabled={!selectedUserId}
                      className={`py-4 rounded-2xl font-black uppercase text-xs transition-all ${selectedUserId ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                      Vincular Selecionado
                    </button>
                    <button 
                      onClick={() => executeRegistration()}
                      className="bg-white border-2 border-indigo-600 text-indigo-600 py-4 rounded-2xl font-black uppercase text-xs hover:bg-indigo-50 transition-all"
                    >
                      Gerar Novo
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => setShowLinkModal(false)}
                    className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-2 hover:text-gray-600"
                  >
                    Voltar ao Formulário
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectorModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[99999] animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
              <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                <h3 className="font-black uppercase tracking-widest text-sm">
                  Selecionar {selectorModal.type === 'country' ? 'País' : selectorModal.type === 'state' ? 'Estado' : 'Congregação'}
                </h3>
                <button onClick={() => setSelectorModal(null)} className="text-white/80 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="p-6">
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Pesquisar..." 
                  className="w-full border-2 border-indigo-50 rounded-xl p-3 mb-4 focus:border-indigo-600 outline-none font-bold uppercase text-xs"
                  value={selectorSearch}
                  onChange={e => setSelectorSearch(e.target.value)}
                />
                <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                  {selectorModal.list
                    .filter(item => item.name.toLowerCase().includes(selectorSearch.toLowerCase()) || item.id.includes(selectorSearch))
                    .map(item => (
                      <button 
                        key={item.id}
                        type="button"
                        onClick={() => {
                          const fieldMap: Record<string, string> = { country: 'country_id', state: 'state_id', congre: 'congregation_id' };
                          lookup(fieldMap[selectorModal.type], item.id);
                          setSelectorModal(null);
                        }}
                        className="w-full text-left p-3 rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                      >
                        <span className="font-bold text-gray-700 group-hover:text-indigo-700">{item.name}</span>
                        <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded font-mono text-[10px] group-hover:bg-indigo-100 group-hover:text-indigo-600 font-bold">{item.id}</span>
                      </button>
                    ))
                  }
                  {selectorModal.list.filter(item => item.name.toLowerCase().includes(selectorSearch.toLowerCase()) || item.id.includes(selectorSearch)).length === 0 && (
                    <p className="text-center text-gray-400 text-xs py-10 italic uppercase font-black tracking-widest opacity-50">Nenhum registro encontrado</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

const CRRCardView = ({ conductor, goBack, navigate }: { conductor: Conductor, goBack: () => void, navigate: any }) => {
  const [stateName, setStateName] = useState<string>('');
  const [congregationName, setCongregationName] = useState<string>('');

  useEffect(() => {
    fetchData('states', 'gca_states').then(list => {
      const found = list.find((s: any) => s.id === conductor.state_id);
      setStateName(found ? found.name : 'Não Informado');
    });
    fetchData('congregations_admin', 'gca_congregations_admin').then(list => {
      const found = list.find((c: any) => c.id === conductor.congregation_id);
      setCongregationName(found ? found.name : 'Não Informada');
    });
  }, [conductor.state_id, conductor.congregation_id]);

  const registrationDate = conductor.created_at ? new Date(conductor.created_at).toLocaleDateString('pt-BR') : '-';

  return (
    <div className="min-h-screen bg-gray-200 p-8 flex flex-col items-center">
      <div className="mb-8 flex gap-4 no-print flex-wrap justify-center">
        <button onClick={goBack} className="bg-gray-700 text-white px-6 py-2 rounded-full font-bold">Voltar</button>
        <button onClick={() => navigate('admin_edit_conductor', conductor)} className="bg-amber-600 text-white px-6 py-2 rounded-full font-bold shadow-lg">Editar Informações</button>
        <button onClick={() => downloadPDF('crr-card-wrapper', `CRR-${conductor.registry_number}.pdf`, 'landscape')} className="bg-indigo-600 text-white px-8 py-2 rounded-full font-bold shadow-lg">Baixar Cartão (PDF)</button>
      </div>

      {/* Folha A4 de Pré-visualização com o Cartão no Centro */}
      <div id="crr-card-wrapper" className="bg-white shadow-2xl mx-auto max-w-[297mm] min-h-[210mm] flex items-center justify-center p-12">
        {/* Carteira Profissional - Formato de Crachá Horizontal Ideal (95mm x 65mm) */}
        <div id="crr-card-body" className="w-[95mm] h-[65mm] bg-white relative overflow-hidden flex flex-col border border-gray-300 rounded-[2mm] font-sans shadow-sm">
        
        {/* Cabeçalho Oficial Centralizado (Sem logos e sem "Sede Mundial") */}
        <div className="bg-white py-3 border-b border-indigo-100 flex flex-col items-center justify-center">
          <h4 className="text-[12px] font-black uppercase text-indigo-950 leading-none mb-0.5">Igreja Apostólica</h4>
          <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest text-center">Brasil - São Paulo/SP</p>
        </div>

        {/* Faixa de Título */}
        <div className="bg-indigo-900 text-white py-1.5 text-center">
          <h2 className="text-[11px] font-black uppercase tracking-[2px]">Registro de Regente</h2>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-indigo-100 pb-1">
              <div className="flex-1">
                <span className="text-[6px] font-black text-gray-900 uppercase block leading-none">Identificação do Regente</span>
                <p className="text-[12px] font-black uppercase text-gray-900 leading-none">{conductor.name}</p>
              </div>
              <div className="text-right ml-4">
                <span className="text-[6px] font-black text-gray-900 uppercase block leading-none">Nº Registro (CRR)</span>
                <p className="text-[12px] font-black text-indigo-950 tracking-[1.5px] leading-none">
                  {conductor.registry_number}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-3 gap-x-6">
              <div>
                <span className="text-[6px] font-black text-gray-900 uppercase block leading-none mb-0.5">Cargo / Função</span>
                <p className="text-[9px] font-black uppercase text-indigo-900 leading-tight">{ROLE_LABELS[conductor.role_code] || 'Regente'}</p>
              </div>
              <div className="text-right">
                <span className="text-[6px] font-black text-gray-900 uppercase block leading-none mb-0.5">Data de Nascimento</span>
                <p className="text-[9px] font-bold text-gray-700">{conductor.birth_date ? new Date(conductor.birth_date).toLocaleDateString('pt-BR') : '-'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[6px] font-black text-gray-900 uppercase block leading-none mb-0.5">Congregação / Unidade de Atendimento</span>
                <p className="text-[10px] font-bold uppercase text-gray-800 leading-tight">{congregationName}</p>
              </div>
            </div>
          </div>

          {/* Rodapé: Data e Assinatura */}
          <div className="flex items-end justify-between mt-auto pt-2 border-t border-gray-100">
            <div className="mb-2">
              <span className="text-[6px] font-black text-gray-900 uppercase block leading-none mb-0.5">Data de Cadastro</span>
              <p className="text-[9px] font-black text-gray-700">{registrationDate}</p>
            </div>
            
            <div className="flex-1 max-w-[60%] flex flex-col items-center">
              <div className="w-full border-t border-gray-400 mt-6 mb-1"></div>
              <p className="text-[7px] font-black text-indigo-900 uppercase tracking-tighter text-center leading-tight">
                Presidente do Conselho Deliberativo
              </p>
            </div>
          </div>
        </div>

        {/* Elementos Estéticos de Segurança */}
        <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-900 opacity-[0.03]"></div>
        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-900 opacity-[0.03]"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-900"></div>
      </div>
    </div>
      
      <p className="mt-8 text-xs text-gray-500 max-w-sm text-center font-medium">
        Tamanho final sugerido: 9,5cm x 6,5cm.<br/>
        Ideal para crachás de identificação oficial e plastificação.
      </p>
    </div>
  );
};

// --- Fim Módulo CRR ---

const InstrumentsScreen = ({ navigate, goBack, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Omit<Instrument, 'id'>>({ name: '', modality: 'Metal', timbre: 'Sol', tuning: '' });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [instrumentToDelete, setInstrumentToDelete] = useState<Instrument | null>(null);

  useEscapeKey(() => {
    if (instrumentToDelete) {
      setInstrumentToDelete(null);
    } else if (showForm) {
      setShowForm(false);
      setEditingId(null);
    } else {
      goBack();
    }
  }, [instrumentToDelete, showForm, goBack]);

  useEffect(() => { fetchData('instruments', 'gca_instruments', ownerEmail).then(setInstruments); }, [ownerEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setSaveError(null);
    const isDuplicate = instruments.some(i => i.id !== editingId && i.name.trim().toLowerCase() === formData.name.trim().toLowerCase() && i.modality === formData.modality && i.timbre === formData.timbre && i.tuning.trim().toLowerCase() === formData.tuning.trim().toLowerCase());
    if (isDuplicate) { setSaveError("Instrumento Já Cadastrado"); return; }
    const newItem = { ...formData, id: editingId || generateId() };
    const updated = editingId ? instruments.map(i => i.id === editingId ? newItem : i) : [...instruments, newItem];
    setInstruments(updated);
    await saveData('instruments', 'gca_instruments', updated, ownerEmail);
    setShowForm(false); setEditingId(null);
    setFormData({ name: '', modality: 'Metal', timbre: 'Sol', tuning: '' });
  };

  const handleEdit = (i: Instrument) => { if (isReadOnly) return; setEditingId(i.id); setFormData({ name: i.name, modality: i.modality, timbre: i.timbre, tuning: i.tuning }); setSaveError(null); setShowForm(true); };
  const confirmDelete = async () => { if (isReadOnly || !instrumentToDelete) return; const id = instrumentToDelete.id; const updated = instruments.filter(i => i.id !== id); setInstruments(updated); await deleteRow('instruments', 'gca_instruments', id, updated, ownerEmail); setInstrumentToDelete(null); };

  return (
    <Layout title="Instrumentos" onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Instrumentos Cadastrados</h2>
        {!isReadOnly && (
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('instruments_report')} 
              className="bg-white text-indigo-600 border border-indigo-600 px-4 py-2 rounded font-bold hover:bg-indigo-50 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M9 11h6"/><path d="M9 19h10"/></svg>
              Relatório
            </button>
            <button onClick={() => { setEditingId(null); setFormData({ name: '', modality: 'Metal', timbre: 'Sol', tuning: '' }); setSaveError(null); setShowForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold hover:bg-indigo-700 transition-colors">Novo</button>
          </div>
        )}
      </div>
      {instrumentToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-gray-900 leading-tight">Deseja Excluir o Instrumento {instrumentToDelete.name} Permanentemente?</h3>
            <div className="flex gap-4">
              <button onClick={confirmDelete} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-md">Sim</button>
              <button onClick={() => setInstrumentToDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors">Não</button>
            </div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">{editingId ? 'Editar Instrumento' : 'Novo Instrumento'}</h3>
            {saveError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative mb-4 text-center text-sm font-bold animate-pulse">{saveError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required placeholder="Nome" className={`w-full border rounded p-2 ${saveError ? 'border-red-500 bg-red-50' : ''}`} value={formData.name} onChange={e => { setFormData({...formData, name: e.target.value}); setSaveError(null); }} />
              <div>
                <p className="text-xs font-bold text-gray-900 uppercase mb-1">Modalidade</p>
                <select className="w-full border rounded p-2" value={formData.modality} onChange={e => setFormData({...formData, modality: e.target.value as any})}>
                  <option value="Metal">Metal</option><option value="Palheta">Palheta</option><option value="Cordas">Cordas</option><option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 uppercase mb-1">Clave</p>
                <select className="w-full border rounded p-2" value={formData.timbre} onChange={e => setFormData({...formData, timbre: e.target.value as any})}>
                  <option value="Sol">Sol</option>
                  <option value="Fá">Fá</option>
                  <option value="Dó">Dó</option>
                </select>
              </div>
              <input required placeholder="Afinação (Sib, Do...)" className={`w-full border rounded p-2 ${saveError ? 'border-red-500 bg-red-50' : ''}`} value={formData.tuning} onChange={e => { setFormData({...formData, tuning: e.target.value}); setSaveError(null); }} />
              <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500">Cancelar</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">{editingId ? 'Atualizar' : 'Salvar'}</button></div>
            </form>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {instruments.map(i => (
          <div key={i.id} className="p-4 border-b last:border-0 flex justify-between items-center hover:bg-gray-50 group">
            <div><p className="font-bold text-gray-800">{i.name}</p><p className="text-xs text-gray-500 uppercase font-bold">{i.modality} • {i.timbre} • {i.tuning}</p></div>
            {!isReadOnly && (
              <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(i)} className="text-indigo-600 font-bold hover:underline">Editar</button>
                <button onClick={() => setInstrumentToDelete(i)} className="text-red-500 font-bold hover:underline">Excluir</button>
              </div>
            )}
          </div>
        ))}
        {instruments.length === 0 && <p className="text-center text-gray-400 py-12 italic">Nenhum instrumento cadastrado.</p>}
      </div>
    </Layout>
  );
};

const MusiciansScreen = ({ navigate, goBack, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Omit<Musician, 'id'>>({ name: '', voices: [], instruments: [] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [musicianToDelete, setMusicianToDelete] = useState<Musician | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEscapeKey(() => {
    if (musicianToDelete) {
      setMusicianToDelete(null);
    } else if (showForm) {
      setShowForm(false);
      setEditingId(null);
    } else {
      goBack();
    }
  }, [musicianToDelete, showForm, goBack]);

  useEffect(() => {
    fetchData('musicians', 'gca_musicians', ownerEmail).then(setMusicians);
    fetchData('instruments', 'gca_instruments', ownerEmail).then(setInstruments);
  }, [ownerEmail]);

  const toggleVoice = (voice: string) => { setSaveError(null); setFormData(prev => ({ ...prev, voices: prev.voices.includes(voice) ? prev.voices.filter(v => v !== voice) : [...prev.voices, voice] })); };
  const addInstrument = (id: string) => { if (!id || formData.instruments.includes(id)) return; setSaveError(null); setFormData(prev => ({ ...prev, instruments: [...prev.instruments, id] })); };
  const removeInstrument = (id: string) => { setSaveError(null); setFormData(prev => ({ ...prev, instruments: formData.instruments.filter(x => x !== id) })); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (formData.voices.length === 0 && formData.instruments.length === 0) { setSaveError("Favor Selecionar ao Menos Uma Voz ou Um Instrumento"); return; }
    const newItem = { ...formData, id: editingId || generateId() };
    const updated = editingId ? musicians.map(m => m.id === editingId ? newItem : m) : [...musicians, newItem];
    setMusicians(updated);
    await saveData('musicians', 'gca_musicians', updated, ownerEmail);
    setShowForm(false); setEditingId(null);
    setFormData({ name: '', voices: [], instruments: [] });
  };

  const handleEdit = (m: Musician) => { if (isReadOnly) return; setEditingId(m.id); setFormData({ name: m.name, voices: m.voices, instruments: m.instruments }); setSaveError(null); setShowForm(true); };
  const confirmDelete = async () => { if (isReadOnly || !musicianToDelete) return; const id = musicianToDelete.id; const updated = musicians.filter(m => m.id !== id); setMusicians(updated); await deleteRow('musicians', 'gca_musicians', id, updated, ownerEmail); setMusicianToDelete(null); };

  return (
    <Layout title="Músicos" onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Integrantes</h2>
        {!isReadOnly && (
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('musicians_report')} 
              className="bg-white text-indigo-600 border border-indigo-600 px-4 py-2 rounded font-bold hover:bg-indigo-50 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M9 11h6"/><path d="M9 19h10"/></svg>
              Relatório
            </button>
            <button onClick={() => { setEditingId(null); setFormData({ name: '', voices: [], instruments: [] }); setSaveError(null); setShowForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold hover:bg-indigo-700 transition-colors">Novo</button>
          </div>
        )}
      </div>
      {musicianToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-gray-900 leading-tight">Deseja Excluir o Musico {musicianToDelete.name} Permanentemente?</h3>
            <div className="flex gap-4">
              <button onClick={confirmDelete} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-md">Sim</button>
              <button onClick={() => setMusicianToDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors">Não</button>
            </div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg my-8">
            <h3 className="text-xl font-bold mb-4">{editingId ? 'Editar Integrante' : 'Novo Integrante'}</h3>
            {saveError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative mb-4 text-center text-sm font-bold animate-pulse">{saveError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required placeholder="Nome Completo" className="w-full border rounded p-2" value={formData.name} onChange={e => { setFormData({...formData, name: e.target.value}); setSaveError(null); }} />
              <div>
                <p className="text-sm font-bold mb-2 text-gray-950">Vozes</p>
                <div className="flex wrap gap-2">
                  {['Melodia', 'Contralto', 'Tenor', 'Baixo'].map(v => (
                    <button key={v} type="button" onClick={() => toggleVoice(v)} className={`px-3 py-1 rounded border transition-colors ${formData.voices.includes(v) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-100 border-gray-200'}`}>{v}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold mb-2 text-gray-950">Instrumentos</p>
                <select className="w-full border rounded p-2 mb-2" onChange={e => addInstrument(e.target.value)}>
                  <option value="">Adicionar instrumento...</option>
                  {instruments.map(i => <option key={i.id} value={i.id}>{i.name} ({i.tuning})</option>)}
                </select>
                <div className="flex wrap gap-2">
                  {formData.instruments.map(id => (
                    <span key={id} className="bg-indigo-50 px-2 py-1 rounded text-xs border border-indigo-200 flex items-center gap-1">
                      {instruments.find(i => i.id === id)?.name}
                      <button type="button" onClick={() => removeInstrument(id)} className="text-indigo-400 font-bold ml-1">×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500">Cancelar</button><button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded font-bold">{editingId ? 'Atualizar' : 'Salvar'}</button></div>
            </form>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {musicians.sort((a,b) => a.name.localeCompare(b.name)).map(m => (
          <div key={m.id} className="p-4 border-b last:border-0 flex justify-between items-center hover:bg-gray-50 group">
            <div><p className="font-bold text-gray-800">{m.name}</p><p className="text-sm text-gray-500">{m.voices.join(', ')} • {m.instruments.map(id => instruments.find(i => i.id === id)?.name).join(', ')}</p></div>
            {!isReadOnly && (
              <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(m)} className="text-indigo-600 font-bold hover:underline">Editar</button>
                <button onClick={() => setMusicianToDelete(m)} className="text-red-500 font-bold hover:underline">Excluir</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
};

const AttendanceMenuScreen = ({ navigate, goBack, isReadOnly, onExitImpersonation }: any) => (
  <Layout title="Presença" onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
      <MenuCard title="Lista de Chamada" desc="Registrar as presenças nos ensaios" icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg>} onClick={() => navigate('roll_call')} />
      <MenuCard title="Registro de Presença" desc="Onde ficam as chamadas salvas" icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} onClick={() => navigate('attendance_history')} />
      <MenuCard title="Relatório de Presença" desc="Gerar relatório em PDF por período" icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/></svg>} onClick={() => navigate('attendance_report_input')} />
      <MenuCard title="Percentual de Participação" desc="Frequência consolidada por músico" icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>} onClick={() => navigate('attendance_percentage_input')} />
    </div>
  </Layout>
);

const AttendanceReportInputScreen = ({ onGenerate, onCancel, isReadOnly, onExitImpersonation }: any) => {
  const [start, setStart] = useState(getBrasiliaYYYYMMDD());
  const [end, setEnd] = useState(getBrasiliaYYYYMMDD());
  const [type, setType] = useState<'Somente Presentes' | 'Somente Ausentes' | 'Somente Justificadas' | 'Todos'>('Todos');
  const [group, setGroup] = useState<'Coral' | 'Orquestra' | 'Geral'>('Geral');
  
  useEscapeKey(onCancel, [onCancel]);
  
  return (
    <Layout title="Relatório de Presença" onBack={onCancel} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
      <div className="bg-white p-8 rounded shadow max-w-md mx-auto mt-12 space-y-6">
        <h3 className="text-xl font-bold border-b pb-4">Filtrar Período</h3>
        <div className="space-y-6">
          <div><label className="block text-base font-bold mb-2 text-gray-950">Data Inicial</label><input type="date" className="w-full border rounded-xl p-3 text-base shadow-sm" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><label className="block text-base font-bold mb-2 text-gray-950">Data Final</label><input type="date" className="w-full border rounded-xl p-3 text-base shadow-sm" value={end} onChange={e => setEnd(e.target.value)} /></div>
          <div>
            <label className="block text-base font-bold mb-2 text-gray-950">Grupo</label>
            <select className="w-full border rounded-xl p-3 text-base shadow-sm" value={group} onChange={e => setGroup(e.target.value as any)}>
              <option value="Geral">Geral (Todos)</option>
              <option value="Coral">Coral (Vozes)</option>
              <option value="Orquestra">Orquestra (Instrumentos)</option>
            </select>
          </div>
          <div><label className="block text-base font-bold mb-2 text-gray-950">Tipo</label><select className="w-full border rounded-xl p-3 text-base shadow-sm" value={type} onChange={e => setType(e.target.value as any)}>
            <option value="Todos">Todos</option>
            <option value="Somente Presentes">Somente Presentes</option>
            <option value="Somente Ausentes">Somente Ausentes</option>
            <option value="Somente Justificadas">Somente Justificadas</option>
          </select></div>
          <div className="flex justify-end gap-2 pt-4"><button onClick={onCancel} className="px-4 py-2 font-bold text-gray-500">Voltar</button><button onClick={() => onGenerate(start, end, type, group)} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">Visualizar Relatório</button></div>
        </div>
      </div>
    </Layout>
  );
};

const RollCallScreen = ({ goBack, editData, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(editData?.presentMusicianIds || []));
  const [justifications, setJustifications] = useState<Record<string, string>>(editData?.justifications || {});
  const [filterGroup, setFilterGroup] = useState<'Coral' | 'Orquestra' | 'Geral' | null>(null);
  
  const [showDateModal, setShowDateModal] = useState(false);
  const [date, setDate] = useState(editData?.date || getBrasiliaYYYYMMDD());
  const [saveError, setSaveError] = useState<string | null>(null);

  // Estados para Justificativa
  const [activeJustifyId, setActiveJustifyId] = useState<string | null>(null);
  const [justifyInputText, setJustifyInputText] = useState('');
  const [justifyError, setJustifyError] = useState<string | null>(null);
  
  const [viewJustifyId, setViewJustifyId] = useState<string | null>(null);
  const [isEditingJustify, setIsEditingJustify] = useState(false);
  const [showConfirmEdit, setShowConfirmEdit] = useState(false);

  const handleBack = () => {
    if (showDateModal) {
      setShowDateModal(false);
    } else if (showConfirmEdit) {
      setShowConfirmEdit(false);
    } else if (activeJustifyId) {
      setActiveJustifyId(null);
    } else if (viewJustifyId) {
      setViewJustifyId(null);
      setIsEditingJustify(false);
    } else if (filterGroup && !editData) {
      setFilterGroup(null);
    } else {
      goBack();
    }
  };

  useEscapeKey(handleBack, [showDateModal, showConfirmEdit, activeJustifyId, viewJustifyId, filterGroup, editData, goBack]);

  useEffect(() => { fetchData('musicians', 'gca_musicians', ownerEmail).then(setMusicians); }, [ownerEmail]);

  const togglePresent = (id: string) => { 
    if (isReadOnly) return; 
    const next = new Set(selected); 
    if (!next.has(id)) {
      next.add(id); 
      const nextJ = { ...justifications };
      delete nextJ[id];
      setJustifications(nextJ);
    }
    setSelected(next); 
  };

  const toggleAbsent = (id: string) => {
    if (isReadOnly) return;
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    }
    const nextJ = { ...justifications };
    delete nextJ[id];
    setJustifications(nextJ);
    setSelected(next);
  };

  const openJustify = (id: string) => {
    if (isReadOnly) return;
    if (justifications[id]) {
        setViewJustifyId(id);
    } else {
        setActiveJustifyId(id);
        setJustifyInputText('');
        setJustifyError(null);
    }
  };

  const saveJustify = () => {
    if (justifyInputText.length < 10) {
      setJustifyError("Favor inserir no mínimo 10 caracteres");
      return;
    }
    const nextJ = { ...justifications, [activeJustifyId!]: justifyInputText };
    setJustifications(nextJ);
    const nextS = new Set(selected);
    nextS.delete(activeJustifyId!);
    setSelected(nextS);
    
    setActiveJustifyId(null);
  };

  const startEditJustify = () => {
    setIsEditingJustify(true);
    setJustifyInputText(justifications[viewJustifyId!] || '');
    setJustifyError(null);
  };

  const handleUpdateJustify = () => {
    if (justifyInputText.length < 10) {
        setJustifyError("Favor inserir no mínimo 10 caracteres");
        return;
    }
    setShowConfirmEdit(true);
  };

  const confirmUpdateJustify = () => {
    const nextJ = { ...justifications, [viewJustifyId!]: justifyInputText };
    setJustifications(nextJ);
    setIsEditingJustify(false);
    setShowConfirmEdit(false);
  };

  const handleSaveClick = () => { if (isReadOnly) return; if (selected.size === 0 && Object.keys(justifications).length === 0) { alert("Registre ao menos uma presença ou justificativa."); return; } setSaveError(null); setShowDateModal(true); };

  const confirmSave = async () => {
    if (isReadOnly) return;
    const all = await fetchData('attendance', 'gca_attendance', ownerEmail);
    const currentGroup = editData?.group || (filterGroup as any);
    const exists = all.some((r: AttendanceRecord) => r.date === date && r.group === currentGroup && r.id !== editData?.id);
    if (exists) { setSaveError(`Já Existe Uma Chamada de ${currentGroup} Nesta Data`); return; }
    const record: AttendanceRecord = { 
        id: editData?.id || generateId(), 
        date, 
        presentMusicianIds: Array.from(selected), 
        justifications,
        group: currentGroup,
        owner_email: ownerEmail 
    };
    const updatedList = editData ? all.map((r: any) => r.id === editData.id ? record : r) : [...all, record];
    await saveData('attendance', 'gca_attendance', updatedList, ownerEmail);
    alert(editData ? 'Chamada atualizada!' : 'Chamada salva!');
    goBack();
  };

  if (!filterGroup && !editData) {
    return (
      <Layout title="Lista de Chamada" onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
        <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-xl border-t-8 border-indigo-600 animate-slide-up text-center">
           <h3 className="text-xl font-black text-indigo-900 uppercase mb-8">O que deseja realizar hoje?</h3>
           <div className="grid grid-cols-1 gap-4 uppercase font-black text-xs">
              <button 
                onClick={() => setFilterGroup('Coral')}
                className="bg-indigo-50 text-indigo-700 p-6 rounded-2xl border-2 border-indigo-100 hover:bg-indigo-100 transition-all flex flex-col items-center gap-2"
              >
                <span className="text-2xl">🎶</span>
                Coral (Somente Vozes)
              </button>
              <button 
                onClick={() => setFilterGroup('Orquestra')}
                className="bg-amber-50 text-amber-700 p-6 rounded-2xl border-2 border-amber-100 hover:bg-amber-100 transition-all flex flex-col items-center gap-2"
              >
                <span className="text-2xl">🎺</span>
                Orquestra (Somente Instrumentos)
              </button>
              <button 
                onClick={() => setFilterGroup('Geral')}
                className="bg-gray-50 text-gray-700 p-6 rounded-2xl border-2 border-gray-100 hover:bg-gray-100 transition-all flex flex-col items-center gap-2"
              >
                <span className="text-2xl">👥</span>
                Geral (Todos os Componentes)
              </button>
           </div>
        </div>
      </Layout>
    );
  }

  const filteredMusicians = musicians.filter(m => {
    if (filterGroup === 'Coral') return m.voices && m.voices.length > 0;
    if (filterGroup === 'Orquestra') return m.instruments && m.instruments.length > 0;
    return true;
  });

  return (
    <Layout title={editData ? "Editar Chamada" : "Lista de Chamada"} onBack={handleBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
           <h3 className="text-lg font-bold">Informe as Presenças {filterGroup ? `(${filterGroup})` : ''}</h3>
           {filterGroup && !editData && (
             <button onClick={() => setFilterGroup(null)} className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100 transition-colors">Trocar Filtro</button>
           )}
        </div>
        <div className="grid grid-cols-1 gap-4">
          {filteredMusicians.sort((a,b) => a.name.localeCompare(b.name)).map(m => {
            const isPresent = selected.has(m.id);
            const hasJustify = !!justifications[m.id];
            
            return (
              <div key={m.id} className="p-4 border rounded bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm relative overflow-hidden">
                <div className="flex-1">
                    <p className="font-bold text-lg text-gray-800">{m.name}</p>
                    <p className="text-sm text-indigo-600 font-medium uppercase tracking-wider">{m.voices.join(' / ')}</p>
                    {hasJustify && (
                        <button 
                            onClick={() => setViewJustifyId(m.id)}
                            className="mt-2 flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-tight hover:bg-blue-100 transition-colors border border-blue-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            Ver Justificativa
                        </button>
                    )}
                </div>
                {!isReadOnly && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button type="button" onClick={() => togglePresent(m.id)} className={`flex-1 sm:w-28 py-3 rounded-lg font-bold text-xs uppercase border transition-all ${isPresent ? 'bg-green-600 border-green-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}>Presente</button>
                    <button type="button" onClick={() => toggleAbsent(m.id)} className={`flex-1 sm:w-28 py-3 rounded-lg font-bold text-xs uppercase border transition-all ${(!isPresent && !hasJustify) ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}>Ausente</button>
                    <button type="button" onClick={() => openJustify(m.id)} className={`flex-1 sm:w-28 py-3 rounded-lg font-bold text-xs uppercase border transition-all ${hasJustify ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}>Justificada</button>
                  </div>
                )}
                {isReadOnly && (
                    <span className={`font-black uppercase text-xs ${isPresent ? 'text-green-600' : hasJustify ? 'text-blue-600' : 'text-red-400'}`}>
                        {isPresent ? 'Presente' : hasJustify ? 'Justificada' : 'Ausente'}
                    </span>
                )}
              </div>
            );
          })}
        </div>
        {!isReadOnly && <button onClick={handleSaveClick} className="w-full bg-indigo-600 text-white py-3 rounded mt-8 font-bold text-lg shadow-lg active:scale-95 transition-transform">Salvar Chamada</button>}
      </div>

      {/* Modal Justificativa (Input) */}
      {activeJustifyId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[110] backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
                <h3 className="text-xl font-black text-indigo-900 uppercase mb-4">Informar Justificativa</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Mínimo 10 caracteres</p>
                {justifyError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold mb-4 border-l-4 border-red-500">{justifyError}</div>}
                <textarea 
                    autoFocus
                    className={`w-full border-2 rounded-xl p-3 h-32 focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${justifyError ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}
                    placeholder="Escreva aqui o motivo da ausência..."
                    value={justifyInputText}
                    onChange={e => { setJustifyInputText(e.target.value); setJustifyError(null); }}
                />
                <div className="flex gap-4 mt-6">
                    <button onClick={saveJustify} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Salvar</button>
                    <button onClick={() => setActiveJustifyId(null)} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black uppercase hover:bg-gray-200 transition-all">Cancelar</button>
                </div>
            </div>
        </div>
      )}

      {/* Modal Justificativa (View/Edit) */}
      {viewJustifyId && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[120] backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-scale-up">
                  <h3 className="text-2xl font-black text-indigo-900 uppercase mb-6 border-b pb-4">Detalhamento</h3>
                  
                  {isEditingJustify ? (
                      <div className="space-y-4">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Editando justificativa</p>
                          {justifyError && <div className="bg-red-50 text-red-600 p-2 rounded-lg text-xs font-bold mb-4 border-l-4 border-red-500">{justifyError}</div>}
                          <textarea 
                              className="w-full border-2 border-indigo-100 rounded-2xl p-4 h-40 focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={justifyInputText}
                              onChange={e => { setJustifyInputText(e.target.value); setJustifyError(null); }}
                          />
                          <div className="flex gap-4">
                            <button onClick={handleUpdateJustify} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-black uppercase">Gravar Edição</button>
                            <button onClick={() => setIsEditingJustify(false)} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black uppercase">Descartar</button>
                          </div>
                      </div>
                  ) : (
                      <>
                        <div className="bg-indigo-50/50 p-6 rounded-2xl mb-8 border border-indigo-50 min-h-[120px]">
                            <p className="text-gray-800 leading-relaxed font-medium italic">"{justifications[viewJustifyId]}"</p>
                        </div>
                        <div className="flex gap-4">
                            {!isReadOnly && <button onClick={startEditJustify} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95">Editar</button>}
                            <button onClick={() => { setViewJustifyId(null); setIsEditingJustify(false); }} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-2xl font-black uppercase hover:bg-gray-200 transition-all">Fechar</button>
                        </div>
                      </>
                  )}
              </div>
          </div>
      )}

      {/* Confirmação de Edição */}
      {showConfirmEdit && (
          <div className="fixed inset-0 bg-indigo-900/40 flex items-center justify-center p-4 z-[130] backdrop-blur-md">
              <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m10.7 18.8 6-6a2 2 0 0 0 0-2.8l-6-6M4.3 12h13.4"/></svg>
                  </div>
                  <h4 className="text-lg font-black text-gray-900 uppercase mb-4 leading-tight">Tem certeza que deseja editar justificativa?</h4>
                  <div className="flex gap-3">
                      <button onClick={confirmUpdateJustify} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase">Sim, alterar</button>
                      <button onClick={() => setShowConfirmEdit(false)} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black uppercase">Não</button>
                  </div>
              </div>
          </div>
      )}

      {showDateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-sm animate-fade-in shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Informar Data</h3>
            {saveError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative mb-4 text-center text-sm font-bold animate-pulse">{saveError}</div>}
            <input type="date" className={`w-full border rounded p-2 mb-6 text-lg focus:ring-2 focus:ring-indigo-500 outline-none ${saveError ? 'border-red-500 bg-red-50' : ''}`} value={date} onChange={e => { setDate(e.target.value); setSaveError(null); }} />
            <div className="flex justify-end gap-3"><button onClick={() => setShowDateModal(false)} className="px-4 py-2 font-semibold text-gray-500">Cancelar</button><button onClick={confirmSave} className="px-6 py-2 bg-indigo-600 text-white rounded font-bold shadow-md hover:bg-indigo-700">Confirmar</button></div>
          </div>
        </div>
      )}
    </Layout>
  );
};

const AttendanceHistoryScreen = ({ goBack, onEdit, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);
  const [filterGroup, setFilterGroup] = useState<'Coral' | 'Orquestra' | 'Geral' | 'Todos'>('Todos');

  const getGroupLabel = (g?: string) => {
    if (g === 'Coral') return 'Ensaios de Coral';
    if (g === 'Orquestra') return 'Ensaio de Orquestra';
    if (g === 'Geral') return 'Ensaio Geral';
    return 'Não Classificado';
  };

  useEscapeKey(() => {
    if (recordToDelete) {
      setRecordToDelete(null);
    } else {
      goBack();
    }
  }, [recordToDelete, goBack]);

  useEffect(() => { fetchData('attendance', 'gca_attendance', ownerEmail).then(setRecords); fetchData('musicians', 'gca_musicians', ownerEmail).then(setMusicians); }, [ownerEmail]);

  const confirmDelete = async () => { if (isReadOnly || !recordToDelete) return; const id = recordToDelete.id; const updated = records.filter(r => r.id !== id); setRecords(updated); await deleteRow('attendance', 'gca_attendance', id, updated, ownerEmail); setRecordToDelete(null); };

  return (
    <Layout title="Registro de Presença" onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-base font-black text-indigo-900 uppercase tracking-widest">Filtrar por Grupo</h3>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            {['Todos', 'Geral', 'Coral', 'Orquestra'].map((g) => (
              <button
                key={g}
                onClick={() => setFilterGroup(g as any)}
                className={`px-6 py-2.5 rounded-full text-sm font-black uppercase transition-all whitespace-nowrap ${filterGroup === g ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {recordToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] animate-fade-in">
            <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold mb-6 text-gray-900 leading-tight">Deseja Excluir a Chamada do Dia {new Date(recordToDelete.date + 'T00:00:00').toLocaleDateString('pt-BR')} Permanentemente?</h3>
              <div className="flex gap-4">
                <button onClick={confirmDelete} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-md">Sim</button>
                <button onClick={() => setRecordToDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors">Não</button>
              </div>
            </div>
          </div>
        )}

        {records
          .filter(r => filterGroup === 'Todos' || r.group === filterGroup)
          .sort((a,b) => b.date.localeCompare(a.date))
          .map(r => {
          const presentIds = new Set(r.presentMusicianIds);
          const justifiedIds = new Set(Object.keys(r.justifications || {}));
          
          const presentList = musicians.filter(m => presentIds.has(m.id)).sort((a, b) => a.name.localeCompare(b.name));
          const justifiedList = musicians.filter(m => justifiedIds.has(m.id) && !presentIds.has(m.id)).sort((a, b) => a.name.localeCompare(b.name));
          const absentList = musicians.filter(m => !presentIds.has(m.id) && !justifiedIds.has(m.id)).sort((a, b) => a.name.localeCompare(b.name));
          
          return (
            <div key={r.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1 ${r.group === 'Coral' ? 'bg-indigo-500' : r.group === 'Orquestra' ? 'bg-amber-500' : 'bg-gray-500'}`}></div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4 gap-4">
                <div>
                  <h3 className="font-black text-2xl text-indigo-900">{new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                  <span className={`inline-block mt-1 text-sm font-black uppercase px-3 py-1 rounded ${r.group === 'Coral' ? 'bg-indigo-50 text-indigo-600' : r.group === 'Orquestra' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-600'}`}>
                    {getGroupLabel(r.group)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                      <span className="text-sm font-bold text-green-600 block uppercase">{r.presentMusicianIds.length} Presentes</span>
                      <span className="text-sm font-bold text-blue-500 block uppercase">{justifiedList.length} Justificadas</span>
                      <span className="text-sm font-bold text-red-500 block uppercase">{absentList.length} Ausentes</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(r)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">{isReadOnly ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>}</button>
                    {!isReadOnly && <button onClick={() => setRecordToDelete(r)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div><h4 className="text-sm font-black text-green-700 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>Presentes ({presentList.length})</h4><div className="space-y-1.5">{presentList.map(m => (<div key={m.id} className="text-base py-1.5 border-b border-green-50 flex justify-between items-center group"><span className="font-bold text-gray-800">{m.name}</span></div>))}</div></div>
                <div><h4 className="text-sm font-black text-blue-700 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>Justificadas ({justifiedList.length})</h4><div className="space-y-1.5">{justifiedList.map(m => (<div key={m.id} className="text-base py-1.5 border-b border-blue-50 flex justify-between items-center group"><span className="font-bold text-gray-800">{m.name}</span></div>))}</div></div>
                <div><h4 className="text-sm font-black text-red-700 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>Ausentes ({absentList.length})</h4><div className="space-y-1.5">{absentList.map(m => (<div key={m.id} className="text-base py-1.5 border-b border-red-50 flex justify-between items-center group"><span className="font-bold text-red-600">{m.name}</span></div>))}</div></div>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
};

const AttendancePercentageInputScreen = ({ onGenerate, onCancel, isReadOnly, onExitImpersonation }: any) => {
  const [start, setStart] = useState(getBrasiliaYYYYMMDD());
  const [end, setEnd] = useState(getBrasiliaYYYYMMDD());
  const [group, setGroup] = useState<'Coral' | 'Orquestra' | 'Geral'>('Geral');
  return (
    <Layout title="Percentual de Participação" onBack={onCancel} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
      <div className="bg-white p-8 rounded shadow max-w-md mx-auto mt-12 space-y-6">
        <h3 className="text-xl font-bold border-b pb-4">Gerar Relatório de Participação</h3>
        <div className="space-y-6">
          <div><label className="block text-base font-bold mb-2 text-gray-950">Data Inicial</label><input type="date" className="w-full border rounded-xl p-3 text-base shadow-sm" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><label className="block text-base font-bold mb-2 text-gray-950">Data Final</label><input type="date" className="w-full border rounded-xl p-3 text-base shadow-sm" value={end} onChange={e => setEnd(e.target.value)} /></div>
          <div>
            <label className="block text-base font-bold mb-2 text-gray-950">Grupo</label>
            <select className="w-full border rounded-xl p-3 text-base shadow-sm" value={group} onChange={e => setGroup(e.target.value as any)}>
              <option value="Geral">Geral (Todos)</option>
              <option value="Coral">Coral (Vozes)</option>
              <option value="Orquestra">Orquestra (Instrumentos)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4"><button onClick={onCancel} className="px-4 py-2 font-bold text-gray-500">Voltar</button><button onClick={() => onGenerate(start, end, group)} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">Gerar Relatório</button></div>
        </div>
      </div>
    </Layout>
  );
};

const HymnsLibraryScreen = ({ navigate, goBack, isReadOnly, onExitImpersonation }: any) => (
  <Layout title="Biblioteca de Hinos" onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 mt-4">
      {Object.entries(NOTEBOOKS).map(([code, name]) => (
        <button key={code} onClick={() => navigate('notebook_detail', { code, name })} className="bg-white border p-4 rounded-lg flex flex-col items-center hover:shadow-md transition-shadow h-full">
          <span className="text-2xl font-bold text-indigo-700">{code}</span><span className="text-[10px] text-center uppercase font-bold mt-1 leading-tight">{name}</span>
        </button>
      ))}
    </div>
  </Layout>
);

const NotebookDetailScreen = ({ notebook, goBack, navigate, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
  const [hymns, setHymns] = useState<MasterHymn[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ number: '', title: '' });
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hymnToDelete, setHymnToDelete] = useState<MasterHymn | null>(null);
  const [validationError, setValidationError] = useState(false);
  const [startZeroError, setStartZeroError] = useState(false);

  useEffect(() => { fetchData('hymns_library', 'gca_hymns_library', ownerEmail).then(all => { setHymns(all.filter((h: any) => h.notebook === notebook.code)); }); }, [notebook.code, ownerEmail]);

  const saveHymn = async (e: React.FormEvent) => {
    e.preventDefault(); if (isReadOnly) return;
    if (formData.number.startsWith('0')) { setStartZeroError(true); return; }
    const isDuplicate = hymns.some(h => (h.number === formData.number || h.title.toLowerCase() === formData.title.toLowerCase()) && h.id !== editingId);
    if (isDuplicate) { setValidationError(true); return; }
    const hymnToSave: MasterHymn = { id: editingId || generateId(), notebook: notebook.code, owner_email: ownerEmail, ...formData };
    const all = await fetchData('hymns_library', 'gca_hymns_library', ownerEmail);
    const updatedAll = editingId ? all.map((h: any) => h.id === editingId ? hymnToSave : h) : [...all, hymnToSave];
    await saveData('hymns_library', 'gca_hymns_library', updatedAll, ownerEmail);
    if (editingId) setHymns(hymns.map(h => h.id === editingId ? hymnToSave : h)); else setHymns([...hymns, hymnToSave]);
    setShowForm(false); setEditingId(null); setValidationError(false); setFormData({ number: '', title: '' });
  };

  const confirmDelete = async () => { if (isReadOnly || !hymnToDelete) return; const id = hymnToDelete.id; const all = await fetchData('hymns_library', 'gca_hymns_library', ownerEmail); const updated = all.filter((h: any) => h.id !== id); await deleteRow('hymns_library', 'gca_hymns_library', id, updated, ownerEmail); setHymns(hymns.filter(h => h.id !== id)); setHymnToDelete(null); };
  const filtered = hymns.filter(h => h.number.includes(search) || h.title.toLowerCase().includes(search.toLowerCase())).sort((a,b) => parseInt(a.number) - parseInt(b.number));

  return (
    <Layout title={`${notebook.code} - ${notebook.name}`} onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <input placeholder="Filtrar hinos..." className="w-full sm:w-64 border rounded p-2" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => navigate('hymn_notebook_report', notebook)} className="flex-1 sm:flex-none bg-gray-600 text-white px-6 py-2 rounded font-bold">Relatório</button>
          {!isReadOnly && <button onClick={() => { setEditingId(null); setFormData({ number: '', title: '' }); setValidationError(false); setShowForm(true); }} className="flex-1 sm:flex-none bg-indigo-600 text-white px-6 py-2 rounded font-bold">Cadastrar Novo</button>}
        </div>
      </div>
      {hymnToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-gray-900 leading-tight">Deseja Excluir o Cadastro do Hino {hymnToDelete.number} - {hymnToDelete.title} Permanentemente?</h3>
            <div className="flex gap-4"><button onClick={confirmDelete} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold shadow-md">Sim</button><button onClick={() => setHymnToDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg font-bold">Não</button></div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="bg-white p-6 rounded shadow mb-6 animate-fade-in">
          <h3 className="font-bold mb-4">{editingId ? 'Editar Hino' : 'Adicionar Hino'}</h3>
          {validationError && <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 font-bold text-sm">Número ou Título Já Cadastrado</div>}
          {startZeroError && <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 font-bold text-sm px-3 py-2">O número do hino não pode começar com zero</div>}
          <form onSubmit={saveHymn} className="flex flex-col sm:flex-row gap-4">
            <input required placeholder="Nº" className={`w-full sm:w-24 border rounded p-2 transition-colors ${validationError || startZeroError ? 'border-red-500 bg-red-50' : ''}`} value={formData.number} onChange={e => { setFormData({...formData, number: e.target.value}); setValidationError(false); setStartZeroError(false); }} />
            <input required placeholder="Título" className={`flex-1 border rounded p-2 transition-colors ${validationError ? 'border-red-500 bg-red-50' : ''}`} value={formData.title} onChange={e => { setFormData({...formData, title: e.target.value}); setValidationError(false); }} />
            <div className="flex gap-2"><button type="submit" className="flex-1 bg-indigo-600 text-white px-6 py-2 rounded font-bold">{editingId ? 'Atualizar' : 'Salvar'}</button><button type="button" onClick={() => { setShowForm(false); setEditingId(null); setValidationError(false); }} className="px-4 py-2 border rounded">Cancelar</button></div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filtered.map(h => (
          <div key={h.id} className="flex justify-between items-center p-4 border-b last:border-0 hover:bg-gray-50 group">
            <div className="flex items-center gap-4"><span className="font-bold text-indigo-700 text-lg w-12">{h.number}</span><span className="font-medium">{h.title}</span></div>
            {!isReadOnly && (
              <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingId(h.id); setFormData({ number: h.number, title: h.title }); setValidationError(false); setShowForm(true); }} className="text-indigo-600 font-bold hover:underline">Editar</button>
                <button onClick={() => setHymnToDelete(h)} className="text-red-400 font-bold hover:underline">Excluir</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
};

const ProgramsScreen = ({ navigate, goBack, isReadOnly, onExitImpersonation }: any) => (
  <Layout title="Programações" onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
      <MenuCard title="Orientações" desc="Regras de elaboração" icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>} onClick={() => navigate('guidelines')} />
      <MenuCard title="Nova Lista" desc="Gerar programa de hinos" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/></svg>} onClick={() => navigate('hymn_lists')} />
      <MenuCard title="Relatórios de Hinos" desc="Uso de hinos por período" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 18v-4"/><path d="M12 18v-7"/><path d="M16 18v-2"/></svg>} onClick={() => navigate('hymn_report_input')} />
    </div>
  </Layout>
);

const GuidelinesScreen = ({ goBack, onExitImpersonation }: any) => (
  <Layout title="Diretrizes de Programação" onBack={goBack} onExitImpersonation={onExitImpersonation}>
    <div className="bg-white p-8 rounded-lg shadow prose max-w-none space-y-8">
      <h2 className="text-2xl font-bold text-indigo-900 border-b pb-4">Diretrizes da Igreja Apostólica</h2>
      
      <section>
        <h3 className="font-bold text-lg text-indigo-700">Reuniões Normais (1h30min):</h3>
        <p className="text-gray-600">4 hinos: 2 após hinos do hinário, 1 após contribuições e 1 para finalizar.</p>
      </section>
      
      <section>
        <h3 className="font-bold text-lg text-indigo-700">Reuniões Normais (2h):</h3>
        <p className="text-gray-600">5 hinos: 2 após hinos do hinário, 2 após contribuições e 1 para finalizar.</p>
      </section>

      <section>
        <h3 className="font-bold text-lg text-indigo-700">Reuniões de Oração:</h3>
        <p className="text-gray-600">O pastor deverá iniciar a reunião e antes da oração será cantado o numero 1 do hinário. Após a oração inicial deverá be cantado o hino nº 82 ou 180 do hinário. Na sequencia o coral apresentará 1 ou 2 hinos, o pastor farmá o levantamento das contribuições e o coral cantará mais 1 ou 2 hinos. O pastor fará a leitura e explicação da mensagem, após devera ser cantado um dos hinos nº 83 ou 84, 85, 107, 122, 172, 174, 176, 178, do hinário. Em seguida será a oração individual e após será cantando um dos hinos nº 81 ou 86, 116, 117, 118, 119, 120, 121, 173, 175, 177, 179, 186, 230, do hinário. Então a reunião deverá ser encerrada (não pode passar das 21hrs)</p>
      </section>

      <section>
        <h3 className="font-bold text-lg text-indigo-700">Reuniões Especiais (2h):</h3>
        <p className="text-gray-600">Até 6 hinos: 3 após hinos do hinário, 2 após contribuições e 1 para finalizar. (Obs: Reuniões especiais são para dias como primeiro dia do ano, Corpus Christi, etc.)</p>
      </section>

      <section>
        <h3 className="font-bold text-lg text-indigo-700">Reunião festiva (2h):</h3>
        <p className="text-gray-600">Entre 8 e 10 hinos (a depender da extensão dos hinos): 5 á 7 após hinos do hinário, 2 após contribuições e 1 para finalizar.</p>
      </section>

      <section>
        <h3 className="font-bold text-lg text-indigo-700">Santa Comunhão (2h á 2h30min):</h3>
        <p className="text-gray-600">Entre 10 e 12 hinos (a depender da extensão dos hinos): 8 á 10 após hinos do hinário (1 hora de apresentação), 2 após as contribuições (sendo o segundo exclusivo de comunhão), hinos do hinário para destapar a mesa são obrigatoriamente os nº 87, 90 ou 114 e para finalizar cantar o hino nº 57 do hinário.</p>
      </section>
    </div>
  </Layout>
);

const HymnListScreen = ({ goBack, onCreate, onEdit, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
  const [lists, setLists] = useState<HymnList[]>([]);
  const [viewing, setViewing] = useState<HymnList | null>(null);
  const [listToDelete, setListToDelete] = useState<HymnList | null>(null);

  useEffect(() => { fetchData('hymn_lists', 'gca_hymn_lists', ownerEmail).then(setLists); }, [ownerEmail]);

  const confirmDelete = async () => { if (isReadOnly || !listToDelete) return; const id = listToDelete.id; const updated = lists.filter(l => l.id !== id); setLists(updated); await deleteRow('hymn_lists', 'gca_hymn_lists', id, updated, ownerEmail); setListToDelete(null); };

  const shareLink = (l: HymnList) => {
    const url = window.location.origin + window.location.pathname + "?program=" + l.id;
    const text = `Confira a programação do dia ${new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')} - ${l.congregation}`;
    
    if (navigator.share) {
      navigator.share({ title: 'Programa CORUS', text: text, url: url }).catch(() => {
        navigator.clipboard.writeText(url);
        alert('Link do programa copiado para a área de transferência!');
      });
    } else {
      navigator.clipboard.writeText(url);
      alert('Link do programa copiado para a área de transferência!');
    }
  };

  if (viewing) return <PrintView list={viewing} onBack={() => setViewing(null)} onExitImpersonation={onExitImpersonation} />;

  return (
    <Layout title="Listas de Hinos" onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
      {listToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-gray-900 leading-tight">Deseja Excluir a Programação do Dia {new Date(listToDelete.date + 'T00:00:00').toLocaleDateString('pt-BR')} Permanentemente?</h3>
            <div className="flex gap-4"><button onClick={confirmDelete} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold shadow-md">Sim</button><button onClick={() => setListToDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg font-bold">Não</button></div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-semibold">Histórico</h2>{!isReadOnly && <button onClick={onCreate} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold shadow">Nova Lista</button>}</div>
      <div className="space-y-4">
        {lists.sort((a,b) => b.date.localeCompare(a.date)).map(l => (
          <div key={l.id} className="bg-white p-4 rounded shadow flex justify-between items-center hover:bg-gray-50 transition-colors">
            <div><p className="font-bold text-indigo-900">{new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p><p className="text-sm text-gray-500">{l.congregation} • {MEETING_TYPES[l.type]}</p></div>
            <div className="flex gap-4">
              <button onClick={() => shareLink(l)} className="text-green-600 font-bold hover:underline flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                Compartilhar
              </button>
              <button onClick={() => setViewing(l)} className="text-indigo-600 font-bold hover:underline">Ver PDF</button>
              <button onClick={() => onEdit(l)} className="text-blue-600 font-bold hover:underline">{isReadOnly ? 'Ver Detalhes' : 'Editar'}</button>
              {!isReadOnly && <button onClick={() => setListToDelete(l)} className="text-red-600 font-bold hover:underline">Excluir</button>}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
};

const CreateHymnListScreen = ({ onSave, onCancel, initialData, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
  const [data, setData] = useState<Partial<HymnList>>(initialData || { date: getBrasiliaYYYYMMDD(), congregation: '', type: 'Normal130', startTime: '19:00:00', isDetailed: false, owner_email: ownerEmail, sections: { hymnal: [], choir: [], contributions: [], message: [] }, sectionDurations: { contributions: '', message: '' } });
  const [showErrorMsg, setShowErrorMsg] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [libraryHymns, setLibraryHymns] = useState<MasterHymn[]>([]);
  const [searchModalHymns, setSearchModalHymns] = useState<{ sec: string, idx: number, notebook: string } | null>(null);
  const [hymnSearchTerm, setHymnSearchTerm] = useState('');
  const [notebookError, setNotebookError] = useState<{ sec: string, idx: number } | null>(null);
  const isFirstRun = useRef(!initialData);

  useEffect(() => {
    fetchData('hymns_library', 'gca_hymns_library', ownerEmail).then(setLibraryHymns);
  }, [ownerEmail]);

  useEscapeKey(() => {
    if (searchModalHymns) {
      setSearchModalHymns(null);
    } else {
      onCancel();
    }
  }, [searchModalHymns, onCancel]);

  useEffect(() => {
    if (!isFirstRun.current) return;
    isFirstRun.current = false;
    let counts = { h: 5, c: 2, co: 1, m: 1 };
    if (data.type === 'Normal200') counts = { h: 5, c: 2, co: 2, m: 1 }; else if (data.type === 'Especial200') counts = { h: 1, c: 3, co: 2, m: 1 }; else if (data.type === 'Festiva200') counts = { h: 1, c: 7, co: 2, m: 1 }; else if (data.type === 'Comunhao200') counts = { h: 1, c: 10, co: 2, m: 1 }; else if (data.type === 'NatalAnoNovo') counts = { h: 1, c: 1, co: 1, m: 1 }; else if (data.type === 'Outra') counts = { h: 5, c: 2, co: 1, m: 1 };
    const empty = (n: number, defNb: string = 'Caderno') => Array(n).fill(null).map(() => ({ id: generateId(), notebook: defNb, number: '', title: '', execution: '', duration: '', conductor: '', soloist: '', keyboardist: '', guitarist: '' }));
    const buildSections = async () => {
      const all = await fetchData('hymns_library', 'gca_hymns_library', ownerEmail);
      const findTitle = (num: string, nb: string) => all.find((h: any) => h.notebook === nb && h.number === num)?.title || '';
      let sections: any = { hymnal: empty(counts.h, 'H'), choir: empty(counts.c), contributions: empty(counts.co), message: empty(counts.m) };
      if (data.type === 'Oracao') {
        sections = { hymnal: [{ id: generateId(), notebook: 'H', number: '1', title: findTitle('1', 'H') || 'Igreja Forte', execution: '', duration: '', conductor: '', soloist: '', keyboardist: '', guitarist: '' }], afterInitialPrayer: [{ id: generateId(), notebook: 'H', number: '', title: '', execution: '', duration: '', conductor: '', soloist: '', keyboardist: '', guitarist: '' }], choir: empty(2), choirAfterContributions: empty(2), message: [{ id: generateId(), notebook: 'H', number: '', title: '', execution: '', duration: '', conductor: '', soloist: '', keyboardist: '', guitarist: '' }], afterIndividualPrayer: [{ id: generateId(), notebook: 'H', number: '', title: '', execution: '', duration: '', conductor: '', soloist: '', keyboardist: '', guitarist: '' }] };
      } else {
        if (sections.hymnal.length > 0) sections.hymnal[0] = { id: generateId(), notebook: 'H', number: '1', title: findTitle('1', 'H') || 'Igreja Forte', execution: '', duration: '', conductor: '', soloist: '', keyboardist: '', guitarist: '' };
        if (data.type === 'Comunhao200') { sections.message = [{ id: generateId(), notebook: 'H', number: '', title: '', execution: '', duration: '', conductor: '', soloist: '', keyboardist: '', guitarist: '' }]; sections.finalization = [{ id: generateId(), notebook: 'H', number: '57', title: findTitle('57', 'H') || 'Vitória', execution: '', duration: '', conductor: '', soloist: '', keyboardist: '', guitarist: '' }]; }
      }
      for (let sec in sections) { sections[sec] = await Promise.all(sections[sec].map(async (e: any) => { const found = all.find((h: any) => h.notebook === e.notebook && h.number === e.number); return found ? { ...e, title: found.title, id: e.id || generateId() } : { ...e, id: e.id || generateId() }; })); }
      setData(prev => ({ ...prev, sections }));
    };
    buildSections();
  }, [data.type, ownerEmail]);

  const update = async (sec: string, idx: number, field: string, val: string) => {
    if (isReadOnly) return;
    const s = [...(data.sections![sec] || [])]; s[idx] = { ...s[idx], [field]: val };
    if ((field === 'number' || field === 'notebook') && s[idx].notebook && s[idx].notebook !== 'Caderno' && s[idx].number) {
      const all = await fetchData('hymns_library', 'gca_hymns_library', ownerEmail);
      const found = all.find((h: any) => h.notebook === s[idx].notebook && h.number === s[idx].number);
      s[idx].title = found ? found.title : '';
    }
    setData({ ...data, sections: { ...data.sections!, [sec]: s } });
    if (validationErrors.length > 0) {
      setValidationErrors(prev => prev.filter(err => !err.startsWith(`${sec}-${idx}`)));
    }
  };

  const addRow = (sec: string) => {
    if (isReadOnly) return;
    const newRow = { id: generateId(), notebook: 'Caderno', number: '', title: '', execution: '', duration: '', conductor: '', soloist: '', keyboardist: '', guitarist: '' };
    setData({ ...data, sections: { ...data.sections!, [sec]: [...(data.sections![sec] || []), newRow] } });
  };

  const removeRow = (sec: string, idx: number) => {
    if (isReadOnly) return;
    const s = [...(data.sections![sec] || [])];
    s.splice(idx, 1);
    setData({ ...data, sections: { ...data.sections!, [sec]: s } });
  };

  const openHymnSearch = (sec: string, idx: number, notebook: string) => {
    if (isReadOnly) return;
    if (!notebook || notebook === 'Caderno') {
      setNotebookError({ sec, idx });
      setTimeout(() => setNotebookError(null), 3000);
      return;
    }
    setNotebookError(null);
    setSearchModalHymns({ sec, idx, notebook });
    setHymnSearchTerm('');
  };

  const selectHymnFromSearch = (number: string) => {
    if (!searchModalHymns) return;
    update(searchModalHymns.sec, searchModalHymns.idx, 'number', number);
    setSearchModalHymns(null);
  };

  const onDragEnd = (result: any) => {
    if (!result.destination || isReadOnly) return;
    const { source, destination } = result;
    const sourceSec = source.droppableId;
    const destSec = destination.droppableId;

    if (sourceSec === destSec && source.index === destination.index) return;
    
    const newSections = { ...data.sections! };
    const sourceEntries = [...(newSections[sourceSec] || [])];
    const [movedItem] = sourceEntries.splice(source.index, 1);
    
    if (sourceSec === destSec) {
      sourceEntries.splice(destination.index, 0, movedItem);
      newSections[sourceSec] = sourceEntries;
    } else {
      const destEntries = [...(newSections[destSec] || [])];
      destEntries.splice(destination.index, 0, movedItem);
      newSections[sourceSec] = sourceEntries;
      newSections[destSec] = destEntries;
    }
    
    setData({ ...data, sections: newSections });
    if (validationErrors.length > 0) {
      setValidationErrors([]); // Clear to avoid index mismatch
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (isReadOnly) return;
    const allLibraryHymns = await fetchData('hymns_library', 'gca_hymns_library', ownerEmail);
    let hasError = false;
    const newErrors: string[] = [];

    Object.entries(data.sections || {}).forEach(([sec, entries]) => {
      (entries as any[]).forEach((entry, idx) => {
        if (entry.number.trim() !== '') {
          if (entry.notebook === 'Caderno') {
            hasError = true;
            newErrors.push(`${sec}-${idx}-notebook`);
          } else {
            const found = allLibraryHymns.find((h: MasterHymn) => h.notebook === entry.notebook && h.number === entry.number);
            if (!found) {
              hasError = true;
              newErrors.push(`${sec}-${idx}-number`);
            } else {
              // Rule: Mandatory Execution if number/title found and field is visible
              const sectionLabel = getSectionLabel(sec);
              const isOracaoExecutionHide = data.type === 'Oracao' && (sec === 'hymnal' || sec === 'message' || sec === 'afterIndividualPrayer');
              const hideExecution = sectionLabel === 'Hinário' || sectionLabel === 'Hinos do Hinário' || isOracaoExecutionHide;

              if (!hideExecution && !entry.execution?.trim()) {
                hasError = true;
                newErrors.push(`${sec}-${idx}-execution`);
              }
            }
          }
        }
      });
    });

    setValidationErrors(newErrors);
    if (hasError) { setShowErrorMsg(true); return; }
    const newList: HymnList = { id: initialData?.id || generateId(), owner_email: ownerEmail, ...data } as HymnList;
    const all = await fetchData('hymn_lists', 'gca_hymn_lists', ownerEmail);
    await saveData('hymn_lists', 'gca_hymn_lists', [...all.filter((l: any) => l.id !== initialData?.id), newList], ownerEmail);
    onSave();
  };

  const getSectionLabel = (sec: string) => {
    const labelsMap: any = { hymnal: 'Hinário', choir: 'Apresentação do Coral', contributions: 'Contribuições', communion: 'Santa Comunhão', message: 'Mensagem', finalization: 'Finalização', afterInitialPrayer: 'Hinos do Hinário', choirAfterContributions: 'Apresentação do Coral', afterIndividualPrayer: 'Hinos do Hinário' };
    if (data.type === 'Oracao') {
      if (sec === 'hymnal') return 'Inicio (Antes da Oração)';
      if (sec === 'afterIndividualPrayer') return 'Finalizar';
      if (sec === 'choirAfterContributions') return 'CONTRIBUIÇÕES';
    }
    return labelsMap[sec] || sec;
  };
  const sectionOrder = (() => {
    if (data.type === 'Oracao') return ['hymnal', 'afterInitialPrayer', 'choir', 'choirAfterContributions', 'message', 'afterIndividualPrayer'];
    if (['Normal130', 'Normal200', 'Especial200', 'Festiva200', 'NatalAnoNovo', 'Outra'].includes(data.type)) return ['hymnal', 'choir', 'contributions', 'message'];
    if (data.type === 'Comunhao200') return ['hymnal', 'choir', 'contributions', 'message', 'finalization'];
    return ['hymnal', 'choir', 'contributions', 'communion', 'message', 'finalization'];
  })();

  const dynamicWidthClass = data.isDetailed ? "max-w-[98%]" : "max-w-5xl";

  const getProgressiveMarker = () => {
    if (data.type !== 'NatalAnoNovo') return null;
    let startTimeStr = data.startTime || '19:00:00';
    let runningSeconds = parseTimeToSeconds(startTimeStr);
    let totalPresentationSeconds = 0;
    
    const markers: Record<string, string[]> = {};
    sectionOrder.forEach(sec => {
      // Add section fixed duration if exists
      if (data.sectionDurations?.[sec]) {
        runningSeconds += parseTimeToSeconds(data.sectionDurations[sec]);
      }

      markers[sec] = (data.sections?.[sec] || []).map(e => {
        const durSeconds = parseTimeToSeconds(e.duration);
        runningSeconds += durSeconds;
        totalPresentationSeconds += durSeconds;
        return formatSecondsToClockTime(runningSeconds);
      });
    });

    return { markers, totalPresentationSeconds, totalEndTimeSeconds: runningSeconds };
  };

  const progInfo = getProgressiveMarker();

  return (
    <Layout title={initialData ? "Programa" : "Novo Programa"} onBack={onCancel} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} widthClass={dynamicWidthClass}>
      <DragDropContext onDragEnd={onDragEnd}>
        <form onSubmit={save} className={`bg-white p-6 rounded shadow space-y-6 mx-auto ${dynamicWidthClass}`}>
          {showErrorMsg && (
            <div className="bg-red-100 p-4 mb-4 rounded font-bold animate-pulse text-red-700 flex flex-col gap-1">
              <p>Hinos incompletos ou não encontrados.</p>
              <p className="text-xs font-normal">Verifique os campos destacados em vermelho (Nº, Caderno ou Execução).</p>
            </div>
          )}
        <div className={`grid grid-cols-1 ${data.type === 'NatalAnoNovo' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 border-b pb-6`}>
          <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Data</label><input required type="date" disabled={isReadOnly} className="w-full border rounded p-2" value={data.date} onChange={e => setData({...data, date: e.target.value})} /></div>
          <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Congregação</label><input required disabled={isReadOnly} placeholder="Ex.: São Paulo/SP" className="w-full border rounded p-2" value={data.congregation} onChange={e => setData({...data, congregation: e.target.value})} /></div>
          <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Tipo</label><select disabled={isReadOnly} className="w-full border rounded p-2" value={data.type} onChange={e => { isFirstRun.current = true; setData({...data, type: e.target.value as any}); }}>{Object.entries(MEETING_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          {data.type === 'NatalAnoNovo' && (
            <div><label className="block text-xs font-bold uppercase text-gray-400 mb-1">Início Reunião</label><input type="text" placeholder="00:00:00" disabled={isReadOnly} className="w-full border rounded p-2 text-center font-mono" value={data.startTime || '19:00:00'} onChange={e => setData({...data, startTime: e.target.value})} /></div>
          )}
          <div className="flex items-center gap-2 pt-6"><input type="checkbox" id="isDetailed" disabled={isReadOnly} className="w-4 h-4" checked={data.isDetailed || false} onChange={e => setData({...data, isDetailed: e.target.checked})} /><label htmlFor="isDetailed" className="text-xs font-bold uppercase text-gray-500">Mais detalhada</label></div>
        </div>
        {sectionOrder.map((sec) => {
          const entries = data.sections?.[sec] || [];
          if (isReadOnly && entries.length === 0) return null;
          const sectionLabel = getSectionLabel(sec);
          const isOracaoExecutionHide = data.type === 'Oracao' && (sec === 'hymnal' || sec === 'message' || sec === 'afterIndividualPrayer');
          const hideExecution = sectionLabel === 'Hinário' || sectionLabel === 'Hinos do Hinário' || isOracaoExecutionHide;
          const isDetailedRow = sectionLabel === 'Apresentação do Coral' || sectionLabel === 'Contribuições' || sectionLabel === 'Mensagem';
          return (
            <React.Fragment key={sec}>
              {data.type === 'Oracao' && sec === 'afterIndividualPrayer' && (
                <div className="flex justify-center my-6">
                  <span className="bg-white text-indigo-900 border border-indigo-100 px-6 py-2 rounded-full font-black uppercase text-xs shadow-sm tracking-widest animate-fade-in">Oração Individual</span>
                </div>
              )}
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8 shadow-sm">
                <div className="flex flex-col items-center mb-6 gap-3">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <h4 className="font-black uppercase text-indigo-900 text-lg border-b-2 border-indigo-200 px-8 pb-1.5 tracking-tight">{sectionLabel}</h4>
                    {data.type === 'NatalAnoNovo' && (sec === 'contributions' || sec === 'message') && (
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm">
                        <label className="text-[9px] font-black uppercase text-indigo-400">Duração:</label>
                        <input 
                          disabled={isReadOnly}
                          placeholder="00:00:00" 
                          className="border border-indigo-50 rounded-lg px-2 py-1 text-xs w-24 font-mono text-center focus:border-indigo-500 outline-none"
                          value={data.sectionDurations?.[sec] || ''}
                          onChange={e => setData({...data, sectionDurations: {...data.sectionDurations, [sec]: e.target.value}})}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {(data.type === 'Outra' || (data.type === 'NatalAnoNovo' && (sec === 'choir' || sec === 'contributions' || sec === 'message'))) && !isReadOnly && (
                      <button type="button" onClick={() => addRow(sec)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Adicionar Linha
                      </button>
                    )}
                  </div>
                </div>
              <Droppable droppableId={sec}>
                {(provided, snapshot) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef} 
                    className={`space-y-3 min-h-[60px] transition-all duration-200 rounded-xl ${snapshot.isDraggingOver ? 'bg-indigo-50/50 ring-2 ring-indigo-200 ring-dashed' : ''} ${entries.length === 0 ? 'border-2 border-dashed border-gray-200 flex items-center justify-center p-4' : ''}`}
                  >
                    {entries.length === 0 && (
                      <div className="flex flex-col items-center gap-2 opacity-40">
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                         <span className="text-[10px] font-black uppercase tracking-widest text-center">Arraste hinos para este bloco</span>
                      </div>
                    )}
                    {entries.map((e: any, i: number) => {
                      const isFixedH = (sec === 'hymnal') || 
                                       (data.type === 'Oracao' && (sec === 'afterInitialPrayer' || sec === 'message' || sec === 'afterIndividualPrayer'));
                      const isFirstHymnalRow = (sec === 'hymnal' && i === 0);
                      const notebookLocked = isReadOnly || isFirstHymnalRow || (isFixedH && e.notebook === 'H');
                      const numberLocked = isReadOnly || isFirstHymnalRow;
                      const hasNbError = notebookError?.sec === sec && notebookError?.idx === i;
                      const dndId = e.id || `${sec}-${i}`;
                      return (
                        <DraggableAny key={dndId} draggableId={dndId} index={i} isDragDisabled={isReadOnly}>
                          {(provided: any, snapshot: any) => (
                            <div 
                              ref={provided.innerRef} 
                              {...provided.draggableProps} 
                              className={`flex flex-col gap-1 ${snapshot.isDragging ? 'opacity-50 ring-2 ring-indigo-500 rounded-xl bg-indigo-50/50 scale-105 z-50' : ''} transition-all duration-200`}
                            >
                              {hasNbError && (
                                <div className="flex animate-bounce-short">
                                  <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm">Por Favor, Informe o Caderno</span>
                                </div>
                              )}
                              <div className="flex flex-col sm:flex-row gap-2 items-center p-2 rounded relative group">
                                {!isReadOnly && (
                                  <div {...provided.dragHandleProps} className="hidden sm:flex items-center justify-center cursor-grab active:cursor-grabbing p-1.5 text-gray-300 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all absolute -left-6 bg-white rounded-l-lg border border-r-0 border-gray-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/></svg>
                                  </div>
                                )}
                                <select disabled={notebookLocked} className={`w-full sm:w-24 border rounded p-2 ${notebookLocked ? 'bg-gray-100' : 'bg-white'} ${validationErrors.includes(`${sec}-${i}-notebook`) ? 'border-red-500 bg-red-50' : ''}`} value={e.notebook} onChange={ev => update(sec, i, 'notebook', ev.target.value)}><option value="Caderno">Caderno</option>{Object.keys(NOTEBOOKS).map(code => <option key={code} value={code}>{code}</option>)}</select>
                      {data.type === 'Oracao' && (sec === 'afterInitialPrayer' || sec === 'message' || sec === 'afterIndividualPrayer') ? (
                        <div className="flex items-center gap-1">
                          <select 
                            disabled={isReadOnly}
                            className={`w-full sm:w-24 border rounded p-2 bg-white ${validationErrors.includes(`${sec}-${i}-number`) ? 'border-red-500 bg-red-50' : ''}`}
                            value={e.number}
                            onChange={ev => update(sec, i, 'number', ev.target.value)}
                          >
                            <option value="">Nº</option>
                            {sec === 'afterInitialPrayer' && (
                              <>
                                <option value="82">82</option>
                                <option value="180">180</option>
                              </>
                            )}
                            {sec === 'message' && (
                              <>
                                <option value="83">83</option>
                                <option value="84">84</option>
                                <option value="85">85</option>
                                <option value="107">107</option>
                                <option value="122">122</option>
                                <option value="172">172</option>
                                <option value="174">174</option>
                                <option value="176">176</option>
                                <option value="178">178</option>
                              </>
                            )}
                            {sec === 'afterIndividualPrayer' && (
                              <>
                                <option value="81">81</option>
                                <option value="86">86</option>
                                <option value="116">116</option>
                                <option value="117">117</option>
                                <option value="118">118</option>
                                <option value="119">119</option>
                                <option value="120">120</option>
                                <option value="121">121</option>
                                <option value="173">173</option>
                                <option value="175">175</option>
                                <option value="177">177</option>
                                <option value="179">179</option>
                                <option value="186">186</option>
                                <option value="230">230</option>
                              </>
                            )}
                          </select>
                          <button type="button" onClick={() => openHymnSearch(sec, i, e.notebook)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Pesquisar Hino">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input disabled={numberLocked} placeholder="Nº" className={`w-full sm:w-20 border rounded p-2 ${validationErrors.includes(`${sec}-${i}-number`) ? 'border-red-500 bg-red-50' : ''}`} value={e.number} onChange={ev => update(sec, i, 'number', ev.target.value)} />
                          <button type="button" onClick={() => openHymnSearch(sec, i, e.notebook)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Pesquisar Hino">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          </button>
                        </div>
                      )}
                      <input placeholder="Título..." className="border rounded p-2 flex-1 bg-gray-100" value={e.title} readOnly disabled />
                      {data.isDetailed && isDetailedRow && !(data.type === 'Oracao' && sec === 'message') && (
                        <>
                          <input disabled={isReadOnly} placeholder="Regente" className="border rounded p-2 w-28" value={e.conductor || ''} onChange={ev => update(sec, i, 'conductor', ev.target.value)} />
                          <input disabled={isReadOnly} placeholder="Solista" className="border rounded p-2 w-28" value={e.soloist || ''} onChange={ev => update(sec, i, 'soloist', ev.target.value)} />
                          <input disabled={isReadOnly} placeholder="Tecladista" className="border rounded p-2 w-28" value={e.keyboardist || ''} onChange={ev => update(sec, i, 'keyboardist', ev.target.value)} />
                          <input disabled={isReadOnly} placeholder="Violonista" className="border rounded p-2 w-28" value={e.guitarist || ''} onChange={ev => update(sec, i, 'guitarist', ev.target.value)} />
                        </>
                      )}
                      {!hideExecution && <input disabled={isReadOnly} placeholder="Execução" className={`border rounded p-2 w-full sm:w-32 transition-all ${validationErrors.includes(`${sec}-${i}-execution`) ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : ''}`} value={e.execution || ''} onChange={ev => update(sec, i, 'execution', ev.target.value)} />}
                      {data.type === 'NatalAnoNovo' && (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <label className="text-[9px] font-black uppercase text-gray-400">Duração</label>
                            <input disabled={isReadOnly} placeholder="00:00:00" className="border rounded p-2 w-24 text-center font-mono text-sm" value={e.duration || ''} onChange={ev => update(sec, i, 'duration', ev.target.value)} />
                          </div>
                          {progInfo?.markers[sec][i] && (
                            <div className="flex flex-col items-center bg-indigo-600 text-white px-2 py-1 rounded shadow-sm border border-indigo-700 min-w-[75px]">
                              <span className="text-[8px] font-black uppercase opacity-80 leading-none mb-0.5">Término</span>
                              <span className="text-xs font-black tracking-wider leading-none">{progInfo.markers[sec][i]}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {(data.type === 'Outra' || (data.type === 'NatalAnoNovo' && (sec === 'choir' || sec === 'contributions' || sec === 'message'))) && !isReadOnly && entries.length > 1 && (
                        <button type="button" onClick={() => removeRow(sec, i)} className="text-red-400 hover:text-red-600 p-1 transition-colors ml-2" title="Remover Linha">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </DraggableAny>
            );
          })}
          {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  </React.Fragment>
        );
      })}
        
        {data.type === 'NatalAnoNovo' && progInfo && (
          <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border-b-4 border-indigo-950">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-800 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <h5 className="text-xs font-black uppercase tracking-widest opacity-70">Tempo Total de Apresentação</h5>
                <p className="text-2xl font-black">{formatSecondsToDurationString(progInfo.totalPresentationSeconds)}</p>
              </div>
            </div>
            <div className="text-right">
              <h5 className="text-xs font-black uppercase tracking-widest opacity-70">Encerramento Previsto</h5>
              <p className="text-3xl font-black text-yellow-400">{formatSecondsToClockTime(progInfo.totalEndTimeSeconds)}</p>
            </div>
          </div>
        )}

        {!isReadOnly && <button type="submit" className="bg-indigo-600 text-white px-10 py-3 rounded-full font-bold shadow-lg w-full sm:w-auto">Finalizar Programa</button>}
      </form>
    </DragDropContext>

      {searchModalHymns && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            <div className="bg-indigo-600 p-6 flex justify-between items-center shrink-0">
               <div className="flex flex-col">
                  <h3 className="text-white font-black uppercase tracking-widest text-lg">Pesquisar Hino</h3>
                  <span className="text-indigo-100 text-[10px] font-bold uppercase">Caderno: {searchModalHymns.notebook}</span>
               </div>
               <button onClick={() => setSearchModalHymns(null)} className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
               </button>
            </div>
            
            <div className="p-6 border-b bg-gray-50 flex flex-col gap-4">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Pesquise por número ou título..." 
                  className="w-full bg-white border-2 border-indigo-50 rounded-2xl py-4 pl-12 pr-6 font-bold outline-none focus:border-indigo-600 transition-all shadow-sm"
                  value={hymnSearchTerm}
                  onChange={e => setHymnSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/30">
              {libraryHymns
                .filter(h => h.notebook === searchModalHymns.notebook)
                .filter(h => h.number.includes(hymnSearchTerm) || h.title.toLowerCase().includes(hymnSearchTerm.toLowerCase()))
                .sort((a, b) => parseInt(a.number) - parseInt(b.number))
                .map(h => (
                  <button 
                    key={h.id} 
                    onClick={() => selectHymnFromSearch(h.number)}
                    className="w-full text-left p-4 bg-white hover:bg-indigo-50 border border-gray-100 rounded-2xl transition-all group flex items-center gap-4 hover:border-indigo-200 hover:shadow-md"
                  >
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 flex items-center justify-center rounded-xl font-black text-lg shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {h.number}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-black text-indigo-950 uppercase truncate tracking-tight">{h.title}</p>
                      <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">{h.notebook}</p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </button>
                ))}
              
              {libraryHymns.filter(h => h.notebook === searchModalHymns.notebook).filter(h => h.number.includes(hymnSearchTerm) || h.title.toLowerCase().includes(hymnSearchTerm.toLowerCase())).length === 0 && (
                <div className="py-12 flex flex-col items-center text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-20"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <p className="font-bold uppercase text-xs tracking-widest">Nenhum hino encontrado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

const PrintView = ({ list, onBack, onExitImpersonation }: any) => {
  const sectionOrder = list.type === 'Oracao' ? ['hymnal', 'afterInitialPrayer', 'choir', 'choirAfterContributions', 'message', 'afterIndividualPrayer'] : ['hymnal', 'choir', 'contributions', 'communion', 'message', 'finalization'];
  
  const getSectionLabel = (sec: string) => {
    const labelsMap: any = { hymnal: 'Hinário', choir: 'Apresentação do Coral', contributions: 'Contribuições', communion: 'Santa Comunhão', message: 'Mensagem', finalization: 'Finalização', afterInitialPrayer: 'Hinos do Hinário', choirAfterContributions: 'Apresentação do Coral', afterIndividualPrayer: 'Hinos do Hinário' };
    if (list.type === 'Oracao') {
      if (sec === 'hymnal') return 'Inicio (Antes da Oração)';
      if (sec === 'afterIndividualPrayer') return 'Finalizar';
    }
    return labelsMap[sec] || sec;
  };

  let startTimeSeconds = parseTimeToSeconds(list.startTime || '19:00:00');
  let runningSeconds = startTimeSeconds;
  let totalPresentationSeconds = 0;

  return (
    <div className="bg-gray-100 p-8 min-h-screen">
      <div className="max-w-[1200px] mx-auto mb-4 flex justify-between no-print">
        <button onClick={onBack} className="bg-gray-600 text-white px-4 py-2 rounded">Voltar</button>
        <div className="flex gap-2">
          <button onClick={() => downloadHTML('program-print', `programa-${list.date}.html`)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Salvar HTML</button>
          <button onClick={() => downloadPDF('program-print', `programa-${list.date}.pdf`, (list.isDetailed || list.type === 'NatalAnoNovo') ? 'landscape' : 'portrait')} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Gerar PDF</button>
        </div>
      </div>
      <div id="program-print" className={`bg-white shadow-2xl mx-auto ${(list.isDetailed || list.type === 'NatalAnoNovo') ? 'max-w-[297mm] min-h-[210mm]' : 'max-w-[210mm] min-h-[297mm]'} ${list.type === 'NatalAnoNovo' ? 'p-6' : 'p-12'}`}>
        <div className={`text-center border-b-2 border-double border-black pb-2 ${list.type === 'NatalAnoNovo' ? 'mb-2' : 'mb-4'}`} style={{ fontSize: '14px' }}>
          <h1 className="font-black uppercase tracking-tighter">Igreja Apostólica</h1>
          <h2 className="font-bold mt-1 border border-black inline-block px-4 py-0.5 uppercase">{MEETING_TYPES[list.type]}</h2>
          <div className={`${list.type === 'NatalAnoNovo' ? 'mt-2' : 'mt-4'} flex justify-between px-2 font-bold uppercase italic border-black border-t-2 pt-2 text-black`}>
            <span>Data: {new Date(list.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
            {list.type === 'NatalAnoNovo' && <span>Início: {list.startTime || '19:00:00'}</span>}
            <span>Congregação: {list.congregation}</span>
          </div>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left uppercase font-black text-[10px]">
              <th className="px-2 py-2">Cad.</th>
              <th className="px-2 py-2">Nº</th>
              <th className="px-2 py-2">Hino</th>
              {list.isDetailed && (
                <>
                  <th className="px-2 py-2">Regente</th>
                  <th className="px-2 py-2">Solista</th>
                  <th className="px-2 py-2">Tecladista</th>
                  <th className="px-2 py-2">Violonista</th>
                </>
              )}
              <th className="px-2 py-2">Execução</th>
              {list.type === 'NatalAnoNovo' ? (
                <th className="px-2 py-1 text-center">Cronometro</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sectionOrder.map(sec => {
              const sectionLabel = getSectionLabel(sec);
              if (list.sectionDurations?.[sec]) {
                runningSeconds += parseTimeToSeconds(list.sectionDurations[sec]);
              }
              const isOracaoExecutionHide = list.type === 'Oracao' && (sec === 'hymnal' || sec === 'message' || sec === 'afterIndividualPrayer');
              const hideExecution = sectionLabel === 'Hinário' || sectionLabel === 'Hinos do Hinário' || isOracaoExecutionHide;
              const isDetailedRow = sectionLabel === 'Apresentação do Coral' || sectionLabel === 'Contribuições' || sectionLabel === 'Mensagem';
              const entries = list.sections[sec] || [];
              if (entries.length === 0) return null;
              
              const isNatal = list.type === 'NatalAnoNovo';
              const colSpanValue = list.isDetailed ? (isNatal ? 9 : 8) : (isNatal ? 5 : 4);

              const cellPadding = isNatal ? 'px-1 py-1' : 'px-2 py-3';

              return (
                <React.Fragment key={sec}>
                  {list.type === 'Oracao' && sec === 'afterIndividualPrayer' && (
                    <tr className="bg-white">
                      <td colSpan={colSpanValue} className="px-2 py-4 text-center font-black uppercase text-black italic tracking-widest border-y border-gray-100" style={{ fontSize: '13px' }}>
                        Oração Individual
                      </td>
                    </tr>
                  )}
                  <tr className="bg-gray-50">
                    <td 
                      colSpan={colSpanValue} 
                      className={`px-2 py-1 font-black uppercase text-black border-b border-gray-300 text-center`}
                      style={{ fontSize: '14px' }}
                    >
                      {sectionLabel}
                    </td>
                  </tr>
                  {entries.map((e: any, i: number) => {
                    const itemDurSec = parseTimeToSeconds(e.duration);
                    runningSeconds += itemDurSec;
                    totalPresentationSeconds += itemDurSec;
                    
                    return (
                      <tr key={sec + i} className="border-b border-gray-200" style={{ fontSize: isNatal ? '10px' : '12px' }}>
                        <td className={`${cellPadding} font-bold text-black`}>{e.notebook}</td>
                        <td className={`${cellPadding} font-black text-black`}>{e.number}</td>
                        <td className={`${cellPadding} font-bold text-black uppercase`}>{e.title}</td>
                        {list.isDetailed && (
                          <>
                            <td className={`${cellPadding} text-[11px] italic text-black`}>{isDetailedRow ? (e.conductor || '-') : ''}</td>
                            <td className={`${cellPadding} text-[11px] italic text-black`}>{isDetailedRow ? (e.soloist || '-') : ''}</td>
                            <td className={`${cellPadding} text-[11px] italic text-black`}>{isDetailedRow ? (e.keyboardist || '-') : ''}</td>
                            <td className={`${cellPadding} text-[11px] italic text-black`}>{isDetailedRow ? (e.guitarist || '-') : ''}</td>
                          </>
                        )}
                        <td className={`${cellPadding} text-black italic`}>{!hideExecution ? (e.execution || '-') : ''}</td>
                        {isNatal && (
                          <td className={`${cellPadding} text-black font-black text-center font-mono`} style={{ fontSize: '13px' }}>{formatSecondsToClockTime(runningSeconds)}</td>
                        )}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {list.type === 'NatalAnoNovo' && (
          <div className="mt-4 pt-2 border-t-2 border-black flex justify-between items-start">
            <div className="flex gap-4">
              <div className="flex flex-col text-black">
                <span className="text-[8px] font-black uppercase">Tempo Total</span>
                <span className="text-sm font-black">{formatSecondsToDurationString(totalPresentationSeconds)}</span>
              </div>
            </div>
            <div className="text-right flex flex-col text-black">
              <span className="text-[8px] font-black uppercase">Encerramento Previsto</span>
              <span className="text-lg font-black">{formatSecondsToClockTime(runningSeconds)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const HymnReportInputScreen = ({ onGenerate, onCancel, onExitImpersonation }: any) => {
  const [start, setStart] = useState(getBrasiliaYYYYMMDD());
  const [end, setEnd] = useState(getBrasiliaYYYYMMDD());
  const [sortOrder, setSortOrder] = useState<'numerical' | 'most_presented' | 'least_presented'>('numerical');

  return (
    <Layout title="Uso de Hinos" onBack={onCancel} onExitImpersonation={onExitImpersonation}>
      <div className="bg-white p-8 rounded shadow max-w-md mx-auto mt-12 space-y-4">
        <h3 className="text-xl font-bold border-b pb-4">Filtrar Relatório</h3>
        <div><label className="block text-sm font-bold mb-1">Início</label><input type="date" className="w-full border rounded p-2" value={start} onChange={e => setStart(e.target.value)} /></div>
        <div><label className="block text-sm font-bold mb-1">Término</label><input type="date" className="w-full border rounded p-2" value={end} onChange={e => setEnd(e.target.value)} /></div>
        <div>
          <label className="block text-sm font-bold mb-1">Ordem</label>
          <select className="w-full border rounded p-2" value={sortOrder} onChange={e => setSortOrder(e.target.value as any)}>
            <option value="numerical">Ordem numérica</option>
            <option value="most_presented">Dos Mais Apresentados Para Menos Apresentados</option>
            <option value="least_presented">Dos Menos Apresentados Para Mais Apresentados</option>
          </select>
        </div>
        <button onClick={() => onGenerate(start, end, sortOrder)} className="w-full bg-indigo-600 text-white py-2 rounded font-bold shadow hover:bg-indigo-700 transition-colors">Visualizar</button>
      </div>
    </Layout>
  );
};

// --- Relatório de Uso de Hinos ---

const HymnReportScreen = ({ goBack, ownerEmail, reportData }: any) => {
  const { s: start, e: end, t: sortOrder } = reportData;
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generate = async () => {
      setLoading(true);
      try {
        const [allHymns, allLists] = await Promise.all([
          fetchData('hymns_library', 'gca_hymns_library', ownerEmail),
          fetchData('hymn_lists', 'gca_hymn_lists', ownerEmail)
        ]);

        const filteredLists = allLists.filter((l: HymnList) => l.date >= start && l.date <= end);
        const counts: Record<string, number> = {};

        filteredLists.forEach((l: HymnList) => {
          Object.values(l.sections || {}).forEach((entries: HymnEntry[]) => {
            if (Array.isArray(entries)) {
              entries.forEach(entry => {
                if (entry.notebook && entry.number && entry.notebook !== 'Caderno') {
                  const key = `${entry.notebook}|${entry.number}`;
                  counts[key] = (counts[key] || 0) + 1;
                }
              });
            }
          });
        });

        const reportData = allHymns.map((h: MasterHymn) => ({
          ...h,
          count: counts[`${h.notebook}|${h.number}`] || 0
        }));

        setReport(reportData);
      } catch (err) {
        console.error("Erro ao gerar relatório:", err);
      } finally {
        setLoading(false);
      }
    };
    generate();
  }, [ownerEmail, start, end]);

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center font-bold animate-pulse text-indigo-600 uppercase tracking-widest">Calculando Uso de Hinos...</div>;

  const grouped = report.reduce((acc: any, h) => {
    if (!acc[h.notebook]) acc[h.notebook] = [];
    acc[h.notebook].push(h);
    return acc;
  }, {});

  // Ordenar cada grupo
  Object.keys(grouped).forEach(nb => {
    grouped[nb].sort((a: any, b: any) => {
      if (sortOrder === 'most_presented') return b.count - a.count;
      if (sortOrder === 'least_presented') return a.count - b.count;
      
      const n1 = parseInt(a.number);
      const n2 = parseInt(b.number);
      if (isNaN(n1) || isNaN(n2)) return a.number.localeCompare(b.number);
      return n1 - n2;
    });
  });

  const notebookCodes = Object.keys(NOTEBOOKS).filter(code => grouped[code]);

  return (
    <div className="bg-gray-100 p-8 min-h-screen">
      <div className="max-w-[800px] mx-auto mb-4 flex justify-between no-print">
        <button onClick={goBack} className="bg-gray-600 text-white px-4 py-2 rounded">Voltar</button>
        <div className="flex gap-2">
          <button onClick={() => downloadHTML('hymn-usage-report-view', `relatorio-uso-hinos.html`)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Salvar HTML</button>
          <button onClick={() => downloadPDF('hymn-usage-report-view', `relatorio-uso-hinos.pdf`)} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Gerar PDF</button>
        </div>
      </div>
      <div id="hymn-usage-report-view" className="bg-white p-10 shadow-2xl mx-auto max-w-[210mm] min-h-[297mm]">
        <div className="text-center border-b-2 border-double border-black pb-2 mb-4">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-black">Igreja Apostólica</h1>
          <h2 className="text-xl font-bold mt-1 bg-black text-white inline-block px-6 py-1 uppercase rounded-sm tracking-widest leading-none">Frequência de Uso de Hinos</h2>
          <div className="mt-2 text-[9px] font-bold uppercase italic border-black border-t pt-2 flex justify-between text-black">
            <span>Período: {new Date(start + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(end + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
            <span>Ordem: {sortOrder === 'numerical' ? 'Numérica' : sortOrder === 'most_presented' ? 'MAIS USADOS' : 'MENOS USADOS'}</span>
          </div>
        </div>

        {notebookCodes.map(code => (
          <div key={code} className="mb-6 last:mb-0 break-inside-avoid">
            <h3 className="bg-black text-white px-3 py-1 font-black uppercase text-[10px] mb-2 rounded-sm tracking-widest">{code} - {NOTEBOOKS[code]}</h3>
            
            <div style={{ columns: '2', columnGap: '20px' }}>
              {grouped[code].map((h: any) => (
                <div key={h.id} className="flex justify-between items-center px-1 py-1 border-b border-gray-100 text-[10px] break-inside-avoid leading-none">
                  <div className="flex gap-2 min-w-0 overflow-hidden items-center">
                    <span className="font-black text-black w-6 flex-shrink-0">{h.number}</span>
                    <span className="font-bold text-black uppercase truncate text-[9px]">{h.title}</span>
                  </div>
                  <span className={`font-black ml-2 ${h.count > 0 ? 'text-black' : 'text-gray-300'}`}>{h.count}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {report.length === 0 && (
          <p className="text-center text-black py-12 italic uppercase font-bold text-xs tracking-widest">Nenhum hino encontrado ou registrado no período.</p>
        )}
      </div>
    </div>
  );
};

const AdminMenuScreen = ({ navigate, goBack, currentUser }: any) => {
  const isMaster = currentUser.email === 'Admin' || currentUser.isMasterAdmin;
  return (
    <Layout title="Painel Administrativo" onBack={goBack}>
      <div className="max-w-md mx-auto mt-8 grid gap-6">
        {(isMaster || currentUser.canApprove || currentUser.canDeleteUser || currentUser.canResetPasswords || currentUser.canEnableDisableUsers) && (
          <MenuCard 
            title="Acessos" 
            desc="Gerir usuários (autorizar, desabilitar ou excluir)" 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>} 
            onClick={() => navigate('admin_users')} 
          />
        )}

        {(isMaster || currentUser.canManageLocations) && (
          <MenuCard 
            title="Cadastros" 
            desc="País, Estado e Congregações" 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>} 
            onClick={() => navigate('admin_registrations_summary')} 
          />
        )}

        {(isMaster || currentUser.canApprove || currentUser.canRegister || currentUser.canEditCRR) && (
          <MenuCard 
            title="Certificado de Registro de Regentes" 
            desc="Geração de certificados oficiais" 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>} 
            onClick={() => navigate('admin_conductor_certificates')} 
          />
        )}

        {(isMaster || currentUser.canManageMessages) && (
          <MenuCard 
            title="Mensagens" 
            desc="Histórico e gestão de conversas do Chat" 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} 
            onClick={() => navigate('admin_messages')} 
          />
        )}

        {(isMaster || currentUser.canSendBulletins) && (
          <MenuCard 
            title="Avisos Oficiais" 
            desc="Quadro de avisos do sistema" 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>} 
            onClick={() => navigate('admin_bulletins')} 
          />
        )}
      </div>
    </Layout>
  );
};

const AdminUsersScreen = ({ goBack, onImpersonate, currentUser, onAwaitingConductorRegistration }: any) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [permissionModalUser, setPermissionModalUser] = useState<UserAccount | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserAccount | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [statusConfirmUser, setStatusConfirmUser] = useState<{user: UserAccount, target: any} | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [passwordConfirmUser, setPasswordConfirmUser] = useState<UserAccount | null>(null);
  const [newPasswordGenerated, setNewPasswordGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showScopeSelector, setShowScopeSelector] = useState(false);
  const isMaster = currentUser.email === 'Admin' || currentUser.isMasterAdmin;
  const hasGeneralAccess = isMaster || currentUser.canApprove || currentUser.canRegister || currentUser.canManageLocations;
  
  const filteredUsersForAdmin = users.filter(u => {
    if (u.email === 'Admin') return false;
    if (hasGeneralAccess) return true;
    return (currentUser.managedUserEmails || []).includes(u.email);
  });

  useEscapeKey(() => {
    if (showScopeSelector) {
      setShowScopeSelector(false);
    } else if (newPasswordGenerated) {
      setNewPasswordGenerated(null);
      setPasswordConfirmUser(null);
    } else if (passwordConfirmUser) {
      setPasswordConfirmUser(null);
    } else if (permissionModalUser) {
      setPermissionModalUser(null);
      setPermissionError(null);
    } else if (deleteConfirmUser) {
      setDeleteConfirmUser(null);
      setDeletePassword('');
    } else if (statusConfirmUser) {
      setStatusConfirmUser(null);
    } else {
      goBack();
    }
  }, [newPasswordGenerated, passwordConfirmUser, permissionModalUser, deleteConfirmUser, statusConfirmUser, goBack]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*');
    setUsers(data || []);
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateStatus = async (id: string, status: any) => { 
    if (status === 'authorized') {
      const userToApprove = users.find(u => u.id === id);
      if (userToApprove && userToApprove.status === 'pending') {
        onAwaitingConductorRegistration(userToApprove);
        return;
      }
    }
    setLoading(true);
    const { error } = await supabase.from('users').update({ status }).eq('id', id); 
    if (!error) {
      setUsers(users.map(u => u.id === id ? { ...u, status } : u)); 
      setStatusConfirmUser(null);
    }
    setLoading(false);
  };

  const savePermissions = async () => {
    if (!permissionModalUser) return;
    setPermissionError(null);
    if (permissionModalUser.isAdminUser && !permissionModalUser.isMasterAdmin) {
      const hasAnyPermission = 
        permissionModalUser.canViewOthers || 
        permissionModalUser.canRegister || 
        permissionModalUser.canApprove || 
        permissionModalUser.canDeleteUser ||
        permissionModalUser.canEditProfiles ||
        permissionModalUser.canResetPasswords ||
        permissionModalUser.canManageLocations ||
        permissionModalUser.canEditCRR ||
        permissionModalUser.canReadOnlyMode ||
        permissionModalUser.canEnableDisableUsers ||
        permissionModalUser.canManageMessages ||
        permissionModalUser.canSendBulletins ||
        permissionModalUser.canChat;

      if (!hasAnyPermission) {
        setPermissionError("Favor habilitar usuário a realizar pelo menos uma das ações");
        return;
      }

      // Validação de Escopo: Apenas se houver permissões ALÉM das gerais (Base)
      const hasSpecificPermissions = 
        permissionModalUser.canDeleteUser ||
        permissionModalUser.canResetPasswords ||
        permissionModalUser.canEnableDisableUsers ||
        permissionModalUser.canEditCRR ||
        permissionModalUser.canReadOnlyMode ||
        permissionModalUser.canManageMessages ||
        permissionModalUser.canSendBulletins ||
        permissionModalUser.canChat ||
        permissionModalUser.canViewOthers;

      if (hasSpecificPermissions && (!permissionModalUser.managedUserEmails || permissionModalUser.managedUserEmails.length === 0)) {
        setPermissionError("Para conceder permissões de Gestão/Comunicação, selecione pelo menos um usuário no Escopo de Controle");
        return;
      }
    }
    const { error } = await supabase.from('users').update({
      isAdminUser: permissionModalUser.isAdminUser,
      isMasterAdmin: permissionModalUser.isMasterAdmin,
      canViewOthers: permissionModalUser.canViewOthers,
      canRegister: permissionModalUser.canRegister,
      canApprove: permissionModalUser.canApprove,
      canDeleteUser: permissionModalUser.canDeleteUser,
      canEditProfiles: permissionModalUser.canEditProfiles || permissionModalUser.canApprove,
      canResetPasswords: permissionModalUser.canResetPasswords,
      canManageLocations: permissionModalUser.canManageLocations,
      canEditCRR: permissionModalUser.canEditCRR,
      canReadOnlyMode: permissionModalUser.canReadOnlyMode,
      canEnableDisableUsers: permissionModalUser.canEnableDisableUsers,
      canManageMessages: permissionModalUser.canManageMessages,
      canSendBulletins: permissionModalUser.canSendBulletins,
      canChat: permissionModalUser.canChat,
      managedUserEmails: permissionModalUser.managedUserEmails || [],
    }).eq('id', permissionModalUser.id);

    if (!error) {
      setUsers(users.map(u => u.id === permissionModalUser.id ? permissionModalUser : u));
      setPermissionModalUser(null);
    } else {
      console.error("Erro ao salvar permissões:", error);
      setPermissionError(`Erro ao salvar no banco de dados: ${error.message}`);
    }
  };

  const handleImpersonate = (u: UserAccount) => {
    if (isMaster || currentUser.canViewOthers || currentUser.canReadOnlyMode) {
      onImpersonate(u);
    } else {
      setPermissionError('Você não tem permissão para visualizar outros ambientes.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    if (deletePassword !== currentUser.password) {
      alert('Senha de administrador incorreta! A exclusão foi cancelada.');
      return;
    }
    setLoading(true);
    try {
      const tables = ['gca_instruments', 'gca_musicians', 'gca_attendance', 'gca_hymns_library', 'gca_hymn_lists', 'conductors'];
      await Promise.all(tables.map(table => supabase.from(table).delete().eq('owner_email', deleteConfirmUser.email)));
      const { error } = await supabase.from('users').delete().eq('id', deleteConfirmUser.id);
      if (!error) {
        setUsers(users.filter(usr => usr.id !== deleteConfirmUser.id));
        setDeleteConfirmUser(null);
      } else {
        throw error;
      }
    } catch (err: any) {
      alert('Erro ao excluir usuário: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordConfirmUser) return;
    setLoading(true);
    const generated = Math.random().toString(36).slice(-8).toUpperCase();
    const { error } = await supabase.from('users').update({ password: generated }).eq('id', passwordConfirmUser.id);
    if (!error) {
      setNewPasswordGenerated(generated);
      setUsers(users.map(u => u.id === passwordConfirmUser.id ? { ...u, password: generated } : u));
    } else {
      alert("Erro ao alterar senha: " + error.message);
    }
    setLoading(false);
  };

  const Section = ({ title, list }: { title: string, list: UserAccount[] }) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-8">
        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 px-1">{title} ({list.length})</h3>
        <div className="space-y-3">
          {list.map(u => (
            <div key={u.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-indigo-900 truncate">{u.name}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{u.email}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {u.isAdminUser && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black tracking-widest uppercase italic">Administrador</span>}
                  {u.status === 'disabled' && <span className="text-[8px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Desabilitado</span>}
                </div>
              </div>
              <div className="flex gap-1.5 ml-4">
                {u.status === 'authorized' && (isMaster || currentUser.canViewOthers || currentUser.canReadOnlyMode) && (
                  <button onClick={() => handleImpersonate(u)} className="bg-indigo-50 text-indigo-600 p-2 rounded-lg hover:bg-indigo-600 hover:text-white transition-all transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                )}
                {u.status === 'pending' && (isMaster || currentUser.canApprove) && (
                  <button onClick={() => updateStatus(u.id, 'authorized')} className="bg-green-50 text-green-600 p-2 rounded-lg text-[10px] font-black uppercase px-3">Aceitar</button>
                )}
                {u.status === 'authorized' && isMaster && (
                  <button onClick={() => { setPermissionModalUser(u); setPermissionError(null); }} className="bg-purple-50 text-purple-600 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </button>
                )}
                {u.status !== 'pending' && (isMaster || (currentUser.canResetPasswords && (currentUser.managedUserEmails || []).includes(u.email))) && (
                  <button onClick={() => setPasswordConfirmUser(u)} title="Alterar Senha" className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </button>
                )}
                {u.status !== 'pending' && (isMaster || ((currentUser.canApprove || currentUser.canEditProfiles || currentUser.canEnableDisableUsers) && (currentUser.managedUserEmails || []).includes(u.email))) && (
                  <button onClick={() => setStatusConfirmUser({user: u, target: u.status === 'disabled' ? 'authorized' : 'disabled'})} className={`${u.status === 'disabled' ? 'bg-amber-50 text-amber-600' : 'bg-orange-50 text-orange-600'} px-3 py-2 rounded-lg text-[10px] font-black uppercase`}>
                    {u.status === 'disabled' ? 'Reabilitar' : 'Desabilitar'}
                  </button>
                )}
                {(isMaster || (currentUser.canDeleteUser && (currentUser.managedUserEmails || []).includes(u.email))) && (
                  <button onClick={() => setDeleteConfirmUser(u)} className="bg-red-50 text-red-600 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const pending = filteredUsersForAdmin.filter(u => u.status === 'pending');
  const authorized = filteredUsersForAdmin.filter(u => u.status === 'authorized');
  const disabled = filteredUsersForAdmin.filter(u => u.status !== 'pending' && u.status !== 'authorized');

  return (
    <Layout title="Acessos" onBack={goBack}>
      <div className="max-w-3xl mx-auto py-6">
        <Section title="Pendentes de Aprovação" list={pending} />
        <Section title="Usuários Autorizados" list={authorized} />
        <Section title="Usuários Desabilitados" list={disabled} />
        {users.length <= 1 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhum outro usuário encontrado no sistema.</p>
          </div>
        )}
      </div>

      {statusConfirmUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-sm shadow-2xl text-center space-y-6">
            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${statusConfirmUser.target === 'disabled' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {statusConfirmUser.target === 'disabled' ? <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/> : <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>}
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-indigo-900 uppercase tracking-tight">Confirmar Ação</h3>
              <p className="text-sm text-gray-500 mt-2">Deseja realmente <strong>{statusConfirmUser.target === 'disabled' ? 'desabilitar' : 'reabilitar'}</strong> o acesso de <strong>{statusConfirmUser.user.name}</strong>?</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => updateStatus(statusConfirmUser.user.id, statusConfirmUser.target)}
                disabled={loading}
                className={`flex-1 ${statusConfirmUser.target === 'disabled' ? 'bg-orange-600' : 'bg-green-600'} text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all`}
              >
                {loading ? 'Processando...' : 'Confirmar'}
              </button>
              <button onClick={() => setStatusConfirmUser(null)} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black uppercase text-xs hover:bg-gray-200 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-sm shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-indigo-900 uppercase tracking-tight text-red-600">Excluir Permanentemente?</h3>
              <div className="mt-3 p-3 bg-red-50 rounded-lg text-left">
                <p className="text-[10px] text-red-800 font-bold uppercase leading-relaxed">
                  Esta ação é irreversível. Todas as informações alimentadas por <strong>{deleteConfirmUser.name}</strong> serão apagadas:
                </p>
                <ul className="text-[9px] text-red-700 mt-2 list-disc pl-4 font-bold uppercase space-y-1">
                  <li>Biblioteca de Hinos</li>
                  <li>Lista de Músicos</li>
                  <li>Cadastro de Instrumentos</li>
                  <li>Histórico de Chamadas</li>
                  <li>Programas de Hinos</li>
                  <li>Certificado de Regente (CRR)</li>
                </ul>
              </div>
              <div className="mt-4">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 text-left">Confirme sua senha de Admin para excluir:</p>
                <input 
                  type="password" 
                  value={deletePassword} 
                  onChange={e => setDeletePassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full border-2 border-red-100 rounded-xl p-3 text-center font-bold focus:border-red-500 outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleDeleteUser}
                disabled={loading || !deletePassword}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all outline-none disabled:opacity-50"
              >
                {loading ? 'Excluindo...' : 'Confirmar'}
              </button>
              <button onClick={() => setDeleteConfirmUser(null)} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black uppercase text-xs hover:bg-gray-200 transition-all outline-none">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {permissionModalUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b bg-white relative z-10">
              <h3 className="text-xl font-black text-indigo-900 uppercase">Níveis de Acesso: {permissionModalUser.name}</h3>
              {permissionError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-[10px] font-black uppercase border-l-4 border-red-500 animate-pulse mt-4">
                  {permissionError}
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar-heavy">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
                  <span className="font-bold text-indigo-900 text-sm uppercase">Tornar Administrador</span>
                  <button 
                    onClick={() => {
                      setPermissionError(null);
                      setPermissionModalUser({...permissionModalUser, isAdminUser: !permissionModalUser.isAdminUser});
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${permissionModalUser.isAdminUser ? 'bg-indigo-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${permissionModalUser.isAdminUser ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {permissionModalUser.isAdminUser && (
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100 animate-slide-down">
                    <div className="flex flex-col">
                      <span className="font-bold text-amber-900 text-sm uppercase">Tornar Admin Master</span>
                      <span className="text-[8px] text-amber-600 font-bold uppercase tracking-tight">Poderes totais (Chat e Deleção Global)</span>
                    </div>
                    <button 
                      onClick={() => {
                        setPermissionError(null);
                        setPermissionModalUser({...permissionModalUser, isMasterAdmin: !permissionModalUser.isMasterAdmin});
                      }}
                      className={`w-12 h-6 rounded-full transition-colors relative ${permissionModalUser.isMasterAdmin ? 'bg-amber-600' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${permissionModalUser.isMasterAdmin ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                )}

                {permissionModalUser.isAdminUser && !permissionModalUser.isMasterAdmin && (
                  <div className="space-y-6 animate-slide-down">
                    {[
                      { 
                        group: 'Nível Geral (Base)', 
                        opts: [
                          { label: 'Aceitar Usuários', key: 'canApprove' },
                          { label: 'Cadastrar CRR / Novos Usuários', key: 'canRegister' },
                          { label: 'Cadastrar e Editar Locais', key: 'canManageLocations' },
                        ]
                      },
                      { 
                        group: 'Gestão de Pessoas Selecionada', 
                        opts: [
                          { label: 'Excluir Usuários do Sistema', key: 'canDeleteUser' },
                          { label: 'Reset de Senhas', key: 'canResetPasswords' },
                          { label: 'Desabilitar e Reabilitar Usuários', key: 'canEnableDisableUsers' },
                        ]
                      },
                      {
                        group: 'Outros Dados',
                        opts: [
                          { label: 'Editar dados CRR', key: 'canEditCRR' },
                          { label: 'Visualizar em Modo Leitura', key: 'canReadOnlyMode' },
                        ]
                      },
                      {
                        group: 'Comunicação',
                        opts: [
                          { label: 'Gestão de Mensagens do Sistema', key: 'canManageMessages' },
                          { label: 'Enviar Avisos Oficiais', key: 'canSendBulletins' },
                          { label: 'Chat (Enviar Mensagens)', key: 'canChat' },
                        ]
                      }
                    ].map(category => (
                      <div key={category.group} className="space-y-2">
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-50 pb-1">{category.group}</h4>
                        <div className="space-y-2">
                          {category.opts.map(opt => (
                            <label key={opt.key} className="flex items-center gap-3 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                checked={(permissionModalUser as any)[opt.key]}
                                onChange={(e) => {
                                  setPermissionError(null);
                                  setPermissionModalUser({...permissionModalUser, [opt.key]: e.target.checked});
                                }}
                              />
                              <span className="text-xs font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors uppercase">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="mt-8 pt-4 border-t border-indigo-50">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Escopo de Controle</h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mb-3 text-red-500 italic">Necessário para ações do grupo "Gestão de Pessoas Selecionada"</p>
                      <button 
                        onClick={() => setShowScopeSelector(true)}
                        className="w-full bg-indigo-50 text-indigo-700 py-3 rounded-xl font-bold uppercase text-[10px] border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
                        Configurar Usuários Gerenciados ({(permissionModalUser.managedUserEmails || []).length})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 border-t bg-gray-50 flex gap-4">
              <button onClick={savePermissions} className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all text-xs">Salvar Alterações</button>
              <button onClick={() => setPermissionModalUser(null)} className="flex-1 bg-white border border-gray-200 text-gray-500 py-4 rounded-xl font-black uppercase hover:bg-gray-100 transition-all text-xs">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showScopeSelector && permissionModalUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[250] animate-fade-in backdrop-blur-md">
          <div className="bg-white rounded-3xl p-8 w-full max-w-xl shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h3 className="text-xl font-black text-indigo-900 uppercase tracking-tight">Escopo de Controle</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Selecione os usuários que {permissionModalUser.name} terá autoridade</p>
              </div>
              <button onClick={() => setShowScopeSelector(false)} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-2xl">
              <span className="text-[10px] font-black text-indigo-900 uppercase">Ações Rápidas:</span>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    const allEmails = users.filter(usr => usr.email !== 'Admin' && usr.id !== permissionModalUser.id).map(usr => usr.email);
                    setPermissionModalUser({...permissionModalUser, managedUserEmails: allEmails});
                  }}
                  className="text-[10px] font-black text-indigo-600 uppercase hover:underline"
                >
                  Selecionar Todos
                </button>
                <button 
                  onClick={() => setPermissionModalUser({...permissionModalUser, managedUserEmails: []})}
                  className="text-[10px] font-black text-red-500 uppercase hover:underline"
                >
                  Limpar Todos
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                {users.filter(usr => usr.email !== 'Admin' && usr.id !== permissionModalUser.id).map(usr => (
                  <label key={usr.id} className={`flex items-center gap-3 cursor-pointer p-4 rounded-2xl border-2 transition-all ${
                    (permissionModalUser.managedUserEmails || []).includes(usr.email) 
                    ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
                    : 'border-gray-100 hover:border-indigo-200'
                  }`}>
                    <input 
                      type="checkbox"
                      className="w-5 h-5 rounded-md text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                      checked={(permissionModalUser.managedUserEmails || []).includes(usr.email)}
                      onChange={(e) => {
                        const current = permissionModalUser.managedUserEmails || [];
                        const next = e.target.checked ? [...current, usr.email] : current.filter(email => email !== usr.email);
                        setPermissionModalUser({...permissionModalUser, managedUserEmails: next});
                      }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[12px] font-black leading-tight truncate uppercase ${
                        (permissionModalUser.managedUserEmails || []).includes(usr.email) ? 'text-indigo-900' : 'text-gray-700'
                      }`}>{usr.name}</span>
                      <span className="text-[9px] text-gray-400 font-bold truncate">{usr.email}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t">
              <button 
                onClick={() => setShowScopeSelector(false)}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all text-xs"
              >
                Confirmar Seleção ({(permissionModalUser.managedUserEmails || []).length})
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordConfirmUser && !newPasswordGenerated && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-sm shadow-2xl text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-indigo-900 uppercase tracking-tight">Alterar Senha?</h3>
              <p className="text-sm text-gray-500 mt-2">Deseja Realmente Alterar a Senha Deste Usuário (<strong>{passwordConfirmUser.name}</strong>)?</p>
              <p className="text-[10px] text-amber-600 font-bold uppercase mt-2">Uma nova senha será gerada aleatoriamente pelo sistema.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleChangePassword}
                disabled={loading}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all text-center"
              >
                {loading ? 'Processando...' : 'Sim, Alterar'}
              </button>
              <button onClick={() => setPasswordConfirmUser(null)} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black uppercase text-xs hover:bg-gray-200 transition-all text-center">Não, Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {newPasswordGenerated && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[210] backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-sm shadow-2xl text-center space-y-6 border-2 border-green-500 animate-zoom-in">
            <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 mx-auto flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-green-700 uppercase tracking-tight">Senha Alterada!</h3>
              <p className="text-sm text-gray-500 mt-2">A nova senha de <strong>{passwordConfirmUser?.name}</strong> foi gerada com sucesso:</p>
              <div className="mt-4 p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl font-bold">
                 <p className="text-2xl font-mono font-black text-indigo-900 tracking-widest selection:bg-indigo-100">{newPasswordGenerated}</p>
              </div>
              <p className="text-[9px] text-gray-400 font-bold uppercase mt-4">Anote ou copie a senha acima e informe ao usuário.</p>
            </div>
            <button 
              onClick={() => { setPasswordConfirmUser(null); setNewPasswordGenerated(null); }}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all text-center"
            >
              Concluído
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

const AdminBulletinsScreen = ({ goBack, navigate, currentUser }: any) => {
  const [messages, setMessages] = useState<BulletinMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const fetchBulletins = async () => {
    setLoading(true);
    const { data } = await supabase.from('bulletin_messages').select('*').order('created_at', { ascending: false });
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchBulletins(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este aviso?')) return;
    const { error } = await supabase.from('bulletin_messages').delete().eq('id', id);
    if (!error) {
      alert('Aviso excluído!');
      fetchBulletins();
    } else {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  return (
    <Layout title="Gestão de Avisos" onBack={goBack}>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-indigo-900 uppercase tracking-tight">Quadro de Avisos</h2>
            <p className="text-xs text-gray-400 font-bold uppercase">Gerencie os avisos oficiais do sistema</p>
          </div>
          <button 
            onClick={() => navigate('admin_bulletin_form')}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Aviso
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Carregando Avisos...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-100 italic font-bold text-gray-400 uppercase text-xs">
            Nenhum aviso cadastrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {messages.map(msg => (
              <div key={msg.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center group hover:shadow-xl hover:shadow-indigo-50 transition-all duration-300">
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="font-black text-indigo-900 uppercase tracking-tight truncate">{(msg.title?.toUpperCase() === 'COMUNICADO CORUS' || !msg.title) ? 'AVISO' : msg.title}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                      {new Date(msg.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Por: {msg.created_by}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedMessageId(msg.id)}
                    className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                    title="Ver Status de Leitura"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span className="text-[10px] font-black uppercase hidden sm:block">Status</span>
                  </button>
                  <button 
                    onClick={() => navigate('admin_bulletin_form', msg)}
                    className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                    title="Editar"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button 
                    onClick={() => handleDelete(msg.id)}
                    className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all"
                    title="Excluir"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {selectedMessageId && (
        <BulletinReadStatusModal 
          messageId={selectedMessageId} 
          onClose={() => setSelectedMessageId(null)} 
        />
      )}
    </Layout>
  );
};

const BulletinReadStatusModal = ({ messageId, onClose }: { messageId: string, onClose: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch users to map emails to names
      const { data: userData } = await supabase.from('users').select('email, name');
      const userMap: Record<string, string> = {};
      if (userData) {
        userData.forEach((u: any) => userMap[u.email] = u.name);
      }
      setUsers(userMap);

      // Fetch status for this message
      const { data: statusData } = await supabase.from('bulletin_user_status')
        .select('*')
        .eq('message_id', messageId);
      
      setStatuses(statusData || []);
      setLoading(false);
    };
    fetchData();
  }, [messageId]);

  const readCount = statuses.filter(s => s.status === 'read').length;
  const pendingCount = statuses.filter(s => s.status === 'pending').length;
  const totalCount = statuses.length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[500] animate-fade-in backdrop-blur-md">
      <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black text-indigo-900 uppercase tracking-tight">Status de Leitura</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Acompanhamento de engajamento do aviso</p>
          </div>
          <button onClick={onClose} className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Analisando dados...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-indigo-50 p-4 rounded-3xl text-center">
                <span className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Total</span>
                <p className="text-2xl font-black text-indigo-900">{totalCount}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-3xl text-center">
                <span className="text-[9px] font-black text-emerald-400 uppercase block mb-1">Lidos</span>
                <p className="text-2xl font-black text-emerald-600">{readCount}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-3xl text-center">
                <span className="text-[9px] font-black text-amber-500 uppercase block mb-1">Pendentes</span>
                <p className="text-2xl font-black text-amber-600">{pendingCount}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  Já leram ({readCount})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {statuses.filter(s => s.status === 'read').map(s => (
                    <div key={s.id} className="bg-gray-50 p-3 rounded-2xl flex items-center justify-between">
                      <span className="font-bold text-gray-700 text-xs truncate mr-2">{users[s.user_id] || s.user_id}</span>
                      <span className="text-[10px] font-black text-emerald-600 uppercase shrink-0 bg-emerald-50 px-2 py-1 rounded-lg">
                        {s.viewed_at ? new Date(s.viewed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Lido'}
                      </span>
                    </div>
                  ))}
                  {readCount === 0 && (
                    <p className="col-span-full py-4 text-center text-xs text-gray-400 italic">Ninguém confirmou a leitura ainda.</p>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-50">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  Pendentes ({pendingCount})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {statuses.filter(s => s.status === 'pending').map(s => (
                    <div key={s.id} className="bg-gray-50 p-3 rounded-2xl">
                      <span className="font-bold text-gray-700 text-xs truncate block">{users[s.user_id] || s.user_id}</span>
                      <span className="text-[8px] font-black text-gray-400 uppercase">{s.user_id}</span>
                    </div>
                  ))}
                  {pendingCount === 0 && (
                    <p className="col-span-full py-4 text-center text-xs text-gray-400 italic">Todos os destinatários já leram.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminBulletinForm = ({ goBack, navigate, initialData, currentUser }: any) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.from('users').select('*');
      setUsers(data || []);
      
      if (initialData?.id) {
        const { data: assocs } = await supabase.from('bulletin_user_status')
          .select('user_id')
          .eq('message_id', initialData.id);
        if (assocs) {
          setSelectedUserEmails(assocs.map((a: any) => a.user_id));
        }
      }
    };
    init();
  }, [initialData]);

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const handleSave = async () => {
    if (!content || content === '<p><br></p>') { alert('O conteúdo do aviso é obrigatório.'); return; }
    if (selectedUserEmails.length === 0) { setShowUserSelector(true); return; }

    setLoading(true);
    try {
      const msgId = initialData?.id || (crypto.randomUUID ? crypto.randomUUID() : generateId());
      const message: any = {
        id: msgId,
        title: title || 'Aviso',
        content,
        created_at: initialData?.created_at || getBrasiliaISO(),
        created_by: currentUser?.email || 'Admin'
      };

      const { error: msgErr } = await supabase.from('bulletin_messages').upsert(message);
      if (msgErr) throw msgErr;

      // Associate with users
      const associations = selectedUserEmails.map(email => ({
        message_id: msgId,
        user_id: email,
        status: 'pending',
        show_again: true
      }));

      if (initialData) {
        await supabase.from('bulletin_user_status').delete().eq('message_id', initialData.id);
      }
      
      const { error: assocErr } = await supabase.from('bulletin_user_status').insert(associations);
      if (assocErr) throw assocErr;

      alert('Aviso enviado com sucesso!');
      if (typeof navigate === 'function') {
        navigate('admin_bulletins');
      } else {
        goBack();
      }
    } catch (e: any) {
      console.error('Erro ao enviar aviso:', e);
      alert('Erro ao salvar: ' + (e.message || 'Erro desconhecido na tabela do banco de dados.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title={initialData ? "Editar Aviso" : "Novo Aviso"} onBack={goBack}>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="bg-white p-8 rounded-[32px] shadow-2xl space-y-6 border-b-8 border-indigo-600">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block ml-1">Título do Aviso (Opcional)</label>
            <input 
              type="text" 
              placeholder="Digite o título do aviso..."
              className="w-full border-2 border-gray-100 rounded-2xl p-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all font-bold text-indigo-900" 
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block ml-1">Conteúdo do Aviso</label>
            <div className="rounded-2xl overflow-hidden border-2 border-gray-100 min-h-[350px] bg-white">
              {typeof window !== 'undefined' && ReactQuill ? (
                <ReactQuill 
                  theme="snow" 
                  value={content} 
                  onChange={v => setContent(v)} 
                  modules={quillModules}
                  className="min-h-[450px] sm:min-h-[600px]"
                />
              ) : (
                <div className="p-8 text-center text-gray-400 font-bold italic animate-pulse">
                  Carregando editor...
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button 
              onClick={() => setShowUserSelector(true)}
              className="flex-1 bg-indigo-50 text-indigo-700 py-4 rounded-2xl font-black uppercase text-xs hover:bg-indigo-600 hover:text-white transition-all shadow-lg shadow-indigo-100/50 flex items-center justify-center gap-2 border-2 border-indigo-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
              {selectedUserEmails.length > 0 ? `Compartilhar com (${selectedUserEmails.length})` : 'Compartilhar com...'}
            </button>
            <button 
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Processando...' : initialData ? 'Salvar Edição' : 'Confirmar e Enviar'}
            </button>
          </div>
        </div>
      </div>

      {showUserSelector && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[300] animate-fade-in backdrop-blur-md">
          <div className="bg-white rounded-[40px] p-8 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start border-b border-gray-100 pb-6 mb-6">
              <div>
                <h3 className="text-2xl font-black text-indigo-900 uppercase tracking-tight">Destinatários</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Selecione quem verá este aviso</p>
              </div>
              <button onClick={() => setShowUserSelector(false)} className="bg-gray-100 p-2 rounded-xl text-gray-400 hover:text-red-500 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-2xl mb-4">
              <span className="text-[10px] font-black text-indigo-900 uppercase">Ações Rápidas:</span>
              <div className="flex gap-4">
                <button 
                  onClick={() => setSelectedUserEmails(users.filter(u => u.email !== 'Admin').map(u => u.email))}
                  className="text-[10px] font-black text-indigo-600 uppercase hover:underline"
                >
                  Selecionar Todos
                </button>
                <button 
                  onClick={() => setSelectedUserEmails([])}
                  className="text-[10px] font-black text-red-500 uppercase hover:underline"
                >
                  Limpar Todos
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                {users.filter(u => u.email !== 'Admin').map(usr => (
                  <label key={usr.id} className={`flex items-center gap-3 cursor-pointer p-4 rounded-2xl border-2 transition-all ${
                    selectedUserEmails.includes(usr.email) 
                    ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
                    : 'border-gray-100 hover:border-indigo-200'
                  }`}>
                    <input 
                      type="checkbox"
                      className="w-5 h-5 rounded-md text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                      checked={selectedUserEmails.includes(usr.email)}
                      onChange={(e) => {
                        const next = e.target.checked 
                          ? [...selectedUserEmails, usr.email] 
                          : selectedUserEmails.filter(email => email !== usr.email);
                        setSelectedUserEmails(next);
                      }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[12px] font-black uppercase truncate transition-all ${
                        selectedUserEmails.includes(usr.email) ? 'text-indigo-900' : 'text-gray-700'
                      }`}>{usr.name}</span>
                      <span className="text-[9px] text-gray-400 font-bold truncate lowercase">{usr.email}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 mt-6">
              <button 
                onClick={() => setShowUserSelector(false)}
                className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black uppercase shadow-xl shadow-indigo-100 active:scale-95 transition-all text-sm tracking-widest"
              >
                Confirmar Público ({selectedUserEmails.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

const BulletinDisplayModal = ({ unreadBulletins, onStatusUpdate, onDismiss }: { unreadBulletins: (BulletinMessage & { status_id: string })[], onStatusUpdate: () => void, onDismiss: () => void }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = unreadBulletins[currentIndex];

  if (!current) return null;

  const handleAction = async (status: 'read' | 'pending', showAgain: boolean) => {
    // Se for "Lido", atualizamos no banco para não mostrar mais.
    // Se for "Lembrar Depois", não precisamos atualizar o banco se já estiver como pending/true, 
    // mas vamos atualizar para garantir e registrar que o usuário interagiu.
    const { error } = await supabase.from('bulletin_user_status')
      .update({ 
        status, 
        show_again: showAgain, 
        viewed_at: status === 'read' ? getBrasiliaISO() : null 
      })
      .eq('id', current.status_id);
    
    if (!error) {
      if (currentIndex < unreadBulletins.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // Se for o último e o usuário escolheu "Lembrar Depois", 
        // apenas limpamos a lista local para fechar o modal nesta sessão.
        if (status === 'pending') {
          // Usamos uma prop onDismiss ou similar para fechar sem refetch
          onDismiss();
        } else {
          onStatusUpdate();
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-2 sm:p-4 z-[1000] animate-fade-in backdrop-blur-md">
      <div className="bg-white rounded-[24px] sm:rounded-[40px] w-full max-w-4xl shadow-2xl overflow-hidden animate-zoom-in flex flex-col max-h-[95vh] border border-white/20">
        
        <div className="bg-indigo-950 p-4 sm:p-5 text-white relative flex-shrink-0">
          <div className="absolute top-2 right-4 opacity-10">
             <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="relative z-10">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 text-indigo-300">{currentIndex + 1} / {unreadBulletins.length}</p>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none drop-shadow-sm">{(current.title?.toUpperCase() === 'COMUNICADO CORUS' || !current.title) ? 'AVISO' : current.title}</h2>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 prose prose-indigo max-w-none quill-content bg-white">
           <div className="bulletin-content-wrapper text-gray-800 leading-relaxed text-sm sm:text-base" dangerouslySetInnerHTML={{ __html: current.content }} />
           
           <style>{`
             .bulletin-content-wrapper img {
               max-width: 100%;
               height: auto;
               border-radius: 12px;
               margin: 1.5rem auto;
               display: block;
               box-shadow: 0 10px 30px rgba(0,0,0,0.1);
               transition: transform 0.3s ease;
             }
             .bulletin-content-wrapper p {
               margin-bottom: 1.25rem;
             }
             .bulletin-content-wrapper iframe {
               width: 100%;
               aspect-ratio: 16/9;
               border-radius: 12px;
               margin: 1rem 0;
             }
           `}</style>
        </div>

        <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-4 items-stretch flex-shrink-0">
           <button 
             onClick={() => handleAction('read', false)}
             className="flex-1 bg-emerald-600 text-white py-3 sm:py-3.5 rounded-[20px] font-black uppercase text-xs shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 active:scale-95 group"
           >
              <div className="p-1 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              Marcar como Lido
           </button>
           <button 
             onClick={() => handleAction('pending', true)}
             className="flex-1 bg-white text-indigo-900 border-2 border-indigo-100 py-3 sm:py-3.5 rounded-[20px] font-black uppercase text-xs hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 active:scale-95 hover:border-indigo-200"
           >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Lembrar Depois
           </button>
        </div>
      </div>
    </div>
  );
};

const BulletinHistoryScreen = ({ goBack, currentUser }: any) => {
  const [history, setHistory] = useState<(BulletinMessage & { status: string, viewed_at: string })[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const { data: statuses } = await supabase.from('bulletin_user_status')
        .select(`*, bulletin_messages(*)`)
        .eq('user_id', currentUser.email)
        .order('viewed_at', { ascending: false });
      
      const formatted = (statuses || []).map((s: any) => ({
        ...s.bulletin_messages,
        status: s.status,
        viewed_at: s.viewed_at,
        status_id: s.id
      }));
      setHistory(formatted);
      setLoading(false);
    };
    fetchHistory();
  }, [currentUser.email]);

  return (
    <Layout title="Meus Avisos" onBack={goBack}>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {loading ? (
           <div className="text-center py-20 animate-pulse">
             <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
             <span className="text-xs font-black text-indigo-400 uppercase tracking-widest italic">Buscando histórico...</span>
           </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-gray-100">
             <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-gray-200"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
             <p className="text-xs font-black text-gray-400 uppercase tracking-widest italic">Você ainda não recebeu nenhum aviso.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map(msg => (
              <details key={msg.status_id} className="group bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-50">
                <summary className="p-6 cursor-pointer list-none flex justify-between items-center">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-3 mb-1">
                       <span className={`w-2 h-2 rounded-full ${msg.status === 'read' ? 'bg-gray-300' : 'bg-indigo-600 animate-pulse'}`}></span>
                       <h3 className="font-black text-indigo-900 uppercase tracking-tight truncate">{(msg.title?.toUpperCase() === 'COMUNICADO CORUS' || !msg.title) ? 'AVISO' : msg.title}</h3>
                    </div>
                    <div className="flex gap-4 items-center">
                       <span className="text-[9px] font-black text-gray-400 uppercase">Enviado em: {new Date(msg.created_at).toLocaleDateString('pt-BR')}</span>
                       {msg.status === 'read' && <span className="text-[9px] font-black text-green-600 uppercase">Lido em: {new Date(msg.viewed_at).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                  <div className="text-indigo-400 group-open:rotate-180 transition-transform">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </summary>
                <div className="px-8 pb-8 pt-2 prose prose-indigo max-w-none prose-sm quill-content border-t border-gray-50 bg-gray-50/30">
                  <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

const AdminMessagesScreen = ({ goBack, currentUser }: any) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const isMaster = currentUser.email === 'Admin' || currentUser.isMasterAdmin;
  const canManage = isMaster || currentUser.canManageMessages;

  const fetchAll = async () => {
    setLoading(true);
    const { data: msgData } = await supabase.from('gca_chat_messages').select('*').order('created_at', { ascending: false });
    const { data: userData } = await supabase.from('users').select('*');
    setMessages(msgData || []);
    setUsers(userData || []);
    setLoading(false);
  };

  useEscapeKey(() => {
    if (showDeleteModal) {
      setShowDeleteModal(false);
      setAdminPassword('');
    } else if (showMultiDeleteModal) {
      setShowMultiDeleteModal(false);
      setAdminPassword('');
    } else if (selectedMsgIds.length > 0) {
      setSelectedMsgIds([]);
    } else if (selectedUserEmail) {
      setSelectedUserEmail(null);
    } else {
      goBack();
    }
  }, [showDeleteModal, showMultiDeleteModal, selectedMsgIds, selectedUserEmail, goBack]);

  useEffect(() => { fetchAll(); }, []);

  const markAsRead = async () => {
    if (!selectedUserEmail || loading) return;
    try {
      await supabase.from('gca_chat_messages')
        .update({ read_at: getBrasiliaISO() })
        .eq('sender_id', selectedUserEmail)
        .eq('receiver_id', 'Admin')
        .is('read_at', null);
    } catch (e) {
      console.warn("Erro ao marcar como lido:", e);
    }
  };

  useEffect(() => {
    if (selectedUserEmail) {
      markAsRead();
    }
  }, [selectedUserEmail, messages.length]);

  const handleDelete = async () => {
    if (adminPassword !== currentUser.password) {
      alert("Senha incorreta!");
      return;
    }
    if (!selectedUserEmail) return;
    
    setLoading(true);
    const { error } = await supabase.from('gca_chat_messages').delete().or(`sender_id.eq.${selectedUserEmail},receiver_id.eq.${selectedUserEmail}`);
    if (!error) {
      alert("Mensagens apagadas com sucesso!");
      fetchAll();
      setShowDeleteModal(false);
      setAdminPassword('');
    } else {
      alert("Erro ao apagar: " + error.message);
    }
    setLoading(false);
  };

  const handleMultiDelete = async () => {
    if (adminPassword !== currentUser.password) {
      alert("Senha incorreta!");
      return;
    }
    if (selectedMsgIds.length === 0) return;
    
    setLoading(true);
    const { error } = await supabase.from('gca_chat_messages').delete().in('id', selectedMsgIds);
    if (!error) {
      alert(`${selectedMsgIds.length} mensagens apagadas com sucesso!`);
      setSelectedMsgIds([]);
      fetchAll();
      setShowMultiDeleteModal(false);
      setAdminPassword('');
    } else {
      alert("Erro ao apagar: " + error.message);
    }
    setLoading(false);
  };

  const usersWithMessages = Array.from(new Set(messages.map(m => m.sender_id === 'Admin' ? m.receiver_id : m.sender_id)));
  
  const sortedUsers = usersWithMessages.map(email => {
    const userMsgs = messages.filter(m => m.sender_id === email || m.receiver_id === email);
    const lastMsgDate = userMsgs.length > 0 ? new Date(userMsgs[0].created_at).getTime() : 0;
    return { email, lastMsgDate };
  }).sort((a, b) => {
    return b.lastMsgDate - a.lastMsgDate;
  }).map(u => u.email);

  const filteredUsers = (sortedUsers as string[]).filter(email => {
    const user = users.find(u => u.email === email);
    if (!user) return email.toLowerCase().includes(searchTerm.toLowerCase());
    return user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (user.congregation || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <Layout title="Ambiente de Mensagens" onBack={goBack}>
      <div className="max-w-4xl mx-auto py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-4 bg-indigo-900 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                <span>Contatos</span>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-indigo-800 border-none text-[10px] px-3 py-1.5 rounded w-28 outline-none placeholder:text-indigo-400 font-bold"
                  />
                </div>
             </div>
             <div className="divide-y divide-gray-50 h-[60vh] overflow-y-auto">
                {filteredUsers.map(email => {
                  const userObj = users.find(u => u.email === email);
                  const userMsgs = messages.filter(m => m.sender_id === email);
                  const isUnread = userMsgs.some(m => !m.read_at && m.receiver_id === 'Admin');

                  return (
                    <button 
                      key={email} 
                      onClick={() => setSelectedUserEmail(email)}
                      className={`w-full p-4 text-left hover:bg-indigo-50 transition-all flex justify-between items-center ${selectedUserEmail === email ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                    >
                      <div className="flex flex-col">
                        <span className={`font-bold text-sm uppercase ${isUnread ? 'text-indigo-600 font-black' : 'text-indigo-900'}`}>{userObj?.name || email}</span>
                        <span className="text-xs text-gray-400 font-bold uppercase truncate max-w-[140px]">{userObj?.congregation ? `Cong: ${userObj.congregation}` : email}</span>
                      </div>
                      {isUnread && <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce shadow-sm"></span>}
                    </button>
                  );
                })}
                {filteredUsers.length === 0 && <div className="p-8 text-center text-gray-400 text-[10px] font-bold uppercase italic">Nenhuma conversa encontrada</div>}
             </div>
          </div>

          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[60vh]">
             {selectedUserEmail ? (
               <>
                 <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div>
                      <h4 className="font-black text-indigo-900 uppercase text-sm">{users.find(u => u.email.toLowerCase() === selectedUserEmail?.toLowerCase())?.name || selectedUserEmail}</h4>
                    </div>
                    {canManage && (
                      <button 
                        onClick={() => setShowDeleteModal(true)}
                        className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-black uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        Apagar Tudo
                      </button>
                    )}
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                    {messages.filter(m => m.sender_id === selectedUserEmail || m.receiver_id === selectedUserEmail)
                      .reverse()
                      .map((m, idx, arr) => {
                        const prevMsg = arr[idx - 1];
                        const showDate = !prevMsg || new Date(m.created_at).toLocaleDateString('pt-BR') !== new Date(prevMsg.created_at).toLocaleDateString('pt-BR');
                        
                        return (
                          <React.Fragment key={m.id}>
                             {showDate && (
                               <div className="flex justify-center my-4">
                                 <span className="bg-gray-200/50 text-gray-500 text-xs font-black uppercase px-4 py-1.5 rounded-full tracking-tighter shadow-sm border border-gray-100">
                                   {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                 </span>
                               </div>
                             )}
                             <div className={`flex items-center gap-3 ${m.sender_id === 'Admin' ? 'flex-row-reverse justify-start' : 'justify-start'}`}>
                               <input 
                                 type="checkbox"
                                 checked={selectedMsgIds.includes(m.id)}
                                 onChange={() => {
                                   if (selectedMsgIds.includes(m.id)) {
                                     setSelectedMsgIds(selectedMsgIds.filter(id => id !== m.id));
                                   } else {
                                     setSelectedMsgIds([...selectedMsgIds, m.id]);
                                   }
                                 }}
                                 className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                               />
                               <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm text-sm font-medium leading-relaxed relative ${m.sender_id === 'Admin' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-100 text-gray-800'}`}>
                                {m.deleted_for_everyone ? (
                                   <div className="flex flex-col gap-1">
                                      <p className="italic opacity-50 flex items-center gap-1 font-bold uppercase text-[9px] text-red-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                        Apagada pelo Usuário
                                      </p>
                                      <p className="opacity-40">{m.text}</p>
                                   </div>
                                ) : (
                                   <p>{m.text}</p>
                                )}
                                <div className="flex justify-between items-center gap-4 mt-1">
                                  <p className={`text-xs font-bold uppercase ${m.sender_id === 'Admin' ? 'text-indigo-200' : 'text-gray-400'}`}>
                                    {m.is_edited && <span className="mr-2 italic opacity-70">(Editada)</span>}
                                    {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  {m.sender_id === 'Admin' && (
                                    <div className="flex items-center ml-1">
                                      {m.read_at ? (
                                        <div className="flex -space-x-1.5">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        </div>
                                      ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="opacity-40"><polyline points="20 6 9 17 4 12"/></svg>
                                      )}
                                    </div>
                                  )}
                                </div>
                             </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                 </div>
                 {selectedMsgIds.length > 0 && canManage && (
                   <div className="p-3 border-t bg-white flex justify-center animate-slide-up sticky bottom-0 z-40 bg-white/80 backdrop-blur-sm">
                      <button 
                        onClick={() => setShowMultiDeleteModal(true)}
                        className="bg-orange-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs shadow-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all w-full md:w-auto"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                        Apagar {selectedMsgIds.length} Selecionadas (Permanente)
                      </button>
                   </div>
                 )}
               </>
             ) : (
               <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <p className="text-sm font-black uppercase tracking-widest italic">Selecione uma conversa para visualizar o histórico</p>
               </div>
             )}
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-sm shadow-2xl text-center space-y-6 animate-zoom-in">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-indigo-900 uppercase">Confirmar Exclusão Total</h3>
              <p className="text-sm text-gray-500 mt-2">Isto apagará permanentemente TODO o histórico desta conversa no banco de dados. Digite sua senha Administradora para confirmar:</p>
            </div>
            <input 
              type="password" 
              placeholder="Sua senha..."
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              className="w-full border-2 border-gray-100 rounded-xl p-3 text-center font-bold focus:border-indigo-600 outline-none transition-all"
            />
            <div className="flex gap-3">
              <button 
                onClick={handleDelete}
                disabled={loading || !adminPassword}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all"
              >
                {loading ? 'Apagando...' : 'Confirmar Exclusão'}
              </button>
              <button onClick={() => { setShowDeleteModal(false); setAdminPassword(''); }} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black uppercase text-xs hover:bg-gray-200 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showMultiDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-sm shadow-2xl text-center space-y-6 animate-zoom-in">
            <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 mx-auto flex items-center justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-indigo-900 uppercase">Excluir Mensagens Selecionadas</h3>
              <p className="text-sm text-gray-500 mt-2">Você selecionou {selectedMsgIds.length} mensagens. Isto as removerá permanentemente do banco de dados. Digite sua senha Administradora para confirmar:</p>
            </div>
            <input 
              type="password" 
              placeholder="Sua senha..."
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              className="w-full border-2 border-gray-100 rounded-xl p-3 text-center font-bold focus:border-indigo-600 outline-none transition-all font-mono"
            />
            <div className="flex gap-3">
              <button 
                onClick={handleMultiDelete}
                disabled={loading || !adminPassword}
                className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all"
              >
                {loading ? 'Apagando...' : `Confirmar (${selectedMsgIds.length})`}
              </button>
              <button onClick={() => { setShowMultiDeleteModal(false); setAdminPassword(''); }} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black uppercase text-xs hover:bg-gray-200 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

const FloatingChat = ({ currentUser, isAdmin: isAdminProp }: { currentUser: UserAccount, isAdmin?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const isAdmin = isAdminProp ?? (currentUser.email === 'Admin' || currentUser.isMasterAdmin || currentUser.canChat);
  const [activeAdminConvo, setActiveAdminConvo] = useState<string | null>(null);
  const [userList, setUserList] = useState<UserAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [showMsgOptions, setShowMsgOptions] = useState<string | null>(null);
  const [convoSearch, setConvoSearch] = useState('');
  const [showConvoSearch, setShowConvoSearch] = useState(false);

  // Notificações e Marcador de Lidas
  const [unreadCount, setUnreadCount] = useState(0);

  // Esc key closure support
  useEscapeKey(() => {
    if (showMsgOptions) {
      setShowMsgOptions(null);
    } else if (editingMsg) {
      setEditingMsg(null);
      setText('');
    } else if (replyTo) {
      setReplyTo(null);
    } else if (showConvoSearch) {
      setShowConvoSearch(false);
    } else if (isAdmin && activeAdminConvo) {
      setActiveAdminConvo(null);
    } else if (isOpen) {
      setIsOpen(false);
      setIsExpanded(false);
    }
  }, [showMsgOptions, editingMsg, replyTo, showConvoSearch, activeAdminConvo, isOpen, isAdmin]);

  const fetchMessages = async (isInitial = false) => {
    try {
      if (!currentUser?.email) return;

      const otherPerson = isAdmin ? activeAdminConvo : 'Admin';
      
      // Busca geral para Admin (lista de conversas)
      if (isAdmin && !activeAdminConvo) {
        const { data: users } = await supabase.from('users').select('*');
        setUserList(users || []);
        
        const { data: allMsgs } = await supabase.from('gca_chat_messages')
          .select('*')
          .eq('status', 'Ativa')
          .order('created_at', { ascending: false });
        
        const msgs = allMsgs || [];
        setMessages(msgs);
        setUnreadCount(msgs.filter(m => m.receiver_id === 'Admin' && !m.read_at).length);
        return;
      }

      // Busca específica de conversa
      const { data } = await supabase.from('gca_chat_messages')
        .select('*')
        .eq('status', 'Ativa')
        .or(`and(sender_id.eq.${currentUser.email},receiver_id.eq.${otherPerson}),and(sender_id.eq.${otherPerson},receiver_id.eq.${currentUser.email})`)
        .order('created_at', { ascending: true });

      const newMessages = data || [];
      
      if (!isInitial && newMessages.length > messages.length) {
        const lastNew = newMessages[newMessages.length - 1];
        if (lastNew.sender_id !== currentUser.email && !isOpen) {
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
            audio.volume = 0.4;
            audio.play();
          } catch (e) {}
        }
      }

      setMessages(newMessages);

      if (!isOpen && !isAdmin) {
        setUnreadCount(newMessages.filter(m => m.receiver_id === currentUser.email && !m.read_at).length);
      }
    } catch (err) {
      console.error("Erro ao buscar mensagens:", err);
    }
  };

  // Real-time Subscription
  useEffect(() => {
    const channel = supabase
      .channel('chat_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gca_chat_messages' }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeAdminConvo]);

  useEffect(() => {
    fetchMessages(true);
  }, [isOpen, activeAdminConvo]);

  useEffect(() => {
    if (isOpen) {
       setUnreadCount(0);
    }
  }, [isOpen]);

  const markAsRead = async () => {
    if (!isOpen) return;
    const otherEmail = isAdmin ? activeAdminConvo : 'Admin';
    if (!otherEmail) return;

    try {
      await supabase.from('gca_chat_messages')
        .update({ read_at: getBrasiliaISO() })
        .eq('sender_id', otherEmail)
        .eq('receiver_id', isAdmin ? 'Admin' : currentUser.email)
        .is('read_at', null);
      
      fetchMessages();
    } catch (e) {
      console.warn("Erro ao marcar como lido (floating):", e);
    }
  };

  useEffect(() => {
    markAsRead();
  }, [isOpen, activeAdminConvo, messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !currentUser?.email) return;

    const receiver = isAdmin ? activeAdminConvo : 'Admin';
    if (!receiver) return;

    const msgText = text.trim();
    setText(''); // Optimistic clear

    try {
      if (editingMsg) {
        // Nova Lógica de Edição:
        // 1. Desativa a mensagem antiga
        await supabase.from('gca_chat_messages').update({
          status: 'Desativada'
        }).eq('id', editingMsg.id);

        // 2. Cria uma nova mensagem baseada na antiga, mas com o novo texto
        await supabase.from('gca_chat_messages').insert({
          sender_id: isAdmin ? 'Admin' : currentUser.email,
          receiver_id: receiver,
          sender_name: isAdmin ? 'Administrador' : (currentUser.name || 'Usuário'),
          text: msgText,
          status: 'Ativa',
          is_edited: true,
          original_message_id: editingMsg.id,
          reply_to_id: editingMsg.reply_to_id
        });

        setEditingMsg(null);
      } else {
        await supabase.from('gca_chat_messages').insert({
          sender_id: isAdmin ? 'Admin' : currentUser.email,
          receiver_id: receiver,
          sender_name: isAdmin ? 'Administrador' : (currentUser.name || 'Usuário'),
          text: msgText,
          status: 'Ativa',
          reply_to_id: replyTo?.id
        });
      }
      setReplyTo(null);
      fetchMessages();
    } catch (error: any) {
      console.error("Erro no chat:", error);
      alert("Erro ao enviar: " + error.message);
    }
  };

  const deleteMessage = async (msg: ChatMessage, forEveryone: boolean = false) => {
    try {
      if (forEveryone) {
        const diff = Date.now() - new Date(msg.created_at).getTime();
        if (diff / 60000 > 10) return alert("Só é possível apagar para todos nos primeiros 10 minutos.");
        await supabase.from('gca_chat_messages').update({ deleted_for_everyone: true }).eq('id', msg.id);
      } else {
        await supabase.from('gca_chat_messages').update({ status: 'Desativada' }).eq('id', msg.id);
      }
      setShowMsgOptions(null);
      fetchMessages();
    } catch (e) {}
  };

  const clearChat = async () => {
    // Função removida a pedido do usuário
  };

  if (!currentUser) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end gap-3 no-print">
      {isOpen && (
        <div className={`bg-[#f8fafc] shadow-2xl border border-indigo-100 flex flex-col overflow-hidden animate-slide-up transition-all duration-300 ${isExpanded ? 'fixed inset-0 w-screen h-screen z-[1000] rounded-none' : 'w-96 h-[600px] rounded-3xl'}`}>
          {/* Header System Style */}
          <div className={`${isExpanded ? 'p-6' : 'p-4'} bg-indigo-600 text-white flex justify-between items-center shrink-0 shadow-lg z-20`}>
            <div className="flex items-center gap-3">
              {isAdmin && activeAdminConvo && (
                <button onClick={() => { setActiveAdminConvo(null); setShowConvoSearch(false); setConvoSearch(''); }} className="p-2 hover:bg-white/20 rounded-full transition-colors mr-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
              )}
              <div className="relative group">
                <div className={`bg-indigo-400 rounded-full flex items-center justify-center font-black uppercase text-white shadow-inner border-2 border-indigo-500/50 ${isExpanded ? 'w-14 h-14 text-2xl' : 'w-10 h-10 text-sm'}`}>
                  {isAdmin ? (
                    activeAdminConvo ? (userList.find(u => u.email === activeAdminConvo)?.name?.charAt(0) || 'U') : 'A'
                  ) : 'S'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-indigo-600 rounded-full"></div>
              </div>
              <div className="flex flex-col">
                <span className={`font-black tracking-tight leading-none ${isExpanded ? 'text-2xl' : 'text-base'}`}>
                  {isAdmin ? (
                    activeAdminConvo ? (userList.find(u => u.email === activeAdminConvo)?.name || activeAdminConvo) : 'Portal de Suporte'
                  ) : 'Suporte CORUS'}
                </span>
                <span className="text-[10px] opacity-70 font-black uppercase tracking-widest mt-1">Atendimento Online</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isAdmin || activeAdminConvo ? (
                <button onClick={() => setShowConvoSearch(!showConvoSearch)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </button>
              ) : null}
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-white/20 rounded-full transition-colors hidden sm:block">
                {isExpanded ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="10" y1="14" x2="3" y2="21"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                )}
              </button>
              <button onClick={() => { setIsOpen(false); setIsExpanded(false); }} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          
          {/* Chat Content */}
          <div className="flex-1 overflow-y-auto relative p-0 bg-slate-50 flex flex-col">
            {showConvoSearch && (activeAdminConvo || !isAdmin) && (
              <div className="p-3 bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm animate-slide-down">
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Pesquisar mensagens..."
                  value={convoSearch}
                  onChange={e => setConvoSearch(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-xl py-2 px-4 text-xs font-bold outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-indigo-600 transition-all"
                />
              </div>
            )}

            {isAdmin && !activeAdminConvo ? (
               <div className="bg-white h-full divide-y divide-gray-50 flex flex-col">
                  <div className="p-3 sticky top-0 bg-white z-10 shadow-sm">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Procurar contatos..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-100 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition-all"
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {userList.filter(u => u.email !== 'Admin').filter(u => 
                      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())
                    ).sort((a, b) => {
                      const aMsgs = messages.filter(m => m.sender_id === a.email || m.receiver_id === a.email);
                      const bMsgs = messages.filter(m => m.sender_id === b.email || m.receiver_id === b.email);
                      const aTime = aMsgs[0] ? new Date(aMsgs[0].created_at).getTime() : 0;
                      const bTime = bMsgs[0] ? new Date(bMsgs[0].created_at).getTime() : 0;
                      return bTime - aTime;
                    }).map(u => {
                      const userMsgs = messages.filter(m => m.sender_id === u.email || m.receiver_id === u.email);
                      const lastMsg = userMsgs[0];
                      const isUnread = messages.some(m => m.sender_id === u.email && !m.read_at && m.receiver_id === 'Admin');

                      return (
                        <button key={u.id} onClick={() => setActiveAdminConvo(u.email)} className="w-full flex items-center gap-4 p-4 hover:bg-indigo-50 transition-all border-b border-gray-50 group">
                           <div className="relative">
                             <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 uppercase font-black text-xl shadow-sm border border-indigo-200 group-hover:scale-110 transition-transform">
                                {u.name.charAt(0)}
                             </div>
                             {isUnread && <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 border-2 border-white rounded-full"></div>}
                           </div>
                           <div className="flex-1 text-left overflow-hidden">
                              <div className="flex justify-between items-center mb-1">
                                 <span className="font-black text-sm truncate text-indigo-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{u.name}</span>
                                 {lastMsg && <span className="text-[10px] font-black text-gray-400">{new Date(lastMsg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                              </div>
                              <div className="flex justify-between items-center">
                                 <p className={`text-xs truncate ${isUnread ? 'text-indigo-600 font-black' : 'text-gray-500 font-medium'}`}>
                                    {lastMsg ? lastMsg.text : 'Conversa vazia'}
                                 </p>
                                 {isUnread && <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm ml-2">NOVO</span>}
                              </div>
                           </div>
                        </button>
                      );
                    })}
                  </div>
               </div>
            ) : (
               <div className="flex flex-col min-h-full px-4 py-6 space-y-4">
                  {messages.filter(m => convoSearch ? m.text.toLowerCase().includes(convoSearch.toLowerCase()) : true).map((m, idx, arr) => {
                     const isMe = m.sender_id === currentUser.email;
                     const prevMsg = arr[idx-1];
                     const showDate = !prevMsg || new Date(m.created_at).toLocaleDateString('pt-BR') !== new Date(prevMsg.created_at).toLocaleDateString('pt-BR');
                     const repliedMsg = m.reply_to_id ? messages.find(rm => rm.id === m.reply_to_id) : null;

                     return (
                       <React.Fragment key={m.id}>
                          {showDate && (
                            <div className="flex justify-center my-6">
                               <span className="bg-white text-gray-400 text-[10px] font-black uppercase px-6 py-2 rounded-2xl shadow-sm border border-gray-100 tracking-widest">
                                  {new Date(m.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                               </span>
                            </div>
                          )}
                          <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                             <div 
                               onClick={() => setShowMsgOptions(m.id)}
                               className={`max-w-[85%] relative p-3 shadow-sm rounded-2xl text-sm transition-all cursor-pointer group animate-fade-in ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white rounded-tl-none text-gray-800 border border-indigo-50/50'}`}
                             >
                                {repliedMsg && (
                                   <div className={`p-2 rounded-xl mb-2 text-xs opacity-80 border-l-4 overflow-hidden truncate flex flex-col gap-0.5 ${isMe ? 'bg-indigo-700 border-indigo-300' : 'bg-indigo-50 border-indigo-600'}`}>
                                      <span className="font-black uppercase text-[8px] tracking-widest">Em resposta a</span>
                                      <p className="truncate italic">"{repliedMsg.text}"</p>
                                   </div>
                                )}
                                {m.deleted_for_everyone ? (
                                   <p className="italic opacity-50 text-[11px] flex items-center gap-2 font-black uppercase tracking-tighter decoration-1 line-through">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                      Mensagem removida
                                   </p>
                                ) : <p className="leading-relaxed font-bold tracking-tight">{m.text}</p>}
                                <div className="flex justify-end items-center gap-1.5 mt-1.5">
                                   <span className={`text-[9px] font-black uppercase tracking-widest ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                      {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                   </span>
                                   {isMe && !m.deleted_for_everyone && (
                                      <div className="flex">
                                         {m.read_at ? (
                                            <div className="flex -space-x-1.5 text-blue-300">
                                               <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                               <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                            </div>
                                         ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 text-indigo-300"><polyline points="20 6 9 17 4 12"/></svg>
                                         )}
                                      </div>
                                   )}
                                </div>
                                
                                {/* Overlay hover options indicator */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 bg-black/10 rounded-full">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                             </div>
                          </div>
                          
                          {showMsgOptions === m.id && (
                             <div className="fixed inset-0 z-[1100] bg-indigo-900/10 backdrop-blur-[2px]" onClick={() => setShowMsgOptions(null)}>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl shadow-2xl p-3 w-64 animate-zoom-in border border-indigo-50" onClick={e => e.stopPropagation()}>
                                   <div className="flex justify-between items-center px-4 py-2 border-b border-gray-50 mb-2">
                                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Opções da Mensagem</span>
                                      <button onClick={() => setShowMsgOptions(null)} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                      </button>
                                   </div>
                                   <button onClick={() => { setReplyTo(m); setShowMsgOptions(null); setEditingMsg(null); }} className="w-full text-left p-3 hover:bg-indigo-50 rounded-2xl text-xs font-black uppercase text-indigo-600 flex items-center gap-4 transition-colors">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                                     Responder
                                   </button>
                                   {isMe && !m.deleted_for_everyone && (
                                      <>
                                         <button onClick={() => { setText(m.text); setEditingMsg(m); setShowMsgOptions(null); setReplyTo(null); }} className="w-full text-left p-3 hover:bg-yellow-50 rounded-2xl text-xs font-black uppercase text-yellow-600 flex items-center gap-4 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                            Editar
                                         </button>
                                         <button onClick={() => deleteMessage(m, true)} className="w-full text-left p-3 hover:bg-red-50 rounded-2xl text-xs font-black uppercase text-red-600 flex items-center gap-4 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                            Apagar para todos
                                         </button>
                                      </>
                                   )}
                                   <button onClick={() => deleteMessage(m, false)} className="w-full text-left p-3 hover:bg-gray-50 rounded-2xl text-xs font-black uppercase text-gray-500 flex items-center gap-4 transition-colors">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                      Ocultar apenas para mim
                                   </button>
                                </div>
                             </div>
                          )}
                       </React.Fragment>
                     );
                  })}
                  {messages.length === 0 && (
                     <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4 grayscale opacity-40">
                        <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center">
                           <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <p className="text-xs font-black text-indigo-900 uppercase tracking-widest leading-loose">Nenhuma mensagem nesta conversa ainda.<br/>Digite algo para começar!</p>
                     </div>
                  )}
               </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col bg-white p-4 border-t border-indigo-50 shadow-inner">
            {replyTo && (
               <div className="bg-indigo-50 p-2.5 rounded-2xl border-l-4 border-indigo-600 flex justify-between items-center animate-slide-up mb-3 shadow-sm">
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="text-[8px] font-black text-indigo-600 uppercase tracking-tighter">Respondendo Mensagem</span>
                    <div className="truncate text-xs text-indigo-900 font-medium italic">"{replyTo.text}"</div>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-indigo-300 hover:text-red-500 p-2 bg-white rounded-full shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
               </div>
            )}
            {editingMsg && (
               <div className="bg-yellow-50 p-2.5 flex justify-between items-center border-l-4 border-yellow-500 animate-slide-up mb-3 rounded-2xl shadow-sm">
                  <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                     <span className="text-[8px] font-black text-yellow-600 uppercase">Editando sua mensagem</span>
                     <p className="text-xs text-yellow-900 font-medium truncate italic">"{editingMsg.text}"</p>
                  </div>
                  <button onClick={() => { setEditingMsg(null); setText(''); }} className="text-yellow-400 hover:text-red-500 p-2 bg-white rounded-full shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
               </div>
            )}
            <form onSubmit={handleSend} className="flex items-center gap-3">
                    <div className="flex-1 relative group">
                      <input 
                        disabled={isAdmin && !activeAdminConvo}
                        type="text" 
                        placeholder={isAdmin && !activeAdminConvo ? "Selecione um chat..." : "Escreva sua mensagem..."}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        className="w-full bg-gray-100 border-none rounded-2xl py-3.5 px-6 text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600 transition-all shadow-sm placeholder:text-gray-400 disabled:opacity-50"
                      />
                    </div>
                    <button type="submit" disabled={!text.trim() || (isAdmin && !activeAdminConvo)} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200 active:scale-90 hover:bg-indigo-700 transition-all disabled:opacity-50 group">
                       <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
            </form>
          </div>
        </div>
      )}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`group relative flex items-center justify-center rounded-3xl shadow-2xl transition-all duration-500 active:scale-90 ${isOpen ? 'w-16 h-16 bg-red-500 rotate-90 scale-110' : 'w-20 h-20 bg-indigo-600 hover:scale-110'}`}
      >
        {!isOpen && unreadCount > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black rounded-xl min-w-[28px] h-[28px] flex items-center justify-center p-1 border-4 border-white animate-bounce shadow-xl z-10">
            {unreadCount}
          </div>
        )}
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-white"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <div className="flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white mb-0.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.4 8.38 8.38 0 0 1 3.8.9L21 3z"/></svg>
            <span className="text-[8px] font-black text-indigo-100 uppercase tracking-tighter">Chat</span>
          </div>
        )}
      </button>
    </div>
  );
};

const ProfileScreen = ({ user, goBack, onUpdate, onExitImpersonation }: any) => {
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: user.name, phone: user.phone, birth_date: '', email: user.email });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [stateName, setStateName] = useState('');
  const [congregationName, setCongregationName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPasswordModal) {
          setShowPasswordModal(false);
          setPasswordForm({ current: '', next: '', confirm: '' });
          setPasswordError(null);
        } else if (isEditing) {
          setIsEditing(false);
        } else {
          goBack();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showPasswordModal, isEditing, goBack]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('conductors').select('*').eq('email', user.email).single();
      if (data) {
        setConductor(data);
        setEditForm(prev => ({ ...prev, birth_date: data.birth_date || '' }));
        const { data: stateData } = await supabase.from('states').select('name').eq('id', data.state_id).single();
        if (stateData) setStateName(stateData.name);
        const { data: congreData } = await supabase.from('congregations_admin').select('name').eq('id', data.congregation_id).single();
        if (congreData) setCongregationName(congreData.name);
      }
    };
    load();
  }, [user.email]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const { error: userErr } = await supabase.from('users').update({
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email
      }).eq('id', user.id);

      if (conductor) {
        await supabase.from('conductors').update({
          name: editForm.name,
          phone: editForm.phone,
          email: editForm.email,
          birth_date: editForm.birth_date
        }).eq('id', conductor.id);
      }

      if (!userErr) {
        onUpdate({ ...user, ...editForm });
        setIsEditing(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    if (passwordForm.current !== user.password) {
      setPasswordError("Senha atual incorreta");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError("A nova senha e a confirmação não coincidem");
      return;
    }
    if (passwordForm.next.length < 4) {
      setPasswordError("A nova senha deve ter pelo menos 4 caracteres");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('users').update({ password: passwordForm.next }).eq('id', user.id);
    if (!error) {
      onUpdate({ ...user, password: passwordForm.next });
      setShowPasswordModal(false);
      setPasswordForm({ current: '', next: '', confirm: '' });
      alert("Senha alterada com sucesso!");
    } else {
      setPasswordError("Erro ao processar alteração");
    }
    setLoading(false);
  };

  const calculateAge = (date: string) => {
    if (!date) return '-';
    const birth = new Date(date);
    const now = getBrasiliaDate();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };

  return (
    <Layout title="Meu Perfil" onBack={goBack} onExitImpersonation={onExitImpersonation}>
      <div className="max-w-4xl mx-auto py-10 px-4 space-y-12 animate-fade-in">
        
        {/* Formulário de Informações */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden max-w-2xl mx-auto">
          <div className="p-8 border-b border-indigo-50 flex justify-between items-center bg-indigo-50/30">
            <div>
              <h3 className="text-xl font-black text-indigo-900 uppercase tracking-tighter">Informações Pessoais</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-widest">Apenas campos autorizados para edição</p>
            </div>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`p-3 rounded-2xl transition-all ${isEditing ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-600 border border-indigo-100 shadow-sm'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest block mb-2">Nome Completo</label>
                <input 
                  disabled={!isEditing}
                  className={`w-full p-4 rounded-xl font-bold border-2 transition-all ${isEditing ? 'border-indigo-100 bg-white focus:border-indigo-600 outline-none' : 'border-transparent bg-gray-50 text-gray-400'}`}
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest block mb-2">E-mail / Gmail</label>
                <input 
                  type="email"
                  disabled={!isEditing}
                  className={`w-full p-4 rounded-xl font-bold border-2 transition-all ${isEditing ? 'border-indigo-100 bg-white focus:border-indigo-600 outline-none' : 'border-transparent bg-gray-50 text-gray-400'}`}
                  value={editForm.email}
                  onChange={e => setEditForm({...editForm, email: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest block mb-2">Telefone</label>
                <input 
                  disabled={!isEditing}
                  className={`w-full p-4 rounded-xl font-bold border-2 transition-all ${isEditing ? 'border-indigo-100 bg-white focus:border-indigo-600 outline-none' : 'border-transparent bg-gray-50 text-gray-400'}`}
                  value={editForm.phone}
                  onChange={e => setEditForm({...editForm, phone: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest block mb-2">Data de Nascimento (Idade: {calculateAge(editForm.birth_date)})</label>
                <input 
                  type="date"
                  disabled={!isEditing}
                  className={`w-full p-4 rounded-xl font-bold border-2 transition-all ${isEditing ? 'border-indigo-100 bg-white focus:border-indigo-600 outline-none' : 'border-transparent bg-gray-50 text-gray-400'}`}
                  value={editForm.birth_date}
                  onChange={e => setEditForm({...editForm, birth_date: e.target.value})}
                />
              </div>

              {/* Informações Read-Only do CRR */}
              <div className="md:col-span-2 pt-6 border-t border-gray-50">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Informações de Registro (Não Editáveis)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nº Registro (CRR)</span>
                    <p className="font-black text-indigo-900">{conductor?.registry_number || 'PENDENTE'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Cargo / Função</span>
                    <p className="font-black text-indigo-900 uppercase">{user.role}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Congregação</span>
                    <p className="font-black text-indigo-900 uppercase">{congregationName || user.congregation}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Estado de Atuação</span>
                    <p className="font-black text-indigo-900 uppercase">{stateName || '-'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Data de Cadastro</span>
                    <p className="font-black text-indigo-900">{conductor?.created_at ? new Date(conductor.created_at).toLocaleDateString('pt-BR') : '-'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Status de Validade</span>
                    <p className="font-black text-green-600 uppercase">VIGENTE</p>
                  </div>
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="pt-4 flex gap-3 animate-slide-up">
                <button 
                  onClick={handleUpdate}
                  disabled={loading}
                  className="flex-1 bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                >
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
                <button 
                  onClick={() => { setIsEditing(false); setEditForm({ name: user.name, phone: user.phone, birth_date: conductor?.birth_date || '', email: user.email }); }}
                  className="px-8 bg-gray-100 text-gray-400 font-bold uppercase text-[10px] rounded-2xl hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            )}
            
            <div className="pt-8 border-t border-gray-100 flex flex-col items-center">
              <button 
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-3 text-indigo-600 font-black uppercase text-[11px] tracking-widest hover:text-indigo-800 transition-all group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Alterar Senha de Acesso
              </button>
            </div>
          </div>
        </div>

        <button 
          onClick={goBack}
          className="w-full max-w-2xl mx-auto block py-4 text-gray-400 font-bold uppercase text-[10px] tracking-[5px] hover:text-gray-600 transition-all"
        >
          Voltar ao Início
        </button>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[500] animate-fade-in">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl space-y-6 animate-scale-up">
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full mx-auto flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3m-3-3l2.5-2.5"/></svg>
              </div>
              <h3 className="text-xl font-black text-indigo-900 uppercase">Trocar Senha</h3>
            </div>

            {passwordError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-[10px] font-black uppercase border-l-4 border-red-500 animate-pulse">
                {passwordError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Senha Atual</label>
                <input 
                  type="password"
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 rounded-xl outline-none font-black text-center tracking-[4px]"
                  value={passwordForm.current}
                  onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                />
              </div>
              <div className="h-px bg-gray-100" />
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nova Senha</label>
                <input 
                  type="password"
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 rounded-xl outline-none font-black text-center tracking-[4px]"
                  value={passwordForm.next}
                  onChange={e => setPasswordForm({...passwordForm, next: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Confirmar Nova Senha</label>
                <input 
                  type="password"
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 rounded-xl outline-none font-black text-center tracking-[4px]"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={handlePasswordChange}
                disabled={loading || !passwordForm.current || !passwordForm.next || !passwordForm.confirm}
                className="w-full bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg shadow-indigo-100 disabled:opacity-50 transition-all active:scale-95"
              >
                {loading ? 'Processando...' : 'Confirmar Nova Senha'}
              </button>
              <button 
                onClick={() => { setShowPasswordModal(false); setPasswordForm({ current: '', next: '', confirm: '' }); setPasswordError(null); }}
                className="w-full py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

const AuthScreen = ({ onLogin }: any) => {
  const [mode, setMode] = useState<'login' | 'request' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [recoverySearch, setRecoverySearch] = useState({ email: '', birth_date: '' });
  const [foundRecoveryUser, setFoundRecoveryUser] = useState<any>(null);
  const [newPasswordData, setNewPasswordData] = useState({ password: '', confirm: '' });
  const [formData, setFormData] = useState({ name: '', email: '', congregation: '', phone: '', birth_date: '', role: '', password: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    if (mode === 'login') { 
      if (formData.email === 'Admin' && formData.password === 'IA123*') { 
        onLogin({ id: 'admin', name: 'Administrador', email: 'Admin', status: 'authorized', password: 'IA123*' }); 
        return; 
      } 
      const { data, error: err } = await supabase.from('users').select('*').eq('email', formData.email).eq('password', formData.password).single(); 
      if (err || !data) { setError('Usuário ou senha inválidos.'); return; } 
      if (data.status !== 'authorized') { 
        if (data.status === 'disabled') {
          setError('Entre em contato com o Administrador');
        } else {
          setError(`Acesso ${data.status === 'pending' ? 'em análise' : 'negado'}.`);
        }
        return; 
      } 
      onLogin(data); 
    }
    else if (mode === 'request') { 
      if (formData.password !== confirmPassword) {
        setError('As senhas não conferem');
        return;
      }
      if (!/\/[A-Z]{2}/.test(formData.congregation)) {
        setError('Congregação deve conter UF (Ex: Sede /SP)');
        return;
      }

      // Validação de E-mail Único
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', formData.email)
        .single();

      if (existingUser) {
        setError('Este e-mail já está sendo utilizado por outro usuário.');
        return;
      }

      const { error: err } = await supabase.from('users').insert({ ...formData, status: 'pending', id: generateId() }); 
      if (err) { setError('Erro ao solicitar acesso.'); return; } 
      alert('Pedido enviado!'); setMode('login'); 
    }
  };

  const handleRecoverySearch = async (e: any) => {
    e.preventDefault();
    setError('');
    const { data, error: err } = await supabase
      .from('users')
      .select('*')
      .eq('email', recoverySearch.email)
      .eq('birth_date', recoverySearch.birth_date)
      .single();
    
    if (err || !data) {
      setError('E-mail ou Data de Nascimento não conferem com os dados cadastrados.');
      return;
    }
    setFoundRecoveryUser(data);
  };

  const handleResetPassword = async (e: any) => {
    e.preventDefault();
    setError('');
    if (newPasswordData.password !== newPasswordData.confirm) {
      setError('As senhas não conferem');
      return;
    }
    const { error: err } = await supabase
      .from('users')
      .update({ password: newPasswordData.password })
      .eq('id', foundRecoveryUser.id);
    
    if (err) {
      setError('Erro ao atualizar senha.');
      return;
    }
    alert('Senha alterada com sucesso! Faça login com a nova senha.');
    setMode('login');
    setFoundRecoveryUser(null);
    setRecoverySearch({ email: '', birth_date: '' });
    setNewPasswordData({ password: '', confirm: '' });
  };

  return (
    <div className="min-h-screen bg-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Pano de fundo com símbolos musicais - Limpo e Profissional */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {/* Nota Dupla - Superior Esquerda */}
        <div className="absolute top-[10%] left-[10%] -rotate-12 opacity-10 text-white">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        {/* Nota Única - Superior Direita */}
        <div className="absolute top-[15%] right-[12%] rotate-12 opacity-10 text-white">
          <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
        </div>
        {/* Nota Única - Inferior Esquerda */}
        <div className="absolute bottom-[15%] left-[15%] rotate-[20deg] opacity-10 text-white">
          <svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
        </div>
        {/* Nota Dupla - Inferior Direita */}
        <div className="absolute bottom-[10%] right-[10%] -rotate-[15deg] opacity-10 text-white">
          <svg width="130" height="130" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
      </div>

      <div className={`bg-white rounded-2xl shadow-2xl p-8 w-full ${mode === 'request' ? 'max-w-md' : 'max-w-sm'} transition-all duration-300 relative z-10`}>
        <div className="text-center mb-8">
          <h2 className="text-4xl font-black text-indigo-900 uppercase tracking-tighter">CORUS</h2>
          <p className="text-indigo-400 font-bold uppercase text-[10px] tracking-widest mt-1">Gestor de Corais Apostólicos</p>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold mb-4 border-l-4 border-red-500">{error}</div>}
        
        {mode === 'forgot' ? (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 text-center uppercase tracking-tight">Recuperar Senha</h3>
            {!foundRecoveryUser ? (
              <form onSubmit={handleRecoverySearch} className="space-y-4">
                <p className="text-xs text-gray-700 text-center italic font-medium">Informe seu e-mail e sua data de nascimento cadastrados para confirmar sua identidade.</p>
                <input required type="text" placeholder="Seu E-mail" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={recoverySearch.email} onChange={e => setRecoverySearch({...recoverySearch, email: e.target.value})} />
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-900 uppercase tracking-widest ml-1 block">Sua Data de Nascimento</label>
                  <input required type="date" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={recoverySearch.birth_date} onChange={e => setRecoverySearch({...recoverySearch, birth_date: e.target.value})} />
                </div>
                <button type="submit" className="w-full bg-indigo-700 text-white py-4 rounded-xl font-black uppercase shadow-lg hover:bg-indigo-800 transition-all active:scale-95">Verificar Dados</button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-green-600 text-center font-bold">Identidade confirmada! Defina sua nova senha abaixo.</p>
                <div className="relative">
                  <input required type={showPassword ? "text" : "password"} placeholder="Nova Senha" title="Mínimo 6 caracteres" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={newPasswordData.password} onChange={e => setNewPasswordData({...newPasswordData, password: e.target.value})} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-indigo-600">
                    {showPassword ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                </div>
                <input required type={showPassword ? "text" : "password"} placeholder="Confirmar Nova Senha" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={newPasswordData.confirm} onChange={e => setNewPasswordData({...newPasswordData, confirm: e.target.value})} />
                <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase shadow-lg hover:bg-green-700 transition-all active:scale-95">Salvar Nova Senha</button>
              </form>
            )}
            <button onClick={() => { setMode('login'); setError(''); setFoundRecoveryUser(null); setRecoverySearch({ email: '', birth_date: '' }); }} className="w-full text-gray-400 text-[10px] font-black uppercase mt-4 tracking-widest text-center">Voltar ao Login</button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'request' && <input required placeholder="Nome Completo" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
              <input required type="text" placeholder="E-mail" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              {mode === 'request' && <input required placeholder="Congregação (Ex: Sede /SP)" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.congregation} onChange={e => setFormData({...formData, congregation: e.target.value})} />}
              {mode === 'request' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-900 uppercase tracking-widest ml-1 mb-1 block">Data de Nascimento</label>
                    <input required type="date" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-900 uppercase tracking-widest ml-1 mb-1 block">Telefone (WhatsApp)</label>
                    <input required placeholder="(00) 00000-0000" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
              )}
              {mode === 'request' && <input required placeholder="Cargo no Ministério" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />}
              <div className="relative">
                <input required type={showPassword ? "text" : "password"} placeholder="Senha" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-indigo-600 transition-colors">
                  {showPassword ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              {mode === 'request' && <input required type={showPassword ? "text" : "password"} placeholder="Confirmar Senha" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />}
              
              <button type="submit" className="w-full bg-indigo-700 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-800 transition-all active:scale-95">{mode === 'login' ? 'Entrar' : 'Solicitar Acesso'}</button>
            </form>
            <div className="flex flex-col gap-4 mt-6">
              {mode === 'login' && (
                <button onClick={() => { setMode('forgot'); setError(''); }} className="text-indigo-600 text-xs font-black uppercase tracking-widest hover:underline transition-colors text-center w-full bg-indigo-50 py-2 rounded-lg">Esqueci minha senha</button>
              )}
              <button onClick={() => { setMode(mode === 'login' ? 'request' : 'login'); setError(''); setShowPassword(false); }} className="w-full text-indigo-600 text-xs font-bold uppercase tracking-widest">
                {mode === 'login' ? 'Solicitar Acesso' : 'Voltar ao Login'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserAccount | null>(null);
  const [screen, setScreen] = useState('home');
  const [history, setHistory] = useState<string[]>([]);
  const [editData, setEditData] = useState<any>(null);
  const [notebookData, setNotebookData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [attendanceEditData, setAttendanceEditData] = useState<any>(null);
  const [publicProgram, setPublicProgram] = useState<HymnList | null>(null);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [unreadBulletins, setUnreadBulletins] = useState<(BulletinMessage & { status_id: string })[]>([]);

  const checkUnreadBulletins = async (email: string) => {
    const { data } = await supabase.from('bulletin_user_status')
      .select(`*, bulletin_messages(*)`)
      .eq('user_id', email)
      .eq('status', 'pending')
      .eq('show_again', true);
    
    if (data) {
      const formatted = data.map((s: any) => ({
        ...s.bulletin_messages,
        status_id: s.id
      }));
      setUnreadBulletins(formatted);
    }
  };

  useEffect(() => {
    if (currentUser) {
      checkUnreadBulletins(currentUser.email);
    }
  }, [currentUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const programId = params.get('program');
    if (programId) {
      setLoadingPublic(true);
      supabase.from('hymn_lists').select('*').eq('id', programId).single().then(({ data }) => {
        if (data) setPublicProgram(data);
        setLoadingPublic(false);
      });
    }
  }, []);

  useEffect(() => {
    // Inicialização da história do navegador
    if (!window.history.state) {
      window.history.replaceState({ screen: 'home', history: [] }, '', '');
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.screen) {
        // Restaura o estado da tela e da história interna
        setScreen(e.state.screen);
        setHistory(e.state.history || []);
        
        // Restaura dados de contexto se presentes no estado
        if (e.state.editData !== undefined) setEditData(e.state.editData);
        if (e.state.notebookData !== undefined) setNotebookData(e.state.notebookData);
        if (e.state.reportData !== undefined) setReportData(e.state.reportData);
        if (e.state.attendanceEditData !== undefined) setAttendanceEditData(e.state.attendanceEditData);
      } else {
        // Fallback para home
        setScreen('home');
        setHistory([]);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const isMaster = currentUser?.email === 'Admin' || currentUser?.isMasterAdmin;
  const isAdmin = isMaster || currentUser?.isAdminUser;

  const activeEmail = viewingUser ? viewingUser.email : currentUser?.email;
  const isReadOnly = (isMaster || currentUser?.canReadOnlyMode || currentUser?.canViewOthers) && viewingUser !== null;
  const onExitImpersonation = viewingUser ? () => { setViewingUser(null); setScreen('admin_menu'); } : undefined;

  const navigate = (next: string, data?: any) => { 
    const newHistory = [...history, screen];
    
    // Captura o estado atual dos dados para persistência na história
    const stateData: any = { 
      screen: next, 
      history: newHistory,
      editData: next === 'create_hymn_list' || next === 'admin_bulletin_form' || ['admin_crr_card', 'admin_new_conductor', 'admin_edit_conductor'].includes(next) ? data : editData,
      notebookData: next === 'notebook_detail' || next === 'hymn_notebook_report' ? data : notebookData,
      reportData: ['attendance_report', 'hymn_report', 'musicians_voice_report', 'attendance_percentage_report', 'musicians_instrument_report', 'admin_countries_report', 'admin_states_report', 'admin_congregations_report', 'admin_conductors_report', 'musicians_report', 'instruments_report'].includes(next) ? data : reportData,
      attendanceEditData: next === 'roll_call' ? data : attendanceEditData
    };
    
    window.history.pushState(stateData, '', '');
    
    setHistory(newHistory); 
    setScreen(next); 
    if (next === 'create_hymn_list') setEditData(data); 
    if (next === 'admin_bulletin_form') setEditData(data); 
    if (next === 'notebook_detail' || next === 'hymn_notebook_report') setNotebookData(data); 
    if (['attendance_report', 'hymn_report', 'musicians_voice_report', 'attendance_percentage_report', 'musicians_instrument_report', 'admin_countries_report', 'admin_states_report', 'admin_congregations_report', 'admin_conductors_report', 'musicians_report', 'instruments_report'].includes(next)) setReportData(data); 
    if (next === 'roll_call') setAttendanceEditData(data); 
    if (['admin_crr_card', 'admin_new_conductor', 'admin_edit_conductor'].includes(next)) setEditData(data); 
  };

  const goBack = () => { 
    if (window.history.state && window.history.state.history && window.history.state.history.length > 0) {
      window.history.back();
    } else {
      const prev = history[history.length - 1] || 'home'; 
      setHistory(history.slice(0, -1)); 
      setScreen(prev); 
    }
  };

  const onLogout = () => { 
    setCurrentUser(null); 
    setViewingUser(null); 
    setScreen('home'); 
    setHistory([]); 
    window.history.pushState({ screen: 'home', history: [] }, '', window.location.pathname);
  };

  const handleBackup = async () => {
    if (!currentUser) return;
    setIsExporting(true);
    const isMaster = currentUser.email === 'Admin' || currentUser.isMasterAdmin;
    const emailToFilter = isMaster ? undefined : currentUser.email;
    
    try {
      const backupData: any = {
        exportDate: getBrasiliaISO(),
        type: isMaster ? 'MASTER_FULL_BACKUP' : 'USER_DATA_ONLY',
        user: currentUser,
      };

      const tablesToExport = [
        { name: 'instruments', key: 'gca_instruments' },
        { name: 'musicians', key: 'gca_musicians' },
        { name: 'attendance', key: 'gca_attendance' },
        { name: 'master_hymns', key: 'gca_master_hymns' },
        { name: 'hymn_lists', key: 'hymn_lists' },
      ];

      // Admin specific tables only if master
      if (isMaster) {
        tablesToExport.push(
          { name: 'countries', key: 'gca_countries' },
          { name: 'states', key: 'gca_states' },
          { name: 'congregations_admin', key: 'gca_congregations' },
          { name: 'conductors', key: 'gca_conductors' },
          { name: 'users', key: 'gca_users' }
        );
      }

      for (const table of tablesToExport) {
        backupData[table.name] = await fetchData(table.name, table.key, emailToFilter);
      }

      const fileName = isMaster ? `backup-SISTEMA-COMPLETO-${getBrasiliaYYYYMMDD()}.json` : `backup-perfil-${currentUser.email}-${getBrasiliaYYYYMMDD()}.json`;
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro no backup:', error);
      alert('Erro ao gerar backup de dados.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCSVExport = async () => {
    if (!currentUser) return;
    setIsExportingCSV(true);
    const isMaster = currentUser.email === 'Admin' || currentUser.isMasterAdmin;
    const emailToFilter = isMaster ? undefined : currentUser.email;

    try {
      const tablesToExport = [
        { name: 'instruments', key: 'gca_instruments', label: 'Instrumentos' },
        { name: 'musicians', key: 'gca_musicians', label: 'Musicos' },
        { name: 'attendance', key: 'gca_attendance', label: 'Presenca' },
        { name: 'master_hymns', key: 'gca_master_hymns', label: 'Biblioteca_Hinos' },
      ];

      for (const table of tablesToExport) {
        const data = await fetchData(table.name, table.key, emailToFilter);
        if (data && data.length > 0) {
          // Simple JSON to CSV conversion for flat objects
          const headers = Object.keys(data[0]);
          const csvContent = [
            headers.join(','),
            ...data.map((row: any) => 
              headers.map(fieldName => {
                let val = row[fieldName];
                if (typeof val === 'object') val = JSON.stringify(val);
                // Escape commas and quotes
                const cell = String(val).replace(/"/g, '""');
                return `"${cell}"`;
              }).join(',')
            )
          ].join('\n');

          const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `export-corus-${table.label}-${getBrasiliaYYYYMMDD()}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          // Small delay between downloads to prevent browser blocking
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } catch (error) {
      console.error('Erro no export CSV:', error);
      alert('Erro ao gerar exportação CSV.');
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleImportJSON = async (file: File) => {
    if (!currentUser) return;
    const email = currentUser.email;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const backup = JSON.parse(text);
        
        const tableMap: Record<string, string> = {
          instruments: 'gca_instruments',
          musicians: 'gca_musicians',
          attendance: 'gca_attendance',
          master_hymns: 'gca_master_hymns',
          hymn_lists: 'hymn_lists'
        };

        let importCount = 0;
        for (const [jsonKey, localKey] of Object.entries(tableMap)) {
          const items = backup[jsonKey];
          if (Array.isArray(items) && items.length > 0) {
            await saveData(jsonKey, localKey, items, email);
            importCount += items.length;
          }
        }
        alert(`Sucesso! ${importCount} registros foram importados do arquivo JSON.`);
        window.location.reload();
      } catch (err) {
        console.error('Erro na importação JSON:', err);
        alert('Erro ao processar o arquivo de backup. Verifique se o formato está correto.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportCSV = async (file: File, target: string) => {
    if (!currentUser) return;
    const email = currentUser.email;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) { alert('CSV vazio ou sem dados.'); return; }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1).map(line => {
          // Robust CSV line parser to handle quotes and nested commas
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
              else { inQuotes = !inQuotes; }
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          
          const obj: any = {};
          headers.forEach((h, idx) => {
            let val: any = values[idx]?.replace(/^"|"$/g, '').replace(/""/g, '"');
            // Try to parse arrays or nested objects
            if (val && (val.startsWith('[') || val.startsWith('{'))) {
              try { val = JSON.parse(val); } catch (e) {}
            }
            // Handle Musicians voices/instruments if they were joined strings in old/manual edits
            if (target === 'musicians' && (h === 'voices' || h === 'instruments') && typeof val === 'string') {
              val = val.split(',').map(s => s.trim()).filter(s => s !== '');
            }
            obj[h] = val;
          });
          return obj;
        });

        const localKeyMap: Record<string, string> = {
          musicians: 'gca_musicians',
          instruments: 'gca_instruments',
          master_hymns: 'gca_master_hymns'
        };

        await saveData(target, localKeyMap[target], rows, email);
        alert(`Sucesso! ${rows.length} registros foram importados do CSV para ${target}.`);
        window.location.reload();
      } catch (err) {
        console.error('Erro na importação CSV:', err);
        alert('Erro ao processar o arquivo CSV. Verifique o cabeçalho e separadores.');
      }
    };
    reader.readAsText(file);
  };

  if (loadingPublic) return <div className="min-h-screen bg-indigo-900 flex items-center justify-center text-white font-bold animate-pulse uppercase tracking-widest">Carregando Programa...</div>;
  if (publicProgram) return <PrintView list={publicProgram} onBack={() => { setPublicProgram(null); window.history.replaceState({}, '', window.location.pathname); }} />;

  if (!currentUser) return <AuthScreen onLogin={setCurrentUser} />;

  return (
    <NavigationContext.Provider value={{ onLogout, onProfileClick: () => setScreen('profile') }}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1">
          {(() => {
            switch (screen) {
              case 'profile': return <ProfileScreen user={currentUser} goBack={goBack} onUpdate={setCurrentUser} onExitImpersonation={onExitImpersonation} />;
              case 'admin_menu': return <AdminMenuScreen navigate={navigate} goBack={goBack} currentUser={currentUser} />;
              case 'admin_users': return <AdminUsersScreen goBack={goBack} onImpersonate={(u: any) => { setViewingUser(u); setScreen('home'); }} currentUser={currentUser} onAwaitingConductorRegistration={(u: any) => { setEditData(u); setScreen('admin_new_conductor'); }} />;
              case 'admin_countries': return <AdminCountriesScreen goBack={goBack} navigate={navigate} />;
              case 'admin_states': return <AdminStatesScreen goBack={goBack} navigate={navigate} />;
              case 'admin_congregations': return <AdminCongregationsScreen goBack={goBack} navigate={navigate} />;
              case 'admin_countries_report': return <AdminMasterReportView id="relatorio-paises" title="Relatório de Países Atendidos" columns={[{key:'id', label:'Cód.'}, {key:'name', label:'Nome do País'}]} data={reportData} goBack={goBack} />;
              case 'admin_states_report': return <AdminMasterReportView id="relatorio-estados" title="Relatório de Estados" columns={[{key:'id', label:'Cód.'}, {key:'name', label:'Nome do Estado'}, {key:'uf', label:'UF'}]} data={reportData} goBack={goBack} />;
              case 'admin_congregations_report': return <AdminMasterReportView id="relatorio-congre" title="Relatório Geral de Congregações" columns={[{key:'id', label:'Cód.'}, {key:'name', label:'Congregação'}, {key:'state', label:'Estado'}, {key:'uf', label:'UF'}, {key:'country', label:'País'}, {key:'address', label:'Endereço'}, {key:'address_number', label:'Nº'}, {key:'neighborhood', label:'Bairro'}, {key:'cep', label:'CEP'}]} data={reportData} goBack={goBack} />;
              case 'admin_conductors_report': return <AdminMasterReportView id="relatorio-regentes" title="Relatório de Regentes (CRR)" columns={[{key:'registry_number', label:'Registro'}, {key:'name', label:'Nome'}, {key:'congregation_name', label:'Congregação'}, {key:'phone', label:'Telefone'}]} data={reportData} goBack={goBack} />;
              case 'admin_conductor_certificates': return <AdminConductorCertificatesScreen navigate={navigate} goBack={goBack} currentUser={currentUser} />;
              case 'admin_new_conductor': return <AdminConductorForm goBack={goBack} linkUserBeingApproved={editData} />;
              case 'admin_edit_conductor': return <AdminConductorForm goBack={goBack} conductorToEdit={editData} />;
              case 'admin_crr_card': return <CRRCardView conductor={editData} goBack={goBack} navigate={navigate} />;
              case 'admin_registrations_summary': return <AdminRegistrationsSummaryScreen navigate={navigate} goBack={goBack} currentUser={currentUser} />;
              case 'home': return <HomeScreen navigate={navigate} onLogout={onLogout} isReadOnly={isReadOnly} isAdmin={isAdmin} onProfileClick={() => setScreen('profile')} onExitImpersonation={onExitImpersonation} onBackup={handleBackup} isExporting={isExporting} onBackupCSV={handleCSVExport} isExportingCSV={isExportingCSV} />;
              case 'components': return <ComponentsScreen navigate={navigate} goBack={goBack} onExitImpersonation={onExitImpersonation} />;
              case 'instruments': return <InstrumentsScreen navigate={navigate} goBack={goBack} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'musicians': return <MusiciansScreen navigate={navigate} goBack={goBack} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'musician_report_selection': return <MusicianReportSelectionScreen navigate={navigate} goBack={goBack} onExitImpersonation={onExitImpersonation} />;
              case 'admin_messages': return <AdminMessagesScreen goBack={goBack} currentUser={currentUser} />;
              case 'admin_bulletins': return <AdminBulletinsScreen goBack={goBack} navigate={navigate} currentUser={currentUser} />;
              case 'admin_bulletin_form': return <AdminBulletinForm goBack={goBack} navigate={navigate} initialData={editData} currentUser={currentUser} />;
              case 'bulletin_history': return <BulletinHistoryScreen goBack={goBack} currentUser={currentUser} />;
              case 'musicians_report': return <MusiciansReportScreen goBack={goBack} ownerEmail={activeEmail} />;
              case 'instruments_report': return <InstrumentsReportScreen goBack={goBack} ownerEmail={activeEmail} />;
              case 'musicians_voice_report': return <MusiciansVoiceReportScreen goBack={goBack} ownerEmail={activeEmail} />;
              case 'musicians_instrument_report': return <MusiciansInstrumentReportScreen goBack={goBack} ownerEmail={activeEmail} />;
              case 'attendance': return <AttendanceMenuScreen navigate={navigate} goBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'roll_call': return <RollCallScreen goBack={goBack} editData={attendanceEditData} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'attendance_history': return <AttendanceHistoryScreen goBack={goBack} onEdit={(r: any) => navigate('roll_call', r)} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'attendance_report_input': return <AttendanceReportInputScreen onGenerate={(s: any, e: any, t: any, g: any) => navigate('attendance_report', {s, e, t, g})} onCancel={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'attendance_report': return <AttendanceReportScreen goBack={goBack} ownerEmail={activeEmail} reportData={reportData} />;
              case 'attendance_percentage_input': return <AttendancePercentageInputScreen onGenerate={(s: any, e: any, g: any) => navigate('attendance_percentage_report', {s, e, g})} onCancel={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'attendance_percentage_report': return <AttendancePercentageReportScreen goBack={goBack} ownerEmail={activeEmail} reportData={reportData} />;
              case 'hymn_report': return <HymnReportScreen goBack={goBack} ownerEmail={activeEmail} reportData={reportData} />;
              case 'hymns_library': return <HymnsLibraryScreen navigate={navigate} goBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'notebook_detail': return <NotebookDetailScreen notebook={notebookData} goBack={goBack} navigate={navigate} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'hymn_notebook_report': return <HymnNotebookReportScreen notebook={notebookData} goBack={goBack} ownerEmail={activeEmail} />;
              case 'programs': return <ProgramsScreen navigate={navigate} goBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'guidelines': return <GuidelinesScreen goBack={goBack} onExitImpersonation={onExitImpersonation} />;
              case 'hymn_lists': return <HymnListScreen goBack={goBack} onCreate={() => navigate('create_hymn_list')} onEdit={l => navigate('create_hymn_list', l)} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'create_hymn_list': return <CreateHymnListScreen onSave={goBack} onCancel={goBack} initialData={editData} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'hymn_report_input': return <HymnReportInputScreen onGenerate={(s: any, e: any, t: any) => navigate('hymn_report', {s, e, t})} onCancel={goBack} onExitImpersonation={onExitImpersonation} />;
              case 'data_management': return <DataManagementScreen goBack={goBack} onBackupJSON={handleBackup} isExportingJSON={isExporting} onBackupCSV={handleCSVExport} isExportingCSV={isExportingCSV} onImportJSON={handleImportJSON} onImportCSV={handleImportCSV} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} canExportBackups={isMaster} />;
              default: return <HomeScreen navigate={navigate} onLogout={onLogout} isReadOnly={isReadOnly} isAdmin={isAdmin} onProfileClick={() => setScreen('profile')} onExitImpersonation={onExitImpersonation} />;
            }
          })()}
        </div>
        <FloatingChat currentUser={currentUser} isAdmin={isMaster || currentUser?.canChat} />
        <BulletinDisplayModal 
          unreadBulletins={unreadBulletins} 
          onStatusUpdate={() => checkUnreadBulletins(currentUser.email)} 
          onDismiss={() => setUnreadBulletins([])}
        />
      </div>
    </NavigationContext.Provider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);