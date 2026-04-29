import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
// @ts-ignore
import html2pdf from 'html2pdf.js';
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

type CalendarEvent = {
  id: string;
  user_email: string;
  title: string;
  description: string;
  event_type: 'Ensaio' | 'Reunião' | 'Reunião de Oração' | 'Reunião Festiva' | 'Aprimoramento';
  start_time: string;
  end_time?: string;
  created_at?: string;
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
  group?: 'Coral' | 'Orquestra' | 'Geral' | 'Outro';
  subset_ids?: string[];
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

export const FESTIVIDADES = [
  "(em branco)",
  "Primeira Reunião do Ano",
  "Coroação do Irmão Aldo",
  "Dia das Mães",
  "Aniversário da Santa Vó",
  "Corphus Christ",
  "Dia dos País",
  "Assunção a Maria Santíssima",
  "Aniversário do Irmão Aldo",
  "Dia do Consolador",
  "Natal",
  "Ano Novo"
];

type HymnList = {
  id: string;
  date: string;
  congregation: string;
  type: HymnListType;
  startTime?: string; 
  isDetailed?: boolean;
  owner_email?: string;
  festivity?: string;
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
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
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

type HymnRelation = {
  id: string;
  title: string;
  type: 'fixed' | 'custom';
  hymns: { notebook: string; number: string; title: string }[];
  owner_email: string;
};

const MEETING_TYPES: Record<string, string> = {
  Normal130: 'Reunião Normal (Até 1h30min)',
  Normal200: 'Reunião Normal (Até 2h)',
  Oracao: 'Reunião de Oração',
  Especial200: 'Reunião Especial (Até 2h)',
  Festiva200: 'Reunião Festiva (Até 2h)',
  SantaComunhao: 'Reunião de Santa Comunhão',
  NatalAnoNovo: 'Natal / Ano Novo',
  Comunhao200: 'Comunhão até 200 Instrumentos',
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
  "OJ": "Orquestra Jovem", "SC": "Solos Coral", "SE": "Solos Esp. + Coral", "SEC": "Solos Esp. + Coral"
};

const downloadPDF = (
  elementId: string, 
  filename: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const originalTitle = document.title;
  document.title = filename.replace('.pdf', '');

  const isReport = element.classList.contains('page-container');

  if (isReport) {
    window.scrollTo(0, 0);

    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 400);

  } else {
    const originalBodyStyles = document.body.className;

    document.body.classList.add('print-isolation');

    const others = Array.from(document.body.children)
      .filter(el => el.id !== elementId && !el.classList.contains('no-print'));

    others.forEach(el => el.classList.add('print-hidden-temp'));

    setTimeout(() => {
      window.print();

      // revertendo depois do print
      others.forEach(el => el.classList.remove('print-hidden-temp'));
      document.body.className = originalBodyStyles;
      document.title = originalTitle;

    }, 300);
  }
};

const downloadDirectPDF = (
  elementId: string,
  filename: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const isPortrait = orientation === 'portrait';
  const widthPixels = isPortrait ? 794 : 1123; 

  element.classList.add('pdf-capture', isPortrait ? 'portrait' : 'landscape');

  const opt = {
    margin: 0,
    filename: filename,
    image: { type: 'jpeg' as 'jpeg', quality: 1.0 },
    html2canvas: { 
      scale: 2.5, // High quality
      useCORS: true, 
      letterRendering: false,
      scrollY: 0,
      scrollX: 0,
      windowWidth: widthPixels,
      width: widthPixels,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (doc: any) => {
        const el = doc.getElementById(elementId);
        if (el) {
          el.style.width = widthPixels + 'px';
          el.style.margin = '0';
          el.style.padding = '0';
          // Ensure pages are full size for A4 output
          const pages = el.querySelectorAll('.page');
          pages.forEach((p: any) => {
            p.style.height = isPortrait ? '297mm' : '210mm';
            p.style.boxShadow = 'none';
          });
        }
      }
    },
    jsPDF: { 
      unit: 'mm' as 'mm', 
      format: 'a4', 
      orientation: orientation,
      compress: true,
      precision: 2
    },
    pagebreak: { mode: 'css' }
  };

  // @ts-ignore
  html2pdf().set(opt).from(element).save().then(() => {
    element.classList.remove('pdf-capture', 'portrait', 'landscape');
  });
};

const downloadHTML = (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
    .map(el => el.outerHTML)
    .join("\n");

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>

  ${styles}

  <style>
    body {
      background: #f3f4f6;
      margin: 0;
    }

    @media print {
      body {
        background: white !important;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">
    ${element.innerHTML}
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  a.click();

  URL.revokeObjectURL(url);
};

const parseTimeToSeconds = (timeStr: string = ''): number => {
  if (!timeStr || typeof timeStr !== 'string') return 0;

  const parts = timeStr.trim().split(':').map(p => Number(p));

  // Se tiver NaN em algum ponto, invalida
  if (parts.some(isNaN)) return 0;

  let seconds = 0;

  if (parts.length === 1) {
    // mm
    seconds = parts[0] * 60;

  } else if (parts.length === 2) {
    const [min, sec] = parts;

    if (sec >= 60) return 0; // validação
    seconds = min * 60 + sec;

  } else if (parts.length === 3) {
    const [hour, min, sec] = parts;

    if (min >= 60 || sec >= 60) return 0;
    seconds = hour * 3600 + min * 60 + sec;
  }

  return seconds;
};

const formatSecondsToClockTime = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00:00";

  const total = Math.floor(totalSeconds);

  const hours = Math.floor(total / 3600); // ← REMOVIDO % 24
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};


const formatSecondsToDurationString = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00h 00min 00seg";

  const total = Math.floor(totalSeconds);

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min ${String(seconds).padStart(2, '0')}seg`;
};

// --- Componentes de Interface ---

const Layout = ({ children, title, onBack, onLogout: propLogout, isReadOnly, onProfileClick: propProfile, onExitImpersonation, widthClass = "max-w-5xl" }: { children?: React.ReactNode, title: string, onBack?: () => void, onLogout?: () => void, isReadOnly?: boolean, onProfileClick?: () => void, onExitImpersonation?: () => void, widthClass?: string }) => {
  const nav = React.useContext(NavigationContext);
  const onLogout = propLogout || nav?.onLogout;
  const onProfileClick = propProfile || nav?.onProfileClick;

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Fundo global */}
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('https://i.postimg.cc/nLGHJXhX/Gemini-Generated-Image-e9746we9746we974.png')"
        }}
      />

      {/* Overlay por cima da imagem (sem desfoque para máxima nitidez) */}
      <div className="fixed inset-0 bg-white/65" />

      <div className="relative z-[10] flex flex-col min-h-screen">
        <div className="sticky top-0 z-[100] no-print">
          {onExitImpersonation && (
            <div className="bg-amber-600 text-white p-2 text-center shadow-inner animate-fade-in border-b border-amber-500/20">
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
          <header className="bg-blue-700 text-white p-4 shadow-md sticky top-0 z-[1000]">
            <div className={`mx-auto flex items-center justify-between ${widthClass}`}>
              <div className="flex items-center gap-3">
                {onBack && (
                  <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="p-2 hover:bg-blue-600 rounded-lg cursor-pointer transition-colors active:scale-90" title="Voltar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                )}
                <h1 className="text-xl font-bold">{title}</h1>
              </div>
              <div className="flex items-center gap-4">
                {isReadOnly && <span className="bg-yellow-400 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded uppercase">Somente Leitura</span>}
                <div className="text-sm opacity-80 hidden sm:block">CORUS - Gestor de Corais Apostólicos</div>
                <div className="flex items-center gap-2">
                  {onProfileClick && (
                    <button onClick={onProfileClick} className="p-1 hover:bg-blue-600 rounded cursor-pointer" title="Meu Perfil">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </button>
                  )}
                  {onLogout && (
                    <button onClick={onLogout} className="p-1 hover:bg-red-600 rounded cursor-pointer" title="Sair">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>
        </div>
        <main className={`flex-1 mx-auto w-full p-4 ${widthClass}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

const MenuCard = ({ title, desc, icon, onClick }: any) => (
  <button onClick={onClick} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col items-center text-center gap-4 w-full h-full">
    <div className="text-blue-600 bg-blue-50 p-4 rounded-full">{icon}</div>
    <div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-gray-500 text-sm mt-1">{desc}</p>
    </div>
  </button>
);

const PagedReport = ({ 
  id, 
  header, 
  items, 
  renderItem, 
  tableHeader,
  goBack,
  title,
  filename,
  orientation = 'portrait',
  lastPageFooter
}: { 
  id: string, 
  header: React.ReactNode, 
  items: any[], 
  renderItem: (item: any, index: number) => React.ReactNode,
  tableHeader?: React.ReactNode,
  goBack: () => void,
  title: string,
  filename: string,
  orientation?: 'portrait' | 'landscape',
  lastPageFooter?: React.ReactNode
}) => {
  const [pages, setPages] = useState<any[][]>([]);
  const measurementRef = useRef<HTMLDivElement>(null);
  const isLandscape = orientation === 'landscape';

  useEffect(() => {
    const measureAndSplit = () => {
      if (!measurementRef.current) return;
      
      const PAGE_HEIGHT_MM = isLandscape ? 210 : 297;
      const PADDING_MM = 30; // Margem total (15mm top + 15mm bottom)
      
      const MM_TO_PX = 3.77952755906; // 96 DPI / 25.4mm
      const MAX_HEIGHT_PX = (PAGE_HEIGHT_MM - PADDING_MM - 6) * MM_TO_PX; // Buffer reduzido para 6mm para aproveitar melhor a página

      const container = measurementRef.current;
      if (!container) return;

      const renderedItems = Array.from(
        container.querySelectorAll('.measurement-item')
      ) as HTMLElement[];

      const hEl = container.querySelector('.report-header') as HTMLElement;
      const thEl = container.querySelector('.table-header') as HTMLElement;
      const fEl = container.querySelector('.report-footer-measure') as HTMLElement;

      const hHeight = hEl?.offsetHeight || 0;
      const thHeight = thEl?.offsetHeight || 0;
      const lfHeight = fEl?.offsetHeight || 0;

      const newPages: any[][] = [];

      let currentPage: any[] = [];
      let currentHeight = 0;
      let isFirstPage = true;

      items.forEach((item, idx) => {
        const itemHeight = (renderedItems[idx]?.offsetHeight || 0) + 1;

        const overhead = currentPage.length === 0 ? thHeight : 0;
        const availableHeight = isFirstPage
          ? MAX_HEIGHT_PX - hHeight
          : MAX_HEIGHT_PX;

        const footerSpaceNeeded =
          idx === items.length - 1 && lastPageFooter ? lfHeight : 0;

        if (
          currentHeight + itemHeight + overhead + footerSpaceNeeded >
            availableHeight &&
          currentPage.length > 0
        ) {
          newPages.push(currentPage);
          currentPage = [item];
          currentHeight = itemHeight;
          isFirstPage = false;
        } else {
          currentPage.push(item);
          currentHeight += itemHeight + overhead;
        }
      });

      if (currentPage.length > 0) newPages.push(currentPage);
      setPages(newPages);
    };

    const timer = setTimeout(measureAndSplit, 300);
    return () => clearTimeout(timer);
  }, [items, header, tableHeader, orientation, lastPageFooter, isLandscape]);

  const handlePrint = () => {
    window.scrollTo(0, 0);
    window.print();
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="max-w-[800px] mx-auto py-4 px-4 flex justify-between items-center no-print sticky top-0 z-[100] bg-gray-100/90 backdrop-blur-md border-b border-gray-200">
        <button onClick={goBack} className="bg-gray-700 text-white px-5 py-2 rounded-xl font-bold uppercase text-xs shadow-md hover:bg-gray-800 transition-all flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Sair
        </button>
        <div className="flex gap-2">
          <button 
            onClick={() => downloadHTML(id, filename.replace('.pdf', '.html'))} 
            className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl font-bold uppercase text-[10px] shadow-sm hover:bg-gray-200 transition-all active:scale-95 flex items-center gap-2 border border-gray-200"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
             Offline
          </button>
          <button 
            onClick={() => downloadDirectPDF(id, filename, orientation as any)} 
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
             Baixar PDF
          </button>
          <button 
            onClick={handlePrint} 
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
             Imprimir
          </button>
        </div>
      </div>

      {/* Hidden measurement container for height calculations */}
      <div 
        ref={measurementRef} 
        className={`measure-container ${isLandscape ? 'landscape' : 'portrait'}`}
        style={{
          position: 'fixed',
          top: '-10000px',
          left: '-10000px',
          visibility: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -9999
        }}
      >
        <div className="report-header">{header}</div>
        {tableHeader && <div className="table-header">{tableHeader}</div>}
        {items.map((item, idx) => (
          <div key={idx} className="measurement-item avoid-break">
            {renderItem(item, idx)}
          </div>
        ))}
        {lastPageFooter && <div className="report-footer-measure">{lastPageFooter}</div>}
      </div>

      {/* Visual Preview */}
      <div id={id} className="page-container">
        {pages.length > 0 ? (
          pages.map((pageItems, pageIdx) => (
            <div key={pageIdx} className={`page ${isLandscape ? 'landscape' : 'portrait'}`}>
              <div className="page-content">
                {pageIdx === 0 && <div className="report-header">{header}</div>}
                {tableHeader && <div className="table-header">{tableHeader}</div>}
                {pageItems.map((item, itemIdx) => (
                  <div key={itemIdx} className="avoid-break w-full">
                    {renderItem(item, itemIdx)}
                  </div>
                ))}
                {pageIdx === pages.length - 1 && lastPageFooter && (
                  <div className="mt-auto pt-8">
                    {lastPageFooter}
                  </div>
                )}
              </div>
              <div className="mt-auto pt-4 text-right text-[9px] text-gray-400 font-mono italic">
                {title} - Página {pageIdx + 1} de {pages.length}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-40 text-gray-400 gap-6">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            <p className="font-bold uppercase tracking-widest text-xs">Preparando documento para impressão...</p>
          </div>
        )}
      </div>
    </div>
  );
};


const ConfirmationModal = ({ title, message, onConfirm, onCancel, confirmText = "Confirmar", confirmColor = "bg-blue-600" }: any) => {
  useEscapeKey(onCancel, [onCancel]);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[400] backdrop-blur-sm animate-fade-in">
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
      <MenuCard title="Calendário" desc="Ensaios e Reuniões" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} onClick={() => navigate('calendar')} />
      <MenuCard title="Meus Avisos" desc="Histórico de Avisos" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>} onClick={() => navigate('bulletin_history')} />
      <MenuCard title="Dados e Backup" desc="Exportar/Importar CSV e JSON" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>} onClick={() => navigate('data_management')} />
    </div>
  </Layout>
);

const getBrazilianHolidays = (year: number) => {
  const holidays: Record<string, string> = {
    [`${year}-01-01`]: "Confraternização Universal",
    [`${year}-04-21`]: "Tiradentes",
    [`${year}-05-01`]: "Dia do Trabalho",
    [`${year}-09-07`]: "Independência do Brasil",
    [`${year}-10-12`]: "Nossa Senhora Aparecida",
    [`${year}-11-02`]: "Finados",
    [`${year}-11-15`]: "Proclamação da República",
    [`${year}-11-20`]: "Dia de Zumbi e da Consciência Negra",
    [`${year}-12-25`]: "Natal",
  };

  // Calculate Easter (Gauss algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  const easter = new Date(year, month - 1, day);
  
  const addDate = (base: Date, days: number, name: string) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + days);
    const str = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    holidays[str] = name;
  };

  addDate(easter, -47, "Carnaval");
  addDate(easter, -2, "Sexta-feira Santa");
  addDate(easter, 0, "Páscoa");
  addDate(easter, 60, "Corpus Christi");

  return holidays;
};

const CalendarPreviewModal = ({ events, startDate, endDate, exportType, onClose, onDownload }: { events: CalendarEvent[], startDate: string, endDate: string, exportType: string, onClose: () => void, onDownload: () => void }) => {
  const monthNamesPT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  
  // Group events by Month/Year
  const groupedEvents: Record<string, CalendarEvent[]> = {};
  events.sort((a,b) => a.start_time.localeCompare(b.start_time)).forEach(event => {
    const d = new Date(event.start_time);
    const key = `${monthNamesPT[d.getMonth()]} de ${d.getFullYear()}`;
    if (!groupedEvents[key]) groupedEvents[key] = [];
    groupedEvents[key].push(event);
  });

  const items: any[] = [];
  Object.entries(groupedEvents).forEach(([monthYear, monthEvents]) => {
    items.push({ type: 'month_header', label: monthYear });
    monthEvents.forEach(event => {
      items.push({ type: 'event', event });
    });
  });

  const [pages, setPages] = useState<any[][]>([]);
  const measurementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measureAndSplit = () => {
      if (!measurementRef.current) return;
      
      const PAGE_HEIGHT_MM = 297;
      const PADDING_MM = 40; 
      const HEADER_HEIGHT_PX = measurementRef.current.querySelector('.report-header')?.clientHeight || 0;
      
      const mmToPx = (mm: number) => (mm * 96) / 25.4;
      const pxToMm = (px: number) => (px * 25.4) / 96;
      
      const SAFETY_MARGIN_MM = 6;
      const maxContentHeightMm = PAGE_HEIGHT_MM - PADDING_MM - SAFETY_MARGIN_MM;
      const firstPageMaxContentHeightMm = maxContentHeightMm - pxToMm(HEADER_HEIGHT_PX);

      const itemsToProcess = Array.from(measurementRef.current.querySelectorAll('.measurement-item')) as HTMLElement[];
      const newPages: any[][] = [];
      let currentPage: any[] = [];
      let currentHeightMm = 0;
      let isFirstPage = true;

      items.forEach((_, idx) => {
        const el = itemsToProcess[idx];
        if (!el) return;
        const itemHeightMm = pxToMm(el.getBoundingClientRect().height);
        const limit = isFirstPage ? firstPageMaxContentHeightMm : maxContentHeightMm;
        
        if (currentHeightMm + itemHeightMm > limit && currentPage.length > 0) {
          newPages.push(currentPage);
          currentPage = [items[idx]];
          currentHeightMm = itemHeightMm;
          isFirstPage = false;
        } else {
          currentPage.push(items[idx]);
          currentHeightMm += itemHeightMm;
        }
      });

      if (currentPage.length > 0) {
        newPages.push(currentPage);
      }

      setPages(newPages);
    };

    setTimeout(measureAndSplit, 100);
  }, [items]);

  const handleDownload = () => {
    downloadDirectPDF('calendar-export-container', `Calendario-${startDate}-a-${endDate}.pdf`, 'portrait');
  };

  const handlePrint = () => {
    downloadPDF('calendar-export-container', `Calendario-${startDate}-a-${endDate}.pdf`, 'portrait');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-gray-100 rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden relative animate-zoom-in">
        <div className="p-6 border-b flex justify-between items-center bg-white shrink-0 no-print">
          <div>
            <h3 className="text-xl font-black text-black uppercase tracking-widest leading-none">Pré-visualização do Calendário</h3>
            <p className="text-xs text-gray-400 uppercase mt-2 font-bold italic">A4 Paginado • Impressão Realista</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => downloadHTML('calendar-export-container', `Calendario-${startDate}-a-${endDate}.html`)} className="bg-gray-100 text-gray-700 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center gap-2 border border-gray-200 active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Offline
            </button>
            <button onClick={handleDownload} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-xl shadow-emerald-200 active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Baixar Direto
            </button>
            <button onClick={handlePrint} className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-200 active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir
            </button>
            <button onClick={onClose} className="bg-white border-2 border-gray-100 p-3 rounded-2xl text-black hover:text-red-500 transition-all active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-10 flex flex-col items-center custom-scrollbar-heavy">
          {/* Measurement Container (Hidden) */}
          <div 
            ref={measurementRef} 
            style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '170mm', visibility: 'hidden' }}
          >
            <div className="report-header pb-10">
              <div className="text-center">
                <h1 className="text-3xl font-black text-black uppercase tracking-tighter">Calendário de Eventos</h1>
                <div className="flex flex-col gap-1 mt-3 text-[11px] text-black font-bold uppercase tracking-widest border-t border-black/10 pt-4">
                  <p>Período: {new Date(`${startDate}T00:00:00`).toLocaleDateString()} a {new Date(`${endDate}T00:00:00`).toLocaleDateString()}</p>
                  <p>Filtro: {exportType}</p>
                </div>
              </div>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="measurement-item">
                {item.type === 'month_header' ? (
                  <h2 className="text-lg font-black text-black uppercase tracking-widest border-b-4 border-black/10 pb-1 mt-10 mb-6">{item.label}</h2>
                ) : (
                  <div className="flex items-baseline gap-6 border-b border-gray-100 pb-3 mb-3">
                    <CalendarEventRow event={item.event} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Rendered Pages */}
          <div id="calendar-export-container" className="page-container w-full">
            {pages.length > 0 ? (
              pages.map((pageItems, pageIdx) => (
                <div key={pageIdx} className={`page relative ${pageIdx === 0 ? 'page-first' : ''}`}>
                  {pageIdx === 0 && (
                    <div className="report-header mb-10 text-center">
                      <h1 className="text-3xl font-black text-black uppercase tracking-tighter">Calendário de Eventos</h1>
                      <div className="flex flex-col gap-1 mt-3 text-[11px] text-black font-bold uppercase tracking-widest border-t border-black/10 pt-4">
                        <p>Período: {new Date(`${startDate}T00:00:00`).toLocaleDateString()} a {new Date(`${endDate}T00:00:00`).toLocaleDateString()}</p>
                        <p>Filtro: {exportType}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="page-content">
                    {pageItems.map((item, itemIdx) => (
                      <div key={itemIdx} className="avoid-break w-full">
                        {item.type === 'month_header' ? (
                          <h2 className={`text-lg font-black text-black uppercase tracking-widest border-b-4 border-black/10 pb-1 mb-6 ${itemIdx > 0 || pageIdx > 0 ? 'mt-8' : ''}`}>{item.label}</h2>
                        ) : (
                          <div className="flex items-baseline gap-6 border-b border-gray-100 pb-3 mb-3">
                            <CalendarEventRow event={item.event} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-6 right-10 text-[10px] font-black text-gray-300 uppercase tracking-widest no-print">
                    Página {pageIdx + 1} de {pages.length}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600/20 border-t-blue-600"></div>
                <p className="font-black uppercase text-xs tracking-widest animate-pulse">Gerando Visualização...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CalendarEventRow = ({ event }: { event: CalendarEvent }) => {
  const dateObj = new Date(event.start_time);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const weekday = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dateObj.getDay()];
  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  const holidayName = getBrazilianHolidays(dateObj.getFullYear())[dateStr];
  const dayOfWeekIdx = dateObj.getDay();
  const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;

  return (
    <>
      <div className="w-40 shrink-0">
        <p className={`text-[13px] font-black ${
          holidayName ? 'text-red-600' : isWeekend ? 'text-blue-600' : 'text-black'
        }`}>
          {day}/{month} ({weekday}){holidayName ? ` - ${holidayName}` : ''}
        </p>
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-bold text-black">{timeStr} - {event.title}</p>
      </div>
      <div className="shrink-0">
        <p className="text-[10px] font-black text-white uppercase tracking-tighter bg-black px-3 py-1 rounded-full">{event.event_type}</p>
      </div>
    </>
  );
};

const CalendarScreen = ({ goBack, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDayData, setSelectedDayData] = useState<{ date: string, events: CalendarEvent[], holiday: string | null } | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CalendarEvent['event_type']>('Ensaio');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // PDF Export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportType, setExportType] = useState('Todos');
  const [filteredEventsForPreview, setFilteredEventsForPreview] = useState<CalendarEvent[] | null>(null);

  // New Pickers states
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    fetchEvents();
  }, [ownerEmail]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('gca_calendar_events')
        .select('*')
        .eq('user_email', ownerEmail)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Erro ao buscar eventos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async () => {
    if (!title || !date || !time) return alert('Título, data e horário são obrigatórios.');

    const startTimeFormatted = `${date}T${time}:00`;

    try {
      if (selectedEvent) {
        const { error } = await supabase
          .from('gca_calendar_events')
          .update({
            title,
            description,
            event_type: type,
            start_time: startTimeFormatted
          })
          .eq('id', selectedEvent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('gca_calendar_events')
          .insert({
            user_email: ownerEmail,
            title,
            description,
            event_type: type,
            start_time: startTimeFormatted
          });
        if (error) throw error;
      }
      setShowEventModal(false);
      resetForm();
      fetchEvents();
    } catch (err) {
      console.error('Erro ao salvar evento:', err);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Deseja excluir este evento?')) return;
    try {
      const { error } = await supabase.from('gca_calendar_events').delete().eq('id', id);
      if (error) throw error;
      fetchEvents();
      setShowEventModal(false);
    } catch (err) {
      console.error('Erro ao excluir evento:', err);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('Ensaio');
    setDate('');
    setTime('');
    setSelectedEvent(null);
  };

  const generatePDF = (preview: boolean = true) => {
    if (!exportStartDate || !exportEndDate) return alert('Selecione a data de Início e Fim para gerar o PDF.');

    console.log('Filtro solicitado:', { exportStartDate, exportEndDate, exportType });
    console.log('Total de eventos no sistema:', events.length);

    // Normalizing filter dates to local dates
    const start = new Date(`${exportStartDate}T00:00:00`);
    const end = new Date(`${exportEndDate}T23:59:59`);

    const filtered = events.filter(e => {
      const eDate = new Date(e.start_time);
      const matchesPeriod = eDate >= start && eDate <= end;
      const matchesType = exportType === 'Todos' || e.event_type === exportType;
      return matchesPeriod && matchesType;
    });

    console.log('Eventos após filtragem:', filtered.length);

    if (filtered.length === 0) {
      if (events.length === 0) {
        return alert('Você ainda não possui nenhum evento agendado.');
      }
      return alert(`Nenhum evento encontrado no período de ${new Date(`${exportStartDate}T00:00:00`).toLocaleDateString()} a ${new Date(`${exportEndDate}T00:00:00`).toLocaleDateString()} para o filtro selecionado.`);
    }

    // Sort by date
    const sorted = [...filtered].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    console.log('Generating PDF for filtered events:', sorted);

    if (preview) {
      setFilteredEventsForPreview(sorted);
      setShowExportModal(false); 
    } else {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(26);
      doc.setTextColor(0, 0, 0); 
      doc.setFont('helvetica', 'bold');
      doc.text('CALENDÁRIO DE EVENTOS', pageWidth / 2, 25, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0); 
      doc.setFont('helvetica', 'bold');
      doc.text(`Período: ${new Date(`${exportStartDate}T00:00:00`).toLocaleDateString()} a ${new Date(`${exportEndDate}T00:00:00`).toLocaleDateString()}`, pageWidth / 2, 35, { align: 'center' });
      doc.text(`Filtro: ${exportType}`, pageWidth / 2, 42, { align: 'center' });

      let currentY = 55;
      let currentMonthYear = '';
      const monthNamesPT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

      sorted.forEach((event, index) => {
        const dateObj = new Date(event.start_time);
        const monthYear = `${monthNamesPT[dateObj.getMonth()]} de ${dateObj.getFullYear()}`;

        if (currentY > 260) {
          doc.addPage();
          currentY = 25;
        }

        if (monthYear !== currentMonthYear) {
          if (index > 0) currentY += 15;
          doc.setFontSize(18);
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'bold');
          doc.text(monthYear.toUpperCase(), 14, currentY);
          currentY += 10;
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.5);
          doc.line(14, currentY - 8, pageWidth - 14, currentY - 8);
          currentMonthYear = monthYear;
        }

        const day = String(dateObj.getDate()).padStart(2, '0');
        const dayOfWeekIdx = dateObj.getDay();
        const weekday = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dayOfWeekIdx];
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Calculate holiday for this date
        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        const holidayName = getBrazilianHolidays(dateObj.getFullYear())[dateStr];
        const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        
        if (holidayName) {
          doc.setTextColor(220, 38, 38); // Red-600
        } else if (isWeekend) {
          doc.setTextColor(37, 99, 235); // Blue-600
        } else {
          doc.setTextColor(0, 0, 0); // Black
        }

        doc.text(`${day}/${String(dateObj.getMonth() + 1).padStart(2, '0')} (${weekday})${holidayName ? ` - ${holidayName}` : ''}`, 14, currentY);
        
        doc.setTextColor(0, 0, 0); // Reset for content
        doc.setFont('helvetica', 'normal');
        doc.text(`${timeStr} - ${event.title}`, 70, currentY);
        
        doc.setFontSize(10);
        doc.text(event.event_type.toUpperCase(), pageWidth - 14, currentY, { align: 'right' });

        currentY += 10;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.line(14, currentY - 2, pageWidth - 14, currentY - 2);
      });

      doc.save(`Calendario_${exportStartDate}_${exportEndDate}.pdf`);
    }
  };

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const renderCalendar = () => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const days = daysInMonth(month, year);
    const firstDay = firstDayOfMonth(month, year);
    
    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="h-24 border border-gray-100 bg-gray-50/50"></div>);
    }
    
    for (let d = 1; d <= days; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dayDateString = `${year}-${monthStr}-${dayStr}`;
      const dayEvents = events.filter(e => e.start_time.startsWith(dayDateString));
      const holidayName = currentHolidays[dayDateString];
      const dayOfWeek = new Date(year, month, d).getDay(); // 0 = Sun, 6 = Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      calendarDays.push(
        <div 
          key={d} 
          onClick={() => setSelectedDayData({
            date: dayDateString,
            events: dayEvents.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
            holiday: holidayName || null
          })}
          className="h-28 border border-gray-100 p-2 overflow-y-auto hover:bg-blue-50/40 transition-all group relative cursor-pointer"
          title={holidayName ? `Feriado: ${holidayName}` : ""}
        >
          <div className="flex justify-between items-start pointer-events-none">
            <span className={`text-[14px] font-black ${
              holidayName ? 'text-red-600' : 
              isWeekend ? 'text-blue-600' : 
              'text-black'
            }`}>
              {d}
            </span>
            {holidayName && (
              <span className="text-[7px] font-black text-red-500 uppercase tracking-tighter leading-none text-right w-1/2">
                {holidayName}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1 mt-1 pointer-events-none">
            {dayEvents.map(e => (
              <div 
                key={e.id} 
                className={`text-[10px] p-2 rounded-lg font-black truncate uppercase shadow-sm ${
                  e.event_type === 'Ensaio' ? 'bg-blue-100 text-blue-900' :
                  e.event_type === 'Reunião' ? 'bg-emerald-100 text-emerald-900' :
                  e.event_type === 'Reunião de Oração' ? 'bg-purple-100 text-purple-900' :
                  e.event_type === 'Reunião Festiva' ? 'bg-amber-100 text-amber-900' :
                  'bg-rose-100 text-rose-900'
                }`}
              >
                {new Date(e.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} {e.title}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return calendarDays;
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const currentHolidays = useMemo(() => getBrazilianHolidays(currentDate.getFullYear()), [currentDate]);

  // Unique years list for Year Picker (Extended range)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentY = new Date().getFullYear();
    // Margin of 10 years back and forward
    for (let i = currentY - 10; i <= currentY + 10; i++) {
      years.add(i);
    }
    // Plus from events
    events.forEach(e => {
      years.add(new Date(e.start_time).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [events]);

  return (
    <Layout title="Calendário" onBack={goBack} onExitImpersonation={onExitImpersonation}>
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mt-4">
        <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b">
          <div className="flex items-center gap-2">
            <div className="flex gap-1 mr-2">
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                className="p-3 hover:bg-gray-100 rounded-xl transition-colors text-black"
                title="Mês Anterior"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                className="p-3 hover:bg-gray-100 rounded-xl transition-colors text-black"
                title="Próximo Mês"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setPickerYear(currentDate.getFullYear());
                  setShowMonthPicker(true);
                }}
                className="text-2xl font-black text-black uppercase tracking-widest hover:text-blue-600 transition-colors cursor-pointer"
              >
                {monthNames[currentDate.getMonth()]}
              </button>
              <button 
                onClick={() => setShowYearPicker(true)}
                className="text-2xl font-black text-black uppercase tracking-widest hover:text-blue-600 transition-colors cursor-pointer"
              >
                {currentDate.getFullYear()}
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowExportModal(true)}
              className="px-6 py-3 bg-gray-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-gray-700 transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              PDF
            </button>
            {!isReadOnly && (
              <button 
                onClick={() => { resetForm(); setShowEventModal(true); }}
                className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agendar
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-7 text-[12px] font-black uppercase text-black bg-gray-50/50 border-b">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
            <div key={d} className="p-4 text-center">{d}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 text-sm">
          {renderCalendar()}
        </div>
      </div>

      {/* Month Picker Modal */}
      {/* Day Details Modal */}
      {selectedDayData && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDayData(null)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative p-8 animate-zoom-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h3 className="text-3xl font-black text-black">
                  {new Date(`${selectedDayData.date}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>
                {selectedDayData.holiday && (
                  <p className="text-red-600 font-black uppercase text-xs tracking-widest mt-1 italic flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    Feriado: {selectedDayData.holiday}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedDayData(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {selectedDayData.events.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-20"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <p className="font-bold uppercase text-[10px] tracking-widest">Nenhum evento para este dia</p>
                </div>
              ) : (
                selectedDayData.events.map(e => (
                  <button 
                    key={e.id}
                    onClick={() => {
                      setSelectedEvent(e);
                      setTitle(e.title);
                      setDescription(e.description);
                      setType(e.event_type);
                      setDate(e.start_time.split('T')[0]);
                      setTime(e.start_time.split('T')[1].substring(0, 5));
                      setShowEventModal(true);
                      setSelectedDayData(null);
                    }}
                    className="w-full text-left p-6 bg-gray-50 border border-gray-100 rounded-2xl hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[12px] font-black text-black">
                          {new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <h4 className="text-xl font-black text-black mt-1 uppercase leading-none">{e.title}</h4>
                        {e.description && <p className="text-[11px] text-gray-500 mt-3 font-medium line-clamp-2">{e.description}</p>}
                      </div>
                      <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        e.event_type === 'Ensaio' ? 'bg-blue-600 text-white' :
                        e.event_type === 'Reunião' ? 'bg-emerald-600 text-white' :
                        e.event_type === 'Reunião de Oração' ? 'bg-purple-600 text-white' :
                        e.event_type === 'Reunião Festiva' ? 'bg-amber-600 text-white' :
                        'bg-rose-600 text-white'
                      }`}>
                        {e.event_type}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-8 pt-6 border-t flex flex-col gap-3">
              {!isReadOnly && (
                <button 
                  onClick={() => {
                    resetForm();
                    setDate(selectedDayData.date);
                    setShowEventModal(true);
                    setSelectedDayData(null);
                  }}
                  className="w-full p-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Adicionar Evento
                </button>
              )}
              <button 
                onClick={() => setSelectedDayData(null)}
                className="w-full p-4 bg-gray-100 text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Details Modal */}
      {selectedDayData && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDayData(null)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative p-8 animate-zoom-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h3 className="text-3xl font-black text-black">
                  {new Date(`${selectedDayData.date}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>
                {selectedDayData.holiday && (
                  <p className="text-red-600 font-black uppercase text-xs tracking-widest mt-1 italic flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    Feriado: {selectedDayData.holiday}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedDayData(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {selectedDayData.events.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-20"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <p className="font-bold uppercase text-[10px] tracking-widest">Nenhum evento para este dia</p>
                </div>
              ) : (
                selectedDayData.events.map(e => (
                  <button 
                    key={e.id}
                    onClick={() => {
                      setSelectedEvent(e);
                      setTitle(e.title);
                      setDescription(e.description);
                      setType(e.event_type);
                      setDate(e.start_time.split('T')[0]);
                      setTime(e.start_time.split('T')[1].substring(0, 5));
                      setShowEventModal(true);
                      setSelectedDayData(null);
                    }}
                    className="w-full text-left p-6 bg-gray-50 border border-gray-100 rounded-2xl hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[12px] font-black text-black">
                          {new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <h4 className="text-xl font-black text-black mt-1 uppercase leading-none">{e.title}</h4>
                        {e.description && <p className="text-[11px] text-gray-500 mt-3 font-medium line-clamp-2">{e.description}</p>}
                      </div>
                      <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        e.event_type === 'Ensaio' ? 'bg-blue-600 text-white' :
                        e.event_type === 'Reunião' ? 'bg-emerald-600 text-white' :
                        e.event_type === 'Reunião de Oração' ? 'bg-purple-600 text-white' :
                        e.event_type === 'Reunião Festiva' ? 'bg-amber-600 text-white' :
                        'bg-rose-600 text-white'
                      }`}>
                        {e.event_type}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-8 pt-6 border-t flex flex-col gap-3">
              {!isReadOnly && (
                <button 
                  onClick={() => {
                    resetForm();
                    setDate(selectedDayData.date);
                    setShowEventModal(true);
                    setSelectedDayData(null);
                  }}
                  className="w-full p-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Adicionar Evento
                </button>
              )}
              <button 
                onClick={() => setSelectedDayData(null)}
                className="w-full p-4 bg-gray-100 text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showMonthPicker && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMonthPicker(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative p-8 animate-zoom-in">
            <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h3 className="text-xl font-black text-black">SELECIONAR MÊS</h3>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setPickerYear(prev => prev - 1)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-black"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span className="font-black text-lg text-black">{pickerYear}</span>
                <button 
                  onClick={() => setPickerYear(prev => prev + 1)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-black"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {monthNames.map((m, idx) => (
                <button
                  key={m}
                  onClick={() => {
                    setCurrentDate(new Date(pickerYear, idx, 1));
                    setShowMonthPicker(false);
                  }}
                  className={`p-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                    currentDate.getMonth() === idx && currentDate.getFullYear() === pickerYear
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'hover:bg-gray-100 text-black'
                  }`}
                >
                  {m.substring(0, 3)}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowMonthPicker(false)}
              className="w-full mt-8 p-4 bg-gray-100 text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Year Picker Modal */}
      {showYearPicker && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowYearPicker(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative p-8 animate-zoom-in">
            <h3 className="text-xl font-black text-black mb-8 border-b pb-4">SELECIONAR ANO</h3>
            <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {availableYears.map(y => (
                <button
                  key={y}
                  onClick={() => {
                    setCurrentDate(new Date(y, currentDate.getMonth(), 1));
                    setShowYearPicker(false);
                  }}
                  className={`p-4 rounded-xl font-black text-sm transition-all ${
                    currentDate.getFullYear() === y
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'hover:bg-gray-100 text-black'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowYearPicker(false)}
              className="w-full mt-8 p-4 bg-gray-100 text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {showEventModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEventModal(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative p-8 animate-zoom-in">
            <h3 className="text-xl font-black text-black uppercase tracking-widest mb-6 border-b pb-4">
              {isReadOnly ? 'Detalhes do Evento' : (selectedEvent ? 'Editar Evento' : 'Novo Evento')}
            </h3>
            <div className="space-y-4">
              <label className="block">
                <span className="text-[11px] font-black uppercase text-black block mb-1">Título do Evento</span>
                <input 
                  disabled={isReadOnly}
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black disabled:opacity-60"
                  placeholder="Ex: Ensaio de Sopros"
                />
              </label>
              
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[11px] font-black uppercase text-black block mb-1">Data</span>
                  <input 
                    disabled={isReadOnly}
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none transition-all text-sm text-black disabled:opacity-60"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase text-black block mb-1">Horário</span>
                  <input 
                    disabled={isReadOnly}
                    type="time" 
                    value={time} 
                    onChange={e => setTime(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none transition-all text-sm text-black disabled:opacity-60"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-[11px] font-black uppercase text-black block mb-1">Tipo de Evento</span>
                <select 
                  disabled={isReadOnly}
                  value={type} 
                  onChange={e => setType(e.target.value as any)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none transition-all appearance-none text-sm text-black disabled:opacity-60"
                >
                  <option value="Ensaio">Ensaio</option>
                  <option value="Reunião">Reunião</option>
                  <option value="Reunião de Oração">Reunião de Oração</option>
                  <option value="Reunião Festiva">Reunião Festiva</option>
                  <option value="Aprimoramento">Aprimoramento</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-black uppercase text-black block mb-1">Observações (Opcional)</span>
                <textarea 
                  disabled={isReadOnly}
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none transition-all h-24 text-sm text-black disabled:opacity-60"
                  placeholder="Detalhes adicionais..."
                />
              </label>
            </div>

            <div className="flex gap-3 mt-8 pt-6 border-t">
              <button 
                onClick={() => setShowEventModal(false)}
                className="flex-1 px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                {isReadOnly ? 'Fechar' : 'Cancelar'}
              </button>
              {!isReadOnly && selectedEvent && (
                <button 
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                  className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              )}
              {!isReadOnly && (
                <button 
                  onClick={handleSaveEvent}
                  className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                >
                  {selectedEvent ? 'Salvar' : 'Agendar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setShowExportModal(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative p-8 animate-fade-in-up">
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest mb-6 border-b pb-4">Gerar PDF</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Início</span>
                  <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-xs" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Fim</span>
                  <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-xs" />
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Filtrar por Tipo</span>
                <select 
                  value={exportType} 
                  onChange={e => setExportType(e.target.value)}
                  className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-xs appearance-none"
                >
                  <option value="Todos">Todos os Tipos</option>
                  <option value="Ensaio">Ensaio</option>
                  <option value="Reunião">Reunião</option>
                  <option value="Reunião de Oração">Reunião de Oração</option>
                  <option value="Reunião Festiva">Reunião Festiva</option>
                  <option value="Aprimoramento">Aprimoramento</option>
                </select>
              </label>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowExportModal(false)} className="flex-1 p-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancelar</button>
              <button onClick={() => generatePDF(true)} className="flex-1 p-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md">Visualizar PDF</button>
            </div>
          </div>
        </div>
      )}

      {filteredEventsForPreview && (
        <CalendarPreviewModal 
          events={filteredEventsForPreview}
          startDate={exportStartDate}
          endDate={exportEndDate}
          exportType={exportType}
          onClose={() => setFilteredEventsForPreview(null)} 
          onDownload={() => { 
            // window.print used inside modal
          }} 
        />
      )}
    </Layout>
  );
};

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
          <h2 className="text-xl font-black text-blue-900 uppercase tracking-widest border-b pb-4">Exportar Dados</h2>
          <p className="text-gray-500 text-sm italic">
            {canExportBackups ? "Baixe o backup completo do sistema (Acesso Master)." : "Baixe seus dados para backup ou uso em Excel."}
          </p>
          
          <button 
            onClick={onBackupJSON} 
            disabled={isExportingJSON}
            className="w-full flex items-center justify-between p-4 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all active:scale-95 disabled:opacity-50"
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
          <h2 className="text-xl font-black text-blue-900 uppercase tracking-widest border-b pb-4">Importar Dados</h2>
          <p className="text-gray-500 text-sm italic">Restaure um backup ou adicione novos registros.</p>

          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase text-gray-900 block mb-2">Restaurar de arquivo JSON</span>
              <button 
                onClick={() => jsonInputRef.current?.click()}
                disabled={isReadOnly}
                className="w-full flex items-center gap-3 p-4 border-2 border-dashed border-gray-200 rounded-xl font-bold text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-50"
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

const MusicianReportSelectionScreen = ({ navigate, goBack, ownerEmail, onExitImpersonation }: any) => {
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
          <select className="w-full border-2 border-gray-100 rounded-lg p-3 text-lg font-medium focus:border-blue-500 outline-none transition-colors" value={type} onChange={e => setType(e.target.value)}>
            <option value="Geral em Ordem Alfabética">Geral em Ordem Alfabética</option>
            <option value="Por Voz">Por Voz</option>
            <option value="Por Instrumento">Por Instrumento</option>
          </select>
        </div>
        <button onClick={handleGenerate} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-all">Visualizar Relatório</button>
      </div>
    </Layout>
  );
};

// --- Relatórios de Componentes ---

// --- Relatórios de Cadastros (Instrumentos e Músicos) ---

const InstrumentsReportScreen = ({ goBack, ownerEmail }: any) => {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  useEffect(() => { fetchData('instruments', 'gca_instruments', ownerEmail).then(setInstruments); }, [ownerEmail]);
  const sorted = useMemo(() => [...instruments].sort((a, b) => a.name.localeCompare(b.name)), [instruments]);
  
  const header = useMemo(() => (
    <div className="text-center border-b-2 border-double border-blue-900 pb-4 flex flex-col items-center mb-4 w-full pt-1">
      <h1 className="text-3xl font-black uppercase tracking-tight text-blue-900 mb-2">Igreja Apostólica</h1>
      <h2 className="text-xl font-bold border-2 border-blue-900 text-blue-900 inline-block px-10 py-2.5 uppercase rounded-sm tracking-widest leading-tight">Relatório de Instrumentos</h2>
      <div className="mt-2 text-[11px] font-black uppercase tracking-widest text-black border-blue-900 border-t pt-4 italic text-center w-full px-4">Relação Geral de Instrumentos Cadastrados • Total: {instruments.length}</div>
    </div>
  ), [instruments.length]);

  const tableHeader = useMemo(() => (
    <div className="flex bg-blue-900 text-white text-left uppercase font-black text-[10px] w-full items-center min-h-[44px]">
      <div className="px-3 py-2 w-12 text-center flex items-center justify-center">#</div>
      <div className="px-3 py-2 border-l border-blue-800/30 flex-1 flex items-center justify-center font-black h-full">Instrumento</div>
      <div className="px-3 py-2 border-l border-blue-800/30 flex-1 flex items-center justify-center font-black h-full">Modalidade</div>
      <div className="px-3 py-2 border-l border-blue-800/30 w-24 text-center flex items-center justify-center h-full">Clave</div>
      <div className="px-3 py-2 border-l border-blue-800/30 w-32 border-r border-blue-800/30 flex items-center justify-center h-full">Afinação</div>
    </div>
  ), []);

  return (
    <PagedReport
      id="instruments-report-view"
      title="Relatório de Instrumentos"
      filename="relatorio-instrumentos"
      goBack={goBack}
      items={sorted}
      header={header}
      tableHeader={tableHeader}
      renderItem={(i, idx) => (
        <div className={`flex w-full items-stretch ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} avoid-break min-h-[44px]`}>
          <div className="px-3 py-2 w-12 text-center flex items-center justify-center font-bold text-gray-400 text-[10px] border-r border-gray-100">{idx + 1}</div>
          <div className="px-6 py-2 flex-1 font-bold text-black uppercase text-[12px] border-r border-gray-100 flex items-center">{i.name}</div>
          <div className="px-6 py-2 flex-1 text-black text-[11px] border-r border-gray-100 flex items-center italic">{i.modality}</div>
          <div className="px-3 py-2 w-24 text-center text-black font-black text-[11px] border-r border-gray-100 flex items-center justify-center">{i.timbre || '-'}</div>
          <div className="px-6 py-2 w-32 border-r border-gray-100 flex items-center justify-end">
            <span className="font-black text-black text-[11px] uppercase">{i.tuning || '-'}</span>
          </div>
        </div>
      )}
    />
  );
};

const MusiciansReportScreen = ({ goBack, ownerEmail }: any) => {
  const [musicians, setMusicians] = useState<Musician[]>([]);
  useEffect(() => { fetchData('musicians', 'gca_musicians', ownerEmail).then(setMusicians); }, [ownerEmail]);
  const sorted = useMemo(() => [...musicians].sort((a, b) => a.name.localeCompare(b.name)), [musicians]);
  
  const header = useMemo(() => (
    <div className="text-center border-b-2 border-double border-blue-900 pb-4 flex flex-col items-center mb-4 pt-1 w-full">
      <h1 className="text-3xl font-black uppercase tracking-tight text-blue-900 mb-2">Igreja Apostólica</h1>
      <h2 className="text-xl font-bold border-2 border-blue-900 text-blue-900 inline-block px-10 py-2.5 uppercase rounded-sm tracking-widest leading-tight">Relação de Integrantes</h2>
      <div className="mt-2 text-[11px] font-black uppercase tracking-widest text-black border-blue-900 border-t pt-4 italic w-full text-center px-4">Ordem Alfabética • Total: {musicians.length} Integrantes</div>
    </div>
  ), [musicians.length]);

  const tableHeader = useMemo(() => (
    <div className="flex bg-blue-900 text-white text-left uppercase font-black text-[11px] w-full items-center min-h-[44px]">
      <div className="px-6 py-2 border-l border-blue-800/30 flex-1 flex items-center justify-center h-full">Nome do Componente</div>
      <div className="px-6 py-2 border-l border-blue-800/30 flex-1 flex items-center justify-center h-full">Voz(es) / Instrumentos</div>
    </div>
  ), []);

  return (
    <PagedReport
      id="musician-report-alpha"
      title="Relação de Integrantes"
      filename="musicos-alfabetico"
      goBack={goBack}
      items={sorted}
      header={header}
      tableHeader={tableHeader}
      renderItem={(m, idx) => (
        <div className={`flex w-full items-stretch ${idx % 2 === 1 ? 'bg-white' : 'bg-gray-50/50'} min-h-[48px] avoid-break`}>
          <div className="px-6 py-3 font-bold text-black uppercase text-[12.5px] flex-1 border-r border-gray-100 flex items-center">{m.name}</div>
          <div className="px-6 py-3 text-black text-[11px] italic flex-1 flex items-center">
            {m.voices.join(', ') || m.instruments.join(', ')}
          </div>
        </div>
      )}
    />
  );
};

const MusiciansVoiceReportScreen = ({ goBack, ownerEmail }: any) => {
  const [musicians, setMusicians] = useState<Musician[]>([]);
  useEffect(() => { fetchData('musicians', 'gca_musicians', ownerEmail).then(setMusicians); }, [ownerEmail]);
  const voices = ['Melodia', 'Contralto', 'Tenor', 'Baixo'];
  
  const voiceMusiciansCount = useMemo(() => {
    const unique = new Set(
      musicians
        .filter(m => m.voices && m.voices.length > 0)
        .map(m => m.id)
    );
    return unique.size;
  }, [musicians]);

  const sections = useMemo(() => {
    const result: any[] = [];
    voices.forEach(voice => {
      const members = musicians.filter(m => m.voices.includes(voice)).sort((a,b) => a.name.localeCompare(b.name));
      if (members.length > 0) {
        result.push({ type: 'header', label: voice, count: members.length });
        members.forEach(m => result.push({ type: 'member', name: m.name }));
      }
    });
    return result;
  }, [musicians]);

  const header = useMemo(() => (
    <div className="text-center border-b-2 border-double border-blue-900 pb-4 flex flex-col items-center mb-4 pt-1 w-full">
      <h1 className="text-3xl font-black uppercase tracking-tight text-blue-900 mb-2">Igreja Apostólica</h1>
      <h2 className="text-xl font-bold border-2 border-blue-900 text-blue-900 inline-block px-10 py-2.5 uppercase rounded-sm tracking-widest leading-tight">Integrantes por Voz</h2>
      <div className="mt-2 text-xs font-bold uppercase italic text-black border-blue-900 border-t pt-4 w-full text-center px-4">Total: {voiceMusiciansCount} Integrantes</div>
    </div>
  ), [voiceMusiciansCount]);

  return (
    <PagedReport
      id="musician-report-voice"
      title="Integrantes por Voz"
      filename="musicos-por-voz"
      goBack={goBack}
      items={sections}
      header={header}
      renderItem={(item) => (
        item.type === 'header' ? (
          <div className="flex items-center justify-center w-full mt-8 mb-4">
            <h3 className="bg-white border-2 border-blue-900 text-blue-900 px-8 py-3.5 font-black uppercase text-[13px] inline-block rounded-sm tracking-widest leading-none avoid-break shadow-sm min-h-[44px] flex items-center justify-center">
              {item.label} ({item.count})
            </h3>
          </div>
        ) : (
          <div className="text-[11px] font-bold text-black border-b border-gray-100 py-3 uppercase truncate avoid-break flex items-center h-full min-h-[32px] px-6">
            {item.name}
          </div>
        )
      )}
    />
  );
};

const MusiciansInstrumentReportScreen = ({ goBack, ownerEmail }: any) => {
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  useEffect(() => {
    fetchData('musicians', 'gca_musicians', ownerEmail).then(setMusicians);
    fetchData('instruments', 'gca_instruments', ownerEmail).then(setInstruments);
  }, [ownerEmail]);

  const instrumentMusiciansCount = useMemo(() => {
    const unique = new Set(
      musicians
        .filter(m => m.instruments && m.instruments.length > 0)
        .map(m => m.id)
    );
    return unique.size;
  }, [musicians]);

  const sections = useMemo(() => {
    if (musicians.length === 0 || instruments.length === 0) return [];
    
    const musByInst: Record<string, Musician[]> = {};
    musicians.forEach(m => {
      m.instruments.forEach(instId => {
        if (!musByInst[instId]) musByInst[instId] = [];
        musByInst[instId].push(m);
      });
    });

    const result: any[] = [];
    const sortedInstruments = [...instruments].sort((a,b) => a.name.localeCompare(b.name));
    
    sortedInstruments.forEach(inst => {
      const members = musByInst[inst.id];
      if (members && members.length > 0) {
        members.sort((a,b) => a.name.localeCompare(b.name));
        result.push({ 
          type: 'header', 
          label: inst.name, 
          tuning: inst.tuning,
          count: members.length 
        });
        members.forEach(m => result.push({ type: 'member', name: m.name }));
      }
    });
    return result;
  }, [musicians, instruments]);

  const header = useMemo(() => (
    <div className="text-center border-b-2 border-double border-blue-900 pb-4 flex flex-col items-center mb-4 pt-1 w-full">
      <h1 className="text-3xl font-black uppercase tracking-tight text-blue-900 mb-2">Igreja Apostólica</h1>
      <h2 className="text-xl font-bold border-2 border-blue-900 text-blue-900 inline-block px-10 py-2.5 uppercase rounded-sm tracking-widest leading-tight">Integrantes por Instrumento</h2>
      <div className="mt-2 text-xs font-bold uppercase italic text-black border-blue-900 border-t pt-4 w-full text-center px-4">Total: {instrumentMusiciansCount} Integrantes</div>
    </div>
  ), [instrumentMusiciansCount]);

  return (
    <PagedReport
      id="musician-report-instrument"
      title="Integrantes por Instrumento"
      filename="musicos-por-instrumento"
      goBack={goBack}
      items={sections}
      header={header}
      renderItem={(item) => (
        item.type === 'header' ? (
          <div className="flex items-center justify-center w-full mt-8 mb-4">
            <div className="bg-white border-2 border-blue-900 text-blue-900 px-8 py-3.5 font-black uppercase text-[13px] inline-block rounded-sm tracking-widest leading-none avoid-break shadow-sm relative group min-h-[44px] flex items-center justify-center">
              <span>{item.label} ({item.count})</span>
              <span className="ml-4 text-[9px] text-gray-400 italic font-medium">Afinação: {item.tuning}</span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] font-bold text-gray-800 border-b border-gray-100 py-3 uppercase truncate avoid-break flex items-center h-full min-h-[32px] px-6">
            {item.name}
          </div>
        )
      )}
    />
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

  // Flattening records: each item is either a date header or a musician status row
  const items: any[] = [];
  records.forEach(r => {
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

    if (filteredList.length > 0 || reportData.t === 'Todos') {
      items.push({ type: 'header', date: r.date });
      filteredList.forEach(m => {
        const isPresent = presentIds.has(m.id);
        const isJustified = justifiedIds.has(m.id);
        items.push({ 
          type: 'row', 
          name: m.name, 
          status: isPresent ? 'Presente' : isJustified ? 'Justificado' : 'Ausente',
          justification: isJustified ? justifiedMap[m.id] : '-'
        });
      });
      if (filteredList.length === 0) {
        items.push({ type: 'empty' });
      }
    }
  });

  const header = useMemo(() => (
    <div className="text-center border-b-2 border-double border-blue-900 pb-4 flex flex-col items-center mb-4 pt-1 w-full">
      <h1 className="text-3xl font-black uppercase tracking-tight leading-normal mb-2 text-blue-900">Igreja Apostólica</h1>
      <h2 className="text-xl font-bold border-2 border-blue-900 text-blue-900 inline-block px-10 py-2.5 uppercase rounded-sm tracking-widest leading-tight">Relatório de Presença</h2>
      <div className="mt-2 text-[13px] font-bold uppercase italic text-black border-blue-900 border-t pt-4 flex justify-between w-full px-4">
        <span>Período: {new Date(reportData.s + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(reportData.e + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
        <span>Grupo: {reportData.g || 'Geral'}</span>
        <span>Filtro: {reportData.t}</span>
      </div>
    </div>
  ), [reportData.s, reportData.e, reportData.g, reportData.t]);

  const tableHeader = useMemo(() => (
    <div className="flex bg-blue-900 text-white uppercase font-black text-[11px] w-full items-center min-h-[40px]">
      <div className="px-3 py-1.5 w-1/3 text-center">Integrante</div>
      <div className="px-3 py-1.5 w-32 text-center border-l border-blue-800/30">Presença</div>
      <div className="px-3 py-1.5 flex-1 text-center border-l border-blue-800/30">Observação / Justificativa</div>
    </div>
  ), []);

  return (
    <PagedReport
      id="attendance-report-view"
      title="Relatório de Presença"
      filename="relatorio-presenca"
      goBack={goBack}
      items={items}
      header={header}
      tableHeader={tableHeader}
      renderItem={(item, idx) => {
        if (item.type === 'header') {
          return (
          <div className="flex items-center justify-center w-full my-6">
            <h3 className="bg-white border-2 border-blue-900 text-blue-900 px-8 py-3 font-black uppercase text-[12px] inline-block rounded-sm tracking-widest leading-none avoid-break shadow-sm">
              {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
          </div>
          );
        }
        if (item.type === 'empty') {
          return <div className="px-4 py-8 text-center text-black italic text-sm uppercase border border-gray-100">Nenhum músico encontrado para este filtro nesta data.</div>;
        }
        return (
          <div className={`flex w-full items-stretch border-b border-gray-100 bg-white avoid-break`}>
            <div className="px-3 py-3 font-bold text-black text-[12px] uppercase w-1/3 border-r border-gray-100 flex items-center">{item.name}</div>
            <div className="px-3 py-3 text-center w-32 border-r border-gray-100 flex items-center justify-center">
              <span className={`text-[11px] font-black uppercase ${item.status === 'Presente' ? 'text-emerald-600' : item.status === 'Justificado' ? 'text-blue-600' : 'text-rose-600'}`}>{item.status}</span>
            </div>
            <div className="px-3 py-3 text-[11px] text-gray-600 font-medium flex-1 flex items-center">
              {item.justification}
            </div>
          </div>
        );
      }}
    />
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
      
      const filteredRecords = recs.filter((r: AttendanceRecord) => 
        r.date >= reportData.s && r.date <= reportData.e
      );
      
      let finalMusicians = musics;
      if (reportData.g === 'Coral') {
        finalMusicians = musics.filter((m: Musician) => m.voices && m.voices.length > 0);
      } else if (reportData.g === 'Orquestra') {
        finalMusicians = musics.filter((m: Musician) => m.instruments && m.instruments.length > 0);
      }

      setRecords(filteredRecords);
      setMusicians(finalMusicians);
    };
    load();
  }, [ownerEmail, reportData.s, reportData.e, reportData.g]);

  const sortedMusicians = useMemo(() => [...musicians].sort((a, b) => a.name.localeCompare(b.name)), [musicians]);
  
  const header = useMemo(() => (
    <div className="text-center border-b-2 border-double border-blue-900 pb-4 flex flex-col items-center mb-4 pt-1 w-full">
      <h1 className="text-3xl font-black uppercase tracking-tight leading-tight mb-2 text-blue-900">Igreja Apostólica</h1>
      <h2 className="text-xl font-bold border-2 border-blue-900 text-blue-900 inline-block px-10 py-2.5 uppercase rounded-sm tracking-widest leading-tight">Participação Proporcional</h2>
      <div className="mt-2 text-[13px] font-bold uppercase italic text-black border-blue-900 border-t pt-4 flex justify-between w-full px-4">
        <span>Período: {new Date(reportData.s + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(reportData.e + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
        <span>Grupo: {reportData.g || 'Geral'}</span>
      </div>
    </div>
  ), [reportData.s, reportData.e, reportData.g]);

  const tableHeader = useMemo(() => (
    <div className="flex items-center bg-blue-900 text-white text-left uppercase font-black text-[11px] w-full min-h-[44px]">
      <div className="px-6 py-2 flex-1 flex items-center h-full">Nome do Componente</div>
      <div className="px-3 py-2 border-l border-blue-800/30 w-20 text-center flex items-center justify-center h-full">CHAM.</div>
      <div className="px-3 py-2 border-l border-blue-800/30 w-20 text-center flex items-center justify-center h-full">Pres.</div>
      <div className="px-3 py-2 border-l border-blue-800/30 w-20 text-center flex items-center justify-center h-full">Just.</div>
      <div className="px-3 py-2 border-l border-blue-800/30 w-20 text-center flex items-center justify-center h-full">AUS.</div>
      <div className="px-6 py-2 border-l border-blue-800/30 w-28 text-right flex items-center justify-end h-full">Frequência</div>
    </div>
  ), []);

  return (
    <PagedReport
      id="attendance-perc-view"
      title="Participação Proporcional"
      filename="percentual-participacao"
      goBack={goBack}
      items={sortedMusicians}
      header={header}
      tableHeader={tableHeader}
      renderItem={(m, idx) => {
        let presents = 0;
        let justified = 0;
        let relevantCalls = 0;

        records.forEach(r => {
          let isExpected = false;
          if (r.group === 'Geral' || !r.group) {
            isExpected = true;
          } else if (r.group === 'Coral') {
            isExpected = m.voices && m.voices.length > 0;
          } else if (r.group === 'Orquestra') {
            isExpected = m.instruments && m.instruments.length > 0;
          } else if (r.group === 'Outro') {
            isExpected = r.subset_ids?.includes(m.id) || false;
          }

          if (isExpected) {
            relevantCalls++;
            if (r.presentMusicianIds.includes(m.id)) presents++;
            else if (r.justifications && r.justifications[m.id]) justified++;
          }
        });
        
        const absences = relevantCalls - (presents + justified);
        const effectivePresence = presents + justified;
        const percentage = relevantCalls > 0 ? (effectivePresence / relevantCalls) * 100 : 0;
        const isBelowThreshold = percentage < 70;

        return (
          <div className={`flex items-stretch w-full ${idx % 2 === 1 ? 'bg-white' : 'bg-gray-50/50'} avoid-break border-b border-gray-100 min-h-[48px]`}>
            <div className={`px-6 py-3 font-bold text-[12px] border-r border-gray-100 uppercase flex-1 flex items-center ${isBelowThreshold ? 'text-red-600' : 'text-black'}`}>{m.name}</div>
            <div className="px-3 py-3 text-center text-[12px] text-gray-400 border-r border-gray-100 font-bold w-20 flex items-center justify-center">{relevantCalls}</div>
            <div className="px-3 py-3 text-center text-[12px] text-emerald-600 border-r border-gray-100 w-20 flex items-center justify-center font-black">{presents}</div>
            <div className="px-3 py-3 text-center text-[12px] text-blue-600 font-bold border-r border-gray-100 w-20 flex items-center justify-center">{justified}</div>
            <div className={`px-3 py-3 text-center text-[12px] border-r border-gray-100 font-bold w-20 flex items-center justify-center ${absences > 0 ? 'text-red-500' : 'text-gray-300'}`}>{absences}</div>
            <div className={`px-6 py-3 text-right font-black text-[14px] w-28 flex items-center justify-end ${isBelowThreshold ? 'text-red-600' : 'text-blue-900'}`}>
                {percentage.toFixed(1)}%
            </div>
          </div>
        );
      }}
    />
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

  const sorted = useMemo(() => [...hymns].sort((a, b) => {
    const n1 = parseInt(a.number);
    const n2 = parseInt(b.number);
    if (isNaN(n1) || isNaN(n2)) return a.number.localeCompare(b.number);
    return n1 - n2;
  }), [hymns]);

  const header = useMemo(() => (
    <div className="text-center border-b-2 border-double border-blue-900 pb-4 flex flex-col items-center mb-4 pt-1 w-full">
      <h1 className="text-3xl font-black uppercase tracking-tight leading-tight mb-2 text-blue-900">Igreja Apostólica</h1>
      <h2 className="text-xl font-bold border-2 border-blue-900 text-blue-900 inline-block px-10 py-2.5 uppercase rounded-sm tracking-widest leading-tight">Biblioteca de Hinos</h2>
      <div className="mt-2 text-[13px] font-bold uppercase italic text-black border-blue-900 border-t pt-4 w-full px-4 text-center">
        Caderno: {notebook.code} - {notebook.name} • Total: {hymns.length} Hinos
      </div>
    </div>
  ), [notebook.code, notebook.name, hymns.length]);

  const tableHeader = useMemo(() => (
    <div className="flex bg-blue-900 text-white uppercase font-black text-[11px] w-full items-center min-h-[44px]">
      <div className="px-3 py-1.5 w-20 text-center flex items-center justify-center border-r border-blue-800/30 font-black h-full">Nº</div>
      <div className="px-6 py-1.5 flex-1 flex items-center h-full">Título do Hino</div>
    </div>
  ), []);

  return (
    <PagedReport
      id="hymn-notebook-report-view"
      title="Biblioteca de Hinos"
      filename={`hinos-${notebook.code}`}
      goBack={goBack}
      items={sorted}
      header={header}
      tableHeader={tableHeader}
      renderItem={(h) => (
        <div key={h.id} className="flex items-stretch w-full border-b border-gray-100 bg-white avoid-break min-h-[44px]">
          <div className="px-3 py-3 w-20 text-center font-black text-black border-r border-gray-100 text-base flex items-center justify-center">{h.number}</div>
          <div className="px-6 py-3 flex-1 font-bold text-black uppercase text-[12.5px] flex items-center">{h.title}</div>
        </div>
      )}
    />
  );
};

// --- Relatórios do Módulo Admin Master ---

const AdminMasterReportView = ({ id, title, columns, data, goBack, orientation = 'portrait' }: any) => {
  const header = useMemo(() => (
    <div className="text-center border-b-2 border-double border-blue-900 pb-4 flex flex-col items-center mb-4 pt-1 w-full">
      <h1 className="text-3xl font-black uppercase tracking-tight text-blue-900 mb-2">Igreja Apostólica</h1>
      <h2 className="text-xl font-bold border-2 border-blue-900 text-blue-900 inline-block px-10 py-2.5 uppercase rounded-sm tracking-widest leading-tight">{title}</h2>
      <div className="mt-2 text-[11px] font-black uppercase tracking-widest text-black border-blue-900 border-t pt-4 italic text-center w-full px-4">Sistema de Gestão Admin Master</div>
    </div>
  ), [title]);

  const tableHeader = useMemo(() => (
    <div className="flex items-center bg-blue-900 text-white text-left uppercase font-black text-[11px] w-full min-h-[44px]">
      {columns.map((col: any) => (
        <div key={col.key} className="px-6 py-2 border-l border-blue-800/30 flex-1 h-full flex items-center justify-center text-center">{col.label}</div>
      ))}
    </div>
  ), [columns]);

  return (
    <PagedReport
      id={id}
      filename={id}
      goBack={goBack}
      items={data}
      header={header}
      tableHeader={tableHeader}
      orientation={orientation}
      title={title}
      renderItem={(item, idx) => (
        <div className={`flex items-stretch w-full ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} min-h-[44px] avoid-break border-b border-gray-100`}>
          {columns.map((col: any) => (
            <div key={col.key} className="px-6 py-2 text-[12px] font-bold text-black border-r border-gray-100 flex-1 flex items-center uppercase overflow-hidden">
              <span className="truncate">{item[col.key] || '-'}</span>
            </div>
          ))}
        </div>
      )}
    />
  );
};

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
      <div className="sticky top-[60px] z-20 bg-gray-50/95 backdrop-blur-sm shadow-sm -mx-4 px-4 py-4 mb-6 -mt-4 flex justify-between items-center border-b border-gray-100">
        <h2 className="font-bold text-gray-700 uppercase">Países Cadastrados</h2>
        <div className="flex gap-2">
          <button onClick={() => navigate('admin_countries_report', countries)} className="bg-white text-blue-600 px-5 py-2.5 rounded-xl font-bold text-sm border-2 border-blue-100 hover:bg-blue-50 transition-all shadow-sm">Relatório</button>
          <button onClick={() => { setEditingId(null); setName(''); setShowForm(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all">Novo País</button>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl animate-scale-up border border-blue-100">
            <div className="flex justify-between items-center mb-6 border-b border-blue-50 pb-4">
              <h3 className="font-black text-xs uppercase text-blue-900 tracking-widest">{editingId ? 'Editando País' : 'Cadastrando Novo País'}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={prepareSave} className="space-y-6">
              <div className="w-full">
                <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Nome do País</label>
                <input required autoFocus className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-blue-600 outline-none transition-all font-bold placeholder:text-gray-300" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Brasil" />
              </div>
              <div className="flex gap-4 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all">{editingId ? 'Salvar Edição' : 'Gravar'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {countries.map(c => (
          <div key={c.id} className="p-4 border-b last:border-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group hover:bg-blue-50/30">
            <div className="flex items-center flex-1">
              <span className="font-mono bg-gray-50 px-2 py-1 rounded text-blue-600 font-bold border">{c.id}</span>
              <span className="ml-4 font-bold text-gray-800 uppercase">{c.name}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setEditingId(c.id); setName(c.name); setShowForm(true); }} className="text-blue-600 font-bold uppercase text-[10px] hover:underline">Editar</button>
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
      <div className="sticky top-[60px] z-20 bg-gray-50/95 backdrop-blur-sm shadow-sm -mx-4 px-4 py-4 mb-6 -mt-4 flex justify-between items-center border-b border-gray-100">
        <h2 className="font-bold text-gray-700 uppercase">Estados Cadastrados</h2>
        <div className="flex gap-2">
          <button onClick={() => navigate('admin_states_report', states)} className="bg-white text-blue-600 px-5 py-2.5 rounded-xl font-bold text-sm border-2 border-blue-100 hover:bg-blue-50 transition-all shadow-sm">Relatório</button>
          <button onClick={() => { setEditingId(null); setFormData({name: '', uf: ''}); setShowForm(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all">Novo Estado</button>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-lg shadow-2xl animate-scale-up border border-blue-100">
            <div className="flex justify-between items-center mb-6 border-b border-blue-50 pb-4">
              <h3 className="font-black text-xs uppercase text-blue-900 tracking-widest">{editingId ? 'Editando Estado' : 'Novo Estado'}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={prepareSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Nome do Estado</label>
                  <input required autoFocus className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-blue-600 outline-none transition-all font-bold placeholder:text-gray-300" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: São Paulo" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">UF</label>
                  <input required className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-blue-600 outline-none transition-all font-bold text-center uppercase placeholder:text-gray-300" maxLength={2} value={formData.uf} onChange={e => setFormData({...formData, uf: e.target.value.toUpperCase()})} placeholder="SP" />
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all">{editingId ? 'Salvar Edição' : 'Salvar'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {states.map(s => (
          <div key={s.id} className="p-4 border-b last:border-0 flex flex-col sm:flex-row gap-4 items-start sm:items-center group hover:bg-blue-50/30">
            <div className="flex items-center flex-1 w-full">
              <span className="font-mono bg-gray-50 px-2 py-1 rounded text-blue-600 font-bold border">{s.id}</span>
              <span className="flex-1 ml-4 font-bold text-gray-800 uppercase">{s.name}</span>
              <span className="text-gray-400 font-black text-sm uppercase">{s.uf}</span>
            </div>
            <div className="flex gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
              <button onClick={() => { setEditingId(s.id); setFormData({name: s.name, uf: s.uf}); setShowForm(true); }} className="text-blue-600 font-bold uppercase text-[10px] hover:underline">Editar</button>
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
      <div className="sticky top-[60px] z-20 bg-gray-50/95 backdrop-blur-sm shadow-sm -mx-4 px-4 py-4 mb-6 -mt-4 flex justify-between items-center border-b border-gray-100">
        <h2 className="font-bold text-gray-700 uppercase">Congregações</h2>
        <div className="flex gap-2">
          <button onClick={() => navigate('admin_congregations_report', getReportData())} className="bg-white text-blue-600 border-2 border-blue-100 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all shadow-sm">Relatório</button>
          <button onClick={() => { setEditingId(null); setShowForm(true); setFormData({ name: '', country_id: '', state_id: '', address: '', neighborhood: '', address_number: '', cep: '', uf: '' }); setFoundCountryName(''); setFoundStateName(''); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all">Nova Congregação</button>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-2xl shadow-2xl animate-scale-up border border-blue-100 overflow-y-auto max-h-[90vh] custom-scrollbar-heavy">
            <div className="flex justify-between items-center mb-6 border-b border-blue-50 pb-4">
              <h3 className="font-black text-xs uppercase text-blue-900 tracking-widest">{editingId ? 'Editando Congregação' : 'Nova Congregação'}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={prepareSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Nome da Congregação</label>
                <input required autoFocus className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-blue-600 outline-none transition-all font-bold placeholder:text-gray-300" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Sede Central, Bairro Novo..." />
              </div>
              
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Cód. País</label>
                <div className="flex gap-2">
                  <input required className="w-20 border-2 border-gray-100 rounded-xl p-4 text-center focus:border-blue-600 outline-none transition-all font-bold" value={formData.country_id} onChange={e => handleCountryCodeChange(e.target.value)} placeholder="01" />
                  <input readOnly className="flex-1 bg-gray-50 border-2 border-transparent rounded-xl p-4 italic text-gray-400 font-medium" value={foundCountryName} placeholder="Busca automática..." />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Cód. Estado</label>
                <div className="flex gap-2">
                  <input required className="w-20 border-2 border-gray-100 rounded-xl p-4 text-center focus:border-blue-600 outline-none transition-all font-bold" value={formData.state_id} onChange={e => handleStateCodeChange(e.target.value)} placeholder="01" />
                  <input readOnly className="flex-1 bg-gray-50 border-2 border-transparent rounded-xl p-4 italic text-gray-400 font-medium" value={foundStateName} placeholder="Busca automática..." />
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">UF (Automático)</label>
                  <input readOnly className="w-full border-2 border-transparent bg-gray-50 rounded-xl p-4 text-center uppercase text-blue-600 font-black shadow-inner" maxLength={2} value={formData.uf} placeholder="--" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">CEP</label>
                  <input required className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-blue-600 outline-none transition-all font-bold" value={formData.cep} onChange={e => setFormData({...formData, cep: e.target.value})} placeholder="00000-000" />
                </div>
              </div>

              <div className="md:col-span-2 space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Endereço (Rua/Av)</label>
                  <input required className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-blue-600 outline-none transition-all font-bold" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Ex: Rua das Flores" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Nº</label>
                    <input required className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-blue-600 outline-none transition-all font-bold" value={formData.address_number} onChange={e => setFormData({...formData, address_number: e.target.value})} placeholder="123" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Bairro</label>
                    <input required className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-blue-600 outline-none transition-all font-bold" value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} placeholder="Ex: Centro" />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 flex gap-4 pt-4 border-t border-blue-50 mt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all">{editingId ? 'Confirmar Edição' : 'Salvar Congregação'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="space-y-4">
        {congre.map(c => (
          <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center group hover:border-blue-200 transition-colors gap-4">
            <div className="flex items-start gap-4 flex-1">
              <span className="font-mono bg-gray-50 px-2 py-1 rounded text-blue-600 font-bold border text-sm">{c.id}</span>
              <div>
                <h3 className="font-black text-blue-900 uppercase">{c.name}</h3>
                <p className="text-xs text-gray-500 mt-1 font-medium italic">
                  {c.address}, {c.address_number} • {states.find(s => s.id === c.state_id)?.name || 'Desconhecida'} / {countries.find(co => co.id === c.country_id)?.name || 'Desconhecido'}
                </p>
                <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded tracking-tighter mt-2 inline-block">CEP: {c.cep}</span>
              </div>
            </div>
            <div className="flex gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
              <button onClick={() => startEdit(c)} className="text-blue-600 font-bold uppercase text-[10px] hover:underline">Editar</button>
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
          <button onClick={() => navigate('admin_conductors_report', conductors.map(c => ({ ...c, congregation_name: congregations.find(con => con.id === c.congregation_id)?.name || '-' })))} className="bg-white text-blue-600 border-2 border-blue-100 px-4 py-2 rounded font-bold shadow-sm hover:bg-blue-50 transition-all">Relatório</button>
          {canRegister && (
            <button onClick={() => navigate('admin_new_conductor')} className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow-md">Novo Registro</button>
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
          <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group hover:border-blue-200 transition-colors">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="bg-blue-700 text-white px-2 py-0.5 rounded font-black text-xs">{c.registry_number}</span>
                <h3 className="font-black text-blue-900 uppercase">{c.name}</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {ROLE_LABELS[c.role_code]} • {congregations.find(con => con.id === c.congregation_id)?.name || 'Local não identificado'}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => navigate('admin_crr_card', c)} className="flex-1 bg-blue-50 text-blue-700 px-3 py-1.5 rounded text-[10px] font-black uppercase border border-blue-100">Emitir CRR</button>
              {canEdit && (
                <button onClick={() => navigate('admin_edit_conductor', c)} className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase shadow-sm">Editar</button>
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

const AdminConductorForm = ({ goBack, linkUserBeingApproved, conductorToEdit, onApprovalSuccess }: any) => {
  const isEditing = !!conductorToEdit;
  const isApproving = !!linkUserBeingApproved && !isEditing;

  const [formData, setFormData] = useState({ 
    name: conductorToEdit?.name || linkUserBeingApproved?.name || '', 
    country_id: conductorToEdit?.country_id || '', 
    state_id: conductorToEdit?.state_id || '', 
    congregation_id: conductorToEdit?.congregation_id || '', 
    birth_date: conductorToEdit?.birth_date || linkUserBeingApproved?.birth_date || '', 
    phone: conductorToEdit?.phone || linkUserBeingApproved?.phone || '', 
    email: conductorToEdit?.email || linkUserBeingApproved?.email || '', 
    role_code: (conductorToEdit?.role_code || (linkUserBeingApproved?.role === 'Regente' ? 'T' : 'T')) as any 
  });

  // Sincronização robusta - Força preenchimento automático a partir da solicitação
  useEffect(() => {
    if (isApproving && linkUserBeingApproved) {
      setFormData(prev => ({
        ...prev,
        name: linkUserBeingApproved.name || prev.name,
        birth_date: linkUserBeingApproved.birth_date || prev.birth_date,
        phone: linkUserBeingApproved.phone || prev.phone,
        email: linkUserBeingApproved.email || prev.email,
        role_code: prev.role_code || (linkUserBeingApproved.role === 'Regente' ? 'T' : 'T')
      }));
    }
  }, [linkUserBeingApproved, isApproving]);
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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(linkUserBeingApproved?.id || null);
  const [selectorModal, setSelectorModal] = useState<{ type: 'country' | 'state' | 'congre', list: any[] } | null>(null);
  const [selectorSearch, setSelectorSearch] = useState('');
  const [showApprovalGuide, setShowApprovalGuide] = useState(isApproving);

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
    if (isEditing || isApproving) {
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
      if (linkUserBeingApproved) {
        // Se for uma aprovação, autoriza o usuário no banco de dados primeiro
        const { error: authError } = await supabase.from('users').update({ status: 'authorized' }).eq('id', linkUserBeingApproved.id);
        if (authError) {
          setIsSaving(false);
          alert("Erro ao autorizar usuário: " + authError.message);
          return;
        }
      }

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
        if (onApprovalSuccess) {
           onApprovalSuccess();
        } else {
           goBack();
        }
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
              <p className="text-4xl font-black text-blue-700 tracking-[10px]">{tempPassword}</p>
            </div>
          )}

          <button onClick={() => { if (onApprovalSuccess) onApprovalSuccess(); else goBack(); }} className="w-full bg-blue-700 text-white py-4 rounded-2xl font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-800 transition-all">Concluir e Voltar</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={isEditing ? "Editar Registro" : (isApproving ? "Aprovar Acesso e Cadastro CRR" : "Novo Registro de Regente")} onBack={goBack}>
      <div className="max-w-4xl mx-auto space-y-6">
        {isApproving && linkUserBeingApproved && (
          <div className="sticky top-6 z-30 bg-blue-50 rounded-[32px] p-8 text-black shadow-2xl border-2 border-blue-100 relative overflow-hidden animate-slide-up">
            {/* Background Decorative Element */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/50 rounded-full blur-3xl -mr-32 -mt-32"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight leading-none text-blue-900">Dados da Solicitação</h3>
                  <p className="text-blue-600/60 text-[10px] font-bold uppercase mt-1 tracking-widest italic">Informações enviadas pelo usuário para preenchimento do CRR</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block mb-1">Nome Completo</span>
                  <p className="text-sm font-black truncate text-black">{linkUserBeingApproved.name}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block mb-1">Data de Nasc. (Idade)</span>
                  <p className="text-sm font-black text-black">
                    {linkUserBeingApproved.birth_date ? new Date(linkUserBeingApproved.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/I'} 
                    <span className="ml-2 text-[10px] text-blue-500">({calculateAge(linkUserBeingApproved.birth_date)} anos)</span>
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block mb-1">WhatsApp / E-mail</span>
                  <p className="text-sm font-black truncate text-black">{linkUserBeingApproved.phone || linkUserBeingApproved.email}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block mb-1">Congregação / Cargo</span>
                  <p className="text-xs font-bold leading-tight line-clamp-2 text-black">{linkUserBeingApproved.congregation} <br/><span className="text-blue-600 font-black">{linkUserBeingApproved.role}</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 animate-fade-in relative">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-blue-900 uppercase tracking-tighter">
              {isEditing ? "Atualizar Dados do CRR" : (isApproving ? "Cadastro Obrigatório de CRR" : "Inscrição de Regente Oficial")}
            </h3>
            {isApproving && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase px-3 py-1 rounded-full animate-pulse border border-amber-200">
                Aprovação Pendente
              </span>
            )}
          </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Nome Completo</label>
            <input 
              required 
              readOnly={isApproving}
              className={`w-full border rounded p-3 font-bold ${isApproving ? 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-70' : ''}`} 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="Ex: João da Silva" 
            />
          </div>

          <div className="space-y-4">
            <div className={`p-4 rounded-xl border-2 transition-all ${isApproving ? 'border-blue-500 bg-blue-50/30' : 'border-transparent'}`}>
              <label className="block text-[10px] font-black uppercase text-blue-900 mb-2 flex items-center gap-2">
                {isApproving && <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>}
                País (Cód)
              </label>
              <div className="flex gap-2">
                <div className="relative">
                  <input required className="w-16 border rounded p-2 text-center font-mono focus:ring-2 focus:ring-blue-500" value={formData.country_id} onChange={e => lookup('country_id', e.target.value)} placeholder="01" />
                  <button type="button" onClick={() => { setSelectorModal({ type: 'country', list: countries }); setSelectorSearch(''); }} className="absolute -right-2 -top-2 bg-blue-600 text-white p-1 rounded-full shadow-sm hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </button>
                </div>
                <input readOnly className="flex-1 bg-gray-50 border rounded p-2 text-xs italic text-gray-400" value={foundNames.country} placeholder="Busca automática..." />
              </div>
            </div>
            <div className={`p-4 rounded-xl border-2 transition-all ${isApproving ? 'border-blue-500 bg-blue-50/30' : 'border-transparent'}`}>
              <label className="block text-[10px] font-black uppercase text-blue-900 mb-2 flex items-center gap-2">
                {isApproving && <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>}
                Estado (Cód)
              </label>
              <div className="flex gap-2">
                <div className="relative">
                  <input required className="w-16 border rounded p-2 text-center font-mono focus:ring-2 focus:ring-blue-500" value={formData.state_id} onChange={e => lookup('state_id', e.target.value)} placeholder="01" />
                  <button type="button" onClick={() => { setSelectorModal({ type: 'state', list: states }); setSelectorSearch(''); }} className="absolute -right-2 -top-2 bg-blue-600 text-white p-1 rounded-full shadow-sm hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </button>
                </div>
                <input readOnly className="flex-1 bg-gray-50 border rounded p-2 text-xs italic text-gray-400" value={foundNames.state} placeholder="Busca automática..." />
              </div>
            </div>
            <div className={`p-4 rounded-xl border-2 transition-all ${isApproving ? 'border-blue-500 bg-blue-50/30' : 'border-transparent'}`}>
              <label className="block text-[10px] font-black uppercase text-blue-900 mb-2 flex items-center gap-2">
                {isApproving && <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>}
                Congregação (Cód)
              </label>
              <div className="flex gap-2">
                <div className="relative">
                  <input required className="w-20 border rounded p-2 text-center font-mono focus:ring-2 focus:ring-blue-500" value={formData.congregation_id} onChange={e => lookup('congregation_id', e.target.value)} placeholder="0001" />
                  <button type="button" onClick={() => { setSelectorModal({ type: 'congre', list: congre }); setSelectorSearch(''); }} className="absolute -right-2 -top-2 bg-blue-600 text-white p-1 rounded-full shadow-sm hover:scale-110 transition-transform">
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
                <input 
                  required 
                  type="date" 
                  readOnly={isApproving}
                  className={`flex-1 border rounded p-2 ${isApproving ? 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-70' : ''}`} 
                  value={formData.birth_date} 
                  onChange={e => setFormData({...formData, birth_date: e.target.value})} 
                />
                <div className="bg-blue-50 px-3 py-2 rounded text-blue-700 font-black text-xs text-center border border-blue-100 min-w-[60px]">
                  {calculateAge(formData.birth_date)} <br/> ANOS
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">Telefone</label>
              <input 
                required 
                readOnly={isApproving}
                className={`w-full border rounded p-2 ${isApproving ? 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-70' : ''}`} 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
                placeholder="(00) 00000-0000" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-900 mb-1">E-mail</label>
              <input 
                required 
                type="email" 
                readOnly={isApproving}
                className={`w-full border rounded p-2 ${isApproving ? 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-70' : ''}`} 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                placeholder="email@exemplo.com" 
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-black uppercase text-gray-900 mb-2">Cargo Específico</label>
            <select 
              required 
              className="w-full border rounded p-3 font-bold bg-blue-50 border-blue-100" 
              value={formData.role_code} 
              onChange={e => setFormData({...formData, role_code: e.target.value as any})}
            >
              <option value="S">S - Regente da Sede</option>
              <option value="I">I - Regente Itinerante</option>
              <option value="R">R - Regente Regional</option>
              <option value="T">T - Regente Titular</option>
              <option value="TG">TG - Regente Titular de Gênero</option>
            </select>
          </div>

          <div className="md:col-span-2 flex gap-4 mt-4 pt-6 border-t">
            <button type="submit" disabled={isSaving} className={`flex-1 bg-blue-700 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-blue-100 transition-all active:scale-95 ${isSaving ? 'opacity-50' : 'hover:bg-blue-800'}`}>
              {isSaving ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Concluir Registro')}
            </button>
            <button type="button" onClick={goBack} className="px-8 bg-gray-50 text-gray-400 font-bold uppercase text-[10px] rounded-xl hover:bg-gray-100">Cancelar</button>
          </div>
        </form>

        {showLinkModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
              <div className="p-8">
                <h3 className="text-xl font-black text-blue-900 uppercase mb-2">Vincular Usuário?</h3>
                <p className="text-gray-500 text-sm mb-6">Deseja vincular este novo registro a um usuário já cadastrado no sistema ou gerar uma nova conta?</p>
                
                <div className="flex flex-col gap-3">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black uppercase text-blue-400 mb-3">Usuários sem CRR vinculado</p>
                    <input 
                      type="text" 
                      placeholder="Buscar por nome ou e-mail..." 
                      className="w-full border rounded-xl p-3 text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {users
                        .filter(u => u.email !== 'Admin' && !conductors.some(c => c.email === u.email))
                        .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(u => (
                          <label key={u.id} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedUserId === u.id ? 'border-blue-600 bg-blue-100/50' : 'border-transparent bg-white hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                              <input 
                                type="radio" 
                                name="linkUser" 
                                className="w-4 h-4 text-blue-600" 
                                checked={selectedUserId === u.id}
                                onChange={() => setSelectedUserId(u.id)}
                              />
                              <div>
                                <p className="text-xs font-bold text-gray-900">{u.name}</p>
                                <p className="text-[10px] text-gray-400">{u.email}</p>
                              </div>
                            </div>
                            <span className="text-[9px] font-black uppercase text-blue-400 bg-blue-50 px-2 py-1 rounded">{u.congregation}</span>
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
                      className={`py-4 rounded-2xl font-black uppercase text-xs transition-all ${selectedUserId ? 'bg-blue-700 text-white shadow-lg shadow-blue-100 hover:bg-blue-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                      Vincular Selecionado
                    </button>
                    <button 
                      onClick={() => executeRegistration()}
                      className="bg-white border-2 border-blue-600 text-blue-600 py-4 rounded-2xl font-black uppercase text-xs hover:bg-blue-50 transition-all"
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
              <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
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
                  className="w-full border-2 border-blue-50 rounded-xl p-3 mb-4 focus:border-blue-600 outline-none font-bold uppercase text-xs"
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
                        className="w-full text-left p-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-between group"
                      >
                        <span className="font-bold text-gray-700 group-hover:text-blue-700">{item.name}</span>
                        <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded font-mono text-[10px] group-hover:bg-blue-100 group-hover:text-blue-600 font-bold">{item.id}</span>
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

  return (
    <div className="min-h-screen bg-gray-200 pb-20 no-print flex flex-col items-center">
      <div className="mb-4 mt-8 flex gap-4 no-print flex-wrap justify-center sticky top-4 z-[100] bg-gray-200/80 backdrop-blur-sm p-4 rounded-3xl shadow-sm">
        <button onClick={goBack} className="bg-gray-700 text-white px-6 py-2 rounded-full font-bold transition-all hover:bg-gray-800 active:scale-95">Voltar</button>
        <button onClick={() => navigate('admin_edit_conductor', conductor)} className="bg-amber-600 text-white px-6 py-2 rounded-full font-bold shadow-lg transition-all hover:bg-amber-700 active:scale-95">Editar Informações</button>
        <button onClick={() => downloadHTML('crr-card-mirror', `CRR-${conductor.registry_number}.html`)} className="bg-gray-700 text-white px-6 py-2 rounded-full font-bold transition-all hover:bg-gray-800 active:scale-95">Offline (HTML)</button>
        <button onClick={() => downloadDirectPDF('crr-card-mirror', `CRR-${conductor.registry_number}.pdf`, 'landscape')} className="bg-emerald-600 text-white px-8 py-2 rounded-full font-bold shadow-lg transition-all hover:bg-emerald-700 active:scale-95 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Baixar Direto
        </button>
        <button onClick={() => downloadPDF('crr-card-mirror', `CRR-${conductor.registry_number}.pdf`, 'landscape')} className="bg-blue-600 text-white px-8 py-2 rounded-full font-bold shadow-lg transition-all hover:bg-blue-700 active:scale-95 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir
        </button>
      </div>

      <div id="crr-card-mirror" className="page-container">
        {/* Folha A4 Landscape */}
        <div className="page landscape flex items-center justify-center relative">
          <div className="absolute top-10 left-10 text-[8px] font-bold text-gray-300 uppercase tracking-widest">
            Ficha de Identificação Individual • Documento Gerado via CORUS
          </div>

          <div id="crr-card-body" className="w-[95mm] h-[65mm] bg-white relative overflow-hidden flex flex-col border border-gray-400 rounded-[2mm] font-sans shadow-2xl">
        
        {/* Cabeçalho Oficial Centralizado com Logo */}
        <div className="bg-white py-2 border-b border-blue-100 flex items-center justify-center">
          <img 
            src="https://i.postimg.cc/jqgVRN03/image-removebg-preview-(1).png" 
            alt="logo" 
            className="h-[32px] w-auto object-contain" 
          />
        </div>

        {/* Faixa de Título */}
        <div className="bg-blue-900 text-white py-1.5 text-center">
          <h2 className="text-[11px] font-black uppercase tracking-[2px]">Registro de Regente</h2>
        </div>

        {/* CORPO DA CARTEIRINHA: Marca d'água centralizada por baixo dos dados */}
        <div className="flex-1 relative flex flex-col">
          {/* Marca D'água Centralizada no Corpo Inteiro (Atrás do texto) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <img 
              src="https://i.postimg.cc/05VH1sRM/Gemini-Generated-Image-bv56m6bv56m6bv56-removebg-preview.png" 
              alt="watermark" 
              className="w-72 opacity-[0.25] pointer-events-none"
              style={{ transform: 'translateY(-4mm)' }}
            />
          </div>

          <div className="flex-1 p-4 flex flex-col justify-between relative z-10 group overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <div className="flex justify-between items-end border-b border-blue-100 pb-1 mb-4">
                <div className="flex-1 min-w-0">
                  <span className="text-[6px] font-black text-gray-900 uppercase block leading-none">Identificação do Regente</span>
                  <p className="text-[12px] font-black uppercase text-gray-900 leading-tight break-words">{conductor.name}</p>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <span className="text-[6px] font-black text-gray-900 uppercase block leading-none">Nº Registro (CRR)</span>
                  <p className="text-[12px] font-black text-blue-950 tracking-[1.5px] leading-none">
                    {conductor.registry_number}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                <div>
                  <span className="text-[6px] font-black text-gray-900 uppercase block leading-none mb-0.5">Cargo / Função</span>
                  <p className="text-[9px] font-black uppercase text-blue-900 leading-tight">{ROLE_LABELS[conductor.role_code] || 'Regente'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[6px] font-black text-gray-900 uppercase block leading-none mb-0.5">Data de Nascimento</span>
                  <p className="text-[9px] font-bold text-gray-700">{conductor.birth_date ? new Date(conductor.birth_date).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-[6px] font-black text-gray-900 uppercase block leading-none mb-0.5">Congregação</span>
                  <p className="text-[10px] font-bold uppercase text-gray-800 leading-tight">{congregationName}</p>
                </div>
              </div>
            </div>

            {/* Rodapé: Assinatura (Fixo no rodapé do container pai flex) */}
            <div className="shrink-0 mt-auto pt-2 border-t border-gray-100 flex items-end justify-center">
              <div className="flex-1 max-w-[70%] flex flex-col items-center">
                <div className="w-full border-t border-gray-400 mt-6 mb-1"></div>
                <p className="text-[7px] font-black text-blue-900 uppercase tracking-tighter text-center leading-tight">
                  Presidente do Conselho Deliberativo
                </p>
              </div>
            </div>
          </div>
      </div>

        {/* Elementos Estéticos de Segurança */}
        <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-900 opacity-[0.03]"></div>
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-900 opacity-[0.03]"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-900"></div>
          <div className="absolute bottom-10 right-10 text-[8px] font-black text-blue-900/40 uppercase tracking-widest text-right">
            Validado Digitalmente<br/>Pelo Gestor CORUS
          </div>
        </div>
      </div>
    </div>

      <p className="mt-8 text-xs text-gray-500 max-w-sm text-center font-medium no-print">
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

  const sortedInstruments = useMemo(() => {
    return [...instruments].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [instruments]);

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
      <div className="sticky top-[60px] z-20 bg-gray-50/95 backdrop-blur-sm shadow-sm -mx-4 px-4 py-4 mb-6 -mt-4 flex justify-between items-center border-b border-gray-100">
        <h2 className="text-lg font-semibold">Instrumentos Cadastrados</h2>
        {!isReadOnly && (
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('instruments_report')} 
              className="bg-white text-blue-600 border-2 border-blue-100 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all shadow-sm flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M9 11h6"/><path d="M9 19h10"/></svg>
              Relatório
            </button>
            <button onClick={() => { setEditingId(null); setFormData({ name: '', modality: 'Metal', timbre: 'Sol', tuning: '' }); setSaveError(null); setShowForm(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all">Novo Instrumento</button>
          </div>
        )}
      </div>
      {instrumentToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-gray-900 leading-tight">Deseja Excluir o Instrumento {instrumentToDelete.name} Permanentemente?</h3>
            <div className="flex gap-4">
              <button onClick={confirmDelete} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md">Sim</button>
              <button onClick={() => setInstrumentToDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors">Não</button>
            </div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl animate-scale-up border border-blue-100">
            <div className="flex justify-between items-center mb-6 border-b border-blue-50 pb-4">
              <h3 className="font-black text-xs uppercase text-blue-900 tracking-widest">{editingId ? 'Editar Instrumento' : 'Novo Instrumento'}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {saveError && (
              <div className="mb-6 bg-red-50 border-2 border-red-100 p-4 rounded-xl flex items-center gap-3 animate-slide-down">
                <div className="bg-red-500 text-white rounded-full p-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                <span className="text-red-700 font-bold text-xs uppercase tracking-tight">{saveError}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Nome do Instrumento</label>
                <input required autoFocus placeholder="Nome" className={`w-full border-2 rounded-xl p-4 font-bold focus:border-blue-600 outline-none transition-all ${saveError ? 'border-red-500 bg-red-50' : 'border-gray-100'}`} value={formData.name} onChange={e => { setFormData({...formData, name: e.target.value}); setSaveError(null); }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Modalidade</label>
                  <select className="w-full border-2 border-gray-100 rounded-xl p-4 font-bold focus:border-blue-600 outline-none" value={formData.modality} onChange={e => setFormData({...formData, modality: e.target.value as any})}>
                    <option value="Metal">Metal</option><option value="Palheta">Palheta</option><option value="Cordas">Cordas</option><option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Clave</label>
                  <select className="w-full border-2 border-gray-100 rounded-xl p-4 font-bold focus:border-blue-600 outline-none" value={formData.timbre} onChange={e => setFormData({...formData, timbre: e.target.value as any})}>
                    <option value="Sol">Sol</option>
                    <option value="Fá">Fá</option>
                    <option value="Dó">Dó</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Afinação (Sib, Do...)</label>
                <input required placeholder="Afinação" className={`w-full border-2 rounded-xl p-4 font-bold focus:border-blue-600 outline-none transition-all ${saveError ? 'border-red-500 bg-red-50' : 'border-gray-100'}`} value={formData.tuning} onChange={e => { setFormData({...formData, tuning: e.target.value}); setSaveError(null); }} />
              </div>
              <div className="flex gap-4 pt-4 border-t border-blue-50">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all">{editingId ? 'Atualizar' : 'Salvar'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {sortedInstruments.map(i => (
          <div key={i.id} className="p-4 border-b last:border-0 flex justify-between items-center hover:bg-gray-50 group">
            <div><p className="font-bold text-gray-800">{i.name}</p><p className="text-xs text-gray-500 uppercase font-bold">{i.modality} • {i.timbre} • {i.tuning}</p></div>
            {!isReadOnly && (
              <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(i)} className="text-blue-600 font-bold hover:underline">Editar</button>
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
      <div className="sticky top-[60px] z-20 bg-gray-50/95 backdrop-blur-sm shadow-sm -mx-4 px-4 py-4 mb-6 -mt-4 flex justify-between items-center border-b border-gray-100">
        <h2 className="text-lg font-semibold">Integrantes</h2>
        {!isReadOnly && (
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('musicians_report')} 
              className="bg-white text-blue-600 border-2 border-blue-100 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all shadow-sm flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M9 11h6"/><path d="M9 19h10"/></svg>
              Relatório
            </button>
            <button onClick={() => { setEditingId(null); setFormData({ name: '', voices: [], instruments: [] }); setSaveError(null); setShowForm(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all">Novo Integrante</button>
          </div>
        )}
      </div>
      {musicianToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-gray-900 leading-tight">Deseja Excluir o Musico {musicianToDelete.name} Permanentemente?</h3>
            <div className="flex gap-4">
              <button onClick={confirmDelete} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md">Sim</button>
              <button onClick={() => setMusicianToDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors">Não</button>
            </div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-lg shadow-2xl animate-scale-up border border-blue-100 overflow-y-auto max-h-[90vh] custom-scrollbar-heavy">
            <div className="flex justify-between items-center mb-6 border-b border-blue-50 pb-4">
              <h3 className="font-black text-xs uppercase text-blue-900 tracking-widest">{editingId ? 'Editar Integrante' : 'Novo Integrante'}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {saveError && (
              <div className="mb-6 bg-red-50 border-2 border-red-100 p-4 rounded-xl flex items-center gap-3 animate-slide-down">
                <div className="bg-red-500 text-white rounded-full p-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                <span className="text-red-700 font-bold text-xs uppercase tracking-tight">{saveError}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Nome Completo</label>
                <input required autoFocus placeholder="Nome Completo" className="w-full border-2 border-gray-100 rounded-xl p-4 font-bold focus:border-blue-600 outline-none transition-all" value={formData.name} onChange={e => { setFormData({...formData, name: e.target.value}); setSaveError(null); }} />
              </div>
              
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">Vozes do Integrante</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Melodia', 'Contralto', 'Tenor', 'Baixo'].map(v => (
                    <button key={v} type="button" onClick={() => toggleVoice(v)} className={`px-4 py-3 rounded-xl border-2 transition-all font-bold text-sm ${formData.voices.includes(v) ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'}`}>{v}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">Selecione os Instrumentos</p>
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-50">
                  <select className="w-full border-2 border-white rounded-xl p-4 mb-4 font-bold focus:border-blue-600 outline-none shadow-sm" onChange={e => addInstrument(e.target.value)}>
                    <option value="">Adicionar novo instrumento...</option>
                    {[...instruments].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(i => <option key={i.id} value={i.id}>{i.name} ({i.tuning})</option>)}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    {formData.instruments.map(id => (
                      <span key={id} className="bg-white px-4 py-2 rounded-full text-[10px] font-black uppercase text-blue-700 border-2 border-blue-100 flex items-center gap-2 shadow-sm animate-scale-up">
                        {instruments.find(i => i.id === id)?.name}
                        <button type="button" onClick={() => removeInstrument(id)} className="bg-red-50 text-red-500 rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">×</button>
                      </span>
                    ))}
                    {formData.instruments.length === 0 && <p className="text-[10px] text-blue-300 font-bold uppercase italic py-2">Nenhum instrumento selecionado</p>}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-blue-50">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all">{editingId ? 'Atualizar Integrante' : 'Salvar Cadastro'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
              </div>
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
                <button onClick={() => handleEdit(m)} className="text-blue-600 font-bold hover:underline">Editar</button>
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
  const [group, setGroup] = useState<'Coral' | 'Orquestra' | 'Geral' | 'Outro'>('Geral');

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
              <option value="Outro">Outro (Personalizada)</option>
            </select>
          </div>
          <div><label className="block text-base font-bold mb-2 text-gray-950">Tipo</label><select className="w-full border rounded-xl p-3 text-base shadow-sm" value={type} onChange={e => setType(e.target.value as any)}>
            <option value="Todos">Todos</option>
            <option value="Somente Presentes">Somente Presentes</option>
            <option value="Somente Ausentes">Somente Ausentes</option>
            <option value="Somente Justificadas">Somente Justificadas</option>
          </select></div>
          <div className="flex justify-end gap-2 pt-4"><button onClick={onCancel} className="px-4 py-2 font-bold text-gray-500">Voltar</button><button onClick={() => onGenerate(start, end, type, group)} className="bg-blue-600 text-white px-6 py-2 rounded font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all">Visualizar Relatório</button></div>
        </div>
      </div>
    </Layout>
  );
};

const RollCallScreen = ({ goBack, editData, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(editData?.presentMusicianIds || []));
  const [justifications, setJustifications] = useState<Record<string, string>>(editData?.justifications || {});
  const [filterGroup, setFilterGroup] = useState<'Coral' | 'Orquestra' | 'Geral' | 'Outro' | null>(editData?.group || null);
  const [showSelection, setShowSelection] = useState(false);
  const [customSelectedIds, setCustomSelectedIds] = useState<Set<string>>(new Set(editData?.subset_ids || []));
  const [selectionSearch, setSelectionSearch] = useState('');
  
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
    } else if (showSelection) {
      setShowSelection(false);
      setFilterGroup(null);
    } else if (filterGroup && !editData) {
      setFilterGroup(null);
      setCustomSelectedIds(new Set());
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

  const handleSaveClick = () => { if (isReadOnly) return; setSaveError(null); setShowDateModal(true); };

  const confirmSave = async () => {
    if (isReadOnly) return;
    const all = await fetchData('attendance', 'gca_attendance', ownerEmail);
    const currentGroup = editData?.group || (filterGroup as any);
    const exists = currentGroup !== 'Outro' && all.some((r: AttendanceRecord) => r.date === date && r.group === currentGroup && r.id !== editData?.id);
    if (exists) { setSaveError(`Já Existe Uma Chamada de ${currentGroup} Nesta Data`); return; }
    const record: AttendanceRecord = { 
        id: editData?.id || generateId(), 
        date, 
        presentMusicianIds: Array.from(selected), 
        justifications,
        group: currentGroup,
        subset_ids: filterGroup === 'Outro' ? Array.from(customSelectedIds) : undefined,
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
        <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-xl border-t-8 border-blue-600 animate-slide-up text-center">
           <h3 className="text-xl font-black text-blue-900 uppercase mb-8">O que deseja realizar hoje?</h3>
           <div className="grid grid-cols-1 gap-4 uppercase font-black text-xs">
              <button 
                onClick={() => setFilterGroup('Coral')}
                className="bg-blue-50 text-blue-700 p-6 rounded-2xl border-2 border-blue-100 hover:bg-blue-100 transition-all flex flex-col items-center gap-2"
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
              <button 
                onClick={() => { setFilterGroup('Outro'); setShowSelection(true); }}
                className="bg-purple-50 text-purple-700 p-6 rounded-2xl border-2 border-purple-100 hover:bg-purple-100 transition-all flex flex-col items-center gap-2"
              >
                <span className="text-2xl">📝</span>
                Outro (Escolha Personalizada)
              </button>
           </div>
        </div>
      </Layout>
    );
  }

  if (filterGroup === 'Outro' && showSelection) {
    const filteredForSelection = musicians.filter(m => 
      m.name.toLowerCase().includes(selectionSearch.toLowerCase()) ||
      (m.voices && m.voices.some(v => v.toLowerCase().includes(selectionSearch.toLowerCase()))) ||
      (m.instruments && m.instruments.some(i => i.toLowerCase().includes(selectionSearch.toLowerCase())))
    ).sort((a,b) => a.name.localeCompare(b.name));

    const toggleSelection = (id: string) => {
      const next = new Set(customSelectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setCustomSelectedIds(next);
    };

    const toggleAll = () => {
      if (customSelectedIds.size === musicians.length) {
        setCustomSelectedIds(new Set());
      } else {
        setCustomSelectedIds(new Set(musicians.map(m => m.id)));
      }
    };

    return (
      <Layout title="Selecionar Integrantes" onBack={handleBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
        <div className="max-w-2xl mx-auto mt-6 bg-white p-6 rounded-3xl shadow-xl flex flex-col h-[80vh]">
          <div className="mb-6 space-y-4">
            <h3 className="text-lg font-black text-blue-900 uppercase">Quem participará desta chamada?</h3>
            <div className="relative">
              <input 
                type="text"
                placeholder="Pesquisar por nome, voz ou instrumento..."
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:border-blue-500 transition-all"
                value={selectionSearch}
                onChange={e => setSelectionSearch(e.target.value)}
              />
              <svg className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <span className="text-xs font-black text-blue-900 uppercase">{customSelectedIds.size} Selecionados</span>
              <button 
                onClick={toggleAll}
                className="text-[10px] font-black uppercase text-blue-600 hover:underline"
              >
                {customSelectedIds.size === musicians.length ? 'Desmarcar Todos' : 'Marcar Todos'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
            {filteredForSelection.map(m => (
              <div 
                key={m.id} 
                onClick={() => toggleSelection(m.id)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${customSelectedIds.has(m.id) ? 'border-blue-500 bg-blue-50/50' : 'border-gray-50 bg-white'}`}
              >
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${customSelectedIds.has(m.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-200'}`}>
                  {customSelectedIds.has(m.id) && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-gray-900 truncate">{m.name}</p>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest truncate">
                    {m.voices.join(', ') || m.instruments.join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button 
            disabled={customSelectedIds.size === 0}
            onClick={() => setShowSelection(false)}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl mt-6 font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
          >
            Continuar para Chamada
          </button>
        </div>
      </Layout>
    );
  }

  const filteredMusicians = musicians.filter(m => {
    if (filterGroup === 'Coral') return m.voices && m.voices.length > 0;
    if (filterGroup === 'Orquestra') return m.instruments && m.instruments.length > 0;
    if (filterGroup === 'Outro') return customSelectedIds.has(m.id);
    return true;
  });

  return (
    <Layout title={editData ? "Editar Chamada" : "Lista de Chamada"} onBack={handleBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
      <div className="bg-white p-6 rounded-lg shadow min-h-[60vh] flex flex-col">
        <div className="sticky top-[76px] z-30 bg-white shadow-md rounded-xl p-4 mb-6 border border-blue-50 flex justify-between items-center">
           <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest leading-tight">Escolha os Presentes {filterGroup ? `(${filterGroup})` : ''}</h3>
           <div className="flex gap-2 items-center">
             {filterGroup && !editData && (
               <button onClick={() => setFilterGroup(null)} className="text-sm font-bold text-blue-600 bg-blue-50 px-5 py-2.5 rounded-xl hover:bg-blue-100 transition-colors border border-blue-100">Trocar Filtro</button>
             )}
             {!isReadOnly && <button onClick={handleSaveClick} className="bg-blue-600 text-white px-7 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all">Salvar Chamada</button>}
           </div>
        </div>
        <div className="grid grid-cols-1 gap-4 flex-1">
          {filteredMusicians.sort((a,b) => a.name.localeCompare(b.name)).map(m => {
            const isPresent = selected.has(m.id);
            const hasJustify = !!justifications[m.id];
            
            return (
              <div key={m.id} className="p-4 border rounded bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm relative overflow-hidden">
                <div className="flex-1">
                    <p className="font-bold text-lg text-gray-800">{m.name}</p>
                    <p className="text-sm text-blue-600 font-medium uppercase tracking-wider">{m.voices.join(' / ')}</p>
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
        {!isReadOnly && <button onClick={handleSaveClick} className="w-full bg-blue-600 text-white py-3 rounded mt-8 font-bold text-lg shadow-lg active:scale-95 transition-transform">Salvar Chamada</button>}
      </div>

      {/* Modal Justificativa (Input) */}
      {activeJustifyId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[110] backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
                <h3 className="text-xl font-black text-blue-900 uppercase mb-4">Informar Justificativa</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Mínimo 10 caracteres</p>
                {justifyError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold mb-4 border-l-4 border-red-500">{justifyError}</div>}
                <textarea 
                    autoFocus
                    className={`w-full border-2 rounded-xl p-3 h-32 focus:ring-2 focus:ring-blue-500 outline-none transition-all ${justifyError ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}
                    placeholder="Escreva aqui o motivo da ausência..."
                    value={justifyInputText}
                    onChange={e => { setJustifyInputText(e.target.value); setJustifyError(null); }}
                />
                <div className="flex gap-4 mt-6">
                    <button onClick={saveJustify} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">Salvar</button>
                    <button onClick={() => setActiveJustifyId(null)} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black uppercase hover:bg-gray-200 transition-all">Cancelar</button>
                </div>
            </div>
        </div>
      )}

      {/* Modal Justificativa (View/Edit) */}
      {viewJustifyId && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[120] backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-scale-up">
                  <h3 className="text-2xl font-black text-blue-900 uppercase mb-6 border-b pb-4">Detalhamento</h3>
                  
                  {isEditingJustify ? (
                      <div className="space-y-4">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Editando justificativa</p>
                          {justifyError && <div className="bg-red-50 text-red-600 p-2 rounded-lg text-xs font-bold mb-4 border-l-4 border-red-500">{justifyError}</div>}
                          <textarea 
                              className="w-full border-2 border-blue-100 rounded-2xl p-4 h-40 focus:ring-2 focus:ring-blue-500 outline-none"
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
                        <div className="bg-blue-50/50 p-6 rounded-2xl mb-8 border border-blue-50 min-h-[120px]">
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
          <div className="fixed inset-0 bg-blue-900/40 flex items-center justify-center p-4 z-[130] backdrop-blur-md">
              <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m10.7 18.8 6-6a2 2 0 0 0 0-2.8l-6-6M4.3 12h13.4"/></svg>
                  </div>
                  <h4 className="text-lg font-black text-gray-900 uppercase mb-4 leading-tight">Tem certeza que deseja editar justificativa?</h4>
                  <div className="flex gap-3">
                      <button onClick={confirmUpdateJustify} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black uppercase">Sim, alterar</button>
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
            <input type="date" className={`w-full border rounded p-2 mb-6 text-lg focus:ring-2 focus:ring-blue-500 outline-none ${saveError ? 'border-red-500 bg-red-50' : ''}`} value={date} onChange={e => { setDate(e.target.value); setSaveError(null); }} />
            <div className="flex justify-end gap-3"><button onClick={() => setShowDateModal(false)} className="px-4 py-2 font-semibold text-gray-500">Cancelar</button><button onClick={confirmSave} className="px-6 py-2 bg-blue-600 text-white rounded font-bold shadow-md hover:bg-blue-700">Confirmar</button></div>
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
  const [filterGroup, setFilterGroup] = useState<'Coral' | 'Orquestra' | 'Geral' | 'Outro' | 'Todos'>('Todos');

  const getGroupLabel = (g?: string) => {
    if (g === 'Coral') return 'Ensaios de Coral';
    if (g === 'Orquestra') return 'Ensaio de Orquestra';
    if (g === 'Geral') return 'Ensaio Geral';
    if (g === 'Outro') return 'Ensaio Outros';
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
        <div className="sticky top-[60px] z-20 bg-gray-50 shadow-sm -mx-4 px-4 py-4 mb-6 -mt-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest">Filtro Rápido</h3>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide justify-center">
            {['Todos', 'Geral', 'Coral', 'Orquestra', 'Outro'].map((g) => (
              <button
                key={g}
                onClick={() => setFilterGroup(g as any)}
                className={`px-7 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap border-2 ${filterGroup === g ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' : 'bg-white text-gray-400 border-transparent hover:border-gray-200'}`}
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
                <button onClick={confirmDelete} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md">Sim</button>
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
              <div className={`absolute top-0 left-0 w-full h-1 ${r.group === 'Coral' ? 'bg-blue-500' : r.group === 'Orquestra' ? 'bg-amber-500' : 'bg-gray-500'}`}></div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4 gap-4">
                <div>
                  <h3 className="font-black text-2xl text-blue-900">{new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                  <span className={`inline-block mt-1 text-sm font-black uppercase px-3 py-1 rounded ${r.group === 'Coral' ? 'bg-blue-50 text-blue-600' : r.group === 'Orquestra' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-600'}`}>
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
  const [group, setGroup] = useState<'Coral' | 'Orquestra' | 'Geral' | 'Outro'>('Geral');
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
              <option value="Outro">Outro (Personalizada)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4"><button onClick={onCancel} className="px-4 py-2 font-bold text-gray-500">Voltar</button><button onClick={() => onGenerate(start, end, group)} className="bg-blue-600 text-white px-6 py-2 rounded font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all">Gerar Relatório</button></div>
        </div>
      </div>
    </Layout>
  );
};

const HymnsLibraryScreen = ({ navigate, goBack, ownerEmail, isReadOnly, onExitImpersonation }: any) => (
  <Layout title="Biblioteca de Hinos" onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 mt-4">
      {Object.entries(NOTEBOOKS).map(([code, name]) => (
        <button key={code} onClick={() => navigate('notebook_detail', { code, name })} className="bg-white border p-4 rounded-lg flex flex-col items-center hover:shadow-md transition-shadow h-full">
          <span className="text-2xl font-bold text-blue-700">{code}</span><span className="text-[10px] text-center uppercase font-bold mt-1 leading-tight">{name}</span>
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
      <div className="sticky top-[60px] z-20 bg-gray-50/95 backdrop-blur-sm shadow-sm -mx-4 px-4 py-4 mb-6 -mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-gray-100">
        <div className="relative w-full sm:w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Filtrar hinos..." className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-100 rounded-xl font-bold focus:border-blue-600 outline-none transition-all placeholder:text-gray-300 shadow-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => navigate('hymn_notebook_report', notebook)} className="flex-1 sm:flex-none bg-white text-blue-600 border-2 border-blue-100 px-7 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-blue-50 transition-all">Relatório</button>
          {!isReadOnly && <button onClick={() => { setEditingId(null); setFormData({ number: '', title: '' }); setValidationError(false); setShowForm(true); }} className="flex-1 sm:flex-none bg-blue-600 text-white px-7 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all">Cadastrar Novo</button>}
        </div>
      </div>
      {hymnToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-gray-900 leading-tight">Deseja Excluir o Cadastro do Hino {hymnToDelete.number} - {hymnToDelete.title} Permanentemente?</h3>
            <div className="flex gap-4"><button onClick={confirmDelete} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold shadow-md">Sim</button><button onClick={() => setHymnToDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg font-bold">Não</button></div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-lg shadow-2xl animate-scale-up border border-blue-100">
            <div className="flex justify-between items-center mb-6 border-b border-blue-50 pb-4">
              <h3 className="font-black text-xs uppercase text-blue-900 tracking-widest">{editingId ? 'Editar Hino' : 'Adicionar Hino'}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); setValidationError(false); setStartZeroError(false); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            {validationError && (
              <div className="mb-6 bg-red-50 border-2 border-red-100 p-4 rounded-xl flex items-center gap-3 animate-slide-down">
                <div className="bg-red-500 text-white rounded-full p-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                <span className="text-red-700 font-bold text-xs uppercase tracking-tight">Número ou Título Já Cadastrado</span>
              </div>
            )}
            
            {startZeroError && (
              <div className="mb-6 bg-amber-50 border-2 border-amber-100 p-4 rounded-xl flex items-center gap-3 animate-slide-down">
                <div className="bg-amber-500 text-white rounded-full p-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                <span className="text-amber-700 font-bold text-xs uppercase tracking-tight">O número não pode começar com zero</span>
              </div>
            )}

            <form onSubmit={saveHymn} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Nº</label>
                  <input required autoFocus placeholder="Nº" className={`w-full border-2 rounded-xl p-4 font-black text-center text-blue-600 focus:border-blue-600 outline-none transition-all ${validationError || startZeroError ? 'border-red-500 bg-red-50' : 'border-gray-100'}`} value={formData.number} onChange={e => { setFormData({...formData, number: e.target.value}); setValidationError(false); setStartZeroError(false); }} />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-black uppercase text-gray-900 mb-2 tracking-widest">Título do Hino</label>
                  <input required placeholder="Título" className={`w-full border-2 rounded-xl p-4 font-bold focus:border-blue-600 outline-none transition-all ${validationError ? 'border-red-500 bg-red-50' : 'border-gray-100'}`} value={formData.title} onChange={e => { setFormData({...formData, title: e.target.value}); setValidationError(false); }} />
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all">{editingId ? 'Atualizar' : 'Salvar'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setValidationError(false); setStartZeroError(false); }} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filtered.map(h => (
          <div key={h.id} className="flex justify-between items-center p-4 border-b last:border-0 hover:bg-gray-50 group">
            <div className="flex items-center gap-4"><span className="font-bold text-blue-700 text-lg w-12">{h.number}</span><span className="font-medium">{h.title}</span></div>
            {!isReadOnly && (
              <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingId(h.id); setFormData({ number: h.number, title: h.title }); setValidationError(false); setShowForm(true); }} className="text-blue-600 font-bold hover:underline">Editar</button>
                <button onClick={() => setHymnToDelete(h)} className="text-red-400 font-bold hover:underline">Excluir</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
};

const ProgramsScreen = ({ navigate, goBack, ownerEmail, isReadOnly, onExitImpersonation }: any) => (
  <Layout title="Programações" onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
      <MenuCard title="Orientações" desc="Regras de elaboração" icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>} onClick={() => navigate('guidelines')} />
      <MenuCard title="Nova Lista" desc="Gerar programa de hinos" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/></svg>} onClick={() => navigate('hymn_lists')} />
      <MenuCard title="Relações de Hinos" desc="Hinos para datas festivas" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>} onClick={() => navigate('hymn_relations_dashboard')} />
      <MenuCard title="Relatórios de Hinos" desc="Uso de hinos por período" icon={<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 18v-4"/><path d="M12 18v-7"/><path d="M16 18v-2"/></svg>} onClick={() => navigate('hymn_report_input')} />
    </div>
  </Layout>
);

const GuidelinesScreen = ({ goBack, onExitImpersonation }: any) => (
  <Layout title="Diretrizes de Programação" onBack={goBack} onExitImpersonation={onExitImpersonation}>
    <div className="bg-white p-8 rounded-lg shadow prose max-w-none space-y-8">
      <h2 className="text-2xl font-bold text-blue-900 border-b pb-4">Diretrizes da Igreja Apostólica</h2>
      
      <section>
        <h3 className="font-bold text-lg text-blue-700">Reuniões Normais (1h30min):</h3>
        <p className="text-gray-600">4 hinos: 2 após hinos do hinário, 1 após contribuições e 1 para finalizar.</p>
      </section>
      
      <section>
        <h3 className="font-bold text-lg text-blue-700">Reuniões Normais (2h):</h3>
        <p className="text-gray-600">5 hinos: 2 após hinos do hinário, 2 após contribuições e 1 para finalizar.</p>
      </section>

      <section>
        <h3 className="font-bold text-lg text-blue-700">Reuniões de Oração:</h3>
        <p className="text-gray-600">O pastor deverá iniciar a reunião e antes da oração será cantado o numero 1 do hinário. Após a oração inicial deverá be cantado o hino nº 82 ou 180 do hinário. Na sequencia o coral apresentará 1 ou 2 hinos, o pastor farmá o levantamento das contribuições e o coral cantará mais 1 ou 2 hinos. O pastor fará a leitura e explicação da mensagem, após devera ser cantado um dos hinos nº 83 ou 84, 85, 107, 122, 172, 174, 176, 178, do hinário. Em seguida será a oração individual e após será cantando um dos hinos nº 81 ou 86, 116, 117, 118, 119, 120, 121, 173, 175, 177, 179, 186, 230, do hinário. Então a reunião deverá ser encerrada (não pode passar das 21hrs)</p>
      </section>

      <section>
        <h3 className="font-bold text-lg text-blue-700">Reuniões Especiais (2h):</h3>
        <p className="text-gray-600">Até 6 hinos: 3 após hinos do hinário, 2 após contribuições e 1 para finalizar. (Obs: Reuniões especiais são para dias como primeiro dia do ano, Corpus Christi, etc.)</p>
      </section>

      <section>
        <h3 className="font-bold text-lg text-blue-700">Reunião festiva (2h):</h3>
        <p className="text-gray-600">Entre 8 e 10 hinos (a depender da extensão dos hinos): 5 á 7 após hinos do hinário, 2 após contribuições e 1 para finalizar.</p>
      </section>

      <section>
        <h3 className="font-bold text-lg text-blue-700">Santa Comunhão (2h á 2h30min):</h3>
        <p className="text-gray-600">Entre 10 e 12 hinos (a depender da extensão dos hinos): 8 á 10 após hinos do hinário (1 hora de apresentação), 2 após as contribuições (sendo o segundo exclusivo de comunhão), hinos do hinário para destapar a mesa são obrigatoriamente os nº 87, 90 ou 114 e para finalizar cantar o hino nº 57 do hinário.</p>
      </section>
    </div>
  </Layout>
);

const HymnListScreen = ({ navigate, goBack, onCreate, onEdit, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
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
            <div className="flex gap-4"><button onClick={confirmDelete} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold shadow-md">Sim</button><button onClick={() => setListToDelete(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg font-bold">Não</button></div>
          </div>
        </div>
      )}
      <div className="sticky top-[60px] z-20 bg-white/95 backdrop-blur-sm shadow-sm -mx-4 px-4 py-4 mb-6 -mt-4 flex flex-wrap justify-between items-center border-b border-gray-100 gap-4">
        <h2 className="text-base font-black text-blue-900 uppercase tracking-tight">Histórico de Programas</h2>
        <div className="flex gap-3">
          <button 
            onClick={() => navigate('hymn_share_selection')} 
            className="bg-blue-50 text-blue-600 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-sm hover:bg-blue-100 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Compartilhamento
          </button>
          {!isReadOnly && <button onClick={onCreate} className="bg-blue-600 text-white px-7 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all">Nova Lista</button>}
        </div>
      </div>
      <div className="space-y-4">
        {lists.sort((a,b) => b.date.localeCompare(a.date)).map(l => (
          <div key={l.id} className="bg-white p-4 rounded shadow flex justify-between items-center hover:bg-gray-50 transition-colors">
            <div><p className="font-bold text-blue-900">{new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p><p className="text-sm text-gray-500">{l.congregation} • {MEETING_TYPES[l.type]}</p></div>
            <div className="flex gap-4">
              <button onClick={() => shareLink(l)} className="text-green-600 font-bold hover:underline flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                Compartilhar
              </button>
              <button onClick={() => setViewing(l)} className="text-blue-600 font-bold hover:underline">Ver PDF</button>
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

  const update = (sec: string, idx: number, field: string, val: string) => {
    if (isReadOnly) return;
    
    setData(prev => {
      const sections = { ...prev.sections };
      const s = [...(sections[sec] || [])];
      s[idx] = { ...s[idx], [field]: val };
      
      if (field === 'number' || field === 'notebook') {
        if (s[idx].notebook && s[idx].notebook !== 'Caderno' && s[idx].number) {
          const found = libraryHymns.find((h: MasterHymn) => h.notebook === s[idx].notebook && h.number === s[idx].number);
          if (found) {
            s[idx].title = found.title;
          } else if (field === 'number') {
            s[idx].title = '';
          }
        } else if (field === 'number' && !s[idx].number) {
          s[idx].title = '';
        }
      }
      
      return { ...prev, sections: { ...sections, [sec]: s } };
    });

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

    if (newList.festivity && newList.festivity !== '(em branco)') {
      const relations = await fetchData('hymn_relations', 'gca_hymn_relations', ownerEmail);
      let relation = relations.find((r: any) => r.title === newList.festivity);
      
      const hymnsInList: {notebook: string, number: string, title: string}[] = [];
      Object.values(newList.sections).forEach(entries => {
        (entries as any[]).forEach(e => {
          if (e.notebook && e.number && e.notebook !== 'Caderno') {
            if (!hymnsInList.some(h => h.notebook === e.notebook && h.number === e.number)) {
              hymnsInList.push({ notebook: e.notebook, number: e.number, title: e.title });
            }
          }
        });
      });

      if (relation) {
        const updatedHymns = [...relation.hymns];
        hymnsInList.forEach(h => {
          if (!updatedHymns.some(uh => uh.notebook === h.notebook && uh.number === h.number)) {
            updatedHymns.push(h);
          }
        });
        relation.hymns = updatedHymns;
        const updatedRelations = relations.map((r: any) => r.id === relation.id ? relation : r);
        await saveData('hymn_relations', 'gca_hymn_relations', updatedRelations, ownerEmail);
      } else {
        const newRelation: HymnRelation = {
          id: generateUUID(),
          title: newList.festivity,
          type: 'fixed',
          hymns: hymnsInList,
          owner_email: ownerEmail
        };
        await saveData('hymn_relations', 'gca_hymn_relations', [...relations, newRelation], ownerEmail);
      }
    }
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
          {['Normal130', 'Normal200', 'Especial200', 'Festiva200', 'SantaComunhao', 'NatalAnoNovo'].includes(data.type || '') && (
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Festividade</label>
              <select 
                disabled={isReadOnly} 
                className="w-full border rounded p-2 bg-white" 
                value={data.festivity || '(em branco)'} 
                onChange={e => setData({...data, festivity: e.target.value})}
              >
                {FESTIVIDADES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}
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
                  <span className="bg-white text-blue-900 border border-blue-100 px-6 py-2 rounded-full font-black uppercase text-xs shadow-sm tracking-widest animate-fade-in">Oração Individual</span>
                </div>
              )}
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8 shadow-sm">
                <div className="flex flex-col items-center mb-6 gap-3">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <h4 className="font-black uppercase text-blue-900 text-lg border-b-2 border-blue-200 px-8 pb-1.5 tracking-tight">{sectionLabel}</h4>
                    {data.type === 'NatalAnoNovo' && (sec === 'contributions' || sec === 'message') && (
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-blue-100 shadow-sm">
                        <label className="text-[9px] font-black uppercase text-blue-400">Duração:</label>
                        <input 
                          disabled={isReadOnly}
                          placeholder="00:00:00" 
                          className="border border-blue-50 rounded-lg px-2 py-1 text-xs w-24 font-mono text-center focus:border-blue-500 outline-none"
                          value={data.sectionDurations?.[sec] || ''}
                          onChange={e => setData({...data, sectionDurations: {...data.sectionDurations, [sec]: e.target.value}})}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {(data.type === 'Outra' || (data.type === 'NatalAnoNovo' && (sec === 'choir' || sec === 'contributions' || sec === 'message'))) && !isReadOnly && (
                      <button type="button" onClick={() => addRow(sec)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100 active:scale-95">
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
                    className={`space-y-3 min-h-[60px] transition-all duration-200 rounded-xl ${snapshot.isDraggingOver ? 'bg-blue-50/50 ring-2 ring-blue-200 ring-dashed' : ''} ${entries.length === 0 ? 'border-2 border-dashed border-gray-200 flex items-center justify-center p-4' : ''}`}
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
                              className={`flex flex-col gap-1 ${snapshot.isDragging ? 'opacity-50 ring-2 ring-blue-500 rounded-xl bg-blue-50/50 scale-105 z-50' : ''} transition-all duration-200`}
                            >
                              {hasNbError && (
                                <div className="flex animate-bounce-short">
                                  <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm">Por Favor, Informe o Caderno</span>
                                </div>
                              )}
                              <div className="flex flex-col sm:flex-row gap-2 items-center p-2 rounded relative group">
                                {!isReadOnly && (
                                  <div {...provided.dragHandleProps} className="hidden sm:flex items-center justify-center cursor-grab active:cursor-grabbing p-1.5 text-gray-300 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all absolute -left-6 bg-white rounded-l-lg border border-r-0 border-gray-100">
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
                          <button type="button" onClick={() => openHymnSearch(sec, i, e.notebook)} className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Pesquisar Hino">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input disabled={numberLocked} placeholder="Nº" className={`w-full sm:w-20 border rounded p-2 ${validationErrors.includes(`${sec}-${i}-number`) ? 'border-red-500 bg-red-50' : ''}`} value={e.number} onChange={ev => update(sec, i, 'number', ev.target.value)} />
                          <button type="button" onClick={() => openHymnSearch(sec, i, e.notebook)} className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Pesquisar Hino">
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
                            <div className="flex flex-col items-center bg-blue-600 text-white px-2 py-1 rounded shadow-sm border border-blue-700 min-w-[75px]">
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
          <div className="bg-blue-900 text-white p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border-b-4 border-blue-950">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-800 rounded-full">
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

        {!isReadOnly && <button type="submit" className="bg-blue-600 text-white px-10 py-3 rounded-full font-bold shadow-lg w-full sm:w-auto">Finalizar Programa</button>}
      </form>
    </DragDropContext>

      {searchModalHymns && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            <div className="bg-blue-600 p-6 flex justify-between items-center shrink-0">
               <div className="flex flex-col">
                  <h3 className="text-white font-black uppercase tracking-widest text-lg">Pesquisar Hino</h3>
                  <span className="text-blue-100 text-[10px] font-bold uppercase">Caderno: {searchModalHymns.notebook}</span>
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
                  className="w-full bg-white border-2 border-blue-50 rounded-2xl py-4 pl-12 pr-6 font-bold outline-none focus:border-blue-600 transition-all shadow-sm"
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
                    className="w-full text-left p-4 bg-white hover:bg-blue-50 border border-gray-100 rounded-2xl transition-all group flex items-center gap-4 hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-xl font-black text-lg shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      {h.number}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-black text-blue-950 uppercase truncate tracking-tight">{h.title}</p>
                      <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest">{h.notebook}</p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600">
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

  const { items, totalPresentationSeconds, finalRunningSeconds } = useMemo(() => {
    let currentRunning = parseTimeToSeconds(list.startTime || '19:00:00');
    let totalPres = 0;
    const result: any[] = [];

    sectionOrder.forEach(sec => {
      const sectionLabel = getSectionLabel(sec);
      const entries = list.sections[sec] || [];
      
      if (list.sectionDurations?.[sec]) {
        currentRunning += parseTimeToSeconds(list.sectionDurations[sec]);
      }

      if (entries.length === 0) return;

      if (list.type === 'Oracao' && sec === 'afterIndividualPrayer') {
        result.push({ type: 'special', label: 'Oração Individual' });
      }

      result.push({ type: 'section', label: sectionLabel });

      entries.forEach((e: any, i: number) => {
        const itemDurSec = parseTimeToSeconds(e.duration);
        currentRunning += itemDurSec;
        totalPres += itemDurSec;

        const isOracaoExecutionHide = list.type === 'Oracao' && (sec === 'hymnal' || sec === 'message' || sec === 'afterIndividualPrayer');
        const hideExecution = sectionLabel === 'Hinário' || sectionLabel === 'Hinos do Hinário' || isOracaoExecutionHide;
        const isDetailedRow = sectionLabel === 'Apresentação do Coral' || sectionLabel === 'Contribuições' || sectionLabel === 'Mensagem';

        result.push({
          type: 'row',
          data: e,
          hideExecution,
          isDetailedRow,
          runningClock: formatSecondsToClockTime(currentRunning)
        });
      });
    });

    return { items: result, totalPresentationSeconds: totalPres, finalRunningSeconds: currentRunning };
  }, [list]);

  const isNatal = list.type === 'NatalAnoNovo';
  const orientation = (list.isDetailed || isNatal) ? 'landscape' : 'portrait';

  const header = useMemo(() => (
    <div className="text-center border-b-2 border-double border-blue-900 pb-4 flex flex-col items-center mb-4 w-full pt-1">
      <h1 className="text-3xl font-black uppercase tracking-tight leading-normal mb-2 text-blue-900">Igreja Apostólica</h1>
      <h2 className="text-xl font-bold border-2 border-blue-900 text-blue-900 inline-block px-10 py-2.5 uppercase mb-6 leading-tight rounded-sm">{MEETING_TYPES[list.type]}</h2>
      <div className="w-full flex justify-between px-4 font-black uppercase italic border-blue-900 border-t pt-4 text-[13px] text-black">
        <span>Data: {new Date(list.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
        {isNatal && <span>Início: {list.startTime || '19:00:00'}</span>}
        <span>Congregação: {list.congregation}</span>
      </div>
    </div>
  ), [list.type, list.date, list.startTime, list.congregation, isNatal]);

  const tableHeader = useMemo(() => (
    <div className="flex items-center border-b-2 border-blue-900 bg-blue-900 text-white uppercase font-black text-[11px] w-full min-h-[44px]">
      <div className="px-2 py-2 w-16 shrink-0 text-center flex items-center justify-center">Cad.</div>
      <div className="px-2 py-2 w-14 shrink-0 text-center border-l border-blue-800/30 flex items-center justify-center">Nº</div>
      <div className="px-2 py-2 flex-1 border-l border-blue-800/30 text-center flex items-center justify-center">Hino</div>
      {list.isDetailed && (
        <>
          <div className="px-2 py-2 w-24 shrink-0 text-center border-l border-blue-800/30 flex items-center justify-center">Regente</div>
          <div className="px-2 py-2 w-24 shrink-0 text-center border-l border-blue-800/30 flex items-center justify-center">Solista</div>
          <div className="px-2 py-2 w-24 shrink-0 text-center border-l border-blue-800/30 flex items-center justify-center">Tecladista</div>
          <div className="px-2 py-2 w-24 shrink-0 text-center border-l border-blue-800/30 flex items-center justify-center">Violonista</div>
        </>
      )}
      <div className="px-2 py-2 w-24 shrink-0 text-center border-l border-blue-800/30 flex items-center justify-center">Execução</div>
      {isNatal && <div className="px-2 py-2 w-20 shrink-0 text-center border-l border-blue-800/30 flex items-center justify-center">Cronometro</div>}
    </div>
  ), [list.isDetailed, isNatal]);

  const lastPageFooter = isNatal ? (
    <div className="mt-4 pt-2 border-t-2 border-black flex justify-between items-start w-full">
      <div className="flex gap-4">
        <div className="flex flex-col text-black">
          <span className="text-[8px] font-black uppercase opacity-60">Tempo Total</span>
          <span className="text-sm font-black">{formatSecondsToDurationString(totalPresentationSeconds)}</span>
        </div>
      </div>
      <div className="text-right flex flex-col text-black">
        <span className="text-[8px] font-black uppercase opacity-60">Encerramento Previsto</span>
        <span className="text-lg font-black text-blue-900">{formatSecondsToClockTime(finalRunningSeconds)}</span>
      </div>
    </div>
  ) : null;

  return (
    <PagedReport
      id="program-print-view"
      filename={`programa-${list.date}`}
      goBack={onBack}
      items={items}
      header={header}
      tableHeader={tableHeader}
      orientation={orientation}
      lastPageFooter={lastPageFooter}
      title="Programa de Culto"
      renderItem={(item) => {
        if (item.type === 'special') {
          return (
            <div className="px-2 py-3.5 text-center font-black uppercase text-black italic tracking-widest border-y border-gray-100 bg-white min-h-[44px] flex items-center justify-center" style={{ fontSize: '12px' }}>
              {item.label}
            </div>
          );
        }
        if (item.type === 'section') {
          return (
            <div className="px-2 py-1 font-black uppercase text-black border-b border-gray-300 text-center bg-gray-50/50" style={{ fontSize: '13px' }}>
              {item.label}
            </div>
          );
        }

        const e = item.data;
        const cellPadding = isNatal ? 'px-1 py-1.5' : 'px-2 py-3';
        const fontSize = isNatal ? '10.5px' : '12.5px';

        return (
          <div className="flex border-b border-gray-100 items-stretch w-full bg-white transition-colors hover:bg-gray-50/30" style={{ fontSize, minHeight: '42px' }}>
            <div className={`${cellPadding} w-16 shrink-0 font-bold text-gray-500 border-r border-gray-100 italic flex items-center justify-center text-center`}>{e.notebook}</div>
            <div className={`${cellPadding} w-14 shrink-0 font-black text-black border-r border-gray-100 text-center flex items-center justify-center`}>{e.number}</div>
            <div className={`${cellPadding} flex-1 font-bold text-black uppercase truncate flex items-center px-4`}>{e.title}</div>
            {list.isDetailed && (
              <>
                <div className={`${cellPadding} w-24 shrink-0 text-[11px] text-black font-medium truncate border-l border-gray-50 flex items-center justify-center text-center`}>{item.isDetailedRow ? (e.conductor || '-') : ''}</div>
                <div className={`${cellPadding} w-24 shrink-0 text-[11px] text-black font-medium truncate border-l border-gray-50 flex items-center justify-center text-center`}>{item.isDetailedRow ? (e.soloist || '-') : ''}</div>
                <div className={`${cellPadding} w-24 shrink-0 text-[11px] text-black font-medium truncate border-l border-gray-50 flex items-center justify-center text-center`}>{item.isDetailedRow ? (e.keyboardist || '-') : ''}</div>
                <div className={`${cellPadding} w-24 shrink-0 text-[11px] text-black font-medium truncate border-l border-gray-50 flex items-center justify-center text-center`}>{item.isDetailedRow ? (e.guitarist || '-') : ''}</div>
              </>
            )}
            <div className={`${cellPadding} w-24 shrink-0 text-black font-bold uppercase truncate border-l border-gray-100 flex items-center justify-center text-center`}>{!item.hideExecution ? (e.execution || '-') : ''}</div>
            {isNatal && (
              <div className={`${cellPadding} w-20 shrink-0 text-black font-black text-center font-mono border-l border-gray-100 flex items-center justify-center`} style={{ fontSize: '13px' }}>
                {item.runningClock}
              </div>
            )}
          </div>
        );
      }}
    />
  );
};

const HymnRelationsDashboardScreen = ({ navigate, goBack, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
  const [relations, setRelations] = useState<HymnRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData('hymn_relations', 'gca_hymn_relations', ownerEmail).then(all => {
      setRelations(all);
      setLoading(false);
    });
  }, [ownerEmail]);

  const fixedRelations = FESTIVIDADES.filter(f => f !== '(em branco)');
  
  const createCustom = () => {
    const title = prompt('Título da Relação Personalizada:');
    if (!title) return;
    const newRelation: HymnRelation = {
      id: generateUUID(),
      title,
      type: 'custom',
      hymns: [],
      owner_email: ownerEmail
    };
    saveData('hymn_relations', 'gca_hymn_relations', [...relations, newRelation], ownerEmail).then(() => {
      setRelations(prev => [...prev, newRelation]);
      navigate('hymn_relation_detail', newRelation);
    });
  };

  const filteredFixed = fixedRelations.filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCustom = relations.filter(r => r.type === 'custom' && r.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Layout title="Relações de Hinos" onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
      <div className="space-y-8">
        <div className="sticky top-0 z-10 flex flex-wrap gap-4 items-center justify-between bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-blue-100 shadow-sm">
          <div>
            <h3 className="text-lg font-black text-blue-900 uppercase tracking-tight">Relações de Hinos</h3>
            <p className="text-xs text-blue-600 font-bold">Datas festivas e relações personalizadas</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <input 
                placeholder="Buscar relação..." 
                className="w-full bg-blue-50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold text-blue-900 placeholder:text-blue-300 outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            
            <button onClick={createCustom} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2 whitespace-nowrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Relação Personalizada
            </button>
          </div>
        </div>

        {filteredFixed.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFixed.map(title => {
              const rel = relations.find(r => r.title === title && r.type === 'fixed');
              const count = rel ? rel.hymns.length : 0;
              return (
                <button 
                  key={title} 
                  onClick={() => navigate('hymn_relation_detail', rel || { id: generateUUID(), title, type: 'fixed', hymns: [], owner_email: ownerEmail })}
                  className="bg-white border-2 border-gray-100 p-5 rounded-2xl flex flex-col items-start hover:border-blue-300 hover:shadow-xl hover:shadow-blue-50 transition-all group text-left"
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <h4 className="font-black text-gray-900 uppercase tracking-tight mb-1 group-hover:text-blue-600 transition-colors">{title}</h4>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{count} {count === 1 ? 'Hino Relacionado' : 'Hinos Relacionados'}</p>
                </button>
              );
            })}
          </div>
        )}

        {filteredCustom.length > 0 && (
          <div className="space-y-6 pt-6 border-t border-gray-100">
            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Personalizadas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCustom.map(rel => (
                <button 
                  key={rel.id} 
                  onClick={() => navigate('hymn_relation_detail', rel)}
                  className="bg-white border-2 border-gray-100 p-5 rounded-2xl flex flex-col items-start hover:border-blue-300 hover:shadow-xl hover:shadow-blue-50 transition-all group text-left"
                >
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-4 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </div>
                  <h4 className="font-black text-gray-900 uppercase tracking-tight mb-1 group-hover:text-purple-600 transition-colors">{rel.title}</h4>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{rel.hymns.length} Hinos</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

const HymnRelationDetailScreen = ({ relation: initialRelation, goBack, navigate, ownerEmail, isReadOnly, onExitImpersonation }: any) => {
  const [relation, setRelation] = useState<HymnRelation | null>(initialRelation);
  const [libraryHymns, setLibraryHymns] = useState<MasterHymn[]>([]);
  const [newHymn, setNewHymn] = useState({ notebook: 'Caderno', number: '', title: '' });
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [listSearchTerm, setListSearchTerm] = useState('');

  useEffect(() => {
    if (!initialRelation) return;
    fetchData('hymns_library', 'gca_hymns_library', ownerEmail).then(setLibraryHymns);
    // Refresh relation from DB just in case
    fetchData('hymn_relations', 'gca_hymn_relations', ownerEmail).then(all => {
      const found = all.find((r: any) => r.id === initialRelation.id || (r.title === initialRelation.title && r.type === initialRelation.type));
      if (found) setRelation(found);
    });
  }, [initialRelation?.id, initialRelation?.title, initialRelation?.type, ownerEmail]);

  if (!initialRelation || !relation) return <Layout title="Detalhes" onBack={goBack}>Carregando...</Layout>;

  const saveToDb = async (updatedHymns: any[]) => {
    const all = await fetchData('hymn_relations', 'gca_hymn_relations', ownerEmail);
    const updatedRelation = { ...relation, hymns: updatedHymns };
    const filtered = all.filter((r: any) => r.id !== relation.id);
    await saveData('hymn_relations', 'gca_hymn_relations', [...filtered, updatedRelation], ownerEmail);
    setRelation(updatedRelation);
  };

  const addHymn = () => {
    if (newHymn.notebook === 'Caderno' || !newHymn.number || !newHymn.title) return;
    if (relation.hymns.some(h => h.notebook === newHymn.notebook && h.number === newHymn.number)) return;
    const updated = [...relation.hymns, { ...newHymn }];
    saveToDb(updated);
    setNewHymn({ notebook: 'Caderno', number: '', title: '' });
  };

  const removeHymn = (idx: number) => {
    const updated = [...relation.hymns];
    updated.splice(idx, 1);
    saveToDb(updated);
  };

  const updateNewHymnField = (field: string, val: string) => {
    const updated = { ...newHymn, [field]: val };
    if (field === 'number' || field === 'notebook') {
      if (updated.notebook !== 'Caderno' && updated.number) {
        const found = libraryHymns.find(h => h.notebook === updated.notebook && h.number === updated.number);
        updated.title = found ? found.title : '';
      } else if (field === 'number') {
        updated.title = '';
      }
    }
    setNewHymn(updated);
  };

  const selectHymnFromSearch = (num: string) => {
    const found = libraryHymns.find(h => h.notebook === newHymn.notebook && h.number === num);
    if (found) {
      const updated = { ...newHymn, number: num, title: found.title };
      setNewHymn(updated);
    }
    setShowSearchModal(false);
  };

  const deleteRelation = async () => {
    if (!confirm('Deseja excluir esta relação?')) return;
    const all = await fetchData('hymn_relations', 'gca_hymn_relations', ownerEmail);
    const filtered = all.filter((r: any) => r.id !== relation.id);
    await saveData('hymn_relations', 'gca_hymn_relations', filtered, ownerEmail);
    goBack();
  };

  const filteredHymns = relation.hymns.filter(h => 
    h.number.includes(listSearchTerm) || 
    h.title.toLowerCase().includes(listSearchTerm.toLowerCase()) ||
    h.notebook.toLowerCase().includes(listSearchTerm.toLowerCase())
  );

  return (
    <Layout title={relation.title} onBack={goBack} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation}>
      <div className="space-y-6">
        <div className="sticky top-0 z-20 bg-white border border-gray-100 p-6 rounded-2xl shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">Incluir Hino na Relação</h3>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('hymn_relation_report', relation)}
                className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm border border-blue-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                Gerar Relatório
              </button>
              {relation.type === 'custom' && (
                <button onClick={deleteRelation} className="text-red-500 hover:text-red-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Excluir Relação
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Caderno</label>
              <select className="w-full border rounded-xl p-2.5 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-bold text-sm" value={newHymn.notebook} onChange={e => updateNewHymnField('notebook', e.target.value)}>
                <option value="Caderno">Caderno</option>
                {Object.keys(NOTEBOOKS).map(code => <option key={code} value={code}>{code}</option>)}
              </select>
            </div>
            <div className="w-full sm:w-32 space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nº</label>
              <div className="flex items-center gap-1">
                <input placeholder="000" className="w-full border rounded-xl p-2.5 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-mono font-bold" value={newHymn.number} onChange={e => updateNewHymnField('number', e.target.value)} />
                <button onClick={() => {
                  if (newHymn.notebook === 'Caderno') return alert('Selecione um caderno primeiro');
                  setShowSearchModal(true);
                  setSearchTerm('');
                }} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </button>
              </div>
            </div>
            <div className="flex-[2] w-full space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Título</label>
              <input readOnly placeholder="Auto-completar..." className="w-full border rounded-xl p-2.5 bg-gray-100 text-gray-500 font-bold" value={newHymn.title} />
            </div>
            <button onClick={addHymn} className="bg-blue-600 text-white h-[46px] px-8 rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Incluir
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gray-50 px-6 py-5 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <h3 className="font-black text-blue-900 uppercase text-sm tracking-widest">Hinos na Relação</h3>
              <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase shadow-sm">{relation.hymns.length}</span>
            </div>
            <div className="relative w-full sm:w-80">
              <input 
                placeholder="Pesquisar hino na lista..." 
                className="w-full bg-white border-2 border-gray-200 rounded-xl py-2.5 pl-11 pr-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-300 transition-all shadow-sm"
                value={listSearchTerm}
                onChange={e => setListSearchTerm(e.target.value)}
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {filteredHymns.length === 0 ? (
              <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>
                <p className="text-sm font-bold uppercase tracking-widest opacity-60">
                  {listSearchTerm ? 'Nenhum hino corresponde à busca' : 'Nenhum hino nesta relação'}
                </p>
              </div>
            ) : (
              filteredHymns.map((h, i) => (
                <div key={i} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-all group">
                  <div className="w-10 h-10 bg-blue-50 text-blue-900 font-black flex items-center justify-center rounded-lg border border-blue-100 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-700 transition-all shadow-sm">
                    {h.number}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 uppercase text-sm tracking-tight">{h.title}</h4>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{h.notebook}</p>
                  </div>
                  <button onClick={() => removeHymn(relation.hymns.indexOf(h))} className="p-2 text-red-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showSearchModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-blue-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowSearchModal(false)} />
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative animate-scale-in overflow-hidden">
            <div className="bg-blue-600 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-white text-xl font-black uppercase tracking-tight">Pesquisar Hino</h3>
                <span className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">Caderno: {newHymn.notebook}</span>
              </div>
              <button onClick={() => setShowSearchModal(false)} className="text-blue-100 hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="p-6">
              <div className="relative mb-6">
                <input autoFocus placeholder="Buscar por número ou título..." className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 pl-12 text-lg font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {libraryHymns
                  .filter(h => h.notebook === newHymn.notebook)
                  .filter(h => h.number.includes(searchTerm) || h.title.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(h => (
                    <button key={h.id} onClick={() => selectHymnFromSearch(h.number)} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-blue-50 transition-all border-2 border-transparent hover:border-blue-100 group text-left">
                      <div className="w-12 h-12 bg-gray-50 group-hover:bg-blue-600 rounded-xl flex items-center justify-center font-black text-gray-400 group-hover:text-white border border-gray-100 group-hover:border-blue-700 transition-all">{h.number}</div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 uppercase group-hover:text-blue-900 transition-colors">{h.title}</p>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{h.notebook}</p>
                      </div>
                      <svg className="text-blue-200 group-hover:text-blue-600 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

// --- Relatório de Relação de Hinos ---

const HymnRelationReportScreen = ({ relation, goBack, onExitImpersonation }: any) => {
  if (!relation) return <Layout title="Relatório" onBack={goBack}>Carregando...</Layout>;
  return (
    <Layout title={`Relatório: ${relation.title}`} onBack={goBack} onExitImpersonation={onExitImpersonation}>
      <div className="bg-white p-8 sm:p-12 min-h-screen">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center border-b-4 border-blue-600 pb-8">
            <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-2">{relation.title}</h2>
            <p className="text-sm font-bold text-blue-600 uppercase tracking-[0.2em]">Relação de Hinos Cadastrados</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {relation.hymns.length === 0 ? (
              <p className="text-center text-gray-400 font-bold uppercase py-20">Nenhum hino cadastrado nesta relação.</p>
            ) : (
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-24">Nº</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Título do Hino</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-32">Caderno</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {relation.hymns.sort((a: any, b: any) => a.number.localeCompare(b.number, undefined, {numeric: true})).map((h: any, i: number) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 font-black text-blue-600 font-mono">{h.number}</td>
                        <td className="px-6 py-4 font-bold text-gray-900 uppercase text-sm">{h.title}</td>
                        <td className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">{h.notebook}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-10 flex justify-center no-print">
            <button 
              onClick={() => window.print()} 
              className="bg-gray-900 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl flex items-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir Relação
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

// --- Compartilhamento de Listas (Seleção) ---

const HymnShareSelectionScreen = ({ navigate, goBack, ownerEmail, onExitImpersonation }: any) => {
  const [startDate, setStartDate] = useState(getBrasiliaYYYYMMDD());
  const [endDate, setEndDate] = useState(getBrasiliaYYYYMMDD());
  const [lists, setLists] = useState<HymnList[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActiveLists = async () => {
    setLoading(true);
    const all = await fetchData('hymn_lists', 'gca_hymn_lists', ownerEmail);
    const filtered = all.filter((l: any) => l.date >= startDate && l.date <= endDate);
    setLists(filtered.sort((a,b) => a.date.localeCompare(b.date)));
    setSelectedIds([]);
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === lists.length) setSelectedIds([]);
    else setSelectedIds(lists.map(l => l.id));
  };

  const generateReport = () => {
    if (selectedIds.length === 0) return alert('Selecione ao menos uma lista');
    const selectedLists = lists.filter(l => selectedIds.includes(l.id));
    navigate('hymn_share_pdf', selectedLists);
  };

  return (
    <Layout title="Compartilhamento de Hinos" onBack={goBack} onExitImpersonation={onExitImpersonation}>
      <div className="space-y-6">
        <div className="bg-white border-2 border-blue-100 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Data Inicial</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border rounded-xl p-3 bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Data Final</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border rounded-xl p-3 bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
            </div>
            <button onClick={fetchActiveLists} className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black uppercase text-xs shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">
              Buscar Listas
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center animate-pulse text-blue-300 font-black uppercase tracking-widest text-xs">Buscando...</div>
          ) : lists.length > 0 ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest">Listas Encontradas ({lists.length})</h3>
                <button onClick={selectAll} className="text-blue-600 text-[10px] font-black uppercase tracking-widest hover:underline">
                  {selectedIds.length === lists.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lists.map(l => (
                  <label key={l.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedIds.includes(l.id) ? 'border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]' : 'border-gray-100 hover:border-blue-200 bg-white'}`}>
                    <input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => toggleSelect(l.id)} className="sr-only" />
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${selectedIds.includes(l.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}>
                      {selectedIds.includes(l.id) && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div>
                      <p className="font-black text-gray-900 uppercase text-sm">{new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{l.congregation} • {MEETING_TYPES[l.type]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
             <div className="py-20 text-center text-gray-300">
               <svg className="mx-auto mb-4 opacity-20" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
               <p className="text-sm font-bold uppercase tracking-widest opacity-60">Nenhuma lista encontrada no período</p>
             </div>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 animate-slide-up no-print">
            <button 
              onClick={generateReport}
              className="w-full bg-gray-900 text-white p-6 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
              Gerar Relatório de Hinos ({selectedIds.length})
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

// --- Compartilhamento de Listas (Relatório PDF) ---

const HymnSharePDFScreen = ({ selectedLists, currentUser, goBack }: any) => {
  if (!selectedLists) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <p className="font-bold text-gray-400 uppercase tracking-widest">Nenhuma lista selecionada</p>
      <button onClick={goBack} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold uppercase text-xs">Voltar</button>
    </div>
  );
  return (
    <div className="min-h-screen bg-gray-100 p-0 sm:p-8 flex flex-col items-center">
      <div className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl p-[15mm] border border-gray-200 relative overflow-hidden print:shadow-none print:border-none print:p-[10mm] print:m-0" id="print-area">
        {/* Header com a congregação do usuário logado */}
        <div className="text-center border-b-4 border-blue-600 pb-6 mb-8">
          <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-1">PROGRAMAÇÃO DE HINOS</h1>
          <p className="text-lg font-bold text-blue-600 uppercase tracking-[0.2em]">{currentUser?.congregation || 'CORE CONGREGACIONAL'}</p>
        </div>

        <div className="space-y-10">
          {selectedLists.map((l: any, idx: number) => {
            // Extrair todos os hinos das seções da lista e achatar em um único array
            const allHymnsFromSections: any[] = [];
            if (l.sections) {
              Object.values(l.sections).forEach((sectionEntries: any) => {
                if (Array.isArray(sectionEntries)) {
                  sectionEntries.forEach(entry => {
                    if (entry.notebook && entry.number && entry.title) {
                      allHymnsFromSections.push(entry);
                    }
                  });
                }
              });
            }

            // Filtrar hinos que não sejam do caderno 'H' e que tenham título
            const filteredHymns = allHymnsFromSections.filter((h: any) => h.notebook !== 'H' && h.title);
            
            if (filteredHymns.length === 0) return null;

            return (
              <div key={l.id} className="break-inside-avoid PageBreak mb-8">
                <div className="bg-gray-50 px-4 py-2 rounded-t-lg border-l-4 border-blue-600 flex justify-between items-center">
                  <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                    {new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long' })}
                  </h2>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{MEETING_TYPES[l.type]}</span>
                </div>

                <div className="border border-gray-200 border-t-0 rounded-b-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="p-2 text-[10px] font-black uppercase text-gray-400 text-center w-16">Caderno</th>
                        <th className="p-2 text-[10px] font-black uppercase text-gray-400 text-center w-12">Nº</th>
                        <th className="p-2 text-[10px] font-black uppercase text-gray-400">Hino</th>
                        <th className="p-2 text-[10px] font-black uppercase text-gray-400">Regente</th>
                        <th className="p-2 text-[10px] font-black uppercase text-gray-400">Solista</th>
                        <th className="p-2 text-[10px] font-black uppercase text-gray-400 w-32">Execução</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHymns.map((h: any, hIdx: number) => (
                        <tr key={hIdx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="p-2 text-center text-[10px] font-black text-gray-500 uppercase">{h.notebook}</td>
                          <td className="p-2 text-center text-[11px] font-black text-blue-600 font-mono italic">{h.number}</td>
                          <td className="p-2 text-xs font-bold text-gray-900 uppercase leading-tight">{h.title}</td>
                          <td className="p-2 text-[9px] font-black uppercase text-gray-400">{h.conductor || '-'}</td>
                          <td className="p-2 text-[9px] font-black uppercase text-gray-400">{h.soloist || '-'}</td>
                          <td className="p-2 text-[9px] font-black uppercase text-blue-500/70 tracking-tighter leading-none">{h.execution || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer print only */}
        <div className="absolute bottom-[10mm] left-[15mm] right-[15mm] text-[8px] font-bold text-gray-300 uppercase tracking-[0.3em] flex justify-between border-t border-gray-100 pt-2 print:flex hidden">
          <span>CORUS - GESTOR DE CORAIS APOSTÓLICOS</span>
          <span>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      <div className="fixed bottom-8 flex gap-4 no-print scale-110">
        <button onClick={goBack} className="bg-white text-gray-600 px-8 py-3 rounded-xl font-bold uppercase shadow-xl hover:bg-gray-50 border border-gray-200">Voltar</button>
        <button 
          onClick={() => window.print()} 
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold uppercase shadow-xl hover:bg-blue-700 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir / PDF
        </button>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          #print-area { 
            box-shadow: none !important; 
            border: none !important; 
            margin: 0 !important;
            padding: 10mm !important;
            min-height: auto !important;
          }
          .PageBreak { page-break-inside: avoid; }
          @page { size: auto; margin: 15mm; }
        }
      `}</style>
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
        <button onClick={() => onGenerate(start, end, sortOrder)} className="w-full bg-blue-600 text-white py-2 rounded font-bold shadow hover:bg-blue-700 transition-colors">Visualizar</button>
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

  const header = useMemo(() => (
    <div className="text-center border-b-2 border-double border-blue-900 pb-4 flex flex-col items-center mb-4 pt-1 w-full">
      <h1 className="text-3xl font-black uppercase tracking-tight leading-normal mb-2 text-blue-900">Igreja Apostólica</h1>
      <h2 className="text-xl font-bold border-2 border-blue-900 text-blue-900 inline-block px-10 py-2.5 uppercase rounded-sm tracking-widest leading-tight">Frequência de Uso de Hinos</h2>
      <div className="mt-2 text-[11px] font-bold uppercase italic border-blue-900 border-t pt-4 flex justify-between text-black w-full px-4">
        <span>Período: {new Date(start + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(end + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
        <span>Ordem: {sortOrder === 'numerical' ? 'Numérica' : sortOrder === 'most_presented' ? 'MAIS USADOS' : 'MENOS USADOS'}</span>
      </div>
    </div>
  ), [start, end, sortOrder]);

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center font-bold animate-pulse text-blue-600 uppercase tracking-widest">Calculando Uso de Hinos...</div>;

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

  const items: any[] = [];
  notebookCodes.forEach(code => {
    items.push({ type: 'header', code, label: NOTEBOOKS[code] });
    // Agrupar hinos em trios para o layout de 3 colunas
    const hymns = grouped[code];
    for (let i = 0; i < hymns.length; i += 3) {
      items.push({ 
        type: 'row_trio', 
        hymns: hymns.slice(i, i + 3) 
      });
    }
  });

  return (
    <PagedReport
      id="hymn-usage-report-view"
      title="Frequência de Uso de Hinos"
      filename="relatorio-uso-hinos"
      goBack={goBack}
      items={items}
      header={header}
      renderItem={(item) => {
        if (item.type === 'header') {
          return (
            <div className="flex items-center justify-center w-full mt-6 mb-2">
              <h3 className="bg-blue-900/5 text-blue-900 border border-blue-900/20 w-full py-2.5 font-black uppercase text-[13px] rounded-sm tracking-widest avoid-break leading-none flex items-center justify-center">
                {item.code} - {item.label}
              </h3>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-3 gap-3 w-full py-1.5 border-b border-gray-100 last:border-0 avoid-break min-h-[36px]">
            {item.hymns.map((h: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 overflow-hidden">
                <span className="text-[12px] font-black text-blue-600 font-mono w-8 text-right shrink-0">{h.number}</span>
                <span className="text-[11px] font-bold text-gray-800 uppercase flex-1 truncate leading-tight tracking-tight">{h.title}</span>
                <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-sm shrink-0 border border-blue-100">{h.count}x</span>
              </div>
            ))}
          </div>
        );
      }}
    />

  );
};

const AdminMenuScreen = ({ navigate, goBack, currentUser }: any) => {
  const isAdmin = currentUser.email === 'Admin' || !!currentUser.isAdminUser;
  const isMaster = currentUser.email === 'Admin' || (isAdmin && !!currentUser.isMasterAdmin);
  
  if (!isAdmin) return null;

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

const AdminUsersScreen = ({ goBack, onImpersonate, currentUser, onUpdateCurrentUser, onAwaitingConductorRegistration }: any) => {
  const isAdmin = currentUser.email === 'Admin' || !!currentUser.isAdminUser;
  const isMaster = currentUser.email === 'Admin' || (isAdmin && !!currentUser.isMasterAdmin);

  if (!isAdmin) return null;

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [permissionModalUser, setPermissionModalUser] = useState<UserAccount | null>(null);
  const [initialAdminStatus, setInitialAdminStatus] = useState<boolean | null>(null);
  const [adminCheckPassword, setAdminCheckPassword] = useState('');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserAccount | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [statusConfirmUser, setStatusConfirmUser] = useState<{user: UserAccount, target: any} | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [passwordConfirmUser, setPasswordConfirmUser] = useState<UserAccount | null>(null);
  const [newPasswordGenerated, setNewPasswordGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showScopeSelector, setShowScopeSelector] = useState(false);
  const hasGeneralAccess = isMaster || !!currentUser.canApprove || !!currentUser.canRegister || !!currentUser.canManageLocations;
  
  const filteredUsersForAdmin = users
    .filter(u => {
      if (u.email === 'Admin') return false;
      if (hasGeneralAccess) return true;
      return (currentUser.managedUserEmails || []).includes(u.email);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

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
      setAdminCheckPassword('');
      setInitialAdminStatus(null);
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

    if (permissionModalUser.isAdminUser !== initialAdminStatus) {
      if (!adminCheckPassword) {
        setPermissionError("Confirme sua senha de Admin para alterar o nível de acesso");
        return;
      }
      if (adminCheckPassword !== currentUser.password) {
        setPermissionError("Senha de confirmação incorreta");
        return;
      }
    }

    const isActuallyAdmin = !!permissionModalUser.isAdminUser;
    const { error } = await supabase.from('users').update({
      isAdminUser: isActuallyAdmin,
      isMasterAdmin: isActuallyAdmin ? !!permissionModalUser.isMasterAdmin : false,
      canViewOthers: isActuallyAdmin ? !!permissionModalUser.canViewOthers : false,
      canRegister: isActuallyAdmin ? !!permissionModalUser.canRegister : false,
      canApprove: isActuallyAdmin ? !!permissionModalUser.canApprove : false,
      canDeleteUser: isActuallyAdmin ? !!permissionModalUser.canDeleteUser : false,
      canEditProfiles: isActuallyAdmin ? (!!permissionModalUser.canEditProfiles || !!permissionModalUser.canApprove) : false,
      canResetPasswords: isActuallyAdmin ? !!permissionModalUser.canResetPasswords : false,
      canManageLocations: isActuallyAdmin ? !!permissionModalUser.canManageLocations : false,
      canEditCRR: isActuallyAdmin ? !!permissionModalUser.canEditCRR : false,
      canReadOnlyMode: isActuallyAdmin ? !!permissionModalUser.canReadOnlyMode : false,
      canEnableDisableUsers: isActuallyAdmin ? !!permissionModalUser.canEnableDisableUsers : false,
      canManageMessages: isActuallyAdmin ? !!permissionModalUser.canManageMessages : false,
      canSendBulletins: isActuallyAdmin ? !!permissionModalUser.canSendBulletins : false,
      canChat: isActuallyAdmin ? !!permissionModalUser.canChat : false,
      managedUserEmails: isActuallyAdmin ? (permissionModalUser.managedUserEmails || []) : [],
    }).eq('id', permissionModalUser.id);

    if (!error) {
      if (permissionModalUser.id === currentUser.id) {
        onUpdateCurrentUser(permissionModalUser);
      }
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
        <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3 px-1">{title} ({list.length})</h3>
        <div className="space-y-3">
          {list.map(u => (
            <div key={u.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-blue-900 truncate">{u.name}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{u.email}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {u.isAdminUser && (
                    u.isMasterAdmin || u.email === 'Admin' 
                      ? <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-black tracking-widest uppercase italic border border-purple-200">Adm Master</span>
                      : <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black tracking-widest uppercase italic border border-amber-200">Adm Comum</span>
                  )}
                  {u.status === 'disabled' && <span className="text-[8px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Desabilitado</span>}
                </div>
              </div>
              <div className="flex gap-1.5 ml-4">
                {u.status === 'authorized' && (isMaster || currentUser.canViewOthers || currentUser.canReadOnlyMode) && (
                  <button onClick={() => handleImpersonate(u)} className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                )}
                {u.status === 'pending' && (isMaster || currentUser.canApprove) && (
                  <button 
                    onClick={() => onAwaitingConductorRegistration(u)} 
                    className="bg-green-600 text-white p-2 rounded-lg text-[10px] font-black uppercase px-4 shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all"
                  >
                    Analisar e Aceitar
                  </button>
                )}
                {u.status === 'authorized' && isMaster && (
                  <button onClick={() => { 
                    setPermissionModalUser(u); 
                    setInitialAdminStatus(u.isAdminUser || false);
                    setAdminCheckPassword('');
                    setPermissionError(null); 
                  }} className="bg-purple-50 text-purple-600 p-2 rounded-lg">
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

  const admins = filteredUsersForAdmin.filter(u => u.isAdminUser);
  const masterAdmins = admins.filter(u => u.isMasterAdmin || u.email === 'Admin');
  const commonAdmins = admins.filter(u => !u.isMasterAdmin && u.email !== 'Admin');
  
  const others = filteredUsersForAdmin.filter(u => !u.isAdminUser);
  const pending = others.filter(u => u.status === 'pending');
  const authorized = others.filter(u => u.status === 'authorized');
  const disabled = others.filter(u => u.status !== 'pending' && u.status !== 'authorized');

  return (
    <Layout title="Acessos" onBack={goBack}>
      <div className="max-w-3xl mx-auto py-6">
        <Section title="Administradores Master" list={masterAdmins} />
        <Section title="Administradores Comuns" list={commonAdmins} />
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
              <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">Confirmar Ação</h3>
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
              <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight text-red-600">Excluir Permanentemente?</h3>
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
              <h3 className="text-xl font-black text-blue-900 uppercase">Níveis de Acesso: {permissionModalUser.name}</h3>
              {permissionError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-[10px] font-black uppercase border-l-4 border-red-500 animate-pulse mt-4">
                  {permissionError}
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar-heavy">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                  <span className="font-bold text-blue-900 text-sm uppercase">Tornar Administrador</span>
                  <button 
                    onClick={() => {
                      setPermissionError(null);
                      const newVal = !permissionModalUser.isAdminUser;
                      if (!newVal) {
                        // Se desativar admin, desativa master e todas as sub-permissões
                        setPermissionModalUser({
                          ...permissionModalUser, 
                          isAdminUser: false,
                          isMasterAdmin: false,
                          canApprove: false,
                          canRegister: false,
                          canManageLocations: false,
                          canDeleteUser: false,
                          canResetPasswords: false,
                          canEnableDisableUsers: false,
                          canEditCRR: false,
                          canReadOnlyMode: false,
                          canManageMessages: false,
                          canSendBulletins: false,
                          canChat: false,
                          canViewOthers: false
                        });
                      } else {
                        setPermissionModalUser({...permissionModalUser, isAdminUser: true});
                      }
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${permissionModalUser.isAdminUser ? 'bg-blue-600' : 'bg-gray-300'}`}
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
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest border-b border-blue-50 pb-1">{category.group}</h4>
                        <div className="space-y-2">
                          {category.opts.map(opt => (
                            <label key={opt.key} className="flex items-center gap-3 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                checked={(permissionModalUser as any)[opt.key]}
                                onChange={(e) => {
                                  setPermissionError(null);
                                  setPermissionModalUser({...permissionModalUser, [opt.key]: e.target.checked});
                                }}
                              />
                              <span className="text-xs font-semibold text-gray-700 group-hover:text-blue-600 transition-colors uppercase">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="mt-8 pt-4 border-t border-blue-50">
                      <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Escopo de Controle</h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mb-3 text-red-500 italic">Necessário para ações do grupo "Gestão de Pessoas Selecionada"</p>
                      <button 
                        onClick={() => setShowScopeSelector(true)}
                        className="w-full bg-blue-50 text-blue-700 py-3 rounded-xl font-bold uppercase text-[10px] border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
                        Configurar Usuários Gerenciados ({(permissionModalUser.managedUserEmails || []).length})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 border-t bg-gray-50 space-y-4">
              {permissionModalUser.isAdminUser !== initialAdminStatus && (
                <div className="animate-slide-down">
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 text-left">Confirme sua senha de Admin para {permissionModalUser.isAdminUser ? 'Conceder' : 'Retirar'} acesso:</p>
                  <input 
                    type="password" 
                    value={adminCheckPassword} 
                    onChange={e => {
                      setAdminCheckPassword(e.target.value);
                      setPermissionError(null);
                    }}
                    placeholder="Digite sua senha de Admin"
                    className="w-full border-2 border-blue-100 rounded-xl p-3 text-center font-bold focus:border-blue-600 outline-none transition-all text-sm"
                  />
                </div>
              )}
              <div className="flex gap-4">
                <button onClick={savePermissions} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-xs">Salvar Alterações</button>
                <button onClick={() => {
                  setPermissionModalUser(null);
                  setAdminCheckPassword('');
                  setInitialAdminStatus(null);
                }} className="flex-1 bg-white border border-gray-200 text-gray-500 py-4 rounded-xl font-black uppercase hover:bg-gray-100 transition-all text-xs">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScopeSelector && permissionModalUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[250] animate-fade-in backdrop-blur-md">
          <div className="bg-white rounded-3xl p-8 w-full max-w-xl shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">Escopo de Controle</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Selecione os usuários que {permissionModalUser.name} terá autoridade</p>
              </div>
              <button onClick={() => setShowScopeSelector(false)} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-2xl">
              <span className="text-[10px] font-black text-blue-900 uppercase">Ações Rápidas:</span>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    const allEmails = users.filter(usr => usr.email !== 'Admin' && usr.id !== permissionModalUser.id).map(usr => usr.email);
                    setPermissionModalUser({...permissionModalUser, managedUserEmails: allEmails});
                  }}
                  className="text-[10px] font-black text-blue-600 uppercase hover:underline"
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
                    ? 'border-blue-600 bg-blue-50 shadow-sm' 
                    : 'border-gray-100 hover:border-blue-200'
                  }`}>
                    <input 
                      type="checkbox"
                      className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                      checked={(permissionModalUser.managedUserEmails || []).includes(usr.email)}
                      onChange={(e) => {
                        const current = permissionModalUser.managedUserEmails || [];
                        const next = e.target.checked ? [...current, usr.email] : current.filter(email => email !== usr.email);
                        setPermissionModalUser({...permissionModalUser, managedUserEmails: next});
                      }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[12px] font-black leading-tight truncate uppercase ${
                        (permissionModalUser.managedUserEmails || []).includes(usr.email) ? 'text-blue-900' : 'text-gray-700'
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
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all text-xs"
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
              <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">Alterar Senha?</h3>
              <p className="text-sm text-gray-500 mt-2">Deseja Realmente Alterar a Senha Deste Usuário (<strong>{passwordConfirmUser.name}</strong>)?</p>
              <p className="text-[10px] text-amber-600 font-bold uppercase mt-2">Uma nova senha será gerada aleatoriamente pelo sistema.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleChangePassword}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all text-center"
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
                 <p className="text-2xl font-mono font-black text-blue-900 tracking-widest selection:bg-blue-100">{newPasswordGenerated}</p>
              </div>
              <p className="text-[9px] text-gray-400 font-bold uppercase mt-4">Anote ou copie a senha acima e informe ao usuário.</p>
            </div>
            <button 
              onClick={() => { setPasswordConfirmUser(null); setNewPasswordGenerated(null); }}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all text-center"
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
            <h2 className="text-2xl font-black text-blue-900 uppercase tracking-tight">Quadro de Avisos</h2>
            <p className="text-xs text-gray-400 font-bold uppercase">Gerencie os avisos oficiais do sistema</p>
          </div>
          <button 
            onClick={() => navigate('admin_bulletin_form')}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Aviso
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Carregando Avisos...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-100 italic font-bold text-gray-400 uppercase text-xs">
            Nenhum aviso cadastrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {messages.map(msg => (
              <div key={msg.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center group hover:shadow-xl hover:shadow-blue-50 transition-all duration-300">
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="font-black text-blue-900 uppercase tracking-tight truncate">{(msg.title?.toUpperCase() === 'COMUNICADO CORUS' || !msg.title) ? 'AVISO' : msg.title}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                      {new Date(msg.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Por: {msg.created_by}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedMessageId(msg.id)}
                    className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
                    title="Ver Status de Leitura"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span className="text-[10px] font-black uppercase hidden sm:block">Status</span>
                  </button>
                  <button 
                    onClick={() => navigate('admin_bulletin_form', msg)}
                    className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all"
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
            <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tight">Status de Leitura</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Acompanhamento de engajamento do aviso</p>
          </div>
          <button onClick={onClose} className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Analisando dados...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-blue-50 p-4 rounded-3xl text-center">
                <span className="text-[9px] font-black text-blue-400 uppercase block mb-1">Total</span>
                <p className="text-2xl font-black text-blue-900">{totalCount}</p>
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
                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
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
                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
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
        <div className="bg-white p-8 rounded-[32px] shadow-2xl space-y-6 border-b-8 border-blue-600">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-1">Título do Aviso (Opcional)</label>
            <input 
              type="text" 
              placeholder="Digite o título do aviso..."
              className="w-full border-2 border-gray-100 rounded-2xl p-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all font-bold text-blue-900" 
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-1">Conteúdo do Aviso</label>
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
              className="flex-1 bg-blue-50 text-blue-700 py-4 rounded-2xl font-black uppercase text-xs hover:bg-blue-600 hover:text-white transition-all shadow-lg shadow-blue-100/50 flex items-center justify-center gap-2 border-2 border-blue-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
              {selectedUserEmails.length > 0 ? `Compartilhar com (${selectedUserEmails.length})` : 'Compartilhar com...'}
            </button>
            <button 
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95 disabled:opacity-50"
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
                <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tight">Destinatários</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Selecione quem verá este aviso</p>
              </div>
              <button onClick={() => setShowUserSelector(false)} className="bg-gray-100 p-2 rounded-xl text-gray-400 hover:text-red-500 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-2xl mb-4">
              <span className="text-[10px] font-black text-blue-900 uppercase">Ações Rápidas:</span>
              <div className="flex gap-4">
                <button 
                  onClick={() => setSelectedUserEmails(users.filter(u => u.email !== 'Admin').map(u => u.email))}
                  className="text-[10px] font-black text-blue-600 uppercase hover:underline"
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
                    ? 'border-blue-600 bg-blue-50 shadow-sm' 
                    : 'border-gray-100 hover:border-blue-200'
                  }`}>
                    <input 
                      type="checkbox"
                      className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
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
                        selectedUserEmails.includes(usr.email) ? 'text-blue-900' : 'text-gray-700'
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
                className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black uppercase shadow-xl shadow-blue-100 active:scale-95 transition-all text-sm tracking-widest"
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

const BulletinDisplayModal = ({ unreadBulletins, onStatusUpdate, onDismiss, isReadOnly }: { unreadBulletins: (BulletinMessage & { status_id: string })[], onStatusUpdate: () => void, onDismiss: () => void, isReadOnly?: boolean }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = unreadBulletins[currentIndex];

  if (!current) return null;

  const handleAction = async (status: 'read' | 'pending', showAgain: boolean) => {
    if (isReadOnly) {
      if (currentIndex < unreadBulletins.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onDismiss();
      }
      return;
    }
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
        
        <div className="bg-blue-950 p-4 sm:p-5 text-white relative flex-shrink-0">
          <div className="absolute top-2 right-4 opacity-10">
             <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="relative z-10">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 text-blue-300">{currentIndex + 1} / {unreadBulletins.length}</p>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none drop-shadow-sm">{(current.title?.toUpperCase() === 'COMUNICADO CORUS' || !current.title) ? 'AVISO' : current.title}</h2>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 prose prose-blue max-w-none quill-content bg-white">
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
             className="flex-1 bg-white text-blue-900 border-2 border-blue-100 py-3 sm:py-3.5 rounded-[20px] font-black uppercase text-xs hover:bg-blue-50 transition-all flex items-center justify-center gap-3 active:scale-95 hover:border-blue-200"
           >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Lembrar Depois
           </button>
        </div>
      </div>
    </div>
  );
};

const BulletinHistoryScreen = ({ goBack, ownerEmail }: any) => {
  const [history, setHistory] = useState<(BulletinMessage & { status: string, viewed_at: string })[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!ownerEmail) return;
      setLoading(true);
      const { data: statuses } = await supabase.from('bulletin_user_status')
        .select(`*, bulletin_messages(*)`)
        .eq('user_id', ownerEmail)
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
  }, [ownerEmail]);

  return (
    <Layout title="Meus Avisos" onBack={goBack}>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {loading ? (
           <div className="text-center py-20 animate-pulse">
             <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
             <span className="text-xs font-black text-blue-400 uppercase tracking-widest italic">Buscando histórico...</span>
           </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-gray-100">
             <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-gray-200"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
             <p className="text-xs font-black text-gray-400 uppercase tracking-widest italic">Você ainda não recebeu nenhum aviso.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map(msg => (
              <details key={msg.status_id} className="group bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-xl hover:shadow-blue-50">
                <summary className="p-6 cursor-pointer list-none flex justify-between items-center">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-3 mb-1">
                       <span className={`w-2 h-2 rounded-full ${msg.status === 'read' ? 'bg-gray-300' : 'bg-blue-600 animate-pulse'}`}></span>
                       <h3 className="font-black text-blue-900 uppercase tracking-tight truncate">{(msg.title?.toUpperCase() === 'COMUNICADO CORUS' || !msg.title) ? 'AVISO' : msg.title}</h3>
                    </div>
                    <div className="flex gap-4 items-center">
                       <span className="text-[9px] font-black text-gray-400 uppercase">Enviado em: {new Date(msg.created_at).toLocaleDateString('pt-BR')}</span>
                       {msg.status === 'read' && <span className="text-[9px] font-black text-green-600 uppercase">Lido em: {new Date(msg.viewed_at).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                  <div className="text-blue-400 group-open:rotate-180 transition-transform">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </summary>
                <div className="px-8 pb-8 pt-2 prose prose-blue max-w-none prose-sm quill-content border-t border-gray-50 bg-gray-50/30">
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
             <div className="p-4 bg-blue-900 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                <span>Contatos</span>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-blue-800 border-none text-[10px] px-3 py-1.5 rounded w-28 outline-none placeholder:text-blue-400 font-bold"
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
                      className={`w-full p-4 text-left hover:bg-blue-50 transition-all flex justify-between items-center ${selectedUserEmail === email ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                    >
                      <div className="flex flex-col">
                        <span className={`font-bold text-sm uppercase ${isUnread ? 'text-blue-600 font-black' : 'text-blue-900'}`}>{userObj?.name || email}</span>
                        <span className="text-xs text-gray-400 font-bold uppercase truncate max-w-[140px]">{userObj?.congregation ? `Cong: ${userObj.congregation}` : email}</span>
                      </div>
                      {isUnread && <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce shadow-sm"></span>}
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
                      <h4 className="font-black text-blue-900 uppercase text-sm">{users.find(u => u.email.toLowerCase() === selectedUserEmail?.toLowerCase())?.name || selectedUserEmail}</h4>
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
                                 className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                               />
                               <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm text-sm font-medium leading-relaxed relative ${m.sender_id === 'Admin' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-100 text-gray-800'}`}>
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
                                  <p className={`text-xs font-bold uppercase ${m.sender_id === 'Admin' ? 'text-blue-200' : 'text-gray-400'}`}>
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
              <h3 className="text-xl font-black text-blue-900 uppercase">Confirmar Exclusão Total</h3>
              <p className="text-sm text-gray-500 mt-2">Isto apagará permanentemente TODO o histórico desta conversa no banco de dados. Digite sua senha Administradora para confirmar:</p>
            </div>
            <input 
              type="password" 
              placeholder="Sua senha..."
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              className="w-full border-2 border-gray-100 rounded-xl p-3 text-center font-bold focus:border-blue-600 outline-none transition-all"
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
              <h3 className="text-xl font-black text-blue-900 uppercase">Excluir Mensagens Selecionadas</h3>
              <p className="text-sm text-gray-500 mt-2">Você selecionou {selectedMsgIds.length} mensagens. Isto as removerá permanentemente do banco de dados. Digite sua senha Administradora para confirmar:</p>
            </div>
            <input 
              type="password" 
              placeholder="Sua senha..."
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              className="w-full border-2 border-gray-100 rounded-xl p-3 text-center font-bold focus:border-blue-600 outline-none transition-all font-mono"
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

const FloatingChat = ({ currentUser, viewingUser, isAdmin: isAdminProp }: { currentUser: UserAccount, viewingUser?: UserAccount | null, isAdmin?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const isReadOnly = !!viewingUser;
  const activeEmail = viewingUser ? viewingUser.email : currentUser?.email;
  const isAdmin = isReadOnly ? false : (isAdminProp ?? (currentUser.email === 'Admin' || currentUser.isMasterAdmin || currentUser.canChat));
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
      if (!activeEmail) return;

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
        .or(`and(sender_id.eq.${activeEmail},receiver_id.eq.${otherPerson}),and(sender_id.eq.${otherPerson},receiver_id.eq.${activeEmail})`)
        .order('created_at', { ascending: true });

      const newMessages = data || [];
      
      if (!isInitial && newMessages.length > messages.length) {
        const lastNew = newMessages[newMessages.length - 1];
        if (lastNew.sender_id !== activeEmail && !isOpen) {
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
            audio.volume = 0.4;
            audio.play();
          } catch (e) {}
        }
      }

      setMessages(newMessages);

      if (!isOpen && !isAdmin) {
        setUnreadCount(newMessages.filter(m => m.receiver_id === activeEmail && !m.read_at).length);
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
    if (isReadOnly || !isOpen) return;
    const otherEmail = isAdmin ? activeAdminConvo : 'Admin';
    if (!otherEmail) return;

    try {
      await supabase.from('gca_chat_messages')
        .update({ read_at: getBrasiliaISO() })
        .eq('sender_id', otherEmail)
        .eq('receiver_id', isAdmin ? 'Admin' : activeEmail)
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
    if (isReadOnly) return;
    if (!text.trim() || !activeEmail) return;

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
          sender_id: isAdmin ? 'Admin' : activeEmail,
          receiver_id: receiver,
          sender_name: isAdmin ? 'Administrador' : (viewingUser?.name || currentUser.name || 'Usuário'),
          text: msgText,
          status: 'Ativa',
          is_edited: true,
          original_message_id: editingMsg.id,
          reply_to_id: editingMsg.reply_to_id
        });

        setEditingMsg(null);
      } else {
        await supabase.from('gca_chat_messages').insert({
          sender_id: isAdmin ? 'Admin' : activeEmail,
          receiver_id: receiver,
          sender_name: isAdmin ? 'Administrador' : (viewingUser?.name || currentUser.name || 'Usuário'),
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
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end gap-3 no-print pointer-events-none">
      {isOpen && (
        <div className={`bg-[#f8fafc] shadow-2xl border border-blue-100 flex flex-col overflow-hidden animate-slide-up transition-all duration-300 pointer-events-auto ${isExpanded ? 'fixed inset-0 sm:inset-4 w-auto h-auto z-[2000] rounded-t-3xl sm:rounded-3xl' : 'w-[calc(100vw-3rem)] sm:w-96 h-[500px] max-h-[70vh] rounded-3xl'}`}>
          {/* Header System Style */}
          <div className={`${isExpanded ? 'p-6' : 'p-4'} bg-blue-600 text-white flex justify-between items-center shrink-0 shadow-lg z-20`}>
            <div className="flex items-center gap-3">
              {isAdmin && activeAdminConvo && (
                <button onClick={() => { setActiveAdminConvo(null); setShowConvoSearch(false); setConvoSearch(''); }} className="p-2 hover:bg-white/20 rounded-full transition-colors mr-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
              )}
              <div className="relative group">
                <div className={`bg-blue-400 rounded-full flex items-center justify-center font-black uppercase text-white shadow-inner border-2 border-blue-500/50 ${isExpanded ? 'w-14 h-14 text-2xl' : 'w-10 h-10 text-sm'}`}>
                  {isAdmin ? (
                    activeAdminConvo ? (userList.find(u => u.email === activeAdminConvo)?.name?.charAt(0) || 'U') : 'A'
                  ) : 'S'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-blue-600 rounded-full"></div>
              </div>
              <div className="flex flex-col">
                <span className={`font-black tracking-tight leading-none ${isExpanded ? 'text-2xl' : 'text-base'}`}>
                  {isAdmin ? (
                    activeAdminConvo ? (userList.find(u => u.email === activeAdminConvo)?.name || activeAdminConvo) : 'Portal de Suporte'
                  ) : (isReadOnly ? `Visão: ${viewingUser?.name || activeEmail}` : 'Suporte CORUS')}
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
                  className="w-full bg-gray-50 border-none rounded-xl py-2 px-4 text-xs font-bold outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-blue-600 transition-all"
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
                        className="w-full bg-gray-100 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
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
                        <button key={u.id} onClick={() => setActiveAdminConvo(u.email)} className="w-full flex items-center gap-4 p-4 hover:bg-blue-50 transition-all border-b border-gray-50 group">
                           <div className="relative">
                             <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 uppercase font-black text-xl shadow-sm border border-blue-200 group-hover:scale-110 transition-transform">
                                {u.name.charAt(0)}
                             </div>
                             {isUnread && <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 border-2 border-white rounded-full"></div>}
                           </div>
                           <div className="flex-1 text-left overflow-hidden">
                              <div className="flex justify-between items-center mb-1">
                                 <span className="font-black text-sm truncate text-blue-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{u.name}</span>
                                 {lastMsg && <span className="text-[10px] font-black text-gray-400">{new Date(lastMsg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                              </div>
                              <div className="flex justify-between items-center">
                                 <p className={`text-xs truncate ${isUnread ? 'text-blue-600 font-black' : 'text-gray-500 font-medium'}`}>
                                    {lastMsg ? lastMsg.text : 'Conversa vazia'}
                                 </p>
                                 {isUnread && <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm ml-2">NOVO</span>}
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
                     const isMe = m.sender_id === activeEmail;
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
                               className={`max-w-[85%] relative p-3 shadow-sm rounded-2xl text-sm transition-all cursor-pointer group animate-fade-in ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white rounded-tl-none text-gray-800 border border-blue-50/50'}`}
                             >
                                {repliedMsg && (
                                   <div className={`p-2 rounded-xl mb-2 text-xs opacity-80 border-l-4 overflow-hidden truncate flex flex-col gap-0.5 ${isMe ? 'bg-blue-700 border-blue-300' : 'bg-blue-50 border-blue-600'}`}>
                                      <span className="font-black uppercase text-[8px] tracking-widest">Em resposta a</span>
                                      <p className="truncate italic">"{repliedMsg.text}"</p>
                                   </div>
                                )}
                                {m.deleted_for_everyone ? (
                                   <p className="italic text-[10px] opacity-60 text-center py-1">Mensagem apagada para todos</p>
                                ) : (
                                   <div className="flex flex-col">
                                      {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                                      {m.image_url && <img src={m.image_url} alt="anexo" className="mt-2 rounded-xl border border-white/20 shadow-md max-h-60 object-cover" referrerPolicy="no-referrer" />}
                                   </div>
                                )}
                                
                                <div className="flex justify-end items-center gap-1.5 mt-1.5">
                                   <span className={`text-[9px] font-black uppercase tracking-widest ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
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
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 text-blue-300"><polyline points="20 6 9 17 4 12"/></svg>
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
                             <div className="fixed inset-0 z-[1100] bg-blue-900/10 backdrop-blur-[2px]" onClick={() => setShowMsgOptions(null)}>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl shadow-2xl p-3 w-64 animate-zoom-in border border-blue-50" onClick={e => e.stopPropagation()}>
                                   <div className="flex justify-between items-center px-4 py-2 border-b border-gray-50 mb-2">
                                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Opções da Mensagem</span>
                                      <button onClick={() => setShowMsgOptions(null)} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                      </button>
                                   </div>
                                   <button onClick={() => { setReplyTo(m); setShowMsgOptions(null); setEditingMsg(null); }} className="w-full text-left p-3 hover:bg-blue-50 rounded-2xl text-xs font-black uppercase text-blue-600 flex items-center gap-4 transition-colors">
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
                        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
                           <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <p className="text-xs font-black text-blue-900 uppercase tracking-widest leading-loose">Nenhuma mensagem nesta conversa ainda.<br/>Digite algo para começar!</p>
                     </div>
                  )}
               </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col bg-white p-4 border-t border-blue-50 shadow-inner">
            {isReadOnly && (
              <div className="bg-amber-50 text-amber-800 text-[10px] font-black uppercase text-center py-2 mb-2 rounded-lg border border-amber-200">
                Modo Visualização (Somente Leitura)
              </div>
            )}
            {replyTo && (
              <div className="bg-blue-50 p-2.5 rounded-2xl border-l-4 border-blue-600 flex justify-between items-center animate-slide-up mb-3 shadow-sm">
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter">Respondendo Mensagem</span>
                    <div className="truncate text-xs text-blue-900 font-medium italic">"{replyTo.text}"</div>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-blue-300 hover:text-red-500 p-2 bg-white rounded-full shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
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
                        disabled={(isAdmin && !activeAdminConvo) || isReadOnly}
                        type="text" 
                        placeholder={isReadOnly ? "Apenas leitura..." : (isAdmin && !activeAdminConvo ? "Selecione um chat..." : "Escreva sua mensagem...")}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        className="w-full bg-gray-100 border-none rounded-2xl py-3.5 px-6 text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all shadow-sm placeholder:text-gray-400 disabled:opacity-50"
                      />
                    </div>
                    <button type="submit" disabled={!text.trim() || (isAdmin && !activeAdminConvo) || isReadOnly} className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200 active:scale-90 hover:bg-blue-700 transition-all disabled:opacity-50 group">
                       <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
            </form>
          </div>
        </div>
      )}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`group relative flex items-center justify-center rounded-3xl shadow-2xl transition-all duration-500 active:scale-90 pointer-events-auto ${isOpen ? 'w-16 h-16 bg-red-500 rotate-90 scale-110' : 'w-20 h-20 bg-blue-600 hover:scale-110'}`}
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
            <span className="text-[8px] font-black text-blue-100 uppercase tracking-tighter">Chat</span>
          </div>
        )}
      </button>
    </div>
  );
};

const ProfileScreen = ({ user, goBack, onUpdate, onExitImpersonation, isReadOnly }: any) => {
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
          <div className="p-8 border-b border-blue-50 flex justify-between items-center bg-blue-50/30">
            <div>
              <h3 className="text-xl font-black text-blue-900 uppercase tracking-tighter">Informações Pessoais</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-widest">Apenas campos autorizados para edição</p>
            </div>
            {!isReadOnly && (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`p-3 rounded-2xl transition-all ${isEditing ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-600 border border-blue-100 shadow-sm'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest block mb-2">Nome Completo</label>
                <input 
                  disabled={!isEditing}
                  className={`w-full p-4 rounded-xl font-bold border-2 transition-all ${isEditing ? 'border-blue-100 bg-white focus:border-blue-600 outline-none' : 'border-transparent bg-gray-50 text-gray-400'}`}
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest block mb-2">E-mail / Gmail</label>
                <input 
                  type="email"
                  disabled={!isEditing}
                  className={`w-full p-4 rounded-xl font-bold border-2 transition-all ${isEditing ? 'border-blue-100 bg-white focus:border-blue-600 outline-none' : 'border-transparent bg-gray-50 text-gray-400'}`}
                  value={editForm.email}
                  onChange={e => setEditForm({...editForm, email: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest block mb-2">Telefone</label>
                <input 
                  disabled={!isEditing}
                  className={`w-full p-4 rounded-xl font-bold border-2 transition-all ${isEditing ? 'border-blue-100 bg-white focus:border-blue-600 outline-none' : 'border-transparent bg-gray-50 text-gray-400'}`}
                  value={editForm.phone}
                  onChange={e => setEditForm({...editForm, phone: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest block mb-2">Data de Nascimento (Idade: {calculateAge(editForm.birth_date)})</label>
                <input 
                  type="date"
                  disabled={!isEditing}
                  className={`w-full p-4 rounded-xl font-bold border-2 transition-all ${isEditing ? 'border-blue-100 bg-white focus:border-blue-600 outline-none' : 'border-transparent bg-gray-50 text-gray-400'}`}
                  value={editForm.birth_date}
                  onChange={e => setEditForm({...editForm, birth_date: e.target.value})}
                />
              </div>

              {/* Informações Read-Only do CRR */}
              <div className="md:col-span-2 pt-6 border-t border-gray-50">
                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Informações de Registro (Não Editáveis)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nº Registro (CRR)</span>
                    <p className="font-black text-blue-900">{conductor?.registry_number || 'PENDENTE'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Cargo / Função</span>
                    <p className="font-black text-blue-900 uppercase">{user.role}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Congregação</span>
                    <p className="font-black text-blue-900 uppercase">{congregationName || user.congregation}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Estado de Atuação</span>
                    <p className="font-black text-blue-900 uppercase">{stateName || '-'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Data de Cadastro</span>
                    <p className="font-black text-blue-900">{conductor?.created_at ? new Date(conductor.created_at).toLocaleDateString('pt-BR') : '-'}</p>
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
                  className="flex-1 bg-blue-700 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg shadow-blue-100 active:scale-95 transition-all"
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
            
            {!isReadOnly && (
              <div className="pt-8 border-t border-gray-100 flex flex-col items-center">
                <button 
                  onClick={() => setShowPasswordModal(true)}
                  className="flex items-center gap-3 text-blue-600 font-black uppercase text-[11px] tracking-widest hover:text-blue-800 transition-all group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Alterar Senha de Acesso
                </button>
              </div>
            )}
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
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full mx-auto flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3m-3-3l2.5-2.5"/></svg>
              </div>
              <h3 className="text-xl font-black text-blue-900 uppercase">Trocar Senha</h3>
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
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-600 rounded-xl outline-none font-black text-center tracking-[4px]"
                  value={passwordForm.current}
                  onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                />
              </div>
              <div className="h-px bg-gray-100" />
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nova Senha</label>
                <input 
                  type="password"
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-600 rounded-xl outline-none font-black text-center tracking-[4px]"
                  value={passwordForm.next}
                  onChange={e => setPasswordForm({...passwordForm, next: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Confirmar Nova Senha</label>
                <input 
                  type="password"
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-600 rounded-xl outline-none font-black text-center tracking-[4px]"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={handlePasswordChange}
                disabled={loading || !passwordForm.current || !passwordForm.next || !passwordForm.confirm}
                className="w-full bg-blue-700 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg shadow-blue-100 disabled:opacity-50 transition-all active:scale-95"
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Pano de Fundo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('https://i.postimg.cc/wM71bq2V/login-bg-png.png')"
        }}
      />

      {/* Overlay escuro (melhora leitura) */}
      <div className="absolute inset-0 bg-black/40" />

      <div className={`bg-white rounded-2xl shadow-2xl p-8 w-full ${mode === 'request' ? 'max-w-md' : 'max-w-sm'} transition-all duration-300 relative z-10`}>
        <div className="text-center mb-6 flex flex-col items-center">
          <img 
            src="https://i.postimg.cc/K8X69mDY/image-removebg-preview.png" 
            alt="CORUS Logo" 
            className="w-40 sm:w-52 h-auto contrast-[1.15] saturate-[1.1] opacity-100" 
            style={{ imageRendering: 'high-quality', transform: 'translateZ(0)' }}
          />
        </div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold mb-4 border-l-4 border-red-500">{error}</div>}
        
        {mode === 'forgot' ? (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 text-center uppercase tracking-tight">Recuperar Senha</h3>
            {!foundRecoveryUser ? (
              <form onSubmit={handleRecoverySearch} className="space-y-4">
                <p className="text-xs text-gray-700 text-center italic font-medium">Informe seu e-mail e sua data de nascimento cadastrados para confirmar sua identidade.</p>
                <input required type="text" placeholder="Seu E-mail" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={recoverySearch.email} onChange={e => setRecoverySearch({...recoverySearch, email: e.target.value})} />
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-900 uppercase tracking-widest ml-1 block">Sua Data de Nascimento</label>
                  <input required type="date" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={recoverySearch.birth_date} onChange={e => setRecoverySearch({...recoverySearch, birth_date: e.target.value})} />
                </div>
                <button type="submit" className="w-full bg-blue-700 text-white py-4 rounded-xl font-black uppercase shadow-lg hover:bg-blue-800 transition-all active:scale-95">Verificar Dados</button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-green-600 text-center font-bold">Identidade confirmada! Defina sua nova senha abaixo.</p>
                <div className="relative">
                  <input required type={showPassword ? "text" : "password"} placeholder="Nova Senha" title="Mínimo 6 caracteres" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={newPasswordData.password} onChange={e => setNewPasswordData({...newPasswordData, password: e.target.value})} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-blue-600">
                    {showPassword ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                </div>
                <input required type={showPassword ? "text" : "password"} placeholder="Confirmar Nova Senha" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={newPasswordData.confirm} onChange={e => setNewPasswordData({...newPasswordData, confirm: e.target.value})} />
                <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase shadow-lg hover:bg-green-700 transition-all active:scale-95">Salvar Nova Senha</button>
              </form>
            )}
            <button onClick={() => { setMode('login'); setError(''); setFoundRecoveryUser(null); setRecoverySearch({ email: '', birth_date: '' }); }} className="w-full text-gray-400 text-[10px] font-black uppercase mt-4 tracking-widest text-center">Voltar ao Login</button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'request' && <input required placeholder="Nome Completo" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
              <input required type="text" placeholder="E-mail" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              {mode === 'request' && <input required placeholder="Congregação (Ex: Sede /SP)" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.congregation} onChange={e => setFormData({...formData, congregation: e.target.value})} />}
              {mode === 'request' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-900 uppercase tracking-widest ml-1 mb-1 block">Data de Nascimento</label>
                    <input required type="date" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-900 uppercase tracking-widest ml-1 mb-1 block">Telefone (WhatsApp)</label>
                    <input required placeholder="(00) 00000-0000" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
              )}
              {mode === 'request' && <input required placeholder="Cargo no Ministério" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />}
              <div className="relative">
                <input required type={showPassword ? "text" : "password"} placeholder="Senha" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-blue-600 transition-colors">
                  {showPassword ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              {mode === 'request' && <input required type={showPassword ? "text" : "password"} placeholder="Confirmar Senha" className="w-full border border-black rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />}
              
              <button type="submit" className="w-full bg-blue-700 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-800 transition-all active:scale-95">{mode === 'login' ? 'Entrar' : 'Solicitar Acesso'}</button>
            </form>
            <div className="flex flex-col gap-4 mt-6">
              {mode === 'login' && (
                <button onClick={() => { setMode('forgot'); setError(''); }} className="text-blue-600 text-xs font-black uppercase tracking-widest hover:underline transition-colors text-center w-full bg-blue-50 py-2 rounded-lg">Esqueci minha senha</button>
              )}
              <button onClick={() => { setMode(mode === 'login' ? 'request' : 'login'); setError(''); setShowPassword(false); }} className="w-full text-blue-600 text-xs font-bold uppercase tracking-widest">
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
  const [relationData, setRelationData] = useState<any>(null);
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
    // Sincronização inicial com o histórico do navegador (útil após reloads/mounts)
    if (window.history.state && window.history.state.screen) {
      const s = window.history.state;
      setScreen(s.screen);
      setHistory(s.history || []);
      if (s.editData !== undefined) setEditData(s.editData);
      if (s.notebookData !== undefined) setNotebookData(s.notebookData);
      if (s.reportData !== undefined) setReportData(s.reportData);
      if (s.attendanceEditData !== undefined) setAttendanceEditData(s.attendanceEditData);
    } else {
      window.history.replaceState({ screen: 'home', history: [] }, '', window.location.pathname);
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.screen) {
        // Apenas atualiza se o estado for diferente para evitar loops com goBack manual
        setScreen(e.state.screen);
        setHistory(e.state.history || []);
        
        if (e.state.editData !== undefined) setEditData(e.state.editData);
        if (e.state.notebookData !== undefined) setNotebookData(e.state.notebookData);
        if (e.state.reportData !== undefined) setReportData(e.state.reportData);
        if (e.state.attendanceEditData !== undefined) setAttendanceEditData(e.state.attendanceEditData);
      } else if (screen !== 'home') {
        // Se voltar para antes do primeiro estado registrado e não estiver na home, força home
        setScreen('home');
        setHistory([]);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.email === 'Admin') return;
    
    // Listener em tempo real para atualizações de permissão/status do próprio usuário
    const channel = supabase
      .channel('user-updates')
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'users',
          filter: `id=eq.${currentUser.id}`
        },
        (payload) => {
          if (payload.new) {
            setCurrentUser(payload.new as UserAccount);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const handleFocus = () => {
      if (currentUser?.id && currentUser.email !== 'Admin') {
        supabase.from('users').select('*').eq('id', currentUser.id).single().then(({ data }) => {
          if (data) {
            // Sincroniza localmente se houver mudança externa (ex: revogação de admin)
            setCurrentUser(data as UserAccount);
          }
        });
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentUser?.id]);

  const isAdmin = currentUser?.email === 'Admin' || !!currentUser?.isAdminUser;
  const isMaster = currentUser?.email === 'Admin' || (isAdmin && !!currentUser?.isMasterAdmin);

  const activeEmail = viewingUser ? viewingUser.email : currentUser?.email;
  const isReadOnly = (isMaster || currentUser?.canReadOnlyMode || currentUser?.canViewOthers) && viewingUser !== null;
  const onExitImpersonation = viewingUser ? () => { setViewingUser(null); navigate('admin_users'); } : undefined;

  useEffect(() => {
    // Redireciona para home se perder privilégios admin enquanto estiver em telas admin
    if (!isAdmin && screen.startsWith('admin_')) {
      setScreen('home');
      setHistory([]);
    }
  }, [isAdmin, screen]);

  useEffect(() => {
    if (activeEmail) {
      checkUnreadBulletins(activeEmail);
    }
  }, [activeEmail]);

  const navigate = useCallback((next: string, data?: any) => { 
    const newHistory = [...history, screen];
    
    // Captura o estado completo para persistência
    const stateData: any = { 
      screen: next, 
      history: newHistory,
      editData: (next === 'create_hymn_list' || next === 'admin_bulletin_form' || ['admin_crr_card', 'admin_new_conductor', 'admin_edit_conductor'].includes(next)) ? data : editData,
      relationData: (next === 'hymn_relation_detail' || next === 'hymn_relation_report') ? data : relationData,
      notebookData: (next === 'notebook_detail' || next === 'hymn_notebook_report') ? data : notebookData,
      reportData: ['hymn_share_pdf', 'attendance_report', 'hymn_report', 'musicians_voice_report', 'attendance_percentage_report', 'musicians_instrument_report', 'admin_countries_report', 'admin_states_report', 'admin_congregations_report', 'admin_conductors_report', 'musicians_report', 'instruments_report'].includes(next) ? data : reportData,
      attendanceEditData: next === 'roll_call' ? data : attendanceEditData
    };
    
    window.history.pushState(stateData, '', window.location.pathname);
    
    setHistory(newHistory); 
    setScreen(next); 
    if (next === 'create_hymn_list' || next === 'admin_bulletin_form') setEditData(data); 
    if (next === 'hymn_relation_detail') setRelationData(data);
    if (next === 'notebook_detail' || next === 'hymn_notebook_report') setNotebookData(data); 
    if (['hymn_share_pdf', 'attendance_report', 'hymn_report', 'musicians_voice_report', 'attendance_percentage_report', 'musicians_instrument_report', 'admin_countries_report', 'admin_states_report', 'admin_congregations_report', 'admin_conductors_report', 'musicians_report', 'instruments_report'].includes(next)) setReportData(data); 
    if (next === 'roll_call') setAttendanceEditData(data); 
    if (['admin_crr_card', 'admin_new_conductor', 'admin_edit_conductor'].includes(next)) setEditData(data); 
    
    window.scrollTo(0, 0);
  }, [history, screen, editData, notebookData, reportData, attendanceEditData]);

  const goBack = useCallback(() => { 
    if (history.length > 0) {
      const newHistory = [...history];
      const prev = newHistory.pop() || 'home';
      
      // Atualização imediata para garantir responsividade no UI
      setHistory(newHistory);
      setScreen(prev);
      
      // Sincroniza o browser history se possível
      try {
        if (window.history.state && window.history.state.screen) {
          window.history.back();
        }
      } catch (e) {
        console.warn("Navegação de histórico do browser falhou:", e);
      }
    } else if (screen !== 'home') {
      setScreen('home');
      setHistory([]);
      try {
        window.history.pushState({ screen: 'home', history: [] }, '', window.location.pathname);
      } catch (e) {}
    }
  }, [history, screen]);

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
    // Se estiver personificando e for master/admin, exporta os dados daquele usuário
    const emailToFilter = isMaster ? (viewingUser ? viewingUser.email : undefined) : currentUser.email;
    
    try {
      const backupData: any = {
        exportDate: getBrasiliaISO(),
        type: (isMaster && !viewingUser) ? 'MASTER_FULL_BACKUP' : 'USER_DATA_ONLY',
        user: viewingUser || currentUser,
      };

      const tablesToExport = [
        { name: 'instruments', key: 'gca_instruments' },
        { name: 'musicians', key: 'gca_musicians' },
        { name: 'attendance', key: 'gca_attendance' },
        { name: 'master_hymns', key: 'gca_master_hymns' },
        { name: 'hymn_lists', key: 'hymn_lists' },
        { name: 'hymn_relations', key: 'gca_hymn_relations' },
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

      const fileName = (isMaster && !viewingUser) ? `backup-SISTEMA-COMPLETO-${getBrasiliaYYYYMMDD()}.json` : `backup-perfil-${activeEmail}-${getBrasiliaYYYYMMDD()}.json`;
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
    const emailToFilter = isMaster ? (viewingUser ? viewingUser.email : undefined) : currentUser.email;

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
          hymn_lists: 'hymn_lists',
          hymn_relations: 'gca_hymn_relations'
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

  if (loadingPublic) return <div className="min-h-screen bg-blue-900 flex items-center justify-center text-white font-bold animate-pulse uppercase tracking-widest">Carregando Programa...</div>;
  if (publicProgram) return <PrintView list={publicProgram} onBack={() => { setPublicProgram(null); window.history.replaceState({}, '', window.location.pathname); }} />;

  if (!currentUser) return <AuthScreen onLogin={setCurrentUser} />;

  return (
    <NavigationContext.Provider value={{ onLogout, onProfileClick: () => navigate('profile') }}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1">
          {(() => {
            if (screen.startsWith('admin_') && !isAdmin) {
              setTimeout(() => { setScreen('home'); setHistory([]); }, 0);
              return null;
            }
            switch (screen) {
              case 'calendar': return <CalendarScreen goBack={goBack} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'profile': return <ProfileScreen user={viewingUser || currentUser} goBack={goBack} onUpdate={setCurrentUser} onExitImpersonation={onExitImpersonation} isReadOnly={isReadOnly} />;
              case 'admin_menu': return <AdminMenuScreen navigate={navigate} goBack={goBack} currentUser={currentUser} />;
              case 'admin_users': return <AdminUsersScreen goBack={goBack} onImpersonate={(u: any) => { setViewingUser(u); navigate('home'); }} currentUser={currentUser} onUpdateCurrentUser={setCurrentUser} onAwaitingConductorRegistration={(u: any) => navigate('admin_new_conductor', u)} />;
              case 'admin_countries': return <AdminCountriesScreen goBack={goBack} navigate={navigate} />;
              case 'admin_states': return <AdminStatesScreen goBack={goBack} navigate={navigate} />;
              case 'admin_congregations': return <AdminCongregationsScreen goBack={goBack} navigate={navigate} />;
              case 'admin_countries_report': return <AdminMasterReportView id="relatorio-paises" title="Relatório de Países Atendidos" columns={[{key:'id', label:'Cód.'}, {key:'name', label:'Nome do País'}]} data={reportData} goBack={goBack} />;
              case 'admin_states_report': return <AdminMasterReportView id="relatorio-estados" title="Relatório de Estados" columns={[{key:'id', label:'Cód.'}, {key:'name', label:'Nome do Estado'}, {key:'uf', label:'UF'}]} data={reportData} goBack={goBack} />;
              case 'admin_congregations_report': return <AdminMasterReportView id="relatorio-congre" title="Relatório Geral de Congregações" columns={[{key:'id', label:'Cód.'}, {key:'name', label:'Congregação'}, {key:'state', label:'Estado'}, {key:'uf', label:'UF'}, {key:'country', label:'País'}, {key:'address', label:'Endereço'}, {key:'address_number', label:'Nº'}, {key:'neighborhood', label:'Bairro'}, {key:'cep', label:'CEP'}]} data={reportData} goBack={goBack} orientation="landscape" />;
              case 'admin_conductors_report': return <AdminMasterReportView id="relatorio-regentes" title="Relatório de Regentes (CRR)" columns={[{key:'registry_number', label:'Registro'}, {key:'name', label:'Nome'}, {key:'congregation_name', label:'Congregação'}, {key:'phone', label:'Telefone'}]} data={reportData} goBack={goBack} />;
              case 'admin_conductor_certificates': return <AdminConductorCertificatesScreen navigate={navigate} goBack={goBack} currentUser={currentUser} />;
              case 'admin_new_conductor': return <AdminConductorForm goBack={goBack} linkUserBeingApproved={editData} onApprovalSuccess={() => { setEditData(null); navigate('admin_users'); }} />;
              case 'admin_edit_conductor': return <AdminConductorForm goBack={goBack} conductorToEdit={editData} />;
              case 'admin_crr_card': return <CRRCardView conductor={editData} goBack={goBack} navigate={navigate} />;
              case 'admin_registrations_summary': return <AdminRegistrationsSummaryScreen navigate={navigate} goBack={goBack} currentUser={currentUser} />;
              case 'home': return <HomeScreen navigate={navigate} onLogout={onLogout} isReadOnly={isReadOnly} isAdmin={isAdmin} onProfileClick={() => navigate('profile')} onExitImpersonation={onExitImpersonation} onBackup={handleBackup} isExporting={isExporting} onBackupCSV={handleCSVExport} isExportingCSV={isExportingCSV} />;
              case 'components': return <ComponentsScreen navigate={navigate} goBack={goBack} onExitImpersonation={onExitImpersonation} />;
              case 'instruments': return <InstrumentsScreen navigate={navigate} goBack={goBack} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'musicians': return <MusiciansScreen navigate={navigate} goBack={goBack} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'musician_report_selection': return <MusicianReportSelectionScreen navigate={navigate} goBack={goBack} ownerEmail={activeEmail} onExitImpersonation={onExitImpersonation} />;
              case 'admin_messages': return <AdminMessagesScreen goBack={goBack} currentUser={currentUser} />;
              case 'admin_bulletins': return <AdminBulletinsScreen goBack={goBack} navigate={navigate} currentUser={currentUser} />;
              case 'admin_bulletin_form': return <AdminBulletinForm goBack={goBack} navigate={navigate} initialData={editData} currentUser={currentUser} />;
              case 'bulletin_history': return <BulletinHistoryScreen goBack={goBack} ownerEmail={activeEmail} />;
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
              case 'hymns_library': return <HymnsLibraryScreen navigate={navigate} goBack={goBack} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'notebook_detail': return <NotebookDetailScreen notebook={notebookData} goBack={goBack} navigate={navigate} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'hymn_notebook_report': return <HymnNotebookReportScreen notebook={notebookData} goBack={goBack} ownerEmail={activeEmail} />;
              case 'programs': return <ProgramsScreen navigate={navigate} goBack={goBack} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'guidelines': return <GuidelinesScreen goBack={goBack} onExitImpersonation={onExitImpersonation} />;
              case 'hymn_lists': return <HymnListScreen navigate={navigate} goBack={goBack} onCreate={() => navigate('create_hymn_list')} onEdit={l => navigate('create_hymn_list', l)} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'create_hymn_list': return <CreateHymnListScreen onSave={goBack} onCancel={goBack} initialData={editData} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'hymn_share_selection': return <HymnShareSelectionScreen navigate={navigate} goBack={goBack} ownerEmail={activeEmail} onExitImpersonation={onExitImpersonation} />;
              case 'hymn_share_pdf': return <HymnSharePDFScreen selectedLists={reportData} currentUser={currentUser} goBack={goBack} />;
              case 'hymn_relations_dashboard': return <HymnRelationsDashboardScreen navigate={navigate} goBack={goBack} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'hymn_relation_detail': return <HymnRelationDetailScreen relation={relationData} goBack={goBack} navigate={navigate} ownerEmail={activeEmail} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} />;
              case 'hymn_relation_report': return <HymnRelationReportScreen relation={relationData} goBack={goBack} onExitImpersonation={onExitImpersonation} />;
              case 'hymn_report_input': return <HymnReportInputScreen onGenerate={(s: any, e: any, t: any) => navigate('hymn_report', {s, e, t})} onCancel={goBack} onExitImpersonation={onExitImpersonation} />;
              case 'data_management': return <DataManagementScreen goBack={goBack} onBackupJSON={handleBackup} isExportingJSON={isExporting} onBackupCSV={handleCSVExport} isExportingCSV={isExportingCSV} onImportJSON={handleImportJSON} onImportCSV={handleImportCSV} isReadOnly={isReadOnly} onExitImpersonation={onExitImpersonation} canExportBackups={isMaster} />;
              default: return <HomeScreen navigate={navigate} onLogout={onLogout} isReadOnly={isReadOnly} isAdmin={isAdmin} onProfileClick={() => navigate('profile')} onExitImpersonation={onExitImpersonation} />;
            }
          })()}
        </div>
        <FloatingChat currentUser={currentUser} viewingUser={viewingUser} isAdmin={isMaster || currentUser?.canChat} />
        <BulletinDisplayModal 
          unreadBulletins={unreadBulletins} 
          onStatusUpdate={() => checkUnreadBulletins(activeEmail || currentUser.email)} 
          onDismiss={() => setUnreadBulletins([])}
          isReadOnly={isReadOnly}
        />
      </div>
    </NavigationContext.Provider>
  );
};

const container = document.getElementById('root')!;
const root = (window as any)._reactRoot || ReactDOM.createRoot(container);
(window as any)._reactRoot = root;
root.render(<React.StrictMode><App /></React.StrictMode>);